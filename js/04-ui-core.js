'use strict';
    const UI = {
      currentModule: 'dashboard',
      loadingTimer: null,
      contentTimer: null,
      loadingStartedAt: 0,

      init() {
        this.bindEvents();
        this.initBuscadorGlobal();
        this.syncThemeIcon();
        this.renderCurrentModule();
      },

      showLoading(message) {
        const loading = document.getElementById('app-loading');
        const loadingMessage = document.getElementById('app-loading-message');
        const loadingCaption = document.getElementById('app-loading-caption');
        if (!loading) return;
        clearTimeout(this.loadingTimer);
        clearTimeout(this.contentTimer);
        this.loadingStartedAt = performance.now();
        loading.classList.remove('is-hidden', 'has-error');
        loading.setAttribute('role', 'status');
        loading.setAttribute('aria-hidden', 'false');
        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingCaption) loadingCaption.textContent = 'Un momento: estamos preparando tu información';
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

      showLoadingError(message) {
        const loading = document.getElementById('app-loading');
        const loadingMessage = document.getElementById('app-loading-message');
        const loadingCaption = document.getElementById('app-loading-caption');
        if (!loading) return;
        clearTimeout(this.loadingTimer);
        clearTimeout(this.contentTimer);
        loading.classList.remove('is-hidden');
        loading.classList.add('has-error');
        loading.setAttribute('role', 'alert');
        loading.setAttribute('aria-hidden', 'false');
        if (loadingMessage) loadingMessage.textContent = message;
        if (loadingCaption) loadingCaption.textContent = 'Verifica la conexión o recarga la página para reintentar.';
        this.reproducirEntradaCarga(loading);
        document.getElementById('workspace')?.removeAttribute('aria-busy');
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
          titulo: `${est.apellidos}, ${est.nombres}`,
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
    this.currentModule = 'grupos';
    this.actualizarNavActivo('grupos');
    this.renderCurrentModule();
    // [CORREGIDO] `:contains()` no es un selector CSS válido y lanzaba una
    // excepción silenciosa; ahora se usa un atributo data-grupo-id real.
    setTimeout(() => {
      const details = document.querySelector(`details[data-grupo-id="${id}"]`);
      if (details) { details.open = true; details.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 120);
  } else if (tipo === 'equipo') {
    this.currentModule = 'equipos';
    this.actualizarNavActivo('equipos');
    this.renderCurrentModule();
    setTimeout(() => {
      const details = document.querySelector(`details[data-equipo-id="${id}"]`);
      if (details) { details.open = true; details.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 120);
  } else {
    // Estudiante: ir a estudiantes o al grupo del estudiante
    this.currentModule = 'estudiantes';
    this.actualizarNavActivo('estudiantes');
    this.renderCurrentModule();
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
        if (!settingsBlocks.length) {
          this.closeSectionSettings(false);
          sidebar.hidden = true;
          return;
        }

        const viewHeader = workspace.querySelector('.view-header');
        if (!viewHeader) return;
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
        }

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
        document.querySelectorAll('.nav-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeSectionSettings(false);
            this.currentModule = item.getAttribute('data-module');
            this.actualizarNavActivo(this.currentModule);
            this.renderCurrentModule();
            // En móvil el menú se cierra tras navegar
            if (this.isMobileLayout()) this.closeSidebar();
            document.querySelector('.workspace')?.scrollTo({ top: 0, behavior: 'smooth' });
          });
        });
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
          if (!this.isMobileLayout()) this.closeSidebar();
        });
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
            html += `<tr><td>${idx + 1}</td><td><strong>${e.apellidos}, ${e.nombres}</strong></td>`;
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
          html += `<tr><td>${idx + 1}</td><td><strong>${e.apellidos}, ${e.nombres}</strong></td>`;
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
        const toggleIcon = document.querySelector('#btn-toggle-sidebar i');
        if (sidebar) {
          const expanded = sidebar.classList.toggle('expanded');
          sidebar.classList.remove('collapsed');
          const toggleButton = document.getElementById('btn-toggle-sidebar');
          if (toggleIcon) toggleIcon.className = expanded ? 'ri-menu-fold-line' : 'ri-menu-unfold-line';
          if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', String(expanded));
            toggleButton.title = expanded ? 'Contraer navegación' : 'Expandir navegación';
            toggleButton.setAttribute('aria-label', toggleButton.title);
          }
        }
      },

      openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.classList.add('show');
        const toggleIcon = document.querySelector('#btn-toggle-sidebar i');
        if (toggleIcon) toggleIcon.className = 'ri-close-line';
        const toggleButton = document.getElementById('btn-toggle-sidebar');
        if (toggleButton) {
          toggleButton.setAttribute('aria-expanded', 'true');
          toggleButton.title = 'Cerrar navegación';
          toggleButton.setAttribute('aria-label', toggleButton.title);
        }
      },

      closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
        if (sidebar && !this.isMobileLayout()) sidebar.classList.remove('expanded', 'collapsed');
        const toggleIcon = document.querySelector('#btn-toggle-sidebar i');
        if (toggleIcon) toggleIcon.className = this.isMobileLayout() ? 'ri-menu-fold-line' : 'ri-menu-unfold-line';
        const toggleButton = document.getElementById('btn-toggle-sidebar');
        if (toggleButton) {
          toggleButton.setAttribute('aria-expanded', 'false');
          toggleButton.title = this.isMobileLayout() ? 'Mostrar navegación' : 'Expandir navegación';
          toggleButton.setAttribute('aria-label', toggleButton.title);
        }
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
            this.renderCurrentModule();
          } catch (error) {
            const currentGroup = DataEngine.getGrupoById(groupId);
            if (currentGroup === group) group.estudiantes = previousStudents;
            console.error('No se pudo eliminar el estudiante:', error);
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
        const navLabel = document.querySelector(`.nav-item[data-module="${this.currentModule}"] span`)?.textContent.trim();
        if (!enBackground) this.showLoading(`Cargando ${navLabel || 'contenido'}...`);
        try {
          switch (this.currentModule) {
            case 'dashboard': workspace.innerHTML = this.renderDashboardView(); break;
            case 'grupos': workspace.innerHTML = this.renderGruposView(); break;
            case 'estudiantes': workspace.innerHTML = this.renderEstudiantesView(); break;
            case 'cuaderno':
            case 'cuaderno-docente': this.renderCuadernoDocente(); break;
            case 'envio-mensajes':
              workspace.innerHTML = MessageEngine.renderVistaMensajes();
              break;
            case 'estadisticas': workspace.innerHTML = StatsEngine.renderVistaEstadisticas(); break;
            case 'Examenes-Reparacion': workspace.innerHTML = ExamenesEngine.renderVistaExamenesReparaciones(); break;
            case 'informe-avance': workspace.innerHTML = InformeEngine.renderVista(); break;
            case 'equipos': workspace.innerHTML = EquiposEngine.renderVista(); break;
            case 'perfil': workspace.innerHTML = ProfileManager.renderVista(); break;
            case 'administracion':
              if (AuthManager.profile?.role !== 'admin') {
                this.currentModule = 'dashboard';
                this.actualizarNavActivo('dashboard');
                workspace.innerHTML = this.renderDashboardView();
                break;
              }
              workspace.innerHTML = AdminManager.renderVista();
              AdminManager.cargarUsuarios();
              break;
            default: workspace.innerHTML = `<div class="module-fade-enter"><h1>Módulo: ${this.currentModule}</h1></div>`;
          }
          this.mountSectionSettings();
          if (enBackground) workspace.classList.add('content-ready');
          else this.hideLoading();
        } catch (error) {
          this.showLoadingError('No se pudo cargar esta sección. Recarga la página para intentarlo de nuevo.');
          console.error(`Error al cargar el módulo "${this.currentModule}":`, error);
          throw error;
        }
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
        return `<div class="module-fade-enter"><div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-start;"><div><h1>¡Hola de nuevo, Hanzell Mayorga! 👋</h1><p>Bienvenido al panel principal de gestión docente en el <strong>Centro Tecnológico Ariel Darce</strong>.</p></div><div style="text-align: right;"><span class="badge-status activo" style="padding: 6px 12px; font-size: 0.8rem;"><i class="ri-checkbox-circle-fill"></i> Sistema en línea</span><p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">Última actualización: ${fechaSync}</p></div></div><div class="grid-cards"><div class="card-widget"><div class="widget-icon blue"><i class="ri-team-line"></i></div><div class="widget-info"><h4>Grupos Registrados</h4><div class="value">${totalGrupos}</div></div></div><div class="card-widget"><div class="widget-icon green"><i class="ri-user-follow-line"></i></div><div class="widget-info"><h4>Estudiantes Activos</h4><div class="value">${totalActivos} <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">/ ${totalEstudiantes}</span></div></div></div><div class="card-widget"><div class="widget-icon navy"><i class="ri-user-unfollow-line"></i></div><div class="widget-info"><h4>Estudiantes Retirados</h4><div class="value" style="color: ${totalRetirados > 0 ? '#B91C1C' : 'var(--text-main)'};">${totalRetirados}</div></div></div><div class="card-widget"><div class="widget-icon green"><i class="ri-file-excel-2-line"></i></div><div class="widget-info"><h4>Cuaderno STD</h4><div class="value" style="font-size: 1.1rem; color: var(--accent-green);">Sincronizado</div></div></div></div><div class="table-container" style="margin-top: 24px;"><div style="padding: 16px; font-weight: 600; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;"><span style="color: var(--primary-blue); display: flex; align-items: center; gap: 8px;"><i class="ri-list-check-2"></i> Resumen de Grupos Activos en DB.json</span><span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 400;">Total: ${totalGrupos} grupo(s)</span></div><table class="custom-table"><thead><tr><th>Código de Grupo</th><th>Carrera / Evento</th><th>Turno</th><th>Activos</th><th>Retirados</th><th>Total Alumnos</th></tr></thead><tbody>${totalGrupos === 0 ? `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);"><i class="ri-inbox-line" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>No hay ningún grupo registrado en el sistema.</td></tr>` : grupos.map(g => { const act = g.estudiantes ? g.estudiantes.filter(s => s.estado === 'Activo').length : 0; const ret = g.estudiantes ? g.estudiantes.filter(s => s.estado === 'Retirado').length : 0; return `<tr><td><strong>${g.nombre}</strong></td><td>${g.carrera}</td><td>${g.turno}</td><td><span class="badge-status activo">${act} activos</span></td><td><span class="badge-status retirado">${ret} retirados</span></td><td><strong>${g.estudiantes ? g.estudiantes.length : 0}</strong></td></tr>`; }).join('')}</tbody></table></div></div>`;
      },

      renderGruposView() {
        const grupos = DataEngine.db.grupos;
        const filaEstudiante = (s, g) => `<tr data-est-id="${s.id}"><td><strong>${s.nombres}</strong></td><td>${s.apellidos}</td><td>${s.correo}</td><td>${s.telefono}</td><td>${UI.renderBadgeEstado(s)}</td><td style="text-align: center; display: flex; justify-content: center; gap: 6px;"><button class="btn-icon" title="Editar Estudiante" onclick="UI.openEditStudentModal('${g.id}', '${s.id}')"><i class="ri-pencil-line" style="color: var(--secondary-blue);"></i></button><button class="btn-icon" title="Eliminar Estudiante" onclick="UI.deleteStudent('${g.id}', '${s.id}')"><i class="ri-delete-bin-line" style="color: #dc2626;"></i></button></td></tr>`;
        return `<div class="module-fade-enter"><div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;"><div><h1>Gestión de Grupos de Clase</h1><p>Carga el archivo Excel oficial para extraer alumnos y actualizar DB.json automáticamente.</p></div><div><button class="btn-primary" onclick="document.getElementById('excel-upload-input').click()"><i class="ri-file-excel-line"></i> Cargar Lista de Grupo (.xlsx)</button><input type="file" id="excel-upload-input" accept=".xlsx, .xls" style="display: none;" onchange="UI.handleExcelImport(event)"></div></div>${grupos.length === 0 ? `<div style="background: var(--white); padding: 40px; text-align: center; border-radius: var(--radius-md); border: 1px solid var(--border-color);"><i class="ri-folder-add-line" style="font-size: 3rem; color: var(--text-muted);"></i><h3 style="margin-top: 10px;">No hay grupos cargados</h3><p style="color: var(--text-muted); font-size: 0.85rem;">Haz clic en "Cargar Lista de Grupo" para procesar el listado oficial de INATEC.</p></div>` : grupos.map((g, index) => `<details class="group-accordion" data-grupo-id="${g.id}" ${index === 0 ? 'open' : ''}><summary><div style="display: flex; align-items: center; gap: 12px;"><i class="ri-arrow-right-s-line accordion-icon" style="font-size: 1.2rem; color: var(--primary-blue);"></i><div><h3 style="margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;"><i class="ri-group-line" style="color: var(--primary-blue);"></i> ${g.nombre}</h3><p style="margin: 2px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">${g.carrera} | Turno: ${g.turno}</p><p style="margin: 2px 0 0 0; font-size: 0.8rem;"><i class="ri-user-star-line" style="color: var(--secondary-blue);"></i> Docente Guía: <strong>${g.docenteGuia ? g.docenteGuia : '<span style=\"color: var(--text-muted); font-weight: 400;\">Sin asignar</span>'}</strong></p></div></div><div style="display: flex; align-items: center; gap: 12px;"><span class="badge-status activo"><i class="ri-user-line"></i> ${g.estudiantes.length} Estudiantes</span><button class="btn-icon" title="Asignar Docente Guía" onclick="event.stopPropagation(); UI.abrirModalDocenteGuia('${g.id}')"><i class="ri-user-star-line" style="color: var(--secondary-blue);"></i></button><button class="btn-icon btn-delete" title="Eliminar Grupo" onclick="event.stopPropagation(); UI.deleteGroup('${g.id}')"><i class="ri-delete-bin-line" style="color: #dc2626;"></i></button></div></summary><div class="table-container" style="border-top: 1px solid var(--border-color); border-radius: 0;"><table class="custom-table"><thead><tr><th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th style="text-align: center;">Acciones</th></tr></thead><tbody>${g.estudiantes.map(s => filaEstudiante(s, g)).join('')}</tbody></table></div></details>`).join('')}</div>`;
      },

      renderBadgeEstado(s) {
        // [NUEVO] Si el estudiante está Retirado y tiene un motivo registrado,
        // se muestra un ícono con tooltip nativo (title) para consultarlo rápido
        // sin abrir el modal de edición — pensado como soporte/bitácora interna.
        const base = `<span class="badge-status ${s.estado.toLowerCase()}">${s.estado}</span>`;
        if (s.estado === 'Retirado' && s.motivoRetiro && s.motivoRetiro.trim()) {
          return `${base} <i class="ri-information-line" title="Motivo: ${String(s.motivoRetiro).replace(/"/g, '&quot;')}" style="color: var(--text-muted); cursor: help; font-size: 0.95rem; vertical-align: middle;"></i>`;
        }
        if (s.estado === 'Retirado') {
          return `${base} <i class="ri-question-line" title="Sin motivo registrado" style="color: var(--text-disabled); cursor: help; font-size: 0.95rem; vertical-align: middle;"></i>`;
        }
        return base;
      },

      renderEstudiantesView() {
        const allStudents = DataEngine.getEstudiantes();
        return `<div class="module-fade-enter"><div class="view-header"><h1>Directorio General de Estudiantes</h1><p>Total registrado en el sistema: ${allStudents.length} alumnos.</p></div>
        <div class="group-header-card" data-section-settings data-settings-title="Filtro de estudiantes" style="gap:12px; flex-wrap:wrap;">
          <div style="display:flex; gap:8px; align-items:center;">
            <label class="tb-label"><i class="ri-filter-3-line"></i> Estado:</label>
            <select id="est-filtro-estado" class="form-control" style="width:170px;" onchange="UI.filtrarDirectorioEstudiantes()">
              <option value="todos">Todos</option>
              <option value="Activo">Solo Activos</option>
              <option value="Retirado">Solo Retirados</option>
            </select>
          </div>
          <div id="est-contador-filtro" style="font-size:0.78rem; color: var(--text-muted);">${allStudents.length} estudiante(s)</div>
        </div>
        <div class="table-container"><table class="custom-table"><thead><tr><th>Grupo</th><th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Teléfono</th><th>Estado</th><th style="text-align: center;">Acción</th></tr></thead><tbody id="tbody-directorio-estudiantes">${allStudents.map(s => `<tr data-est-id="${s.id}" data-estado="${s.estado}"><td><span class="badge-status activo">${s.grupoNombre}</span></td><td><strong>${s.nombres}</strong></td><td>${s.apellidos}</td><td>${s.correo}</td><td>${s.telefono}</td><td>${UI.renderBadgeEstado(s)}</td><td style="text-align: center;"><button class="btn-icon" onclick="UI.openEditStudentModal('${s.grupoId}', '${s.id}')"><i class="ri-pencil-line" style="color: var(--secondary-blue);"></i></button></td></tr>`).join('')}</tbody></table></div></div>`;
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
          <button type="button" class="btn-secondary" onclick="CuadernoEngine.abrirConfiguracionAcademica()">
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
        DataEngine.parseExcelGroup(file, (groupData) => {
          this.showToast(`Grupo ${groupData.nombre} cargado exitosamente (${groupData.estudiantes.length} estudiantes).`);
          this.renderCurrentModule();
        });
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
              this.renderCurrentModule();
            } catch (error) {
              const currentGroup = DataEngine.getGrupoById(groupId);
              const currentStudent = currentGroup?.estudiantes.find(item => item.id === studentId);
              if (currentStudent === student) Object.assign(student, previousStudent);
              console.error('No se pudo actualizar el estudiante:', error);
            }
          }
        }
      },

      showToast(msg) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="ri-check-line"></i> <span>${msg}</span>`;
        container.appendChild(toast);
        // [UI] Se desvanece con animación (.saliendo) y recién entonces
        // se retira del DOM, en lugar de desaparecer de golpe a los 3,2 s.
        setTimeout(() => {
          toast.classList.add('saliendo');
          setTimeout(() => toast.remove(), 260);
        }, 3000);
      }
    };