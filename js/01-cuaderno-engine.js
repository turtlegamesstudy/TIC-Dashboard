'use strict';

    const MODULOS_TRANSVERSALES = [
      "Historia e Identidad Nacional",
      "Adaptación al Cambio Climático",
      "Orientación Laboral",
      "Cultura de Paz",
      "Identidad Histórica y Sociocultural de Nicaragua"
    ];

    /* ── Catálogo de módulos académicos del centro ───────────────
       MODULOS_TRANSVERSALES sigue siendo la lista que leen todas las vistas
       (Cuaderno, Estadísticas, Exámenes, Informe, Mensajes…): este objeto la
       actualiza in-place para que un módulo nuevo —el oficial que falte o uno
       inventado como "Inglés"— se propague por toda la app sin tocar código.
       La lista del centro viaja en la base como `modulosAcademicos`. */
    const ModulosAcademicos = {
      PREDETERMINADOS: Object.freeze([...MODULOS_TRANSVERSALES]),

      normalizarNombre(nombre) {
        return String(nombre === null || nombre === undefined ? '' : nombre)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      },

      // Copia defensiva: modificar lo que devuelve nunca altera la lista viva.
      listar() { return MODULOS_TRANSVERSALES.slice(); },

      cantidad() { return MODULOS_TRANSVERSALES.length; },

      contiene(nombre) {
        const clave = this.normalizarNombre(nombre);
        if (!clave) return false;
        return MODULOS_TRANSVERSALES.some(modulo => this.normalizarNombre(modulo) === clave);
      },

      _unicos(lista) {
        const vistos = new Set();
        return lista.filter(nombre => {
          const clave = this.normalizarNombre(nombre);
          if (!clave || vistos.has(clave)) return false;
          vistos.add(clave);
          return true;
        });
      },

      // Reescribe la lista en el MISMO array: todas las referencias que ya
      // existen en la app ven el cambio sin volver a leer nada.
      _aplicar(lista) {
        MODULOS_TRANSVERSALES.splice(0, MODULOS_TRANSVERSALES.length, ...lista);
      },

      _esPredeterminado(lista) {
        const normalizar = nombre => this.normalizarNombre(nombre);
        const actual = lista.map(normalizar);
        const base = this.PREDETERMINADOS.map(normalizar);
        return actual.length === base.length && actual.every((nombre, i) => nombre === base[i]);
      },

      /* Lee el catálogo guardado en la base (o la lista oficial si no existe
         todavía) y lo volca en MODULOS_TRANSVERSALES. */
      sincronizar(db) {
        const guardado = db && db.modulosAcademicos;
        const lista = this._unicos(Array.isArray(guardado) ? guardado : []);
        this._aplicar(lista.length ? lista : this.PREDETERMINADOS.slice());
        return this.listar();
      },

      _persistir(db, lista) {
        this._aplicar(lista);
        if (!db || typeof db !== 'object') return;
        // Si la lista vuelve a ser la oficial se borra la clave: la base queda
        // como estaba y no se escribe ruido en Firebase.
        if (this._esPredeterminado(lista)) delete db.modulosAcademicos;
        else db.modulosAcademicos = lista.slice();
      },

      /* Valida y añade. Devuelve { ok, nombre, anterior, lista } o { error }. */
      agregar(db, nombre) {
        const limpio = String(nombre === null || nombre === undefined ? '' : nombre)
          .replace(/\s+/g, ' ')
          .trim();
        if (!limpio) return { error: 'Escribe un nombre para el módulo.' };
        if (limpio.length > 80) return { error: 'El nombre del módulo es demasiado largo (máx. 80 caracteres).' };
        if (this.contiene(limpio)) return { error: `El módulo "${limpio}" ya está en la lista.` };
        const anterior = this.listar();
        const lista = [...anterior, limpio];
        this._persistir(db, lista);
        return { ok: true, nombre: limpio, anterior, lista };
      },

      /* Valida y quita. Nunca deja la lista vacía. */
      quitar(db, nombre) {
        const anterior = this.listar();
        if (!this.contiene(nombre)) return { error: `El módulo "${nombre}" no está en la lista.` };
        if (anterior.length <= 1) return { error: 'Debe quedar al menos un módulo en la lista.' };
        const clave = this.normalizarNombre(nombre);
        const lista = anterior.filter(modulo => this.normalizarNombre(modulo) !== clave);
        this._persistir(db, lista);
        return { ok: true, nombre, anterior, lista };
      },

      /* Reversión manual (p. ej. si Firebase rechaza la escritura). */
      restaurar(db, lista) {
        this._persistir(db, Array.isArray(lista) ? lista.slice() : this.PREDETERMINADOS.slice());
      },

      /* ¿El módulo ya tiene notas o convalidaciones registradas? Sirve para
         avisar antes de ocultarlo (los datos no se borran, solo la columna). */
      tieneNotas(nombre) {
        if (typeof DataEngine === 'undefined' || !DataEngine.getEstudiantes) return false;
        const clave = this.normalizarNombre(nombre);
        if (!clave) return false;
        const coincide = objeto => Object.keys(objeto || {}).some(
          claveObjeto => this.normalizarNombre(claveObjeto) === clave
        );
        return DataEngine.getEstudiantes().some(estudiante =>
          coincide(estudiante.evaluacionesPorModulo) || coincide(estudiante.convalidaciones)
        );
      }
    };

    const CuadernoEngine = {
      EXPORT_PREFERENCES_KEY: 'TIC_CUADERNO_EXPORT_OPTIONS',

      clavePreferenciasExportacion() {
        const uid = AuthManager.user?.uid;
        const centerId = AuthManager.activeCenterId || AuthManager.profile?.centerId;
        return uid && centerId
          ? `${this.EXPORT_PREFERENCES_KEY}:${encodeURIComponent(centerId)}:${encodeURIComponent(uid)}`
          : this.EXPORT_PREFERENCES_KEY;
      },

      preferenciasExportacionPredeterminadas() {
        return {
          incluirResumen: true,
          filtroTurno: 'todos',
          filtroEstudiantes: 'todos',
          modoNotas: 'real',
          umbral: 60,
          exportMode: 'full',
          formato: 'xlsx',
          // Copias, no el array vivo: si el centro añade un módulo después,
          // estas preferencias no cambian de significado en silencio.
          modulos: MODULOS_TRANSVERSALES.slice(),
          catalogoModulos: MODULOS_TRANSVERSALES.slice(),
          jefeImpresion: '',
          grupoId: '',
          moduloId: 'ALL'
        };
      },

      cargarPreferenciasExportacion() {
        try {
          const key = this.clavePreferenciasExportacion();
          let guardadas = localStorage.getItem(key);
          if (!guardadas && key !== this.EXPORT_PREFERENCES_KEY) {
            guardadas = localStorage.getItem(this.EXPORT_PREFERENCES_KEY);
            if (guardadas) {
              localStorage.setItem(key, guardadas);
              localStorage.removeItem(this.EXPORT_PREFERENCES_KEY);
            }
          }
          if (!guardadas) return this.preferenciasExportacionPredeterminadas();
          return {
            ...this.preferenciasExportacionPredeterminadas(),
            ...JSON.parse(guardadas)
          };
        } catch (error) {
          console.error('No se pudieron leer las preferencias de exportación:', error);
          return this.preferenciasExportacionPredeterminadas();
        }
      },

      guardarPreferenciasExportacion() {
        const preferencias = this.preferenciasExportacionPredeterminadas();
        preferencias.incluirResumen = document.getElementById('chk-incluir-resumen')?.checked ?? preferencias.incluirResumen;
        preferencias.filtroTurno = document.getElementById('select-filtro-turno')?.value || preferencias.filtroTurno;
        preferencias.filtroEstudiantes = document.getElementById('select-filtro-estudiantes')?.value || preferencias.filtroEstudiantes;
        preferencias.modoNotas = document.getElementById('select-modo-notas')?.value || preferencias.modoNotas;
        const umbral = Number(document.getElementById('input-umbral')?.value);
        preferencias.umbral = Number.isFinite(umbral) && umbral >= 0 ? umbral : preferencias.umbral;
        preferencias.exportMode = document.getElementById('select-export-mode')?.value || preferencias.exportMode;
        const formato = document.getElementById('select-formato-cuaderno')?.value;
        if (formato) preferencias.formato = ['pdf', 'avances'].includes(formato) ? formato : 'xlsx';
        preferencias.modulos = [...document.querySelectorAll('.chk-modulo-export:checked')].map(check => check.value);
        // Catálogo vigente al guardar: al restaurar permite distinguir
        // "lo desmarqué yo" de "ese módulo es nuevo y aún no lo he visto".
        preferencias.catalogoModulos = [...MODULOS_TRANSVERSALES];
        preferencias.grupoId = document.getElementById('select-grupo-cuaderno')?.value || '';
        preferencias.moduloId = document.getElementById('select-modulo-cuaderno')?.value || 'ALL';
        const selectorJefe = document.getElementById('select-jefe-cuadernos-impresion');
        const indiceJefe = Number(selectorJefe?.value);
        const jefes = this.obtenerJefesDepartamento();
        preferencias.jefeImpresion = selectorJefe?.value && jefes[indiceJefe]
          ? jefes[indiceJefe].nombre
          : '';
        try {
          localStorage.setItem(this.clavePreferenciasExportacion(), JSON.stringify(preferencias));
        } catch (error) {
          console.error('No se pudieron guardar las preferencias de exportación:', error);
          UI.showToast('❌ No se pudieron guardar las preferencias de exportación en este navegador.');
        }
      },

      restaurarPreferenciasExportacion() {
        const preferencias = this.cargarPreferenciasExportacion();
        const restaurarSelect = (id, valor) => {
          const selector = document.getElementById(id);
          if (selector && [...selector.options].some(option => option.value === valor)) selector.value = valor;
        };
        const resumen = document.getElementById('chk-incluir-resumen');
        if (resumen) resumen.checked = preferencias.incluirResumen;
        restaurarSelect('select-filtro-turno', preferencias.filtroTurno);
        restaurarSelect('select-filtro-estudiantes', preferencias.filtroEstudiantes);
        restaurarSelect('select-modo-notas', preferencias.modoNotas);
        restaurarSelect('select-export-mode', preferencias.exportMode);
        restaurarSelect('select-formato-cuaderno', preferencias.formato);
        restaurarSelect('select-grupo-cuaderno', preferencias.grupoId);
        restaurarSelect('select-modulo-cuaderno', preferencias.moduloId);
        const umbral = document.getElementById('input-umbral');
        if (umbral) {
          const valorUmbral = Number(preferencias.umbral);
          umbral.value = String(Number.isFinite(valorUmbral) ? Math.min(100, Math.max(0, valorUmbral)) : 60);
        }
        const modo = document.getElementById('select-modo-notas');
        const grupoUmbral = document.getElementById('grupo-umbral');
        if (modo && grupoUmbral) grupoUmbral.style.display = modo.value === 'estado' ? 'block' : 'none';

        const modulosGuardados = this.modulosExportSeleccionados(preferencias);
        document.querySelectorAll('.chk-modulo-export').forEach(check => {
          check.checked = modulosGuardados.has(check.value);
        });

        const selectorJefe = document.getElementById('select-jefe-cuadernos-impresion');
        if (selectorJefe && preferencias.jefeImpresion) {
          const indiceJefe = this.obtenerJefesDepartamento().findIndex(jefe => jefe.nombre === preferencias.jefeImpresion);
          if (indiceJefe >= 0) selectorJefe.value = String(indiceJefe);
        }

        [
          'chk-incluir-resumen', 'select-filtro-turno', 'select-filtro-estudiantes',
          'select-modo-notas', 'input-umbral', 'select-export-mode',
          'select-formato-cuaderno', 'select-grupo-cuaderno', 'select-modulo-cuaderno',
          'select-jefe-cuadernos-impresion'
        ].forEach(id => {
          const control = document.getElementById(id);
          if (control) {
            control.addEventListener('change', () => this.guardarPreferenciasExportacion());
          }
        });
        document.querySelectorAll('.chk-modulo-export').forEach(check => {
          check.addEventListener('change', () => this.guardarPreferenciasExportacion());
        });

        if (document.getElementById('select-grupo-cuaderno')?.value && typeof UI.actualizarTablaCuaderno === 'function') {
          UI.actualizarTablaCuaderno();
        }
      },

      /* Qué módulos quedan marcados para exportar. Si el catálogo creció desde
         la última vez que se guardó, los módulos nuevos entran marcados por
         defecto; los que el docente desmarcó siguen desmarcados. */
      modulosExportSeleccionados(preferencias) {
        const actuales = MODULOS_TRANSVERSALES.slice();
        if (!preferencias || !Array.isArray(preferencias.modulos)) return new Set(actuales);
        const seleccion = new Set(preferencias.modulos);
        const catalogoPrevio = Array.isArray(preferencias.catalogoModulos)
          ? preferencias.catalogoModulos
          : null;
        if (catalogoPrevio) {
          const previo = new Set(catalogoPrevio);
          actuales.forEach(nombre => {
            if (!previo.has(nombre) && !seleccion.has(nombre)) seleccion.add(nombre);
          });
        }
        return seleccion;
      },

      /* ── Alta y baja de módulos académicos ─────────────────────
         Un docente puede crear "Inglés" u otro módulo inventado para su
         centro sin tocar código: la lista se guarda en la base compartida
         y se propaga sola a Cuaderno, Estadísticas, Exámenes e Informe. */
      async agregarModuloAcademico() {
        // El catálogo de módulos es del centro entero (se sincroniza a todos
        // los equipos), así que lo amplía únicamente un administrador.
        if (typeof Permisos !== 'undefined' && !Permisos.exigir('configurarMateria')) return false;
        const nombre = window.prompt('Nombre del nuevo módulo académico (ej. Inglés):');
        if (nombre === null) return false;
        const db = typeof DataEngine !== 'undefined' ? DataEngine.db : null;
        const resultado = ModulosAcademicos.agregar(db, nombre);
        if (resultado.error) { UI.showToast(`⚠️ ${resultado.error}`); return false; }

        let guardado = true;
        try {
          await DataEngine.save();
          UI.showToast(`✅ Módulo "${resultado.nombre}" agregado: ya aparece en el Cuaderno, Estadísticas, Exámenes e Informe.`);
        } catch (error) {
          guardado = false;
          ModulosAcademicos.restaurar(db, resultado.anterior);
          UI.showToast(`❌ No se pudo guardar el módulo: ${error.message}`);
        }
        UI.renderCurrentModule();
        return guardado;
      },

      async quitarModuloAcademico() {
        if (typeof Permisos !== 'undefined' && !Permisos.exigir('configurarMateria')) return false;
        const seleccionado = document.getElementById('select-modulo-cuaderno')?.value;
        if (!seleccionado || seleccionado === 'ALL') {
          UI.showToast('⚠️ Selecciona primero el módulo que quieres quitar (paso 1).');
          return false;
        }
        const aviso = ModulosAcademicos.tieneNotas(seleccionado)
          ? `El módulo "${seleccionado}" tiene notas o convalidaciones registradas. Quitarlo oculta la columna, pero NO borra esos datos. ¿Continuar?`
          : `¿Quitar el módulo "${seleccionado}" de la lista del centro?`;
        if (!window.confirm(aviso)) return false;

        const db = typeof DataEngine !== 'undefined' ? DataEngine.db : null;
        const resultado = ModulosAcademicos.quitar(db, seleccionado);
        if (resultado.error) { UI.showToast(`⚠️ ${resultado.error}`); return false; }

        let guardado = true;
        try {
          await DataEngine.save();
          UI.showToast(`✅ Módulo "${seleccionado}" quitado de la lista del centro.`);
        } catch (error) {
          guardado = false;
          ModulosAcademicos.restaurar(db, resultado.anterior);
          UI.showToast(`❌ No se pudo guardar el cambio: ${error.message}`);
        }
        UI.renderCurrentModule();
        return guardado;
      },

      normalizarTexto(texto) {
        return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      },

      obtenerConfiguracionAcademica() {
        const config = DataEngine.db?.cuadernoConfig;
        return config && typeof config === 'object' ? config : {};
      },

      obtenerJefesDepartamento() {
        const config = this.obtenerConfiguracionAcademica();
        const jefes = Array.isArray(config.jefesDepartamento)
          ? config.jefesDepartamento
          : (Array.isArray(config.departamentos) ? config.departamentos : []);
        return jefes.map(jefe => ({
          nombre: String(jefe.jefe || jefe.nombre || '').trim(),
          turnos: Array.isArray(jefe.turnos) ? jefe.turnos : []
        })).filter(jefe => jefe.nombre && jefe.turnos.length);
      },

      obtenerNombreCoordinador() {
        const config = this.obtenerConfiguracionAcademica();
        return config.coordinadorAcademico === undefined ? 'Lennin Estrada' : config.coordinadorAcademico;
      },

      // TIC responsable del grupo: el nombre que firma el cuaderno docente
      // en lugar de un valor fijo. Se elige en Grupos de Clase entre los
      // docentes del sistema; si el grupo aún no tiene uno, se conserva el
      // nombre histórico para no romper los documentos ya acostumbrados.
      obtenerNombreTIC(grupo) {
        const nombre = String(grupo && grupo.ticResponsable ? grupo.ticResponsable : '').trim();
        return nombre || 'Hanzell Ren\u00e9 Mayorga Calero';
      },

      obtenerJefeDepartamento(grupo) {
        const turno = this.normalizarTexto(grupo?.turno || '');
        const responsablesConfigurados = this.obtenerJefesDepartamento();
        const coincideTurno = responsable => responsable.turnos.some(turnoAsignado =>
          turno.includes(this.normalizarTexto(turnoAsignado))
        );
        const responsable = responsablesConfigurados.find(coincideTurno);
        if (responsable) return responsable.nombre;
        if (responsablesConfigurados.length > 0) return '';
        return turno.includes('matutino') || turno.includes('vespertino')
          ? 'Jonatham Salinas'
          : 'Miguel Sanchez';
      },

      poblarSelectorJefesImpresion() {
        const selectorJefe = document.getElementById('select-jefe-cuadernos-impresion');
        if (!selectorJefe) return;
        const jefes = this.obtenerJefesDepartamento();
        selectorJefe.innerHTML = '<option value="">Seleccionar jefe</option>' +
          jefes.map((jefe, indice) =>
            `<option value="${indice}">${this.escaparHTML(jefe.nombre)} — ${this.escaparHTML(jefe.turnos.join(', '))}</option>`
          ).join('');
        const nombreGuardado = this.cargarPreferenciasExportacion().jefeImpresion;
        const indiceGuardado = jefes.findIndex(jefe => jefe.nombre === nombreGuardado);
        if (indiceGuardado >= 0) selectorJefe.value = String(indiceGuardado);
      },

      escaparHTML(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[caracter]);
      },

      abrirConfiguracionAcademica() {
        // Responsables institucionales (coordinador y jefes de departamento):
        // los fija el administrador, no cada docente. Esta es la única puerta
        // de entrada al modal, así que basta la comprobación aquí.
        if (typeof Permisos !== 'undefined' && !Permisos.exigir('configurarInstitucion')) return;
        const config = this.obtenerConfiguracionAcademica();
        const coordinador = document.getElementById('cfg-coordinador-academico');
        if (coordinador) coordinador.value = this.obtenerNombreCoordinador();

        const lista = document.getElementById('cfg-jefes-departamento-lista');
        if (lista) {
          lista.replaceChildren();
          const responsables = Array.isArray(config.jefesDepartamento)
            ? config.jefesDepartamento
            : (Array.isArray(config.departamentos) ? config.departamentos : []);
          responsables.forEach(responsable => {
            this.agregarJefeDepartamentoConfig(responsable);
          });
        }
        const error = document.getElementById('cfg-academica-error');
        if (error) error.hidden = true;
        const modal = document.getElementById('modal-config-academica');
        if (modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; }
      },

      agregarJefeDepartamentoConfig(datos = {}) {
        const lista = document.getElementById('cfg-jefes-departamento-lista');
        if (!lista) return;
        const fila = document.createElement('section');
        fila.className = 'academic-department-row';
        fila.style.cssText = 'display:grid; grid-template-columns:minmax(180px, 1fr) auto; gap:10px; align-items:start; border:1px solid var(--border-default); border-radius:10px; padding:12px;';
        const jefeCampo = document.createElement('label');
        jefeCampo.style.cssText = 'display:grid; gap:4px; font-size:0.78rem;';
        jefeCampo.appendChild(document.createTextNode('Nombre del jefe de departamento'));
        const jefe = document.createElement('input');
        jefe.type = 'text';
        jefe.className = 'form-control academic-department-head';
        jefe.placeholder = 'Nombre del jefe';
        jefe.maxLength = 120;
        jefe.value = datos.jefe || '';
        jefe.setAttribute('aria-label', 'Nombre del jefe de departamento');
        jefeCampo.appendChild(jefe);

        const turnos = document.createElement('div');
        turnos.style.cssText = 'display:flex; flex-wrap:wrap; gap:10px; grid-column:1 / -1;';
        const asignados = new Set(datos.turnos || []);
        ['Matutino', 'Vespertino', 'Nocturno', 'Sabatino', 'Dominical'].forEach(nombreTurno => {
          const etiqueta = document.createElement('label');
          etiqueta.style.cssText = 'display:inline-flex; align-items:center; gap:4px; font-size:0.82rem;';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = nombreTurno;
          checkbox.checked = asignados.has(nombreTurno);
          etiqueta.append(checkbox, document.createTextNode(nombreTurno));
          turnos.appendChild(etiqueta);
        });
        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn-icon';
        eliminar.title = 'Quitar jefe';
        eliminar.setAttribute('aria-label', 'Quitar jefe');
        eliminar.innerHTML = '<i class="ri-delete-bin-line" aria-hidden="true"></i>';
        eliminar.addEventListener('click', () => fila.remove());
        fila.append(jefeCampo, eliminar, turnos);
        lista.appendChild(fila);
      },

      cerrarConfiguracionAcademica() {
        const modal = document.getElementById('modal-config-academica');
        if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
      },

      async guardarConfiguracionAcademica(event) {
        event.preventDefault();
        // Defensa en profundidad: aunque el modal estuviera abierto, el
        // guardado también comprueba el rol.
        if (typeof Permisos !== 'undefined' && !Permisos.exigir('configurarInstitucion')) return false;
        const error = document.getElementById('cfg-academica-error');
        const mostrarError = mensaje => {
          if (error) { error.textContent = mensaje; error.hidden = false; }
        };
        const jefesDepartamento = [...document.querySelectorAll('.academic-department-row')].map(fila => ({
          jefe: fila.querySelector('.academic-department-head')?.value.trim() || '',
          turnos: [...fila.querySelectorAll('input[type="checkbox"]:checked')].map(check => check.value)
        }));
        if (jefesDepartamento.some(jefe => !jefe.jefe || jefe.turnos.length === 0)) {
          mostrarError('Completa el nombre del jefe y selecciona al menos un turno para cada fila.');
          return;
        }
        const turnosAsignados = jefesDepartamento.flatMap(jefe => jefe.turnos);
        if (new Set(turnosAsignados).size !== turnosAsignados.length) {
          mostrarError('Cada turno solo puede asignarse a un jefe. Quita los turnos repetidos.');
          return;
        }

        const anterior = DataEngine.db.cuadernoConfig;
        DataEngine.db.cuadernoConfig = {
          coordinadorAcademico: document.getElementById('cfg-coordinador-academico')?.value.trim() || '',
          jefesDepartamento
        };
        try {
          await DataEngine.save();
          this.poblarSelectorJefesImpresion();
          this.cerrarConfiguracionAcademica();
          UI.showToast('✅ Responsables académicos guardados para el centro.');
        } catch (saveError) {
          if (anterior === undefined) delete DataEngine.db.cuadernoConfig;
          else DataEngine.db.cuadernoConfig = anterior;
          console.error('No se pudieron guardar los responsables académicos:', saveError);
          mostrarError(`No se pudo guardar la configuración: ${saveError.message || 'error de conexión.'}`);
        }
      },

      // [NUEVO] Inicializa los checkboxes de módulos al cargar la vista
      inicializarSelectoresExportacion() {
        this.poblarSelectorJefesImpresion();

        const contenedor = document.getElementById('contenedor-checkboxes-modulos');
        if (!contenedor) return;
        contenedor.innerHTML = '';
        MODULOS_TRANSVERSALES.forEach((mod, i) => {
          const label = document.createElement('label');
          label.style.cssText = 'cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 5px;';
          label.innerHTML = `<input type="checkbox" class="chk-modulo-export" value="${mod}" checked style="margin:0;"> <span>${mod}</span>`;
          contenedor.appendChild(label);
        });

        // [NUEVO] Poblar el filtro de turno con los turnos REALES presentes en los grupos
        // (evita desajustes de texto contra el Excel importado: "Matutino", "Turno Matutino", etc.)
        const selectTurno = document.getElementById('select-filtro-turno');
        if (selectTurno && typeof DataEngine !== 'undefined') {
          const turnos = [...new Set(
            DataEngine.getGrupos().map(g => (g.turno || '').trim()).filter(Boolean)
          )].sort((a, b) => a.localeCompare(b));
          selectTurno.innerHTML = '<option value="todos">Todos los turnos</option>' +
            turnos.map(t => `<option value="${t.replace(/"/g, '&quot;')}">${t}</option>`).join('');
        }

        // Mostrar/ocultar el campo de umbral según el modo seleccionado
        const selectModo = document.getElementById('select-modo-notas');
        const grupoUmbral = document.getElementById('grupo-umbral');
        if (selectModo && grupoUmbral) {
          selectModo.onchange = (e) => {
            grupoUmbral.style.display = e.target.value === 'estado' ? 'block' : 'none';
          };
        }
        this.restaurarPreferenciasExportacion();
      },

      // [NUEVO] Obtiene los módulos seleccionados por el usuario
      obtenerModulosSeleccionados() {
        const checkboxes = document.querySelectorAll('.chk-modulo-export:checked');
        return Array.from(checkboxes).map(cb => cb.value);
      },

      // [NUEVO] Determina si se debe incluir el resumen general
      incluirResumenGeneral() {
        const chk = document.getElementById('chk-incluir-resumen');
        return chk ? chk.checked : true;
      },

      // [NUEVO] Obtiene el modo de notas y el umbral configurado
      obtenerConfigNotas() {
        const selectModo = document.getElementById('select-modo-notas');
        const inputUmbral = document.getElementById('input-umbral');
        return {
          modo: selectModo ? selectModo.value : 'real', // 'real' | 'estado'
          umbral: inputUmbral ? parseInt(inputUmbral.value) || 60 : 60
        };
      },

      // [NUEVO] Formatea una nota según el modo seleccionado
      formatearNota(valor, configNotas) {
        // Estados especiales siempre se respetan
        if (valor === 'Retirado' || valor === 'Convalidado') {
          return { texto: valor, esNumero: false, esEstado: true };
        }
        if (valor === 'S/N' || valor === null || valor === undefined || valor === '-') {
          return { texto: configNotas.modo === 'estado' ? 'Pendiente' : 'S/N', esNumero: false, esEstado: configNotas.modo === 'estado' };
        }
        
        const num = Number(valor);
        if (isNaN(num)) {
          return { texto: String(valor), esNumero: false, esEstado: false };
        }

        if (configNotas.modo === 'estado') {
          return {
            texto: num >= configNotas.umbral ? 'Aprobado' : 'Pendiente',
            esNumero: false,
            esEstado: true
          };
        }

        return { texto: Math.round(num), esNumero: true, esEstado: false };
      },

      async importarNotasExcel(event) {
        const file = event.target.files[0];
        const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
        const moduloSeleccionado = document.getElementById('select-modulo-cuaderno')?.value;

        if (!grupoId) { UI.showToast("⚠️ Debe seleccionar un grupo antes de cargar las notas."); return; }
        if (!moduloSeleccionado || moduloSeleccionado === 'ALL') { UI.showToast("⚠️ Seleccione el módulo específico al que corresponde este archivo Excel."); return; }
        if (!file) return;

        const grupo = DataEngine.getGrupoById(grupoId);
        if (!grupo) return;
        // [UI] Pantalla de carga desde que se elige el archivo: el docente
        // ve que algo ocurre mientras se lee el Excel y mientras se sube.
        UI.showLoading(`Leyendo el archivo de ${moduloSeleccionado}…`, 'subida');
        const previousGroupValues = DataEngine._clone(grupo);
        if (!grupo.estructuraModulos) grupo.estructuraModulos = {};
        // Columnas que el módulo ya tenía en este grupo: así también se
        // reconoce el Excel que salió del sistema con esos mismos nombres.
        const columnasConocidas = new Set(
          (grupo.estructuraModulos[moduloSeleccionado]?.columnasOrdenadas || [])
            .map(c => CuadernoEngine.normalizarTexto(c.nombreDisplay))
        );
        grupo.estructuraModulos[moduloSeleccionado] = { columnasOrdenadas: [] };
        const configModulo = grupo.estructuraModulos[moduloSeleccionado];

        const reader = new FileReader();
        reader.onload = async (e) => {
          const previousGroups = new Map();
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let estudiantesActualizados = 0;
            const estudiantesGrupo = DataEngine.getEstudiantesByGrupo(grupoId);

            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
              if (rawRows.length < 2) return;
              const headers = rawRows[0].map(h => String(h).trim());

              const limitesModulos = [];
              headers.forEach((header, colIndex) => {
                const hNorm = CuadernoEngine.normalizarTexto(header);
                if (hNorm.includes("total modulo") || hNorm.includes("total del curso")) limitesModulos.push(colIndex);
              });

              const indiceModulo = MODULOS_TRANSVERSALES.indexOf(moduloSeleccionado);
              let colInicio = 0, colFin = headers.length - 1;
              if (limitesModulos.length > 1 && indiceModulo !== -1) {
                colInicio = indiceModulo === 0 ? 0 : (limitesModulos[indiceModulo - 1] + 1);
                colFin = limitesModulos[indiceModulo] !== undefined ? limitesModulos[indiceModulo] : (headers.length - 1);
              }

              const columnasDelModulo = [];
              for (let i = colInicio; i <= colFin; i++) {
                const headerOriginal = headers[i];
                const hNorm = CuadernoEngine.normalizarTexto(headerOriginal);
                if (hNorm.startsWith("cuestionario") || hNorm.includes("total") || columnasConocidas.has(hNorm)) {
                  let nombreLimpio = headerOriginal.replace(/^Cuestionario:\s*\d*\/?\d*\)?\s*/i, '').replace(/\(Real\)$/i, '').trim();
                  if (!nombreLimpio) nombreLimpio = headerOriginal.trim(); // si al limpiar quedó vacío, se usa tal cual
                  const esTotal = hNorm.includes("total");
                  columnasDelModulo.push({ index: i, nombreDisplay: nombreLimpio, esTotal: esTotal });
                  if (!configModulo.columnasOrdenadas.some(col => col.nombreDisplay === nombreLimpio)) {
                    configModulo.columnasOrdenadas.push({ nombreDisplay: nombreLimpio, esTotal: esTotal });
                  }
                }
              }

              for (let r = 1; r < rawRows.length; r++) {
                const row = rawRows[r];
                const rowText = CuadernoEngine.normalizarTexto(row.join(' '));
                const estudiante = estudiantesGrupo.find(e => {
                  const nombreFull = CuadernoEngine.normalizarTexto(`${e.nombres} ${e.apellidos}`);
                  const apellidoFull = CuadernoEngine.normalizarTexto(`${e.apellidos} ${e.nombres}`);
                  const mailMatch = e.correo && e.correo.trim() !== "" && rowText.includes(CuadernoEngine.normalizarTexto(e.correo));
                  return mailMatch || rowText.includes(nombreFull) || rowText.includes(apellidoFull);
                });

                if (estudiante) {
                  if (!estudiante.evaluacionesPorModulo) estudiante.evaluacionesPorModulo = {};
                  if (!estudiante.evaluacionesPorModulo[moduloSeleccionado]) estudiante.evaluacionesPorModulo[moduloSeleccionado] = { notas: {} };
                  const modObj = estudiante.evaluacionesPorModulo[moduloSeleccionado];
                  if (!modObj.notas) modObj.notas = {};
                  columnasDelModulo.forEach(col => {
                    const valorRaw = row[col.index];
                    const valorNum = (valorRaw !== "" && valorRaw !== null && !isNaN(Number(valorRaw))) ? Math.round(Number(valorRaw)) : null;
                    if (valorNum !== null) modObj.notas[col.nombreDisplay] = valorNum;
                  });
                  estudiantesActualizados++;
                }
              }
            });

            UI.actualizarCarga('Guardando las calificaciones en la base compartida…', 'subida');
            await DataEngine.save();
            UI.hideLoading(700);
            UI.showToast(`✅ ${moduloSeleccionado} importado correctamente (${estudiantesActualizados} alumnos).`);
            if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
          } catch (err) {
            UI.hideLoading(300);
            if (DataEngine.getGrupoById(grupoId) === grupo) {
              Object.keys(grupo).forEach(key => delete grupo[key]);
              Object.assign(grupo, previousGroupValues);
            }
            console.error("Error al importar calificaciones:", err);
            UI.showToast(`No se guardaron las calificaciones del archivo Excel: ${err.message}`, 'error');
          }
        };
        reader.onerror = error => {
          UI.hideLoading(300);
          if (DataEngine.getGrupoById(grupoId) === grupo) {
            Object.keys(grupo).forEach(key => delete grupo[key]);
            Object.assign(grupo, previousGroupValues);
          }
          console.error('No se pudo leer el archivo de calificaciones:', error);
          UI.showToast('No se pudo leer el archivo de calificaciones.', 'error');
        };
        reader.readAsArrayBuffer(file);
        event.target.value = "";
      },

      // ═══════════════════════════════════════════════════════════════
      // [NUEVO] IMPORTACIÓN MASIVA DE UN MÓDULO PARA TODOS LOS GRUPOS
      // En vez de subir el Excel de un módulo grupo por grupo, esta función
      // recorre TODOS los grupos registrados y busca a cada estudiante del
      // archivo (por nombre o correo) en cualquiera de ellos, sin importar
      // el grupo seleccionado en el combo. Útil cuando el listado de notas
      // de un módulo llega consolidado con estudiantes de varios grupos.
      // ═══════════════════════════════════════════════════════════════
      async importarNotasModuloTodosGrupos(event) {
        const file = event.target.files[0];
        const moduloSeleccionado = document.getElementById('select-modulo-masivo')?.value;

        if (!moduloSeleccionado || moduloSeleccionado === 'ALL') { UI.showToast("⚠️ Seleccione el módulo específico al que corresponde este archivo Excel."); return; }
        if (!file) return;

        const grupos = DataEngine.getGrupos();
        if (!grupos.length) { UI.showToast("⚠️ No hay grupos registrados todavía."); return; }

        // [UI] Mismo aviso de carga que en la importación de un solo grupo.
        UI.showLoading(`Leyendo el archivo de ${moduloSeleccionado}…`, 'subida');

        // Índice de búsqueda: cada estudiante junto con el grupo al que pertenece
        const indice = [];
        grupos.forEach(g => {
          (g.estudiantes || []).forEach(est => indice.push({ est, grupo: g }));
        });

        // Copia de seguridad por grupo: si algo falla a mitad del archivo,
        // se devuelve cada grupo a como estaba antes de tocarlo.
        const previousGroups = new Map();

        // Columnas que estos grupos ya usan en el módulo seleccionado, para
        // reconocer el Excel exportado del sistema con esos mismos nombres.
        const columnasConocidas = new Set();
        grupos.forEach(g => {
          (g.estructuraModulos?.[moduloSeleccionado]?.columnasOrdenadas || [])
            .forEach(c => columnasConocidas.add(CuadernoEngine.normalizarTexto(c.nombreDisplay)));
        });

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let estudiantesActualizados = 0;
            let filasSinCoincidencia = 0;
            const gruposTocados = new Set();

            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
              if (rawRows.length < 2) return;
              const headers = rawRows[0].map(h => String(h).trim());

              const limitesModulos = [];
              headers.forEach((header, colIndex) => {
                const hNorm = CuadernoEngine.normalizarTexto(header);
                if (hNorm.includes("total modulo") || hNorm.includes("total del curso")) limitesModulos.push(colIndex);
              });

              const indiceModulo = MODULOS_TRANSVERSALES.indexOf(moduloSeleccionado);
              let colInicio = 0, colFin = headers.length - 1;
              if (limitesModulos.length > 1 && indiceModulo !== -1) {
                colInicio = indiceModulo === 0 ? 0 : (limitesModulos[indiceModulo - 1] + 1);
                colFin = limitesModulos[indiceModulo] !== undefined ? limitesModulos[indiceModulo] : (headers.length - 1);
              }

              const columnasDelModulo = [];
              for (let i = colInicio; i <= colFin; i++) {
                const headerOriginal = headers[i];
                const hNorm = CuadernoEngine.normalizarTexto(headerOriginal);
                if (hNorm.startsWith("cuestionario") || hNorm.includes("total") || columnasConocidas.has(hNorm)) {
                  let nombreLimpio = headerOriginal.replace(/^Cuestionario:\s*\d*\/?\d*\)?\s*/i, '').replace(/\(Real\)$/i, '').trim();
                  if (!nombreLimpio) nombreLimpio = headerOriginal.trim(); // si al limpiar quedó vacío, se usa tal cual
                  const esTotal = hNorm.includes("total");
                  columnasDelModulo.push({ index: i, nombreDisplay: nombreLimpio, esTotal: esTotal });
                }
              }

              for (let r = 1; r < rawRows.length; r++) {
                const row = rawRows[r];
                const rowText = CuadernoEngine.normalizarTexto(row.join(' '));
                if (!rowText.trim()) continue;

                const encontrado = indice.find(({ est }) => {
                  const nombreFull = CuadernoEngine.normalizarTexto(`${est.nombres} ${est.apellidos}`);
                  const apellidoFull = CuadernoEngine.normalizarTexto(`${est.apellidos} ${est.nombres}`);
                  const mailMatch = est.correo && est.correo.trim() !== "" && rowText.includes(CuadernoEngine.normalizarTexto(est.correo));
                  return mailMatch || rowText.includes(nombreFull) || rowText.includes(apellidoFull);
                });

                if (encontrado) {
                  const { est: estudiante, grupo } = encontrado;
                  if (!previousGroups.has(grupo.id)) {
                    previousGroups.set(grupo.id, {
                      group: grupo,
                      value: DataEngine._clone(grupo)
                    });
                  }
                  if (!grupo.estructuraModulos) grupo.estructuraModulos = {};
                  if (!grupo.estructuraModulos[moduloSeleccionado]) grupo.estructuraModulos[moduloSeleccionado] = { columnasOrdenadas: [] };
                  const configModulo = grupo.estructuraModulos[moduloSeleccionado];
                  columnasDelModulo.forEach(col => {
                    if (!configModulo.columnasOrdenadas.some(c => c.nombreDisplay === col.nombreDisplay)) {
                      configModulo.columnasOrdenadas.push({ nombreDisplay: col.nombreDisplay, esTotal: col.esTotal });
                    }
                  });

                  if (!estudiante.evaluacionesPorModulo) estudiante.evaluacionesPorModulo = {};
                  if (!estudiante.evaluacionesPorModulo[moduloSeleccionado]) estudiante.evaluacionesPorModulo[moduloSeleccionado] = { notas: {} };
                  const modObj = estudiante.evaluacionesPorModulo[moduloSeleccionado];
                  if (!modObj.notas) modObj.notas = {};
                  columnasDelModulo.forEach(col => {
                    const valorRaw = row[col.index];
                    const valorNum = (valorRaw !== "" && valorRaw !== null && !isNaN(Number(valorRaw))) ? Math.round(Number(valorRaw)) : null;
                    if (valorNum !== null) modObj.notas[col.nombreDisplay] = valorNum;
                  });
                  estudiantesActualizados++;
                  gruposTocados.add(grupo.nombre || grupo.id);
                } else {
                  filasSinCoincidencia++;
                }
              }
            });

            UI.actualizarCarga('Guardando las calificaciones en la base compartida…', 'subida');
            await DataEngine.save();
            UI.hideLoading(700);
            const resumenGrupos = gruposTocados.size > 0 ? ` en ${gruposTocados.size} grupo(s)` : '';
            UI.showToast(`✅ ${moduloSeleccionado}: ${estudiantesActualizados} alumno(s) actualizados${resumenGrupos}.${filasSinCoincidencia > 0 ? ` (${filasSinCoincidencia} fila(s) sin coincidencia)` : ''}`);
            if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
          } catch (err) {
            UI.hideLoading(300);
            previousGroups.forEach(({ group, value }, groupId) => {
              if (DataEngine.getGrupoById(groupId) !== group) return;
              Object.keys(group).forEach(key => delete group[key]);
              Object.assign(group, value);
            });
            console.error("Error al importar calificaciones masivas:", err);
            UI.showToast(`No se guardaron las calificaciones del archivo Excel: ${err.message}`, 'error');
          }
        };
        reader.onerror = () => {
          UI.hideLoading(300);
          UI.showToast('No se pudo leer el archivo de calificaciones.', 'error');
        };
        reader.readAsArrayBuffer(file);
        event.target.value = "";
      },

      // [NUEVO] Filtros de exportación: turno y estado del estudiante
      obtenerFiltroTurno() {
        const sel = document.getElementById('select-filtro-turno');
        return sel ? sel.value : 'todos';
      },

      obtenerFiltroEstudiantes() {
        const sel = document.getElementById('select-filtro-estudiantes');
        return sel ? sel.value : 'todos';
      },

      // Un estudiante "debe actividad" si en alguno de los módulos indicados le falta la nota
      // de al menos UNA columna de actividad (se ignoran las columnas "Total")
      tieneActividadPendiente(estudiante, modulos, grupo) {
        const lista = (modulos && modulos.length) ? modulos : MODULOS_TRANSVERSALES;
        return lista.some(m => {
          // Un módulo convalidado equivale a módulo aprobado/completado: no
          // debe generar pendientes aunque no tenga evaluaciones ni notas.
          const convalidaciones = estudiante.convalidaciones || {};
          const moduloConvalidado = Object.entries(convalidaciones).some(([nombre, valor]) =>
            Boolean(valor) && this.normalizarTexto(nombre) === this.normalizarTexto(m)
          );
          if (moduloConvalidado) return false;

          const modData = estudiante.evaluacionesPorModulo && estudiante.evaluacionesPorModulo[m];
          const notas = (modData && modData.notas) ? modData.notas : {};

          const configMod = grupo && grupo.estructuraModulos ? grupo.estructuraModulos[m] : null;
          const columnas = (configMod?.columnasOrdenadas || []).filter(c => !c.esTotal);

          // Si no conocemos la estructura de columnas del módulo, caemos al chequeo simple (módulo vacío)
          if (columnas.length === 0) return Object.keys(notas).length === 0;

          return columnas.some(col => {
            if (notas[col.nombreDisplay] !== undefined) return false;
            const colNorm = this.normalizarTexto(col.nombreDisplay);
            return !Object.keys(notas).some(k => this.normalizarTexto(k) === colNorm);
          });
        });
      },

      filtrarEstudiantes(estudiantes, filtro, modulos, grupo) {
        if (!filtro || filtro === 'todos') return estudiantes;
        const esRet = (e) => e.retirado || e.estado === 'Retirado';
        switch (filtro) {
          case 'activos':    return estudiantes.filter(e => !esRet(e));
          case 'retirados':  return estudiantes.filter(e => esRet(e));
          case 'pendientes': return estudiantes.filter(e => !esRet(e) && this.tieneActividadPendiente(e, modulos, grupo));
          case 'completos':  return estudiantes.filter(e => !esRet(e) && !this.tieneActividadPendiente(e, modulos, grupo));
          default: return estudiantes;
        }
      },

      obtenerNotaEstudiante(estudiante, nombreModulo, nombreColumna) {
        if (!estudiante || !estudiante.evaluacionesPorModulo) return '-';
        const modData = estudiante.evaluacionesPorModulo[nombreModulo];
        if (!modData) return '-';
        if (modData.notas) {
          if (modData.notas[nombreColumna] !== undefined) return modData.notas[nombreColumna];
          const colNorm = CuadernoEngine.normalizarTexto(nombreColumna);
          for (const [key, val] of Object.entries(modData.notas)) {
            if (CuadernoEngine.normalizarTexto(key) === colNorm) return val;
          }
        }
        if (modData.evaluaciones && modData.evaluaciones[nombreColumna] !== undefined) return modData.evaluaciones[nombreColumna];
        if (modData.totalesUnidad && modData.totalesUnidad[nombreColumna] !== undefined) return modData.totalesUnidad[nombreColumna];
        return '-';
      },

      // ═══════════════════════════════════════════════════════════════
      // EXCELJS EXPORT — XLSX real con estilos completos
      // Formato oficial DGFP/INATEC (Registro de Calificaciones por Módulo)
      // ═══════════════════════════════════════════════════════════════

      hexToArgb(hex) {
        return 'FF' + hex.replace('#', '').toUpperCase();
      },

      buildWorkbookForGroup(grupoId, modulosAExportar, conResumen, configNotas, filtroEstudiantes = 'todos', listoParaImprimir = false) {
        const cfgGuardada = ConfigExport.load();
        const cfg = listoParaImprimir ? {
          ...cfgGuardada,
          textColor: '#000000',
          fontSize: 9,
          bold: false,
          borderColor: '#000000',
          headerBg: false,
          dataBg: false,
          printOrientation: 'landscape',
          printFitToPage: true,
          printCentered: false,
          printMargin: 'estrecho'
        } : cfgGuardada;
        const grupo = DataEngine.getGrupoById(grupoId);
        if (!grupo) return null;
        let estudiantes = DataEngine.getEstudiantesByGrupo(grupoId);
        if (!estudiantes || estudiantes.length === 0) return null;
        const totalEstudiantesGrupo = estudiantes.length;
        const estudiantesActivos = estudiantes.filter(est =>
          est.estado !== 'Retirado' && !est.retirado
        ).length;
        const estudiantesRetirados = totalEstudiantesGrupo - estudiantesActivos;

        estudiantes = DataEngine.ordenarEstudiantes(estudiantes);

        estudiantes = this.filtrarEstudiantes(estudiantes, filtroEstudiantes, modulosAExportar, grupo);
        if (!estudiantes || estudiantes.length === 0) return null;

        const esRetirado = (e) => e.retirado || e.estado === 'Retirado';
        const jefeDepartamento   = this.obtenerJefeDepartamento(grupo);
        const coordinadorAcademico = this.obtenerNombreCoordinador();
        const nombreCentro = typeof AuthManager.getActiveCenterName === 'function'
          ? AuthManager.getActiveCenterName()
          : 'Centro Tecnológico';
        const fechaActual = new Date().toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' });

        const fmtNota = (valorRaw) => {
          if (valorRaw === 'Retirado' || valorRaw === 'Convalidado') return valorRaw;
          if (valorRaw === 'S/N' || valorRaw === null || valorRaw === undefined || valorRaw === '-') {
            return configNotas.modo === 'estado' ? 'Pendiente' : 'S/N';
          }
          const num = Number(valorRaw);
          if (isNaN(num)) return String(valorRaw);
          if (configNotas.modo === 'estado') return num >= configNotas.umbral ? 'Aprobado' : 'Pendiente';
          return Math.round(num);
        };

        const borderArgb  = cfg.borderColor === '#000000' ? 'FF000000' : 'FFD9D9D9';
        const fontName    = cfg.fontFamily  || 'Calibri';
        const fontSize    = cfg.fontSize    || 10;
        const textColor   = this.hexToArgb(cfg.textColor   || '#000000');
        const headerColor = this.hexToArgb(cfg.headerColor || '#1E40AF');

        const wb = new ExcelJS.Workbook();
        wb.creator = 'TIC Dashboard';
        wb.created = new Date();

        const applyBorder = (cell) => {
          cell.border = {
            top:    { style: 'thin', color: { argb: borderArgb } },
            left:   { style: 'thin', color: { argb: borderArgb } },
            bottom: { style: 'thin', color: { argb: borderArgb } },
            right:  { style: 'thin', color: { argb: borderArgb } }
          };
        };

        const styleCell = (cell, opts = {}) => {
          const font = { name: fontName, size: fontSize, color: { argb: textColor }, ...(opts.font || {}) };
          if (listoParaImprimir) font.color = { argb: 'FF000000' };
          cell.font = font;
          const alignment = opts.alignment || { horizontal: 'center', vertical: 'middle' };
          cell.alignment = listoParaImprimir ? { ...alignment, wrapText: true } : alignment;
          if (opts.fill && !listoParaImprimir) cell.fill = opts.fill;
          if (opts.border !== false) applyBorder(cell);
        };

        const greenFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF86EFAC' } };
        const redFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCA5A5' } };
        const darkFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        const headerFill = cfg.headerBg
          ? { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } }
          : null;

        const getNotaStyle = (valorRaw, estudiante) => {
          const ret = estudiante && esRetirado(estudiante);
          if (valorRaw === 'Convalidado') return { font: { color: { argb: textColor } } };
          if (valorRaw === 'Retirado') return ret
            ? { font: { color: { argb: 'FF94A3B8' } }, fill: darkFill }
            : { font: { color: { argb: textColor } } };
          const texto = String(fmtNota(valorRaw));
          if (texto === 'Aprobado') return ret
            ? { font: { color: { argb: 'FF86EFAC' }, bold: true }, fill: darkFill }
            : { font: { color: { argb: 'FF14532D' }, bold: true }, fill: greenFill };
          if (texto === 'Pendiente') return ret
            ? { font: { color: { argb: 'FFFCA5A5' }, bold: true }, fill: darkFill }
            : { font: { color: { argb: 'FF7F1D1D' }, bold: true }, fill: redFill };
          if (configNotas.modo === 'real') {
            const num = Number(texto);
            if (!isNaN(num)) {
              if (ret) return num >= configNotas.umbral
                ? { font: { color: { argb: 'FF86EFAC' }, bold: true }, fill: darkFill }
                : { font: { color: { argb: 'FFFCA5A5' }, bold: true }, fill: darkFill };
              return num >= configNotas.umbral
                ? { font: { color: { argb: 'FF14532D' }, bold: true }, fill: greenFill }
                : { font: { color: { argb: 'FF7F1D1D' }, bold: true }, fill: redFill };
            }
          }
          if (ret) return { font: { color: { argb: 'FF94A3B8' } }, fill: darkFill };
          return { font: { color: { argb: textColor } } };
        };

        // ─────────────────────────────────────────────────────────────
        // construirHojaOficial — Formato DGFP/INATEC
        // ─────────────────────────────────────────────────────────────
        const construirHojaOficial = (ws, mNombre, columnas, estudiantesHoja) => {
          this.aplicarConfigImpresion(ws, cfg, listoParaImprimir);

          const colsUD    = columnas.filter(c => !c.esTotal);
          const colsTotal = columnas.filter(c =>  c.esTotal);
          const numUDs    = Math.max(colsUD.length, 1);

          // A=Nr, B-E=Nombre (4 cols mergeadas), F..F+n-1=UDs, last=Calif.Final
          const NUM_COLS     = Math.max(12, numUDs + 6);
          const COL_NO       = 1;
          const COL_NOM_S    = 2;
          const COL_NOM_E    = 5;
          const COL_UD_START = 6;
          const COL_UD_END   = COL_UD_START + numUDs - 1;
          const COL_FINAL    = NUM_COLS;

          ws.columns = [
            { width: 5 },
            { width: 10 }, { width: 11 }, { width: 11 }, { width: 11 },
            ...colsUD.map(() => ({ width: 14 })),
            ...Array(Math.max(0, NUM_COLS - COL_UD_END - 1)).fill({ width: 12 }),
            { width: 12 }
          ];

          const FILL_HDR  = headerFill || { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
          const FILL_SEC  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
          const FILL_STAT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };

          const merge = (row, c1, c2) => {
            if (c2 > c1) { try { ws.mergeCells(row, c1, row, c2); } catch(e) {} }
          };
          const boldCell = (cell, val, fill, align, sz) => {
            cell.value = val;
            cell.font  = { name: fontName, size: sz || fontSize, bold: true, color: { argb: 'FF000000' } };
            cell.alignment = align || { horizontal: 'left', vertical: 'middle' };
            if (fill && !listoParaImprimir) cell.fill = fill;
            applyBorder(cell);
          };
          const normCell = (cell, val, align) => {
            cell.value = val;
            cell.font  = { name: fontName, size: fontSize, color: { argb: 'FF000000' } };
            cell.alignment = align || { horizontal: 'left', vertical: 'middle' };
            applyBorder(cell);
          };

          // Fila 1: institución
          const r1 = ws.addRow([]); r1.height = 20;
          merge(r1.number, 1, NUM_COLS);
          ws.getCell(r1.number, 1).value = 'DIRECCI\u00d3N GENERAL DE FORMACI\u00d3N PROFESIONAL';
          ws.getCell(r1.number, 1).font  = { name: fontName, size: 13, bold: true };
          ws.getCell(r1.number, 1).alignment = { horizontal: 'center', vertical: 'middle' };

          // Fila 2: título
          const r2 = ws.addRow([]); r2.height = 17;
          merge(r2.number, 1, NUM_COLS);
          ws.getCell(r2.number, 1).value = 'REGISTRO DE CALIFICACIONES POR M\u00d3DULO FORMATIVO/ASIGNATURA';
          ws.getCell(r2.number, 1).font  = { name: fontName, size: 11, bold: true };
          ws.getCell(r2.number, 1).alignment = { horizontal: 'center', vertical: 'middle' };

          // Fila 3: vacía
          ws.addRow([]); ws.getRow(ws.rowCount).height = 6;

          // Fila 4: I.- Datos Generales
          const r4 = ws.addRow([]); r4.height = 16;
          merge(r4.number, 1, NUM_COLS);
          boldCell(ws.getCell(r4.number, 1), 'I.- Datos Generales', FILL_SEC,
            { horizontal: 'left', vertical: 'middle' });

          // Fila 5: Nombre del Centro
          const r5 = ws.addRow([]); r5.height = 15;
          boldCell(ws.getCell(r5.number, 1), 'Nombre del Centro', null,
            { horizontal: 'left', vertical: 'middle' });
          merge(r5.number, 2, NUM_COLS);
          normCell(ws.getCell(r5.number, 2), nombreCentro);

          // Fila 6: Carrera + Módulo
          const r6 = ws.addRow([]); r6.height = 15;
          const mid6 = Math.ceil(NUM_COLS / 2);
          boldCell(ws.getCell(r6.number, 1), 'Carrera T\u00e9cnica / Curso', null,
            { horizontal: 'left', vertical: 'middle' });
          merge(r6.number, 2, mid6 - 1);
          normCell(ws.getCell(r6.number, 2), grupo.carrera || 'N/A');
          boldCell(ws.getCell(r6.number, mid6), 'M\u00f3dulo Formativo / Asignatura', null,
            { horizontal: 'left', vertical: 'middle' });
          merge(r6.number, mid6 + 1, NUM_COLS);
          normCell(ws.getCell(r6.number, mid6 + 1), mNombre,
            { horizontal: 'left', vertical: 'middle', wrapText: true });

          // Fila 7: Código + Carga + Fechas
          const r7 = ws.addRow([]); r7.height = 15;
          const q7 = Math.floor(NUM_COLS / 4), mid7 = Math.ceil(NUM_COLS / 2);
          boldCell(ws.getCell(r7.number, 1), 'C\u00f3digo del Grupo', null,
            { horizontal: 'left', vertical: 'middle' });
          merge(r7.number, 2, q7 + 1);
          normCell(ws.getCell(r7.number, 2), grupo.codigo || grupo.id || 'N/A');
          boldCell(ws.getCell(r7.number, q7 + 2), 'Carga Horaria', null,
            { horizontal: 'center', vertical: 'middle' });
          normCell(ws.getCell(r7.number, q7 + 3), grupo.cargaHoraria || '',
            { horizontal: 'center', vertical: 'middle' });
          boldCell(ws.getCell(r7.number, mid7), 'Fecha de Inicio', null,
            { horizontal: 'center', vertical: 'middle' });
          normCell(ws.getCell(r7.number, mid7 + 1), grupo.fechaInicio || '',
            { horizontal: 'center', vertical: 'middle' });
          const cffCol = mid7 + 2;
          boldCell(ws.getCell(r7.number, cffCol), 'Fecha de Finalizaci\u00f3n', null,
            { horizontal: 'center', vertical: 'middle' });
          if (cffCol + 1 <= NUM_COLS) {
            merge(r7.number, cffCol + 1, NUM_COLS);
            normCell(ws.getCell(r7.number, cffCol + 1), grupo.fechaFin || '',
              { horizontal: 'center', vertical: 'middle' });
          }

          // Fila 8: vacía
          ws.addRow([]); ws.getRow(ws.rowCount).height = 6;

          // Fila 9: II.- Datos Específicos
          const r9 = ws.addRow([]); r9.height = 16;
          merge(r9.number, 1, NUM_COLS);
          boldCell(ws.getCell(r9.number, 1), 'II.- Datos Espec\u00edficos', FILL_SEC,
            { horizontal: 'left', vertical: 'middle' });

          // Filas 10-15: Encabezado de tabla
          const r10 = ws.addRow([]); r10.height = 22;

          ws.mergeCells(r10.number, COL_NO, r10.number + 4, COL_NO);
          boldCell(ws.getCell(r10.number, COL_NO), 'N\u00ba', FILL_HDR,
            { horizontal: 'center', vertical: 'middle' });

          ws.mergeCells(r10.number, COL_NOM_S, r10.number + 4, COL_NOM_E);
          boldCell(ws.getCell(r10.number, COL_NOM_S),
            'Lista de Estudiantes / Protagonistas', FILL_HDR,
            { horizontal: 'center', vertical: 'middle', wrapText: true });

          merge(r10.number, COL_UD_START, COL_UD_END);
          boldCell(ws.getCell(r10.number, COL_UD_START),
            'N\u00ba de la Unidad Did\u00e1ctica', FILL_HDR,
            { horizontal: 'center', vertical: 'middle', wrapText: true });

          ws.mergeCells(r10.number, COL_FINAL, r10.number + 4, COL_FINAL);
          boldCell(ws.getCell(r10.number, COL_FINAL),
            'Calificaci\u00f3n Final', FILL_HDR,
            { horizontal: 'center', vertical: 'middle', wrapText: true });

          // Fila 11: Números 1, 2...
          const r11 = ws.addRow([]); r11.height = 14;
          const colsUsadasHdr = colsUD.length > 0 ? colsUD : [{ nombreDisplay: 'Evaluaci\u00f3n' }];
          colsUsadasHdr.forEach((col, ci) => {
            const c = ws.getCell(r11.number, COL_UD_START + ci);
            c.value = ci + 1;
            c.font  = { name: fontName, size: fontSize, bold: true, color: { argb: 'FF000000' } };
            c.alignment = { horizontal: 'center', vertical: 'middle' };
            if (FILL_HDR && !listoParaImprimir) c.fill = FILL_HDR;
            applyBorder(c);
          });

          // Fila 12: "Calificaciones por UD"
          const r14 = ws.addRow([]); r14.height = 14;
          merge(r14.number, COL_UD_START, COL_UD_END);
          boldCell(ws.getCell(r14.number, COL_UD_START),
            'Calificaciones por Unidad Did\u00e1ctica', FILL_HDR,
            { horizontal: 'center', vertical: 'middle', wrapText: true });

          // Fila 15: Nombres de columnas
          const r15 = ws.addRow([]); r15.height = 36;
          colsUsadasHdr.forEach((col, ci) => {
            const c = ws.getCell(r15.number, COL_UD_START + ci);
            c.value = col.nombreDisplay;
            c.font  = { name: fontName, size: Math.max(7, fontSize - 1), bold: true, color: { argb: 'FF000000' } };
            c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            if (FILL_HDR && !listoParaImprimir) c.fill = FILL_HDR;
            applyBorder(c);
          });

          // Filas de estudiantes
          let activos  = 0;
          let evaluados = 0;
          let aprobados = 0;

          estudiantesHoja.forEach((e, sIdx) => {
            const ret     = esRetirado(e);
            const dataRow = ws.addRow([]); dataRow.height = cfg.rowData || 16;

            // Nº
            const cNro = ws.getCell(dataRow.number, COL_NO);
            cNro.value = sIdx + 1;
            cNro.font  = { name: fontName, size: fontSize, color: { argb: ret ? 'FF94A3B8' : textColor } };
            cNro.alignment = { horizontal: 'center', vertical: 'middle' };
            if (ret && !listoParaImprimir) cNro.fill = darkFill;
            applyBorder(cNro);

            // Nombre
            merge(dataRow.number, COL_NOM_S, COL_NOM_E);
            const cName = ws.getCell(dataRow.number, COL_NOM_S);
            const apellidos = (e.apellidos || '').trim();
            const nombres   = (e.nombres   || '').trim();
            cName.value = nombres && apellidos ? `${nombres} ${apellidos}` : (nombres || apellidos);
            cName.font  = { name: fontName, size: fontSize, bold: !ret, color: { argb: ret ? 'FF94A3B8' : textColor } };
            cName.alignment = { horizontal: 'left', vertical: 'middle' };
            if (ret && !listoParaImprimir) cName.fill = darkFill;
            applyBorder(cName);

            // Notas por UD
            const colsUsadasDatos = colsUD.length > 0 ? colsUD : columnas;
            const notasNum = [];
            colsUsadasDatos.forEach((col, ci) => {
              const c = ws.getCell(dataRow.number, COL_UD_START + ci);
              let valNota = 'S/N';
              if (e.convalidaciones && e.convalidaciones[mNombre]) {
                valNota = 'Cov';
              } else {
                valNota = CuadernoEngine.obtenerNotaEstudiante(e, mNombre, col.nombreDisplay);
                if ((valNota === 'S/N' || valNota === '-' || valNota == null) && ret) valNota = 'NSP';
              }
              const fmt = fmtNota(valNota);
              c.value = fmt;
              c.alignment = { horizontal: 'center', vertical: 'middle' };
              const st = getNotaStyle(valNota, e);
              c.font = { name: fontName, size: fontSize, ...(st.font || {}), color: { argb: (st.font && st.font.color) ? st.font.color.argb : textColor } };
              if (st.fill && !listoParaImprimir) c.fill = st.fill;
              applyBorder(c);
              if (typeof fmt === 'number') notasNum.push({ valor: fmt });
            });

            // Calificación Final: nunca NSP. Si hay nota se exporta tal cual
            // (total del módulo o media de las columnas) y si no hay, 0.
            const cF = ws.getCell(dataRow.number, COL_FINAL);
            let notaFinal;
            if (e.convalidaciones && e.convalidaciones[mNombre]) {
              notaFinal = 'Cov';
            } else {
              const colT = colsTotal[0];
              if (colT) {
                const cand = CuadernoEngine.obtenerNotaEstudiante(e, mNombre, colT.nombreDisplay);
                notaFinal = typeof cand === 'number' ? cand : null;
              }
              if (notaFinal == null) {
                if (notasNum.length > 0) {
                  notaFinal = Math.round(notasNum.reduce((a, n) => a + n.valor, 0) / notasNum.length);
                } else {
                  notaFinal = 0;
                }
              }
            }
            const fmtFinal = fmtNota(notaFinal);
            cF.value = fmtFinal;
            cF.alignment = { horizontal: 'center', vertical: 'middle' };
            const stF = getNotaStyle(notaFinal, e);
            cF.font = { name: fontName, size: fontSize, bold: true, ...(stF.font || {}), color: { argb: (stF.font && stF.font.color) ? stF.font.color.argb : textColor } };
            if (stF.fill && !listoParaImprimir) cF.fill = stF.fill;
            applyBorder(cF);

            // Estadísticas generales
            if (!ret) {
              activos++;
              const numF = typeof fmtFinal === 'number' ? fmtFinal : null;
              if (numF !== null) {
                evaluados++;
                if (numF >= configNotas.umbral) aprobados++;
              } else if (fmtFinal === 'Aprobado') {
                evaluados++;
                aprobados++;
              } else if (fmtFinal === 'Pendiente') {
                evaluados++;
              }
            }
          });

          // Filas vacías (mínimo 25)
          for (let i = estudiantesHoja.length; i < 25; i++) {
            const er = ws.addRow([]); er.height = 14;
            applyBorder(ws.getCell(er.number, COL_NO));
            merge(er.number, COL_NOM_S, COL_NOM_E);
            applyBorder(ws.getCell(er.number, COL_NOM_S));
            for (let ci = 0; ci < numUDs; ci++) applyBorder(ws.getCell(er.number, COL_UD_START + ci));
            applyBorder(ws.getCell(er.number, COL_FINAL));
          }

          // III.- Datos Estadísticos
          ws.addRow([]); ws.getRow(ws.rowCount).height = 8;
          const rS = ws.addRow([]); rS.height = 16;
          merge(rS.number, 1, NUM_COLS);
          boldCell(ws.getCell(rS.number, 1), 'III.- Datos Estad\u00edsticos', FILL_SEC,
            { horizontal: 'left', vertical: 'middle' });

          // Encabezado estadísticas
          const rSH = ws.addRow([]); rSH.height = 16;
          const ST = {
            i1: 1, i1e: 4, tot1: 5,
            i2: 6, i2e: 9, tot2: 10,
            lbl: 11, lble: NUM_COLS
          };
          const setSH = (c1, c2, val) => {
            merge(rSH.number, c1, c2);
            const c = ws.getCell(rSH.number, c1);
            c.value = val;
            c.font  = { name: fontName, size: Math.max(8, fontSize - 1), bold: true, color: { argb: 'FF000000' } };
            c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            if (!listoParaImprimir) c.fill = FILL_STAT;
            applyBorder(c);
          };
          setSH(ST.i1, ST.i1e, 'Indicador');
          setSH(ST.tot1, ST.tot1, 'Total');
          setSH(ST.i2, ST.i2e, 'Indicador');
          setSH(ST.tot2, ST.tot2, 'Total');
          setSH(ST.lbl, ST.lble, '%');

          const addStatRow = (lbl1, t1, lbl2, t2, pctLbl, pctVal) => {
            const r = ws.addRow([]); r.height = 15;
            const sv = (col, c2, val, bold) => {
              merge(r.number, col, c2 != null ? c2 : col);
              const c = ws.getCell(r.number, col);
              c.value = val;
              c.font  = { name: fontName, size: Math.max(8, fontSize - 1), bold: !!bold, color: { argb: 'FF000000' } };
              c.alignment = { horizontal: typeof val === 'number' ? 'center' : 'left', vertical: 'middle' };
              applyBorder(c);
            };
            sv(ST.i1, ST.i1e, lbl1, true);
            sv(ST.tot1, null, t1);
            sv(ST.i2, ST.i2e, lbl2, true);
            sv(ST.tot2, null, t2);
            merge(r.number, ST.lbl, ST.lble);
            const cPL = ws.getCell(r.number, ST.lbl);
            cPL.value = `${pctLbl}: ${typeof pctVal === 'number' ? (pctVal * 100).toFixed(1) + '%' : '--'}`;
            cPL.font  = { name: fontName, size: Math.max(8, fontSize - 1), bold: true, color: { argb: 'FF000000' } };
            cPL.alignment = { horizontal: 'center', vertical: 'middle' };
            applyBorder(cPL);
          };

          const totalActivos   = activos;
          const totalEvaluados = evaluados;
          const totalAprobados = aprobados;
          const retencion   = estudiantesHoja.length > 0 ? totalActivos / estudiantesHoja.length : 0;
          const rendimiento = totalEvaluados > 0 ? totalAprobados / totalEvaluados : 0;

          addStatRow(
            'Matr\u00edcula Inicial', estudiantesHoja.length,
            'Matr\u00edcula Final',   totalActivos,
            'Retenci\u00f3n', retencion
          );
          addStatRow(
            'N\u00ba Evaluados',    totalEvaluados,
            'N\u00ba de Aprobados', totalAprobados,
            'Rendimiento', rendimiento
          );

          // Firmas
          ws.addRow([]); ws.getRow(ws.rowCount).height = 8;
          ws.addRow([]); ws.getRow(ws.rowCount).height = 8;
          const half = Math.floor(NUM_COLS / 2);

          const rF1 = ws.addRow([]); rF1.height = 50;
          merge(rF1.number, 1, half);
          const cFN1 = ws.getCell(rF1.number, 1);
          cFN1.value = 'Nombre y Firma del Docente / Facilitador';
          cFN1.font  = { name: fontName, size: fontSize, bold: true, color: { argb: 'FF000000' } };
          cFN1.alignment = { horizontal: 'center', vertical: 'bottom' };

          merge(rF1.number, half + 1, NUM_COLS);
          const cFN2 = ws.getCell(rF1.number, half + 1);
          cFN2.value = 'Nombre y Firma del Responsable Inmediato del Docente / Facilitador';
          cFN2.font  = { name: fontName, size: fontSize, bold: true, color: { argb: 'FF000000' } };
          cFN2.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };

          const rF2 = ws.addRow([]); rF2.height = 18;
          merge(rF2.number, 1, half);
          const cFV1 = ws.getCell(rF2.number, 1);
          cFV1.value = this.obtenerNombreTIC(grupo);
          cFV1.font  = { name: fontName, size: fontSize, color: { argb: 'FF000000' } };
          cFV1.alignment = { horizontal: 'center', vertical: 'middle' };

          merge(rF2.number, half + 1, NUM_COLS);
          const cFV2 = ws.getCell(rF2.number, half + 1);
          cFV2.value = jefeDepartamento;
          cFV2.font  = { name: fontName, size: fontSize, color: { argb: 'FF000000' } };
          cFV2.alignment = { horizontal: 'center', vertical: 'middle' };
        };

        // ─────────────────────────────────────────────────────────────
        // RESUMEN GENERAL
        // ─────────────────────────────────────────────────────────────
        if (conResumen) {
          const totalCols = modulosAExportar.length + 5;
          const ws = wb.addWorksheet('Resumen General');
          this.aplicarConfigImpresion(ws, cfg, listoParaImprimir);

          ws.columns = [
            { width: cfg.colA / 7 || 6 },
            { width: cfg.colB / 7 || 14 },
            { width: cfg.colB / 7 || 14 },
            { width: cfg.colC / 7 || 28 },
            ...modulosAExportar.map(() => ({ width: cfg.colNotes / 7 || 14 })),
            { width: cfg.colNotes / 7 || 14 }
          ];

          const rH1 = ws.addRow(['DIRECCI\u00d3N GENERAL DE FORMACI\u00d3N PROFESIONAL']); rH1.height = 20;
          ws.mergeCells(1, 1, 1, totalCols);
          styleCell(ws.getCell('A1'), { alignment: { horizontal: 'center', vertical: 'middle' }, font: { size: 13, bold: true }, border: false });
          ws.getCell('A1').border = {};

          const rH2 = ws.addRow([nombreCentro]); rH2.height = 16;
          ws.mergeCells(2, 1, 2, totalCols);
          styleCell(ws.getCell('A2'), { alignment: { horizontal: 'center', vertical: 'middle' }, font: { size: cfg.titleCentro || 11, bold: true }, border: false });
          ws.getCell('A2').border = {};

          const rH3 = ws.addRow(['REPORTE CONSOLIDADO DE CALIFICACIONES']); rH3.height = 15;
          ws.mergeCells(3, 1, 3, totalCols);
          styleCell(ws.getCell('A3'), { alignment: { horizontal: 'center', vertical: 'middle' }, font: { size: cfg.titleReporte || 10, bold: true }, border: false });
          ws.getCell('A3').border = {};

          ws.addRow([]);

          const metadatos = [
            ['Carrera T\u00e9cnica:', grupo.carrera || 'N/A', '', 'C\u00f3digo / Grupo:', grupo.codigo || grupo.id],
            ['Turno / R\u00e9gimen:', grupo.turno || 'General', '', 'Docente a cargo:', grupo.docenteGuia || 'Sin asignar'],
            ['Matr\u00edcula total:', totalEstudiantesGrupo, '', 'Incluidos en cuaderno:', estudiantes.length],
            ['Fecha de emisi\u00f3n:', fechaActual, '', '']
          ];
          metadatos.forEach(valores => {
            const fila = ws.addRow(valores); fila.height = 16;
            const nf = fila.number;
            if (totalCols > 5) ws.mergeCells(nf, 5, nf, totalCols);
            if (totalCols >= 3) ws.mergeCells(nf, 2, nf, 3);
            styleCell(ws.getCell(nf, 1), { alignment: { horizontal: 'left', vertical: 'center' }, font: { bold: true } });
            styleCell(ws.getCell(nf, 2), { alignment: { horizontal: 'left', vertical: 'center' } });
            if (valores[3]) {
              styleCell(ws.getCell(nf, 4), { alignment: { horizontal: 'left', vertical: 'center' }, font: { bold: true } });
              styleCell(ws.getCell(nf, 5), { alignment: { horizontal: 'left', vertical: 'center' } });
            }
          });

          ws.addRow([]);

          const hdr = ['No.', 'Nombres', 'Apellidos', 'Correo Electr\u00f3nico'];
          modulosAExportar.forEach(m => hdr.push(m));
          hdr.push('Promedio Final');
          const hdrRow = ws.addRow(hdr); hdrRow.height = cfg.rowHeaderMain || 30;
          hdr.forEach((_, ci) => {
            styleCell(ws.getCell(hdrRow.number, ci + 1), {
              alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
              font: { bold: true }, fill: headerFill
            });
          });

          estudiantes.forEach((e, idx) => {
            const row = [idx + 1, e.nombres, e.apellidos, e.correo || 'N/A'];
            const notasProm = [];
            modulosAExportar.forEach(m => {
              let nd = 'S/N';
              if (e.convalidaciones && e.convalidaciones[m]) {
                nd = 'Cov';
              } else {
                const mData = e.evaluacionesPorModulo ? e.evaluacionesPorModulo[m] : null;
                if (mData) {
                  const notasObj = mData.notas || mData.evaluaciones;
                  if (notasObj) {
                    const cfgMR  = grupo.estructuraModulos ? grupo.estructuraModulos[m] : null;
                    const colsMR = cfgMR?.columnasOrdenadas || [];
                    const colT   = colsMR.find(c => c.esTotal);
                    let vf = null;
                    if (colT) {
                      const cand = CuadernoEngine.obtenerNotaEstudiante(e, m, colT.nombreDisplay);
                      if (typeof cand === 'number') vf = cand;
                    }
                    if (vf === null) {
                      const nt = new Set(colsMR.filter(c => c.esTotal).map(c => c.nombreDisplay));
                      const vs = Object.entries(notasObj)
                        .filter(([k, v]) => typeof v === 'number' && !nt.has(k) && !CuadernoEngine.normalizarTexto(k).includes('total'))
                        .map(([, v]) => v);
                      if (vs.length > 0) vf = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length);
                    }
                    if (vf !== null) nd = vf;
                    else if (esRetirado(e)) nd = 'NSP';
                  } else if (esRetirado(e)) nd = 'NSP';
                } else if (esRetirado(e)) nd = 'NSP';
              }
              const fmt = fmtNota(nd);
              row.push(fmt);
              if (typeof fmt === 'number') notasProm.push(fmt);
            });
            // Promedio Final: igual que la calificación final, sin NSP.
            let prom = notasProm.length > 0
              ? Math.round(notasProm.reduce((a, b) => a + b, 0) / notasProm.length)
              : 0;
            row.push(fmtNota(prom));

            const dataRow = ws.addRow(row); dataRow.height = cfg.rowData || 16;
            styleCell(ws.getCell(dataRow.number, 1), { font: { color: { argb: textColor } } });
            styleCell(ws.getCell(dataRow.number, 2), { alignment: { horizontal: 'left', vertical: 'middle' }, font: { bold: true } });
            styleCell(ws.getCell(dataRow.number, 3), { alignment: { horizontal: 'left', vertical: 'middle' }, font: { bold: true } });
            styleCell(ws.getCell(dataRow.number, 4), { alignment: { horizontal: 'left', vertical: 'middle' } });
            modulosAExportar.forEach((_, mi) => {
              const st = getNotaStyle(row[4 + mi], e);
              styleCell(ws.getCell(dataRow.number, 5 + mi), { ...st, alignment: { horizontal: 'center', vertical: 'middle' } });
            });
            const stP = getNotaStyle(prom, e);
            styleCell(ws.getCell(dataRow.number, totalCols), { ...stP, alignment: { horizontal: 'center', vertical: 'middle' } });
          });

          ws.addRow([]);
          const sp = Math.max(1, Math.floor(totalCols / 3));
          const cF1 = 1, cF2 = sp + 1, cF3 = sp * 2 + 1;
          const frA = ws.addRow([]); frA.height = 40;
          ws.getCell(frA.number, cF1).value = 'Docente TIC';
          ws.getCell(frA.number, cF2).value = 'Jefe de Departamento';
          ws.getCell(frA.number, cF3).value = 'Coordinador Acad\u00e9mico';
          ws.mergeCells(frA.number, cF1, frA.number, sp);
          ws.mergeCells(frA.number, cF2, frA.number, sp * 2);
          ws.mergeCells(frA.number, cF3, frA.number, totalCols);
          [cF1, cF2, cF3].forEach(c => styleCell(ws.getCell(frA.number, c), { alignment: { horizontal: 'center', vertical: 'bottom' }, font: { bold: true } }));
          const frB = ws.addRow([]); frB.height = 18;
          ws.getCell(frB.number, cF1).value = this.obtenerNombreTIC(grupo);
          ws.getCell(frB.number, cF2).value = jefeDepartamento;
          ws.getCell(frB.number, cF3).value = coordinadorAcademico;
          ws.mergeCells(frB.number, cF1, frB.number, sp);
          ws.mergeCells(frB.number, cF2, frB.number, sp * 2);
          ws.mergeCells(frB.number, cF3, frB.number, totalCols);
          [cF1, cF2, cF3].forEach(c => styleCell(ws.getCell(frB.number, c), { alignment: { horizontal: 'center', vertical: 'middle' }, font: { bold: true } }));
        }

        // ─────────────────────────────────────────────────────────────
        // HOJAS POR MÓDULO — Formato oficial DGFP/INATEC
        // ─────────────────────────────────────────────────────────────
        modulosAExportar.forEach((mNombre, idx) => {
          const configMod = grupo.estructuraModulos ? grupo.estructuraModulos[mNombre] : null;
          let columnas = configMod?.columnasOrdenadas || [];
          if (columnas.length === 0) {
            const colMap = new Map();
            estudiantes.forEach(s => {
              const mData = s.evaluacionesPorModulo ? s.evaluacionesPorModulo[mNombre] : null;
              if (mData) {
                const fuente = mData.notas || mData.evaluaciones || {};
                Object.keys(fuente).forEach(k => {
                  if (!colMap.has(k)) colMap.set(k, { nombreDisplay: k, esTotal: CuadernoEngine.normalizarTexto(k).includes('total') });
                });
              }
            });
            columnas = Array.from(colMap.values());
          }

          const exportMode = document.getElementById('select-export-mode')?.value || 'full';
          if (exportMode === 'resumen') {
            columnas = columnas.filter(col => col.esTotal);
            if (columnas.length === 0) return;
          }

          const ws = wb.addWorksheet(`M\u00f3dulo ${idx + 1}`);
          construirHojaOficial(ws, mNombre, columnas, estudiantes);
        });

        // Blanco y negro parejo en todas las hojas (Excel y PDF)
        wb.worksheets.forEach(ws => this.negroizarHoja(ws));
        if (listoParaImprimir) wb.worksheets.forEach(ws => this.ajustarAnchosParaImpresion(ws));
        return wb;
      },

      // ═══════════════════════════════════════════════════════════════
      // FORMATO DE AVANCES — Notas, Estadísticas y Consolidados
      // Libro propio para el seguimiento del ciclo: una hoja con el
      // avance por estudiante, otra con las estadísticas por módulo y
      // una tercera con el consolidado por alumno y por grupo.
      // ═══════════════════════════════════════════════════════════════

      // Nota final de un estudiante en un módulo (número, 'Cov',
      // 'NSP' o 'S/N'): la misma lectura del Resumen General.
      _notaFinalModuloAvance(estudiante, mNombre, grupo) {
        const esRetirado = est => est.retirado || est.estado === 'Retirado';
        if (estudiante.convalidaciones && estudiante.convalidaciones[mNombre]) return 'Cov';
        const mData = estudiante.evaluacionesPorModulo ? estudiante.evaluacionesPorModulo[mNombre] : null;
        const notasObj = mData ? (mData.notas || mData.evaluaciones) : null;
        if (!notasObj) return esRetirado(estudiante) ? 'NSP' : 'S/N';
        const cfgMR = grupo.estructuraModulos ? grupo.estructuraModulos[mNombre] : null;
        const colsMR = (cfgMR && cfgMR.columnasOrdenadas) || [];
        const colT = colsMR.find(c => c.esTotal);
        let vf = null;
        if (colT) {
          const candidato = this.obtenerNotaEstudiante(estudiante, mNombre, colT.nombreDisplay);
          if (typeof candidato === 'number') vf = candidato;
        }
        if (vf === null) {
          const totales = new Set(colsMR.filter(c => c.esTotal).map(c => c.nombreDisplay));
          const valores = Object.entries(notasObj)
            .filter(([clave, valor]) => typeof valor === 'number' && !totales.has(clave) &&
              !this.normalizarTexto(clave).includes('total'))
            .map(([, valor]) => valor);
          if (valores.length > 0) vf = Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
        }
        if (vf !== null) return vf;
        return esRetirado(estudiante) ? 'NSP' : 'S/N';
      },

      // Presenta una nota cruda según el modo elegido (real o estado).
      _fmtNotaAvance(valor, modo, umbral) {
        if (valor === 'Retirado' || valor === 'Convalidado') return valor;
        if (valor === 'S/N' || valor === null || valor === undefined || valor === '-') {
          return modo === 'estado' ? 'Pendiente' : 'S/N';
        }
        const num = Number(valor);
        if (isNaN(num)) return String(valor);
        if (modo === 'estado') return num >= umbral ? 'Aprobado' : 'Pendiente';
        return Math.round(num);
      },

      buildWorkbookAvances(grupoId, modulosAExportar, configNotas, filtroEstudiantes = 'todos') {
        const cfg = ConfigExport.load();
        const grupo = DataEngine.getGrupoById(grupoId);
        if (!grupo) return null;
        let estudiantes = DataEngine.getEstudiantesByGrupo(grupoId);
        if (!estudiantes || estudiantes.length === 0) return null;
        estudiantes = DataEngine.ordenarEstudiantes(estudiantes);
        estudiantes = this.filtrarEstudiantes(estudiantes, filtroEstudiantes, modulosAExportar, grupo);
        if (!estudiantes || estudiantes.length === 0) return null;

        const modulos = (modulosAExportar || []).slice();
        const umbral = configNotas && Number.isFinite(Number(configNotas.umbral)) ? Number(configNotas.umbral) : 60;
        const modo = (configNotas && configNotas.modo) || 'real';
        const jefeDepartamento = this.obtenerJefeDepartamento(grupo);
        const coordinadorAcademico = this.obtenerNombreCoordinador();
        const nombreTIC = this.obtenerNombreTIC(grupo);
        const nombreCentro = typeof AuthManager.getActiveCenterName === 'function'
          ? AuthManager.getActiveCenterName() : 'Centro Tecnológico';
        const fechaActual = new Date().toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'TIC Dashboard';
        wb.created = new Date();

        const fontName = cfg.fontFamily || 'Calibri';
        const fontSize = cfg.fontSize || 10;
        const borderArgb = cfg.borderColor === '#000000' ? 'FF000000' : 'FFD9D9D9';
        const textColor = this.hexToArgb(cfg.textColor || '#000000');
        const headerColor = this.hexToArgb(cfg.headerColor || '#1E40AF');
        const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
        const fillVerde  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        const fillRojo   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

        const bordar = cell => {
          cell.border = {
            top:    { style: 'thin', color: { argb: borderArgb } },
            left:   { style: 'thin', color: { argb: borderArgb } },
            bottom: { style: 'thin', color: { argb: borderArgb } },
            right:  { style: 'thin', color: { argb: borderArgb } }
          };
        };
        const celda = (ws, fila, columna, valor, opts = {}) => {
          const cell = ws.getCell(fila, columna);
          cell.value = valor;
          cell.font = { name: fontName, size: fontSize, color: { argb: textColor }, ...(opts.font || {}) };
          cell.alignment = opts.alignment || { horizontal: 'center', vertical: 'middle', wrapText: true };
          if (opts.fill) cell.fill = opts.fill;
          if (opts.borde !== false) bordar(cell);
          return cell;
        };
        const pintarEncabezado = (ws, titulo, totalCols) => {
          this.aplicarConfigImpresion(ws, cfg, false);
          [['DIRECCIÓN GENERAL DE FORMACIÓN PROFESIONAL', 13],
           [nombreCentro, 11], [titulo, 12]].forEach(([texto, tam]) => {
            const fila = ws.addRow([texto]);
            ws.mergeCells(fila.number, 1, fila.number, totalCols);
            celda(ws, fila.number, 1, texto, { font: { size: tam, bold: true }, borde: false });
          });
          ws.addRow([]);
          [['Carrera Técnica:', grupo.carrera || 'N/A', 'Código / Grupo:', grupo.codigo || grupo.id],
           ['Turno / Régimen:', grupo.turno || 'General', 'Docente a cargo:', grupo.docenteGuia || 'Sin asignar'],
           ['TIC responsable:', nombreTIC, 'Fecha de emisión:', fechaActual],
           ['Matrícula:', estudiantes.length, 'Módulos:', modulos.length]].forEach(valores => {
            const fila = ws.addRow([valores[0], valores[1], '', valores[2], valores[3]]);
            const nf = fila.number;
            ws.mergeCells(nf, 2, nf, 3);
            ws.mergeCells(nf, 5, nf, Math.max(totalCols, 5));
            celda(ws, nf, 1, valores[0], { font: { bold: true }, alignment: { horizontal: 'left', vertical: 'middle' } });
            celda(ws, nf, 2, valores[1], { alignment: { horizontal: 'left', vertical: 'middle' } });
            celda(ws, nf, 4, valores[2], { font: { bold: true }, alignment: { horizontal: 'left', vertical: 'middle' } });
            celda(ws, nf, 5, valores[3], { alignment: { horizontal: 'left', vertical: 'middle' } });
          });
          ws.addRow([]);
        };
        const pintarEncabezadoTabla = (ws, columnas, filaEnc) => {
          columnas.forEach((nombre, indice) => {
            celda(ws, filaEnc.number, indice + 1, nombre,
              { font: { bold: true }, fill: fillHeader, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
          });
        };
        const pintarFirmas = (ws, totalCols) => {
          ws.addRow([]);
          const sp = Math.max(1, Math.floor(totalCols / 3));
          const cF1 = 1, cF2 = sp + 1, cF3 = sp * 2 + 1;
          const rotulos = ws.addRow([]); rotulos.height = 36;
          const rotulo1 = ws.getCell(rotulos.number, cF1); rotulo1.value = 'Docente TIC';
          const rotulo2 = ws.getCell(rotulos.number, cF2); rotulo2.value = 'Jefe de Departamento';
          const rotulo3 = ws.getCell(rotulos.number, cF3); rotulo3.value = 'Coordinador Académico';
          ws.mergeCells(rotulos.number, cF1, rotulos.number, sp);
          ws.mergeCells(rotulos.number, cF2, rotulos.number, sp * 2);
          ws.mergeCells(rotulos.number, cF3, rotulos.number, totalCols);
          celda(ws, rotulos.number, cF1, rotulo1.value, { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'bottom' } });
          celda(ws, rotulos.number, cF2, rotulo2.value, { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'bottom' } });
          celda(ws, rotulos.number, cF3, rotulo3.value, { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'bottom' } });
          const nombres = ws.addRow([]); nombres.height = 18;
          const nombre1 = ws.getCell(nombres.number, cF1); nombre1.value = nombreTIC;
          const nombre2 = ws.getCell(nombres.number, cF2); nombre2.value = jefeDepartamento;
          const nombre3 = ws.getCell(nombres.number, cF3); nombre3.value = coordinadorAcademico;
          ws.mergeCells(nombres.number, cF1, nombres.number, sp);
          ws.mergeCells(nombres.number, cF2, nombres.number, sp * 2);
          ws.mergeCells(nombres.number, cF3, nombres.number, totalCols);
          celda(ws, nombres.number, cF1, nombre1.value, { font: { bold: true } });
          celda(ws, nombres.number, cF2, nombre2.value, { font: { bold: true } });
          celda(ws, nombres.number, cF3, nombre3.value, { font: { bold: true } });
        };
        const ajustarAnchos = (ws, anchos) => anchos.forEach((ancho, indice) => {
          ws.getColumn(indice + 1).width = ancho;
        });

        // ── HOJA 1 · AVANCES: notas por estudiante ──
        {
          const totalCols = 4 + modulos.length + 2;
          const ws = wb.addWorksheet('Avances');
          ajustarAnchos(ws, [6, 22, 22, 30, ...modulos.map(() => 11), 11, 12]);
          pintarEncabezado(ws, 'FORMATO DE AVANCES ACADÉMICOS · NOTAS POR ESTUDIANTE', totalCols);
          const columnas = ['No.', 'Nombres', 'Apellidos', 'Correo', ...modulos, 'Promedio', 'Estado'];
          const filaEnc = ws.addRow(columnas);
          filaEnc.height = cfg.rowHeaderMain || 28;
          pintarEncabezadoTabla(ws, columnas, filaEnc);

          estudiantes.forEach((e, indice) => {
            const crudos = modulos.map(m => this._notaFinalModuloAvance(e, m, grupo));
            const numericos = crudos.filter(valor => typeof valor === 'number');
            const promedio = numericos.length
              ? Math.round(numericos.reduce((a, b) => a + b, 0) / numericos.length)
              : null;
            const estado = promedio !== null && promedio >= umbral ? 'Aprobado' : 'Pendiente';
            const valores = [indice + 1, e.nombres, e.apellidos, e.correo || 'S/N'];
            crudos.forEach(valor => valores.push(this._fmtNotaAvance(valor, modo, umbral)));
            valores.push(promedio === null ? 'S/N' : promedio);
            valores.push(estado);
            const fila = ws.addRow(valores);
            fila.height = cfg.rowData || 16;
            celda(ws, fila.number, 1, indice + 1);
            celda(ws, fila.number, 2, e.nombres, { alignment: { horizontal: 'left', vertical: 'middle' }, font: { bold: true } });
            celda(ws, fila.number, 3, e.apellidos, { alignment: { horizontal: 'left', vertical: 'middle' }, font: { bold: true } });
            celda(ws, fila.number, 4, e.correo || 'S/N', { alignment: { horizontal: 'left', vertical: 'middle' } });
            crudos.forEach((valor, mi) => {
              const esNumero = typeof valor === 'number';
              celda(ws, fila.number, 5 + mi, valores[4 + mi], {
                fill: esNumero ? (valor >= umbral ? fillVerde : fillRojo) : undefined
              });
            });
            celda(ws, fila.number, totalCols - 1, promedio === null ? 'S/N' : promedio,
              { font: { bold: true }, fill: promedio === null ? undefined : (promedio >= umbral ? fillVerde : fillRojo) });
            celda(ws, fila.number, totalCols, estado,
              { font: { bold: true }, fill: promedio !== null && promedio >= umbral ? fillVerde : fillRojo });
          });

          const todosLosNumeros = estudiantes.flatMap(e => modulos
            .map(m => this._notaFinalModuloAvance(e, m, grupo))
            .filter(valor => typeof valor === 'number'));
          const promedioGeneral = todosLosNumeros.length
            ? Math.round(todosLosNumeros.reduce((a, b) => a + b, 0) / todosLosNumeros.length)
            : 'S/N';
          const estadoGeneral = typeof promedioGeneral === 'number' && promedioGeneral >= umbral
            ? 'Aprobado' : 'Pendiente';
          const filaTotal = ws.addRow(Array(totalCols).fill(''));
          for (let col = 1; col <= totalCols; col++) {
            let valor = '';
            if (col === 1) valor = 'PROMEDIO DEL GRUPO';
            else if (col === totalCols - 1) valor = promedioGeneral;
            else if (col === totalCols) valor = estadoGeneral;
            celda(ws, filaTotal.number, col, valor,
              { font: { bold: true }, fill: fillHeader, alignment: { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' } });
          }
          pintarFirmas(ws, totalCols);
        }

        // ── HOJA 2 · ESTADÍSTICAS POR MÓDULO ──
        {
          const columnas = ['Módulo', 'Matrícula', 'Con nota', 'Promedio', 'Aprobados', 'Reprobados', 'Sin nota', 'Rendimiento'];
          const totalCols = columnas.length;
          const ws = wb.addWorksheet('Estadísticas');
          ajustarAnchos(ws, [34, 11, 10, 11, 12, 12, 10, 13]);
          pintarEncabezado(ws, 'FORMATO DE AVANCES · ESTADÍSTICAS POR MÓDULO', totalCols);
          const filaEnc = ws.addRow(columnas);
          filaEnc.height = cfg.rowHeaderMain || 28;
          pintarEncabezadoTabla(ws, columnas, filaEnc);

          let conNotaGlobal = 0, sumaGlobal = 0, aprobadosGlobal = 0;
          modulos.forEach(m => {
            let conNota = 0, suma = 0, aprobados = 0, reprobados = 0;
            estudiantes.forEach(e => {
              const valor = this._notaFinalModuloAvance(e, m, grupo);
              if (typeof valor !== 'number') return;
              conNota++; suma += valor;
              if (valor >= umbral) aprobados++; else reprobados++;
            });
            conNotaGlobal += conNota; sumaGlobal += suma; aprobadosGlobal += aprobados;
            const promedio = conNota ? Math.round(suma / conNota) : '—';
            const rendimiento = conNota ? `${Math.round((aprobados / conNota) * 100)}%` : '—';
            const valores = [m, estudiantes.length, conNota, promedio, aprobados, reprobados,
              estudiantes.length - conNota, rendimiento];
            const fila = ws.addRow(valores);
            fila.height = cfg.rowData || 16;
            celda(ws, fila.number, 1, m, { alignment: { horizontal: 'left', vertical: 'middle' }, font: { bold: true } });
            for (let col = 2; col <= totalCols; col++) {
              const relleno = (col === 5 && aprobados > 0) ? fillVerde
                : (col === 6 && reprobados > 0) ? fillRojo : undefined;
              celda(ws, fila.number, col, valores[col - 1], { fill: relleno });
            }
          });

          const celdasTotales = estudiantes.length * modulos.length;
          const promedioGeneral = conNotaGlobal ? Math.round(sumaGlobal / conNotaGlobal) : '—';
          const rendimientoGlobal = conNotaGlobal
            ? `${Math.round((aprobadosGlobal / conNotaGlobal) * 100)}%` : '—';
          const valoresGen = ['GENERAL', estudiantes.length, conNotaGlobal, promedioGeneral,
            aprobadosGlobal, conNotaGlobal - aprobadosGlobal, celdasTotales - conNotaGlobal, rendimientoGlobal];
          const filaGen = ws.addRow(valoresGen);
          filaGen.height = cfg.rowData || 16;
          celda(ws, filaGen.number, 1, 'GENERAL',
            { font: { bold: true }, fill: fillHeader, alignment: { horizontal: 'left', vertical: 'middle' } });
          for (let col = 2; col <= totalCols; col++) {
            celda(ws, filaGen.number, col, valoresGen[col - 1], { font: { bold: true }, fill: fillHeader });
          }
        }

        // ── HOJA 3 · CONSOLIDADOS POR ESTUDIANTE ──
        {
          const columnas = ['No.', 'Nombres', 'Apellidos', 'Promedio General', 'Aprobados',
            'Reprobados', 'Convalidados', 'Sin nota', '% Avance', 'Estado'];
          const totalCols = columnas.length;
          const ws = wb.addWorksheet('Consolidados');
          ajustarAnchos(ws, [6, 22, 22, 15, 12, 12, 13, 10, 11, 12]);
          pintarEncabezado(ws, 'FORMATO DE AVANCES · CONSOLIDADO POR ESTUDIANTE', totalCols);
          const filaEnc = ws.addRow(columnas);
          filaEnc.height = cfg.rowHeaderMain || 28;
          pintarEncabezadoTabla(ws, columnas, filaEnc);

          const acumulados = { aprobados: 0, reprobados: 0, convalidados: 0, sinNota: 0, promedios: [] };
          estudiantes.forEach((e, indice) => {
            const crudos = modulos.map(m => this._notaFinalModuloAvance(e, m, grupo));
            const numericos = crudos.filter(valor => typeof valor === 'number');
            const aprobados = numericos.filter(valor => valor >= umbral).length;
            const reprobados = numericos.length - aprobados;
            const convalidados = crudos.filter(valor => valor === 'Cov').length;
            const sinNota = crudos.length - numericos.length - convalidados;
            const promedio = numericos.length
              ? Math.round(numericos.reduce((a, b) => a + b, 0) / numericos.length)
              : null;
            const avance = modulos.length
              ? Math.round(((aprobados + convalidados) / modulos.length) * 100) : 0;
            const estado = promedio !== null && promedio >= umbral ? 'Aprobado' : 'Pendiente';
            acumulados.aprobados += aprobados;
            acumulados.reprobados += reprobados;
            acumulados.convalidados += convalidados;
            acumulados.sinNota += sinNota;
            if (promedio !== null) acumulados.promedios.push(promedio);
            const valores = [indice + 1, e.nombres, e.apellidos, promedio === null ? 'S/N' : promedio,
              aprobados, reprobados, convalidados, sinNota, `${avance}%`, estado];
            const fila = ws.addRow(valores);
            fila.height = cfg.rowData || 16;
            celda(ws, fila.number, 1, indice + 1);
            celda(ws, fila.number, 2, e.nombres, { alignment: { horizontal: 'left', vertical: 'middle' }, font: { bold: true } });
            celda(ws, fila.number, 3, e.apellidos, { alignment: { horizontal: 'left', vertical: 'middle' }, font: { bold: true } });
            celda(ws, fila.number, 4, valores[3],
              { font: { bold: true }, fill: promedio === null ? undefined : (promedio >= umbral ? fillVerde : fillRojo) });
            for (let col = 5; col <= 8; col++) celda(ws, fila.number, col, valores[col - 1]);
            celda(ws, fila.number, 9, valores[8], { font: { bold: true } });
            celda(ws, fila.number, 10, valores[9],
              { font: { bold: true }, fill: estado === 'Aprobado' ? fillVerde : fillRojo });
          });

          const promedioGrupo = acumulados.promedios.length
            ? Math.round(acumulados.promedios.reduce((a, b) => a + b, 0) / acumulados.promedios.length)
            : 'S/N';
          const celdasTotales = estudiantes.length * modulos.length;
          const avanceGrupo = celdasTotales
            ? Math.round(((acumulados.aprobados + acumulados.convalidados) / celdasTotales) * 100) : 0;
          const estadoGrupo = typeof promedioGrupo === 'number' && promedioGrupo >= umbral
            ? 'Aprobado' : 'Pendiente';
          const valoresCierre = ['PROMEDIO DEL GRUPO', '', '', promedioGrupo, acumulados.aprobados,
            acumulados.reprobados, acumulados.convalidados, acumulados.sinNota, `${avanceGrupo}%`, estadoGrupo];
          const filaCierre = ws.addRow(valoresCierre);
          filaCierre.height = cfg.rowData || 16;
          for (let col = 1; col <= totalCols; col++) {
            celda(ws, filaCierre.number, col, valoresCierre[col - 1],
              { font: { bold: true }, fill: fillHeader, alignment: { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' } });
          }
          pintarFirmas(ws, totalCols);
        }

        return wb;
      },

      obtenerFormatoExportacion() {
        const selector = document.getElementById('select-formato-cuaderno');
        const valor = selector ? selector.value : '';
        return valor === 'pdf' || valor === 'avances' ? valor : 'xlsx';
      },

      descargarBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },

      exportarWorkbookEnXlsx(wb, fileName, mensajeExito) {
        // [OPT] El usuario ve "generando…" en lugar de una ventana que
        // parece congelada mientras ExcelJS serializa el libro completo.
        UI.showLoading('Generando el archivo de Excel…', 'exportacion');
        wb.xlsx.writeBuffer().then(buffer => {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          this.descargarBlob(blob, fileName);
          UI.hideLoading(240);
          UI.showToast(mensajeExito);
        }).catch(error => {
          // Antes un fallo de serialización quedaba silencioso.
          console.error('No se pudo generar el archivo XLSX:', error);
          UI.hideLoading(240);
          UI.showToast(`❌ No se pudo generar el archivo: ${error.message || error}`);
        });
      },

      exportarCuadernoOficial() {
        const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
        if (!grupoId) { UI.showToast("⚠️ Seleccione un grupo para exportar el cuaderno docente."); return; }

        const modulosAExportar = this.obtenerModulosSeleccionados();
        const conResumen = this.incluirResumenGeneral();
        const configNotas = this.obtenerConfigNotas();
        const filtroEstudiantes = this.obtenerFiltroEstudiantes();

        // Formato de avances: libro de seguimiento con hojas de Notas,
        // Estadísticas y Consolidados (siempre en XLSX).
        if (this.obtenerFormatoExportacion() === 'avances') {
          if (modulosAExportar.length === 0) {
            UI.showToast('⚠️ El formato de avances necesita al menos un módulo seleccionado.');
            return;
          }
          const wbAvances = this.buildWorkbookAvances(grupoId, modulosAExportar, configNotas, filtroEstudiantes);
          if (!wbAvances) { UI.showToast('⚠️ El grupo no contiene estudiantes que cumplan el filtro seleccionado.'); return; }
          const grupoAvances = DataEngine.getGrupoById(grupoId);
          this.exportarWorkbookEnXlsx(wbAvances,
            `Avances_${(grupoAvances.nombre || grupoAvances.id).replace(/\s+/g, '_')}.xlsx`,
            '📈 Formato de avances exportado con Notas, Estadísticas y Consolidados.');
          return;
        }

        if (modulosAExportar.length === 0 && !conResumen) {
          UI.showToast("⚠️ Debe seleccionar al menos un módulo o incluir el resumen general.");
          return;
        }

        const wb = this.buildWorkbookForGroup(grupoId, modulosAExportar, conResumen, configNotas, filtroEstudiantes);
        if (!wb) { UI.showToast("⚠️ El grupo no contiene estudiantes que cumplan el filtro seleccionado."); return; }

        const grupo = DataEngine.getGrupoById(grupoId);
        const nombreBase = `Cuaderno_Docente_${(grupo.nombre || grupo.id).replace(/\s+/g, '_')}`;

        if (this.obtenerFormatoExportacion() === 'pdf') {
          // [OPT] El PDF se dibuja de forma síncrona: sin ceder el hilo la
          // pantalla de carga nunca llegaba a pintarse y la ventana quedaba
          // congelada. Se espera un instante, se genera y se libera.
          UI.showLoading('Generando el PDF del cuaderno…', 'exportacion');
          setTimeout(() => {
            let listo = false;
            try {
              listo = this.exportarWorkbookAPDF(wb, `${nombreBase}.pdf`);
            } catch (error) {
              console.error('No se pudo generar el PDF:', error);
              UI.showToast(`❌ No se pudo generar el PDF: ${error.message || error}`);
            }
            UI.hideLoading(260);
            if (listo) UI.showToast("📄 Cuaderno Docente exportado en PDF.");
          }, 40);
          return;
        }

        this.exportarWorkbookEnXlsx(wb, `${nombreBase}.xlsx`,
          "📄 Cuaderno Docente exportado en XLSX con diseño completo.");
      },

      // Alias: mantiene el comportamiento anterior (hoy respeta el formato elegido).
      exportarCuadernoOficialExcel() {
        return this.exportarCuadernoOficial();
      },

      // ═══════════════════════════════════════════════════════════════
      // EXPORTACIÓN PDF — se dibuja el mismo workbook de ExcelJS con jsPDF
      // ═══════════════════════════════════════════════════════════════

      pdfDisponible() {
        return typeof window.jspdf !== 'undefined' && !!(window.jspdf.jsPDF);
      },

      papelEnMm(paperSize) {
        const papeles = {
          1: [215.9, 279.4],  // Carta
          3: [279.4, 431.8],  // Tabloid
          4: [279.4, 431.8],  // Ledger
          5: [215.9, 355.6],  // Legal
          8: [297, 420],      // A3
          9: [210, 297],      // A4
          11: [148, 210]      // A5
        };
        return papeles[paperSize] || papeles[9];
      },

      anchoColumnaPdf(anchoColumna) {
        // El ancho de columna de Excel está en caracteres → se pasa a px y luego a mm.
        const caracteres = Number(anchoColumna) > 0 ? Number(anchoColumna) : 8.43;
        return ((caracteres * 7) + 5) * 25.4 / 96;
      },

      rangoAMatriz(rango) {
        const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(String(rango || '').trim());
        if (!match) return null;
        const columnaANumero = (letras) => {
          let numero = 0;
          for (const caracter of letras.toUpperCase()) numero = (numero * 26) + (caracter.charCodeAt(0) - 64);
          return numero;
        };
        const c1 = columnaANumero(match[1]), c2 = columnaANumero(match[3]);
        const r1 = Number(match[2]), r2 = Number(match[4]);
        if (!Number.isFinite(r1) || !Number.isFinite(r2)) return null;
        return { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
      },

      mergesDeHoja(ws) {
        let rangos = [];
        try { rangos = (ws.model && ws.model.merges) || []; } catch (error) { rangos = []; }
        if (!Array.isArray(rangos)) rangos = Object.keys(rangos || {});
        return rangos.map(rango => this.rangoAMatriz(rango)).filter(Boolean);
      },

      textoDeCelda(celda) {
        const valor = celda ? celda.value : null;
        if (valor === null || valor === undefined) return '';
        if (typeof valor === 'string') return valor;
        if (typeof valor === 'number') return String(valor);
        if (valor instanceof Date) return valor.toLocaleDateString('es-NI');
        if (Array.isArray(valor.richText)) return valor.richText.map(parte => parte.text || '').join('');
        if (valor.text !== undefined && valor.text !== null) return String(valor.text);
        if (valor.result !== undefined && valor.result !== null) return String(valor.result);
        if (valor.error) return String(valor.error);
        return String(valor);
      },

      argbAComponentes(argb, porDefecto = [0, 0, 0]) {
        if (typeof argb !== 'string') return porDefecto;
        const limpio = argb.replace('#', '').toUpperCase();
        const hex = limpio.length === 8 ? limpio.slice(2) : limpio;
        if (hex.length !== 6 || /[^0-9A-F]/.test(hex)) return porDefecto;
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      },

      familiaPdf(nombre) {
        const n = String(nombre || '').toLowerCase();
        if (n.includes('times')) return 'times';
        if (n.includes('courier') || n.includes('consol') || n.includes('mono')) return 'courier';
        return 'helvetica';
      },

      dibujarCeldaEnPdf(doc, celda, x, y, w, h, escala) {
        if (!(w > 0) || !(h > 0)) return;
        const estilo = celda || {};

        // 1) Relleno de fondo
        const relleno = estilo.fill;
        if (relleno && relleno.type === 'pattern' && relleno.pattern === 'solid' && relleno.fgColor) {
          const [r, g, b] = this.argbAComponentes(relleno.fgColor.argb);
          doc.setFillColor(r, g, b);
          doc.rect(x, y, w, h, 'F');
        }

        // 2) Contenido de texto
        const texto = this.textoDeCelda(estilo);
        if (texto) {
          const fuente = estilo.font || {};
          const puntos = Math.max(4, Math.min(72, (Number(fuente.size) || 10) * escala));
          doc.setFont(
            this.familiaPdf(fuente.name),
            fuente.bold && fuente.italic ? 'bolditalic'
              : fuente.bold ? 'bold'
                : fuente.italic ? 'italic' : 'normal'
          );
          doc.setFontSize(puntos);
          const [tr, tg, tb] = this.argbAComponentes(fuente.color && fuente.color.argb);
          doc.setTextColor(tr, tg, tb);

          const alineacion = estilo.alignment || {};
          const pad = Math.min(1.5, Math.max(0.3, w * 0.05));
          const anchoUtil = Math.max(0.4, w - pad * 2);
          const lineas = [];
          String(texto).split(/\r?\n/).forEach(parte => {
            const ajustadas = doc.splitTextToSize(parte, anchoUtil);
            (Array.isArray(ajustadas) ? ajustadas : [ajustadas]).forEach(linea => {
              if (linea !== null && linea !== undefined && String(linea).length > 0) lineas.push(String(linea));
            });
          });

          if (lineas.length > 0) {
            const tamano = puntos * (25.4 / 72);      // alto de fuente en mm
            const altoLinea = tamano * 1.16;
            const maxLineas = Math.max(1, Math.floor((h - 0.3) / altoLinea));
            const recortadas = lineas.slice(0, maxLineas);
            if (lineas.length > maxLineas) {
              let ultima = recortadas[recortadas.length - 1];
              while (ultima.length > 1 && doc.getTextWidth(`${ultima}…`) > anchoUtil) ultima = ultima.slice(0, -1);
              recortadas[recortadas.length - 1] = `${ultima}…`;
            }

            const altoBloque = recortadas.length * altoLinea;
            const vertical = alineacion.vertical || 'bottom';
            let topeBloque = vertical === 'middle'
              ? y + Math.max(0, (h - altoBloque) / 2)
              : vertical === 'top'
                ? y + Math.min(pad, Math.max(0, (h - altoBloque) / 2))
                : y + h - altoBloque;
            topeBloque = Math.max(y, topeBloque);
            const primeraLinea = topeBloque + (altoLinea * 0.5) + (tamano * 0.35);

            const horizontal = alineacion.horizontal || 'left';
            recortadas.forEach((linea, indice) => {
              const anchoLinea = doc.getTextWidth(linea);
              let lx = horizontal === 'center'
                ? x + ((w - anchoLinea) / 2)
                : horizontal === 'right'
                  ? x + w - pad - anchoLinea
                  : x + pad;
              const minimo = x + pad * 0.5;
              lx = Math.min(Math.max(lx, minimo), Math.max(minimo, x + w - anchoLinea - pad * 0.5));
              doc.text(linea, lx, primeraLinea + (indice * altoLinea));
            });
          }
        }

        // 3) Bordes
        const borde = estilo.border || {};
        const grosorBase = { hair: 0.1, dotted: 0.16, dashed: 0.2, thin: 0.26, medium: 0.35, thick: 0.5, double: 0.5 };
        const factorLinea = Math.max(0.6, Math.min(2, escala));
        [
          ['top', x, y, x + w, y],
          ['bottom', x, y + h, x + w, y + h],
          ['left', x, y, x, y + h],
          ['right', x + w, y, x + w, y + h]
        ].forEach(([lado, x1, y1, x2, y2]) => {
          const bordeLado = borde[lado];
          if (!bordeLado) return;
          const [r, g, b] = this.argbAComponentes(bordeLado.color && bordeLado.color.argb);
          doc.setDrawColor(r, g, b);
          doc.setLineWidth(Math.max(0.07, (grosorBase[bordeLado.style] || 0.26) * factorLinea));
          doc.line(x1, y1, x2, y2);
        });
      },

      dibujarHojaEnPdf(doc, ws, estado) {
        const ps = ws.pageSetup || {};
        const papel = this.papelEnMm(ps.paperSize);
        const apaisado = (ps.orientation || 'portrait') === 'landscape';
        const pw = apaisado ? Math.max(papel[0], papel[1]) : Math.min(papel[0], papel[1]);
        const ph = apaisado ? Math.min(papel[0], papel[1]) : Math.max(papel[0], papel[1]);

        const mg = ps.margins || {};
        const ml = Number.isFinite(mg.left)   ? mg.left   * 25.4 : 17.8;
        const mr = Number.isFinite(mg.right)  ? mg.right  * 25.4 : 17.8;
        const mt = Number.isFinite(mg.top)    ? mg.top    * 25.4 : 19;
        const mb = Number.isFinite(mg.bottom) ? mg.bottom * 25.4 : 19;
        const utilW = Math.max(4, pw - ml - mr);
        const utilH = Math.max(4, ph - mt - mb);

        // ── Columnas y filas medidas en mm (sin escalar) ──
        const totalColumnas = Math.max(1, ws.columnCount || 1);
        const inicio = [0];
        for (let c = 1; c <= totalColumnas; c++) {
          inicio[c] = inicio[c - 1] + this.anchoColumnaPdf(ws.getColumn(c).width);
        }
        const contenidoW = inicio[totalColumnas];

        const altoFila = [0];
        let contenidoH = 0;
        for (let r = 1; r <= ws.rowCount; r++) {
          const altoPt = Number(ws.getRow(r).height) > 0 ? Number(ws.getRow(r).height) : 15;
          altoFila[r] = altoPt * (25.4 / 72);
          contenidoH += altoFila[r];
        }

        // ── Escala: respeta "ajustar a 1 página" o la escala manual ──
        let escala = 1;
        if (ps.fitToPage !== false) {
          escala = contenidoW > 0 ? utilW / contenidoW : 1;
          if (Number(ps.fitToHeight) === 1 && contenidoH > 0) {
            escala = Math.min(escala, utilH / contenidoH);
          }
        } else {
          const escalaGuardada = Number(ps.scale);
          escala = escalaGuardada > 0 ? escalaGuardada / 100 : 1;
        }
        escala = Math.max(0.05, Math.min(4, escala));

        // ── Bandas de columnas (paginación horizontal si el contenido no cabe) ──
        const bandas = [];
        let columnaDesde = 1, anchoAcumulado = 0;
        for (let c = 1; c <= totalColumnas; c++) {
          const ancho = (inicio[c] - inicio[c - 1]) * escala;
          if (c > columnaDesde && anchoAcumulado + ancho > utilW + 0.05) {
            bandas.push({ desde: columnaDesde, hasta: c - 1 });
            columnaDesde = c;
            anchoAcumulado = 0;
          }
          anchoAcumulado += ancho;
        }
        bandas.push({ desde: columnaDesde, hasta: totalColumnas });

        // ── Filas repartidas en páginas verticales (y relativa a la página) ──
        const filas = [];
        const altoPaginas = [0];
        let pagina = 0, yRelativa = 0;
        for (let r = 1; r <= ws.rowCount; r++) {
          const h = altoFila[r] * escala;
          if (yRelativa > 0 && yRelativa + h > utilH + 0.05) {
            altoPaginas[pagina] = yRelativa;
            pagina += 1;
            yRelativa = 0;
            altoPaginas[pagina] = 0;
          }
          filas[r] = { pagina, y: yRelativa, h };
          yRelativa += h;
        }
        altoPaginas[pagina] = yRelativa;
        const totalPaginas = Math.max(1, pagina + 1);

        // ── Celdas combinadas ──
        const maestros = new Map();
        const cubiertas = new Map();
        this.mergesDeHoja(ws).forEach(rango => {
          maestros.set(`${rango.r1},${rango.c1}`, rango);
          for (let r = rango.r1; r <= rango.r2; r++) {
            for (let c = rango.c1; c <= rango.c2; c++) {
              if (r !== rango.r1 || c !== rango.c1) cubiertas.set(`${r},${c}`, rango);
            }
          }
        });

        const centrarX = ps.horizontalCentered === true;
        const centrarY = ps.verticalCentered === true;
        const agregarPagina = () => {
          if (estado.primeraPagina) { estado.primeraPagina = false; return; }
          doc.addPage([pw, ph], apaisado ? 'landscape' : 'portrait');
        };

        bandas.forEach(banda => {
          const offsetBanda = inicio[banda.desde - 1] * escala;
          const anchoBanda = Math.min(utilW, (inicio[banda.hasta] - inicio[banda.desde - 1]) * escala);
          const xBase = ml + (centrarX ? Math.max(0, (utilW - anchoBanda) / 2) : 0);

          for (let p = 0; p < totalPaginas; p++) {
            const yBase = mt + (centrarY ? Math.max(0, (utilH - (altoPaginas[p] || 0)) / 2) : 0);
            agregarPagina();

            for (let r = 1; r <= ws.rowCount; r++) {
              const info = filas[r];
              if (!info || info.pagina !== p) continue;

              ws.getRow(r).eachCell({ includeEmpty: true }, (celda, c) => {
                if (c < 1 || c > totalColumnas) return;

                const clave = `${r},${c}`;
                const rangoMaestro = maestros.get(clave);
                const rangoCubierto = rangoMaestro ? null : cubiertas.get(clave);
                let filaOrigen = r, infoOrigen = info, colInicio = c;
                let colFin = c, filaFin = r;

                if (rangoMaestro) {
                  colFin = Math.min(rangoMaestro.c2, totalColumnas);
                  filaFin = rangoMaestro.r2;
                } else if (rangoCubierto) {
                  // La continuación de una combinación solo se dibuja si el maestro
                  // está en esta página y empezó fuera de la banda actual.
                  const infoMaestro = filas[rangoCubierto.r1];
                  if (!infoMaestro || infoMaestro.pagina !== p) return;
                  if (rangoCubierto.c1 >= banda.desde && rangoCubierto.c1 <= banda.hasta) return;
                  filaOrigen = rangoCubierto.r1;
                  infoOrigen = infoMaestro;
                  colInicio = rangoCubierto.c1;
                  colFin = Math.min(rangoCubierto.c2, totalColumnas);
                  filaFin = rangoCubierto.r2;
                }

                if (colFin < banda.desde || colInicio > banda.hasta) return;

                const bordeIzq = Math.max(0, (inicio[colInicio - 1] * escala) - offsetBanda);
                const bordeDer = Math.min(anchoBanda, (inicio[colFin] * escala) - offsetBanda);
                const w = bordeDer - bordeIzq;
                if (!(w > 0)) return;

                let h = infoOrigen.h;
                if (filaFin > filaOrigen) {
                  const fin = filas[filaFin];
                  h = (fin && fin.pagina === infoOrigen.pagina)
                    ? (fin.y + fin.h - infoOrigen.y)
                    : Math.max(0.5, utilH - infoOrigen.y);
                }

                const celdaOrigen = (filaOrigen === r && colInicio === c)
                  ? celda
                  : ws.getCell(filaOrigen, colInicio);
                this.dibujarCeldaEnPdf(doc, celdaOrigen, xBase + bordeIzq, yBase + infoOrigen.y, w, h, escala);
              });
            }
          }
        });
      },

      exportarWorkbookAPDF(wb, fileName) {
        if (!this.pdfDisponible()) {
          UI.showToast('❌ No se pudo cargar el módulo de PDF.');
          return false;
        }
        const hojas = (wb && wb.worksheets) || [];
        if (hojas.length === 0) {
          UI.showToast('⚠️ No hay contenido para exportar en PDF.');
          return false;
        }

        const { jsPDF } = window.jspdf;
        const ps = hojas[0].pageSetup || {};
        const papel = this.papelEnMm(ps.paperSize);
        const apaisado = (ps.orientation || 'portrait') === 'landscape';
        const ancho = apaisado ? Math.max(papel[0], papel[1]) : Math.min(papel[0], papel[1]);
        const alto  = apaisado ? Math.min(papel[0], papel[1]) : Math.max(papel[0], papel[1]);

        const doc = new jsPDF({
          orientation: apaisado ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [ancho, alto],
          compress: true
        });
        doc.setProperties({ title: fileName.replace(/\.pdf$/i, ''), creator: 'TIC Dashboard' });

        const estado = { primeraPagina: true };
        hojas.forEach(hoja => {
          try {
            this.dibujarHojaEnPdf(doc, hoja, estado);
          } catch (error) {
            console.error(`No se pudo dibujar la hoja "${hoja.name}" en PDF:`, error);
          }
        });

        doc.save(fileName);
        return true;
      },

      exportarCuadernosListosParaImprimir() {
        return this.exportarTodosLosCuadernos(true);
      },

      exportarCuadernosPorJefe() {
        const selector = document.getElementById('select-jefe-cuadernos-impresion');
        const indice = Number(selector?.value);
        const jefes = this.obtenerJefesDepartamento();
        if (!selector?.value || !Number.isInteger(indice) || !jefes[indice]) {
          UI.showToast('⚠️ Selecciona un jefe de departamento para exportar sus cuadernos.');
          return;
        }
        return this.exportarTodosLosCuadernos(true, jefes[indice]);
      },

      async exportarTodosLosCuadernos(listoParaImprimir = false, jefeSeleccionado = null, formato = null) {
        const formatoFinal = formato === 'xlsx' || formato === 'pdf' ? formato : this.obtenerFormatoExportacion();
        if (formatoFinal === 'pdf' && !this.pdfDisponible()) {
          UI.showToast('❌ No se pudo cargar el módulo de PDF.');
          return;
        }
        const filtroTurno = this.obtenerFiltroTurno();
        let grupos = DataEngine.getGrupos();
        if (jefeSeleccionado) {
          const turnosJefe = jefeSeleccionado.turnos.map(turno => this.normalizarTexto(turno));
          grupos = grupos.filter(grupo => {
            const turnoGrupo = this.normalizarTexto(grupo.turno || '');
            return turnosJefe.some(turno => turnoGrupo.includes(turno));
          });
        }
        if (filtroTurno !== 'todos') {
          grupos = grupos.filter(g => (g.turno || '').trim() === filtroTurno);
        }
        if (!grupos || grupos.length === 0) {
          UI.showToast(jefeSeleccionado
            ? `⚠️ No hay grupos en los turnos cubiertos por ${jefeSeleccionado.nombre}.`
            : "⚠️ No hay grupos que coincidan con el turno seleccionado.");
          return;
        }

        const modulosAExportar = this.obtenerModulosSeleccionados();
        const conResumen = this.incluirResumenGeneral();
        const configNotas = this.obtenerConfigNotas();
        const filtroEstudiantes = this.obtenerFiltroEstudiantes();

        if (formatoFinal === 'avances' && modulosAExportar.length === 0) {
          UI.showToast('⚠️ El formato de avances necesita al menos un módulo seleccionado.');
          return;
        }

        if (modulosAExportar.length === 0 && !conResumen) {
          UI.showToast("⚠️ Seleccione al menos un módulo o incluya el resumen general.");
          return;
        }

        let exportados = 0;
        // [OPT] Con muchos grupos la exportación tarda varios segundos: se
        // muestra el avance por grupo en la pantalla de carga para que la
        // ventana no parezca congelada.
        UI.showLoading(`Preparando ${grupos.length} cuaderno(s)…`, 'exportacion');
        try {
          let indice = 0;
          for (const grupo of grupos) {
            indice++;
            const etiqueta = document.getElementById('app-loading-message');
            if (etiqueta) etiqueta.textContent = `Generando cuaderno ${indice} de ${grupos.length}: ${grupo.nombre || grupo.id}`;

            const estudiantes = DataEngine.getEstudiantesByGrupo(grupo.id);
            if (!estudiantes || estudiantes.length === 0) continue;

            const wb = formatoFinal === 'avances'
              ? this.buildWorkbookAvances(grupo.id, modulosAExportar, configNotas, filtroEstudiantes)
              : this.buildWorkbookForGroup(
                grupo.id, modulosAExportar, conResumen, configNotas, filtroEstudiantes, listoParaImprimir
              );
            if (!wb) continue;

            const jefeSuffix = jefeSeleccionado
              ? `_Jefe_${jefeSeleccionado.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`
              : '';
            const suffix = `${listoParaImprimir ? '_Legal_Impresion' : ''}${jefeSuffix}`;
            const nombreBase = `${formatoFinal === 'avances' ? 'Avances' : 'Cuaderno_Docente'}_${(grupo.nombre || grupo.id).replace(/\s+/g, '_')}${suffix}`;
            const esPdf = formatoFinal === 'pdf';

            if (esPdf) {
              if (this.exportarWorkbookAPDF(wb, `${nombreBase}.pdf`)) exportados++;
            } else {
              const buffer = await wb.xlsx.writeBuffer();
              const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              this.descargarBlob(blob, `${nombreBase}.xlsx`);
              exportados++;
            }

            // Cede el hilo para que el navegador procese la descarga
            // (antes era una espera fija de 400 ms por grupo).
            await new Promise(r => setTimeout(r, 250));
          }
        } finally {
          UI.hideLoading(300);
        }

        const detalleFormato = formatoFinal === 'pdf' ? 'en PDF'
          : formatoFinal === 'avances' ? 'en formato de avances (XLSX)'
          : 'en XLSX';
        UI.showToast(jefeSeleccionado
          ? `🖨️ ${exportados} cuaderno(s) exportado(s) ${detalleFormato} para ${jefeSeleccionado.nombre}, según sus turnos.`
          : listoParaImprimir
            ? `🖨️ ${exportados} cuaderno(s) exportado(s) ${detalleFormato} en Legal horizontal, blanco y negro y sin rellenos.`
            : `📦 ${exportados} grupo(s) exportado(s) ${detalleFormato} en blanco y negro, texto en negrita.`);
      },

      // Deja la hoja en blanco y negro parejo: texto negro en negrita,
      // fondos de color a blanco y bordes en negro. Los colores salen
      // borrosos al imprimir, así que el cuaderno va siempre en B/N.
      negroizarHoja(ws) {
        const colorNegro  = { argb: 'FF000000' };
        const colorBlanco = { argb: 'FFFFFFFF' };
        ws.eachRow({ includeEmpty: true }, fila => {
          fila.eachCell({ includeEmpty: true }, celda => {
            const fuente = celda.font || {};
            celda.font = { ...fuente, bold: true, color: { argb: 'FF000000' } };
            if (celda.fill && celda.fill.type === 'pattern') {
              celda.fill = { type: 'pattern', pattern: 'solid', fgColor: colorBlanco };
            }
            const borde = celda.border;
            if (borde) {
              const lado = nombre => (borde[nombre] ? { ...borde[nombre], color: colorNegro } : undefined);
              celda.border = {
                top:    lado('top'),
                left:   lado('left'),
                bottom: lado('bottom'),
                right:  lado('right')
              };
            }
          });
        });
      },

      aplicarConfigImpresion(ws, cfg, listoParaImprimir = false) {
        const margenes = listoParaImprimir
          ? { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 }
          : (ConfigExport.MARGIN_PRESETS[cfg.printMargin] || ConfigExport.MARGIN_PRESETS.estrecho);
        ws.pageSetup.orientation = listoParaImprimir ? 'landscape' : (cfg.printOrientation || 'landscape');
        ws.pageSetup.paperSize = listoParaImprimir ? 5 : (Number(cfg.printPaperSize) || 9);
        if (listoParaImprimir) {
          ws.pageSetup.horizontalCentered = false;
          ws.pageSetup.verticalCentered = false;
          ws.pageSetup.margins = margenes;
          ws.pageSetup.fitToPage = true;
          ws.pageSetup.fitToWidth = 1;
          ws.pageSetup.fitToHeight = 0;
          return;
        }
        ws.pageSetup.horizontalCentered = !!cfg.printCentered;
        ws.pageSetup.verticalCentered = !!cfg.printCentered;
        ws.pageSetup.margins = margenes;
        if (cfg.printFitToPage) {
          ws.pageSetup.fitToPage = true;
          ws.pageSetup.fitToWidth = 1;
          ws.pageSetup.fitToHeight = 1;
        } else {
          ws.pageSetup.fitToPage = false;
          ws.pageSetup.scale = 100;
        }
      },

      ajustarAnchosParaImpresion(ws) {
        const filasDatos = [];
        for (let indiceFila = 1; indiceFila <= ws.rowCount; indiceFila++) {
          const fila = ws.getRow(indiceFila);
          if (fila.getCell(1).value !== 'No.' && Number.isInteger(fila.getCell(1).value) &&
            typeof fila.getCell(2).value === 'string' &&
            typeof fila.getCell(3).value === 'string') filasDatos.push(indiceFila);
        }

        for (let indiceColumna = 1; indiceColumna <= ws.columnCount; indiceColumna++) {
          let longitudMaxima = 0;
          for (const indiceFila of filasDatos) {
            const valor = ws.getCell(indiceFila, indiceColumna).value;
            if (typeof valor === 'string' || typeof valor === 'number') {
              const lineas = String(valor).split(/\r?\n/);
              longitudMaxima = Math.max(longitudMaxima, ...lineas.map(linea => linea.length));
            }
          }

          const minimo = indiceColumna === 1 ? 5 : indiceColumna === 2 ? 20 : indiceColumna === 3 ? 21 : indiceColumna === 4 ? 28 : 12;
          const maximo = indiceColumna === 1 ? 6 : indiceColumna === 2 ? 28 : indiceColumna === 3 ? 30 : indiceColumna === 4 ? 38 : 16;
          ws.getColumn(indiceColumna).width = Math.min(maximo, Math.max(minimo, longitudMaxima + 1));
        }

        for (let indiceFila = 1; indiceFila <= ws.rowCount; indiceFila++) {
          const fila = ws.getRow(indiceFila);
          if (fila.getCell(1).value === 'No.') {
            const lineasEncabezado = Math.max(1, ...Array.from(
              { length: ws.columnCount },
              (_, indice) => Math.ceil(String(fila.getCell(indice + 1).value || '').length / (ws.getColumn(indice + 1).width * 0.9))
            ));
            fila.height = Math.min(66, Math.max(24, lineasEncabezado * 13 + 4));
            continue;
          }

          if (!Number.isInteger(fila.getCell(1).value) ||
            typeof fila.getCell(2).value !== 'string' ||
            typeof fila.getCell(3).value !== 'string') continue;

          const lineasDatos = Math.max(1, ...Array.from(
            { length: ws.columnCount },
            (_, indice) => {
              const texto = String(fila.getCell(indice + 1).value ?? '');
              return Math.max(1, ...texto.split(/\r?\n/).map(linea =>
                Math.ceil(linea.length / (ws.getColumn(indice + 1).width * 0.9))
              ));
            }
          ));
          fila.height = Math.min(72, Math.max(18, lineasDatos * 13 + 4));
        }
      },

      generarSeccionFirmasHTML(totalCols, turno = '') {
        const colThird = Math.floor(totalCols / 3) || 1;
        const colRemainder = totalCols - (colThird * 2);
        const grupo = DataEngine.getGrupos().find(item => this.normalizarTexto(item.turno) === this.normalizarTexto(turno));
        const jefeDepartamento = grupo ? this.obtenerJefeDepartamento(grupo) : '';
        return `<tr><td colspan="${totalCols}" style="border: none; height: 35px;"></td></tr><tr><td colspan="${colThird}" style="border: none; text-align: center; font-family: Calibri, Arial; vertical-align: bottom; padding-top: 40px;">____________________________________<br><b style="font-size: 10pt;">Docente TIC</b><br><span style="font-size: 9.5pt;">${this.escaparHTML(this.obtenerNombreTIC(grupo))}</span></td><td colspan="${colThird}" style="border: none; text-align: center; font-family: Calibri, Arial; vertical-align: bottom; padding-top: 40px;">____________________________________<br><b style="font-size: 10pt;">Jefe de Departamento</b><br><span style="font-size: 9.5pt;">${this.escaparHTML(jefeDepartamento)}</span></td><td colspan="${colRemainder}" style="border: none; text-align: center; font-family: Calibri, Arial; vertical-align: bottom; padding-top: 40px;">____________________________________<br><b style="font-size: 10pt;">Coordinador Académico</b><br><span style="font-size: 9.5pt;">${this.escaparHTML(this.obtenerNombreCoordinador())}</span></td></tr>`;
      }
    };

    // [NUEVO] Inicializar selectores al cargar la aplicación
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof CuadernoEngine !== 'undefined' && CuadernoEngine.inicializarSelectoresExportacion) {
        CuadernoEngine.inicializarSelectoresExportacion();
      }
    });
