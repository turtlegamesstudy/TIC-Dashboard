const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Catálogo de módulos académicos: la lista de asignaturas con la que se
// cargan las notas (Cuaderno, Estadísticas, Exámenes, Informe) ya no es
// fija. Se puede agregar "Inglés" o un módulo inventado desde la interfaz y
// la lista viaja en la base del centro (`modulosAcademicos`).
//
// Aquí se comprueba lo importante: (1) la lista viva se actualiza en el MISMO
// array para que ninguna vista se quede con una copia vieja, (2) la base no
// guarda ruido cuando la lista vuelve a ser la oficial, (3) las filas del
// informe siguen apuntando al módulo correcto aunque se reordene o crezca la
// lista (antes dependían de la posición) y (4) el export respeta lo que el
// docente desmarcó.

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
      confirm: () => true,
      prompt: () => null,
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
      profile: { role: 'docente', centerId: 'ct-mor-2026' },
      activeCenterId: null,
      onAuthStateChanged: async () => {},
      getActiveCenterName: () => 'CT-MOR-2026',
      getActiveCenterId: () => 'ct-mor-2026',
      getAreaLabel: () => 'Técnico',
      signOut: async () => {}
    },
    UI: { showToast() {}, renderCurrentModule() {} },
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
    'js/08-informe-engine.js'
  ];
  archivos.forEach(rel => {
    const source = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    vm.runInContext(source, context, { filename: rel });
  });

  vm.runInContext(
    'globalThis.__dataEngine = DataEngine;' +
    'globalThis.__catalogo = ModulosAcademicos;' +
    'globalThis.__cuaderno = CuadernoEngine;' +
    'globalThis.__informe = InformeEngine;' +
    'globalThis.__filasInforme = INFORME_FILAS_TRANSVERSALES;' +
    // El array VIVO: si el catálogo lo reescribe con splice, esta referencia
    // (misma identidad) debe ver los cambios.
    'globalThis.__listaViva = MODULOS_TRANSVERSALES;',
    context
  );

  return {
    DataEngine: context.__dataEngine,
    ModulosAcademicos: context.__catalogo,
    CuadernoEngine: context.__cuaderno,
    InformeEngine: context.__informe,
    filasInforme: context.__filasInforme,
    listaViva: context.__listaViva,
    elements: elementos
  };
}

