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
    document: {
      /* El contenedor del panel basta con que acepte los escuchadores. */
      getElementById: id => id === 'workspace' ? { addEventListener: () => {} } : null,
      querySelector: () => null
    },
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

test('offers a manual password change action on every account row', () => {
  const manager = createManager();
  const row = manager._renderUserRow('teacher-1', {
    active: true,
    displayName: 'Docente Uno',
    email: 'docente@example.com',
    role: 'docente'
  }, 1);

  assert.equal(row.includes('data-admin-action="change-password"'), true);
  assert.equal(row.includes('data-admin-action="change-password" data-uid="teacher-1"'), true);
});

test('shows the online badge and last sign-in for each account row', () => {
  const manager = createManager();
  manager.userSessions = {
    'teacher-1': { online: true, lastSignInAt: Date.now() - 60000 },
    'teacher-2': { online: false, lastSignInAt: Date.now() - 2 * 86400000 }
  };

  const enLinea = manager._renderUserRow('teacher-1', {
    active: true, displayName: 'Docente Uno', email: 'docente@example.com', role: 'docente'
  }, 1);
  assert.equal(enLinea.includes('En línea'), true);
  assert.equal(enLinea.includes('admin-online-badge is-online'), true);
  assert.equal(enLinea.includes('Último acceso: hace 1 min'), true);

  const desconectado = manager._renderUserRow('teacher-2', {
    active: true, displayName: 'Docente Dos', email: 'dos@example.com', role: 'docente'
  }, 1);
  assert.equal(desconectado.includes('Desconectado'), true);
  assert.equal(desconectado.includes('Último acceso: hace 2 días'), true);

  const sinRegistro = manager._renderUserRow('teacher-3', {
    active: true, displayName: 'Docente Tres', email: 'tres@example.com', role: 'docente'
  }, 1);
  assert.equal(sinRegistro.includes('sin registros todavía'), true);
});

test('describes how long ago a sign-in happened in Spanish', () => {
  const manager = createManager();
  const ahora = Date.now();

  assert.equal(manager._haceCuanto(ahora - 1000), 'ahora mismo');
  assert.equal(manager._haceCuanto(ahora - 5 * 60000), 'hace 5 min');
  assert.equal(manager._haceCuanto(ahora - 3 * 3600000), 'hace 3 h');
  assert.equal(manager._haceCuanto(ahora - 48 * 3600000), 'hace 2 días');
  assert.equal(manager._haceCuanto(NaN), 'recientemente');
});

test('validates the new manual password before calling the function', () => {
  const manager = createManager();

  assert.equal(manager._validarNuevaContrasena('Segura123', 'Segura123'), 'Segura123');
  assert.throws(() => manager._validarNuevaContrasena('corta', 'corta'), /al menos 8 caracteres/);
  assert.throws(() => manager._validarNuevaContrasena('Segura 1234', 'Segura 1234'), /espacios/);
  assert.throws(() => manager._validarNuevaContrasena('Segura1234', 'Otra12345'), /no coinciden/);
});

test('reports Firebase auth errors in plain Spanish', () => {
  const manager = createManager();

  assert.equal(
    manager._describirErrorCambioContrasena({ code: 'auth/wrong-password' }),
    'La contraseña actual no coincide con la de esa cuenta.'
  );
  assert.equal(
    manager._describirErrorCambioContrasena({ code: 'auth/invalid-login-credentials' }),
    'La contraseña actual no coincide con la de esa cuenta.'
  );
  assert.equal(
    manager._describirErrorCambioContrasena({ code: 'auth/network-request-failed' }),
    'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'
  );
  assert.equal(
    manager._describirErrorCambioContrasena({ code: 'auth/unexpected', message: 'Fallo raro' }),
    'Fallo raro'
  );
});

test('the create-account form offers an optional manual password field', () => {
  const manager = createManager();
  manager.centers = { 'ct-1': { id: 'ct-1', name: 'Centro Uno', active: true } };
  const view = manager.renderVista();

  assert.equal(view.includes('id="admin-new-password"'), true);
  assert.equal(view.includes('name="password"'), true);
  assert.equal(view.includes('data-admin-action="toggle-new-password"'), true);
});
