const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Pinta todas las secciones del panel con una base "rara" para comprobar que
// ninguna vista se cae. Sirvió para encontrar dos fallos reales: grupos sin
// lista de estudiantes (Firebase guarda un arreglo vacío como nodo vacío) y
// alumnos sin campo `estado`.

function fakeElement(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    textContent: '',
    value: '',
    hidden: false,
    checked: false,
    files: [],
    options: [],
    selectedIndex: -1,
    selectedOptions: [],
    offsetWidth: 1,
    offsetHeight: 1,
    children: [],
    dataset: {},
    style: {},
    parentNode: null,
    classList: {
      _set: new Set(),
      add(...names) { names.forEach(name => this._set.add(name)); },
      remove(...names) { names.forEach(name => this._set.delete(name)); },
      contains(name) { return this._set.has(name); },
      toggle(name) { this._set.has(name) ? this._set.delete(name) : this._set.add(name); }
    },
    appendChild(child) { el.children.push(child); child.parentNode = el; return child; },
    prepend(child) { el.children.unshift(child); child.parentNode = el; return child; },
    insertBefore(child) { el.children.unshift(child); child.parentNode = el; return child; },
    removeChild(child) {
      const index = el.children.indexOf(child);
      if (index >= 0) el.children.splice(index, 1);
      return child;
    },
    replaceChildren(...children) { el.children = children; },
    setAttribute() {},
    getAttribute() { return null; },
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    click() {},
    focus() {},
    blur() {},
    contains() { return false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }; },
    scrollTo() {}
  };
  return el;
}