// Los objetos creados dentro del contexto aislado (vm) tienen otra
// "prototipo"; se normalizan antes de compararlos con deepStrictEqual.
function plain(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function base() {
  return { version: '1.0', lastUpdated: new Date().toISOString(), grupos: [], equipos: [] };
}

const OFICIALES = [
  'Historia e Identidad Nacional',
  'Adaptación al Cambio Climático',
  'Orientación Laboral',
  'Cultura de Paz',
  'Identidad Histórica y Sociocultural de Nicaragua'
];

test('sin catálogo guardado la lista oficial queda intacta y no se escribe ruido', () => {
  const { DataEngine, ModulosAcademicos, listaViva } = createHarness();
  DataEngine.db = base();
  DataEngine._migrarEsquema();

  assert.deepEqual(plain(listaViva), OFICIALES);
  assert.equal(ModulosAcademicos.cantidad(), 5);
  assert.equal(DataEngine.db.modulosAcademicos, undefined, 'la base no debe guardar la lista por defecto');
  // listar() devuelve copia: tocarla no altera la lista viva
  const copia = ModulosAcademicos.listar();
  copia.push('basura');
  assert.equal(ModulosAcademicos.cantidad(), 5);
});

test('agregar un módulo actualiza la lista viva (misma referencia) y la base', () => {
  const { DataEngine, ModulosAcademicos, listaViva } = createHarness();
  DataEngine.db = base();
  DataEngine._migrarEsquema();
  const referenciaOriginal = listaViva;

  const resultado = ModulosAcademicos.agregar(DataEngine.db, '  Inglés  ');
  assert.equal(resultado.ok, true);
  assert.equal(resultado.nombre, 'Inglés');

  // Mismo array, ahora con 6 módulos: nadie se queda con una copia vieja
  assert.equal(listaViva, referenciaOriginal, 'la lista viva debe mutarse in place');
  assert.equal(listaViva.length, 6);
  assert.equal(listaViva[5], 'Inglés');
  assert.equal(ModulosAcademicos.cantidad(), 6);
  assert.deepEqual(plain(DataEngine.db.modulosAcademicos), [...OFICIALES, 'Inglés']);

  // Volver a la oficial borra la clave: cero ruido en Firebase
  const quitar = ModulosAcademicos.quitar(DataEngine.db, 'Inglés');
  assert.equal(quitar.ok, true);
  assert.deepEqual(plain(listaViva), OFICIALES);
  assert.equal(Object.prototype.hasOwnProperty.call(DataEngine.db, 'modulosAcademicos'), false);
});

test('agregar y quitar validan nombre, duplicados y longitud mínima', () => {
  const { DataEngine, ModulosAcademicos } = createHarness();
  DataEngine.db = base();
  DataEngine._migrarEsquema();

  assert.match(ModulosAcademicos.agregar(DataEngine.db, '   ').error, /nombre/i);
  assert.match(ModulosAcademicos.agregar(DataEngine.db, 'x'.repeat(81)).error, /demasiado largo/i);
  // Duplicado insensible a mayúsculas, espacios y acentos
  assert.match(ModulosAcademicos.agregar(DataEngine.db, 'orientacion  laboral').error, /ya está en la lista/i);
  assert.match(ModulosAcademicos.quitar(DataEngine.db, 'Módulo Inexistente').error, /no está en la lista/i);

  // Nunca se queda sin módulos
  for (let i = 0; i < OFICIALES.length - 1; i++) {
    const quitado = ModulosAcademicos.quitar(DataEngine.db, OFICIALES[i]);
    assert.equal(quitado.ok, true, `se pudo quitar ${OFICIALES[i]}`);
  }
  assert.equal(ModulosAcademicos.cantidad(), 1);
  const ultima = ModulosAcademicos.listar()[0];
  assert.match(ModulosAcademicos.quitar(DataEngine.db, ultima).error, /al menos un módulo/i);
});

test('la sincronización desde la base reemplaza la lista oficial', () => {
  const { DataEngine, ModulosAcademicos, listaViva } = createHarness();
  DataEngine.db = {
    ...base(),
    modulosAcademicos: ['Inglés', 'Redes', 'Inglés', '  ', 'Inglés']
  };
  DataEngine._migrarEsquema();

  // Duplicados y blancos se limpian al leer
  assert.deepEqual(plain(listaViva), ['Inglés', 'Redes']);
  assert.equal(DataEngine.db.modulosAcademicos.length, 5, 'la base no se reescribe al leer');

  // Una base sin la clave vuelve a la lista oficial
  DataEngine.db = base();
  DataEngine._migrarEsquema();
  assert.deepEqual(plain(listaViva), OFICIALES);
});

test('las filas del informe apuntan al módulo por nombre, no por posición', () => {
  const { DataEngine, filasInforme } = createHarness();

  // Catálogo remoto reordenado y con un módulo inventado
  DataEngine.db = {
    ...base(),
    modulosAcademicos: [
      'Cultura de Paz',
      'Inglés',
      'Orientación Laboral',
      'Historia e Identidad Nacional',
      'Adaptación al Cambio Climático'
    ]
  };
  DataEngine._migrarEsquema();

  assert.deepEqual(plain(filasInforme.map(f => ({ key: f.key, modulo: f.modulo }))), [
    { key: 'r3', modulo: 'Historia e Identidad Nacional' },
    { key: 'r4', modulo: 'Adaptación al Cambio Climático' },
    { key: 'r5', modulo: 'Orientación Laboral' },
    { key: 'r11', modulo: 'Cultura de Paz' }
  ]);
});

test('el informe se calcula aunque falten módulos oficiales', () => {
  const { DataEngine, InformeEngine, filasInforme } = createHarness();
  DataEngine.db = {
    ...base(),
    modulosAcademicos: ['Inglés', 'Historia e Identidad Nacional']
  };
  DataEngine._migrarEsquema();

  // Los módulos que ya no existen resuelven a cadena vacía (fila en 0)
  assert.deepEqual(plain(filasInforme.map(f => f.modulo)), [
    'Historia e Identidad Nacional', '', '', ''
  ]);

  let datos = null;
  assert.doesNotThrow(() => { datos = InformeEngine.calcularDatosInforme(); });
  assert.ok(datos && Array.isArray(datos.filas || datos), 'el informe devuelve sus filas');
});

test('al crecer el catálogo los módulos nuevos entran marcados en el export', () => {
  const { DataEngine, ModulosAcademicos, CuadernoEngine, listaViva } = createHarness();
  DataEngine.db = base();
  DataEngine._migrarEsquema();

  // Preferencias guardadas con la lista oficial de 5 y tres desmarcados
  const preferencias = {
    modulos: ['Historia e Identidad Nacional', 'Orientación Laboral'],
    catalogoModulos: [...OFICIALES]
  };

  // El centro agrega "Inglés": debe aparecer marcado por defecto
  ModulosAcademicos.agregar(DataEngine.db, 'Inglés');
  assert.equal(listaViva.length, 6);
  const seleccion = CuadernoEngine.modulosExportSeleccionados(preferencias);
  assert.equal(seleccion.has('Inglés'), true, 'un módulo nuevo se marca solo');
  assert.equal(seleccion.has('Historia e Identidad Nacional'), true);
  assert.equal(seleccion.has('Adaptación al Cambio Climático'), false, 'lo desmarcado sigue desmarcado');
  assert.equal(seleccion.has('Cultura de Paz'), false);

  // Preferencias heredadas (sin catálogo guardado): no se altera nada
  const heredadas = { modulos: ['Cultura de Paz'] };
  const seleccionHeredada = CuadernoEngine.modulosExportSeleccionados(heredadas);
  assert.deepEqual(plain([...seleccionHeredada]), ['Cultura de Paz']);

  // Sin preferencias guardadas se marcan todos los actuales
  const todas = CuadernoEngine.modulosExportSeleccionados(null);
  assert.equal(todas.size, listaViva.length);
});

test('tieneNotas detecta el módulo con o sin acentos antes de quitarlo', () => {
  const { DataEngine, ModulosAcademicos } = createHarness();
  DataEngine.db = {
    ...base(),
    grupos: [{
      id: 'G1',
      nombre: '3A',
      estudiantes: [{
        id: 'STU-1',
        nombres: 'Juan',
        apellidos: 'Pérez',
        estado: 'Activo',
        evaluacionesPorModulo: { Inglés: { notas: { e1: 90 } } }
      }]
    }]
  };
  DataEngine._migrarEsquema();

  assert.equal(ModulosAcademicos.tieneNotas('Inglés'), true);
  assert.equal(ModulosAcademicos.tieneNotas('ingles'), true);
  assert.equal(ModulosAcademicos.tieneNotas('Cultura de Paz'), false);

  DataEngine.db.grupos[0].estudiantes[0].convalidaciones = { 'Cultura de Paz': true };
  assert.equal(ModulosAcademicos.tieneNotas('Cultura de Paz'), true);
});
