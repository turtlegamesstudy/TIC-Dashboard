const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', '02-data-engine.js'),
  'utf8'
);

function createHarness(opciones = {}) {
  const messages = [];
  const context = {
    window: { FirebaseServices: { database: opciones.database || { ref: () => ({}) } } },
    AuthManager: { user: { uid: 'teacher-1' }, profile: { role: 'docente', centerId: 'ct-ariel-darce' }, activeCenterId: null },
    UI: { showToast(message) { messages.push(message); }, renderCurrentModule() {} },
    document: { getElementById: () => null },
    console: { error() {}, log() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    FileReader: opciones.FileReader || function FileReader() {},
    XLSX: opciones.XLSX || {
      read() { return { SheetNames: [], Sheets: {} }; },
      utils: { sheet_to_json: () => [] }
    }
  };
  vm.runInNewContext(`${source}\nglobalThis.engine = DataEngine;`, context);
  return { engine: context.engine, messages };
}

// Los objetos creados dentro del contexto aislado (vm) tienen otra
// "prototipo"; se normalizan a objetos de este ámbito antes de compararlos.
function plain(valor) {
  return JSON.parse(JSON.stringify(valor));
}

// Construye una fila de ancho fijo con las celdas indicadas.
function filaDe(largo, celdas) {
  const fila = new Array(largo).fill('');
  Object.entries(celdas).forEach(([indice, valor]) => {
    fila[Number(indice)] = valor;
  });
  return fila;
}

test('lee el listado oficial clásico (encabezado en la fila 12)', () => {
  const { engine } = createHarness();
  const filas = [];
  filas[1] = ['Evento:', '', '', 'Técnico en Informática con Énfasis en Software'];
  filas[2] = ['Turno:', 'Vespertino'];
  filas[3] = ['Grupo:', '', '', '3A'];
  filas[12] = filaDe(27, { 7: 'NOMBRE DEL PARTICIPANTE', 16: 'ESTADO', 20: 'TELÉFONO', 26: 'CORREO' });
  filas[13] = filaDe(27, { 7: 'Juan Carlos Pérez López', 16: 'Activo', 20: '8888-9999', 26: 'juan@inatec.edu.ni' });
  filas[14] = filaDe(27, { 7: 'María Fernanda Ruiz Sánchez', 16: 'Retirado', 20: '7777-1111', 26: 'maria@inatec.edu.ni' });

  const analisis = engine.analizarListadoExcel(filas);

  assert.equal(analisis.metadatos.grupo, '3A');
  assert.equal(analisis.metadatos.carrera, 'Técnico en Informática con Énfasis en Software');
  assert.equal(analisis.metadatos.turno, 'Vespertino');
  assert.deepEqual(plain(analisis.columnas), { nombre: 7, estado: 16, telefono: 20, correo: 26 });
  assert.equal(analisis.estudiantes.length, 2);
  assert.deepEqual(plain(analisis.estudiantes[0]), {
    nombres: 'Juan Carlos',
    apellidos: 'Pérez López',
    correo: 'juan@inatec.edu.ni',
    telefono: '8888-9999',
    estado: 'Activo'
  });
  assert.equal(analisis.estudiantes[1].estado, 'Retirado');
  assert.equal(analisis.advertencias.length, 0);
});

test('lee un listado con otra distribución de columnas y encabezados', () => {
  const { engine } = createHarness();
  const filas = [
    ['Sección:', 'B'],
    ['Ciclo lectivo: 2026'],
    ['Cédula', 'Apellidos', 'Nombres', 'Correo Institucional', 'Teléfono', 'Situación'],
    ['00123456', 'López Martínez', 'Juan Carlos', 'juan@ejemplo.com', '+505 8888-9999', 'Retirado'],
    ['00789012', 'García Ruiz', 'Ana María', 'ana@ejemplo.com', '', 'Activo'],
    []
  ];

  const analisis = engine.analizarListadoExcel(filas);

  assert.equal(analisis.filaEncabezado, 2);
  assert.equal(analisis.metadatos.grupo, 'B');
  assert.equal(analisis.metadatos.ciclo, undefined);
  assert.equal(analisis.estudiantes.length, 2);
  assert.deepEqual(plain(analisis.estudiantes[0]), {
    nombres: 'Juan Carlos',
    apellidos: 'López Martínez',
    correo: 'juan@ejemplo.com',
    telefono: '+505 8888-9999',
    estado: 'Retirado'
  });
  assert.equal(analisis.estudiantes[1].estado, 'Activo');
  assert.equal(analisis.estudiantes[1].telefono, undefined);
  assert.equal(analisis.advertencias.length, 0);
});

test('sin columna de correo, teléfono ni estado avisa qué conserva', () => {
  const { engine } = createHarness();
  const filas = [
    ['Nombres y Apellidos', 'Carnet'],
    ['Ana María García Ruiz', '12345'],
    ['Pedro Solís Hernández', '67890']
  ];

  const analisis = engine.analizarListadoExcel(filas);

  assert.equal(analisis.estudiantes.length, 2);
  assert.equal(analisis.estudiantes[0].nombres, 'Ana María');
  assert.equal(analisis.estudiantes[0].correo, undefined);
  assert.equal(analisis.advertencias.length, 3);
  assert.equal(analisis.advertencias.some(texto => texto.includes('columna de correo')), true);
  assert.equal(analisis.advertencias.some(texto => texto.includes('columna de teléfono')), true);
  assert.equal(analisis.advertencias.some(texto => texto.includes('columna de estado')), true);
});

test('explica qué contenido encontró cuando nada se reconoce', () => {
  const { engine } = createHarness();
  const filas = [
    ['Denominación', 'Referencia', 'Puntaje'],
    ['Módulo uno', 'R-01', '85'],
    ['Módulo dos', 'R-02', '90']
  ];

  assert.throws(
    () => engine.analizarListadoExcel(filas),
    error => /No se reconoció ninguna columna de nombres/.test(error.message) &&
      /Denominación \| Referencia \| Puntaje/.test(error.message) &&
      /Nombre del participante/.test(error.message)
  );
});

test('descarta encabezados repetidos, totales y filas vacías', () => {
  const { engine } = createHarness();
  const filas = [
    ['Nombre del participante', 'Estado'],
    ['Juan Carlos Pérez López', 'Activo'],
    ['Nombre del participante', 'Estado'],
    [],
    ['', ''],
    ['Total de alumnos', 'Retirado'],
    ['María Fernanda Ruiz Sánchez', 'Retirado']
  ];

  const analisis = engine.analizarListadoExcel(filas);

  assert.equal(analisis.estudiantes.length, 2);
  assert.equal(analisis.estudiantes[0].nombres, 'Juan Carlos');
  assert.equal(analisis.estudiantes[1].apellidos, 'Ruiz Sánchez');
});

test('al recargar un listado conserva notas, identificadores y campos ausentes', () => {
  const { engine } = createHarness();
  engine.db = {
    grupos: [{
      id: 'GRUPO-3A',
      codigo: '3A',
      nombre: '3A',
      carrera: 'Técnico en Software',
      turno: 'Vespertino',
      docenteGuia: 'Ing. López',
      origenArchivo: 'listado-3a',
      estructuraModulos: { 'Módulo 1': { columnasOrdenadas: [{ nombreDisplay: 'Cuestionario 1', esTotal: false }] } },
      estudiantes: [
        {
          id: 'STU-007',
          nombres: 'Juan Carlos',
          apellidos: 'Pérez López',
          correo: 'sin.correo@tecnacional.edu.ni',
          telefono: '8888-9999',
          estado: 'Retirado',
          motivoRetiro: 'Cambio de sede',
          evaluacionesPorModulo: { 'Módulo 1': { notas: { 'Cuestionario 1': 95 } } },
          convalidaciones: { 'Módulo 1': true }
        },
        {
          id: 'STU-008',
          nombres: 'Ana María',
          apellidos: 'García Ruiz',
          correo: 'ana@ejemplo.com',
          telefono: '',
          estado: 'Activo'
        }
      ]
    }]
  };

  const grupo = engine._construirGrupoDesdeListado({
    metadatos: { grupo: '3A', carrera: 'Técnico en Informática', turno: 'Matutino', docenteGuia: 'Lic. Ruiz' },
    columnas: { nombre: 0 },
    estudiantes: [
      { nombres: 'Juan Carlos', apellidos: 'Pérez López' },
      { nombres: 'Ana María', apellidos: 'García Ruiz' },
      { nombres: 'Pedro José', apellidos: 'Solís Hernández' }
    ],
    advertencias: []
  }, 'listado-3a');

  assert.equal(grupo.id, 'GRUPO-3A');
  assert.equal(grupo.nombre, '3A');
  assert.equal(grupo.carrera, 'Técnico en Informática');
  assert.equal(grupo.turno, 'Matutino');
  assert.equal(grupo.docenteGuia, 'Lic. Ruiz');
  assert.equal(grupo.estructuraModulos['Módulo 1'].columnasOrdenadas.length, 1);

  assert.equal(grupo.estudiantes.length, 3);
  const juan = grupo.estudiantes[0];
  assert.equal(juan.id, 'STU-007');
  assert.equal(juan.estado, 'Retirado');
  assert.equal(juan.telefono, '8888-9999');
  assert.equal(juan.correo, '');
  assert.equal(juan.motivoRetiro, 'Cambio de sede');
  assert.deepEqual(plain(juan.evaluacionesPorModulo), { 'Módulo 1': { notas: { 'Cuestionario 1': 95 } } });
  assert.equal(juan.convalidaciones['Módulo 1'], true);

  const ana = grupo.estudiantes[1];
  assert.equal(ana.id, 'STU-008');
  assert.equal(ana.correo, 'ana@ejemplo.com');
  assert.equal(ana.estado, 'Activo');

  const pedro = grupo.estudiantes[2];
  assert.equal(pedro.id, 'STU-009');
  assert.equal(pedro.estado, 'Activo');
  assert.equal(pedro.correo, '');
});

test('identifica al alumno por correo cuando los nombres cambian de formato', () => {
  const { engine } = createHarness();
  engine.db = {
    grupos: [{
      id: 'G-1',
      nombre: '5B',
      estudiantes: [{
        id: 'STU-001',
        nombres: 'ANA MARÍA',
        apellidos: 'GARCÍA RUIZ',
        correo: 'ana@ejemplo.com',
        telefono: '5555-0000',
        estado: 'Activo',
        convalidaciones: { 'Módulo 2': true }
      }]
    }]
  };

  const grupo = engine._construirGrupoDesdeListado({
    metadatos: { grupo: '5B' },
    columnas: { nombre: 0, correo: 1 },
    estudiantes: [{ nombres: 'Ana', apellidos: 'García Ruiz de la Cruz', correo: 'ana@ejemplo.com' }],
    advertencias: []
  }, 'listado-5b');

  assert.equal(grupo.estudiantes.length, 1);
  assert.equal(grupo.estudiantes[0].id, 'STU-001');
  assert.equal(grupo.estudiantes[0].nombres, 'Ana');
  assert.equal(grupo.estudiantes[0].telefono, '5555-0000');
  assert.equal(grupo.estudiantes[0].convalidaciones['Módulo 2'], true);
});

test('crea un grupo nuevo con identificador seguro cuando no había datos previos', () => {
  const { engine } = createHarness();

  const grupo = engine._construirGrupoDesdeListado({
    metadatos: {},
    columnas: { nombre: 0 },
    estudiantes: [{ nombres: 'Ana María', apellidos: 'Pérez Soto' }],
    advertencias: []
  }, 'Listado Grupo 5B');

  assert.equal(grupo.id, 'Listado-Grupo-5B');
  assert.equal(grupo.nombre, 'Listado Grupo 5B');
  assert.equal(grupo.estudiantes[0].id, 'STU-001');
  assert.equal(grupo.estudiantes[0].estado, 'Activo');
  assert.equal(engine._idSeguroGrupo('Grupo/A 3B'), 'Grupo-A-3B');
});

test('elige la hoja del libro que tenga más estudiantes', () => {
  const { engine } = createHarness({
    XLSX: { utils: { sheet_to_json: hoja => hoja.filas } }
  });
  const libro = {
    SheetNames: ['Portada', 'Resumen', 'Listado'],
    Sheets: {
      Portada: { filas: [['Centro Tecnológico Ariel Darce'], ['Ciclo lectivo 2026']] },
      Resumen: { filas: [['Grupo', 'Cantidad'], ['3A', 2]] },
      Listado: {
        filas: [
          ['Nombre del participante', 'Estado', 'Correo'],
          ['Juan Carlos Pérez López', 'Activo', 'juan@ejemplo.com'],
          ['María Fernanda Ruiz Sánchez', 'Retirado', 'maria@ejemplo.com']
        ]
      }
    }
  };

  const analisis = engine._analizarHojasListado(libro, 'listado-3a');

  assert.equal(analisis.hoja, 'Listado');
  assert.equal(analisis.nombreArchivo, 'listado-3a');
  assert.equal(analisis.estudiantes.length, 2);
  assert.equal(analisis.metadatos.grupo, undefined);
});

test('propaga el error cuando ninguna hoja se puede leer', () => {
  const { engine } = createHarness({
    XLSX: { utils: { sheet_to_json: hoja => hoja.filas } }
  });
  const libro = {
    SheetNames: ['Hoja1'],
    Sheets: { Hoja1: { filas: [['Denominación', 'Puntaje'], ['Módulo uno', '85']] } }
  };

  assert.throws(
    () => engine._analizarHojasListado(libro, 'archivo'),
    /No se reconoció ninguna columna de nombres/
  );
});

// ─── Base remota mínima: permite ejecutar init() y save() de verdad ───
function baseRemota() {
  const datos = {};
  const leer = ruta => ruta.split('/').filter(Boolean).reduce(
    (valor, clave) => (valor == null ? undefined : valor[clave]),
    datos
  );
  const escribir = (ruta, valor) => {
    const claves = ruta.split('/').filter(Boolean);
    let destino = datos;
    claves.slice(0, -1).forEach(clave => {
      if (!destino[clave] || typeof destino[clave] !== 'object') destino[clave] = {};
      destino = destino[clave];
    });
    if (!claves.length) return;
    if (valor === null) delete destino[claves[claves.length - 1]];
    else destino[claves[claves.length - 1]] = valor;
  };
  const referencia = ruta => ({
    child: hijo => referencia([ruta, hijo].filter(Boolean).join('/')),
    async once() {
      const valor = leer(ruta);
      return {
        val: () => (valor === undefined ? null : valor),
        exists: () => valor !== undefined && valor !== null
      };
    },
    async transaction(actualizar) {
      const actual = leer(ruta) === undefined ? null : leer(ruta);
      const siguiente = actualizar(actual);
      if (siguiente === undefined) return { committed: false };
      escribir(ruta, siguiente);
      return { committed: true };
    },
    async set(valor) { escribir(ruta, valor); },
    async update(valores) {
      Object.entries(valores).forEach(([clave, valor]) => escribir(`${ruta}/${clave}`, valor));
    },
    on() {},
    off() {}
  });
  return {
    datos,
    referencia,
    leerEn: leer,
    escribirEn: escribir,
    sembrar() {
      escribir('centers/ct-ariel-darce/appData', {
        version: '1.0',
        lastUpdated: '2026-01-01T00:00:00.000Z',
        grupos: {},
        equipos: {},
        gruposOrden: [],
        equiposOrden: [],
        firebaseKeyEncoding: 1
      });
    }
  };
}

function crearFileReader(resultado) {
  return function FileReader() {
    this.metodo = null;
    const disparar = () => {
      Promise.resolve().then(() => this.onload({ target: { result: resultado } }));
    };
    this.readAsArrayBuffer = () => { this.metodo = 'buffer'; disparar(); };
    this.readAsText = () => { this.metodo = 'texto'; disparar(); };
  };
}

function esperar(promesa, mensajes) {
  return Promise.race([
    promesa,
    new Promise((_, rechazar) => setTimeout(() => {
      const detalle = mensajes && mensajes.length ? `: ${mensajes.join(' | ')}` : '';
      rechazar(new Error(`parseExcelGroup no respondió${detalle}`));
    }, 2000))
  ]);
}

test('guarda en la base el grupo importado y reporta hoja y advertencias', async () => {
  const base = baseRemota();
  base.sembrar();
  const libro = {
    SheetNames: ['Portada', 'Listado'],
    Sheets: {
      Portada: { filas: [['Centro Tecnológico Ariel Darce']] },
      Listado: {
        filas: [
          ['Grupo:', '', '', '3A'],
          ['Evento:', '', '', 'Técnico en Informática'],
          ['Nombre del participante', 'Estado'],
          ['Juan Carlos Pérez López', 'Activo'],
          ['María Fernanda Ruiz Sánchez', 'Retirado']
        ]
      }
    }
  };
  let lectura = null;
  const { engine, messages } = createHarness({
    database: { ref: ruta => base.referencia(ruta) },
    FileReader: crearFileReader(new ArrayBuffer(8)),
    XLSX: {
      read(contenido, opciones) { lectura = { contenido, opciones }; return libro; },
      utils: { sheet_to_json: hoja => hoja.filas }
    }
  });
  await engine.init();

  const resultado = await esperar(new Promise(resolve => {
    engine.parseExcelGroup({ name: 'listado-3a.xlsx' }, (grupo, resumen) => resolve({ grupo, resumen }));
  }), messages);

  assert.equal(lectura.opciones.type, 'array');
  assert.equal(resultado.grupo.id, '3A');
  assert.equal(resultado.grupo.nombre, '3A');
  assert.equal(resultado.grupo.carrera, 'Técnico en Informática');
  assert.equal(resultado.grupo.estudiantes.length, 2);
  assert.equal(resultado.resumen.hoja, 'Listado');
  assert.equal(resultado.resumen.advertencias.length, 2);
  assert.equal(base.leerEn('centers/ct-ariel-darce/appData/grupos/3A/nombre'), '3A');
  assert.equal(base.leerEn('centers/ct-ariel-darce/appData/grupos/3A/estudiantes/0/nombres'), 'Juan Carlos');
  assert.deepEqual(Array.from(base.leerEn('centers/ct-ariel-darce/appData/gruposOrden')), ['3A']);
  assert.equal(messages.length, 0);
});

test('acepta listados en CSV y avisa que falta la columna de teléfono', async () => {
  const base = baseRemota();
  base.sembrar();
  const libro = {
    SheetNames: ['Hoja1'],
    Sheets: {
      Hoja1: {
        filas: [
          ['Nombres', 'Apellidos', 'Correo', 'Situación'],
          ['Ana María', 'García Ruiz', 'ana@ejemplo.com', 'Retirado']
        ]
      }
    }
  };
  let lectura = null;
  const { engine, messages } = createHarness({
    database: { ref: ruta => base.referencia(ruta) },
    FileReader: crearFileReader('Nombres,Apellidos,Correo,Situación\nAna María,García Ruiz,ana@ejemplo.com,Retirado'),
    XLSX: {
      read(contenido, opciones) { lectura = { contenido, opciones }; return libro; },
      utils: { sheet_to_json: hoja => hoja.filas }
    }
  });
  await engine.init();

  const resultado = await esperar(new Promise(resolve => {
    engine.parseExcelGroup({ name: 'listado.csv' }, (grupo, resumen) => resolve({ grupo, resumen }));
  }), messages);

  assert.equal(lectura.opciones.type, 'string');
  assert.equal(typeof lectura.contenido, 'string');
  assert.equal(resultado.grupo.id, 'listado');
  assert.equal(resultado.grupo.nombre, 'listado');
  assert.equal(resultado.grupo.estudiantes[0].nombres, 'Ana María');
  assert.equal(resultado.grupo.estudiantes[0].apellidos, 'García Ruiz');
  assert.equal(resultado.grupo.estudiantes[0].estado, 'Retirado');
  assert.equal(resultado.resumen.advertencias.length, 1);
  assert.equal(resultado.resumen.advertencias[0].includes('teléfono'), true);
  assert.equal(messages.length, 0);
});
