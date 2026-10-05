const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', '02-data-engine.js'),
  'utf8'
);

function createHarness(initialData) {
  let remote = structuredClone(initialData);
  if (remote.appData && !remote.centers) {
    remote = {
      centers: {
        'ct-ariel-darce': {
          metadata: { id: 'ct-ariel-darce', name: 'Centro Tecnológico Ariel Darce', active: true },
          appData: remote.appData
        }
      }
    };
  }

  function canonicalPath(pathString) {
    return pathString === 'appData' || pathString.startsWith('appData/')
      ? `centers/ct-ariel-darce/${pathString}`
      : pathString;
  }

  function getAtPath(pathString) {
    return pathString.split('/').filter(Boolean).reduce(
      (value, key) => value == null ? undefined : value[key],
      remote
    );
  }

  function setAtPath(pathString, value) {
    const keys = pathString.split('/').filter(Boolean);
    let target = remote;
    keys.slice(0, -1).forEach(key => {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key];
    });
    if (keys.length) {
      if (value === null) delete target[keys[keys.length - 1]];
      else target[keys[keys.length - 1]] = structuredClone(value);
    }
  }

  function makeReference(pathString = '') {
    return {
      child(childPath) {
        return makeReference([pathString, childPath].filter(Boolean).join('/'));
      },
      async once() {
        return {
          val: () => structuredClone(getAtPath(pathString) ?? null),
          exists: () => getAtPath(pathString) !== undefined && getAtPath(pathString) !== null
        };
      },
      async transaction(update) {
        const current = structuredClone(getAtPath(pathString) ?? null);
        const next = update(current);
        if (next === undefined) return { committed: false };
        setAtPath(pathString, next);
        return { committed: true };
      },
      async set(value) {
        setAtPath(pathString, value);
      },
      async update(values) {
        Object.entries(values).forEach(([key, value]) => setAtPath(`${pathString}/${key}`, value));
      },
      on() {},
      off() {}
    };
  }

  const referencePaths = [];
  const database = {
    ref: pathString => {
      referencePaths.push(pathString || '');
      return makeReference(pathString);
    },
    setForTest: (pathString, value) => setAtPath(canonicalPath(pathString), value),
    setRawForTest: setAtPath,
    getRawForTest: pathString => structuredClone(getAtPath(pathString) ?? null),
    getForTest: pathString => structuredClone(getAtPath(canonicalPath(pathString)) ?? null)
  };
  const messages = [];
  const authManager = {
    user: { uid: 'teacher-1' },
    profile: { role: 'docente', centerId: 'ct-ariel-darce' },
    activeCenterId: null
  };
  const context = {
    window: { FirebaseServices: { database }, confirm: () => true },
    AuthManager: authManager,
    UI: { showToast(message) { messages.push(message); }, renderCurrentModule() {} },
    document: { getElementById: () => null },
    console: { error() {} },
    Date,
    JSON,
    Set,
    Map,
    Object,
    Array,
    String,
    Error,
    Promise
  };
  vm.runInNewContext(`${source}\nglobalThis.engine = DataEngine;`, context);
  return { engine: context.engine, database, messages, authManager, referencePaths };
}

function sharedData() {
  return {
    version: '1.0',
    lastUpdated: '2026-09-02T00:00:00.000Z',
    gruposOrden: ['group-1'],
    grupos: {
      'group-1': { id: 'group-1', nombre: 'Primero', estudiantes: [] },
      'group-2': { id: 'group-2', nombre: 'Segundo', estudiantes: [] }
    },
    equiposOrden: [],
    equipos: {}
  };
}

test('round-trips ID maps in the declared order and keeps extra settings', () => {
  const { engine } = createHarness({ appData: sharedData() });
  const database = engine._deserializeDatabase({
    ...sharedData(),
    informe: { periodo: '2026' }
  });

  assert.deepEqual(
    Array.from(database.grupos, group => group.id),
    ['group-1', 'group-2']
  );
  assert.deepEqual(engine._serializeDatabase(database).informe, { periodo: '2026' });
});

test('rejects Firebase-invalid record IDs before writing', () => {
  const { engine } = createHarness({ appData: sharedData() });
  assert.throws(
    () => engine._serializeDatabase({ grupos: [{ id: 'bad/key' }], equipos: [] }),
    /no es válido para Firebase Realtime Database/
  );
});

test('scopes every data reference to the assigned center', () => {
  const { engine, referencePaths, authManager } = createHarness({ appData: sharedData() });
  authManager.profile.centerId = 'ct-bluefields';

  engine._centerDataReference();

  assert.equal(referencePaths.at(-1), 'centers/ct-bluefields/appData');
});

