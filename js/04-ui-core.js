'use strict';
    const UI = {
      currentModule: 'dashboard',
      loadingTimer: null,
      contentTimer: null,
      loadingStartedAt: 0,

      init() {
        // Preferencias de este equipo (animaciones y aspecto del menú) y
        // permisos del rol: se aplican ANTES de pintar nada.
        if (typeof Ajustes !== 'undefined' && Ajustes) Ajustes.inicializar();
        this.aplicarMenuGuardado();
        // El menú se pinta desde el registro de secciones (14-secciones.js)
        // antes de enlazar los eventos: así una sección nueva aparece sola.
        this.pintarNavegacion();
        if (typeof Permisos !== 'undefined' && Permisos) Permisos.aplicar();
        this.bindEvents();
        this.initBuscadorGlobal();
        this.syncThemeIcon();
        // Vista y filtros llegados en la URL (#/estadisticas?grupo=3A):
        // se recuperan ANTES del primer pintado para abrir la vista pedida.
        this.aplicarRuta(false);
        this.renderCurrentModule();
      },

      /* Dibuja el menú lateral con las secciones visibles para el perfil
         actual y marca la activa. */
      pintarNavegacion() {
        if (typeof Secciones === 'undefined') return;
        Secciones.pintarNavegacion(AuthManager.profile, this.currentModule);
        this.actualizarNavActivo(this.currentModule);
      },

      /* Expone el registro a los módulos externos: un archivo nuevo solo
         necesita UI.registrarSeccion({ ... }) para entrar en el panel. */
      registrarSeccion(def) {
        return Secciones.registrar(def);
      },

      /* Sección registrada para `currentModule` (resuelve alias). Si el
         perfil no tiene permiso, cae en la primera visible y reescribe la
         navegación: un docente que abra #administracion acaba en Dashboard. */
      seccionActual() {
        if (typeof Secciones === 'undefined') return null;
        const seccion = Secciones.obtener(this.currentModule);
        if (!seccion) return null;
        if (Secciones.puedeVer(seccion, AuthManager.profile)) return seccion;
        const fallback = Secciones.primeraVisible(AuthManager.profile);
        if (fallback) {
          this.currentModule = fallback.id;
          this.actualizarNavActivo(fallback.id);
        }
        return fallback || null;
      },

      /* Navega a una sección por id (o alias). Devuelve false si no existe
         o si el perfil no puede verla. */
      irA(id) {
        const seccion = typeof Secciones === 'undefined' ? null : Secciones.obtener(id);
        if (!seccion || !Secciones.puedeVer(seccion, AuthManager.profile)) return false;
        this.closeSectionSettings(false);
        this.currentModule = seccion.id;
        this.actualizarNavActivo(seccion.id);
        this.renderCurrentModule();
        return true;
      },

      /* ── Subsecciones del menú lateral ──
         Pliega/despliega los hijos de una sección y guarda la elección. */
      alternarHijos(idSeccion) {
        const abierto = typeof Secciones !== 'undefined' ? Secciones.alternarHijos(idSeccion) : false;
        const flecha = document.querySelector(`.nav-chevron[data-nav-toggle="${idSeccion}"]`);
        if (flecha) {
          flecha.setAttribute('aria-expanded', String(abierto));
          const seccion = typeof Secciones !== 'undefined' ? Secciones.obtener(idSeccion) : null;
          const nombre = seccion ? seccion.etiqueta : 'esta sección';
          flecha.setAttribute('aria-label', `${abierto ? 'Ocultar' : 'Mostrar'} subsecciones de ${nombre}`);
        }
        const lista = document.querySelector(`.nav-hijos[data-nav-hijos="${idSeccion}"]`);
        if (lista) lista.hidden = !abierto;
        return abierto;
      },

      /* Ejecuta la acción de una subsección tras abrir su sección padre.
         Las acciones sensibles vuelven a pedir permiso aquí: el menú solo
         oculta, esta llamada es la que realmente frena. */
      ejecutarHijo(idSeccion, idHijo) {
        const seccion = typeof Secciones === 'undefined' ? null : Secciones.obtener(idSeccion);
        const hijo = seccion ? Secciones.hijoDe(seccion, idHijo) : null;
        if (!hijo || !Secciones.puedeVer(hijo, AuthManager.profile)) return false;
        if (typeof hijo.accion !== 'function') return true;
        try {
          hijo.accion(AuthManager.profile);
        } catch (error) {
          console.error(`Error en la subsección "${idHijo}" de "${idSeccion}":`, error);
          this.showToast('⚠️ No se pudo completar esa acción.');
        }
        return true;
      },

      /* Abre un paso concreto del Cuaderno Docente (los pasos son
         <details class="cuaderno-step">) y lo pone en pantalla. */
      enfocarPasoCuaderno(numero) {
        if (this.currentModule !== 'cuaderno-docente') this.irA('cuaderno-docente');
        setTimeout(() => {
          const pasos = document.querySelectorAll('#workspace .cuaderno-step');
          const paso = pasos[Number(numero) - 1];
          if (!paso) return;
          paso.open = true;
          paso.scrollIntoView({ behavior: 'smooth', block: 'center' });
          paso.classList.add('paso-destacado');
          setTimeout(() => paso.classList.remove('paso-destacado'), 1800);
        }, 220);
      },

      // Contexto de la pantalla de carga: cada tipo de operación tiene su
      // propia ilustración vectorial (data-modo), su etiqueta y su pie.
      // `modo` puede forzarse: 'inicio' | 'subida' | 'exportacion' | 'sesion'.
      contextoCarga(message, modo) {
        const catalogo = {
          inicio: {
            id: 'inicio',
            etiqueta: 'Preparando el panel',
            pie: 'Un momento: estamos preparando tu información'
          },
          subida: {
            id: 'subida',
            etiqueta: 'Subiendo datos',
            pie: 'Subiendo la información a la base compartida: no cierres esta ventana.'
          },
          exportacion: {
            id: 'exportacion',
            etiqueta: 'Exportando archivo',
            pie: 'Armando el archivo con tus datos: en cuanto esté listo lo abrimos.'
          },
          sesion: {
            id: 'sesion',
            etiqueta: 'Verificando acceso',
            pie: 'Validando tu cuenta y tus permisos de docente.'
          }
        };
        const texto = String(message || '').toLowerCase();
        let id = modo;
        if (!id) {
          if (/(excel|pdf|export|generando|imprim|descarg|cuaderno)/.test(texto)) id = 'exportacion';
          else if (/(acceso|sesi[oó]n|credencial|contrase|verificando|cerrando)/.test(texto)) id = 'sesion';
          else if (/(subi|sincroniz|guardand|listado|import|procesand|base compartida|migrar|db\.json)/.test(texto)) id = 'subida';
          else id = 'inicio';
        }
        return catalogo[id] || catalogo.inicio;
      },

      // Actualiza el texto de la pantalla de carga YA ABIERTA, sin repetir
      // la entrada en cascada: sirve para avisar la segunda fase de un
      // proceso («leyendo el archivo» → «subiendo a la base compartida»).
      actualizarCarga(message, modo) {
        const loading = document.getElementById('app-loading');
        if (!loading || loading.classList.contains('is-hidden')) {
          if (message) this.showLoading(message, modo);
          return;
        }
        const contexto = this.contextoCarga(message, modo);
        const texto = document.getElementById('app-loading-message');
        if (texto) texto.textContent = message;
        const pie = document.getElementById('app-loading-caption');
        if (pie) pie.textContent = contexto.pie;
        const etiqueta = document.getElementById('app-loading-eyebrow');
        if (etiqueta) etiqueta.textContent = contexto.etiqueta;
        loading.setAttribute('data-modo', contexto.id);
      },

      showLoading(message, modo) {
        const loading = document.getElementById('app-loading');
        const loadingMessage = document.getElementById('app-loading-message');
        const loadingCaption = document.getElementById('app-loading-caption');
        if (!loading) return;
        const contexto = this.contextoCarga(message, modo);
        clearTimeout(this.loadingTimer);
        clearTimeout(this.contentTimer);
        this.loadingStartedAt = performance.now();
        loading.classList.remove('is-hidden', 'has-error');
        loading.setAttribute('data-modo', contexto.id);
        loading.setAttribute('role', 'status');
        loading.setAttribute('aria-hidden', 'false');
        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingCaption) loadingCaption.textContent = contexto.pie;
        const etiqueta = document.getElementById('app-loading-eyebrow');
        if (etiqueta) etiqueta.textContent = contexto.etiqueta;
        document.getElementById('app-loading-retry-wrap')?.setAttribute('hidden', '');
        this.reproducirEntradaCarga(loading);
        const workspace = document.getElementById('workspace');
        workspace?.classList.remove('content-ready');
        workspace?.setAttribute('aria-busy', 'true');
      },

      // [OPT] Antes cada navegación esperaba 900 ms + 240 ms de relleno,
      // lo que hacía sentir lenta incluso cuando el render era instantáneo.
      hideLoading(minimumDuration = 380) {
        const loading = document.getElementById('app-loading');
        if (!loading) return;
        clearTimeout(this.loadingTimer);
        const elapsed = performance.now() - this.loadingStartedAt;
        const delay = Math.max(0, minimumDuration - elapsed);
        this.loadingTimer = setTimeout(() => {
          loading.classList.add('is-hidden');
          loading.setAttribute('aria-hidden', 'true');
          const workspace = document.getElementById('workspace');
          workspace?.removeAttribute('aria-busy');
          this.contentTimer = setTimeout(() => workspace?.classList.add('content-ready'), 140);
        }, delay);
      },

      showLoadingError(message, detalle) {
        const loading = document.getElementById('app-loading');
        const loadingMessage = document.getElementById('app-loading-message');
        const loadingCaption = document.getElementById('app-loading-caption');
        const reintentar = document.getElementById('app-loading-retry-wrap');
        if (!loading) return;
        clearTimeout(this.loadingTimer);
        clearTimeout(this.contentTimer);
        loading.classList.remove('is-hidden');
        loading.classList.add('has-error');
        loading.setAttribute('role', 'alert');
        loading.setAttribute('aria-hidden', 'false');
        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingCaption) {
          // El detalle técnico se muestra junto al consejo: si algo vuelve a
          // fallar se puede leer directamente en pantalla sin abrir la consola.
          loadingCaption.textContent = detalle
            ? `Verifica la conexión o recarga la página para reintentar. Detalle: ${detalle}`
            : 'Verifica la conexión o recarga la página para reintentar.';
        }
        if (reintentar) reintentar.removeAttribute('hidden');
        this.reproducirEntradaCarga(loading);
        document.getElementById('workspace')?.removeAttribute('aria-busy');
      },

      // Reintenta pintar la sección que falló sin recargar toda la página.
      reintentarSeccion() {
        document.getElementById('app-loading-retry-wrap')?.setAttribute('hidden', '');
        this.renderCurrentModule();
      },

      /* Reinicia la entrada escalonada de la pantalla de carga
         (marca, hoja, titular y pasos entran en cascada). */
      reproducirEntradaCarga(loading) {
        if (!loading) return;
        loading.classList.remove('is-entering');
        void loading.offsetWidth;
        loading.classList.add('is-entering');
      },

      /* ── Tema claro / oscuro (identidad INATEC) ──
         El modo claro es el oficial; el oscuro es opcional y se guarda
         en localStorage bajo la clave 'tic-theme'. */
      getTheme() {
        try { return localStorage.getItem('tic-theme') === 'dark' ? 'dark' : 'light'; }
        catch (e) { return 'light'; }
      },

      applyTheme(theme) {
        const t = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', t);
        try { localStorage.setItem('tic-theme', t); } catch (e) {}
        this.syncThemeIcon();
      },

      toggleTheme() {
        this.applyTheme(this.getTheme() === 'dark' ? 'light' : 'dark');
      },

      syncThemeIcon() {
        const btn = document.getElementById('btn-toggle-theme');
        if (!btn) return;
        const icon = btn.querySelector('i');
        if (icon) icon.className = this.getTheme() === 'dark' ? 'ri-sun-line' : 'ri-moon-clear-line';
      },

        // Dentro del objeto UI, agrega estas funciones:

