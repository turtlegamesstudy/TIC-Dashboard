'use strict';

    const MODULOS_TRANSVERSALES = [
      "Historia e Identidad Nacional",
      "Adaptación al Cambio Climático",
      "Orientación Laboral",
      "Cultura de Paz",
      "Identidad Histórica y Sociocultural de Nicaragua"
    ];

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
          modulos: MODULOS_TRANSVERSALES,
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
        preferencias.modulos = [...document.querySelectorAll('.chk-modulo-export:checked')].map(check => check.value);
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

        const modulosGuardados = new Set(Array.isArray(preferencias.modulos) ? preferencias.modulos : MODULOS_TRANSVERSALES);
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
          'select-grupo-cuaderno', 'select-modulo-cuaderno', 'select-jefe-cuadernos-impresion'
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
        const previousGroupValues = DataEngine._clone(grupo);
        if (!grupo.estructuraModulos) grupo.estructuraModulos = {};
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
                if (hNorm.startsWith("cuestionario:") || hNorm.includes("total")) {
                  let nombreLimpio = headerOriginal.replace(/^Cuestionario:\s*\d*\/?\d*\)?\s*/i, '').replace(/\(Real\)$/i, '').trim();
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

            await DataEngine.save();
            UI.showToast(`✅ ${moduloSeleccionado} importado correctamente (${estudiantesActualizados} alumnos).`);
            if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
          } catch (err) {
            if (DataEngine.getGrupoById(grupoId) === grupo) {
              Object.keys(grupo).forEach(key => delete grupo[key]);
              Object.assign(grupo, previousGroupValues);
            }
            console.error("Error al importar calificaciones:", err);
            UI.showToast(`❌ No se guardaron las calificaciones del archivo Excel: ${err.message}`);
          }
        };
        reader.onerror = error => {
          if (DataEngine.getGrupoById(grupoId) === grupo) {
            Object.keys(grupo).forEach(key => delete grupo[key]);
            Object.assign(grupo, previousGroupValues);
          }
          console.error('No se pudo leer el archivo de calificaciones:', error);
          UI.showToast('❌ No se pudo leer el archivo de calificaciones.');
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

        // Índice de búsqueda: cada estudiante junto con el grupo al que pertenece
        const indice = [];
        grupos.forEach(g => {
          (g.estudiantes || []).forEach(est => indice.push({ est, grupo: g }));
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
                if (hNorm.startsWith("cuestionario:") || hNorm.includes("total")) {
                  let nombreLimpio = headerOriginal.replace(/^Cuestionario:\s*\d*\/?\d*\)?\s*/i, '').replace(/\(Real\)$/i, '').trim();
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

            await DataEngine.save();
            const resumenGrupos = gruposTocados.size > 0 ? ` en ${gruposTocados.size} grupo(s)` : '';
            UI.showToast(`✅ ${moduloSeleccionado}: ${estudiantesActualizados} alumno(s) actualizados${resumenGrupos}.${filasSinCoincidencia > 0 ? ` (${filasSinCoincidencia} fila(s) sin coincidencia)` : ''}`);
            if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
          } catch (err) {
            previousGroups.forEach(({ group, value }, groupId) => {
              if (DataEngine.getGrupoById(groupId) !== group) return;
              Object.keys(group).forEach(key => delete group[key]);
              Object.assign(group, value);
            });
            console.error("Error al importar calificaciones masivas:", err);
            UI.showToast(`❌ No se guardaron las calificaciones del archivo Excel: ${err.message}`);
          }
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

        estudiantes = [...estudiantes].sort((a, b) => {
          const fullA = `${a.nombres || ''} ${a.apellidos || ''}`.toLowerCase().trim();
          const fullB = `${b.nombres || ''} ${b.apellidos || ''}`.toLowerCase().trim();
          return fullA.localeCompare(fullB);
        });

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
            cName.value = apellidos && nombres ? `${apellidos}, ${nombres}` : (apellidos || nombres);
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

            // Calificación Final
            const cF = ws.getCell(dataRow.number, COL_FINAL);
            let notaFinal;
            if (ret) {
              notaFinal = 'NSP';
            } else if (e.convalidaciones && e.convalidaciones[mNombre]) {
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
          cFV1.value = 'Hanzell Ren\u00e9 Mayorga Calero';
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
            let prom = esRetirado(e) ? 'NSP' : 'S/N';
            if (notasProm.length > 0) prom = Math.round(notasProm.reduce((a, b) => a + b, 0) / notasProm.length);
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
          ws.getCell(frB.number, cF1).value = 'Hanzell Ren\u00e9 Mayorga Calero';
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

        if (listoParaImprimir) wb.worksheets.forEach(ws => this.ajustarAnchosParaImpresion(ws));
        return wb;
      },


      exportarCuadernoOficialExcel() {
        const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
        if (!grupoId) { UI.showToast("⚠️ Seleccione un grupo para exportar el cuaderno docente."); return; }

        const modulosAExportar = this.obtenerModulosSeleccionados();
        const conResumen = this.incluirResumenGeneral();
        const configNotas = this.obtenerConfigNotas();
        const filtroEstudiantes = this.obtenerFiltroEstudiantes();

        if (modulosAExportar.length === 0 && !conResumen) {
          UI.showToast("⚠️ Debe seleccionar al menos un módulo o incluir el resumen general.");
          return;
        }

        const wb = this.buildWorkbookForGroup(grupoId, modulosAExportar, conResumen, configNotas, filtroEstudiantes);
        if (!wb) { UI.showToast("⚠️ El grupo no contiene estudiantes que cumplan el filtro seleccionado."); return; }

        const grupo = DataEngine.getGrupoById(grupoId);
        const fileName = `Cuaderno_Docente_${(grupo.nombre || grupo.id).replace(/\s+/g, '_')}.xlsx`;

        wb.xlsx.writeBuffer().then(buffer => {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
          URL.revokeObjectURL(url);
          UI.showToast("📄 Cuaderno Docente exportado en XLSX con diseño completo.");
        });
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

      async exportarTodosLosCuadernos(listoParaImprimir = false, jefeSeleccionado = null) {
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

        if (modulosAExportar.length === 0 && !conResumen) {
          UI.showToast("⚠️ Seleccione al menos un módulo o incluya el resumen general.");
          return;
        }

        let exportados = 0;
        for (const grupo of grupos) {
          const estudiantes = DataEngine.getEstudiantesByGrupo(grupo.id);
          if (!estudiantes || estudiantes.length === 0) continue;

          const wb = this.buildWorkbookForGroup(
            grupo.id, modulosAExportar, conResumen, configNotas, filtroEstudiantes, listoParaImprimir
          );
          if (!wb) continue;

          const jefeSuffix = jefeSeleccionado
            ? `_Jefe_${jefeSeleccionado.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`
            : '';
          const suffix = `${listoParaImprimir ? '_Legal_Impresion' : ''}${jefeSuffix}`;
          const fileName = `Cuaderno_Docente_${(grupo.nombre || grupo.id).replace(/\s+/g, '_')}${suffix}.xlsx`;
          const buffer = await wb.xlsx.writeBuffer();
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
          URL.revokeObjectURL(url);

          exportados++;
          await new Promise(r => setTimeout(r, 400));
        }

        UI.showToast(jefeSeleccionado
          ? `🖨️ ${exportados} cuaderno(s) exportado(s) para ${jefeSeleccionado.nombre}, según sus turnos.`
          : listoParaImprimir
            ? `🖨️ ${exportados} cuaderno(s) exportado(s) en Legal horizontal, blanco y negro y sin rellenos.`
            : `📦 ${exportados} grupo(s) exportado(s) en XLSX con diseño completo.`);
      },

      aplicarConfigImpresion(ws, cfg, listoParaImprimir = false) {
        const margenes = listoParaImprimir
          ? { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 }
          : (ConfigExport.MARGIN_PRESETS[cfg.printMargin] || ConfigExport.MARGIN_PRESETS.estrecho);
        ws.pageSetup.orientation = listoParaImprimir ? 'landscape' : (cfg.printOrientation || 'landscape');
        ws.pageSetup.paperSize = listoParaImprimir ? 5 : 9;
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
        return `<tr><td colspan="${totalCols}" style="border: none; height: 35px;"></td></tr><tr><td colspan="${colThird}" style="border: none; text-align: center; font-family: Calibri, Arial; vertical-align: bottom; padding-top: 40px;">____________________________________<br><b style="font-size: 10pt;">Docente TIC</b><br><span style="font-size: 9.5pt;">Hanzell René Mayorga Calero</span></td><td colspan="${colThird}" style="border: none; text-align: center; font-family: Calibri, Arial; vertical-align: bottom; padding-top: 40px;">____________________________________<br><b style="font-size: 10pt;">Jefe de Departamento</b><br><span style="font-size: 9.5pt;">${this.escaparHTML(jefeDepartamento)}</span></td><td colspan="${colRemainder}" style="border: none; text-align: center; font-family: Calibri, Arial; vertical-align: bottom; padding-top: 40px;">____________________________________<br><b style="font-size: 10pt;">Coordinador Académico</b><br><span style="font-size: 9.5pt;">${this.escaparHTML(this.obtenerNombreCoordinador())}</span></td></tr>`;
      }
    };

    // [NUEVO] Inicializar selectores al cargar la aplicación
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof CuadernoEngine !== 'undefined' && CuadernoEngine.inicializarSelectoresExportacion) {
        CuadernoEngine.inicializarSelectoresExportacion();
      }
    });
