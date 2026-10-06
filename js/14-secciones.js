'use strict';
/* ═══════════════════════════════════════════════════════════════
   SECCIONES DEL PANEL · Registro central de módulos
  ───────────────────────────────────────────────────────────────
   Este registro es la única fuente de verdad de "lo que se puede abrir
   en el panel". De aquí salen (1) los enlaces del menú lateral,
   (2) el texto "Cargando ...", (3) el pintado del contenido y
   (4) los permisos por rol. Antes cada sección vivía en cuatro sitios
   distintos a la vez (el HTML del sidebar, un switch en
   renderCurrentModule, los if de administración y los saltos manuales).

   ── CÓMO AÑADIR UN MÓDULO NUEVO (ej. "Inglés") ────────────────
   1. Crea un archivo, p. ej. js/15-modulo-ingles.js, y córgalo en
      index.html antes de 00-main.js:

        UI.registrarSeccion({
          id: 'ingles',                   // identificador (sin espacios)
          etiqueta: 'Inglés',             // texto del menú y de la carga
          titulo: 'Módulo de Inglés',     // tooltip (opcional)
          icono: 'ri-translate-2',
          grupo: 'Académico',             // encabezado del menú (colapsable)
          orden: 55,                      // posición dentro del menú
          roles: ['admin', 'docente'],    // opcional; sin roles los ve todos
          render: (workspace) => {
            workspace.innerHTML = '<div class="module-fade-enter">…</div>';
          },
          // Subsecciones del menú (opcional): cada una es un atajo dentro
          // o fuera de la sección. Sin `accion` solo abre la sección.
          hijos: [
            { id: 'resumen', etiqueta: 'Resumen', icono: 'ri-dashboard-3-line' },
            { id: 'hoja', etiqueta: 'Hoja de ejercicios', icono: 'ri-book-2-line',
              roles: ['admin'],                       // se oculta si el rol no lo permite
              accion: () => UI.abrirHojaEjercicios() } // se ejecuta tras abrir la sección
          ],
          alMostrar: () => { } // opcional: se ejecuta tras pintar
        });

   2. Nada más: el enlace entra solo en el menú, respeta permisos, se
      abre con UI.irA('ingles') y desaparece si el rol no lo permite.
      No hay que tocar el HTML, el switch de render ni el buscador.
      Los encabezados de grupo se pliegan/despliegan y esa preferencia
      se guarda por equipo en localStorage ('tic-nav').
   ═══════════════════════════════════════════════════════════════ */

