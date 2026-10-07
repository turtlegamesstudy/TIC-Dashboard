'use strict';
/* ═══════════════════════════════════════════════════════════════
   16 · MEJORAS DE INTERFAZ
   ───────────────────────────────────────────────────────────────
   Diez incrementos de usabilidad agrupados en un solo módulo para
   no dispersar los cambios por todo el panel (hoy trece):

    1 · Esqueletos de carga          6 · Paleta de comandos (Ctrl/Cmd + K)
    2 · Tarjetas KPI clicable        7 · Barra de filtros global
    3 · Panel de apariencia          8 · Cajón de detalle (estudiante)
    4 · Tablas ordenables            9 · Teclado y accesibilidad
    5 · Centro de avisos            10 · Microinteracciones (en style.css)

   Se carga después de todos los motores y no toca su lógica: solo
   envuelve dos funciones de UI (render y toast) y añade sus propios
   nodos al DOM. Si falta alguna dependencia, cada pieza se apaga
   sola sin romper la vista.
   ═══════════════════════════════════════════════════════════════ */
const Mejoras = (() => {

  /* ── utilidades locales ─────────────────────────────────────── */
  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  const esc = valor => String(valor === null || valor === undefined ? '' : valor)
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dormir = ms => new Promise(resolve => setTimeout(resolve, ms));

  const CLAVE_DENSIDAD = 'tic-densidad';
  const CLAVE_TEMA_PREF = 'tic-tema-pref';

  const leerLocal = (clave, porDefecto) => {
    try {
      const valor = localStorage.getItem(clave);
      return valor === null || valor === '' ? porDefecto : valor;
    } catch (e) { return porDefecto; }
  };
  const escribirLocal = (clave, valor) => {
    try {
      if (valor === null || valor === undefined) localStorage.removeItem(clave);
      else localStorage.setItem(clave, valor);
    } catch (e) { /* almacenamiento bloqueado */ }
  };

  const haySeccion = id => (typeof Secciones !== 'undefined' && Secciones && typeof Secciones.obtener === 'function'
    ? Boolean(Secciones.obtener(id)) : false);
  // Vistas que entienden cada clave de filtro: el «estado» es común al
  // directorio y a estadísticas (se aplica en las dos a la vez); el
  // «grupo» solo existe en estadísticas.
  const vistasDeEstado = () => ['estudiantes', 'estadisticas'].filter(haySeccion);
  const vistasDeGrupo  = () => ['estadisticas'].filter(haySeccion);
  const vistasConFiltro = () => vistasDeEstado().concat(vistasDeGrupo().filter(v => vistasDeEstado().indexOf(v) < 0));

  let iniciado = false;
  const avisos = [];
  const accionesAviso = new Map();
  let noLeidos = 0;
  const ordenTablas = {};

  // Orden elegido en una sesión anterior para esa vista (se guarda por
  // módulo: «estudiantes por apellidos, descendente», por ejemplo).
  const ordenGuardado = modulo => {
    try {
      const crudo = localStorage.getItem(`tic-orden-${modulo}`);
      if (!crudo) return null;
      const dato = JSON.parse(crudo);
      return dato && typeof dato.col === 'number' && (dato.dir === 'asc' || dato.dir === 'desc') ? dato : null;
    } catch (e) { return null; }
  };

  const gruposDb = () => (typeof DataEngine !== 'undefined' && DataEngine && DataEngine.db && Array.isArray(DataEngine.db.grupos))
    ? DataEngine.db.grupos : [];

  /* ═══════════════════════════════════════════════════════════
     ARRANQUE
     ═══════════════════════════════════════════════════════════ */
  function init() {
    if (iniciado || typeof document === 'undefined') return;
    iniciado = true;
    try { inyectarPiezas(); } catch (e) { console.warn('Mejoras · piezas:', e); }
    try { envolverUI(); } catch (e) { console.warn('Mejoras · envoltorios:', e); }
    try { instalarEventos(); } catch (e) { console.warn('Mejoras · eventos:', e); }
    try { aplicarPreferencias(); } catch (e) { console.warn('Mejoras · preferencias:', e); }
    try {
      cargarAvisos();
      pintarBadge();
      // Aviso de versión pendiente hasta que alguien la marque como vista.
      if (actualizacionPendiente()) {
        registrarAviso(`Hay una versión nueva del panel: v${VERSION}.`, 'sistema',
          { texto: 'Ver novedades', ejecutar: () => abrirActualizaciones() },
          { titulo: 'Actualización disponible', detalle: CAMBIOS[0] ? CAMBIOS[0].titulo : '',
            clave: 'version-nueva', icono: 'ri-award-line' });
      }
    } catch (e) { console.warn('Mejoras · avisos:', e); }
    try { iniciarMantenimiento(); } catch (e) { console.warn('Mejoras · mantenimiento:', e); }
  }

  /* Nodos propios: enlace de salto, botones de barra, cajones y
     paleta. Se insertan una sola vez. */
  function inyectarPiezas() {
    if (!$('.skip-link')) {
      const salto = document.createElement('a');
      salto.className = 'skip-link';
      salto.href = '#workspace';
      salto.textContent = 'Saltar al contenido principal';
      document.body.insertBefore(salto, document.body.firstChild);
    }

    inyectarTooltipGrafico();

    const topbar = $('.topbar-right');
    if (topbar && !$('#btn-apariencia')) {
      const grupo = document.createElement('div');
      grupo.className = 'topbar-mejoras';
      grupo.setAttribute('role', 'group');
      grupo.setAttribute('aria-label', 'Apariencia y avisos');
      grupo.innerHTML =
        '<button class="btn-icon" id="btn-apariencia" type="button" title="Apariencia del panel"' +
        ' aria-label="Ajustar la apariencia" aria-expanded="false" aria-controls="ajuste-drawer">' +
        '<i class="ri-palette-line" aria-hidden="true"></i></button>' +
        '<button class="btn-icon" id="btn-avisos" type="button" title="Centro de avisos"' +
        ' aria-label="Abrir el centro de avisos" aria-expanded="false" aria-controls="centro-avisos">' +
        '<i class="ri-notification-3-line" aria-hidden="true"></i>' +
        '<span class="campana-badge" id="campana-badge" hidden></span></button>';
      topbar.insertBefore(grupo, topbar.firstElementChild);
    }

    // Atajo visible junto al buscador existente: lo abre la paleta.
    const barraIzquierda = $('.topbar-left');
    if (barraIzquierda && !$('#paleta-atajo')) {
      const atajo = document.createElement('button');
      atajo.type = 'button';
      atajo.id = 'paleta-atajo';
      atajo.className = 'paleta-atajo';
      atajo.title = 'Buscar módulos, estudiantes y acciones (Ctrl + K)';
      atajo.setAttribute('aria-label', 'Abrir la paleta de comandos');
      atajo.innerHTML = '<kbd>Ctrl</kbd><kbd>K</kbd>';
      barraIzquierda.appendChild(atajo);
    }

    if (!$('#ajuste-drawer')) {
      const fondo = document.createElement('div');
      fondo.className = 'mejoras-fondo';
      fondo.id = 'mejoras-fondo';
      fondo.hidden = true;
      document.body.appendChild(fondo);

      const cajon = document.createElement('aside');
      cajon.className = 'ajuste-drawer';
      cajon.id = 'ajuste-drawer';
      cajon.setAttribute('role', 'dialog');
      cajon.setAttribute('aria-modal', 'true');
      cajon.setAttribute('aria-labelledby', 'ajuste-titulo');
      cajon.hidden = true;
      cajon.setAttribute('inert', '');
      document.body.appendChild(cajon);

      const detalle = document.createElement('aside');
      detalle.className = 'detalle-drawer';
      detalle.id = 'detalle-drawer';
      detalle.setAttribute('role', 'dialog');
      detalle.setAttribute('aria-labelledby', 'detalle-titulo');
      detalle.hidden = true;
      detalle.setAttribute('inert', '');
      document.body.appendChild(detalle);
    }

    if (!$('#centro-avisos')) {
      const centro = document.createElement('section');
      centro.className = 'centro-avisos';
      centro.id = 'centro-avisos';
      centro.setAttribute('role', 'dialog');
      centro.setAttribute('aria-labelledby', 'avisos-titulo');
      centro.hidden = true;
      document.body.appendChild(centro);
    }

    if (!$('#modal-actualizaciones')) {
      const actualizaciones = document.createElement('div');
      actualizaciones.id = 'modal-actualizaciones';
      actualizaciones.className = 'modal-overlay hidden';
      document.body.appendChild(actualizaciones);
    }

    if (!$('#paleta-fondo')) {
      const fondoPaleta = document.createElement('div');
      fondoPaleta.className = 'paleta-fondo';
      fondoPaleta.id = 'paleta-fondo';
      fondoPaleta.hidden = true;
      fondoPaleta.innerHTML =
        '<div class="paleta" role="dialog" aria-modal="true" aria-label="Paleta de comandos">' +
          '<div class="paleta-busqueda">' +
            '<i class="ri-search-line" aria-hidden="true"></i>' +
            '<input id="paleta-input" type="text" autocomplete="off" spellcheck="false"' +
            ' placeholder="Ir a un módulo, buscar estudiante o ejecutar una acción…"' +
            ' role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-autocomplete="list">' +
            '<kbd>Esc</kbd>' +
          '</div>' +
          '<div class="paleta-modos" role="group" aria-label="Filtrar por tipo de resultado">' +
            '<button type="button" class="paleta-modo" data-paleta-modo="todo" aria-pressed="true">Todo</button>' +
            '<button type="button" class="paleta-modo" data-paleta-modo="modulos" aria-pressed="false">Ir a</button>' +
            '<button type="button" class="paleta-modo" data-paleta-modo="estudiantes" aria-pressed="false">Estudiantes</button>' +
            '<button type="button" class="paleta-modo" data-paleta-modo="grupos" aria-pressed="false">Grupos</button>' +
            '<button type="button" class="paleta-modo" data-paleta-modo="acciones" aria-pressed="false">Acciones</button>' +
          '</div>' +
          '<ul class="paleta-lista" id="paleta-lista" role="listbox" aria-label="Resultados"></ul>' +
          '<div class="paleta-vacio" id="paleta-vacio" hidden>' +
            '<i class="ri-search-2-line" aria-hidden="true"></i>' +
            '<p>Sin resultados para esa búsqueda. Cambia el modo o prueba con:</p>' +
            '<div class="paleta-sugerencias">' +
              '<button type="button" data-sugerencia="estad">Estadísticas</button>' +
              '<button type="button" data-sugerencia="conval">Convalidaciones</button>' +
              '<button type="button" data-sugerencia="tema">Tema</button>' +
              '<button type="button" data-sugerencia="perfil">Mi perfil</button>' +
            '</div>' +
          '</div>' +
          '<div class="paleta-pie">' +
            '<span><kbd>↑</kbd><kbd>↓</kbd> moverse</span>' +
            '<span><kbd>Intro</kbd> abrir</span>' +
            '<span><kbd>Esc</kbd> cerrar</span>' +
          '</div>' +
        '</div>';
      document.body.appendChild(fondoPaleta);
    }

    if (!$('#filtros-globales')) {
      const barra = document.createElement('div');
      barra.className = 'filtros-globales';
      barra.id = 'filtros-globales';
      barra.setAttribute('role', 'region');
      barra.setAttribute('aria-label', 'Filtros globales');
      barra.hidden = true;
      const wrapper = $('.main-wrapper');
      const main = $('main.workspace') || $('#workspace');
      if (wrapper && main) wrapper.insertBefore(barra, main);
      else document.body.appendChild(barra);
    }
  }

  /* Envuelve render y toast para enganchar mejoras sin tocar el
     código original de UI. */
  function envolverUI() {
    if (typeof UI === 'undefined' || !UI) return;

    if (typeof UI.renderCurrentModule === 'function' && !UI.renderCurrentModule._mejoras) {
      const render = UI.renderCurrentModule.bind(UI);
      UI.renderCurrentModule = function (options) {
        const salida = render(options);
        try { trasRender(); } catch (e) { console.warn('Mejoras · tras render:', e); }
        return salida;
      };
      UI.renderCurrentModule._mejoras = true;
    }

    if (typeof UI.showToast === 'function' && !UI.showToast._mejoras) {
      const toast = UI.showToast.bind(UI);
      UI.showToast = function (msg, tipo, accion) {
        try {
          registrarAviso(msg, tipo, accion && typeof accion === 'object' ? accion : null);
        } catch (e) { /* el aviso central es optativo */ }
        return toast(msg, tipo);
      };
      UI.showToast._mejoras = true;
    }
  }

  function aplicarPreferencias() {
    aplicarDensidad();
    aplicarTemaPref();
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mq && typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', () => {
        if (leerLocal(CLAVE_TEMA_PREF, 'sistema') === 'sistema') aplicarTemaPref();
      });
    }
  }

  /* Lo que se rehace tras cada pintado de módulo. */
  function trasRender() {
    if (!document.getElementById('workspace')) return;
    esqueletoAdmin();
    mejorarTablas();
    marcarKPIs();
    actualizarBarraFiltros();
    try { pintarSeguimiento(); } catch (e) { console.warn('Mejoras · seguimiento:', e); }
    try {
      pintarMantenimiento();
      // La bandera se relee como mucho una vez por minuto.
      if (Date.now() - ultimoRefresco > 60000) refrescarMantenimiento();
    } catch (e) { console.warn('Mejoras · mantenimiento:', e); }
  }

  /* ═══════════════════════════════════════════════════════════
     1 · ESQUELETOS DE CARGA
     ═══════════════════════════════════════════════════════════ */
  function esqueletoHTML(tipo) {
    if (tipo === 'tabla') {
      const filas = [18, 26, 22, 14].map((ancho, i) =>
        `<div class="sk-fila" style="--sk-delay:${i * 90}ms">` +
        `<span class="sk-celda" style="width:${ancho}%"></span>` +
        `<span class="sk-celda" style="width:${[26, 30, 24, 32][i % 4]}%"></span>` +
        `<span class="sk-celda" style="width:${[22, 18, 28, 20][i % 4]}%"></span>` +
        `<span class="sk-celda sk-corta" style="width:10%"></span></div>`).join('');
      return `<div class="esqueleto esqueleto-tabla" aria-hidden="true">${filas}</div>`;
    }
    if (tipo === 'tarjetas') {
      return `<div class="esqueleto esqueleto-tarjetas" aria-hidden="true">${
        Array.from({ length: 4 }, (_, i) =>
          `<div class="sk-tarjeta" style="--sk-delay:${i * 110}ms">` +
          `<span class="sk-bloque"></span><span class="sk-linea" style="width:70%"></span>` +
          `<span class="sk-linea corta" style="width:45%"></span></div>`).join('')}</div>`;
    }
    return `<div class="esqueleto esqueleto-texto" aria-hidden="true">${
      [92, 76, 88, 64].map((ancho, i) =>
        `<span class="sk-linea" style="width:${ancho}%; --sk-delay:${i * 90}ms"></span>`).join('')}</div>`;
  }

  // Puesto en público: otras vistas con carga asíncrona pueden usarlo.
  function ponerEsqueleto(destino, tipo) {
    const alvo = typeof destino === 'string' ? $(destino) : destino;
    if (!alvo) return false;
    alvo.innerHTML = esqueletoHTML(tipo || 'texto');
    alvo.setAttribute('aria-busy', 'true');
    return true;
  }

  // Administración: mientras Firebase devuelve las cuentas, la lista
  // muestra filas de esqueleto en lugar de una sola línea de texto.
  function esqueletoAdmin() {
    if (UI.currentModule !== 'administracion') return;
    const lista = document.getElementById('admin-users-list');
    if (!lista) return;
    if ($('.admin-users-message', lista)) {
      lista.innerHTML = esqueletoHTML('tabla') +
        '<p class="admin-users-message">Cargando cuentas…</p>';
      lista.setAttribute('aria-busy', 'true');
    } else if (lista.getAttribute('aria-busy') === 'true') {
      lista.removeAttribute('aria-busy');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     2 · TARJETAS KPI CLICABLES
     ═══════════════════════════════════════════════════════════ */
  // Traduce el rótulo de una tarjeta a la vista y el filtro que
  // responden a esa pregunta: «¿cuántos retirados?» → el directorio
  // con el filtro de estado ya puesto.
  function destinoDeKPI(rotulo) {
    const t = normalizar(rotulo);
    if (!t) return null;
    if (/(sincronizado|cuaderno)/.test(t)) return { vista: 'cuaderno-docente', params: {}, rotulo: 'Cuaderno Docente' };
    if (/centro/.test(t)) return { vista: 'administracion', admin: { estado: 'todos' }, rotulo: 'Centros' };
    if (/administrador/.test(t)) return { vista: 'administracion', admin: { rol: 'admin' }, rotulo: 'Administradores' };
    if (/docente/.test(t)) return { vista: 'administracion', admin: { rol: 'docente' }, rotulo: 'Docentes' };
    if (/cuenta/.test(t)) return { vista: 'administracion', admin: { estado: /activ/.test(t) ? 'activas' : 'todos' }, rotulo: 'Cuentas' };
    if (/retirad/.test(t)) return { vista: 'estudiantes', params: { estado: 'Retirado' }, rotulo: 'Retirados' };
    if (/activo/.test(t)) return { vista: 'estudiantes', params: { estado: 'Activo' }, rotulo: 'Activos' };
    if (/rendimiento|cobertura|convalid|riesgo|calificac|promedio/.test(t)) return { vista: 'estadisticas', params: {}, rotulo: 'Rendimiento' };
    if (/estudiante|matricula/.test(t)) return { vista: 'estudiantes', params: {}, rotulo: 'Estudiantes' };
    if (/grupo/.test(t)) return { vista: 'grupos', params: {}, rotulo: 'Grupos' };
    return null;
  }

  function marcarKPIs() {
    $$('#workspace .kpi-card').forEach(card => {
      const rotulo = ($('.kpi-texto', card) || $('.kpi-etiqueta', card) || {}).textContent || '';
      const destino = destinoDeKPI(rotulo);
      if (!destino) return;
      card.classList.add('kpi-clicable');
      card.dataset.kpiDestino = destino.vista;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Ver el detalle de ${destino.rotulo}`);
      card._kpiDestino = destino;
    });
  }

  function activarKPI(card) {
    const destino = card._kpiDestino || destinoDeKPI(($('.kpi-texto', card) || card).textContent || '');
    if (!destino) return;
    if (typeof Secciones !== 'undefined' && Secciones.puedeVer) {
      const seccion = Secciones.obtener(destino.vista);
      if (!seccion || !Secciones.puedeVer(seccion, (typeof AuthManager !== 'undefined' && AuthManager.profile) || {})) {
        UI.showToast('ℹ️ Ese módulo no está disponible para tu perfil.', 'info');
        return;
      }
    }
    if (destino.admin) {
      UI.irA('administracion');
      window.setTimeout(() => {
        if (typeof AdminManager === 'undefined' || !AdminManager) return;
        AdminManager._filtros = Object.assign({ texto: '', rol: 'todos', estado: 'todos' }, destino.admin);
        const buscar = document.querySelector('[data-admin-search]');
        if (buscar) buscar.value = AdminManager._filtros.texto;
        const selRol = document.querySelector('[data-admin-filter-rol]');
        if (selRol) selRol.value = AdminManager._filtros.rol;
        const selEstado = document.querySelector('[data-admin-filter-estado]');
        if (selEstado) selEstado.value = AdminManager._filtros.estado;
        if (typeof AdminManager._repintarCuentas === 'function') AdminManager._repintarCuentas();
      }, 60);
      UI.showToast(`🔎 Abriendo la lista filtrada: ${destino.rotulo.toLowerCase()}.`, 'info');
      return;
    }
    const params = destino.params || {};
    UI.fijarFiltros(destino.vista, params);
    UI.irA(destino.vista);
    const resumen = Object.keys(params).map(k => `${k}: ${params[k]}`).join(' · ');
    UI.showToast(resumen
      ? `🔎 Filtro aplicado desde la tarjeta → ${resumen}`
      : `🔎 Abriendo ${destino.rotulo} desde la tarjeta.`, 'info');
    if (destino.vista === UI.currentModule) {
      const ancla = document.querySelector('.panel-graficos, .table-container, .admin-resumen');
      if (ancla && ancla.scrollIntoView) ancla.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     3 · PANEL DE APARIENCIA
     ═══════════════════════════════════════════════════════════ */
  function snapshotApariencia() {
    return {
      tema: leerLocal(CLAVE_TEMA_PREF, 'sistema'),
      movimiento: (typeof Ajustes !== 'undefined' && Ajustes) ? Ajustes.movimiento() : 'auto',
      densidad: leerLocal(CLAVE_DENSIDAD, 'comoda'),
      menu: (typeof Ajustes !== 'undefined' && Ajustes) ? Ajustes.menu() : 'expandido'
    };
  }

  function restaurarApariencia(snap) {
    if (!snap) return;
    escribirLocal(CLAVE_TEMA_PREF, snap.tema);
    aplicarTemaPref();
    if (typeof Ajustes !== 'undefined' && Ajustes) {
      Ajustes.ponerMovimiento(snap.movimiento);
      Ajustes.ponerMenu(snap.menu);
      if (typeof UI !== 'undefined' && UI.aplicarMenuGuardado) UI.aplicarMenuGuardado();
    }
    escribirLocal(CLAVE_DENSIDAD, snap.densidad);
    aplicarDensidad();
    pintarApariencia();
  }

  function grupoSegmentos(clave, titulo, icono, opciones, valorActual, nota) {
    const botones = opciones.map(([valor, etiqueta]) =>
      `<button type="button" role="radio" class="segmento${valor === valorActual ? ' activo' : ''}"` +
      ` aria-checked="${valor === valorActual}" data-ajuste="${esc(clave)}" data-valor="${esc(valor)}">${esc(etiqueta)}</button>`).join('');
    return `<fieldset class="ajuste-grupo"><legend><i class="${icono}" aria-hidden="true"></i> ${esc(titulo)}</legend>` +
      `<div class="segmentos" role="radiogroup" aria-label="${esc(titulo)}">${botones}</div>` +
      `<p class="ajuste-nota">${esc(nota)}</p></fieldset>`;
  }

  function pintarApariencia() {
    const drawer = document.getElementById('ajuste-drawer');
    if (!drawer) return;
    const snap = snapshotApariencia();
    drawer.innerHTML =
      `<header class="drawer-cabecera">
         <div>
           <h2 id="ajuste-titulo"><i class="ri-palette-line" aria-hidden="true"></i> Apariencia</h2>
           <p>Se guarda en este equipo y se aplica en todo el panel.</p>
         </div>
         <button class="btn-icon" type="button" data-cerrar-drawer aria-label="Cerrar apariencia"><i class="ri-close-line" aria-hidden="true"></i></button>
       </header>
       <div class="drawer-cuerpo">
         ${grupoSegmentos('tema', 'Tema', 'ri-contrast-line',
        [['sistema', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']], snap.tema,
        '«Sistema» acompaña al modo claro u oscuro del equipo. El claro es el modo oficial del panel.')}
         ${grupoSegmentos('movimiento', 'Animaciones', 'ri-animating-line',
        [['auto', 'Sistema'], ['on', 'Activadas'], ['off', 'Desactivadas']], snap.movimiento,
        (typeof Ajustes !== 'undefined' && Ajustes && typeof Ajustes.notaMovimiento === 'function')
          ? Ajustes.notaMovimiento(snap.movimiento) : 'Controla las transiciones y revelados.')}
         ${grupoSegmentos('densidad', 'Densidad de tablas', 'ri-list-check-2',
        [['comoda', 'Cómoda'], ['compacta', 'Compacta']], snap.densidad,
        '«Compacta» muestra más filas en pantalla sin desplazar.')}
         ${grupoSegmentos('menu', 'Menú lateral', 'ri-menu-line',
        [['expandido', 'Con etiquetas'], ['iconos', 'Solo iconos']], snap.menu,
        'El modo «solo iconos» cabe también en pantallas estrechas.')}
         <button class="btn-ghost ajuste-restablecer" type="button" data-restablecer-apariencia>
           <i class="ri-refresh-line" aria-hidden="true"></i> Restablecer apariencia
         </button>
       </div>`;
  }

  function aplicarTemaPref() {
    if (typeof UI === 'undefined' || !UI.applyTheme) return;
    const pref = leerLocal(CLAVE_TEMA_PREF, 'sistema');
    let tema = pref;
    if (pref === 'sistema') {
      tema = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    if (tema !== 'light' && tema !== 'dark') tema = 'light';
    UI.applyTheme(tema);
  }

  function aplicarDensidad() {
    const valor = leerLocal(CLAVE_DENSIDAD, 'comoda');
    const raiz = document.documentElement;
    if (valor === 'compacta') raiz.setAttribute('data-densidad', 'compacta');
    else raiz.removeAttribute('data-densidad');
  }

  function cambiarAjuste(clave, valor) {
    const antes = snapshotApariencia();
    const etiquetas = {
      tema: { sistema: 'Sistema', light: 'Claro', dark: 'Oscuro' },
      movimiento: { auto: 'Sistema', on: 'Activadas', off: 'Desactivadas' },
      densidad: { comoda: 'Cómoda', compacta: 'Compacta' },
      menu: { expandido: 'Con etiquetas', iconos: 'Solo iconos' }
    };
    if (clave === 'tema') {
      escribirLocal(CLAVE_TEMA_PREF, valor);
      aplicarTemaPref();
    } else if (clave === 'movimiento' && typeof Ajustes !== 'undefined' && Ajustes) {
      Ajustes.ponerMovimiento(valor);
    } else if (clave === 'densidad') {
      escribirLocal(CLAVE_DENSIDAD, valor);
      aplicarDensidad();
    } else if (clave === 'menu' && typeof Ajustes !== 'undefined' && Ajustes) {
      Ajustes.ponerMenu(valor);
      if (typeof UI !== 'undefined' && UI.aplicarMenuGuardado) UI.aplicarMenuGuardado();
    } else return;
    pintarApariencia();
    const rotulo = clave === 'tema' ? 'Tema' : clave === 'movimiento' ? 'Animaciones' : clave === 'densidad' ? 'Densidad' : 'Menú';
    UI.showToast(
      `${rotulo}: ` +
      `${(etiquetas[clave] || {})[valor] || valor}.`,
      'success',
      { texto: 'Deshacer', ejecutar: () => restaurarApariencia(antes) });
    registrarEvento({
      tipo: 'cambio', titulo: 'Apariencia modificada',
      texto: `${rotulo}: ${(etiquetas[clave] || {})[valor] || valor}.`,
      detalle: `Anterior: ${(etiquetas[clave] || {})[antes[clave]] || antes[clave] || 'sin cambiar'}`,
      clave: `apariencia-${clave}`
    });
  }

  function abrirApariencia() {
    const drawer = document.getElementById('ajuste-drawer');
    const fondo = document.getElementById('mejoras-fondo');
    if (!drawer) return;
    pintarApariencia();
    cerrarDetalle(true);
    drawer.hidden = false;
    drawer.removeAttribute('inert');
    if (fondo) fondo.hidden = false;
    document.getElementById('btn-apariencia')?.setAttribute('aria-expanded', 'true');
    window.setTimeout(() => { const primero = drawer.querySelector('[data-ajuste][aria-checked="true"]') || drawer.querySelector('button'); primero?.focus(); }, 40);
  }

  function cerrarApariencia() {
    const drawer = document.getElementById('ajuste-drawer');
    const fondo = document.getElementById('mejoras-fondo');
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    drawer.setAttribute('inert', '');
    if (fondo && (!document.getElementById('detalle-drawer') || document.getElementById('detalle-drawer').hidden)) fondo.hidden = true;
    document.getElementById('btn-apariencia')?.setAttribute('aria-expanded', 'false');
    document.getElementById('btn-apariencia')?.focus();
  }

  /* ═══════════════════════════════════════════════════════════
     5 · CENTRO DE AVISOS
     ═══════════════════════════════════════════════════════════ */
  const CLAVE_AVISOS = 'tic-avisos';
  const TOPE_AVISOS = 150;
  const filtrosAvisos = { texto: '', tipo: 'todos', periodo: 'todo', persona: 'todas', leido: 'todos' };

  /* Tipos que se pueden filtrar y su rótulo visible. */
  const TIPOS_AVISO = {
    confirmacion: 'Confirmaciones',
    cambio: 'Cambios',
    error: 'Errores',
    advertencia: 'Advertencias',
    info: 'Información',
    sistema: 'Sistema'
  };

  function usuarioActual() {
    try {
      if (typeof AuthManager === 'undefined' || !AuthManager) return null;
      const perfil = AuthManager.profile || {};
      return perfil.displayName || (AuthManager.user && AuthManager.user.displayName) || null;
    } catch (e) { return null; }
  }

  /* La lista de avisos sobrevive a los recargas: se guarda en el
     equipo y se cuenta cuántos quedan sin leer. */
  function cargarAvisos() {
    let crudos = null;
    try { crudos = JSON.parse(localStorage.getItem(CLAVE_AVISOS) || 'null'); } catch (e) { crudos = null; }
    if (Array.isArray(crudos)) {
      crudos.slice(0, TOPE_AVISOS).forEach(a => {
        if (a && a.id && typeof a.ts === 'number') avisos.push(a);
      });
    }
    noLeidos = avisos.filter(a => !a.leido).length;
  }

  function guardarAvisos() {
    try { localStorage.setItem(CLAVE_AVISOS, JSON.stringify(avisos.slice(0, TOPE_AVISOS))); }
    catch (e) { /* almacenamiento lleno o bloqueado */ }
  }

  function contarNoLeidos() {
    noLeidos = avisos.filter(a => !a.leido).length;
    pintarBadge();
  }

  function marcarLeido(id) {
    const aviso = avisos.find(a => a.id === id);
    if (!aviso || aviso.leido) return;
    aviso.leido = true;
    contarNoLeidos();
    guardarAvisos();
    pintarCentroAvisos();
  }

  function registrarAviso(texto, tipo, accion, extra) {
    extra = extra || {};
    let meta = { titulo: 'Aviso', clase: 'info', icono: 'ri-information-line' };
    if (typeof UI !== 'undefined' && typeof UI.metaAviso === 'function') {
      const tipoAviso = typeof UI.tipoDeAviso === 'function' ? UI.tipoDeAviso(texto, tipo) : String(tipo || 'info');
      meta = UI.metaAviso(tipoAviso) || meta;
    }
    const limpio = String(texto === null || texto === undefined ? '' : texto)
      .replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2139}\u{FE0F}\s]+/u, '').trim() || String(texto);
    const clase = String(extra.clase || meta.clase || 'info').replace(/^aviso-/, '');
    const porClase = { success: 'confirmacion', error: 'error', warning: 'advertencia' };
    const tipoFinal = TIPOS_AVISO[extra.tipo] ? extra.tipo : (porClase[clase] || 'info');
    const ahora = Date.now();
    const aviso = {
      id: `av-${ahora}-${Math.random().toString(36).slice(2, 7)}`,
      ts: ahora,
      hora: new Date(ahora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tipo: tipoFinal,
      clase,
      icono: extra.icono || meta.icono || 'ri-information-line',
      titulo: extra.titulo || meta.titulo || 'Aviso',
      texto: limpio,
      persona: extra.persona || usuarioActual() || 'Este equipo',
      afectado: extra.afectado || null,
      seccion: extra.seccion || (typeof UI !== 'undefined' && UI ? UI.currentModule : null),
      detalle: extra.detalle || null,
      clave: extra.clave || null,
      leido: false
    };
    // Mismo evento repetido en los últimos minutos → se refresca en
    // lugar de llenar la lista (p. ej. aplicar el mismo filtro).
    if (aviso.clave) {
      const indice = avisos.findIndex(a => a.clave === aviso.clave && ahora - a.ts < 5 * 60000);
      if (indice >= 0) {
        const viejo = avisos[indice];
        aviso.id = viejo.id;
        aviso.leido = false;
        avisos.splice(indice, 1);
        accionesAviso.delete(viejo.id);
      }
    }
    avisos.unshift(aviso);
    aviso.conAccion = Boolean(accion && typeof accion.ejecutar === 'function');
    if (aviso.conAccion) accionesAviso.set(aviso.id, accion);
    while (avisos.length > TOPE_AVISOS) {
      const fuera = avisos.pop();
      if (fuera) accionesAviso.delete(fuera.id);
    }
    contarNoLeidos();
    guardarAvisos();
    if (!document.getElementById('centro-avisos')?.hidden) pintarCentroAvisos();
  }

  /* Entrada pública para registrar eventos con más contexto
     (persona afectada, detalle del cambio, clave de agrupación). */
  function registrarEvento(datos) {
    const d = datos || {};
    return registrarAviso(d.texto, d.tipo || 'info', d.accion || null, d);
  }

  function pintarBadge() {
    const badge = document.getElementById('campana-badge');
    if (!badge) return;
    if (noLeidos > 0) {
      badge.hidden = false;
      badge.textContent = noLeidos > 9 ? '9+' : String(noLeidos);
      badge.classList.add('pulse');
    } else {
      badge.hidden = true;
      badge.textContent = '';
    }
  }

  function inicioDelDia(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function cortePeriodo() {
    const hoy = inicioDelDia(Date.now());
    if (filtrosAvisos.periodo === 'hoy') return hoy;
    if (filtrosAvisos.periodo === '7') return hoy - 6 * 86400000;
    if (filtrosAvisos.periodo === '30') return hoy - 29 * 86400000;
    return 0;
  }

  /* Aplica los cinco filtros del panel: texto, tipo, periodo,
     persona y estado de lectura. */
  function avisosFiltrados() {
    const f = filtrosAvisos;
    const q = normalizar(f.texto);
    const corte = cortePeriodo();
    const yo = usuarioActual();
    return avisos.filter(a => {
      if (f.tipo !== 'todos' && a.tipo !== f.tipo) return false;
      if (corte && a.ts < corte) return false;
      if (f.persona !== 'todas') {
        const nombres = [a.persona, a.afectado].filter(Boolean);
        const buscado = f.persona === 'yo' ? yo : f.persona;
        if (!buscado || nombres.indexOf(buscado) < 0) return false;
      }
      if (f.leido === 'no' && a.leido) return false;
      if (f.leido === 'si' && !a.leido) return false;
      if (q) {
        const bloque = normalizar([a.titulo, a.texto, a.detalle, a.persona, a.afectado, a.seccion]
          .filter(Boolean).join(' '));
        if (bloque.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function personasDeAvisos() {
    const lista = [];
    avisos.forEach(a => [a.persona, a.afectado].forEach(n => {
      if (n && lista.indexOf(n) < 0) lista.push(n);
    }));
    return lista.sort((x, y) => x.localeCompare(y));
  }

  function rotuloDia(ts) {
    const hoy = inicioDelDia(Date.now());
    const dia = inicioDelDia(ts);
    if (dia === hoy) return 'Hoy';
    if (dia === hoy - 86400000) return 'Ayer';
    return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function rotuloSeccion(id) {
    try {
      if (typeof Secciones !== 'undefined' && Secciones && typeof Secciones.obtener === 'function') {
        const sec = Secciones.obtener(id);
        if (sec && sec.etiqueta) return sec.etiqueta;
      }
    } catch (e) { /* sección retirada */ }
    return id || '';
  }

  function itemAvisoHTML(aviso) {
    const accion = accionesAviso.get(aviso.id);
    const icono = aviso.icono || ({
      confirmacion: 'ri-checkbox-circle-line', cambio: 'ri-history-line',
      error: 'ri-error-warning-line', advertencia: 'ri-alert-line',
      sistema: 'ri-refresh-line'
    }[aviso.tipo] || 'ri-information-line');
    return `<li class="aviso-item aviso-${esc(aviso.clase || 'info')}${aviso.leido ? '' : ' no-leido'}"` +
      ` data-aviso="${esc(aviso.id)}" data-tipo="${esc(aviso.tipo || 'info')}"` +
      ` data-persona="${esc(aviso.persona || '')}" data-afectado="${esc(aviso.afectado || '')}"` +
      ` tabindex="0" role="button"` +
      ` aria-label="${aviso.leido ? 'Aviso leído' : 'Aviso sin leer. Marcar como leído'}">` +
      `<span class="aviso-icono"><i class="${esc(icono)}" aria-hidden="true"></i></span>` +
      `<span class="aviso-cuerpo">` +
        `<span class="aviso-cab"><strong>${esc(aviso.titulo)}</strong><time>${esc(aviso.hora)}</time></span>` +
        `<span class="aviso-texto">${esc(aviso.texto)}</span>` +
        `${aviso.detalle ? `<small class="aviso-detalle">${esc(aviso.detalle)}</small>` : ''}` +
        `<span class="aviso-etiquetas">` +
          `<span class="aviso-chip"><i class="ri-user-line" aria-hidden="true"></i>${esc(aviso.persona || '—')}</span>` +
          `${aviso.afectado ? `<span class="aviso-chip aviso-chip-afectado"><i class="ri-user-heart-line" aria-hidden="true"></i>${esc(aviso.afectado)}</span>` : ''}` +
          `${aviso.seccion ? `<span class="aviso-chip aviso-chip-seccion"><i class="ri-compass-2-line" aria-hidden="true"></i>${esc(rotuloSeccion(aviso.seccion))}</span>` : ''}` +
        `</span>` +
        `${accion ? `<button type="button" class="btn-ghost aviso-accion" data-aviso-accion="${esc(aviso.id)}">${esc(accion.texto || 'Deshacer')}</button>` : ''}` +
      `</span>` +
      `</li>`;
  }

  function filtrosAvisosHTML(vista) {
    const f = filtrosAvisos;
    const yo = usuarioActual();
    const chips = ['todos'].concat(Object.keys(TIPOS_AVISO)).map(t => {
      const activo = f.tipo === t;
      return `<button type="button" class="af-chip${activo ? ' activo' : ''}" data-avisos-tipo="${t}"` +
        ` aria-pressed="${activo}">${t === 'todos' ? 'Todo' : esc(TIPOS_AVISO[t])}</button>`;
    }).join('');
    const nombres = personasDeAvisos();
    const opciones = ['<option value="todas">Todas las personas</option>'];
    if (yo) opciones.push(`<option value="yo"${f.persona === 'yo' ? ' selected' : ''}>Solo yo (${esc(yo)})</option>`);
    nombres.forEach(n => {
      if (n === yo) return;
      opciones.push(`<option value="${esc(n)}"${f.persona === n ? ' selected' : ''}>${esc(n)}</option>`);
    });
    const hayFiltro = Boolean(f.texto) || f.tipo !== 'todos' || f.periodo !== 'todo' ||
      f.persona !== 'todas' || f.leido !== 'todos';
    return `<div class="avisos-filtros">
        <div class="af-busqueda">
          <i class="ri-search-line" aria-hidden="true"></i>
          <input type="search" id="aviso-busqueda" placeholder="Buscar por texto, persona o sección…"
            value="${esc(f.texto)}" aria-label="Buscar en los avisos">
        </div>
        <div class="af-chips" role="group" aria-label="Filtrar por tipo">${chips}</div>
        <div class="af-filas">
          <label class="af-campo"><span>Periodo</span>
            <select data-av-periodo aria-label="Filtrar por fecha">
              <option value="todo"${f.periodo === 'todo' ? ' selected' : ''}>Todo</option>
              <option value="hoy"${f.periodo === 'hoy' ? ' selected' : ''}>Hoy</option>
              <option value="7"${f.periodo === '7' ? ' selected' : ''}>Últimos 7 días</option>
              <option value="30"${f.periodo === '30' ? ' selected' : ''}>Últimos 30 días</option>
            </select></label>
          <label class="af-campo"><span>Persona</span>
            <select data-av-persona aria-label="Filtrar por persona">${opciones.join('')}</select></label>
          <label class="af-campo"><span>Lectura</span>
            <select data-av-leido aria-label="Filtrar por lectura">
              <option value="todos"${f.leido === 'todos' ? ' selected' : ''}>Todos</option>
              <option value="no"${f.leido === 'no' ? ' selected' : ''}>Sin leer</option>
              <option value="si"${f.leido === 'si' ? ' selected' : ''}>Leídos</option>
            </select></label>
        </div>
        <div class="af-pie">
          <span class="af-conteo">${vista.length} de ${avisos.length} aviso(s)</span>
          <span class="af-acciones">
            <button type="button" class="btn-ghost" data-avisos-todo-leido><i class="ri-check-double-line" aria-hidden="true"></i> Marcar todo leído</button>
            <button type="button" class="btn-ghost" data-avisos-borrar ${hayFiltro ? '' : 'disabled'}><i class="ri-delete-bin-line" aria-hidden="true"></i> Borrar filtrados</button>
          </span>
        </div>
      </div>`;
  }

  function pintarCentroAvisos() {
    const centro = document.getElementById('centro-avisos');
    if (!centro) return;
    const vista = avisosFiltrados();
    let diaActual = null;
    const cuerpo = vista.length
      ? vista.map(aviso => {
          const dia = rotuloDia(aviso.ts);
          const cabecera = dia !== diaActual
            ? `<li class="aviso-dia" role="presentation">${esc(dia)}</li>` : '';
          diaActual = dia;
          return cabecera + itemAvisoHTML(aviso);
        }).join('')
      : `<li class="aviso-vacio"><i class="ri-inbox-line" aria-hidden="true"></i>
           <p>${avisos.length ? 'Ningún aviso coincide con los filtros.' : 'Todavía no hay avisos.'}</p>
           <small>${avisos.length ? 'Prueba a quitar algún filtro.' : 'Aquí quedarán las confirmaciones, los cambios y los errores.'}</small>
           ${avisos.length ? '<button type="button" class="btn-ghost" data-avisos-quitar-filtros>Quitar filtros</button>' : ''}</li>`;
    const sinLeer = avisos.filter(a => !a.leido).length;
    centro.innerHTML =
      `<header class="drawer-cabecera">
         <div><h2 id="avisos-titulo"><i class="ri-notification-3-line" aria-hidden="true"></i> Centro de avisos</h2>
         <p>${sinLeer ? `${sinLeer} sin leer · ` : ''}${avisos.length} guardado(s)</p></div>
         <span class="drawer-cabecera-acciones">
           ${avisos.length ? '<button class="btn-ghost" type="button" data-avisos-limpiar><i class="ri-delete-bin-line"></i> Limpiar</button>' : ''}
           <button class="btn-icon" type="button" data-cerrar-avisos aria-label="Cerrar avisos"><i class="ri-close-line"></i></button>
         </span>
       </header>
       ${filtrosAvisosHTML(vista)}
       <ul class="aviso-lista" aria-live="polite">${cuerpo}</ul>
       <footer class="avisos-pie">
         <button type="button" class="btn-ghost" data-actualizaciones>
           <i class="ri-git-branch-line" aria-hidden="true"></i> Actualizaciones <span class="pie-version">v${esc(VERSION)}</span>
           <span class="pie-nuevo" ${actualizacionPendiente() ? '' : 'hidden'}>nueva</span>
         </button>
       </footer>`;
  }

  function alternarCentroAvisos() {
    const centro = document.getElementById('centro-avisos');
    if (!centro) return;
    const abierto = !centro.hidden;
    if (abierto) { cerrarCentroAvisos(); return; }
    pintarCentroAvisos();
    centro.hidden = false;
    // Al abrir se marcan como leídos los que se están viendo.
    avisosFiltrados().forEach(a => { a.leido = true; });
    contarNoLeidos();
    guardarAvisos();
    pintarCentroAvisos();
    document.getElementById('btn-avisos')?.setAttribute('aria-expanded', 'true');
  }

  function cerrarCentroAvisos() {
    const centro = document.getElementById('centro-avisos');
    if (!centro || centro.hidden) return;
    centro.hidden = true;
    document.getElementById('btn-avisos')?.setAttribute('aria-expanded', 'false');
  }

  /* ═══════════════════════════════════════════════════════════
     11 · SISTEMA DE ACTUALIZACIONES
     ───────────────────────────────────────────────────────────
     Versión instalada + historial de cambios + comprobación
     contra el repositorio público del proyecto.
     ═══════════════════════════════════════════════════════════ */
  const VERSION = '1.9.0';
  const CLAVE_VERSION_VISTA = 'tic-version-vista';
  const CLAVE_COMPROBACION = 'tic-comprobacion-actualizaciones';

  const CAMBIOS = [
    { version: '1.9.0', fecha: '2026-10-07', titulo: 'Modales unificados y gráficas con ayuda', notas: [
      'Editar estudiante, equipos, docente guía e integrantes usan la cabecera y el cuerpo de los paneles.',
      'Las gráficas muestran unidades reales (alumnos, promedio /100) en vez de un porcentaje relativo.',
      'Globo de ayuda con el texto completo al pasar el ratón, incluidas las etiquetas truncadas.',
      'Clic en barra o dona para aplicar ese filtro en Estadísticas desde cualquier vista.'
    ] },
    { version: '1.8.0', fecha: '2026-10-07', titulo: 'Seguimiento y proyección de notas', notas: [
      'Tarjeta «Pulso de hoy» en el panel principal con alertas automáticas de seguimiento.',
      'Reglas: rendimiento bajo, alcance imposible, estudiante sin notas, módulo sin notas y grupo sin matrícula.',
      'Alertas marcables como revisadas (se guardan en el navegador) con expansión y restablecimiento.',
      'Proyección de notas en la ficha: promedio, pendientes y la nota mínima para cerrar en el umbral.'
    ] },
    { version: '1.7.0', fecha: '2026-10-07', titulo: 'Modo mantenimiento', notas: [
      'Bandera en Firebase con copia local para el arranque sin conexión.',
      'Los usuarios que no son administradores ven una pantalla de bloqueo con motivo y reintentos.',
      'El administrador conserva el acceso y lo controla desde un banner con interruptor.',
      'Se comprueba al iniciar y en cada pintado (como máximo una lectura por minuto).'
    ] },
    { version: '1.6.0', fecha: '2026-10-07', titulo: 'Centro de avisos filtrable y comprobación de versiones', notas: [
      'Avisos con tipo, fecha, autor, persona afectada y sección.',
      'Filtros por texto, tipo, periodo, persona y estado de lectura.',
      'Agrupación por día, marcar leídos y borrar solo los filtrados.',
      'Historial de versiones y comprobación de cambios en el repositorio.'
    ] },
    { version: '1.5.0', fecha: '2026-10-07', titulo: 'Paneles rediseñados y paleta de comandos mejorada', notas: [
      'Cajón «Filtros y ajustes» con tarjetas y cabecera con icono.',
      'Configuración de exportación, convalidaciones y responsables con el mismo lenguaje visual.',
      'Paleta con modos (Todo, Ir a, Estudiantes, Grupos, Acciones), resaltado y sugerencias.'
    ] },
    { version: '1.4.0', fecha: '2026-10-06', titulo: 'Diez mejoras de interfaz', notas: [
      'Esqueletos de carga, tarjetas KPI clicable y panel de apariencia.',
      'Tablas ordenables y en tarjetas en móvil, barra de filtros global.',
      'Cajón de detalle del estudiante, atajos de teclado y foco visible.'
    ] },
    { version: '1.3.0', fecha: '2026-10-06', titulo: 'Modo oscuro, perfil y administración', notas: [
      'Tema oscuro global y menú lateral estable.',
      'Ficha de perfil con foto, biografía y completitud.',
      'Panel de administración con KPIs, buscador y cuentas.'
    ] }
  ];

  function actualizacionPendiente() {
    return leerLocal(CLAVE_VERSION_VISTA, '') !== VERSION;
  }

  function fechaLarga(iso) {
    try {
      return new Date(`${iso}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function comprobacionGuardada() {
    try { return JSON.parse(leerLocal(CLAVE_COMPROBACION, 'null')) || null; } catch (e) { return null; }
  }

  function pintarActualizaciones() {
    const modal = document.getElementById('modal-actualizaciones');
    if (!modal) return;
    const guardada = comprobacionGuardada();
    const version = CAMBIOS[0] || { version: VERSION, fecha: '2026-10-07', titulo: '', notas: [] };
    const historial = CAMBIOS.map(c => `
      <li class="cambio-version${c.version === VERSION ? ' actual' : ''}">
        <span class="cambio-cab">
          <span class="cambio-num">v${esc(c.version)}</span>
          ${c.version === VERSION ? '<span class="cambio-actual-chip">Instalada</span>' : ''}
          <time>${esc(fechaLarga(c.fecha))}</time>
        </span>
        <strong>${esc(c.titulo)}</strong>
        <ul>${c.notaHTML || c.notas.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
      </li>`).join('');
    modal.innerHTML = `
      <div class="modal-content panel panel-actualizaciones">
        <header class="panel-cabecera">
          <span class="panel-icono"><i class="ri-git-branch-line" aria-hidden="true"></i></span>
          <div class="panel-titular">
            <p class="panel-eyebrow">Sistema</p>
            <h3>Actualizaciones del panel</h3>
            <p class="panel-lema">Versión instalada, historial de cambios y comprobación de novedades en el repositorio.</p>
          </div>
          <button type="button" class="btn-icon panel-cerrar" data-cerrar-actualizaciones aria-label="Cerrar actualizaciones"><i class="ri-close-line" aria-hidden="true"></i></button>
        </header>
        <div class="panel-cuerpo">
          <section class="ver-instalada">
            <div class="vi-num">v${esc(version.version)}</div>
            <div class="vi-meta">
              <strong>${esc(version.titulo)}</strong>
              <span>Publicada el ${esc(fechaLarga(version.fecha))} · ${CAMBIOS.length} versión(es) en el historial</span>
            </div>
            <button type="button" class="btn-primary" data-comprobar-actualizaciones><i class="ri-refresh-line" aria-hidden="true"></i> Comprobar ahora</button>
          </section>
          <p class="panel-nota" id="actualizaciones-estado" role="status">${guardada
            ? `Última comprobación: ${esc(guardada.fechaLocal || '—')}${guardada.titulo ? ` · ${esc(guardada.titulo)}` : ''}`
            : 'Todavía no se ha comprobado si hay cambios en el repositorio.'}</p>
          <section class="cambio-historial">
            <h4 class="panel-titulo"><i class="ri-history-line" aria-hidden="true"></i> Historial de versiones</h4>
            <ol class="cambio-lista">${historial}</ol>
          </section>
        </div>
        <div class="modal-actions panel-acciones split">
          <button type="button" class="btn-secondary" data-marcar-version><i class="ri-check-line" aria-hidden="true"></i> Marcar versión como vista</button>
          <button type="button" class="btn-primary" data-cerrar-actualizaciones>Cerrar</button>
        </div>
      </div>`;
  }

  function abrirActualizaciones() {
    const modal = document.getElementById('modal-actualizaciones');
    if (!modal) return;
    pintarActualizaciones();
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    window.setTimeout(() => {
      const boton = modal.querySelector('[data-comprobar-actualizaciones]');
      if (boton) boton.focus();
    }, 60);
  }

  function cerrarActualizaciones() {
    const modal = document.getElementById('modal-actualizaciones');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }

  function marcarVersionVista() {
    escribirLocal(CLAVE_VERSION_VISTA, VERSION);
    pintarCentroAvisos();
    UI.showToast(`✅ Versión ${VERSION} marcada como vista.`, 'success');
  }

  /* Consulta el último commit del repositorio público y lo compara
     con el día de publicación de la versión instalada. Cualquier
     fallo (sin conexión, límite de la API) se informa sin romper
     el panel. */
  async function comprobarActualizaciones() {
    const estado = document.getElementById('actualizaciones-estado');
    const boton = document.querySelector('[data-comprobar-actualizaciones]');
    if (estado) estado.textContent = 'Comprobando el repositorio…';
    if (boton) { boton.disabled = true; boton.classList.add('cargando'); }
    try {
      const respuesta = await fetch('https://api.github.com/repos/turtlegamesstudy/TIC-Dashboard/commits?per_page=1',
        { headers: { Accept: 'application/vnd.github+json' } });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const datos = await respuesta.json();
      const commit = Array.isArray(datos) && datos[0];
      if (!commit || !commit.sha) throw new Error('respuesta inesperada');
      const sha = String(commit.sha).slice(0, 7);
      const mensaje = String((commit.commit && commit.commit.message) || '').split('\n')[0];
      const autor = (commit.commit && commit.commit.author && commit.commit.author.name) || 'desconocido';
      const fechaRemota = new Date((commit.commit && commit.commit.author && commit.commit.date) || Date.now());
      const fechaLocal = new Date(`${CAMBIOS[0].fecha}T23:59:59`);
      const novedad = fechaRemota.getTime() > fechaLocal.getTime();
      const fechaComprobacion = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      escribirLocal(CLAVE_COMPROBACION, JSON.stringify({
        sha, fechaLocal: fechaComprobacion, titulo: mensaje, novedad
      }));
      if (estado) {
        estado.textContent = novedad
          ? `Hay cambios en el repositorio posteriores a tu versión (commit ${sha} · ${fechaRemota.toLocaleDateString()}).`
          : `Estás al día: último commit ${sha} (${fechaRemota.toLocaleDateString()}, ${autor}).`;
        estado.classList.toggle('con-novedad', novedad);
      }
      if (novedad) {
        registrarAviso(`El repositorio tiene cambios posteriores a la v${VERSION}.`, 'sistema',
          { texto: 'Cerrar', ejecutar: () => {} },
          { titulo: 'Actualización disponible', detalle: `Commit ${sha} · ${mensaje}`,
            clave: 'actualizacion-remota', icono: 'ri-download-cloud-2-line' });
      } else {
        UI.showToast(`✅ Al día con el repositorio (commit ${sha}).`, 'success');
      }
    } catch (e) {
      if (estado) {
        estado.textContent = `No se pudo comprobar: ${e && e.message ? e.message : 'sin conexión'}. ` +
          'Las notas de versión de abajo siguen disponibles.';
        estado.classList.remove('con-novedad');
      }
    } finally {
      if (boton) { boton.disabled = false; boton.classList.remove('cargando'); }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     12 · MODO MANTENIMIENTO
     ───────────────────────────────────────────────────────────
     Bandera en Firebase (y copia local para el arranque sin
     conexión): los no administradores ven una pantalla de
     bloqueo y el administrador conserva el acceso con un banner
     desde el que se activa o se desactiva.
     ═══════════════════════════════════════════════════════════ */
  const CLAVE_MANTENIMIENTO = 'tic-mantenimiento';
  const RUTA_MANTENIMIENTO = 'maintenance';
  const mantenimiento = {
    activo: false, motivo: '', inicio: null, por: null, cargado: false, fallo: false, comprobado: null
  };
  let firmaBanner = null;
  let ultimoRefresco = 0;

  function esAdmin() {
    try {
      return typeof AuthManager !== 'undefined' && AuthManager && AuthManager.profile &&
        AuthManager.profile.role === 'admin';
    } catch (e) { return false; }
  }

  function leerCacheMantenimiento() {
    try {
      const bruto = localStorage.getItem(CLAVE_MANTENIMIENTO);
      if (!bruto) return;
      const datos = JSON.parse(bruto);
      if (datos && typeof datos === 'object') {
        mantenimiento.activo = Boolean(datos.activo);
        mantenimiento.motivo = datos.motivo || '';
        mantenimiento.inicio = datos.inicio || null;
        mantenimiento.por = datos.por || null;
        mantenimiento.cargado = true;
      }
    } catch (e) { /* sin copia local */ }
  }

  function guardarCacheMantenimiento() {
    try {
      localStorage.setItem(CLAVE_MANTENIMIENTO, JSON.stringify({
        activo: mantenimiento.activo,
        motivo: mantenimiento.motivo,
        inicio: mantenimiento.inicio,
        por: mantenimiento.por
      }));
    } catch (e) { /* almacenamiento bloqueado */ }
  }

  function fechaMantenimiento(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return String(iso); }
  }

  /* Lee la bandera del servidor. Si no hay conexión se conserva la
     copia local y se marca el fallo para poder reintentarlo. */
  async function refrescarMantenimiento() {
    ultimoRefresco = Date.now();
    try {
      const servicios = window.FirebaseServices;
      if (!servicios || !servicios.database || !servicios.database.ref) return;
      const snap = await servicios.database.ref(RUTA_MANTENIMIENTO).once('value');
      const datos = snap && typeof snap.val === 'function' ? snap.val() : null;
      mantenimiento.fallo = false;
      if (datos && typeof datos === 'object') {
        mantenimiento.activo = Boolean(datos.activo);
        mantenimiento.motivo = datos.motivo || '';
        mantenimiento.inicio = datos.inicio || null;
        mantenimiento.por = datos.por || null;
        mantenimiento.cargado = true;
        guardarCacheMantenimiento();
      }
    } catch (e) {
      mantenimiento.fallo = true;
    }
    mantenimiento.comprobado = new Date().toISOString();
    pintarMantenimiento();
  }

  /* Escribe la bandera en Firebase y refresca la interfaz. */
  async function alternarMantenimiento() {
    const activo = !mantenimiento.activo;
    const campo = document.getElementById('mantenimiento-motivo');
    const motivo = activo ? String(campo && campo.value ? campo.value : '').trim() : '';
    const datos = {
      activo,
      motivo,
      inicio: activo ? new Date().toISOString() : null,
      por: activo ? (usuarioActual() || 'administrador') : null
    };
    try {
      const servicios = window.FirebaseServices;
      if (servicios && servicios.database && servicios.database.ref) {
        await servicios.database.ref(RUTA_MANTENIMIENTO).set(datos);
      }
      Object.assign(mantenimiento, datos, { cargado: true, fallo: false });
      guardarCacheMantenimiento();
      pintarMantenimiento();
      registrarEvento({
        tipo: 'sistema',
        titulo: activo ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado',
        texto: activo
          ? 'El panel queda bloqueado para los usuarios que no son administradores.'
          : 'El panel vuelve a estar disponible para todo el mundo.',
        detalle: motivo || (activo ? 'Sin motivo indicado' : null),
        seccion: 'administracion',
        clave: 'mantenimiento',
        icono: activo ? 'ri-lock-2-line' : 'ri-lock-unlock-line'
      });
    } catch (e) {
      UI.showToast(`No se pudo actualizar el modo mantenimiento: ${e.message}`, 'error');
    }
  }

  function pintarMantenimiento() {
    if (typeof document === 'undefined') return;
    const admin = esAdmin();

    /* ── Pantalla de bloqueo para quienes no son administradores ── */
    const bloquear = mantenimiento.activo && !admin;
    let bloqueo = document.getElementById('pantalla-mantenimiento');
    if (bloquear && !bloqueo) {
      bloqueo = document.createElement('div');
      bloqueo.id = 'pantalla-mantenimiento';
      bloqueo.setAttribute('role', 'alertdialog');
      bloqueo.setAttribute('aria-modal', 'true');
      bloqueo.setAttribute('aria-labelledby', 'mantenimiento-titulo');
      document.body.appendChild(bloqueo);
    }
    if (bloqueo) {
      const contenedor = document.getElementById('app-container');
      if (bloquear) {
        bloqueo.hidden = false;
        bloqueo.innerHTML =
            `<div class="mantenimiento-tarjeta">
               <span class="mantenimiento-icono"><i class="ri-lock-2-line" aria-hidden="true"></i></span>
               <p class="mantenimiento-eyebrow">Mantenimiento programado</p>
               <h1 id="mantenimiento-titulo">El panel está en mantenimiento</h1>
               <p class="mantenimiento-texto">${esc(mantenimiento.motivo) ||
                 'Estamos aplicando cambios en el panel. Tus datos están guardados y volverán a estar disponibles en unos minutos.'}</p>
               <p class="mantenimiento-detalle">${mantenimiento.inicio ? `Desde el ${esc(fechaMantenimiento(mantenimiento.inicio))}` : ''}${mantenimiento.por ? ` · ${esc(mantenimiento.por)}` : ''}</p>
               <div class="mantenimiento-acciones">
                 <button type="button" class="btn-primary" data-mantenimiento-reintentar>
                   <i class="ri-refresh-line" aria-hidden="true"></i> Volver a intentar</button>
                 <button type="button" class="btn-secondary" data-mantenimiento-salir>
                   <i class="ri-logout-box-r-line" aria-hidden="true"></i> Cerrar sesión</button>
               </div>
               <p class="mantenimiento-comprobado">${mantenimiento.comprobado
                 ? `Última comprobación: ${esc(new Date(mantenimiento.comprobado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}`
                 : 'Pulsa «Volver a intentar» para comprobar si ya está disponible.'}</p>
             </div>`;
        if (contenedor) {
          contenedor.setAttribute('inert', '');
          contenedor.setAttribute('aria-hidden', 'true');
        }
        try { cerrarCentroAvisos(); } catch (e) { /* el cajón puede no existir */ }
        try { if (paleta.abierta) cerrarPaleta(); } catch (e) { /* paleta cerrada */ }
        try { cerrarApariencia(); cerrarDetalle(); } catch (e) { /* cajones cerrados */ }
      } else {
        bloqueo.hidden = true;
        if (contenedor) {
          contenedor.removeAttribute('inert');
          contenedor.removeAttribute('aria-hidden');
        }
      }
    }

    /* ── Banner con el interruptor, solo para administradores ── */
    const principal = document.querySelector('main.workspace') || document.getElementById('workspace');
    const envoltura = document.querySelector('.main-wrapper') || (principal && principal.parentNode);
    if (!envoltura || !principal) return;
    let banner = document.getElementById('banner-mantenimiento');
    if (!banner) {
      if (!admin) return;
      banner = document.createElement('section');
      banner.id = 'banner-mantenimiento';
      envoltura.insertBefore(banner, principal);
    }
    banner.hidden = !admin;
    if (!admin) return;

    const motivoPrevio = document.getElementById('mantenimiento-motivo');
    const firma = [admin, mantenimiento.activo, mantenimiento.motivo, mantenimiento.inicio,
      mantenimiento.por, mantenimiento.fallo].join('|');
    if (firma === firmaBanner) return;
    firmaBanner = firma;
    banner.className = `banner-mantenimiento${mantenimiento.activo ? ' activo' : ''}`;
    banner.setAttribute('role', 'status');
    banner.innerHTML =
      `<span class="bm-icono"><i class="${mantenimiento.activo ? 'ri-lock-2-line' : 'ri-shield-check-line'}" aria-hidden="true"></i></span>
       <div class="bm-texto">
         <strong>Modo mantenimiento <span class="bm-estado">${mantenimiento.activo ? 'activo' : 'inactivo'}</span></strong>
         <span>${mantenimiento.activo
           ? `Solo los administradores pueden entrar desde ${esc(fechaMantenimiento(mantenimiento.inicio) || 'ahora')}${mantenimiento.por ? ` · activado por ${esc(mantenimiento.por)}` : ''}.`
           : 'Al activarlo, los usuarios que no son administradores verán una pantalla de bloqueo; tú mantendrás el acceso completo.'}</span>
       </div>
       <label class="bm-motivo" title="Motivo que verán los usuarios bloqueados">
         <input type="text" id="mantenimiento-motivo" maxlength="120"
           placeholder="Motivo (opcional)" value="${esc(motivoPrevio && !mantenimiento.activo ? motivoPrevio.value : mantenimiento.motivo)}"
           ${mantenimiento.activo ? 'readonly' : ''} aria-label="Motivo del mantenimiento">
       </label>
       <span class="bm-acciones">
         ${mantenimiento.fallo ? '<span class="bm-fallo"><i class="ri-wifi-off-line" aria-hidden="true"></i> Sin conexión</span>' : ''}
         <button type="button" class="btn-ghost" data-mantenimiento-reintentar>
           <i class="ri-refresh-line" aria-hidden="true"></i> Reintentar lectura</button>
         <button type="button" class="btn-primary" data-mantenimiento-toggle>
           <i class="${mantenimiento.activo ? 'ri-lock-unlock-line' : 'ri-lock-2-line'}" aria-hidden="true"></i>
           ${mantenimiento.activo ? 'Desactivar' : 'Activar'}</button>
       </span>`;
  }

  function iniciarMantenimiento() {
    try { leerCacheMantenimiento(); } catch (e) { /* sin copia */ }
    pintarMantenimiento();
    refrescarMantenimiento();
  }

  /* ═══════════════════════════════════════════════════════════
     4 · TABLAS ORDENABLES Y EN TARJETAS (MÓVIL)
     ═══════════════════════════════════════════════════════════ */
  const normalizar = texto => String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function valorCelda(celda) {
    const bruto = (celda.textContent || '').replace(/\s+/g, ' ').trim();
    const numero = bruto.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (numero !== '' && /^-?\d+(\.\d+)?$/.test(numero) && /\d/.test(bruto)) return { tipo: 'num', num: parseFloat(numero) };
    return { tipo: 'txt', txt: normalizar(bruto) };
  }

  function mejorarTablas() {
    const modulo = UI.currentModule;
    $$('#workspace table.custom-table, #workspace table.admin-users-table').forEach(tabla => {
      const tbody = $('tbody', tabla);
      const cabeceras = $$('thead th', tabla);
      if (!tbody || !cabeceras.length) return;

      // Etiqueta para el diseño de tarjetas en móvil.
      cabeceras.forEach((th, i) => {
        const texto = (th.textContent || '').replace(/\s+/g, ' ').trim();
        if (!th.dataset.colTitulo) th.dataset.colTitulo = texto;
        $$('td', tbody).forEach(td => { if (td.cellIndex === i) td.dataset.label = texto; });
        if (!th.dataset.ordenHecho) {
          th.dataset.ordenHecho = '1';
          th.setAttribute('title', `Ordenar por ${texto}`);
          th.setAttribute('tabindex', '0');
          th.setAttribute('role', 'columnheader');
          if (!$('.th-orden', th)) {
            const boton = document.createElement('span');
            boton.className = 'th-orden';
            boton.setAttribute('aria-hidden', 'true');
            boton.innerHTML = '<i class="ri-arrow-up-down-line"></i>';
            th.appendChild(boton);
          }
        }
      });

      // Con una sola columna de relleno no hay nada que ordenar.
      const ordenable = cabeceras.length > 1 &&
        !Array.prototype.some.call(tbody.rows, fila => fila.cells.length === 1 && fila.cells[0].colSpan > 1);
      if (!ordenable) return;
      tabla.classList.add('tabla-ordenable');
      if (!tabla.dataset.ordenado) {
        tabla.dataset.ordenado = '1';
        const guardado = ordenTablas[modulo] || ordenGuardado(modulo);
        if (guardado) ordenarTabla(tabla, guardado.col, guardado.dir, false);
      }
      // Cabecera fija solo cuando el contenedor no crea su propio
      // scroll (si lo crea, el «sticky» se quedaría pegado dentro).
      const contenedor = tabla.closest('.table-container, .admin-users-table-wrap');
      if (contenedor && getComputedStyle(contenedor).overflowX === 'visible') {
        tabla.classList.add('cabecera-fija');
      }
    });
  }

  function ordenarTabla(tabla, col, dir, persistir = true) {
    const tbody = $('tbody', tabla);
    if (!tbody) return;
    const filas = Array.prototype.slice.call(tbody.rows);
    if (!filas.length) return;
    const valorDe = fila => {
      const celda = fila.cells[col];
      return celda ? valorCelda(celda) : { tipo: 'txt', txt: '' };
    };
    const base = filas.map(fila => ({ fila, valor: valorDe(fila) }));
    const signo = dir === 'desc' ? -1 : 1;
    base.sort((a, b) => {
      if (a.valor.tipo === 'num' && b.valor.tipo === 'num') return (a.valor.num - b.valor.num) * signo;
      if (a.valor.tipo === 'num') return -1 * signo;
      if (b.valor.tipo === 'num') return 1 * signo;
      return a.valor.txt.localeCompare(b.valor.txt, 'es') * signo;
    });
    const fragmento = document.createDocumentFragment();
    base.forEach(item => fragmento.appendChild(item.fila));
    tbody.appendChild(fragmento);

    $$('thead th', tabla).forEach((th, i) => {
      th.removeAttribute('aria-sort');
      th.classList.toggle('orden-asc', i === col && dir === 'asc');
      th.classList.toggle('orden-desc', i === col && dir === 'desc');
      if (i === col) th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
    });
    if (persistir) {
      ordenTablas[UI.currentModule] = { col, dir };
      escribirLocal(`tic-orden-${UI.currentModule}`, JSON.stringify({ col, dir }));
    }
  }

  function alternarOrden(th) {
    const tabla = th.closest('table');
    if (!tabla) return;
    const col = th.cellIndex;
    const activo = th.classList.contains('orden-asc') ? 'asc' : th.classList.contains('orden-desc') ? 'desc' : null;
    const dir = activo === 'asc' ? 'desc' : 'asc';
    ordenarTabla(tabla, col, dir);
    UI.showToast(`↕️ Orden: ${th.dataset.colTitulo || 'columna'} ${dir === 'asc' ? 'ascendente' : 'descendente'}.`, 'info');
  }

  /* ═══════════════════════════════════════════════════════════
     7 · BARRA DE FILTROS GLOBAL
     ═══════════════════════════════════════════════════════════ */
  const ETIQUETAS_CLAVE = {
    estado: valor => `Estado: ${valor === 'Activo' ? 'Activos' : valor === 'Retirado' ? 'Retirados' : valor}`,
    grupo: valor => {
      const grupo = gruposDb().find(g => g.id === valor);
      return `Grupo: ${grupo ? grupo.nombre : valor}`;
    },
    modulo: valor => `Módulo: ${valor}`,
    rango: valor => `Periodo: ${valor}`
  };

  function opcionesEstado(valorActual) {
    const opciones = [['todos', 'Todos'], ['Activo', 'Solo activos'], ['Retirado', 'Solo retirados']];
    return opciones.map(([valor, etiqueta]) =>
      `<option value="${valor}"${valor === valorActual ? ' selected' : ''}>${etiqueta}</option>`).join('');
  }

  function opcionesGrupo(valorActual) {
    const grupos = gruposDb();
    return '<option value="">Todos los grupos</option>' + grupos.map(g =>
      `<option value="${esc(g.id)}"${g.id === valorActual ? ' selected' : ''}>${esc(g.nombre)}</option>`).join('');
  }

  function actualizarBarraFiltros() {
    const barra = document.getElementById('filtros-globales');
    if (!barra) return;
    const app = document.getElementById('app-container');
    const ocultaAuth = !app || app.hidden;
    const modulo = UI.currentModule;
    const aplica = vistasConFiltro().indexOf(modulo) >= 0;
    if (ocultaAuth || !aplica) { barra.hidden = true; return; }
    barra.hidden = false;

    const filtros = UI.filtrosGuardados(modulo) || {};
    const estadoActual = filtros.estado || 'todos';
    const grupoActual = filtros.grupo || '';
    const conGrupo = vistasDeGrupo().indexOf(modulo) >= 0;
    const claves = Object.keys(filtros);
    const etiquetaSeccion = (typeof Secciones !== 'undefined' && Secciones.etiquetaDe) ? Secciones.etiquetaDe(modulo) : modulo;

    if (!barra.dataset.pintada) {
      barra.innerHTML =
        `<span class="fg-modulo"><i class="ri-layout-grid-line" aria-hidden="true"></i><strong data-fg-modulo></strong></span>
         <label class="fg-campo"><span>Estado</span>
           <select data-fg="estado" aria-label="Filtro global de estado"></select></label>
         <label class="fg-campo fg-grupo"><span>Grupo</span>
           <select data-fg="grupo" aria-label="Filtro global de grupo"></select></label>
         <span class="fg-activos" data-fg-activos role="status"></span>
         <button type="button" class="btn-ghost" data-fg-limpiar title="Quita los filtros de todas las vistas">
           <i class="ri-filter-off-line" aria-hidden="true"></i> Limpiar filtros</button>`;
      barra.dataset.pintada = '1';
    }
    const nombre = $('[data-fg-modulo]', barra);
    if (nombre) nombre.textContent = etiquetaSeccion;
    const selEstado = $('[data-fg="estado"]', barra);
    if (selEstado) { selEstado.innerHTML = opcionesEstado(estadoActual); selEstado.disabled = false; }
    const selGrupo = $('[data-fg="grupo"]', barra);
    if (selGrupo) {
      selGrupo.innerHTML = opcionesGrupo(grupoActual);
      selGrupo.disabled = !conGrupo;
      const campo = selGrupo.closest('.fg-campo');
      if (campo) campo.title = conGrupo
        ? 'Se aplica en Estadísticas'
        : 'El filtro de grupo solo existe en Estadísticas';
    }
    const contador = $('[data-fg-activos]', barra);
    if (contador) {
      contador.innerHTML = claves.length
        ? `<i class="ri-filter-3-line" aria-hidden="true"></i> ${claves.length} filtro(s) activo(s): ` +
          claves.map(k => `<span class="fg-chip">${esc((ETIQUETAS_CLAVE[k] || (v => `${v}`))(filtros[k]))}</span>`).join('')
        : `<i class="ri-filter-line" aria-hidden="true"></i> Sin filtros en esta vista`;
    }
  }

  function aplicarFiltroGlobal(clave, valor) {
    const vistas = clave === 'grupo' ? vistasDeGrupo() : vistasDeEstado();
    vistas.forEach(vista => {
      const params = Object.assign({}, UI.filtrosGuardados(vista));
      if (valor && valor !== 'todos' && valor !== '') params[clave] = valor;
      else delete params[clave];
      // Se escribe en memoria sin tocar la URL: la URL siempre describe
      // la vista en la que está el usuario.
      UI._paramsVista[vista] = params;
    });
    UI.rutaEscribir(UI.currentModule, UI.filtrosGuardados(UI.currentModule));
    if (vistas.indexOf(UI.currentModule) >= 0) UI.renderCurrentModule({ background: true });
    else actualizarBarraFiltros();
    const traductor = ETIQUETAS_CLAVE[clave] || (v => v);
    const quitado = !valor || valor === 'todos' || valor === '';
    UI.showToast(quitado
      ? `🧹 Filtro global «${clave}» quitado en ${vistas.length} vista(s).`
      : `🔎 Filtro global aplicado → ${traductor(valor)}`, 'info');
    registrarEvento({
      tipo: 'cambio', titulo: quitado ? 'Filtro retirado' : 'Filtro aplicado',
      texto: quitado
        ? `Se quitó el filtro «${ETIQUETAS_CLAVE[clave] || clave}» en ${vistas.length} vista(s).`
        : `${ETIQUETAS_CLAVE[clave] || clave}: ${traductor(valor)}`,
      detalle: `Vistas: ${vistas.join(', ')}`,
      seccion: typeof UI !== 'undefined' ? UI.currentModule : null,
      clave: `filtro-${clave}`
    });
  }

  function limpiarFiltrosGlobales() {
    const vistas = vistasConFiltro();
    vistas.forEach(vista => { UI._paramsVista[vista] = {}; });
    UI.rutaEscribir(UI.currentModule, UI.filtrosGuardados(UI.currentModule));
    if (vistas.indexOf(UI.currentModule) >= 0) UI.renderCurrentModule({ background: true });
    else actualizarBarraFiltros();
    UI.showToast('🧹 Filtros limpiados en todas las vistas.', 'success');
    registrarEvento({
      tipo: 'cambio', titulo: 'Filtros limpiados',
      texto: `Se eliminaron los filtros de ${vistas.length} vista(s).`,
      detalle: `Vistas: ${vistas.join(', ')}`,
      seccion: typeof UI !== 'undefined' ? UI.currentModule : null,
      clave: 'filtro-limpiar'
    });
  }

  /* ═══════════════════════════════════════════════════════════
     8 · CAJÓN DE DETALLE (ESTUDIANTE)
     ═══════════════════════════════════════════════════════════ */
  function iniciales(nombre) {
    return String(nombre || '').split(/\s+/).slice(0, 2).map(p => p.charAt(0)).join('').toLocaleUpperCase('es') || '?';
  }

  function notasDeEstudiante(est) {
    const modulos = (est && est.evaluacionesPorModulo) || {};
    let conNota = 0;
    Object.keys(modulos).forEach(modulo => {
      const registro = modulos[modulo];
      const notas = registro && registro.notas;
      if (!notas) return;
      const tiene = Object.keys(notas).some(corte => {
        const valor = notas[corte];
        if (valor === null || valor === undefined || valor === '') return false;
        if (typeof valor === 'object') {
          return Object.keys(valor).some(clave => valor[clave] !== null && valor[clave] !== '' && !isNaN(parseFloat(valor[clave])));
        }
        return !isNaN(parseFloat(valor));
      });
      if (tiene) conNota += 1;
    });
    return conNota;
  }

  function contenidoEstudiante(est) {
    const nombre = `${est.nombres || ''} ${est.apellidos || ''}`.trim();
    const grupo = gruposDb().find(g => g.id === est.grupoId);
    const nombreGrupo = grupo ? grupo.nombre : (est.grupoNombre || '');
    const promedio = (typeof StatsEngine !== 'undefined' && StatsEngine && typeof StatsEngine.calcularPromedioEstudiante === 'function')
      ? StatsEngine.calcularPromedioEstudiante(est) : null;
    const tienePromedio = promedio !== null && promedio !== undefined && !isNaN(promedio);
    const estado = est.estado || 'Activo';
    const fila = (dt, dd) => `<div><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`;
    return `
      <header class="drawer-cabecera detalle-cabeza">
        <span class="detalle-avatar" aria-hidden="true">${esc(iniciales(nombre))}</span>
        <div>
          <h2 id="detalle-titulo">${esc(nombre)}</h2>
          <p>${esc(nombreGrupo || 'Sin grupo asignado')}</p>
        </div>
        <span class="badge-status ${esc(estado.toLowerCase())}">${esc(estado)}</span>
        <button class="btn-icon" type="button" data-cerrar-drawer aria-label="Cerrar detalle"><i class="ri-close-line" aria-hidden="true"></i></button>
      </header>
      <dl class="detalle-datos">
        ${fila('Correo', est.correo ? `<a href="mailto:${esc(est.correo)}">${esc(est.correo)}</a>` : '<span class="detalle-vacio">Sin correo</span>')}
        ${fila('Teléfono', est.telefono ? `<a href="tel:${esc(String(est.telefono).replace(/\s+/g, ''))}">${esc(est.telefono)}</a>` : '<span class="detalle-vacio">Sin teléfono</span>')}
        ${fila('Promedio general', tienePromedio
        ? `<strong class="detalle-promedio">${Number(promedio).toFixed(1)}<small>/100</small></strong>`
        : '<span class="detalle-vacio">Aún sin notas</span>')}
        ${fila('Módulos con nota', String(notasDeEstudiante(est)))}
      </dl>
      ${proyeccionHTML(est, grupo)}
      <div class="detalle-acciones">
        <button class="btn-primary-soft" type="button" data-detalle-accion="estadisticas">
          <i class="ri-bar-chart-line" aria-hidden="true"></i> Ver en estadísticas</button>
        <button class="btn-ghost" type="button" data-detalle-accion="editar">
          <i class="ri-pencil-line" aria-hidden="true"></i> Editar ficha</button>
      </div>
      <p class="detalle-nota"><i class="ri-information-line" aria-hidden="true"></i>
        Se abrió sin salir del directorio: pulsa <kbd>Esc</kbd> para volver a la lista.</p>`;
  }

  function abrirDetalleEstudiante(est) {
    const cajon = document.getElementById('detalle-drawer');
    const fondo = document.getElementById('mejoras-fondo');
    if (!cajon || !est) return;
    cajon.innerHTML = contenidoEstudiante(est);
    cajon.dataset.estId = est.id || '';
    cajon._est = est;
    cerrarAparienciaSilencioso();
    cajon.hidden = false;
    cajon.removeAttribute('inert');
    if (fondo) fondo.hidden = false;
    cajon.classList.add('entra');
    window.setTimeout(() => { cajon.querySelector('[data-cerrar-drawer]')?.focus(); }, 60);
  }

  function abrirEstudiantePorFila(fila) {
    const id = fila.dataset.estId || fila.dataset.estudianteId;
    const nombreCelda = fila.cells[1] ? `${fila.cells[1].textContent} ${fila.cells[2] ? fila.cells[2].textContent : ''}`.trim() : '';
    const todos = (typeof DataEngine !== 'undefined' && DataEngine.getEstudiantes) ? DataEngine.getEstudiantes() : [];
    const est = (id && todos.find(e => String(e.id) === String(id))) ||
      todos.find(e => normalizar(`${e.nombres} ${e.apellidos}`) === normalizar(nombreCelda)) ||
      todos.find(e => normalizar(`${e.nombres} ${e.apellidos}`).includes(normalizar(nombreCelda)) && nombreCelda);
    if (est) abrirDetalleEstudiante(est);
  }

  function cerrarDetalle(silencioso) {
    const cajon = document.getElementById('detalle-drawer');
    const fondo = document.getElementById('mejoras-fondo');
    if (!cajon || cajon.hidden) return;
    cajon.hidden = true;
    cajon.setAttribute('inert', '');
    const ajustes = document.getElementById('ajuste-drawer');
    if (fondo && (!ajustes || ajustes.hidden)) fondo.hidden = true;
  }

  function cerrarAparienciaSilencioso() {
    const drawer = document.getElementById('ajuste-drawer');
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    drawer.setAttribute('inert', '');
    document.getElementById('btn-apariencia')?.setAttribute('aria-expanded', 'false');
  }

  function accionDetalle(clave) {
    const cajon = document.getElementById('detalle-drawer');
    const est = cajon && cajon._est;
    if (!est) return;
    if (clave === 'estadisticas') {
      const grupo = gruposDb().find(g => g.id === est.grupoId);
      const params = {};
      if (est.estado && est.estado !== 'Activo') params.estado = est.estado;
      if (grupo) params.grupo = grupo.id;
      UI.fijarFiltros('estadisticas', params);
      cerrarDetalle(true);
      UI.irA('estadisticas');
      UI.showToast(`📊 Estadísticas con los filtros de ${est.nombres} ${est.apellidos}.`, 'info');
      return;
    }
    if (clave === 'editar') {
      if (typeof UI.openEditStudentModal === 'function' && est.grupoId) {
        cerrarDetalle(true);
        UI.openEditStudentModal(est.grupoId, est.id);
      } else UI.showToast('ℹ️ Abre la ficha desde el directorio de estudiantes.', 'info');
      return;
    }
    cerrarDetalle();
  }

  /* ═══════════════════════════════════════════════════════════
     6 · PALETA DE COMANDOS (Ctrl / Cmd + K)
     ═══════════════════════════════════════════════════════════ */
  const paleta = { abierta: false, items: [], sel: 0, ultimoFoco: null, modo: 'todo', consulta: '' };

  /* Grupos que controla cada modo de la paleta. */
  const MODOS = {
    todo: null,
    modulos: ['Ir a'],
    estudiantes: ['Estudiantes'],
    grupos: ['Grupos'],
    acciones: ['Acciones']
  };

  /* Resalta la parte del texto que coincide con la búsqueda, manteniendo
     la longitud de los caracteres originales (acentos incluidos). */
  const sinAcento = c => {
    const d = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return d.length ? d[0] : c;
  };
  function resaltar(texto, consulta) {
    const q = normalizar(consulta);
    if (!q) return esc(texto);
    const chars = Array.from(String(texto));
    const plano = chars.map(sinAcento).join('').toLowerCase();
    const i = plano.indexOf(q);
    if (i < 0) return esc(texto);
    return esc(chars.slice(0, i).join('')) +
      '<mark>' + esc(chars.slice(i, i + q.length).join('')) + '</mark>' +
      esc(chars.slice(i + q.length).join(''));
  }

  function sincronizarModosPaleta() {
    document.querySelectorAll('[data-paleta-modo]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.paletaModo === paleta.modo ? 'true' : 'false');
    });
  }

  const ACCIONES = [
    { texto: 'Cambiar entre tema claro y oscuro', icono: 'ri-contrast-line', accion: () => UI.toggleTheme() },
    { texto: 'Ajustar la apariencia del panel', icono: 'ri-palette-line', accion: () => abrirApariencia() },
    { texto: 'Limpiar todos los filtros', icono: 'ri-filter-off-line', accion: () => limpiarFiltrosGlobales() },
    { texto: 'Descargar la copia de la base (DB.json)', icono: 'ri-download-cloud-2-line', accion: () => DataEngine.exportDBJSON() },
    { texto: 'Activar o desactivar las animaciones', icono: 'ri-animating-line', accion: () => { if (typeof Ajustes !== 'undefined') { Ajustes.ponerMovimiento(Ajustes.movimiento() === 'off' ? 'on' : 'off'); UI.showToast('✨ Animaciones actualizadas.'); } } },
    { texto: 'Ir a mi perfil', icono: 'ri-user-settings-line', accion: () => UI.irA('perfil') }
  ];

  function construirItems(consulta) {
    const q = normalizar(consulta);
    const acierta = texto => !q || normalizar(texto).indexOf(q) >= 0;
    const permitidos = MODOS[paleta.modo] || null;
    const deja = item => !permitidos || permitidos.indexOf(item.grupo) >= 0;
    const items = [];

    if (typeof Secciones !== 'undefined' && typeof AuthManager !== 'undefined' && AuthManager.profile) {
      Secciones.visibles(AuthManager.profile).forEach(sec => {
        if (acierta(sec.etiqueta)) {
          items.push({
            grupo: 'Ir a', icono: sec.icono || 'ri-arrow-right-line', texto: sec.etiqueta,
            meta: 'Módulo', peso: q && normalizar(sec.etiqueta).indexOf(q) === 0 ? 0 : 2,
            accion: () => UI.irA(sec.id)
          });
        }
        (sec.hijos || []).forEach(hijo => {
          if (!acierta(hijo.etiqueta)) return;
          items.push({
            grupo: 'Ir a', icono: hijo.icono || 'ri-corner-down-right-line',
            texto: `${sec.etiqueta} · ${hijo.etiqueta}`, meta: 'Sección', peso: 4,
            accion: () => { if (typeof hijo.accion === 'function') hijo.accion(); else UI.irA(sec.id); }
          });
        });
      });
    }

    if ((q || paleta.modo === 'estudiantes' || paleta.modo === 'grupos') &&
        typeof DataEngine !== 'undefined' && typeof DataEngine.getEstudiantes === 'function') {
      DataEngine.getEstudiantes().filter(est => !q || acierta(`${est.nombres} ${est.apellidos}`))
        .slice(q ? 8 : 6)
        .forEach(est => items.push({
          grupo: 'Estudiantes', icono: 'ri-user-line',
          texto: `${est.nombres} ${est.apellidos}`,
          meta: est.grupoNombre || est.estado || '', peso: 1,
          accion: () => { UI.irA('estudiantes'); window.setTimeout(() => abrirDetalleEstudiante(est), 120); }
        }));
      const grupos = gruposDb();
      grupos.filter(g => !q || acierta(g.nombre)).slice(0, 5).forEach(g => items.push({
        grupo: 'Grupos', icono: 'ri-team-line', texto: g.nombre, meta: `${(g.estudiantes || []).length} estudiante(s)`, peso: 3,
        accion: () => UI.irA('grupos')
      }));
    }

    ACCIONES.filter(a => acierta(a.texto)).forEach(a => items.push({
      grupo: 'Acciones', icono: a.icono, texto: a.texto, meta: 'Acción', peso: 5, accion: a.accion
    }));

    return items.filter(deja).sort((a, b) => a.peso - b.peso).slice(0, 24);
  }

  function pintarPaleta() {
    const lista = document.getElementById('paleta-lista');
    const vacio = document.getElementById('paleta-vacio');
    if (!lista) return;
    if (!paleta.items.length) {
      lista.innerHTML = '';
      if (vacio) vacio.hidden = false;
      return;
    }
    if (vacio) vacio.hidden = true;
    if (paleta.sel >= paleta.items.length) paleta.sel = 0;
    let grupoActual = null;
    lista.innerHTML = paleta.items.map((item, i) => {
      const cabecera = item.grupo !== grupoActual ? `<li class="paleta-grupo" role="presentation">${esc(item.grupo)}</li>` : '';
      grupoActual = item.grupo;
      return cabecera +
        `<li class="paleta-item${i === paleta.sel ? ' activo' : ''}" role="option" id="paleta-op-${i}"` +
        ` aria-selected="${i === paleta.sel}" data-paleta-indice="${i}">` +
        `<i class="${esc(item.icono)}" aria-hidden="true"></i>` +
        `<span class="paleta-texto">${resaltar(item.texto, paleta.consulta)}</span>` +
        `<span class="paleta-meta">${esc(item.meta || '')}</span>` +
        `<kbd class="paleta-tecla" aria-hidden="true">↵</kbd></li>`;
    }).join('');
    const activo = $(`.paleta-item[data-paleta-indice="${paleta.sel}"]`, lista);
    if (activo && activo.scrollIntoView) activo.scrollIntoView({ block: 'nearest' });
    const input = document.getElementById('paleta-input');
    if (input) input.setAttribute('aria-activedescendant', activo ? activo.id : '');
  }

  function abrirPaleta() {
    const fondo = document.getElementById('paleta-fondo');
    if (!fondo) return;
    paleta.ultimoFoco = document.activeElement;
    paleta.abierta = true;
    paleta.sel = 0;
    paleta.consulta = '';
    fondo.hidden = false;
    sincronizarModosPaleta();
    const input = document.getElementById('paleta-input');
    if (input) { input.value = ''; input.focus(); }
    paleta.items = construirItems('');
    pintarPaleta();
  }

  function cerrarPaleta() {
    const fondo = document.getElementById('paleta-fondo');
    if (!fondo || !paleta.abierta) return;
    paleta.abierta = false;
    fondo.hidden = true;
    if (paleta.ultimoFoco && typeof paleta.ultimoFoco.focus === 'function') paleta.ultimoFoco.focus();
  }

  function moverPaleta(paso) {
    if (!paleta.items.length) return;
    paleta.sel = (paleta.sel + paso + paleta.items.length) % paleta.items.length;
    pintarPaleta();
  }

  function ejecutarPaleta(indice) {
    const item = paleta.items[indice === undefined ? paleta.sel : indice];
    if (!item) return;
    cerrarPaleta();
    window.setTimeout(() => { try { item.accion(); } catch (e) { console.warn('Paleta:', e); } }, 30);
  }

  /* ═══════════════════════════════════════════════════════════
     9 · TECLADO Y ACCESIBILIDAD
     ═══════════════════════════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════════════
     13 · SEGUIMIENTO — ALERTAS AUTOMÁTICAS Y PROYECCIÓN
     ───────────────────────────────────────────────────────────
     Cinco reglas se recalculan en cada pintado del panel
     principal: rendimiento bajo, alcance imposible, estudiante
     sin notas, módulo sin notas y grupo sin matrícula. Cada
     alerta se puede marcar como revisada (se guarda en local) y
     la proyección responde a lo que un docente pregunta antes
     de cerrar un corte: «¿qué nota necesita para llegar al
     mínimo?». Todo es de solo lectura sobre DataEngine: no
     escribe en la base ni cambia el cálculo de nadie.
     ═══════════════════════════════════════════════════════════ */
  const CLAVE_SEGUIMIENTO = 'tic-seguimiento-revisados';
  // Columnas que no son evaluaciones (totales, firmas, fechas…):
  // no cuentan como nota cargada ni como pendiente.
  const COL_NO_EVALUACION = /^(total|subtotal|promedio|general|firmas|firma|fecha|pagina|listado|observaciones|detalle|encabezado)/;
  const ORDEN_GRAVEDAD = { alta: 0, media: 1, baja: 2 };
  let segAlertas = [];
  let segFirma = '';
  let segExpandido = false;
  let segRevisadasVisible = false;

  function umbralAprobacion() {
    const campo = document.getElementById('input-umbral');
    const enDOM = campo ? Number(campo.value) : NaN;
    if (Number.isFinite(enDOM) && enDOM > 0) return Math.round(enDOM);
    try {
      if (typeof CuadernoEngine !== 'undefined' && CuadernoEngine && typeof CuadernoEngine.cargarPreferenciasExportacion === 'function') {
        const guardado = Number(CuadernoEngine.cargarPreferenciasExportacion().umbral);
        if (Number.isFinite(guardado) && guardado > 0) return Math.round(guardado);
      }
    } catch (e) { /* sin preferencias guardadas */ }
    const db = (typeof DataEngine !== 'undefined' && DataEngine && DataEngine.db) || {};
    const informe = Number(db.informe && db.informe.umbral);
    return Number.isFinite(informe) && informe > 0 ? Math.round(informe) : 60;
  }

  function modulosDeEstudiante(est) {
    const base = (typeof MODULOS_TRANSVERSALES !== 'undefined' && Array.isArray(MODULOS_TRANSVERSALES))
      ? MODULOS_TRANSVERSALES : [];
    const lista = base.slice();
    Object.keys((est && est.evaluacionesPorModulo) || {}).forEach(modulo => {
      if (lista.indexOf(modulo) < 0) lista.push(modulo);
    });
    return lista;
  }

  const esColumnaEvaluacion = nombre => {
    const texto = normalizar(String(nombre || '').trim());
    return Boolean(texto) && !COL_NO_EVALUACION.test(texto);
  };

  /* Modelo lineal de proyección: X es la nota que sacará en todo
     lo pendiente. El promedio proyectado es la media de los
     promedios modulares con esas X puestas, así que basta despejar
     X para saber qué exige el mínimo aprobatorio. */
  function proyeccionEstudiante(est, grupo) {
    const umbral = umbralAprobacion();
    const evaluaciones = (est && est.evaluacionesPorModulo) || {};
    const filas = [];

    modulosDeEstudiante(est).forEach(modulo => {
      if (est.convalidaciones && est.convalidaciones[modulo]) return;
      const registro = evaluaciones[modulo] || null;
      const notas = (registro && (registro.notas || registro.evaluaciones)) || null;
      const conocidas = [];
      const conocer = nombre => {
        if (esColumnaEvaluacion(nombre) && conocidas.indexOf(nombre) < 0) conocidas.push(nombre);
      };
      if (notas) Object.keys(notas).forEach(conocer);
      const estructura = grupo && grupo.estructuraModulos && grupo.estructuraModulos[modulo];
      ((estructura && estructura.columnasOrdenadas) || [])
        .forEach(col => conocer(col && col.nombreDisplay ? col.nombreDisplay : col));

      let suma = 0, hechas = 0;
      if (notas) Object.keys(notas).forEach(col => {
        const valor = notas[col];
        if (typeof valor === 'number' && isFinite(valor)) { suma += valor; hechas++; }
      });
      let pendientes = conocidas.filter(col => {
        const valor = notas ? notas[col] : null;
        return !(typeof valor === 'number' && isFinite(valor));
      }).length;
      // Módulo sin nada cargado: falta al menos una evaluación.
      if (!pendientes && !hechas) pendientes = 1;

      filas.push({ modulo, suma, hechas, pendientes, promedio: hechas ? suma / hechas : null });
    });

    let a = 0, b = 0, modulos = 0, pendientes = 0, sumaActual = 0, modulosConNota = 0;
    filas.forEach(f => {
      modulos++; pendientes += f.pendientes;
      if (f.hechas > 0) {
        sumaActual += f.promedio; modulosConNota++;
        if (f.pendientes > 0) {
          const total = f.hechas + f.pendientes;
          a += f.suma / total; b += f.pendientes / total;
        } else a += f.promedio;
      } else b += 1;
    });

    const promedio = modulosConNota ? Math.round(sumaActual / modulosConNota) : null;
    const base = { umbral, filas, promedio, pendientes, modulos };
    if (!modulos) return Object.assign(base, { estado: 'sin-datos', necesita: null, mejor: null, peor: null });
    if (!pendientes) return Object.assign(base, { estado: 'cerrado', necesita: null, mejor: promedio, peor: promedio });

    // Promedio proyectado = media de los promedios modulares:
    // rango y despeje se expresan siempre sobre esa media.
    const peor = Math.round(a / modulos);
    const mejor = Math.round((a + b * 100) / modulos);
    const requerido = b > 0 ? (umbral * modulos - a) / b : Infinity;
    let estado = 'en-alcance';
    if (requerido <= 0) estado = 'seguro';
    else if (requerido > 100 || mejor < umbral) estado = 'imposible';
    return Object.assign(base, {
      estado,
      necesita: estado === 'imposible' ? null : Math.max(0, Math.ceil(requerido)),
      mejor, peor
    });
  }

  const revisadosSeguimiento = () => {
    try {
      const dato = JSON.parse(leerLocal(CLAVE_SEGUIMIENTO, '{}'));
      return dato && typeof dato === 'object' ? dato : {};
    } catch (e) { return {}; }
  };

  function calcularSeguimiento() {
    const umbral = umbralAprobacion();
    const alertas = [];
    const modulos = (typeof MODULOS_TRANSVERSALES !== 'undefined' && Array.isArray(MODULOS_TRANSVERSALES))
      ? MODULOS_TRANSVERSALES : [];

    gruposDb().forEach(grupo => {
      const matricula = (Array.isArray(grupo.estudiantes) ? grupo.estudiantes : []).filter(Boolean);
      if (!matricula.length) {
        alertas.push({
          id: `grupo-vacio|${grupo.id}`, regla: 'grupo-vacio', gravedad: 'baja',
          icono: 'ri-team-line', titulo: `Grupo ${grupo.nombre} sin matrícula`,
          texto: 'Todavía no se ha cargado la lista de este grupo.',
          accion: { tipo: 'grupos', etiqueta: 'Abrir grupos' }
        });
        return;
      }
      modulos.forEach(modulo => {
        let evaluables = 0, conNotas = 0;
        matricula.forEach(est => {
          if (est.estado === 'Retirado') return;
          if (est.convalidaciones && est.convalidaciones[modulo]) return;
          evaluables++;
          const registro = est.evaluacionesPorModulo && est.evaluacionesPorModulo[modulo];
          const notas = registro && (registro.notas || registro.evaluaciones);
          if (notas && Object.keys(notas).some(col => typeof notas[col] === 'number' && isFinite(notas[col]))) conNotas++;
        });
        if (evaluables && !conNotas) {
          alertas.push({
            id: `modulo-sin-notas|${grupo.id}|${modulo}`, regla: 'modulo-sin-notas', gravedad: 'baja',
            icono: 'ri-book-2-line', titulo: `${grupo.nombre} · ${modulo}`,
            texto: 'Ningún estudiante de este grupo tiene notas en el módulo.',
            accion: { tipo: 'estadisticas', grupo: grupo.id, modulo: modulo, etiqueta: 'Ver en estadísticas' }
          });
        }
      });
      matricula.forEach(est => {
        if (est.estado === 'Retirado') return;
        const nombre = `${est.nombres || ''} ${est.apellidos || ''}`.trim() || 'Estudiante sin nombre';
        const proy = proyeccionEstudiante(est, grupo);
        const ficha = { tipo: 'ficha', estId: est.id, etiqueta: 'Ver ficha' };
        if (proy.estado === 'imposible') {
          alertas.push({
            id: `sin-alcance|${est.id}`, regla: 'sin-alcance', gravedad: 'alta',
            icono: 'ri-error-warning-line', titulo: `${nombre}: no alcanza el mínimo`,
            texto: `Lo máximo posible con lo cargado es ${proy.mejor}/100 y el mínimo es ${umbral}.`,
            accion: ficha
          });
        } else if (proy.promedio === null) {
          alertas.push({
            id: `sin-notas|${est.id}`, regla: 'sin-notas', gravedad: 'media',
            icono: 'ri-file-list-3-line', titulo: `${nombre}: sin notas`,
            texto: `Grupo ${grupo.nombre}: ninguna evaluación cargada en ${proy.modulos} módulo(s).`,
            accion: ficha
          });
        } else if (proy.promedio < umbral) {
          alertas.push({
            id: `rendimiento-bajo|${est.id}`, regla: 'rendimiento-bajo', gravedad: 'media',
            icono: 'ri-line-chart-line', titulo: `${nombre}: promedio ${proy.promedio}/100`,
            texto: proy.estado === 'cerrado'
              ? `Cerró en ${proy.promedio} con un mínimo aprobatorio de ${umbral}.`
              : proy.estado === 'seguro'
                ? `Va en ${proy.promedio} pero lo pendiente ya le asegura cerrar en ${umbral} o más.`
                : proy.pendientes
                  ? `Faltan ${proy.pendientes} evaluación(es): necesita ${proy.necesita} o más para cerrar en ${umbral}.`
                  : `Va por debajo del mínimo aprobatorio de ${umbral}.`,
            accion: ficha
          });
        }
      });
    });

    alertas.sort((x, y) =>
      (ORDEN_GRAVEDAD[x.gravedad] - ORDEN_GRAVEDAD[y.gravedad]) || String(x.titulo).localeCompare(String(y.titulo)));
    segAlertas = alertas;
    return { alertas: alertas, umbral: umbral };
  }

  function marcarSeguimiento(clave, volver) {
    const revisados = revisadosSeguimiento();
    if (volver) delete revisados[clave];
    else revisados[clave] = Date.now();
    escribirLocal(CLAVE_SEGUIMIENTO, JSON.stringify(revisados));
    pintarSeguimiento(true);
    UI.showToast(volver ? '👁️ Alerta devuelta a la lista de pendientes.' : '✅ Alerta marcada como revisada.', 'success');
  }

  function restablecerSeguimiento() {
    escribirLocal(CLAVE_SEGUIMIENTO, null);
    segRevisadasVisible = false;
    pintarSeguimiento(true);
    UI.showToast('↺ Se restauraron todas las alertas del seguimiento.', 'info');
  }

  function ejecutarAccionSeguimiento(clave) {
    const alerta = segAlertas.filter(a => a.id === clave)[0];
    if (!alerta || !alerta.accion) return;
    const accion = alerta.accion;
    if (accion.tipo === 'ficha') {
      const idBuscado = String(accion.estId);
      let estudiante = null;
      gruposDb().forEach(g => {
        if (estudiante) return;
        estudiante = (Array.isArray(g.estudiantes) ? g.estudiantes : []).filter(Boolean)
          .filter(e => String(e.id) === idBuscado)[0] || null;
      });
      if (!estudiante && typeof DataEngine !== 'undefined' && DataEngine && typeof DataEngine.getEstudiantes === 'function') {
        estudiante = DataEngine.getEstudiantes().filter(e => String(e.id) === idBuscado)[0];
      }
      if (estudiante) abrirDetalleEstudiante(estudiante);
      else UI.showToast('ℹ️ Ese estudiante ya no está en la base.', 'info');
      return;
    }
    if (accion.tipo === 'estadisticas') {
      const params = {};
      if (accion.grupo) params.grupo = accion.grupo;
      if (accion.modulo) params.modulo = accion.modulo;
      UI.fijarFiltros('estadisticas', params);
      UI.irA('estadisticas');
      UI.showToast(`📊 Estadísticas${accion.modulo ? ` de ${accion.modulo}` : ''} con los filtros de la alerta.`, 'info');
      return;
    }
    if (accion.tipo === 'grupos') UI.irA('grupos');
  }

  function segItemHTML(a) {
    return `<li class="seg-item ${esc(a.gravedad)}${a.revisada ? ' revisada' : ''}">
      <span class="seg-icono" aria-hidden="true"><i class="${esc(a.icono)}"></i></span>
      <div class="seg-datos">
        <strong>${esc(a.titulo)}</strong>
        <p>${esc(a.texto)}</p>
      </div>
      <div class="seg-acciones">
        <button type="button" class="btn-primary-soft" data-seg-accion="${esc(a.id)}">
          <i class="ri-arrow-right-line" aria-hidden="true"></i> ${esc(a.accion ? a.accion.etiqueta : 'Ver detalle')}</button>
        <button type="button" class="btn-icon" data-seg-revisar="${esc(a.id)}"${a.revisada ? ' data-seg-valor="1"' : ''}
          title="${a.revisada ? 'Devolver a pendientes' : 'Marcar como revisado'}"
          aria-label="${a.revisada ? 'Devolver alerta a pendientes' : 'Marcar alerta como revisada'}">
          <i class="${a.revisada ? 'ri-eye-line' : 'ri-check-double-line'}" aria-hidden="true"></i></button>
      </div>
    </li>`;
  }

  /* La tarjeta se reconstruye solo cuando algo cambia de verdad
     (alertas, contadores o expansión): así no se roba el foco. */
  function pintarSeguimiento(forzar) {
    const workspace = document.getElementById('workspace');
    if (!workspace || typeof UI === 'undefined' || !UI) return;
    let panel = document.getElementById('seg-panel');
    const ancla = $('.dash-kpis', workspace);
    if (UI.currentModule !== 'dashboard' || !ancla) { if (panel) panel.remove(); segFirma = ''; return; }

    const calculo = calcularSeguimiento();
    const umbral = calculo.umbral;
    const revisados = revisadosSeguimiento();
    const pendientes = calculo.alertas.filter(a => !revisados[a.id]);
    const revisadas = calculo.alertas.filter(a => Boolean(revisados[a.id]));
    // El orden de gravedad se respeta también al enseñar revisadas.
    const visibles = segRevisadasVisible
      ? calculo.alertas.map(a => (revisados[a.id] ? Object.assign({}, a, { revisada: true }) : a))
      : pendientes;
    const mostrar = visibles.slice(0, segExpandido ? visibles.length : 6);
    const firma = [umbral, pendientes.length, revisadas.length, visibles.length,
      segExpandido, segRevisadasVisible, mostrar.map(a => a.id).join('|')].join('¦');
    if (panel && !forzar && firma === segFirma) return;
    segFirma = firma;

    const cuenta = g => pendientes.filter(a => a.gravedad === g).length;
    const chip = (tipo, texto) => {
      const n = cuenta(tipo);
      return n ? `<span class="seg-chip ${tipo}"><b>${n}</b> ${texto}</span>` : '';
    };
    const cuerpo = mostrar.length
      ? `<ul class="seg-lista">${mostrar.map(segItemHTML).join('')}</ul>`
      : `<div class="seg-vacio"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>
          <p><strong>Todo al día.</strong> Ninguna regla dispara alertas ahora mismo
          (mínimo aprobatorio ${umbral}/100, ${gruposDb().length} grupo(s) revisados).</p></div>`;

    const html = `
      <header class="panel-cabecera">
        <span class="panel-icono"><i class="ri-alarm-warning-line" aria-hidden="true"></i></span>
        <div class="panel-titular">
          <p class="panel-eyebrow">Pulso de hoy</p>
          <h3>Seguimiento automático</h3>
          <p class="panel-lema">Reglas sobre notas y matrícula · mínimo aprobatorio <b>${umbral}/100</b>.
            Se recalcula con cada pintado del panel.</p>
        </div>
        <div class="seg-chips">
          ${chip('alta', 'por revisar')}${chip('media', 'atención')}${chip('baja', 'informativas')}
          ${pendientes.length ? '' : '<span class="seg-chip limpia"><b>0</b> alertas</span>'}
        </div>
      </header>
      <div class="panel-cuerpo">${cuerpo}</div>
      <footer class="panel-acciones split">
        <span class="seg-nota"><i class="ri-history-line" aria-hidden="true"></i>
          ${pendientes.length} sin revisar${revisadas.length ? ` · ${revisadas.length} revisada(s)` : ''}</span>
        <div class="seg-botones">
          ${revisadas.length ? `<button type="button" class="btn-ghost" data-seg-ver-revisadas>${
            segRevisadasVisible ? 'Ocultar revisadas' : `Ver revisadas (${revisadas.length})`}</button>` : ''}
          ${revisadas.length ? '<button type="button" class="btn-ghost" data-seg-restablecer><i class="ri-arrow-go-back-line" aria-hidden="true"></i> Restablecer</button>' : ''}
          ${visibles.length > 6 ? `<button type="button" class="btn-primary-soft" data-seg-expandir>${
            segExpandido ? 'Ver menos' : `Ver las ${visibles.length} alertas`}</button>` : ''}
        </div>
      </footer>`;

    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'seg-panel';
      panel.className = 'seg-panel';
      panel.setAttribute('aria-label', 'Seguimiento y alertas automáticas');
      ancla.parentNode.insertBefore(panel, ancla.nextSibling);
    }
    panel.innerHTML = html;
  }

  /* Bloque de proyección dentro del cajón de detalle. */
  function proyeccionHTML(est, grupo) {
    if (!est || est.estado === 'Retirado') return '';
    const proy = proyeccionEstudiante(est, grupo);
    const dato = (rotulo, valor, tono) =>
      `<div class="seg-dato${tono ? ' ' + tono : ''}"><span>${esc(rotulo)}</span><b>${esc(valor)}</b></div>`;

    let mensaje = '';
    if (proy.estado === 'sin-datos') {
      mensaje = 'Módulos convalidados o sin evaluaciones: no aplica la proyección.';
    } else if (proy.estado === 'cerrado') {
      mensaje = proy.promedio >= proy.umbral
        ? `Sin evaluaciones pendientes: cierra con <b>${proy.promedio}</b> y supera el mínimo de ${proy.umbral}.`
        : `Sin evaluaciones pendientes: cierra con <b>${proy.promedio}</b> y el mínimo aprobatorio es ${proy.umbral}.`;
    } else if (proy.estado === 'imposible') {
      mensaje = `Con lo cargado lo máximo posible es <b>${proy.mejor}</b>: ni cerrando en 100 se llega al mínimo de ${proy.umbral}.`;
    } else if (proy.estado === 'seguro') {
      mensaje = `Seguro: incluso con <b>0</b> en lo pendiente cierra en <b>${proy.peor}</b> y el mínimo es ${proy.umbral}.`;
    } else {
      mensaje = `Para cerrar en <b>${proy.umbral}</b> necesita <b>${proy.necesita}</b> o más en las ` +
        `<b>${proy.pendientes}</b> evaluación(es) pendientes. Rango posible: ${proy.peor}–${proy.mejor}.`;
    }

    const pendientesFilas = proy.filas.filter(f => f.pendientes > 0);
    const lista = pendientesFilas.length ? `<ul class="seg-modulos">${pendientesFilas.map(f => {
      const requerido = f.hechas > 0 ? Math.ceil(proy.umbral * (f.hechas + 1) - f.suma) : proy.umbral;
      const nota = requerido <= 0 ? 'ya asegurada' : (requerido > 100 ? 'no alcanzable' : `próxima ≥ ${requerido}`);
      return `<li${requerido > 100 ? ' class="seg-mod-imposible"' : ''}>
        <span class="seg-mod-nombre">${esc(f.modulo)}</span>
        <span class="seg-mod-vals"><b>${f.hechas ? Math.round(f.promedio) : '—'}</b> · ${f.pendientes} pend. · <em>${nota}</em></span>
      </li>`;
    }).join('')}</ul>` : '';

    return `<section class="seg-proyeccion ${esc(proy.estado)}">
      <h4><i class="ri-line-chart-line" aria-hidden="true"></i> Proyección de notas
        <span class="seg-umbral">mínimo ${proy.umbral}</span></h4>
      <div class="seg-datos-row">
        ${dato('Promedio', proy.promedio === null ? '—' : String(proy.promedio),
          proy.promedio === null ? '' : (proy.promedio >= proy.umbral ? 'bien' : 'mal'))}
        ${dato('Pendientes', String(proy.pendientes))}
        ${dato('Necesario', proy.estado === 'en-alcance' ? String(proy.necesita)
          : (proy.estado === 'seguro' ? '0' : '—'), proy.estado === 'en-alcance' ? 'mal' : 'bien')}
      </div>
      <p class="seg-nota-p">${mensaje}</p>
      ${lista}
    </section>`;
  }

  /* ═══════════════════════════════════════════════════════════
     14 · GRÁFICAS — TOOLTIP FLOTANTE Y CLIC QUE FILTRA
     ───────────────────────────────────────────────────────────
     Cada barra y dona lleva `data-grafico-tip` con el texto
     completo (incluido lo que el diseño trunca) y, cuando aplica,
     `data-grafico-filtro` con la clave/valor del filtro. El ratón
     enseña la ayuda en un globo flotante y el clic aplica ese
     filtro en Estadísticas desde cualquier vista.
     ═══════════════════════════════════════════════════════════ */
  function inyectarTooltipGrafico() {
    if (document.getElementById('grafico-tooltip')) return;
    const gav = document.createElement('div');
    gav.id = 'grafico-tooltip';
    gav.className = 'grafico-tooltip';
    gav.setAttribute('role', 'tooltip');
    gav.hidden = true;
    document.body.appendChild(gav);
  }

  function colocarTooltip(x, y) {
    const gav = document.getElementById('grafico-tooltip');
    if (!gav || gav.hidden) return;
    const hueco = 14;
    const caja = gav.getBoundingClientRect();
    let izquierda = x + hueco;
    let arriba = y + hueco;
    if (izquierda + caja.width > window.innerWidth - 8) izquierda = x - caja.width - hueco;
    if (arriba + caja.height > window.innerHeight - 8) arriba = y - caja.height - hueco;
    gav.style.left = `${Math.max(6, Math.round(izquierda))}px`;
    gav.style.top = `${Math.max(6, Math.round(arriba))}px`;
  }

  function pintarTooltip(nodo, x, y) {
    inyectarTooltipGrafico();
    const gav = document.getElementById('grafico-tooltip');
    if (!gav) return;
    const texto = nodo.getAttribute('data-grafico-tip') || '';
    if (gav._origen !== nodo || gav.textContent !== texto) {
      gav.textContent = texto;
      gav._origen = nodo;
    }
    if (gav.hidden) gav.hidden = false;
    colocarTooltip(x, y);
  }

  function ocultarTooltip() {
    const gav = document.getElementById('grafico-tooltip');
    if (!gav) return;
    gav.hidden = true;
    gav._origen = null;
  }

  function clicGraficoFiltro(crudo) {
    let cfg = null;
    try { cfg = JSON.parse(String(crudo || '')); } catch (e) { cfg = null; }
    const valor = cfg ? cfg.valor : null;
    if (!cfg || !cfg.clave || valor === undefined || valor === null || valor === '') return;
    if (typeof UI === 'undefined' || !UI) return;
    const traductor = ETIQUETAS_CLAVE[cfg.clave];
    let detalle;
    try {
      detalle = typeof traductor === 'function' ? String(traductor(valor)) : `${cfg.clave}: ${valor}`;
    } catch (e) { detalle = `${cfg.clave}: ${valor}`; }
    const registro = {
      tipo: 'cambio', titulo: 'Filtro aplicado desde una gráfica',
      texto: detalle, seccion: UI.currentModule, clave: `grafico-${cfg.clave}`
    };
    if (UI.currentModule === 'estadisticas' && typeof StatsEngine !== 'undefined' &&
        StatsEngine && typeof StatsEngine.cambiarFiltro === 'function') {
      StatsEngine.cambiarFiltro(cfg.clave, valor);
      UI.showToast(`🔎 ${detalle}`, 'info');
      try { registrarEvento(registro); } catch (e) { /* el aviso es optativo */ }
      return;
    }
    const params = {};
    params[cfg.clave] = valor;
    UI.fijarFiltros('estadisticas', params);
    UI.irA('estadisticas');
    UI.showToast(`📊 Estadísticas con ${detalle}.`, 'info');
    try { registrarEvento(registro); } catch (e) { /* el aviso es optativo */ }
  }

  function instalarEventos() {
    document.addEventListener('click', event => {
      const destino = event.target;
      if (!destino || !destino.closest) return;

      if (destino.closest('#btn-apariencia')) { alternarApariencia(); return; }
      if (destino.closest('#btn-avisos')) { alternarCentroAvisos(); return; }
      if (destino.closest('#paleta-atajo')) { abrirPaleta(); return; }

      // Panel de apariencia
      const segmento = destino.closest('[data-ajuste]');
      if (segmento) { cambiarAjuste(segmento.dataset.ajuste, segmento.dataset.valor); return; }
      if (destino.closest('[data-restablecer-apariencia]')) {
        const antes = snapshotApariencia();
        restaurarApariencia({ tema: 'sistema', movimiento: 'auto', densidad: 'comoda', menu: 'expandido' });
        UI.showToast('♻️ Apariencia restablecida a los valores del panel.', 'success',
          { texto: 'Deshacer', ejecutar: () => restaurarApariencia(antes) });
        return;
      }
      if (destino.closest('[data-cerrar-drawer]')) {
        cerrarApariencia();
        cerrarDetalle();
        return;
      }
      const accionDetalleBtn = destino.closest('[data-detalle-accion]');
      if (accionDetalleBtn) { accionDetalle(accionDetalleBtn.dataset.detalleAccion); return; }

      // Centro de avisos
      if (destino.closest('[data-cerrar-avisos]')) { cerrarCentroAvisos(); return; }
      if (destino.closest('[data-actualizaciones]')) { abrirActualizaciones(); return; }
      if (destino.closest('[data-cerrar-actualizaciones]')) { cerrarActualizaciones(); return; }
      if (destino.closest('[data-comprobar-actualizaciones]')) { comprobarActualizaciones(); return; }
      if (destino.closest('[data-marcar-version]')) { marcarVersionVista(); return; }
      // Modo mantenimiento (banner del administrador y pantalla de bloqueo)
      if (destino.closest('[data-mantenimiento-toggle]')) { alternarMantenimiento(); return; }
      if (destino.closest('[data-mantenimiento-reintentar]')) { refrescarMantenimiento(); return; }
      if (destino.closest('[data-mantenimiento-salir]')) {
        try {
          if (typeof AuthManager !== 'undefined' && AuthManager && typeof AuthManager.signOut === 'function') AuthManager.signOut();
        } catch (e) { console.warn('No se pudo cerrar la sesión:', e); }
        return;
      }
      if (destino.id === 'modal-actualizaciones') { cerrarActualizaciones(); return; }
      // Seguimiento: alertas del panel principal
      const segRevisar = destino.closest('[data-seg-revisar]');
      if (segRevisar) { marcarSeguimiento(segRevisar.dataset.segRevisar, segRevisar.dataset.segValor === '1'); return; }
      if (destino.closest('[data-seg-restablecer]')) { restablecerSeguimiento(); return; }
      if (destino.closest('[data-seg-ver-revisadas]')) { segRevisadasVisible = !segRevisadasVisible; pintarSeguimiento(true); return; }
      if (destino.closest('[data-seg-expandir]')) { segExpandido = !segExpandido; pintarSeguimiento(true); return; }
      const segAccion = destino.closest('[data-seg-accion]');
      if (segAccion) { ejecutarAccionSeguimiento(segAccion.dataset.segAccion); return; }
      // Gráficas: el clic en una barra/dona aplica su filtro
      const grafFiltro = destino.closest('[data-grafico-filtro]');
      if (grafFiltro) { clicGraficoFiltro(grafFiltro.getAttribute('data-grafico-filtro')); return; }
      const chipTipo = destino.closest('[data-avisos-tipo]');
      if (chipTipo) { filtrosAvisos.tipo = chipTipo.dataset.avisosTipo || 'todos'; pintarCentroAvisos(); return; }
      if (destino.closest('[data-avisos-todo-leido]')) {
        avisos.forEach(a => { a.leido = true; });
        contarNoLeidos(); guardarAvisos(); pintarCentroAvisos();
        return;
      }
      if (destino.closest('[data-avisos-borrar]')) {
        const borrados = avisosFiltrados().map(a => a.id);
        for (let i = avisos.length - 1; i >= 0; i--) {
          if (borrados.indexOf(avisos[i].id) >= 0) {
            accionesAviso.delete(avisos[i].id);
            avisos.splice(i, 1);
          }
        }
        contarNoLeidos(); guardarAvisos(); pintarCentroAvisos();
        UI.showToast(`🗑️ ${borrados.length} aviso(s) borrados.`, 'info');
        return;
      }
      if (destino.closest('[data-avisos-quitar-filtros]')) {
        filtrosAvisos.texto = ''; filtrosAvisos.tipo = 'todos';
        filtrosAvisos.periodo = 'todo'; filtrosAvisos.persona = 'todas'; filtrosAvisos.leido = 'todos';
        pintarCentroAvisos();
        return;
      }
      if (destino.closest('[data-avisos-limpiar]')) {
        avisos.length = 0;
        accionesAviso.clear();
        contarNoLeidos();
        guardarAvisos();
        pintarCentroAvisos();
        return;
      }
      const avisoAccion = destino.closest('[data-aviso-accion]');
      if (avisoAccion) {
        const id = avisoAccion.dataset.avisoAccion;
        const accion = accionesAviso.get(id);
        const indice = avisos.findIndex(a => a.id === id);
        if (indice >= 0) avisos.splice(indice, 1);
        accionesAviso.delete(id);
        contarNoLeidos();
        guardarAvisos();
        pintarCentroAvisos();
        if (accion) { try { accion.ejecutar(); } catch (e) { console.warn('Deshacer:', e); } }
        return;
      }
      const itemAviso = destino.closest('[data-aviso]');
      if (itemAviso) { marcarLeido(itemAviso.dataset.aviso); return; }
      if (destino.closest('#mejoras-fondo')) { cerrarApariencia(); cerrarDetalle(); return; }
      if (destino.closest('#paleta-fondo') && !destino.closest('.paleta')) { cerrarPaleta(); return; }

      // Clic fuera de los avisos → se cierran.
      if (!destino.closest('#centro-avisos') && !destino.closest('#btn-avisos')) cerrarCentroAvisos();

      // ── Barra de filtros global ───────────────────────────────
      if (destino.closest('[data-fg-limpiar]')) { limpiarFiltrosGlobales(); return; }

      // ── Tarjetas KPI ──────────────────────────────────────────
      if (destino.closest('.ayuda-btn') || destino.closest('.metrica-ayuda')) return;
      const kpi = destino.closest('.kpi-clicable');
      if (kpi) { activarKPI(kpi); return; }

      // ── Filas de tabla → cajón de detalle ─────────────────────
      if (destino.closest('button, a, input, select, label, .ayuda-btn')) return;
      const fila = destino.closest('#workspace table tbody tr[data-est-id], #workspace table tbody tr[data-estudiante-id]');
      if (fila && fila.offsetParent !== null) { abrirEstudiantePorFila(fila); return; }

      // ── Cabeceras ordenables ──────────────────────────────────
      const th = destino.closest('#workspace table thead th[data-orden-hecho]');
      if (th) { alternarOrden(th); }
    });

    document.addEventListener('change', event => {
      const select = event.target;
      if (!select || !select.matches) return;
      if (select.matches('[data-fg]')) { aplicarFiltroGlobal(select.dataset.fg, select.value); return; }
      if (select.matches('[data-av-periodo]')) { filtrosAvisos.periodo = select.value; pintarCentroAvisos(); return; }
      if (select.matches('[data-av-persona]')) { filtrosAvisos.persona = select.value; pintarCentroAvisos(); return; }
      if (select.matches('[data-av-leido]')) { filtrosAvisos.leido = select.value; pintarCentroAvisos(); }
    });

    const listaPaleta = document.getElementById('paleta-lista');
    if (listaPaleta) {
      listaPaleta.addEventListener('click', event => {
        const item = event.target.closest('[data-paleta-indice]');
        if (item) ejecutarPaleta(Number(item.dataset.paletaIndice));
      });
      listaPaleta.addEventListener('mousemove', event => {
        const item = event.target.closest('[data-paleta-indice]');
        if (!item) return;
        const indice = Number(item.dataset.paletaIndice);
        if (indice !== paleta.sel) { paleta.sel = indice; pintarPaleta(); }
      });
    }

    document.addEventListener('input', event => {
      if (!event.target) return;
      if (event.target.id === 'paleta-input') {
        paleta.sel = 0;
        paleta.consulta = event.target.value;
        paleta.items = construirItems(event.target.value);
        pintarPaleta();
        return;
      }
      if (event.target.id === 'aviso-busqueda') {
        filtrosAvisos.texto = event.target.value;
        const centro = document.getElementById('centro-avisos');
        if (!centro || centro.hidden) return;
        const foco = event.target.selectionStart;
        pintarCentroAvisos();
        const nuevo = document.getElementById('aviso-busqueda');
        if (nuevo) { nuevo.focus(); try { nuevo.setSelectionRange(foco, foco); } catch (e) { /* search */ } }
      }
    });

    /* Modos (chips) y sugerencias del estado vacío de la paleta. */
    document.addEventListener('click', event => {
      const modo = event.target.closest && event.target.closest('[data-paleta-modo]');
      if (modo) {
        paleta.modo = modo.dataset.paletaModo || 'todo';
        paleta.sel = 0;
        sincronizarModosPaleta();
        paleta.items = construirItems(paleta.consulta);
        pintarPaleta();
        const input = document.getElementById('paleta-input');
        if (input) input.focus();
        return;
      }
      const sugerencia = event.target.closest && event.target.closest('[data-sugerencia]');
      if (sugerencia) {
        const valor = sugerencia.dataset.sugerencia || '';
        const input = document.getElementById('paleta-input');
        if (input) input.value = valor;
        paleta.consulta = valor;
        paleta.sel = 0;
        paleta.items = construirItems(valor);
        pintarPaleta();
        if (input) input.focus();
      }
    });

    document.addEventListener('keydown', event => {
      const tecla = String(event.key || '').toLowerCase();

      // Ctrl/Cmd + K → paleta
      if ((event.ctrlKey || event.metaKey) && tecla === 'k') {
        event.preventDefault();
        paleta.abierta ? cerrarPaleta() : abrirPaleta();
        return;
      }
      if (event.key === 'Escape') {
        const act = document.getElementById('modal-actualizaciones');
        if (act && !act.classList.contains('hidden')) { cerrarActualizaciones(); return; }
        if (paleta.abierta) { cerrarPaleta(); return; }
        if (document.getElementById('centro-avisos') && !document.getElementById('centro-avisos').hidden) { cerrarCentroAvisos(); return; }
        if (document.getElementById('detalle-drawer') && !document.getElementById('detalle-drawer').hidden) { cerrarDetalle(); return; }
        if (document.getElementById('ajuste-drawer') && !document.getElementById('ajuste-drawer').hidden) { cerrarApariencia(); return; }
      }
      if (paleta.abierta) {
        if (event.key === 'ArrowDown') { event.preventDefault(); moverPaleta(1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); moverPaleta(-1); }
        else if (event.key === 'Home') { event.preventDefault(); paleta.sel = 0; pintarPaleta(); }
        else if (event.key === 'End') { event.preventDefault(); paleta.sel = Math.max(0, paleta.items.length - 1); pintarPaleta(); }
        else if (event.key === 'Enter') { event.preventDefault(); ejecutarPaleta(); }
        return;
      }

      const foco = event.target;
      if (!foco || !foco.closest) return;

      // Enter o Espacio en una tarjeta KPI
      if ((event.key === 'Enter' || event.key === ' ') && foco.classList && foco.classList.contains('kpi-clicable')) {
        event.preventDefault();
        activarKPI(foco);
        return;
      }
      // Enter/Space en una cabecera ordenable
      if ((event.key === 'Enter' || event.key === ' ') && foco.closest && foco.closest('thead th[data-orden-hecho]')) {
        event.preventDefault();
        alternarOrden(foco);
        return;
      }
      // Flechas en el menú lateral
      if (foco.closest && foco.closest('#sidebar-nav') && ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].indexOf(event.key) >= 0) {
        moverEnMenu(event);
      }
    });

    // La zona de resultados del buscador superior anuncia sus cambios.
    const zonaBusqueda = document.querySelector('.search-results, #search-results, .search-dropdown');
    if (zonaBusqueda) zonaBusqueda.setAttribute('aria-live', 'polite');

    // Globo de ayuda de las gráficas: sigue al ratón y se retira
    // al salir del gráfico o al desplazar la página.
    document.addEventListener('mousemove', evento => {
      const gav = document.getElementById('grafico-tooltip');
      if (!gav) return;
      const origen = evento.target;
      const nodo = origen && origen.closest ? origen.closest('[data-grafico-tip]') : null;
      if (!nodo) { if (!gav.hidden) ocultarTooltip(); return; }
      pintarTooltip(nodo, evento.clientX, evento.clientY);
    });
    window.addEventListener('scroll', ocultarTooltip, { passive: true, capture: true });
    window.addEventListener('blur', ocultarTooltip);
  }

  function alternarApariencia() {
    const drawer = document.getElementById('ajuste-drawer');
    if (!drawer) return;
    drawer.hidden ? abrirApariencia() : cerrarApariencia();
  }

  // Navegación con flechas dentro del menú lateral: ↑↓ recorren los
  // elementos, → abre el submenú, ← lo cierra.
  function moverEnMenu(event) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const focoables = $$('a[href], button:not([disabled])', nav)
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!focoables.length) return;
    const actual = focoables.indexOf(document.activeElement);
    let indice = actual;
    if (event.key === 'ArrowDown') indice = Math.min(focoables.length - 1, actual + 1);
    else if (event.key === 'ArrowUp') indice = Math.max(0, actual - 1);
    else if (event.key === 'Home') indice = 0;
    else if (event.key === 'End') indice = focoables.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const grupo = document.activeElement && document.activeElement.closest('.nav-section');
      const alternador = document.activeElement && document.activeElement.closest('.nav-chevron, .nav-toggle');
      if (grupo || alternador) {
        event.preventDefault();
        const boton = alternador || grupo.querySelector('button');
        if (boton && boton.click) boton.click();
      }
      return;
    }
    if (indice >= 0 && indice !== actual) {
      event.preventDefault();
      focoables[indice].focus();
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  return {
    init,
    esqueletoHTML,
    ponerEsqueleto,
    abrirPaleta,
    cerrarPaleta,
    abrirApariencia,
    abrirDetalleEstudiante,
    limpiarFiltrosGlobales,
    registrarAviso,
    registrarEvento,
    abrirActualizaciones,
    cerrarActualizaciones,
    comprobarActualizaciones,
    alternarMantenimiento,
    refrescarMantenimiento,
    pintarMantenimiento,
    calcularSeguimiento,
    pintarSeguimiento,
    proyeccionEstudiante,
    umbralAprobacion,
    pintarTooltip,
    ocultarTooltip,
    clicGraficoFiltro,
    VERSION,
    _avisos: avisos,
    _filtrosAvisos: filtrosAvisos,
    _mantenimiento: mantenimiento,
    _seguimiento: () => segAlertas
  };
})();
