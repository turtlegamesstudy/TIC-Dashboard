'use strict';
/* ═══════════════════════════════════════════════════════════════
   16 · MEJORAS DE INTERFAZ
   ───────────────────────────────────────────────────────────────
   Diez incrementos de usabilidad agrupados en un solo módulo para
   no dispersar los cambios por todo el panel:

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
    UI.showToast(
      `${clave === 'tema' ? 'Tema' : clave === 'movimiento' ? 'Animaciones' : clave === 'densidad' ? 'Densidad' : 'Menú'}: ` +
      `${(etiquetas[clave] || {})[valor] || valor}.`,
      'success',
      { texto: 'Deshacer', ejecutar: () => restaurarApariencia(antes) });
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
  function registrarAviso(texto, tipo, accion) {
    let meta = { titulo: 'Aviso', clase: 'info', icono: 'ri-information-line' };
    if (typeof UI !== 'undefined' && typeof UI.metaAviso === 'function') {
      const tipoAviso = typeof UI.tipoDeAviso === 'function' ? UI.tipoDeAviso(texto, tipo) : String(tipo || 'info');
      meta = UI.metaAviso(tipoAviso) || meta;
    }
    const limpio = String(texto === null || texto === undefined ? '' : texto)
      .replace(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2139}\u{FE0F}\s]+/u, '').trim() || String(texto);
    const aviso = {
      id: `av-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      titulo: meta.titulo,
      texto: limpio,
      clase: meta.clase || 'info',
      icono: meta.icono || 'ri-information-line',
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      conAccion: Boolean(accion && typeof accion.ejecutar === 'function')
    };
    avisos.unshift(aviso);
    if (aviso.conAccion) accionesAviso.set(aviso.id, accion);
    if (avisos.length > 40) {
      const fuera = avisos.pop();
      if (fuera) accionesAviso.delete(fuera.id);
    }
    noLeidos += 1;
    pintarBadge();
    if (!document.getElementById('centro-avisos')?.hidden) pintarCentroAvisos();
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

  function pintarCentroAvisos() {
    const centro = document.getElementById('centro-avisos');
    if (!centro) return;
    const cuerpo = avisos.length
      ? avisos.map(aviso => {
          const accion = accionesAviso.get(aviso.id);
          return `<li class="aviso-item aviso-${esc(aviso.clase)}">
            <span class="aviso-icono"><i class="${esc(aviso.icono)}" aria-hidden="true"></i></span>
            <span class="aviso-cuerpo">
              <strong>${esc(aviso.titulo)}</strong>
              <span>${esc(aviso.texto)}</span>
              ${accion ? `<button type="button" class="btn-ghost aviso-accion" data-aviso-accion="${esc(aviso.id)}">${esc(accion.texto || 'Deshacer')}</button>` : ''}
            </span>
            <time>${esc(aviso.hora)}</time>
          </li>`;
        }).join('')
      : `<li class="aviso-vacio"><i class="ri-notification-off-line" aria-hidden="true"></i>
           <p>Todavía no hay avisos.</p><small>Aquí quedarán los guardados, filtros y confirmaciones.</small></li>`;
    centro.innerHTML =
      `<header class="drawer-cabecera">
         <div><h2 id="avisos-titulo"><i class="ri-notification-3-line" aria-hidden="true"></i> Avisos</h2>
         <p>${avisos.length ? `${avisos.length} aviso(s) de esta sesión` : 'Confirmaciones y avisos del panel'}</p></div>
         <span class="drawer-cabecera-acciones">
           ${avisos.length ? '<button class="btn-ghost" type="button" data-avisos-limpiar><i class="ri-delete-bin-line"></i> Limpiar</button>' : ''}
           <button class="btn-icon" type="button" data-cerrar-avisos aria-label="Cerrar avisos"><i class="ri-close-line"></i></button>
         </span>
       </header>
       <ul class="aviso-lista">${cuerpo}</ul>`;
  }

  function alternarCentroAvisos() {
    const centro = document.getElementById('centro-avisos');
    if (!centro) return;
    const abierto = !centro.hidden;
    if (abierto) { cerrarCentroAvisos(); return; }
    pintarCentroAvisos();
    centro.hidden = false;
    noLeidos = 0;
    pintarBadge();
    document.getElementById('btn-avisos')?.setAttribute('aria-expanded', 'true');
  }

  function cerrarCentroAvisos() {
    const centro = document.getElementById('centro-avisos');
    if (!centro || centro.hidden) return;
    centro.hidden = true;
    document.getElementById('btn-avisos')?.setAttribute('aria-expanded', 'false');
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
    UI.showToast(!valor || valor === 'todos' || valor === ''
      ? `🧹 Filtro global «${clave}» quitado en ${vistas.length} vista(s).`
      : `🔎 Filtro global aplicado → ${traductor(valor)}`, 'info');
  }

  function limpiarFiltrosGlobales() {
    const vistas = vistasConFiltro();
    vistas.forEach(vista => { UI._paramsVista[vista] = {}; });
    UI.rutaEscribir(UI.currentModule, UI.filtrosGuardados(UI.currentModule));
    if (vistas.indexOf(UI.currentModule) >= 0) UI.renderCurrentModule({ background: true });
    else actualizarBarraFiltros();
    UI.showToast('🧹 Filtros limpiados en todas las vistas.', 'success');
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
  function instalarEventos() {
    // ── Barra superior ──────────────────────────────────────────
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
      if (destino.closest('[data-avisos-limpiar]')) {
        avisos.length = 0;
        accionesAviso.clear();
        noLeidos = 0;
        pintarBadge();
        pintarCentroAvisos();
        return;
      }
      const avisoAccion = destino.closest('[data-aviso-accion]');
      if (avisoAccion) {
        const accion = accionesAviso.get(avisoAccion.dataset.avisoAccion);
        const indice = avisos.findIndex(a => a.id === avisoAccion.dataset.avisoAccion);
        if (indice >= 0) avisos.splice(indice, 1);
        accionesAviso.delete(avisoAccion.dataset.avisoAccion);
        pintarCentroAvisos();
        if (accion) { try { accion.ejecutar(); } catch (e) { console.warn('Deshacer:', e); } }
        return;
      }
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
      if (select && select.matches && select.matches('[data-fg]')) {
        aplicarFiltroGlobal(select.dataset.fg, select.value);
      }
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
      if (event.target && event.target.id === 'paleta-input') {
        paleta.sel = 0;
        paleta.consulta = event.target.value;
        paleta.items = construirItems(event.target.value);
        pintarPaleta();
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
    _avisos: avisos
  };
})();