function createHarness() {
  const elementos = new Map();
  const porId = id => {
    if (!elementos.has(id)) {
      const el = fakeElement();
      el.id = id;
      elementos.set(id, el);
    }
    return elementos.get(id);
  };

  const document = {
    documentElement: fakeElement('html'),
    body: fakeElement('body'),
    head: fakeElement('head'),
    activeElement: null,
    hidden: false,
    title: '',
    getElementById: porId,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: tag => fakeElement(tag),
    createTextNode: text => {
      const el = fakeElement('#text');
      el.textContent = text;
      return el;
    },
    addEventListener() {},
    removeEventListener() {},
    write() {}
  };

  const context = {
    console: { log() {}, error() {}, warn() {}, info() {}, debug() {} },
    document,
    window: {
      FirebaseServices: { database: { ref: () => ({}) } },
      confirm: () => false,
      open() {},
      location: { href: '' }
    },
    navigator: { userAgent: 'node', language: 'es', clipboard: { writeText: async () => {} } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    performance,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: callback => setTimeout(callback, 0),
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    AuthManager: {
      user: { uid: 'u1', email: 'docente@test.com' },
      profile: { role: 'docente', centerId: 'ct-mor-2026', nombres: 'Hanzell', apellidos: 'Mayorga' },
      activeCenterId: null,
      onAuthStateChanged: async () => {},
      getActiveCenterName: () => 'CT-MOR-2026',
      getActiveCenterId: () => 'ct-mor-2026',
      getAreaLabel: () => 'Técnico',
      signOut: async () => {}
    },
    XLSX: { read: () => ({ SheetNames: [], Sheets: {} }), utils: { sheet_to_json: () => [] } },
    FileReader: function FileReader() {},
    ExcelJS: {},
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    Blob: function Blob() {}
  };
  context.window.document = document;
  context.window.navigator = context.navigator;
  context.window.matchMedia = context.matchMedia;
  context.window.performance = performance;
  context.globalThis = context;
  vm.createContext(context);

  const archivos = [
    'js/01-cuaderno-engine.js',
    'js/02-data-engine.js',
    'js/03-config-export.js',
    'js/04-ui-core.js',
    'js/05-message-engine.js',
    'js/06-stats-engine.js',
    'js/07-examenes-engine.js',
    'js/08-informe-engine.js',
    'js/09-equipos-engine.js',
    'js/12-admin-manager.js',
    'js/13-profile-manager.js',
    'js/14-secciones.js'
  ];
  archivos.forEach(rel => {
    const source = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    vm.runInContext(source, context, { filename: rel });
  });

  vm.runInContext(
    'globalThis.__ui = (typeof UI !== "undefined") ? UI : null;' +
    'globalThis.__dataEngine = (typeof DataEngine !== "undefined") ? DataEngine : null;' +
    'globalThis.__secciones = (typeof Secciones !== "undefined") ? Secciones : null;',
    context
  );

  assert.ok(context.__ui, 'UI debe quedar definido tras cargar los módulos');
  assert.ok(context.__dataEngine, 'DataEngine debe quedar definido tras cargar los módulos');
  assert.ok(context.__secciones, 'Secciones debe quedar definido tras cargar los módulos');
  return { UI: context.__ui, DataEngine: context.__dataEngine, Secciones: context.__secciones, elements: elementos };
}

const MODULOS = [
  'dashboard', 'grupos', 'estudiantes', 'cuaderno-docente', 'envio-mensajes',
  'estadisticas', 'Examenes-Reparacion', 'informe-avance', 'equipos', 'perfil',
  'administracion'
];

// Los objetos creados dentro del contexto aislado (vm) tienen otra
// "prototipo"; se normalizan antes de compararlos con deepStrictEqual.
function plain(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function base() {
  return { version: '1.0', lastUpdated: new Date().toISOString(), grupos: [], equipos: [] };
}

function estudiante(extra = {}) {
  return {
    id: 'STU-001',
    nombres: 'Juan Carlos',
    apellidos: 'Pérez López',
    correo: 'juan@test.com',
    telefono: '8888-9999',
    estado: 'Activo',
    ...extra
  };
}

function pintarTodo(UI, db) {
  const fallas = [];
  MODULOS.forEach(modulo => {
    UI.currentModule = modulo;
    try {
      UI.renderCurrentModule();
    } catch (error) {
      fallas.push(`${modulo}: ${error.message}`);
    }
  });
  return fallas;
}

test('todas las secciones se pintan sin caerse con la base vacía', () => {
  const { UI, DataEngine } = createHarness();
  DataEngine.db = base();
  assert.deepEqual(pintarTodo(UI, DataEngine.db), []);
});

test('la vista de grupos tolera un grupo sin lista de estudiantes', () => {
  const { UI, DataEngine } = createHarness();
  DataEngine.db = {
    ...base(),
    grupos: [{
      id: 'G1',
      codigo: 'G1',
      nombre: '3A',
      carrera: 'Software',
      turno: 'Vespertino',
      estructuraModulos: {},
      docenteGuia: ''
      // Sin `estudiantes`: así llega de Firebase cuando el arreglo estaba vacío.
    }]
  };
  assert.deepEqual(pintarTodo(UI, DataEngine.db), []);

  UI.currentModule = 'grupos';
  const html = UI.renderGruposView();
  assert.match(html, /3A/);
  assert.match(html, /0 Estudiantes/);
  assert.deepEqual(plain(UI.listaEstudiantes(null)), []);
  assert.deepEqual(plain(UI.listaEstudiantes(undefined)), []);
  assert.equal(UI.listaEstudiantes({ STU_1: estudiante() }).length, 1);
});

test('el badge de estado tolera registros heredados sin o con estado inválido', () => {
  const { UI } = createHarness();
  assert.match(UI.renderBadgeEstado({}), /Activo/);
  assert.match(UI.renderBadgeEstado({ estado: null }), /Activo/);
  assert.match(UI.renderBadgeEstado({ estado: '   ' }), /Activo/);
  assert.match(UI.renderBadgeEstado({ estado: 1 }), /Activo/);
  assert.match(UI.renderBadgeEstado(estudiante({ estado: 'Retirado', motivoRetiro: 'Cambio' })), /Retirado/);
  assert.match(UI.renderBadgeEstado(estudiante({ estado: 'Retirado' })), /Retirado/);
});

test('las vistas de grupos y de directorio pintan alumnos sin estado', () => {
  const { UI, DataEngine } = createHarness();
  DataEngine.db = {
    ...base(),
    grupos: [{
      id: 'G1',
      codigo: 'G1',
      nombre: '3A',
      carrera: 'Software',
      turno: 'Vespertino',
      estructuraModulos: {},
      docenteGuia: '',
      estudiantes: [estudiante({ estado: undefined }), estudiante({ id: 'STU-002', estado: null })]
    }]
  };
  assert.deepEqual(pintarTodo(UI, DataEngine.db), []);
});

test('la vista de grupos tolera un equipo malformado en la misma base', () => {
  const { UI, DataEngine } = createHarness();
  DataEngine.db = {
    ...base(),
    grupos: [{ id: 'G1', nombre: '3A', estudiantes: [estudiante()] }],
    equipos: [{ id: 'E1', nombreEquipo: 'Equipo 1' }]
  };
  assert.deepEqual(pintarTodo(UI, DataEngine.db), []);
});

test('_migrarEsquema restaura la forma completa de grupos y equipos', () => {
  const { DataEngine } = createHarness();
  DataEngine.db = {
    grupos: [{ id: 'G1', nombre: '3A', estudiantes: null }],
    equipos: [{ id: 'E1', nombreEquipo: 'Equipo 1' }]
  };
  DataEngine._migrarEsquema();

  const grupo = DataEngine.db.grupos[0];
  assert.deepEqual(plain(grupo.estudiantes), []);
  assert.equal(grupo.docenteGuia, '');

  const equipo = DataEngine.db.equipos[0];
  assert.deepEqual(plain(equipo.integrantes), []);
  assert.deepEqual(plain(equipo.archivos), []);
  assert.equal(equipo.categoria, 'Innovatec');
});

test('_migrarEsquema completa el estado de los alumnos y no altera los válidos', () => {
  const { DataEngine } = createHarness();
  DataEngine.db = {
    grupos: [{
      id: 'G1',
      nombre: '3A',
      estudiantes: [estudiante({ estado: undefined }), estudiante({ id: 'STU-002', estado: 'Retirado' })]
    }],
    equipos: []
  };
  DataEngine._migrarEsquema();

  const [sinEstado, retirado] = DataEngine.db.grupos[0].estudiantes;
  assert.equal(sinEstado.estado, 'Activo');
  assert.equal(retirado.estado, 'Retirado');
});

test('un registro que llega de la nube se normaliza antes de sustituir el local', () => {
  const { DataEngine } = createHarness();
  const normalizado = DataEngine._normalizarGrupo({
    id: 'G1',
    nombre: '3A',
    estudiantes: { STU_1: estudiante({ estado: undefined }) }
  });
  assert.equal(normalizado.estudiantes.length, 1);
  assert.equal(normalizado.estudiantes[0].estado, 'Activo');
  assert.equal(normalizado.estudiantes[0].nombres, 'Juan Carlos');
  assert.equal(DataEngine._normalizarGrupo(null), null);
  assert.equal(DataEngine._listaGuardada({ STU_1: estudiante() }).length, 1);
  assert.deepEqual(plain(DataEngine._listaGuardada('basura')), []);
});

/* ── Registro de secciones del panel (js/14-secciones.js) ─────── */

test('el menú lateral se genera desde el registro y respeta el rol', () => {
  const { Secciones, elements } = createHarness();

  const admin = Secciones.htmlNavegacion({ role: 'admin' }, 'dashboard');
  const docente = Secciones.htmlNavegacion({ role: 'docente' }, 'dashboard');

  // Grupos del menú y enlaces oficiales
  assert.match(admin, /<div class="nav-section">Principal<\/div>/);
  assert.match(admin, /<div class="nav-section">Académico<\/div>/);
  assert.match(docente, /data-module="grupos"/);
  assert.match(docente, /<span>Exámenes<\/span>/);
  // La sección activa lleva la clase y aria-current
  assert.match(docente, /data-module="dashboard"[^>]*aria-current="page"/);

  // Administración: solo para administradores, ni enlace ni encabezado
  assert.match(admin, /data-module="administracion"/);
  assert.ok(!docente.includes('data-module="administracion"'), 'un docente no debe ver Administración');
  assert.ok(!docente.includes('Administración'), 'el grupo de administración no debe aparecer');

  // El orden es el del registro, no el del DOM
  assert.ok(docente.indexOf('data-module="dashboard"') < docente.indexOf('data-module="estadisticas"'));
  assert.ok(docente.indexOf('data-module="cuaderno-docente"') < docente.indexOf('data-module="perfil"'));

  // Se pinta de verdad en el contenedor del sidebar
  assert.equal(Secciones.pintarNavegacion({ role: 'docente' }, 'dashboard'), true);
  assert.match(elements.get('sidebar-nav').innerHTML, /data-module="informe-avance"/);

  // Alias heredados del HTML anterior
  assert.equal(Secciones.obtener('cuaderno').id, 'cuaderno-docente');
  assert.equal(Secciones.obtener('no-existe'), null);
});

test('una sección nueva registrada en caliente entra en el menú y se pinta', () => {
  const { UI, Secciones, elements } = createHarness();

  const seccion = Secciones.registrar({
    id: 'ingles',
    etiqueta: 'Inglés',
    titulo: 'Módulo de Inglés',
    icono: 'ri-translate-2',
    grupo: 'Académico',
    orden: 55,
    render: workspace => { workspace.innerHTML = '<div class="module-fade-enter">Módulo de Inglés</div>'; }
  });
  assert.equal(seccion.id, 'ingles');

  // Aparece en el menú, en su grupo y en la posición de su `orden`
  const html = Secciones.htmlNavegacion({ role: 'docente' }, 'ingles');
  assert.match(html, /data-module="ingles"/);
  assert.ok(html.indexOf('data-module="ingles"') < html.indexOf('data-module="envio-mensajes"'));
  assert.ok(html.indexOf('data-module="cuaderno-docente"') < html.indexOf('data-module="ingles"'));

  // Y se abre con UI.irA / renderCurrentModule sin tocar ningún switch
  assert.equal(UI.irA('ingles'), true);
  assert.equal(UI.currentModule, 'ingles');
  assert.match(elements.get('workspace').innerHTML, /Módulo de Inglés/);

  // Dos secciones no pueden compartir id
  assert.throws(() => Secciones.registrar({ id: 'ingles', render: () => {} }), /ya existe/i);
  assert.throws(() => Secciones.registrar({ id: '', render: () => {} }), /id/i);
  assert.throws(() => Secciones.registrar({ id: 'sin-render' }), /render/i);
});

test('una sección restringida redirige y un id desconocido muestra el marcador', () => {
  const { UI, Secciones, elements } = createHarness(); // perfil: docente

  UI.currentModule = 'administracion';
  UI.renderCurrentModule();
  const workspace = elements.get('workspace');
  assert.equal(UI.currentModule, 'dashboard', 'sin permiso se cae al primer módulo disponible');
  assert.equal(Secciones.puedeVer(Secciones.obtener('administracion'), { role: 'docente' }), false);
  assert.equal(Secciones.puedeVer(Secciones.obtener('administracion'), { role: 'admin' }), true);
  assert.ok(!workspace.innerHTML.includes('Módulo:'));

  // irA se niega en lugar de abrir lo que el rol no puede ver
  assert.equal(UI.irA('administracion'), false);
  assert.equal(UI.currentModule, 'dashboard');

  UI.currentModule = 'seccion-sin-registrar';
  UI.renderCurrentModule();
  assert.match(workspace.innerHTML, /Módulo: seccion-sin-registrar/);
});