const Secciones = {
  _registro: new Map(),
  _alias: new Map(),

  /* Registra una sección. Falla con un mensaje claro si falta lo
     imprescindible (id, etiqueta o render) o si el id ya existe: mejor
     avisar al cargar el archivo que descubrirlo en mitad de la jornada. */
  registrar(def) {
    if (!def || typeof def !== 'object') throw new Error('La sección debe definirse como un objeto.');
    const id = String(def.id || '').trim();
    if (!id) throw new Error('La sección necesita un id (p. ej. id: "ingles").');
    if (typeof def.render !== 'function') throw new Error(`La sección "${id}" necesita una función render(workspace).`);
    if (this._registro.has(id)) throw new Error(`Ya existe una sección con el id "${id}".`);

    const seccion = {
      titulo: def.etiqueta || id,
      grupo: 'Otros',
      orden: 100,
      icono: 'ri-apps-line',
      roles: null,
      oculto: false,
      ...def,
      id,
      etiqueta: String(def.etiqueta || id),
      alias: (Array.isArray(def.alias) ? def.alias : []).map(a => String(a).trim()).filter(Boolean),
      hijos: this._normalizarHijos(def.hijos)
    };

    seccion.alias.forEach(alias => {
      if (this._registro.has(alias) || this._alias.has(alias)) {
        throw new Error(`El alias "${alias}" de la sección "${id}" ya está en uso.`);
      }
      this._alias.set(alias, id);
    });

    this._registro.set(id, seccion);
    return seccion;
  },

  registrarVarias(lista) {
    (Array.isArray(lista) ? lista : []).forEach(def => this.registrar(def));
    return this;
  },

  /* Devuelve la sección por su id o por cualquiera de sus alias. */
  obtener(id) {
    if (id === null || id === undefined) return null;
    const clave = String(id);
    return this._registro.get(clave) || this._registro.get(this._alias.get(clave)) || null;
  },

  ids() { return [...this._registro.keys()]; },

  listar() { return [...this._registro.values()].sort((a, b) => a.orden - b.orden); },

  /* Un rol concreto solo ve las secciones que su `roles` permite (o todas
     si no declara roles). `disponible(perfil)` permite condiciones extra. */
  puedeVer(seccion, perfil) {
    if (!seccion || seccion.oculto) return false;
    if (typeof seccion.disponible === 'function') {
      try { if (!seccion.disponible(perfil)) return false; } catch (e) { return false; }
    }
    if (!Array.isArray(seccion.roles) || !seccion.roles.length) return true;
    const rol = perfil && perfil.role ? perfil.role : '';
    return seccion.roles.includes(rol);
  },

  visibles(perfil) { return this.listar().filter(seccion => this.puedeVer(seccion, perfil)); },

  primeraVisible(perfil) { return this.visibles(perfil)[0] || null; },

  etiquetaDe(id) {
    const seccion = this.obtener(id);
    return seccion ? seccion.etiqueta : '';
  },

  /* ── Subsecciones (hijos) del menú ──────────────────────────────
     Cada sección puede declarar `hijos`: atajos que aparecen debajo,
     plegables, con su propio icono, sus permisos y una acción. */
  _normalizarHijos(lista) {
    if (!Array.isArray(lista)) return [];
    const usados = new Set();
    return lista.filter(hijo => hijo && typeof hijo === 'object').reduce((acum, hijo) => {
      const id = String(hijo.id || hijo.etiqueta || '').trim();
      if (!id || usados.has(id)) return acum;
      usados.add(id);
      acum.push({
        id,
        etiqueta: String(hijo.etiqueta || id),
        titulo: String(hijo.titulo || hijo.etiqueta || id),
        icono: hijo.icono || 'ri-subtract-line',
        roles: Array.isArray(hijo.roles) && hijo.roles.length ? hijo.roles.slice() : null,
        oculto: hijo.oculto === true,
        accion: typeof hijo.accion === 'function' ? hijo.accion : null
      });
      return acum;
    }, []);
  },

  hijosVisibles(seccion, perfil) {
    if (!seccion || !Array.isArray(seccion.hijos)) return [];
    return seccion.hijos.filter(hijo => this.puedeVer(hijo, perfil));
  },

  hijoDe(seccion, idHijo) {
    if (!seccion || !Array.isArray(seccion.hijos)) return null;
    return seccion.hijos.find(hijo => hijo.id === idHijo) || null;
  },

  /* ── Estado plegado/desplegado del menú ──
     Se guarda por equipo: el menú no cambia de aspecto solo porque
     alguien redimensione la ventana o cambie de sección. */
  _estado: null,
  _claveEstado: 'tic-nav',

  estado() {
    if (this._estado) return this._estado;
    const estado = { grupos: {}, hijos: {} };
    try {
      const crudo = typeof localStorage !== 'undefined' ? localStorage.getItem(this._claveEstado) : null;
      if (crudo) {
        const guardado = JSON.parse(crudo);
        if (guardado && typeof guardado === 'object') {
          if (guardado.grupos && typeof guardado.grupos === 'object') estado.grupos = guardado.grupos;
          if (guardado.hijos && typeof guardado.hijos === 'object') estado.hijos = guardado.hijos;
        }
      }
    } catch (e) { /* sin almacenamiento legible: estado por defecto */ }
    this._estado = estado;
    return estado;
  },

  _guardarEstado() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(this._claveEstado, JSON.stringify(this.estado()));
    } catch (e) { /* almacenamiento bloqueado: no se recuerda */ }
  },

  /* Los grupos arrancan desplegados y las subsecciones plegadas. */
  grupoAbierto(nombre) {
    const guardado = this.estado().grupos[nombre];
    return guardado === undefined ? true : guardado !== false;
  },

  alternarGrupo(nombre) {
    const estado = this.estado();
    estado.grupos[nombre] = !this.grupoAbierto(nombre);
    this._guardarEstado();
    return estado.grupos[nombre];
  },

  hijosAbiertos(idSeccion) {
    return this.estado().hijos[idSeccion] === true;
  },

  alternarHijos(idSeccion) {
    const estado = this.estado();
    estado.hijos[idSeccion] = !this.hijosAbiertos(idSeccion);
    this._guardarEstado();
    return estado.hijos[idSeccion];
  },

  /* HTML del menú lateral para un perfil. Es una función pura para poder
     probarla sin tocar el DOM. Los encabezados de grupo son botones que
     pliegan su lista y las secciones con hijos llevan su flecha. */
  htmlNavegacion(perfil, activoId) {
    const grupos = [];
    this.visibles(perfil).forEach(seccion => {
      let grupo = grupos.find(item => item.nombre === seccion.grupo);
      if (!grupo) { grupo = { nombre: seccion.grupo, secciones: [] }; grupos.push(grupo); }
      grupo.secciones.push(seccion);
    });
    return grupos.map(grupo => {
      const abierto = this.grupoAbierto(grupo.nombre);
      const nombre = this.escapar(grupo.nombre);
      const slug = this._slug(grupo.nombre);
      return `<button type="button" class="nav-section nav-grupo" data-nav-grupo="${nombre}"` +
        ` aria-expanded="${abierto ? 'true' : 'false'}" aria-controls="nav-grupo-${slug}"` +
        ` title="${abierto ? 'Plegar' : 'Desplegar'} ${nombre}">` +
        `<span>${nombre}</span>` +
        `<i class="ri-arrow-down-s-line nav-grupo-chevron" aria-hidden="true"></i></button>` +
        `<div class="nav-grupo-items" id="nav-grupo-${slug}" data-nav-grupos-items="${nombre}"${abierto ? '' : ' hidden'}>` +
        grupo.secciones.map(seccion => this._htmlItem(seccion, activoId, perfil)).join('') +
        `</div>`;
    }).join('');
  },

  _slug(valor) {
    return String(valor).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'grupo';
  },

  _htmlItem(seccion, activoId, perfil) {
    const activa = seccion.id === activoId;
    const id = this.escapar(seccion.id);
    const enlace = `<a href="#${id}" class="nav-item${activa ? ' active' : ''}" data-module="${id}"` +
      ` title="${this.escapar(seccion.titulo)}"${activa ? ' aria-current="page"' : ''}>` +
      `<i class="${this.escapar(seccion.icono)}" aria-hidden="true"></i>` +
      `<span>${this.escapar(seccion.etiqueta)}</span></a>`;

    const hijos = this.hijosVisibles(seccion, perfil);
    if (!hijos.length) return enlace;

    const abiertos = this.hijosAbiertos(seccion.id);
    return `<div class="nav-con-hijos">${enlace}` +
      `<button type="button" class="nav-chevron" data-nav-toggle="${id}"` +
      ` aria-expanded="${abiertos ? 'true' : 'false'}" aria-controls="nav-hijos-${id}"` +
      ` aria-label="${abiertos ? 'Ocultar' : 'Mostrar'} subsecciones de ${this.escapar(seccion.etiqueta)}">` +
      `<i class="ri-arrow-down-s-line" aria-hidden="true"></i></button>` +
      `<div class="nav-hijos" id="nav-hijos-${id}" data-nav-hijos="${id}"${abiertos ? '' : ' hidden'}>` +
      hijos.map(hijo => this._htmlHijo(seccion, hijo)).join('') +
      `</div></div>`;
  },

  _htmlHijo(seccion, hijo) {
    const id = this.escapar(seccion.id);
    return `<a href="#${id}" class="nav-item nav-hijo" data-module="${id}" data-hijo="${this.escapar(hijo.id)}"` +
      ` title="${this.escapar(hijo.titulo)}">` +
      `<i class="${this.escapar(hijo.icono)}" aria-hidden="true"></i>` +
      `<span>${this.escapar(hijo.etiqueta)}</span></a>`;
  },

  pintarNavegacion(perfil, activoId) {
    if (typeof document === 'undefined') return false;
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return false;
    nav.innerHTML = this.htmlNavegacion(perfil, activoId);
    return true;
  },

  escapar(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /* Helper para las secciones cuyo render solo devuelve HTML. */
  desdeHTML(fn) {
    return workspace => { workspace.innerHTML = fn(); };
  }
};