test('migrates legacy data for the first administrator and retains the root backup', async () => {
  const { engine, database } = createHarness({});
  const legacyData = sharedData();
  database.setRawForTest('appData', legacyData);
  const profile = { active: true, role: 'admin' };
  const user = { uid: 'admin-1' };

  await engine.prepareAccount(profile, user);

  assert.equal(profile.centerId, 'ct-ariel-darce');
  assert.equal(profile.centerName, 'Centro Tecnológico Ariel Darce');
  assert.deepEqual(database.getForTest('centers/ct-ariel-darce/appData'), legacyData);
  assert.deepEqual(database.getRawForTest('appData'), legacyData);
  assert.equal(database.getForTest('users/admin-1/centerId'), 'ct-ariel-darce');
});

test('encodes and restores nested assessment keys that Firebase does not allow', () => {
  const { engine } = createHarness({ appData: sharedData() });
  const database = {
    version: '1.0',
    grupos: [{
      id: 'group-1',
      estudiantes: [{
        id: 'student-1',
        evaluacionesPorModulo: {
          'Adaptación al Cambio Climático': {
            notas: {
              'Cuestionario UD1: Gestión ambiental de la contaminación y cambio climático.': 85,
              '~literal-key': 90,
              '': 75
            }
          }
        }
      }]
    }],
    equipos: [],
    informe: { 'periodo.1': { '$campo': 'valor' } }
  };

  const serialized = engine._serializeDatabase(database);
  const encodedRecord = serialized.grupos['group-1'];
  const encodedNotes = encodedRecord.estudiantes[0]
    .evaluacionesPorModulo['Adaptación al Cambio Climático'].notas;

  assert.equal(serialized.firebaseKeyEncoding, 1);
  assert.equal(Object.keys(encodedNotes).some(key => /[.#$\[\]/]/.test(key)), false);
  assert.deepEqual(
    engine._deserializeDatabase(serialized).grupos[0].estudiantes[0]
      .evaluacionesPorModulo['Adaptación al Cambio Climático'].notas,
    database.grupos[0].estudiantes[0].evaluacionesPorModulo['Adaptación al Cambio Climático'].notas
  );
  assert.deepEqual(engine._deserializeDatabase(serialized).informe, database.informe);
});

test('migrates untagged legacy records without decoding literal tilde keys', () => {
  const { engine } = createHarness({ appData: sharedData() });
  const legacy = {
    ...sharedData(),
    grupos: {
      'group-1': {
        id: 'group-1',
        estudiantes: [{ id: 'student-1', notas: { '~literal-key': 80, 'nota.1': 90 } }]
      }
    }
  };

  const loaded = engine._deserializeDatabase(legacy);
  const rewritten = engine._serializeDatabase(loaded);
  const reloaded = engine._deserializeDatabase(rewritten);

  assert.deepEqual(reloaded.grupos[0].estudiantes[0].notas, { '~literal-key': 80, 'nota.1': 90 });
  assert.equal(rewritten.firebaseKeyEncoding, 1);
});

test('imports exported JSON with group and team arrays', () => {
  const { engine } = createHarness({ appData: sharedData() });
  const imported = engine._normalizeImportedDatabase({
    version: '1.0',
    grupos: [{ id: 'group-1', nombre: 'Primero', estudiantes: [] }],
    equipos: [{ id: 'team-1', nombreEquipo: 'Equipo', archivos: [], integrantes: [] }],
    informe: { periodo: '2026' }
  });

  assert.equal(imported.grupos[0].id, 'group-1');
  assert.equal(imported.equipos[0].id, 'team-1');
  assert.deepEqual(imported.informe, { periodo: '2026' });
});

test('imports Realtime Database maps and wrapped appData exports', () => {
  const { engine } = createHarness({ appData: sharedData() });
  const imported = engine._normalizeImportedDatabase({
    appData: {
      ...sharedData(),
      grupos: {
        'group-1': { nombre: 'Primero', estudiantes: [] },
        'group-2': { id: 'group-2', nombre: 'Segundo', estudiantes: [] }
      },
      equipos: {
        'team-1': { nombreEquipo: 'Equipo', integrantes: [], archivos: [] }
      }
    }
  });

  assert.deepEqual(Array.from(imported.grupos, group => group.id), ['group-1', 'group-2']);
  assert.equal(imported.equipos[0].id, 'team-1');
});

test('commits the database import before reporting an attachment migration failure', async () => {
  const { engine, database, messages, authManager } = createHarness({ appData: sharedData() });
  authManager.profile.role = 'admin';
  engine.db = { grupos: [], equipos: [] };
  engine._syncSnapshot = engine._clone(engine._serializeDatabase(engine.db));
  engine.migrateLegacyAttachments = async () => {
    assert.equal(database.getForTest('appData/grupos/group-1/id'), 'group-1');
    throw new Error('Storage CORS unavailable');
  };
  const imported = {
    grupos: [{ id: 'group-1', nombre: 'Importado', estudiantes: [] }],
    equipos: [{ id: 'team-1', nombreEquipo: 'Equipo', archivos: [], integrantes: [] }]
  };

  await engine.importDBJSON({
    target: {
      files: [{ text: async () => JSON.stringify(imported) }],
      value: 'selected.json'
    }
  });

  assert.equal(database.getForTest('appData/grupos/group-1/nombre'), 'Importado');
  assert.equal(engine.getGrupoById('group-1').nombre, 'Importado');
  assert.equal(messages.some(message => message.includes('Base guardada en Realtime Database')), true);
  assert.equal(messages.some(message => message.includes('falló la migración de adjuntos')), true);
});

test('explains unsupported import collection shapes', () => {
  const { engine } = createHarness({ appData: sharedData() });

  assert.throws(
    () => engine._normalizeImportedDatabase({ grupos: 'not a collection', equipos: null }),
    /detectado: grupos=string, equipos=nulo/
  );
});

test('persists a changed entity and metadata to the shared database', async () => {
  const { engine, database } = createHarness({ appData: sharedData() });
  engine.db = engine._deserializeDatabase(database.getForTest('appData'));
  engine._syncSnapshot = engine._clone(engine._serializeDatabase(engine.db));
  engine.db.grupos[0].nombre = 'Grupo actualizado';

  await engine.save();

  assert.equal(database.getForTest('appData/grupos/group-1/nombre'), 'Grupo actualizado');
  assert.equal(database.getForTest('appData/grupos/group-1/updatedBy'), 'teacher-1');
  assert.match(database.getForTest('appData/grupos/group-1/updatedAt'), /^\d{4}-\d\d-\d\dT/);
  assert.equal(database.getForTest('appData/grupos/group-2/updatedBy'), null);
  assert.equal(database.getForTest('appData/updatedBy'), 'teacher-1');
  assert.equal(engine._syncSnapshot.grupos['group-1'].nombre, 'Grupo actualizado');
});

test('limits attachment management to the uploader UID in metadata or storage path', () => {
  const { engine } = createHarness({ appData: sharedData() });

  assert.equal(engine.getAttachmentOwner({ uploadedBy: 'teacher-1' }), 'teacher-1');
  assert.equal(engine.getAttachmentOwner({ storagePath: 'team-attachments/teacher-1/team-1/file-1/doc.pdf' }), 'teacher-1');
  assert.equal(engine.canManageAttachment({ storagePath: 'team-attachments/teacher-1/team-1/file-1/doc.pdf' }), true);
  assert.equal(engine.canManageAttachment({
    uploadedBy: 'teacher-1',
    storagePath: 'team-attachments/teacher-2/team-1/file-1/doc.pdf'
  }), false);
  assert.equal(engine.canManageAttachment({ storagePath: 'team-attachments/teacher-2/team-1/file-1/doc.pdf' }), false);
  assert.equal(engine.canManageAttachment({ dataUrl: 'data:application/pdf;base64,AA==' }), false);
});

test('applies a remote ordering change without losing records', () => {
  const { engine, database } = createHarness({ appData: sharedData() });
  engine.db = engine._deserializeDatabase(database.getForTest('appData'));
  engine._syncSnapshot = engine._clone(engine._serializeDatabase(engine.db));

  engine._applyRemoteOrder('grupos', ['group-2', 'group-1']);

  assert.deepEqual(
    Array.from(engine.getGrupos(), group => group.id),
    ['group-2', 'group-1']
  );
  assert.equal(engine._syncSnapshot.gruposOrden[0], 'group-2');
});

test('detects a concurrent edit and reloads rather than overwriting it', async () => {
  const { engine, database } = createHarness({ appData: sharedData() });
  engine.db = engine._deserializeDatabase(database.getForTest('appData'));
  engine._syncSnapshot = engine._clone(engine._serializeDatabase(engine.db));
  engine.db.grupos[0].nombre = 'Cambio local';
  database.setForTest('appData/grupos/group-1/nombre', 'Cambio remoto');

  await assert.rejects(engine.save(), { code: 'app/write-conflict' });

  assert.equal(database.getForTest('appData/grupos/group-1/nombre'), 'Cambio remoto');
  assert.equal(engine.getGrupoById('group-1').nombre, 'Cambio remoto');
});
