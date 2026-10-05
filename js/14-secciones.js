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
          grupo: 'Académico',             // encabezado del menú
          orden: 55,                      // posición dentro del menú
          roles: ['admin', 'docente'],    // opcional; sin roles los ve todos
          render: (workspace) => {
            workspace.innerHTML = '<div class="module-fade-enter">…</div>';
          },
          alMostrar: () => { } // opcional: se ejecuta tras pintar
        });

   2. Nada más: el enlace entra solo en el menú, respeta permisos, se
      abre con UI.irA('ingles') y desaparece si el rol no lo permite.
      No hay que tocar el HTML, el switch de render ni el buscador.
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
      alias: (Array.isArray(def.alias) ? def.alias : []).map(a => String(a).trim()).filter(Boolean)
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

  /* HTML del menú lateral para un perfil. Es una función pura para poder
     probarla sin tocar el DOM. */
  htmlNavegacion(perfil, activoId) {
    const grupos = [];
    this.visibles(perfil).forEach(seccion => {
      let grupo = grupos.find(item => item.nombre === seccion.grupo);
      if (!grupo) { grupo = { nombre: seccion.grupo, secciones: [] }; grupos.push(grupo); }
      grupo.secciones.push(seccion);
    });
    return grupos.map(grupo =>
      `<div class="nav-section">${this.escapar(grupo.nombre)}</div>` +
      grupo.secciones.map(seccion => this._htmlItem(seccion, activoId)).join('')
    ).join('');
  },

  _htmlItem(seccion, activoId) {
    const activa = seccion.id === activoId;
    const id = this.escapar(seccion.id);
    return `<a href="#${id}" class="nav-item${activa ? ' active' : ''}" data-module="${id}"` +
      ` title="${this.escapar(seccion.titulo)}"${activa ? ' aria-current="page"' : ''}>` +
      `<i class="${this.escapar(seccion.icono)}" aria-hidden="true"></i>` +
      `<span>${this.escapar(seccion.etiqueta)}</span></a>`;
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
    render: Secciones.desdeHTML(() => UI.renderGruposView())
  },
  {
    id: 'estudiantes',
    etiqueta: 'Estudiantes',
    icono: 'ri-user-search-line',
    grupo: 'Académico',
    orden: 40,
    render: Secciones.desdeHTML(() => UI.renderEstudiantesView())
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
    render: () => UI.renderCuadernoDocente()
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
    alMostrar: () => AdminManager.cargarUsuarios()
  }
]);