initBuscadorGlobal() {
  const input = document.getElementById('global-search');
  if (!input) return;

  // [CORREGIDO] El dropdown ahora vive en <body> con position:fixed y su
  // posición se calcula con getBoundingClientRect(). Antes dependía de
  // position:absolute dentro de .search-box, lo que lo hacía vulnerable a
  // cualquier overflow/clip/stacking-context de un contenedor padre (por
  // eso "no funcionaba" en la práctica: se renderizaba pero quedaba
  // recortado o detrás de otros elementos). Con position:fixed en <body>
  // siempre es visible, sin importar el layout de la topbar.
  let dropdown = document.getElementById('search-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'search-dropdown';
    dropdown.style.cssText = `
      position: fixed;
      background: var(--bg-card);
      border: 1px solid var(--border-default);
      border-radius: var(--r-lg);
      box-shadow: var(--shadow-xl);
      max-height: 400px;
      overflow-y: auto;
      z-index: 9999;
      display: none;
      margin-top: 8px;
      padding: var(--s-2);
    `;
    document.body.appendChild(dropdown);
  }

  const posicionarDropdown = () => {
    const rect = input.closest('.search-box')?.getBoundingClientRect() || input.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${rect.width}px`;
  };

  const cerrarDropdown = () => { dropdown.style.display = 'none'; };

  let timerBusqueda = null;
  input.addEventListener('input', (e) => {
    const valor = e.target.value || '';
    const query = CuadernoEngine.normalizarTexto(valor);
    if (query.length < 2) { clearTimeout(timerBusqueda); cerrarDropdown(); return; }

    // [OPT] Se espera 120 ms a que el usuario termine de escribir. Antes
    // cada tecla recorría y normalizaba toda la base (grupos, estudiantes
    // y equipos) y repintaba el desplegable de inmediato.
    clearTimeout(timerBusqueda);
    timerBusqueda = setTimeout(() => {
      timerBusqueda = null;
      try {
        const resultados = this.buscarGlobal(query);
        this.renderResultadosBusqueda(resultados, dropdown, query);

        posicionarDropdown();
        dropdown.style.display = 'block';
      } catch (err) {
        // [NUEVO] Red de seguridad: un error inesperado ya no deja el
        // buscador "muerto" para el resto de la sesión.
        console.error('Error en buscador global:', err);
        cerrarDropdown();
      }
    }, 120);
  });

  // Reposicionar si la ventana cambia de tamaño o se hace scroll
  window.addEventListener('resize', () => { if (dropdown.style.display === 'block') posicionarDropdown(); });
  window.addEventListener('scroll', () => { if (dropdown.style.display === 'block') posicionarDropdown(); }, true);

  // Cerrar al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) cerrarDropdown();
  });

  // Cerrar con Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { cerrarDropdown(); input.blur(); }
  });
},

buscarGlobal(query) {
  const resultados = [];
  const limite = 15; // Máximo 15 resultados
  // [OPT] normalizarTexto() corre dos expresiones regulares y una
  // normalización Unicode por cada texto; con cientos de estudiantes eso
  // se repetía en cada tecla. Ahora se memoiza por texto original (es una
  // función pura, así que el resultado nunca queda obsoleto).
  const norm = texto => this.normalizarParaBusqueda(texto);
  const grupos = DataEngine.getGrupos();

  // Buscar grupos
  for (const g of grupos) {
    if (norm(g.nombre).includes(query) ||
        norm(g.carrera || '').includes(query) ||
        norm(g.turno || '').includes(query)) {
      resultados.push({
        tipo: 'grupo',
        titulo: g.nombre,
        subtitulo: `${g.carrera} • ${g.turno}`,
        id: g.id,
        icono: 'ri-team-line',
        color: 'var(--primary-blue, #14578b)'
      });
      if (resultados.length >= limite) return resultados;
    }
  }

  // Buscar estudiantes
  for (const g of grupos) {
    for (const est of (g.estudiantes || [])) {
      if (norm(est.nombres).includes(query) ||
          norm(est.apellidos).includes(query) ||
          norm(est.correo).includes(query) ||
          norm(`${est.nombres} ${est.apellidos}`).includes(query)) {
        resultados.push({
          tipo: 'estudiante',
          titulo: `${est.nombres} ${est.apellidos}`,
          subtitulo: `${g.nombre} • ${est.correo}`,
          id: est.id,
          grupoId: g.id,
          icono: est.estado === 'Retirado' ? 'ri-user-unfollow-line' : 'ri-user-line',
          color: est.estado === 'Retirado' ? '#ef4444' : '#10b981'
        });
        if (resultados.length >= limite) return resultados;
      }
    }
  }

  // Buscar equipos Innovatec / Hackathon
  for (const eq of (DataEngine.getEquipos ? DataEngine.getEquipos() : [])) {
    const coincideEquipo = norm(eq.nombreEquipo || '').includes(query) ||
      norm(eq.nombreProyecto || '').includes(query) ||
      norm(eq.categoria || '').includes(query);
    const coincideIntegrante = (eq.integrantes || []).some(i =>
      norm(`${i.nombres} ${i.apellidos}`).includes(query) ||
      norm(i.correo || '').includes(query)
    );
    if (coincideEquipo || coincideIntegrante) {
      resultados.push({
        tipo: 'equipo',
        titulo: eq.nombreEquipo,
        subtitulo: `${eq.categoria} • ${eq.nombreProyecto}`,
        id: eq.id,
        icono: 'ri-trophy-line',
        color: eq.categoria === 'Hackathon' ? 'var(--neon-purple, #e10b7b)' : 'var(--neon-cyan, #01a5e4)'
      });
      if (resultados.length >= limite) return resultados;
    }
  }

  return resultados;
},

normalizarParaBusqueda(texto) {
  const clave = typeof texto === 'string' ? texto
    : (texto === null || texto === undefined ? '' : String(texto));
  let cache = this._cacheBusqueda;
  if (!cache) { cache = new Map(); this._cacheBusqueda = cache; }
  else if (cache.size > 8000) cache.clear();
  if (cache.has(clave)) return cache.get(clave);
  const normalizado = CuadernoEngine.normalizarTexto(clave);
  cache.set(clave, normalizado);
  return normalizado;
},

renderResultadosBusqueda(resultados, dropdown, query) {
  if (resultados.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        <i class="ri-search-line" style="display: block; font-size: 1.75rem; margin-bottom: 8px; opacity: 0.4;"></i>
        No se encontraron resultados
      </div>
    `;
    return;
  }

  dropdown.innerHTML = resultados.map(r => `
    <div onclick="UI.navegarDesdeBusqueda('${r.tipo}', '${r.id}', '${r.grupoId || ''}')" 
         style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; 
                border-radius: var(--r-md); transition: background var(--t-fast); margin-bottom: 2px;"
         onmouseover="this.style.background='var(--bg-hover, #f8fafc)'" 
         onmouseout="this.style.background='transparent'">
      <div style="width: 36px; height: 36px; border-radius: var(--r-md); background: ${r.color}15; 
                  display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <i class="${r.icono}" style="color: ${r.color}; font-size: 1.1rem;"></i>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${this.resaltarCoincidencia(r.titulo, query)}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${r.subtitulo}
        </div>
      </div>
      <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; 
                   color: var(--text-muted); background: var(--bg-hover); padding: 3px 10px; border-radius: var(--r-sm);">
        ${r.tipo}
      </span>
    </div>
  `).join('');
},

resaltarCoincidencia(texto, query) {
  // [CORREGIDO] La clase de caracteres del escape estaba mal cerrada
  // (dejaba "(" ")" "[" etc. sin escapar). Cualquier búsqueda con esos
  // caracteres —muy comunes al escribir nombres de grupos como
  // "Bachillerato (INATEC)"— producía un RegExp inválido, lanzaba una
  // excepción no controlada dentro del listener de "input" y el
  // buscador dejaba de responder para el resto de la sesión.
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return texto.replace(regex, '<mark style="background: rgba(20,87,139,0.2); color: inherit; border-radius: 2px; padding: 0 2px;">$1</mark>');
},

