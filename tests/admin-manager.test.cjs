const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', '12-admin-manager.js'),
  'utf8'
);

function createManager(role = 'admin', uid = 'admin-1') {
  const context = {
    AuthManager: {
      profile: { role },
      user: { uid, email: 'admin@example.com' },
      getAreaLabel: area => area === 'ingles' ? 'Docente de Inglés' : 'Docente'
    },
    window: {},
    document: { getElementById: () => null },
    Object,
    String,
    Error
  };
  vm.runInNewContext(`${source}\nglobalThis.manager = AdminManager;`, context);
  return context.manager;
}

test('blocks administrative rendering for non-admin profiles', () => {
  const manager = createManager('docente');
  assert.throws(() => manager.renderVista(), /solo está disponible para administradores/);
});

test('renders account names and email addresses as escaped text', () => {
  const manager = createManager();
  const row = manager._renderUserRow('teacher-1', {
    active: true,
    displayName: '<script>alert(1)</script>',
    email: '" onmouseover="alert(1)',
    role: 'docente'
  }, 1);

  assert.equal(row.includes('<script>'), false);
  assert.equal(row.includes('&lt;script&gt;'), true);
  assert.equal(row.includes('&quot; onmouseover=&quot;'), true);
});

test('prevents a user from disabling their own admin profile', () => {
  const manager = createManager('admin', 'admin-1');
  manager.users = { 'admin-1': { active: true, role: 'admin' } };

  assert.throws(
    () => manager._preventLockout('admin-1', manager.users['admin-1'], false),
    /No puedes desactivar tu propia cuenta/
  );
});

test('prevents removing the last active administrator', () => {
  const manager = createManager('admin', 'admin-1');
  manager.users = { 'admin-2': { active: true, role: 'admin' } };

  assert.throws(
    () => manager._preventLockout('admin-2', manager.users['admin-2'], undefined, 'docente'),
    /último administrador activo/
  );
});

test('keeps the last active admin role locked in the account list', () => {
  const manager = createManager();
  const row = manager._renderUserRow('admin-2', {
    active: true,
    displayName: 'Otro Admin',
    email: 'other@example.com',
    role: 'admin'
  }, 1);

  assert.equal(row.includes('data-user-role disabled'), true);
  assert.equal(row.includes('data-admin-action="toggle-active"'), false);
});
