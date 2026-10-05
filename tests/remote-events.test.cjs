const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', '02-data-engine.js'),
  'utf8'
);

function createHarness() {
  const renders = { directos: 0, diferidos: 0 };
  const context = {
    window: { FirebaseServices: { database: { ref: () => ({ child: () => ({}) }) } } },
    AuthManager: { user: { uid: 'teacher-1' }, profile: { role: 'admin', centerId: 'ct-ariel-darce' } },
    UI: {
      showToast() {},
      renderCurrentModule() { renders.directos += 1; },
      programarRender() { renders.diferidos += 1; }
    },
    document: {
      getElementById: id => (id === 'workspace' ? { children: { length: 1 } } : null)
    },
    console,
    Date,
    JSON,
    Set,
    Map,
    Object,
    Array,
    String,
    Error,
    Promise,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(`${source}\nglobalThis.engine = DataEngine;`, context);
  return { engine: context.engine, renders };
}

function baseDb() {
  const estudiante = (grupo, indice) => ({
    id: `e${grupo}-${indice}`,
    nombres: `Nombres ${indice}`,
    apellidos: `Apellidos ${indice}`,
    correo: `alumno${grupo}${indice}@correo.com`,
    estado: 'Activo',
    evaluacionesPorModulo: {
      M1: { notas: { 'UD 1': 70, Total: 70 } }
    }
  });
  return {
    version: '1.0',
    lastUpdated: '2026-09-02T00:00:00.000Z',
    grupos: [
      { id: 'g1', nombre: 'Grupo 1', turno: 'Vespertino', estudiantes: [estudiante(1, 1), estudiante(1, 2)] },
      { id: 'g2', nombre: 'Grupo 2', turno: 'Matutino', estudiantes: [estudiante(2, 1)] }
    ],
    equipos: []
  };
}

function preparar(engine) {
  engine.db = baseDb();
  engine._keyEncodingVersion = 1;
  engine._syncSnapshot = engine._clone(engine._serializeDatabase(engine.db));
}

function eventoRemoto(engine, coleccion, id) {
  const registro = engine._serializeDatabase(engine.db)[coleccion][id];
  return { key: id, val: () => structuredClone(registro) };
}

function totalRenders(renders) {
  return renders.directos + renders.diferidos;
}

test('ignora un child_added cuyo registro ya coincide con el local', () => {
  const { engine, renders } = createHarness();
  preparar(engine);

  engine._applyRemoteRecord('grupos', eventoRemoto(engine, 'grupos', 'g1'), false);

  assert.equal(engine.db.grupos.length, 2);
  assert.equal(totalRenders(renders), 0, 'no debe repintar si nada cambió');
});

test('aplica un cambio remoto real y agenda un único repintado en diferido', () => {
  const { engine, renders } = createHarness();
  preparar(engine);

  const registro = structuredClone(engine._serializeDatabase(engine.db).grupos.g1);
  registro.nombre = 'Grupo 1 Renombrado';
  engine._applyRemoteRecord('grupos', { key: 'g1', val: () => registro }, false);

  assert.equal(engine.db.grupos[0].nombre, 'Grupo 1 Renombrado');
  assert.equal(renders.diferidos, 1, 'el repintado debe quedar agrupado y en diferido');
  assert.equal(renders.directos, 0, 'nunca debe re-renderizar en caliente desde el listener');
});

test('no pisa los cambios locales sin guardar con un registro remoto', () => {
  const { engine, renders } = createHarness();
  preparar(engine);
  engine.db.grupos[0].nombre = 'Editado localmente';

  const registro = structuredClone(engine._serializeDatabase(engine.db).grupos.g1);
  registro.nombre = 'Cambio remoto';
  engine._applyRemoteRecord('grupos', { key: 'g1', val: () => registro }, false);

  assert.equal(engine.db.grupos[0].nombre, 'Editado localmente');
  assert.equal(totalRenders(renders), 0);
});

test('un child_removed de un registro inexistente no toca la base', () => {
  const { engine, renders } = createHarness();
  preparar(engine);

  engine._applyRemoteRecord('grupos', { key: 'no-existe', val: () => ({ id: 'no-existe' }) }, true);

  assert.equal(engine.db.grupos.length, 2);
  assert.equal(totalRenders(renders), 0);
});

test('el orden remoto solo se aplica si realmente cambia y no hay cambios locales', () => {
  const { engine, renders } = createHarness();
  preparar(engine);

  engine._applyRemoteOrder('grupos', ['g1', 'g2']);
  assert.equal(totalRenders(renders), 0, 'el mismo orden no debe repintar');
  assert.deepEqual(engine.db.grupos.map(g => g.id), ['g1', 'g2']);

  engine._applyRemoteOrder('grupos', ['g2', 'g1']);
  assert.deepEqual(engine.db.grupos.map(g => g.id), ['g2', 'g1']);
  assert.equal(renders.diferidos, 1);

  const rendersTrasAplicar = totalRenders(renders);
  engine.db.grupos[0].nombre = 'Pendiente de guardar';
  engine._applyRemoteOrder('grupos', ['g1', 'g2']);
  assert.deepEqual(engine.db.grupos.map(g => g.id), ['g2', 'g1'], 'el orden local sin guardar se protege');
  assert.equal(totalRenders(renders), rendersTrasAplicar);
});

test('los ajustes remotos se aplican una sola vez y sin repintados repetidos', () => {
  const { engine, renders } = createHarness();
  preparar(engine);

  const valor = { formato: 'xlsx', printPaperSize: 9 };
  engine._applyRemoteSettings('cuadernoConfig', structuredClone(valor));
  assert.deepEqual(engine.db.cuadernoConfig, valor);
  assert.equal(renders.diferidos, 1);

  engine._applyRemoteSettings('cuadernoConfig', structuredClone(valor));
  assert.equal(renders.diferidos, 1, 'el mismo valor no debe volver a repintar');
});

test('el borrado remoto de un registro sí se aplica con la base limpia', () => {
  const { engine, renders } = createHarness();
  preparar(engine);

  const registro = structuredClone(engine._serializeDatabase(engine.db).grupos.g2);
  engine._applyRemoteRecord('grupos', { key: 'g2', val: () => registro }, true);

  assert.equal(engine.db.grupos.length, 1);
  assert.equal(engine.db.grupos[0].id, 'g1');
  assert.equal(renders.diferidos, 1);
});

test('_iguales detecta igualdad aunque las claves estén en otro orden', () => {
  const { engine } = createHarness();
  preparar(engine);

  assert.equal(engine._iguales({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  assert.equal(engine._iguales({ a: 1 }, { a: 2 }), false);
  assert.equal(engine._iguales(null, undefined), false);
  assert.equal(engine._iguales(null, null), true);
  assert.equal(engine._iguales([1, 2, 3], [1, 2, 3]), true);
});

test('_localLimpio refleja cambios locales y se vuelve a marcar limpio al guardar', () => {
  const { engine } = createHarness();
  preparar(engine);

  assert.equal(engine._localLimpio(), true);

  engine.db.grupos[0].estudiantes[0].nombres = 'Modificado';
  assert.equal(engine._localLimpio(), false);

  engine._syncSnapshot = engine._clone(engine._serializeDatabase(engine.db));
  assert.equal(engine._localLimpio(), true);
});