navegarDesdeBusqueda(tipo, id, grupoId) {
  document.getElementById('search-dropdown').style.display = 'none';
  document.getElementById('global-search').value = '';

  if (tipo === 'grupo') {
    this.irA('grupos');
    // [CORREGIDO] `:contains()` no es un selector CSS válido y lanzaba una
    // excepción silenciosa; ahora se usa un atributo data-grupo-id real.
    setTimeout(() => {
      const details = document.querySelector(`details[data-grupo-id="${id}"]`);
      if (details) { details.open = true; details.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 120);
  } else if (tipo === 'equipo') {
    this.irA('equipos');
    setTimeout(() => {
      const details = document.querySelector(`details[data-equipo-id="${id}"]`);
      if (details) { details.open = true; details.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 120);
  } else {
    // Estudiante: ir a estudiantes o al grupo del estudiante
    this.irA('estudiantes');
    setTimeout(() => {
      const fila = document.querySelector(`tr[data-est-id="${id}"]`);
      if (fila) {
        fila.style.background = 'rgba(20,87,139,0.18)';
        fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => fila.style.background = '', 2000);
      }
    }, 120);
  }
},

actualizarNavActivo(modulo) {
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.remove('active');
    i.removeAttribute('aria-current');
  });
  const nav = document.querySelector(`.nav-item[data-module="${modulo}"]`);
  if (nav) {
    nav.classList.add('active');
    nav.setAttribute('aria-current', 'page');
  }
},

      mountSectionSettings() {
        const workspace = document.getElementById('workspace');
        const sidebar = document.getElementById('section-settings-sidebar');
        const content = document.getElementById('section-settings-content');
        if (!workspace || !sidebar || !content) return;

        const focusedId = sidebar.classList.contains('open') && sidebar.contains(document.activeElement)
          ? document.activeElement.id
          : '';
        content.replaceChildren();
        const settingsBlocks = workspace.querySelectorAll('[data-section-settings]');

        const viewHeader = workspace.querySelector('.view-header');
        // Sin encabezado no hay dónde apoyar el botón «Opciones».
        if (!viewHeader) { sidebar.hidden = true; return; }
        let toggle = viewHeader.querySelector('.section-settings-toggle');
        if (!toggle) {
          toggle = document.createElement('button');
          toggle.id = 'btn-toggle-section-settings';
          toggle.className = 'btn-primary-soft section-settings-toggle';
          toggle.type = 'button';
          toggle.title = 'Abrir filtros y ajustes de esta sección';
          toggle.setAttribute('aria-label', toggle.title);
          toggle.setAttribute('aria-controls', 'section-settings-sidebar');
          toggle.innerHTML = '<i class="ri-equalizer-2-line" aria-hidden="true"></i><span>Opciones</span>';
          viewHeader.appendChild(toggle);
        }
        toggle.setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');

        viewHeader.classList.add('has-section-settings');
        const heading = viewHeader.querySelector('h1');
        if (heading) {
          let headingGroup = heading.parentElement;
          if (headingGroup === viewHeader) {
            headingGroup = document.createElement('div');
            headingGroup.className = 'section-heading-copy';
            viewHeader.prepend(headingGroup);
            headingGroup.appendChild(heading);
            const description = Array.from(viewHeader.children).find(child => child.tagName === 'P');
            if (description) headingGroup.appendChild(description);
          } else {
            headingGroup.classList.add('section-heading-copy');
          }

          // Antetítulo con el grupo de la sección: las cabeceras de
          // Administración y Mi perfil ya llevan el suyo propio.
          if (!viewHeader.querySelector('.view-eyebrow')) {
            const seccion = typeof Secciones !== 'undefined' ? Secciones.obtener(this.currentModule) : null;
            const grupo = seccion && seccion.grupo ? String(seccion.grupo).trim() : '';
            if (grupo) {
              const antetitulo = document.createElement('p');
              antetitulo.className = 'view-eyebrow';
              antetitulo.textContent = grupo;
              headingGroup.insertBefore(antetitulo, heading);
            }
          }
        }

        // Preferencias del equipo: están en TODAS las secciones (antes el
        // panel no se abría si la vista no tenía filtros propios).
        content.appendChild(this.bloqueAjustesGlobales());
        this.vincularAjustesGlobales();

        settingsBlocks.forEach(block => {
          const group = document.createElement('section');
          group.className = 'section-settings-group';
          if (block.dataset.settingsTitle) {
            const heading = document.createElement('h3');
            heading.textContent = block.dataset.settingsTitle;
            group.appendChild(heading);
          }
          block.classList.add('section-settings-block');
          group.appendChild(block);
          content.appendChild(group);
        });

        if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
        sidebar.hidden = false;
      },

      /* Bloque fijo del panel «Opciones» con las preferencias que
         dependen de ESTE equipo (no se sincronizan con los compañeros):
         animaciones, tamaño del menú y tema. */
      bloqueAjustesGlobales() {
        const grupo = document.createElement('section');
        grupo.className = 'section-settings-group';
        const movimiento = typeof Ajustes !== 'undefined' && Ajustes ? Ajustes.movimiento() : 'auto';
        const menu = typeof Ajustes !== 'undefined' && Ajustes ? Ajustes.menu() : 'expandido';
        const temaOscuro = this.getTheme() === 'dark';
        grupo.innerHTML = `
          <h3>Preferencias de este equipo</h3>
          <div class="section-settings-block ajuste-global">
            <label for="ajuste-movimiento"><i class="ri-sparkling-line" aria-hidden="true"></i> Animaciones</label>
            <select id="ajuste-movimiento" class="form-control">
              <option value="auto"${movimiento === 'auto' ? ' selected' : ''}>Seguir el sistema</option>
              <option value="on"${movimiento === 'on' ? ' selected' : ''}>Activadas</option>
              <option value="off"${movimiento === 'off' ? ' selected' : ''}>Desactivadas</option>
            </select>
            <p class="ajuste-nota" id="nota-ajuste-movimiento">${this.notaMovimiento(movimiento)}</p>
          </div>
          <div class="section-settings-block ajuste-global">
            <label for="ajuste-menu"><i class="ri-menu-line" aria-hidden="true"></i> Menú lateral</label>
            <select id="ajuste-menu" class="form-control">
              <option value="expandido"${menu === 'expandido' ? ' selected' : ''}>Con etiquetas</option>
              <option value="iconos"${menu === 'iconos' ? ' selected' : ''}>Solo iconos</option>
            </select>
            <p class="ajuste-nota">Se guarda en este equipo y lo mantiene igual al redimensionar.</p>
          </div>
          <div class="section-settings-block ajuste-global">
            <label for="ajuste-tema"><i class="ri-contrast-line" aria-hidden="true"></i> Tema</label>
            <select id="ajuste-tema" class="form-control">
              <option value="light"${temaOscuro ? '' : ' selected'}>Claro (oficial)</option>
              <option value="dark"${temaOscuro ? ' selected' : ''}>Oscuro</option>
            </select>
            <p class="ajuste-nota">El modo claro es el oficial del panel; el oscuro es opcional.</p>
          </div>`;
        return grupo;
      },

      notaMovimiento(valor) {
        if (typeof Ajustes !== 'undefined' && Ajustes && typeof Ajustes.notaMovimiento === 'function') {
          return Ajustes.notaMovimiento(valor);
        }
        return '';
      },

      /* Deja los tres selectores de arriba conectados con Ajustes/UI. */
      vincularAjustesGlobales() {
        const mov = document.getElementById('ajuste-movimiento');
        if (mov) mov.addEventListener('change', () => {
          if (typeof Ajustes === 'undefined' || !Ajustes) return;
          const aplicado = Ajustes.ponerMovimiento(mov.value);
          const nota = document.getElementById('nota-ajuste-movimiento');
          if (nota) nota.textContent = Ajustes.notaMovimiento(aplicado);
          this.showToast(aplicado === 'on'
            ? '✨ Animaciones activadas en este equipo.'
            : aplicado === 'off'
              ? 'Animaciones desactivadas en este equipo.'
              : 'El panel sigue ahora la configuración de animaciones del sistema.');
        });

        const menu = document.getElementById('ajuste-menu');
        if (menu) menu.addEventListener('change', () => {
          if (typeof Ajustes === 'undefined' || !Ajustes) return;
          Ajustes.ponerMenu(menu.value);
          this.aplicarMenuGuardado();
        });

        const tema = document.getElementById('ajuste-tema');
        if (tema) tema.addEventListener('change', () => this.applyTheme(tema.value));
      },

      toggleSectionSettings() {
        const sidebar = document.getElementById('section-settings-sidebar');
        const backdrop = document.getElementById('section-settings-backdrop');
        const toggle = document.getElementById('btn-toggle-section-settings');
        if (!sidebar || !backdrop || !toggle || toggle.hidden) return;

        if (sidebar.classList.contains('open')) {
          this.closeSectionSettings();
          return;
        }

        sidebar.hidden = false;
        sidebar.removeAttribute('inert');
        sidebar.setAttribute('aria-hidden', 'false');
        sidebar.classList.add('open');
        backdrop.classList.add('show');
        toggle.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => document.getElementById('btn-close-section-settings')?.focus());
      },

      closeSectionSettings(returnFocus = true) {
        const sidebar = document.getElementById('section-settings-sidebar');
        const backdrop = document.getElementById('section-settings-backdrop');
        const toggle = document.getElementById('btn-toggle-section-settings');
        if (!sidebar || !backdrop) return;

        const wasOpen = sidebar.classList.contains('open');
        sidebar.classList.remove('open');
        sidebar.setAttribute('aria-hidden', 'true');
        sidebar.setAttribute('inert', '');
        backdrop.classList.remove('show');
        toggle?.setAttribute('aria-expanded', 'false');
        if (returnFocus && wasOpen) toggle?.focus();
      },

      bindEvents() {
        // Un solo listener para todo el menú: los enlaces los genera el
        // registro de secciones, así que las secciones nuevas (o las que
        // aparecen tras cambiar de perfil) se enlazan solas.
        const sidebarNav = document.getElementById('sidebar-nav');
        if (sidebarNav) {
          sidebarNav.addEventListener('click', (event) => {
            const destino = event.target;
            if (!destino || !destino.closest) return;

            // 1 · Encabezado de grupo: pliega/despliega su lista.
            const grupo = destino.closest('.nav-grupo');
            if (grupo) {
              event.preventDefault();
              const nombre = grupo.getAttribute('data-nav-grupo');
              const abierto = typeof Secciones !== 'undefined' ? Secciones.alternarGrupo(nombre) : true;
              grupo.setAttribute('aria-expanded', String(abierto));
              grupo.setAttribute('title', `${abierto ? 'Plegar' : 'Desplegar'} ${nombre}`);
              const lista = grupo.nextElementSibling;
              if (lista && lista.classList.contains('nav-grupo-items')) lista.hidden = !abierto;
              return;
            }

            // 2 · Flecha de una sección con subsecciones: solo pliega.
            const flecha = destino.closest('.nav-chevron');
            if (flecha) {
              event.preventDefault();
              this.alternarHijos(flecha.getAttribute('data-nav-toggle'));
              return;
            }

            const item = destino.closest('.nav-item');
            if (!item || !item.getAttribute('data-module')) return;
            event.preventDefault();
            const idHijo = item.getAttribute('data-hijo');
            this.closeSectionSettings(false);
            if (idHijo) {
              // Subsección: abre la sección padre y lanza su acción.
              this.irA(item.getAttribute('data-module'));
              this.ejecutarHijo(item.getAttribute('data-module'), idHijo);
              return;
            }
            this.currentModule = item.getAttribute('data-module');
            this.actualizarNavActivo(this.currentModule);
            this.renderCurrentModule();
            // En móvil el menú se cierra tras navegar
            if (this.isMobileLayout()) this.closeSidebar();
            document.querySelector('.workspace')?.scrollTo({ top: 0, behavior: 'smooth' });
          });
        }
        const toggleBtn = document.getElementById('btn-toggle-sidebar');
        if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('workspace')?.addEventListener('click', (event) => {
          if (event.target.closest('.section-settings-toggle')) this.toggleSectionSettings();
        });
        document.getElementById('btn-close-section-settings')?.addEventListener('click', () => this.closeSectionSettings());
        document.getElementById('section-settings-backdrop')?.addEventListener('click', () => this.closeSectionSettings());

        // Esc / cambio de tamaño cierran el cajón móvil
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            this.closeSidebar();
            this.closeSectionSettings();
            return;
          }
          const settingsPanel = document.getElementById('section-settings-sidebar');
          if (e.key === 'Tab' && settingsPanel?.classList.contains('open')) {
            const focusable = Array.from(settingsPanel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
              .filter(element => element.getClientRects().length > 0);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first) return;
            if (!settingsPanel.contains(document.activeElement) || (e.shiftKey && document.activeElement === first)) {
              e.preventDefault();
              (e.shiftKey ? last : first).focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        });
        window.addEventListener('resize', () => {
          if (this.isMobileLayout()) return;
          const sidebar = document.getElementById('sidebar');
          if (sidebar && sidebar.classList.contains('open')) this.closeSidebar();
          // El tamaño del menú no cambia con un resize: solo se vuelve a
          // aplicar la preferencia guardada (por si cambió el dispositivo).
          this.aplicarMenuGuardado();
        });

        // Glosarias ⓘ y chips de filtros: un solo escuchador a nivel de
        // documento porque el contenido se repinta con cada cambio de filtro.
        document.addEventListener('click', (event) => {
          const destino = event.target;
          if (!destino || !destino.closest) return;

          const botonAyuda = destino.closest('.ayuda-btn');
          if (botonAyuda) {
            event.preventDefault();
            this.alternarAyuda(botonAyuda);
            return;
          }

          const quitar = destino.closest('[data-quitar-filtro]');
          if (quitar) {
            this.quitarFiltro(quitar.getAttribute('data-vista-filtro') || this.currentModule,
              quitar.getAttribute('data-quitar-filtro'));
            return;
          }

          const limpiar = destino.closest('[data-limpiar-filtros]');
          if (limpiar) {
            this.limpiarFiltros(limpiar.getAttribute('data-vista-filtro') || this.currentModule);
            return;
          }

          // Clic fuera: se cierra la glosa que estuviera abierta.
          if (destino.closest('.metrica-ayuda')) return;
          this.cerrarAyudas(null);
        });

        // Atrás/adelante del navegador o edición manual de la URL:
        // la vista y sus filtros vuelven al estado del enlace.
        if (typeof window.addEventListener === 'function') {
          const escucharRuta = () => this.aplicarRuta(true);
          window.addEventListener('popstate', escucharRuta);
          window.addEventListener('hashchange', escucharRuta);
        }
      },

      abrirModalConvalidaciones() {
        DataEngine.abrirModalConvalidaciones();
      },

      abrirModalConfigExport() {
        ConfigExport.poblarFormulario();
        const modal = document.getElementById('modal-config-export');
        if (modal) { modal.classList.remove('hidden'); modal.style.display = 'flex'; }
      },

      cerrarModalConfigExport() {
        const modal = document.getElementById('modal-config-export');
        if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
      },

      cerrarModalConvalidaciones() {
        const modal = document.getElementById('modal-convalidaciones');
        if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
      },

      actualizarTablaCuaderno() {
        const contenedor = document.getElementById('contenedor-tabla-cuaderno');
        const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
        const moduloFiltro = document.getElementById('select-modulo-cuaderno')?.value || 'ALL';
        if (!contenedor) return;

        if (!grupoId) {
          contenedor.innerHTML = `<div class="table-container" style="padding: 40px; text-align: center; color: var(--text-muted);"><p>Selecciona un grupo para visualizar o cargar las calificaciones.</p></div>`;
          return;
        }

        const grupo = DataEngine.getGrupoById(grupoId);
        const estudiantes = DataEngine.getEstudiantesByGrupo(grupoId);
        if (estudiantes.length === 0) {
          contenedor.innerHTML = `<div class="table-container" style="padding: 40px; text-align: center; color: var(--text-muted);"><p>El grupo seleccionado no tiene estudiantes registrados.</p></div>`;
          return;
        }

        if (moduloFiltro === 'ALL') {
          let html = `<div class="table-container" style="overflow-x: auto;"><table class="custom-table"><thead><tr><th style="width: 50px;">No.</th><th>Estudiante</th>${MODULOS_TRANSVERSALES.map(m => `<th>${m}</th>`).join('')}</tr></thead><tbody>`;
          estudiantes.forEach((e, idx) => {
            html += `<tr><td>${idx + 1}</td><td><strong>${e.nombres} ${e.apellidos}</strong></td>`;
            MODULOS_TRANSVERSALES.forEach(m => {
              let notaFinal = 'S/N';
              if (e.retirado || e.estado === 'Retirado') notaFinal = 'Retirado';
              else if (e.convalidaciones && e.convalidaciones[m]) notaFinal = 'Convalidado';
              else {
                const modData = e.evaluacionesPorModulo ? e.evaluacionesPorModulo[m] : null;
                if (modData) {
                  const notasObj = modData.notas || modData.evaluaciones;
                  if (notasObj) {
                    const valores = Object.values(notasObj).filter(v => typeof v === 'number');
                    if (valores.length > 0) notaFinal = Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
                  }
                }
              }
              const badgeClass = typeof notaFinal === 'number' && notaFinal >= 60 ? 'activo' : '';
              html += `<td><span class="badge-status ${badgeClass}">${notaFinal}</span></td>`;
            });
            html += `</tr>`;
          });
          html += `</tbody></table></div>`;
          contenedor.innerHTML = html;
          return;
        }

        const configModulo = grupo?.estructuraModulos ? grupo.estructuraModulos[moduloFiltro] : null;
        let columnasOrdenadas = configModulo?.columnasOrdenadas || [];
        if (columnasOrdenadas.length === 0) {
          const colMap = new Map();
          estudiantes.forEach(s => {
            const mData = s.evaluacionesPorModulo ? s.evaluacionesPorModulo[moduloFiltro] : null;
            if (mData) {
              const fuente = mData.notas || mData.evaluaciones || {};
              Object.keys(fuente).forEach(k => { if (!colMap.has(k)) colMap.set(k, { nombreDisplay: k, esTotal: CuadernoEngine.normalizarTexto(k).includes("total") }); });
            }
          });
          columnasOrdenadas = Array.from(colMap.values());
        }

        if (columnasOrdenadas.length === 0) {
          contenedor.innerHTML = `<div class="table-container" style="padding: 40px; text-align: center; color: var(--text-muted);"><i class="ri-information-line" style="font-size: 2.5rem; display: block; margin-bottom: 8px;"></i><p>No se han importado calificaciones para el módulo: <strong>${moduloFiltro}</strong>.</p><small>Selecciona este módulo e importa su archivo Excel correspondiente.</small></div>`;
          return;
        }

        let html = `<div class="table-container" style="overflow-x: auto;"><table class="custom-table"><thead><tr><th style="width: 40px;">No.</th><th style="min-width: 200px;">Estudiante</th>${columnasOrdenadas.map(col => `<th style="${col.esTotal ? 'background-color: var(--primary-soft, #f0fdf4); font-weight: bold;' : 'font-size: 0.78rem;'}"><span style="display:flex; align-items:center; justify-content:center; gap:6px;"><span>${col.nombreDisplay.length > 28 ? col.nombreDisplay.substring(0, 28) + '...' : col.nombreDisplay}</span><i class="ri-close-circle-line" title="Eliminar esta columna" style="cursor:pointer; color:#dc2626; flex-shrink:0;" onclick="DataEngine.eliminarColumnaModulo('${moduloFiltro.replace(/'/g, "\\'")}', '${col.nombreDisplay.replace(/'/g, "\\'")}')"></i></span></th>`).join('')}</tr></thead><tbody>`;
        estudiantes.forEach((e, idx) => {
          html += `<tr><td>${idx + 1}</td><td><strong>${e.nombres} ${e.apellidos}</strong></td>`;
          columnasOrdenadas.forEach(col => {
            let nota = CuadernoEngine.obtenerNotaEstudiante(e, moduloFiltro, col.nombreDisplay);
            if (e.retirado || e.estado === 'Retirado') nota = 'Retirado';
            else if (e.convalidaciones && e.convalidaciones[moduloFiltro]) nota = 'Convalidado';
            const esNum = typeof nota === 'number';
            html += `<td style="text-align: center; ${col.esTotal ? 'background-color: var(--primary-soft, #f0fdf4);' : ''}">${col.esTotal ? `<span class="badge-status ${esNum && nota >= 60 ? 'activo' : ''}">${nota}</span>` : (esNum ? `<strong>${nota}</strong>` : nota)}</td>`;
          });
          html += `</tr>`;
        });
        html += `</tbody></table></div>`;
        contenedor.innerHTML = html;
      },

      // En escritorio colapsa el menú a iconos; en móvil/tablet lo abre
      // como cajón con fondo oscurecido (abrir / cerrar).
      isMobileLayout() {
        return window.matchMedia('(max-width: 1024px)').matches;
      },

      toggleSidebar() {
        if (this.isMobileLayout()) {
          const sidebar = document.getElementById('sidebar');
          if (sidebar && sidebar.classList.contains('open')) this.closeSidebar();
          else this.openSidebar();
          return;
        }
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
          const expanded = sidebar.classList.toggle('expanded');
          sidebar.classList.remove('collapsed');
          if (typeof Ajustes !== 'undefined' && Ajustes) Ajustes.ponerMenu(expanded ? 'expandido' : 'iconos');
        }
        this.sincronizarEstadoMenu();
      },

      openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('show');
        this.sincronizarEstadoMenu();
      },

      closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
        // [CONSISTENCIA] Antes aquí se borraba "expanded"/"collapsed", así que
        // cualquier resize (rotar la tablet, abrir las herramientas de
        // desarrollo, cambiar el zoom) devolvía el menú a iconos y cada
        // equipo se quedaba con un aspecto distinto. Ahora el tamaño del
        // menú en escritorio solo lo decide la persona con el botón.
        this.sincronizarEstadoMenu();
      },

      /* Estado guardado del menú (igual en todos los equipos salvo que
         cada uno lo cambie a mano). */
      aplicarMenuGuardado() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && typeof Ajustes !== 'undefined' && Ajustes) {
          if (Ajustes.menu() === 'iconos') {
            sidebar.classList.add('collapsed');
            sidebar.classList.remove('expanded');
          } else {
            sidebar.classList.add('expanded');
            sidebar.classList.remove('collapsed');
          }
        }
        this.sincronizarEstadoMenu();
      },

      /* Deja el botón del menú de acuerdo con el estado real: en móvil
         refleja el cajón (open) y en escritorio la clase expanded. */
      sincronizarEstadoMenu() {
        const sidebar = document.getElementById('sidebar');
        const icono = document.querySelector('#btn-toggle-sidebar i');
        const boton = document.getElementById('btn-toggle-sidebar');
        const movil = this.isMobileLayout();
        const abierto = movil
          ? Boolean(sidebar && sidebar.classList.contains('open'))
          : Boolean(sidebar && sidebar.classList.contains('expanded'));
        if (icono) {
          icono.className = movil
            ? (abierto ? 'ri-close-line' : 'ri-menu-fold-line')
            : (abierto ? 'ri-menu-fold-line' : 'ri-menu-unfold-line');
        }
        if (!boton) return;
        boton.setAttribute('aria-expanded', String(abierto));
        boton.title = movil
          ? (abierto ? 'Cerrar navegación' : 'Mostrar navegación')
          : (abierto ? 'Contraer navegación' : 'Expandir navegación');
        boton.setAttribute('aria-label', boton.title);
      },

      async deleteStudent(groupId, studentId) {
        if (!confirm("¿Estás seguro de que deseas eliminar a este estudiante del grupo?")) return;
        const group = DataEngine.db.grupos.find(g => g.id === groupId);
        if (group) {
          const previousStudents = group.estudiantes;
          group.estudiantes = group.estudiantes.filter(s => s.id !== studentId);
          try {
            await DataEngine.save();
            this.showToast("Estudiante eliminado correctamente.");
            if (typeof Mejoras !== 'undefined' && Mejoras.registrarEvento) {
              const borrado = previousStudents.find(s => s.id === studentId) || {};
              const nombreBorrado = `${borrado.nombres || ''} ${borrado.apellidos || ''}`.trim();
              Mejoras.registrarEvento({
                tipo: 'cambio', titulo: 'Estudiante eliminado',
                texto: nombreBorrado ? `${nombreBorrado} se quitó del grupo.` : 'Registro de estudiante eliminado.',
                afectado: nombreBorrado || null,
                detalle: `Grupo: ${group.nombre || groupId}`,
                seccion: 'estudiantes', clave: `est-elim-${studentId}`
              });
            }
            this.renderCurrentModule();
          } catch (error) {
            const currentGroup = DataEngine.getGrupoById(groupId);
            if (currentGroup === group) group.estudiantes = previousStudents;
            console.error('No se pudo eliminar el estudiante:', error);
            this.showToast(`No se pudo eliminar el estudiante: ${error.message}`, 'error');
          }
        }
      },

      async deleteGroup(groupId) {
        const group = DataEngine.db.grupos.find(g => g.id === groupId);
        if (!group) return;
        if (!confirm(`¿Estás seguro de eliminar el grupo "${group.nombre}"? Se perderán sus ${group.estudiantes.length} estudiantes.`)) return;
        const previousGroups = DataEngine.db.grupos;
        DataEngine.db.grupos = DataEngine.db.grupos.filter(g => g.id !== groupId);
        try {
          await DataEngine.save();
          this.showToast(`El grupo ${group.nombre} ha sido eliminado.`);
          this.renderCurrentModule();
        } catch (error) {
          if (!DataEngine.getGrupoById(groupId)) DataEngine.db.grupos = previousGroups;
          console.error('No se pudo eliminar el grupo:', error);
          this.showToast(`No se pudo eliminar el grupo: ${error.message}`, 'error');
        }
      },

      // [NUEVO] Asignar/editar el Docente Guía de un grupo de clase.
      abrirModalDocenteGuia(grupoId) {
        const grupo = DataEngine.getGrupoById(grupoId);
        if (!grupo) return;
        const modal = document.getElementById('modal-docente-guia');
        document.getElementById('docente-guia-grupo-id').value = grupoId;
        document.getElementById('docente-guia-grupo-nombre').textContent = grupo.nombre;
        document.getElementById('docente-guia-nombre').value = grupo.docenteGuia || '';
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      },

      cerrarModalDocenteGuia() {
        const modal = document.getElementById('modal-docente-guia');
        modal.classList.add('hidden');
        modal.style.display = 'none';
      },

      async guardarDocenteGuia(event) {
        event.preventDefault();
        const grupoId = document.getElementById('docente-guia-grupo-id').value;
        const nombre = document.getElementById('docente-guia-nombre').value.trim();
        try {
          await DataEngine.guardarDocenteGuia(grupoId, nombre);
        } catch (error) {
          console.error('No se pudo guardar el docente guía:', error);
          return;
        }
        this.showToast('✅ Docente Guía asignado correctamente.');
        this.cerrarModalDocenteGuia();
        this.renderCurrentModule();
      },

      // [OPT] Agrupa las actualizaciones remotas en un solo render
      // diferido: Firebase emite varios eventos seguidos y antes cada uno
      // reconstruía toda la vista (y encendía la pantalla de carga).
      programarRender(delay = 110) {
        clearTimeout(this._renderTimer);
        this._renderTimer = setTimeout(() => {
          this._renderTimer = null;
          if (!document.getElementById('workspace')?.children.length) return;
          this.renderCurrentModule({ background: true });
        }, delay);
      },

      // options.background: refresco de datos. No muestra la pantalla de
      // carga ni reinicia la animación de entrada del contenido.
      renderCurrentModule(options = {}) {
        const enBackground = Boolean(options && options.background);
        const workspace = document.getElementById('workspace');
        if (!workspace) return;
        const seccion = this.seccionActual();
        const navLabel = seccion ? seccion.etiqueta : '';
        // La URL acompaña a la vista y a sus filtros (#/estadisticas?grupo=…)
        // para poder compartir ese estado exacto o volver atrás con el navegador.
        this.rutaEscribir(this.currentModule, this.filtrosGuardados(this.currentModule));
        if (!enBackground) this.showLoading(`Cargando ${navLabel || 'contenido'}...`);
        try {
          if (seccion) {
            seccion.render(workspace);
            if (typeof seccion.alMostrar === 'function') seccion.alMostrar(workspace);
          } else {
            // Id sin registrar: se pinta un marcador en lugar de romper.
            const etiquetaId = (typeof Secciones !== 'undefined')
              ? Secciones.escapar(this.currentModule)
              : String(this.currentModule);
            workspace.innerHTML = `<div class="module-fade-enter"><h1>Módulo: ${etiquetaId}</h1></div>`;
          }
          this.mountSectionSettings();
          // Oculta lo que el rol no debe ver (una sección nueva solo tiene
          // que declarar data-permiso="claveAccion" en sus botones).
          if (typeof Permisos !== 'undefined' && Permisos) Permisos.aplicar();
          if (enBackground) workspace.classList.add('content-ready');
          else this.hideLoading();
        } catch (error) {
          // El detalle se muestra en la propia pantalla de error: si una
          // sección vuelve a fallar se ve la causa sin abrir la consola.
          const detalle = `${this.currentModule}${error && error.message ? `: ${error.message}` : ''}`;
          this.showLoadingError('No se pudo cargar esta sección. Recarga la página para intentarlo de nuevo.', detalle);
          console.error(`Error al cargar el módulo "${this.currentModule}":`, error);
          throw error;
        }
      },

      // Saludo del panel: depende del usuario conectado y de su centro.
      nombreDocente() {
        try {
          const perfil = (typeof AuthManager !== 'undefined' && (AuthManager.staffProfile || AuthManager.profile)) || {};
          const usuario = (typeof AuthManager !== 'undefined' && AuthManager.user) || {};
          const nombre = [perfil.firstName, perfil.lastName].filter(Boolean).join(' ').trim()
            || String(perfil.displayName || usuario.displayName || '').trim();
          if (nombre) return nombre;
          const correo = String(usuario.email || '').split('@')[0].trim();
          if (correo) return correo;
        } catch (error) {
          console.warn('No se pudo resolver el nombre del docente:', error);
        }
        const enBarra = String(document.getElementById('current-user-name')?.textContent || '').trim();
        return enBarra && enBarra.toLowerCase() !== 'usuario' ? enBarra : 'Docente';
      },

      nombreCentro() {
        try {
          if (typeof AuthManager !== 'undefined' && typeof AuthManager.getActiveCenterName === 'function') {
            const centro = String(AuthManager.getActiveCenterName() || '').trim();
            if (centro) return centro;
          }
        } catch (error) {
          console.warn('No se pudo resolver el centro tecnológico:', error);
        }
        return 'tu centro tecnológico';
      },

      renderDashboardView() {
        const grupos = DataEngine.db.grupos || [];
        const totalGrupos = grupos.length;
        let totalEstudiantes = 0, totalActivos = 0, totalRetirados = 0;
        grupos.forEach(g => {
          if (g.estudiantes && Array.isArray(g.estudiantes)) {
            totalEstudiantes += g.estudiantes.length;
            totalActivos += g.estudiantes.filter(s => s.estado === 'Activo').length;
            totalRetirados += g.estudiantes.filter(s => s.estado === 'Retirado').length;
          }
        });
        const fechaSync = DataEngine.db.lastUpdated ? new Date(DataEngine.db.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        // ── 1 · Barras del gráfico «Alumnos por grupo» ────────────────
        const barras = typeof StatsEngine !== 'undefined'
          ? grupos.map(g => {
              const n = UI.listaEstudiantes(g.estudiantes).length;
              const max = Math.max(...grupos.map(o => UI.listaEstudiantes(o.estudiantes).length), 1);
              const pctMatricula = totalEstudiantes > 0 ? Math.round((n / totalEstudiantes) * 100) : 0;
              return StatsEngine.barraCSS(Math.round((n / max) * 100), n === 0 ? '--text-muted' : '--primary-blue', `${g.nombre} — ${n} alumno(s)`, {
                valor: `${n} al. · ${pctMatricula}%`,
                tip: `${g.nombre} — ${n} alumno(s), ${pctMatricula}% de la matrícula · clic para filtrar Estadísticas`,
                filtro: { clave: 'grupo', valor: g.id }
              });
            }).join('')
          : '';
        // Tarjetas KPI con el mismo lenguaje visual que Estadísticas:
        // etiqueta + ayuda (ⓘ), icono de tono, cifra y una línea de apoyo.
        const tarjeta = ({ valor, sufijo = '', etiqueta, ayuda, icono, tono, pie, texto }) => `
          <div class="kpi-card">
            <span class="kpi-etiqueta"><span class="kpi-texto">${this.escaparTexto(etiqueta)}</span>${this.ayudaHTML(ayuda)}</span>
            <span class="kpi-cuerpo">
              <span class="kpi-icono ${tono}"><i class="${icono}" aria-hidden="true"></i></span>
              <span class="kpi-datos">
                <span class="kpi-valor${texto ? ' kpi-valor--texto' : ''}">${valor}${sufijo ? `<small>${sufijo}</small>` : ''}</span>
                <span class="kpi-pie">${pie}</span>
              </span>
            </span>
          </div>`;
        const pctActivos = totalEstudiantes > 0 ? Math.round((totalActivos / totalEstudiantes) * 100) : 0;
        const kpis = [
          tarjeta({ valor: totalGrupos, etiqueta: 'Grupos registrados', ayuda: 'grupos',
            icono: 'ri-team-line', tono: 'azul', pie: 'Con listado cargado en la base' }),
          tarjeta({ valor: totalActivos, sufijo: `/${totalEstudiantes}`, etiqueta: 'Estudiantes activos', ayuda: 'activos',
            icono: 'ri-user-follow-line', tono: 'verde',
            pie: totalEstudiantes ? `${pctActivos}% de la matrícula` : 'Aún sin matrícula cargada' }),
          tarjeta({ valor: totalRetirados, etiqueta: 'Estudiantes retirados', ayuda: 'retirados',
            icono: 'ri-user-unfollow-line', tono: totalRetirados > 0 ? 'rojo' : 'azul',
            pie: 'Quedan fuera del cálculo de promedios' }),
          tarjeta({ valor: 'Sincronizado', etiqueta: 'Cuaderno STD', ayuda: 'cuaderno',
            icono: 'ri-file-excel-2-line', tono: 'verde', pie: `Actualizado ${fechaSync}`, texto: true })
        ].join('');

        // ── 3 · Visualizaciones (justo debajo de los KPIs) ─────────────
        const resumenVisual = totalGrupos === 0
          ? this.estadoVacioHTML({
              icono: 'ri-bar-chart-box-line',
              titulo: 'Todavía no hay datos para mostrar.',
              texto: 'Carga la lista de un grupo: aquí aparecerá la distribución de la matrícula y el tamaño de cada grupo.'
            })
          : `<div class="panel-graficos">
              <div class="chart-box">
                <h3><i class="ri-donut-chart-line" aria-hidden="true"></i> Distribución de la matrícula ${this.ayudaHTML('activos')}</h3>
                <p class="chart-nota">Cómo se reparte el total registrado entre activos y retirados.</p>
                <div class="dash-donuts">
                  ${StatsEngine.doughnutSVG(totalActivos, totalEstudiantes, '#10b981', 'Activos', `${totalActivos} de ${totalEstudiantes} alumnos`, { filtro: { clave: 'estado', valor: 'Activo' } })}
                  ${StatsEngine.doughnutSVG(totalRetirados, totalEstudiantes, '#ef4444', 'Retirados', `${totalRetirados} bajas registradas`, { filtro: { clave: 'estado', valor: 'Retirado' } })}
                </div>
              </div>
              <div class="chart-box">
                <h3><i class="ri-bar-chart-2-line" aria-hidden="true"></i> Alumnos por grupo ${this.ayudaHTML('grupos')}</h3>
                <p class="chart-nota">Tamaño de cada grupo cargado en la base compartida.</p>
                ${barras || `<p class="chart-nota">Carga el listado de un grupo para ver su tamaño.</p>`}
              </div>
            </div>`;

        // ── 4 · Tabla de detalle (al final, como en todo panel) ────────
        const filasGrupos = totalGrupos === 0
          ? `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);"><i class="ri-inbox-line" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>No hay ningún grupo registrado en el sistema.</td></tr>`
          : grupos.map(g => {
              const act = g.estudiantes ? g.estudiantes.filter(s => s.estado === 'Activo').length : 0;
              const ret = g.estudiantes ? g.estudiantes.filter(s => s.estado === 'Retirado').length : 0;
              const total = g.estudiantes ? g.estudiantes.length : 0;
              const pct = total > 0 ? Math.round((act / total) * 100) : 0;
              return `<tr>
                <td><strong>${g.nombre}</strong></td>
                <td>${g.carrera}</td>
                <td>${g.turno}</td>
                <td><span class="badge-status activo">${act} activos</span></td>
                <td><span class="badge-status ${ret > 0 ? 'retirado' : ''}">${ret} retirados</span></td>
                <td style="text-align: center;"><span class="dash-talla"><b>${total}</b> <span>${pct}% activos</span></span></td>
              </tr>`;
            }).join('');

        return `
          <div class="module-fade-enter dashboard-vista">
            <header class="view-header dash-hero">
              <div class="dash-hero-copy">
                <h1>¡Hola de nuevo, ${this.escaparTexto(this.nombreDocente())}! <span class="dash-emoji" aria-hidden="true">👋</span></h1>
                <p>Bienvenido al panel principal de gestión docente en el <strong>${this.escaparTexto(this.nombreCentro())}</strong>.</p>
                <div class="dash-acciones">
                  <button type="button" class="dash-accion primaria" onclick="UI.irA('estadisticas')"><i class="ri-bar-chart-2-line" aria-hidden="true"></i> Ver estadísticas</button>
                  <button type="button" class="dash-accion" onclick="UI.irA('grupos')"><i class="ri-file-excel-line" aria-hidden="true"></i> Cargar lista de grupo</button>
                  <button type="button" class="dash-accion" onclick="UI.irA('cuaderno-docente')"><i class="ri-book-2-line" aria-hidden="true"></i> Cuaderno Docente</button>
                </div>
              </div>
              <div class="header-actions dash-hero-estado">
                <span class="admin-stat dash-linea"><span class="dash-punto" aria-hidden="true"></span> Sistema en línea</span>
                <span class="admin-stat"><i class="ri-refresh-line" aria-hidden="true"></i> <b>${fechaSync}</b> sincronizado</span>
                <span class="admin-stat"><i class="ri-group-line" aria-hidden="true"></i> <b>${totalEstudiantes}</b> matriculados</span>
              </div>
            </header>

            <section class="bloque-analisis dash-kpis" aria-label="Indicadores esenciales">
              <div class="bloque-titulo">
                <h2><i class="ri-dashboard-3-line" aria-hidden="true"></i> Resumen general</h2>
                <span class="bloque-nota">${totalGrupos} grupo(s) · ${totalEstudiantes} estudiante(s) registrados</span>
              </div>
              <div class="kpi-grid">${kpis}</div>
            </section>

            <section class="bloque-analisis dash-visual" aria-label="Visualizaciones principales">
              <div class="bloque-titulo">
                <h2><i class="ri-pie-chart-2-line" aria-hidden="true"></i> Visualizaciones</h2>
                <span class="bloque-nota">Distribución de la matrícula y tamaño de cada grupo</span>
              </div>
              ${resumenVisual}
            </section>

            <section class="bloque-analisis dash-detalle" aria-label="Detalle por grupo">
              <div class="bloque-titulo">
                <h2><i class="ri-table-line" aria-hidden="true"></i> Detalle por grupo</h2>
                <span class="bloque-nota">Total: ${totalGrupos} grupo(s) · ${totalEstudiantes} estudiante(s)</span>
              </div>
              <div class="table-container">
                <table class="custom-table">
                  <thead>
                    <tr>
                      <th>Código de Grupo</th>
                      <th>Carrera / Evento</th>
                      <th>Turno</th>
                      <th>Activos</th>
                      <th>Retirados</th>
                      <th style="text-align: center;">Total Alumnos</th>
                    </tr>
                  </thead>
                  <tbody>${filasGrupos}</tbody>
                </table>
              </div>
            </section>
          </div>`;
      },

      renderGruposView() {
        // [FIX] Firebase guarda un arreglo vacío como nodo vacío, así que al
        // releer la base un grupo puede venir sin `estudiantes` (o con null):
        // aquí se restaura la forma que espera la tabla para que la sección
        // no se caiga al pintarla.
        const grupos = (DataEngine.db.grupos || []).map(g => ({
          ...g,
          estudiantes: UI.listaEstudiantes(g.estudiantes)
        }));
        const filaEstudiante = (s, g) => `<tr data-est-id="${s.id}"><td><strong>${s.nombres}</strong></td><td>${s.apellidos}</td><td>${s.correo}</td><td>${s.telefono}</td><td>${UI.renderBadgeEstado(s)}</td><td style="text-align: center; display: flex; justify-content: center; gap: 6px;"><button class="btn-icon" title="Editar Estudiante" onclick="UI.openEditStudentModal('${g.id}', '${s.id}')"><i class="ri-pencil-line" style="color: var(--secondary-blue);"></i></button><button class="btn-icon" title="Eliminar Estudiante" onclick="UI.deleteStudent('${g.id}', '${s.id}')"><i class="ri-delete-bin-line" style="color: #dc2626;"></i></button></td></tr>`;
        return `<div class="module-fade-enter"><div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"><div><h1>Gestión de Grupos de Clase</h1><p>Carga el listado oficial del grupo en Excel o CSV: el formato del archivo se detecta automáticamente para extraer alumnos y actualizar la base compartida.</p></div><div><button class="btn-primary" onclick="document.getElementById('excel-upload-input').click()"><i class="ri-file-excel-line"></i> Cargar Lista de Grupo (.xlsx o .csv)</button><input type="file" id="excel-upload-input" accept=".xlsx, .xls, .csv, .txt" style="display: none;" onchange="UI.handleExcelImport(event)"></div></div>${grupos.length === 0 ? `<div style="background: var(--white); padding: 40px; text-align: center; border-radius: var(--radius-md); border: 1px solid var(--border-color);"><i class="ri-folder-add-line" style="font-size: 3rem; color: var(--text-muted);"></i><h3 style="margin-top: 10px;">No hay grupos cargados</h3><p style="color: var(--text-muted); font-size: 0.85rem;">Haz clic en "Cargar Lista de Grupo" para procesar el listado oficial de INATEC.</p></div>` : grupos.map((g, index) => `<details class="group-accordion" data-grupo-id="${g.id}" ${index === 0 ? 'open' : ''}><summary><div style="display: flex; align-items: center; gap: 12px;"><i class="ri-arrow-right-s-line accordion-icon" style="font-size: 1.2rem; color: var(--primary-blue);"></i><div><h3 style="margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;"><i class="ri-group-line" style="color: var(--primary-blue);"></i> ${g.nombre}</h3><p style="margin: 2px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">${g.carrera} | Turno: ${g.turno}</p><p style="margin: 2px 0 0 0; font-size: 0.8rem;"><i class="ri-user-star-line" style="color: var(--secondary-blue);"></i> Docente Guía: <strong>${g.docenteGuia ? g.docenteGuia : '<span style=\"color: var(--text-muted); font-weight: 400;\">Sin asignar</span>'}</strong></p></div></div><div style="display: flex; align-items: center; gap: 12px;"><span class="badge-status activo"><i class="ri-user-line"></i> ${g.estudiantes.length} Estudiantes</span><button class="btn-icon" title="Asignar Docente Guía" onclick="event.stopPropagation(); UI.abrirModalDocenteGuia('${g.id}')"><i class="ri-user-star-line" style="color: var(--secondary-blue);"></i></button><button class="btn-icon btn-delete" title="Eliminar Grupo" onclick="event.stopPropagation(); UI.deleteGroup('${g.id}')"><i class="ri-delete-bin-line" style="color: #dc2626;"></i></button></div></summary><div class="table-container" style="border-top: 1px solid var(--border-color); border-radius: 0;"><table class="custom-table"><thead><tr><th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th style="text-align: center;">Acciones</th></tr></thead><tbody>${g.estudiantes.map(s => filaEstudiante(s, g)).join('')}</tbody></table></div></details>`).join('')}</div>`;
      },

      // [FIX] Convierte cualquier forma guardada de una lista de estudiantes
      // (arreglo, mapa o ausente) en un arreglo utilizable para pintar.
      listaEstudiantes(valor) {
        if (Array.isArray(valor)) return valor;
        if (valor && typeof valor === 'object') {
          return (valor.id !== undefined || valor.nombres !== undefined)
            ? [valor]
            : Object.values(valor);
        }
        return [];
      },

      renderBadgeEstado(s) {
        // [NUEVO] Si el estudiante está Retirado y tiene un motivo registrado,
        // se muestra un ícono con tooltip nativo (title) para consultarlo rápido
        // sin abrir el modal de edición — pensado como soporte/bitácora interna.
        // [FIX] Un registro heredado (o al que le faltó el campo) no debe
        // tumbar la sección entera: sin estado legible se pinta como Activo.
        const estudiante = s && typeof s === 'object' ? s : {};
        const estado = typeof estudiante.estado === 'string' && estudiante.estado.trim()
          ? estudiante.estado
          : 'Activo';
        const base = `<span class="badge-status ${estado.toLowerCase()}">${estado}</span>`;
        if (estado === 'Retirado' && estudiante.motivoRetiro && String(estudiante.motivoRetiro).trim()) {
          return `${base} <i class="ri-information-line" title="Motivo: ${String(estudiante.motivoRetiro).replace(/"/g, '&quot;')}" style="color: var(--text-muted); cursor: help; font-size: 0.95rem; vertical-align: middle;"></i>`;
        }
        if (estado === 'Retirado') {
          return `${base} <i class="ri-question-line" title="Sin motivo registrado" style="color: var(--text-disabled); cursor: help; font-size: 0.95rem; vertical-align: middle;"></i>`;
        }
        return base;
      },

      renderEstudiantesView() {
        const allStudents = DataEngine.getEstudiantes();
        // El filtro no se pierde al repintar: vive en la URL y en los chips.
        const filtros = this.filtrosGuardados('estudiantes');
        const estadoGuardado = filtros.estado && filtros.estado !== 'todos' ? filtros.estado : 'todos';
        const marcado = valor => (estadoGuardado === valor ? 'selected' : '');
        const etiquetaEstado = valor => `Estado: ${valor === 'Activo' ? 'Activos' : valor === 'Retirado' ? 'Retirados' : 'Todos'}`;
        const chips = this.chipsFiltrosHTML('estudiantes', filtros, { estado: etiquetaEstado });
        return `<div class="module-fade-enter"><div class="view-header"><h1>Directorio General de Estudiantes <span style="font-weight:400; font-size:0.6em; opacity:0.85;">${allStudents.length} alumnos registrados</span></h1><p>Busca y actualiza cualquier estudiante del centro. Los filtros de esta vista se conservan en el enlace para poder compartirlos.</p></div>
        <div class="barra-filtros no-imprimir" data-section-settings data-settings-title="Filtro de estudiantes">
          <div style="display:flex; gap:8px; align-items:center;">
            <label class="tb-label" for="est-filtro-estado"><i class="ri-filter-3-line"></i> Estado</label>
            <select id="est-filtro-estado" class="form-control" style="width:170px;" onchange="UI.filtrarDirectorioEstudiantes()">
              <option value="todos" ${marcado('todos')}>Todos</option>
              <option value="Activo" ${marcado('Activo')}>Solo Activos</option>
              <option value="Retirado" ${marcado('Retirado')}>Solo Retirados</option>
            </select>
            ${this.ayudaHTML('estudiantes')}
          </div>
          <div id="est-contador-filtro" style="font-size:0.78rem; color: var(--text-muted);">${allStudents.length} estudiante(s)</div>
          <div class="barra-acciones">
            <button type="button" class="btn-ghost" onclick="UI.exportarDirectorioCSV()"><i class="ri-file-download-line"></i> CSV</button>
            <button type="button" class="btn-ghost" onclick="UI.imprimirVista()"><i class="ri-printer-line"></i> PDF</button>
            <button type="button" class="btn-ghost" onclick="UI.copiarEnlaceVista()"><i class="ri-link"></i> Compartir vista</button>
          </div>
        </div>
        <div id="dir-chips" class="chips-activos" ${chips ? '' : 'hidden'}>${chips}</div>
        <div class="table-container"><table class="custom-table"><thead><tr><th>Grupo</th><th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th style="text-align: center;">Acción</th></tr></thead><tbody id="tbody-directorio-estudiantes">${allStudents.map(s => `<tr data-est-id="${s.id}" data-estado="${s.estado}"><td><span class="badge-status activo">${s.grupoNombre}</span></td><td><strong>${s.nombres}</strong></td><td>${s.apellidos}</td><td>${s.correo}</td><td>${s.telefono}</td><td>${UI.renderBadgeEstado(s)}</td><td style="text-align: center;"><button class="btn-icon" onclick="UI.openEditStudentModal('${s.grupoId}', '${s.id}')"><i class="ri-pencil-line" style="color: var(--secondary-blue);"></i></button></td></tr>`).join('')}</tbody></table></div>
        <div class="estado-panel estado-vacio" id="dir-estado-vacio" role="status" hidden>
          <i class="ri-user-search-line" aria-hidden="true"></i>
          <h3>No hay estudiantes con ese estado.</h3>
          <p>Prueba con otro filtro o límpialo para volver a ver la lista completa.</p>
          <div class="estado-acciones">
            <button type="button" class="btn-ghost" data-limpiar-filtros data-vista-filtro="estudiantes">
              <i class="ri-filter-off-line" aria-hidden="true"></i> Limpiar filtros
            </button>
          </div>
        </div>
      </div>`;
      },

      filtrarDirectorioEstudiantes() {
        const filtro = document.getElementById('est-filtro-estado')?.value || 'todos';
        const filas = document.querySelectorAll('#tbody-directorio-estudiantes tr');
        let visibles = 0;
        filas.forEach(fila => {
          const coincide = filtro === 'todos' || fila.dataset.estado === filtro;
          fila.style.display = coincide ? '' : 'none';
          if (coincide) visibles++;
        });
        const contador = document.getElementById('est-contador-filtro');
        if (contador) contador.textContent = `${visibles} estudiante(s)`;
        // El filtro queda en la URL (y en memoria) para poder volver o
        // compartir la lista ya filtrada. «Todos» = sin filtro.
        this.fijarFiltros('estudiantes', filtro === 'todos' ? {} : { estado: filtro });
        // Los chips se repintan sin recargar la vista entera.
        const zonaChips = document.getElementById('dir-chips');
        if (zonaChips) {
          const guardados = this.filtrosGuardados('estudiantes');
          zonaChips.innerHTML = this.chipsFiltrosHTML('estudiantes', guardados, {
            estado: valor => `Estado: ${valor === 'Activo' ? 'Activos' : valor === 'Retirado' ? 'Retirados' : valor}`
          });
          zonaChips.hidden = !Object.keys(guardados).length;
        }
        const vacio = document.getElementById('dir-estado-vacio');
        if (vacio) vacio.hidden = visibles > 0;
      },

      // Exporta el directorio respetando el filtro de estado activo.
      exportarDirectorioCSV() {
        try {
          const filtro = document.getElementById('est-filtro-estado')?.value || 'todos';
          const estudiantes = DataEngine.getEstudiantes()
            .filter(s => filtro === 'todos' || s.estado === filtro);
          if (!estudiantes.length) {
            this.showToast('No hay estudiantes para exportar con este filtro.', 'warning');
            return;
          }
          const filas = estudiantes.map(s => [s.grupoNombre || '', s.nombres || '', s.apellidos || '',
            s.correo || '', s.telefono || '', s.estado || 'Activo']);
          this.descargarCSV('directorio-estudiantes',
            ['Grupo', 'Nombres', 'Apellidos', 'Correo', 'Teléfono', 'Estado'], filas);
          this.showToast(`✅ CSV generado con ${estudiantes.length} estudiante(s).`);
        } catch (error) {
          console.error('No se pudo exportar el directorio:', error);
          this.showToast(`No se pudo exportar el directorio: ${error.message}`, 'error');
        }
      },

renderCuadernoDocente() {
  const workspace = document.getElementById('workspace');
  if (!workspace) return;
  const grupos = DataEngine.getGrupos();

  workspace.innerHTML = `
    <div class="module-fade-enter">
      <div class="view-header">
        <h1><i class="ri-file-excel-2-line"></i> Cuaderno Docente - Registro de Notas</h1>
        <p>Gestiona, importa por módulo individual o exporta el libro Excel de 5 pestañas con formato oficial.</p>
      </div>

      <!-- ═══ PASO 1 · QUÉ ESTOY VIENDO ═══ -->
      <details class="cuaderno-step" open>
        <summary class="cuaderno-step-title"><span class="cuaderno-step-num">1</span> Selecciona grupo y módulo</summary>
        <div class="cuaderno-step-body" style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <label class="tb-label"><i class="ri-group-line"></i> Grupo:</label>
            <select id="select-grupo-cuaderno" class="form-control" onchange="UI.actualizarTablaCuaderno()">
              <option value="">-- Seleccionar Grupo --</option>
              ${grupos.map(g => `<option value="${g.id}">${g.codigo || g.nombre} - ${g.carrera} (${g.turno})</option>`).join('')}
            </select>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <label class="tb-label"><i class="ri-book-read-line"></i> Módulo:</label>
            <select id="select-modulo-cuaderno" class="form-control" onchange="UI.actualizarTablaCuaderno()">
              <option value="ALL">📌 Todos los Módulos (Totales)</option>
              ${MODULOS_TRANSVERSALES.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
            <button type="button" class="btn-icon" data-permiso="configurarMateria" onclick="CuadernoEngine.agregarModuloAcademico()" title="Agregar un módulo nuevo a la lista (ej. Inglés) · solo administradores" aria-label="Agregar un módulo nuevo a la lista"><i class="ri-add-line" aria-hidden="true"></i></button>
            <button type="button" class="btn-icon" data-permiso="configurarMateria" onclick="CuadernoEngine.quitarModuloAcademico()" title="Quitar el módulo seleccionado de la lista · solo administradores" aria-label="Quitar el módulo seleccionado de la lista"><i class="ri-subtract-line" aria-hidden="true"></i></button>
          </div>
          <div style="display:flex; align-items:center; font-size:0.72rem; color:var(--text-muted); gap:6px;">
            <i class="ri-lightbulb-line" aria-hidden="true"></i>
            <span>La lista es del centro: al agregar un módulo aparece en el Cuaderno, Estadísticas, Exámenes e Informe de todos.</span>
          </div>
        </div>
      </details>

      <!-- ═══ PASO 2 · CARGAR NOTAS ═══ -->
      <details class="cuaderno-step">
        <summary class="cuaderno-step-title"><span class="cuaderno-step-num">2</span> Cargar notas desde Excel</summary>
        <div class="cuaderno-step-body" style="display:flex; flex-direction:column; gap:14px;">
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <button class="btn-primary-soft" onclick="document.getElementById('file-import-notas').click()">
              <i class="ri-upload-2-line"></i> Cargar Notas Módulo (.xlsx)
            </button>
            <input type="file" id="file-import-notas" accept=".xlsx, .xls" style="display:none;" onchange="CuadernoEngine.importarNotasExcel(event)">
            <span style="font-size:0.78rem; color: var(--text-muted);">Sube el Excel de un módulo para el grupo seleccionado arriba.</span>
          </div>

          <div class="cuaderno-substep">
            <div style="display:flex; align-items:center; gap:8px;">
              <i class="ri-stack-line" style="color: var(--p-400); font-size:1.2rem;"></i>
              <div>
                <div style="font-weight:600; font-size:0.85rem;">Carga masiva para TODOS los grupos</div>
                <div style="font-size:0.72rem; color: var(--text-muted);">Un solo Excel; el sistema ubica a cada estudiante en su grupo automáticamente.</div>
              </div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px;">
              <select id="select-modulo-masivo" class="form-control" style="width: 260px;">
                <option value="">-- Seleccionar Módulo --</option>
                ${MODULOS_TRANSVERSALES.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
              <button class="btn-primary-soft" onclick="document.getElementById('file-import-notas-masivo').click()">
                <i class="ri-upload-cloud-2-line"></i> Cargar para Todos los Grupos (.xlsx)
              </button>
              <input type="file" id="file-import-notas-masivo" accept=".xlsx, .xls" style="display:none;" onchange="CuadernoEngine.importarNotasModuloTodosGrupos(event)">
            </div>
          </div>
        </div>
      </details>

      <!-- ═══ PASO 3 · OPCIONES DE EXPORTACIÓN (colapsable) ═══ -->
      <details class="cuaderno-step" data-section-settings open>
        <summary class="cuaderno-step-title"><span class="cuaderno-step-num">3</span> Opciones de exportación</summary>
        <div class="cuaderno-step-body" id="panel-opciones-exportar">

          <div style="margin-bottom: 12px;">
            <label style="cursor: pointer; font-weight: 500; font-size: 0.85rem;">
              <input type="checkbox" id="chk-incluir-resumen" checked style="margin-right: 6px;">
              Incluir hoja <b>Resumen General</b>
            </label>
          </div>

          <div style="display:flex; gap:20px; margin-bottom:14px; flex-wrap:wrap;">
            <div>
              <label for="select-filtro-turno" style="font-weight:600; display:block; margin-bottom:4px; font-size:0.8rem;">🕒 Turno (aplica a "Exportar Todos"):</label>
              <select id="select-filtro-turno" class="form-control">
                <option value="todos">Todos los turnos</option>
                <option value="matutino">Solo Matutino</option>
                <option value="vespertino">Solo Vespertino</option>
                <option value="nocturno">Solo Nocturno</option>
                <option value="sabatino">Solo Sabatino</option>
                <option value="dominical">Solo Dominical</option>
              </select>
            </div>
            <div>
              <label for="select-filtro-estudiantes" style="font-weight:600; display:block; margin-bottom:4px; font-size:0.8rem;">👥 Estudiantes a incluir:</label>
              <select id="select-filtro-estudiantes" class="form-control">
                <option value="todos">Todos</option>
                <option value="activos">Solo Activos</option>
                <option value="retirados">Solo Retirados</option>
                <option value="pendientes">Solo con actividad pendiente</option>
                <option value="completos">Solo completos (sin pendientes)</option>
              </select>
            </div>
            <div>
              <label for="select-modo-notas" style="font-weight: 600; display: block; margin-bottom: 4px; font-size: 0.8rem;">📝 Modo de calificación:</label>
              <select id="select-modo-notas" class="form-control">
                <option value="real">Mostrar nota real (0 – 100)</option>
                <option value="estado">Solo Estado: Aprobado / Pendiente</option>
              </select>
            </div>
            <div id="grupo-umbral" style="display: none;">
              <label for="input-umbral" style="font-weight: 600; display: block; margin-bottom: 4px; font-size: 0.8rem;">Nota mínima aprobatoria:</label>
              <input type="number" id="input-umbral" value="60" min="0" max="100" class="form-control" style="width: 70px; text-align: center;">
            </div>
          </div>

          <fieldset style="border: 1px solid var(--border-default); border-radius: var(--r-lg); padding: 10px 12px;">
            <legend style="font-weight: 600; color: var(--p-500); font-size: 0.8rem; padding: 0 6px;">📚 Módulos a descargar:</legend>
            <div id="contenedor-checkboxes-modulos" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.8rem;">
              <!-- Se generan automáticamente -->
            </div>
          </fieldset>
        </div>
      </details>

      <!-- ═══ PASO 4 · ACCIONES ═══ -->
      <details class="cuaderno-step cuaderno-actions-step" open>
        <summary class="cuaderno-step-title"><span class="cuaderno-step-num">4</span> Acciones</summary>
        <div class="cuaderno-step-body cuaderno-actions">
          <button type="button" class="btn-warning" onclick="UI.abrirModalConvalidaciones()">🎓 Convalidar Módulo</button>
          <button type="button" class="btn-secondary btn-delete-action" title="Borrar todos los datos del módulo seleccionado" onclick="DataEngine.borrarDatosModulo()"><i class="ri-delete-bin-5-line" aria-hidden="true"></i> Borrar Módulo</button>
          <span class="cuaderno-actions-spacer"></span>
          <select id="select-export-mode" class="form-control" style="width: 210px;">
            <option value="full">📋 Exportar Todo</option>
            <option value="resumen">📊 Solo Unidades y Totales</option>
          </select>
          <select id="select-formato-cuaderno" class="form-control" style="width: 165px;" aria-label="Formato de archivo de exportación" title="Formato del archivo que se descargará (Excel o PDF)">
            <option value="xlsx">📊 Formato: Excel</option>
            <option value="pdf">📄 Formato: PDF</option>
          </select>
          <button type="button" class="btn-secondary" data-permiso="configurarInstitucion" onclick="CuadernoEngine.abrirConfiguracionAcademica()">
            <i class="ri-settings-3-line"></i> Configurar responsables
          </button>
          <button type="button" class="btn-primary-soft" onclick="CuadernoEngine.exportarCuadernosListosParaImprimir()" title="Descarga un cuaderno por grupo, en Legal horizontal, blanco y negro y sin rellenos, en el formato elegido">
            <i class="ri-printer-line"></i> Exportar cuadernos para imprimir
          </button>
          <select id="select-jefe-cuadernos-impresion" class="form-control" aria-label="Filtrar cuadernos por jefe de departamento">
            <option value="">Seleccionar jefe</option>
          </select>
          <button type="button" class="btn-primary-soft" onclick="CuadernoEngine.exportarCuadernosPorJefe()" title="Exporta solo los cuadernos de los turnos cubiertos por el jefe seleccionado">
            <i class="ri-user-settings-line"></i> Exportar por jefe
          </button>
          <button class="btn-primary" onclick="CuadernoEngine.exportarCuadernoOficial()" title="Descarga el cuaderno del grupo en el formato elegido (Excel o PDF), con firmas y estadísticas">
            <i class="ri-file-download-line"></i> Exportar Cuaderno Oficial (Firmado)
          </button>
          <button class="btn-primary-soft" onclick="CuadernoEngine.exportarTodosLosCuadernos()" title="Descarga un archivo por cada grupo registrado, en el formato elegido">
            <i class="ri-folder-download-line"></i> Exportar TODOS los Cuadernos
          </button>
        </div>
      </details>

      <div id="contenedor-tabla-cuaderno" style="margin-top: 16px;">
        <div class="table-container" style="padding: 40px; text-align: center; color: var(--text-muted);">
          <i class="ri-file-search-line" style="font-size: 3rem; color: var(--secondary-blue);"></i>
          <p style="margin-top: 10px;">Selecciona un grupo para visualizar o cargar las calificaciones.</p>
        </div>
      </div>
    </div>
  `;

  // [IMPORTANTE] Inicializar los checkboxes de módulos y el listener del modo de notas
  // después de renderizar, porque innerHTML destruye todo lo anterior.
  if (typeof CuadernoEngine !== 'undefined' && CuadernoEngine.inicializarSelectoresExportacion) {
    CuadernoEngine.inicializarSelectoresExportacion();
  }
},

      handleExcelImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        // El archivo ya está en memoria: se limpia el input para poder
        // volver a cargar el mismo listado sin recargar la página.
        event.target.value = '';
        const cerrarCarga = () => this.hideLoading(300);
        this.showLoading(`Procesando el listado del grupo…`, 'subida');
        DataEngine.parseExcelGroup(file, (grupo, resumen) => {
          cerrarCarga();
          const hoja = resumen && resumen.hoja ? ` (hoja "${resumen.hoja}")` : '';
          this.showToast(`Grupo ${grupo.nombre} cargado exitosamente (${grupo.estudiantes.length} estudiantes)${hoja}.`);
          const advertencias = (resumen && resumen.advertencias) || [];
          if (advertencias.length) this.showToast(`ℹ️ ${advertencias.join(' ')}`);
          this.renderCurrentModule();
        }, cerrarCarga);
      },

      openEditStudentModal(groupId, studentId) {
        const group = DataEngine.db.grupos.find(g => g.id === groupId);
        if (!group) return;
        const student = group.estudiantes.find(s => s.id === studentId);
        if (!student) return;
        document.getElementById('edit-group-id').value = groupId;
        document.getElementById('edit-student-id').value = studentId;
        document.getElementById('edit-nombres').value = student.nombres;
        document.getElementById('edit-apellidos').value = student.apellidos;
        document.getElementById('edit-correo').value = student.correo;
        document.getElementById('edit-telefono').value = student.telefono;
        document.getElementById('edit-estado').value = student.estado;
        document.getElementById('edit-motivo-retiro').value = student.motivoRetiro || '';
        this.toggleMotivoRetiro();
        document.getElementById('modal-edit-student').classList.add('active');
      },

      // [NUEVO] Muestra/oculta el campo de motivo de retiro según el estado elegido.
      toggleMotivoRetiro() {
        const estado = document.getElementById('edit-estado')?.value;
        const grupoMotivo = document.getElementById('grupo-motivo-retiro');
        if (grupoMotivo) grupoMotivo.style.display = estado === 'Retirado' ? 'block' : 'none';
      },

      closeModal() { document.getElementById('modal-edit-student').classList.remove('active'); },

      async saveStudentEdit(e) {
        e.preventDefault();
        const groupId = document.getElementById('edit-group-id').value;
        const studentId = document.getElementById('edit-student-id').value;
        const group = DataEngine.db.grupos.find(g => g.id === groupId);
        if (group) {
          const student = group.estudiantes.find(s => s.id === studentId);
          if (student) {
            const previousStudent = { ...student };
            student.nombres = document.getElementById('edit-nombres').value;
            student.apellidos = document.getElementById('edit-apellidos').value;
            student.correo = document.getElementById('edit-correo').value;
            student.telefono = document.getElementById('edit-telefono').value;
            const nuevoEstado = document.getElementById('edit-estado').value;
            student.estado = nuevoEstado;
            // [NUEVO] Motivo de retiro — se conserva solo si el estado es Retirado;
            // si vuelve a Activo, se limpia para no arrastrar un motivo obsoleto.
            if (nuevoEstado === 'Retirado') {
              student.motivoRetiro = document.getElementById('edit-motivo-retiro').value.trim();
            } else {
              student.motivoRetiro = '';
            }
            try {
              await DataEngine.save();
              this.closeModal();
              this.showToast("Datos del estudiante actualizados correctamente.");
              if (typeof Mejoras !== 'undefined' && Mejoras.registrarEvento) {
                const nombreEditado = `${student.nombres || ''} ${student.apellidos || ''}`.trim();
                Mejoras.registrarEvento({
                  tipo: 'cambio', titulo: 'Ficha de estudiante actualizada',
                  texto: `${nombreEditado || 'Estudiante'}: datos modificados.`,
                  afectado: nombreEditado || null,
                  detalle: `Grupo: ${student.grupoNombre || groupId}`,
                  seccion: 'estudiantes', clave: `est-edit-${studentId}`
                });
              }
              this.renderCurrentModule();
            } catch (error) {
              const currentGroup = DataEngine.getGrupoById(groupId);
              const currentStudent = currentGroup?.estudiantes.find(item => item.id === studentId);
              if (currentStudent === student) Object.assign(student, previousStudent);
              console.error('No se pudo actualizar el estudiante:', error);
              this.showToast(`No se guardaron los datos del estudiante: ${error.message}`, 'error');
            }
          }
        }
      },

      // Aviso flotante con tipo (exito | error | aviso | info).
      // Si no se indica el tipo se deduce del mensaje (✅, ❌, ⚠️, ℹ️ …),
      // así las llamadas antiguas siguen viéndose con el color correcto.
      showToast(msg, tipo) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const texto = String(msg == null ? '' : msg);
        const tipoAviso = this.tipoDeAviso(texto, tipo);
        const meta = this.metaAviso(tipoAviso);
        const limpio = texto.replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2139}\u{FE0F}\s]+/u, '').trim() || texto;
        const seguro = String(limpio).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

        container.setAttribute('aria-live', tipoAviso === 'error' ? 'assertive' : 'polite');

        const toast = document.createElement('div');
        toast.className = `toast ${meta.clase}`;
        toast.style?.setProperty?.('--toast-duracion', `${meta.duracion}ms`);
        toast.setAttribute('role', tipoAviso === 'error' ? 'alert' : 'status');
        toast.innerHTML =
          `<span class="toast-icono"><i class="${meta.icono}" aria-hidden="true"></i></span>` +
          `<span class="toast-cuerpo">` +
            `<strong class="toast-titulo">${meta.titulo}</strong>` +
            `<span class="toast-texto">${seguro}</span>` +
          `</span>` +
          `<button type="button" class="toast-close" aria-label="Cerrar aviso"><i class="ri-close-line" aria-hidden="true"></i></button>` +
          `<span class="toast-barra" aria-hidden="true"><span></span></span>`;

        const retirar = () => {
          if (toast.classList.contains('saliendo')) return;
          // Mientras el puntero está sobre el aviso se pospone: así se puede
          // leer un mensaje largo sin que desaparezca debajo del cursor.
          if (typeof toast.matches === 'function' && toast.matches(':hover')) { setTimeout(retirar, 1500); return; }
          toast.classList.add('saliendo');
          setTimeout(() => toast.remove(), 280);
        };
        toast.querySelector('.toast-close')?.addEventListener('click', retirar);
        toast.addEventListener('mouseenter', () => toast.classList.add('en-pausa'));
        toast.addEventListener('mouseleave', () => toast.classList.remove('en-pausa'));

        container.appendChild(toast);
        setTimeout(retirar, meta.duracion);
      },

      // Clasifica el aviso: por tipo explícito o por el emoji/mensaje.
      tipoDeAviso(texto, tipo) {
        const explicito = {
          success: 'success', exito: 'success', ok: 'success',
          error: 'error', danger: 'error',
          warning: 'warning', aviso: 'warning', alerta: 'warning',
          info: 'info', informacion: 'info'
        }[String(tipo || '').toLowerCase()];
        if (explicito) return explicito;
        const t = String(texto || '');
        const inicio = t.trimStart().slice(0, 2);
        if (/[❌⛔🚫‼]/.test(inicio) || /no se pudo|error al|fall[oó]/i.test(t)) return 'error';
        if (/[⚠❗]/.test(inicio) || /debe seleccionar|sin tel[eé]fono|sin grupo/i.test(t)) return 'warning';
        if (/[ℹ💡]/.test(inicio)) return 'info';
        return 'success';
      },

      metaAviso(tipo) {
        return {
          success: { clase: 'success', icono: 'ri-check-line',        titulo: 'Listo',               duracion: 4200 },
          error:   { clase: 'error',   icono: 'ri-close-circle-line', titulo: 'No se pudo completar', duracion: 7600 },
          warning: { clase: 'warning', icono: 'ri-alert-line',        titulo: 'Revisa esto',          duracion: 6200 },
          info:    { clase: 'info',    icono: 'ri-information-line',  titulo: 'Aviso',                duracion: 5000 }
        }[tipo] || null;
      },

      /* ═══════════════════════════════════════════════════════════
         1 · JERARQUÍA, FILTROS Y ESTADOS DE LAS VISTAS
         ─────────────────────────────────────────────────────────
         Los filtros son persistentes (se recuerdan durante la
         sesión), reversibles (chip con ×, más «Limpiar filtros»)
         y compartibles (se reflejan en la URL: #/seccion?clave=valor).
         ═══════════════════════════════════════════════════════════ */
      _paramsVista: {},

      // Glosario: toda métrica del panel se explica aquí para que un
      // número sin definición no se interprete al revés.
      INDICADORES: {
        grupos: { titulo: 'Grupos de clase', texto: 'Grupos con listado cargado en la base compartida del centro. No cuenta los grupos sin alumnos.' },
        activos: { titulo: 'Estudiantes activos', texto: 'Alumnos con matrícula vigente en el periodo. Son los que cuentan para el seguimiento y las estadísticas de rendimiento.' },
        retirados: { titulo: 'Estudiantes retirados', texto: 'Bajas registradas (con motivo o no). Se muestran por trazabilidad y quedan fuera del cálculo de promedios.' },
        estudiantes: { titulo: 'Estudiantes', texto: 'Total de alumnos matriculados que cumplen el filtro activo (activos y retirados juntos).' },
        rendimiento: { titulo: 'Rendimiento académico', texto: 'Promedio de las calificaciones registradas, en escala 0 a 100. 60 es la nota mínima aprobatoria. Solo promedian los módulos que ya tienen notas.' },
        cobertura: { titulo: 'Cobertura de evaluación', texto: 'Porcentaje de estudiantes que ya tienen al menos una calificación. Mide qué tan completo está el registro, no la calidad del aprendizaje.' },
        convalidaciones: { titulo: 'Convalidaciones', texto: 'Módulos reconocidos sin cursar (traslado de crédito u otra institución). No se promedian: se dan por cubiertos.' },
        enRiesgo: { titulo: 'Estudiantes en riesgo', texto: 'Alumnos con promedio inferior a 60 en los módulos con notas. Sirven para priorizar el seguimiento.' },
        sinNotas: { titulo: 'Sin calificaciones', texto: 'Estudiantes sin ninguna nota registrada todavía: su promedio no existe, no es cero.' },
        promedioModulo: { titulo: 'Promedio por módulo', texto: 'Media de los promedios de los alumnos que tienen notas en ese módulo. Los módulos sin importar quedan en 0 y se marcan como vacíos.' },
        asistencia: { titulo: 'Asistencia', texto: 'Proporción de sesiones asistidas sobre las programadas. Este panel no la captura todavía: se reporta en el Informe de Avance de INATEC.' },
        usoTIC: { titulo: 'Uso de TIC', texto: 'Frecuencia con que se usan herramientas digitales en las clases. Se reporta en el Informe de Avance; el panel no lo calcula automáticamente.' },
        periodo: { titulo: 'Periodo reportado', texto: 'Etiqueta del periodo académico que se escribe en los informes oficiales (ej. «Agosto 2026»).' },
        cuaderno: { titulo: 'Cuaderno STD', texto: 'Libro Excel del cuaderno docente: su marca «Sincronizado» indica que coincide con la base compartida.' }
      },

      // Consulta actual de la URL → { vista, params }. Tolera entornos
      // sin location/history (pruebas) y URLs mal formadas.
      rutaLeer() {
        const salida = { vista: '', params: {} };
        try {
          if (typeof location === 'undefined' || !location) return salida;
          const crudo = String(location.hash || '').replace(/^#\/?/, '');
          const partes = crudo.split('?');
          salida.vista = decodeURIComponent(partes[0] || '');
          const consulta = partes[1];
          if (consulta) {
            if (typeof URLSearchParams !== 'undefined') {
              new URLSearchParams(consulta).forEach((valor, clave) => { salida.params[clave] = valor; });
            } else {
              consulta.split('&').filter(Boolean).forEach(par => {
                const mitad = par.split('=');
                salida.params[decodeURIComponent(mitad[0])] = decodeURIComponent(mitad[1] || '');
              });
            }
          }
        } catch (e) { /* URL ilegible: se usa la vista por defecto */ }
        return salida;
      },

      // Guarda los filtros de una sección, los recuerda y los escribe
      // en la URL (reemplazando, sin ensuciar el historial).
      fijarFiltros(vista, params) {
        const limpio = {};
        Object.keys(params || {}).forEach(clave => {
          const valor = params[clave];
          if (valor !== '' && valor !== null && valor !== undefined) limpio[clave] = String(valor);
        });
        this._paramsVista[vista] = limpio;
        this.rutaEscribir(vista, limpio);
        return limpio;
      },

      filtrosGuardados(vista) {
        return this._paramsVista[vista] || {};
      },

      rutaEscribir(vista, params) {
        try {
          if (typeof history === 'undefined' || !history || typeof history.replaceState !== 'function') return;
          const consulta = (typeof URLSearchParams !== 'undefined')
            ? new URLSearchParams(params || {}).toString()
            : Object.keys(params || {}).map(clave => `${encodeURIComponent(clave)}=${encodeURIComponent(params[clave])}`).join('&');
          history.replaceState(null, '', `#/${encodeURIComponent(vista || '')}${consulta ? `?${consulta}` : ''}`);
        } catch (e) { /* sin historial disponible */ }
      },

      // Recupera la vista y los filtros del enlace con el que se abrió
      // el panel (#/estadisticas?grupo=3A). Devuelve true si cambió.
      aplicarRuta(rePintar) {
        const ruta = this.rutaLeer();
        if (!ruta.vista || typeof Secciones === 'undefined') return false;
        const seccion = Secciones.obtener(ruta.vista);
        if (!seccion || !Secciones.puedeVer(seccion, AuthManager.profile)) return false;
        this._paramsVista[ruta.vista] = ruta.params;
        if (seccion.id !== this.currentModule) {
          this.currentModule = seccion.id;
          this.actualizarNavActivo(seccion.id);
          this.renderCurrentModule();
          return true;
        }
        if (rePintar) this.renderCurrentModule({ background: true });
        return true;
      },

      // Quita un filtro concreto o todos y vuelve a pintar la sección.
      quitarFiltro(vista, clave) {
        const params = { ...this.filtrosGuardados(vista) };
        delete params[clave];
        this.fijarFiltros(vista, params);
        this.refrescarSeccion(vista);
      },

      limpiarFiltros(vista) {
        this.fijarFiltros(vista, {});
        this.refrescarSeccion(vista);
      },

      refrescarSeccion(vista) {
        if (this.currentModule === vista) this.renderCurrentModule({ background: true });
        else this.irA(vista);
      },

      // Chips de los filtros activos + botón «Limpiar filtros».
      // `etiquetas` traduce cada clave a un texto legible.
      chipsFiltrosHTML(vista, params, etiquetas = {}) {
        const claves = Object.keys(params || {}).filter(clave => {
          const valor = params[clave];
          return valor !== '' && valor !== null && valor !== undefined;
        });
        if (!claves.length) return '';
        const chips = claves.map(clave => {
          const traductor = etiquetas[clave];
          const texto = typeof traductor === 'function' ? traductor(params[clave]) : `${clave}: ${params[clave]}`;
          const seguro = this.escaparTexto(texto);
          return `<span class="chip chip-filtro">${seguro}` +
            `<button type="button" class="chip-remove" data-quitar-filtro="${this.escaparTexto(clave)}"` +
            ` data-vista-filtro="${this.escaparTexto(vista)}" aria-label="Quitar filtro ${seguro}">` +
            `<i class="ri-close-line" aria-hidden="true"></i></button></span>`;
        }).join('');
        return `<div class="chips-activos" role="status" aria-label="Filtros aplicados">` +
          `<span class="chips-rotulo"><i class="ri-filter-3-line" aria-hidden="true"></i> Filtros activos</span>${chips}` +
          `<button type="button" class="btn-ghost btn-limpiar-filtros" data-limpiar-filtros` +
          ` data-vista-filtro="${this.escaparTexto(vista)}" title="Quita todos los filtros">` +
          `<i class="ri-filter-off-line" aria-hidden="true"></i> Limpiar filtros</button>` +
          `</div>`;
      },

      // Ícono ⓘ con la glosa del indicador (teclado y táctil incluidos).
      ayudaHTML(clave) {
        const info = this.INDICADORES ? this.INDICADORES[clave] : null;
        if (!info) return '';
        this._ayudaSeq = (this._ayudaSeq || 0) + 1;
        const id = `ayuda-${this._ayudaSeq}`;
        return `<span class="metrica-ayuda">` +
          `<button type="button" class="ayuda-btn" aria-expanded="false" aria-controls="${id}"` +
          ` aria-label="Qué significa: ${this.escaparTexto(info.titulo)}"><i class="ri-question-line" aria-hidden="true"></i></button>` +
          `<span class="ayuda-pop" id="${id}" role="tooltip" hidden>` +
          `<strong>${this.escaparTexto(info.titulo)}</strong>${this.escaparTexto(info.texto)}</span></span>`;
      },

      // Abre/cierra la glosa de un indicador (solo una a la vez).
      alternarAyuda(boton) {
        const contenedor = boton && boton.closest ? boton.closest('.metrica-ayuda') : null;
        if (!contenedor) return;
        const abierta = boton.getAttribute('aria-expanded') === 'true';
        this.cerrarAyudas(boton);
        boton.setAttribute('aria-expanded', String(!abierta));
        const glosa = contenedor.querySelector('.ayuda-pop');
        if (glosa) glosa.hidden = abierta;
      },

      cerrarAyudas(excepto) {
        if (typeof document === 'undefined' || !document.querySelectorAll) return;
        document.querySelectorAll('.ayuda-btn[aria-expanded="true"]').forEach(boton => {
          if (boton === excepto) return;
          boton.setAttribute('aria-expanded', 'false');
          const contenedor = boton.closest ? boton.closest('.metrica-ayuda') : boton.parentElement;
          const glosa = contenedor ? contenedor.querySelector('.ayuda-pop') : null;
          if (glosa) glosa.hidden = true;
        });
      },

      escaparTexto(valor) {
        return String(valor === null || valor === undefined ? '' : valor)
          .replace(/[&<>"']/g, car => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[car]));
      },

      // Estado vacío: dice qué pasó y ofrece la salida (filtro, rango…).
      estadoVacioHTML(opciones = {}) {
        return `<div class="estado-panel estado-vacio" role="status">` +
          `<i class="${opciones.icono || 'ri-database-2-line'}" aria-hidden="true"></i>` +
          `<h3>${this.escaparTexto(opciones.titulo || 'No hay datos para este periodo.')}</h3>` +
          `<p>${this.escaparTexto(opciones.texto || 'Prueba otro rango o quita algún filtro.')}</p>` +
          (opciones.accion ? `<div class="estado-acciones">${opciones.accion}</div>` : '') +
          `</div>`;
      },

      // Estado de error: detalle visible + botón de reintento, para no
      // dejar una pantalla en blanco sin explicación.
      estadoErrorHTML(detalle) {
        return `<div class="estado-panel estado-error" role="alert">` +
          `<i class="ri-error-warning-line" aria-hidden="true"></i>` +
          `<h3>No se pudieron cargar los datos</h3>` +
          `<p>Ocurrió un problema al preparar esta vista. No se modificó ninguna información.</p>` +
          `<p class="estado-error-detalle"><strong>Detalle:</strong> ${this.escaparTexto(detalle)}</p>` +
          `<div class="estado-acciones">` +
          `<button type="button" class="btn-primary" onclick="UI.renderCurrentModule({ background: true })">` +
          `<i class="ri-refresh-line" aria-hidden="true"></i> Reintentar</button></div></div>`;
      },

      descargarBlob(blob, nombreArchivo) {
        try {
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = nombreArchivo;
          document.body.appendChild(enlace);
          enlace.click();
          enlace.remove();
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* ya liberado */ } }, 1500);
        } catch (error) {
          console.error('No se pudo descargar el archivo:', error);
          this.showToast(`No se pudo descargar el archivo: ${error.message}`, 'error');
        }
      },

      // CSV con «;» y BOM: Excel en español lo abre con los acentos bien.
      descargarCSV(nombreArchivo, encabezados, filas) {
        const celda = valor => {
          const texto = String(valor === null || valor === undefined ? '' : valor);
          return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
        };
        const lineas = [(encabezados || []).map(celda).join(';')];
        (filas || []).forEach(fila => lineas.push((fila || []).map(celda).join(';')));
        const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        this.descargarBlob(blob, `${nombreArchivo}.csv`);
        return Math.max(lineas.length - 1, 0);
      },

      /* ── Impresión / PDF ──────────────────────────────────────
         El papel, la orientación y los márgenes salen de la
         configuración de exportación (ConfigExport), de modo que
         el PDF del navegador coincide con lo que define el equipo
         en «Exportar e imprimir». Devuelve lo aplicado por si algo
         falla y hay que contarlo en el aviso. */
      prepararImpresion() {
        const cfg = (typeof ConfigExport !== 'undefined' && ConfigExport && typeof ConfigExport.load === 'function')
          ? ConfigExport.load()
          : {};
        const papeles = { 1: 'letter', 3: 'tabloid', 5: 'legal', 8: 'a3', 9: 'a4', 11: 'a5' };
        const papel = papeles[Number(cfg.printPaperSize) || 9] || 'a4';
        const orientacion = cfg.printOrientation === 'portrait' ? 'portrait' : 'landscape';
        const pre = (typeof ConfigExport !== 'undefined' && ConfigExport && ConfigExport.MARGIN_PRESETS)
          ? (ConfigExport.MARGIN_PRESETS[cfg.printMargin] || ConfigExport.MARGIN_PRESETS.normal)
          : { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75 };
        const mm = pulgadas => Math.round(Number(pulgadas) * 25.4);

        let hoja = document.getElementById('estilo-impresion');
        if (!hoja) {
          hoja = document.createElement('style');
          hoja.id = 'estilo-impresion';
          document.head.appendChild(hoja);
        }
        hoja.textContent = `@page { size: ${papel} ${orientacion}; ` +
          `margin: ${mm(pre.top)}mm ${mm(pre.right)}mm ${mm(pre.bottom)}mm ${mm(pre.left)}mm; }`;

        document.documentElement.setAttribute('data-papel', papel);
        document.documentElement.setAttribute('data-orientacion', orientacion);
        this.pintarCabeceraImpresion();

        // En el papel también se leen lo que en pantalla está
        // plegado: se despliega todo y se recoge al volver.
        this._impresionDetalles = [...document.querySelectorAll('#workspace details:not([open])')];
        this._impresionDetalles.forEach(detalles => { detalles.open = true; });

        if (!this._impresionEscuchada && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          this._impresionEscuchada = true;
          window.addEventListener('afterprint', () => this.limpiarImpresion());
        }
        return { papel, orientacion, margenMm: mm(pre.left), cabecera: true };
      },

      /* Cabecera que solo existe en papel: título de la vista, filtros
         activos y fecha, para que un PDF suelto se entienda solo. */
      pintarCabeceraImpresion() {
        let cabecera = document.getElementById('print-cabecera');
        if (!cabecera) {
          cabecera = document.createElement('div');
          cabecera.id = 'print-cabecera';
          cabecera.className = 'print-cabecera';
          const destino = document.getElementById('workspace');
          if (destino) destino.insertBefore(cabecera, destino.firstChild);
        }
        let titulo = 'Vista actual';
        try {
          const seccion = (typeof Secciones !== 'undefined' && Secciones && typeof Secciones.obtener === 'function')
            ? Secciones.obtener(this.currentModule)
            : null;
          if (seccion && seccion.etiqueta) titulo = seccion.etiqueta;
        } catch (error) { /* sin secciones: se queda el rótulo genérico */ }

        const chips = [...document.querySelectorAll('.chips-activos')]
          .map(caja => caja.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join(' · ');
        const fecha = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        const version = (typeof Mejoras !== 'undefined' && Mejoras && Mejoras.VERSION) ? Mejoras.VERSION : '';
        cabecera.innerHTML =
          `<div class="print-cab-fila"><span class="print-cab-marca">TIC Dashboard</span>` +
          `<span class="print-cab-titulo">${this.escaparTexto(titulo)}</span>` +
          `<span class="print-cab-fecha">${this.escaparTexto(fecha)}</span></div>` +
          `<div class="print-cab-meta">` +
          (chips ? `<span>Filtros: ${this.escaparTexto(chips)}</span>` : '<span>Sin filtros activos</span>') +
          (version ? `<span>Versión ${this.escaparTexto(version)}</span>` : '') +
          `</div>`;
        return cabecera;
      },

      /* Vuelve a la pantalla: los pliegues plegados y sin atributos. */
      limpiarImpresion() {
        (this._impresionDetalles || []).forEach(detalles => { detalles.open = false; });
        this._impresionDetalles = null;
        document.documentElement.removeAttribute('data-papel');
        document.documentElement.removeAttribute('data-orientacion');
      },

      // Imprime la vista actual: el diálogo del navegador permite
      // guardarla como PDF con el papel y la orientación elegidos.
      imprimirVista() {
        try {
          this.prepararImpresion();
          if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
        } catch (error) {
          this.showToast(`No se pudo abrir el diálogo de impresión: ${error.message}`, 'error');
        }
      },

      // Copia el enlace exacto de la vista (con sus filtros) para
      // compartirla: al abrirla se recuperan los mismos datos.
      async copiarEnlaceVista() {
        let enlace = '';
        try { enlace = (typeof location !== 'undefined' && location) ? String(location.href) : ''; } catch (e) { enlace = ''; }
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(enlace);
          } else if (typeof document !== 'undefined' && document.createElement) {
            const caja = document.createElement('textarea');
            caja.value = enlace;
            document.body.appendChild(caja);
            caja.select();
            if (typeof document.execCommand === 'function') document.execCommand('copy');
            caja.remove();
          }
          this.showToast('🔗 Enlace de esta vista copiado: al abrirlo se ven los mismos filtros.');
        } catch (error) {
          this.showToast(`No se pudo copiar el enlace: ${error.message}`, 'error');
        }
      }
    };