/* ── Secciones oficiales del panel ──────────────────────────────
   Mismo orden y mismos textos que el menú que había escrito a mano. */
Secciones.registrarVarias([
  {
    id: 'dashboard',
    etiqueta: 'Dashboard',
    icono: 'ri-dashboard-3-line',
    grupo: 'Principal',
    orden: 10,
    render: Secciones.desdeHTML(() => UI.renderDashboardView())
  },
  {
    id: 'estadisticas',
    etiqueta: 'Estadísticas',
    icono: 'ri-bar-chart-line',
    grupo: 'Principal',
    orden: 20,
    render: Secciones.desdeHTML(() => StatsEngine.renderVistaEstadisticas())
  },
  {
    id: 'grupos',
    etiqueta: 'Grupos de Clase',
    icono: 'ri-team-line',
    grupo: 'Académico',
    orden: 30,
    render: Secciones.desdeHTML(() => UI.renderGruposView()),
    hijos: [
      { id: 'listado', etiqueta: 'Grupos y estudiantes', icono: 'ri-team-line' },
      { id: 'importar', etiqueta: 'Cargar listado (.xlsx / .csv)', icono: 'ri-file-excel-line',
        accion: () => {
          if (!Permisos.exigir('importarListado')) return;
          const input = document.getElementById('excel-upload-input');
          if (input) input.click();
          else UI.showToast('Abre Grupos de Clase y usa el botón «Cargar Lista de Grupo».');
        } }
    ]
  },
  {
    id: 'estudiantes',
    etiqueta: 'Estudiantes',
    icono: 'ri-user-search-line',
    grupo: 'Académico',
    orden: 40,
    render: Secciones.desdeHTML(() => UI.renderEstudiantesView()),
    // Al pintar se reaplica el filtro guardado en la URL (chips + select).
    alMostrar: () => UI.filtrarDirectorioEstudiantes()
  },
  {
    id: 'cuaderno-docente',
    etiqueta: 'Cuaderno Docente',
    icono: 'ri-file-excel-2-line',
    grupo: 'Académico',
    orden: 50,
    alias: ['cuaderno'],
    // Esta vista se pinta a sí misma (y encadena la inicialización de sus
    // selectores), por eso no usa desdeHTML.
    render: () => UI.renderCuadernoDocente(),
    hijos: [
      { id: 'registro', etiqueta: 'Registro de notas', icono: 'ri-table-line' },
      { id: 'cargar-notas', etiqueta: 'Cargar notas desde Excel', icono: 'ri-file-excel-line',
        accion: () => UI.enfocarPasoCuaderno(2) },
      { id: 'exportar', etiqueta: 'Exportar e imprimir', icono: 'ri-printer-line',
        accion: () => {
          if (!Permisos.exigir('exportarDocumentos')) return;
          UI.abrirModalConfigExport();
        } },
      { id: 'convalidaciones', etiqueta: 'Convalidar módulo', icono: 'ri-exchange-line',
        accion: () => {
          if (!Permisos.exigir('exportarDocumentos')) return;
          UI.abrirModalConvalidaciones();
        } },
      { id: 'responsables', etiqueta: 'Configurar responsables', icono: 'ri-user-settings-line',
        roles: ['admin'],
        accion: () => {
          if (!Permisos.exigir('configurarInstitucion')) return;
          CuadernoEngine.abrirConfiguracionAcademica();
        } }
    ]
  },
  {
    id: 'Examenes-Reparacion',
    etiqueta: 'Exámenes',
    titulo: 'Exámenes Programados',
    icono: 'ri-file-edit-line',
    grupo: 'Académico',
    orden: 60,
    render: Secciones.desdeHTML(() => ExamenesEngine.renderVistaExamenesReparaciones())
  },
  {
    id: 'informe-avance',
    etiqueta: 'Informe de Avance',
    icono: 'ri-file-word-2-line',
    grupo: 'Académico',
    orden: 70,
    render: Secciones.desdeHTML(() => InformeEngine.renderVista())
  },
  {
    id: 'envio-mensajes',
    etiqueta: 'Envío de Mensajes',
    icono: 'ri-mail-line',
    grupo: 'Comunicación e innovación',
    orden: 80,
    render: Secciones.desdeHTML(() => MessageEngine.renderVistaMensajes())
  },
  {
    id: 'equipos',
    etiqueta: 'Equipos Innovatec',
    titulo: 'Equipos Innovatec / Hackathon',
    icono: 'ri-trophy-line',
    grupo: 'Comunicación e innovación',
    orden: 90,
    render: Secciones.desdeHTML(() => EquiposEngine.renderVista())
  },
  {
    id: 'perfil',
    etiqueta: 'Mi perfil',
    icono: 'ri-user-settings-line',
    grupo: 'Mi espacio',
    orden: 100,
    render: Secciones.desdeHTML(() => ProfileManager.renderVista())
  },
  {
    id: 'administracion',
    etiqueta: 'Administración',
    icono: 'ri-shield-user-line',
    grupo: 'Administración',
    orden: 110,
    roles: ['admin'],
    render: Secciones.desdeHTML(() => AdminManager.renderVista()),
    alMostrar: () => AdminManager.cargarUsuarios(),
    hijos: [
      { id: 'usuarios', etiqueta: 'Usuarios y roles', icono: 'ri-group-line', roles: ['admin'] },
      { id: 'descargar', etiqueta: 'Descargar DB.json', icono: 'ri-download-cloud-2-line',
        roles: ['admin'],
        accion: () => {
          if (!Permisos.exigir('descargarBase')) return;
          DataEngine.exportDBJSON();
        } },
      { id: 'cargar', etiqueta: 'Cargar DB.json', icono: 'ri-upload-cloud-2-line',
        roles: ['admin'],
        accion: () => {
          if (!Permisos.exigir('cargarBase')) return;
          const input = document.getElementById('db-file-input');
          if (input) input.click();
          else UI.showToast('Usa el botón «Cargar DB.json» de la barra superior.');
        } }
    ]
  }
]);
