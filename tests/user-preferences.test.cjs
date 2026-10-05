const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const exportSource = fs.readFileSync(
  path.join(__dirname, '..', 'js', '03-config-export.js'),
  'utf8'
);
const notebookSource = fs.readFileSync(
  path.join(__dirname, '..', 'js', '01-cuaderno-engine.js'),
  'utf8'
);

function createPreferencesHarness(source, globalName, initialStorage = {}) {
  const records = new Map(Object.entries(initialStorage));
  const authManager = {
    user: { uid: 'teacher-1' },
    profile: { centerId: 'center-1' },
    activeCenterId: null
  };
  const context = {
    AuthManager: authManager,
    localStorage: {
      getItem: key => records.get(key) ?? null,
      setItem: (key, value) => records.set(key, String(value)),
      removeItem: key => records.delete(key)
    },
    document: { addEventListener() {} },
    console: { error() {} }
  };
  vm.runInNewContext(`${source}\nglobalThis.api = ${globalName};`, context);
  return { api: context.api, authManager, records };
}

test('scopes export-format preferences to the active user and center', () => {
  const { api, authManager, records } = createPreferencesHarness(
    exportSource,
    'ConfigExport',
    { TIC_EXPORT_CONFIG: JSON.stringify({ fontSize: 11 }) }
  );

  assert.equal(api.load().fontSize, 11);
  assert.equal(records.has('TIC_EXPORT_CONFIG'), false);
  assert.equal(records.get('TIC_EXPORT_CONFIG:center-1:teacher-1'), JSON.stringify({ fontSize: 11 }));

  api.save({ fontSize: 12 });
  authManager.user.uid = 'teacher-2';
  assert.equal(api.load().fontSize, 14);
});

test('scopes notebook export preferences and migrates the old browser setting once', () => {
  const { api, authManager, records } = createPreferencesHarness(
    notebookSource,
    'CuadernoEngine',
    { TIC_CUADERNO_EXPORT_OPTIONS: JSON.stringify({ grupoId: 'group-1' }) }
  );

  assert.equal(api.cargarPreferenciasExportacion().grupoId, 'group-1');
  assert.equal(records.has('TIC_CUADERNO_EXPORT_OPTIONS'), false);
  assert.equal(records.has('TIC_CUADERNO_EXPORT_OPTIONS:center-1:teacher-1'), true);

  authManager.profile.centerId = 'center-2';
  assert.equal(api.cargarPreferenciasExportacion().grupoId, '');
});
