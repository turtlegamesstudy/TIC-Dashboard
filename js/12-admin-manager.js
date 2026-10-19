'use strict';

const AdminManager = {
  users: {},
  centers: {},
  staffProfiles: {},
  userSessions: {},
  _sesionBound: false,
  _workspaceBound: false,

  _requireAdmin() {
    if (!['admin', 'global'].includes(AuthManager.profile?.role) || !AuthManager.user) {
      throw new Error('Esta función solo está disponible para administradores activos.');
    }
  },

  _escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  },

  renderVista() {
    this._requireAdmin();
    this._bindWorkspace();
    return `
      <section class="module-fade-enter admin-users-page">
        <header class="view-header">
          <div class="admin-header-copy">
            <p class="view-eyebrow">CONTROL DEL SISTEMA</p>
            <h1><i class="ri-shield-user-line" aria-hidden="true"></i> Administración</h1>
            <p>Cuentas, roles y centros tecnológicos que tienen acceso al panel.</p>
          </div>
          <div class="header-actions admin-header-stats">
            <span class="admin-stat"><b data-admin-stat="cuentas">—</b> cuentas</span>
            <span class="admin-stat"><b data-admin-stat="activas">—</b> activas</span>
            <span class="admin-stat"><b data-admin-stat="centros">—</b> centros</span>
          </div>
        </header>

        ${AuthManager.profile?.role === 'global' ? `
        <div class="group-header-card admin-center-bar">
          <label class="tb-label" for="admin-active-center"><i class="ri-building-2-line" aria-hidden="true"></i> Centro operativo</label>
          <select id="admin-active-center" aria-label="Centro operativo"></select>
          <button class="btn-primary-soft" type="button" data-admin-action="switch-center"><i class="ri-folder-open-line" aria-hidden="true"></i> Abrir centro</button>
          <p class="admin-center-note">Perteneces a todos los centros a la vez: abre el espacio de datos del que quieras operar.</p>
        </div>` : `
        <div class="group-header-card admin-center-bar">
          <p class="admin-center-note"><i class="ri-lock-2-line" aria-hidden="true"></i> Administras <strong>solo tu centro tecnológico</strong> — su listado, sus notas, sus equipos y sus cuentas locales. Abrir el espacio de otro centro es capacidad del <strong>Administrador Global</strong>.</p>
        </div>`}

        <div class="admin-resumen kpi-grid" aria-label="Resumen de administración">
          <article class="kpi-card">
            <span class="kpi-etiqueta">Cuentas registradas</span>
            <div class="kpi-cuerpo">
              <span class="kpi-icono cyan"><i class="ri-group-line" aria-hidden="true"></i></span>
              <div class="kpi-datos">
                <span class="kpi-valor" data-admin-kpi="cuentas">—</span>
                <span class="kpi-pie">Perfiles con acceso al panel</span>
              </div>
            </div>
          </article>
          <article class="kpi-card">
            <span class="kpi-etiqueta">Cuentas activas</span>
            <div class="kpi-cuerpo">
              <span class="kpi-icono verde"><i class="ri-user-follow-line" aria-hidden="true"></i></span>
              <div class="kpi-datos">
                <span class="kpi-valor" data-admin-kpi="activas">—</span>
                <span class="kpi-pie" data-admin-kpi-pie="activas">Pueden entrar hoy</span>
              </div>
            </div>
          </article>
          <article class="kpi-card">
            <span class="kpi-etiqueta">Docentes</span>
            <div class="kpi-cuerpo">
              <span class="kpi-icono"><i class="ri-presentation-line" aria-hidden="true"></i></span>
              <div class="kpi-datos">
                <span class="kpi-valor" data-admin-kpi="docentes">—</span>
                <span class="kpi-pie">Cuentas con rol docente</span>
              </div>
            </div>
          </article>
          <article class="kpi-card">
            <span class="kpi-etiqueta">Administradores</span>
            <div class="kpi-cuerpo">
              <span class="kpi-icono morado"><i class="ri-shield-user-line" aria-hidden="true"></i></span>
              <div class="kpi-datos">
                <span class="kpi-valor" data-admin-kpi="admins">—</span>
                <span class="kpi-pie">Gestionan cuentas y centros</span>
              </div>
            </div>
          </article>
          <article class="kpi-card">
            <span class="kpi-etiqueta">Centros activos</span>
            <div class="kpi-cuerpo">
              <span class="kpi-icono ambar"><i class="ri-building-2-line" aria-hidden="true"></i></span>
              <div class="kpi-datos">
                <span class="kpi-valor" data-admin-kpi="centros">—</span>
                <span class="kpi-pie">Espacios de datos abiertos</span>
              </div>
            </div>
          </article>
        </div>

        <div class="admin-users-layout">
          <section class="admin-panel" aria-labelledby="admin-create-heading">
            <div class="admin-panel-heading">
              <span class="admin-panel-icon"><i class="ri-user-add-line" aria-hidden="true"></i></span>
              <div>
                <h2 id="admin-create-heading">Crear una cuenta</h2>
              </div>
            </div>
            <p class="admin-panel-description">Se enviará un correo para que el usuario establezca su contraseña. No necesitas conocer ni compartirla.</p>
            <form class="admin-create-form" id="admin-create-user-form">
              <div class="form-group">
                <label for="admin-new-name">Nombre completo</label>
                <input id="admin-new-name" name="displayName" type="text" maxlength="120" autocomplete="name" required>
              </div>
              <div class="form-group">
                <label for="admin-new-email">Correo electrónico</label>
                <input id="admin-new-email" name="email" type="email" maxlength="254" autocomplete="email" required>
              </div>
              <div class="form-group">
                <label for="admin-new-role">Rol inicial</label>
                <select id="admin-new-role" name="role" required>
                  <option value="docente">Docente</option>
                   <option value="invitado">Invitado (solo lectura)</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div class="form-group">
                <label for="admin-new-center">Centro tecnológico</label>
                <select id="admin-new-center" name="centerId" required></select>
              </div>
              <div class="form-group">
                <label for="admin-new-area">Área docente</label>
                <select id="admin-new-area" name="area" required>
                  <option value="general">General</option>
                  <option value="ingles">Inglés</option>
                  <option value="tic">Tecnologías de la información</option>
                  <option value="otra">Otra área</option>
                </select>
              </div>
              <div class="form-group">
                <label for="admin-new-password">Contraseña manual (opcional)</label>
                <div class="admin-password-field">
                  <input id="admin-new-password" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Déjala vacía para enviarla por correo">
                  <button class="admin-password-toggle" type="button" data-admin-action="toggle-new-password" aria-label="Mostrar contraseña" title="Mostrar contraseña">
                    <i class="ri-eye-line" aria-hidden="true"></i>
                  </button>
                </div>
                <small class="admin-field-help">Mínimo 8 caracteres sin espacios. Si la dejas vacía, se enviará un correo para que la persona la establezca; si la escribes, compártela directamente y no llegará correo.</small>
              </div>
              <button class="btn-primary" type="submit" data-admin-submit>
                <i class="ri-user-add-line" aria-hidden="true"></i> Crear cuenta y enviar acceso
              </button>
            </form>
            <hr class="admin-section-divider">
            <div class="admin-panel-heading">
              <span class="admin-panel-icon"><i class="ri-building-2-line" aria-hidden="true"></i></span>
              <div>
                <h2>Registrar un centro</h2>
              </div>
            </div>
            <p class="admin-panel-description">Cada centro tecnológico tiene su propia base de grupos, equipos y exportaciones.</p>
            <form class="admin-create-form" id="admin-create-center-form">
              <div class="form-group">
                <label for="admin-new-center-name">Nombre oficial</label>
                <input id="admin-new-center-name" name="centerName" type="text" maxlength="140" required>
              </div>
              <div class="form-group">
                <label for="admin-new-center-code">Identificador</label>
                <input id="admin-new-center-code" name="centerCode" type="text" maxlength="60" pattern="[A-Za-z0-9_-]+" placeholder="ct-nombre-ciudad" required>
                <small class="admin-field-help">Se usa dentro de la base de datos; no puede cambiarse después.</small>
              </div>
              <button class="btn-primary-soft" type="submit" data-admin-submit><i class="ri-building-2-line" aria-hidden="true"></i> Crear centro</button>
            </form>
          </section>
          <section class="admin-panel" aria-labelledby="admin-users-heading">
            <div class="admin-users-heading">
              <div class="admin-panel-heading">
                <span class="admin-panel-icon"><i class="ri-group-line" aria-hidden="true"></i></span>
                <div>
                  <h2 id="admin-users-heading">Cuentas autorizadas</h2>
                  <p class="admin-panel-description" data-admin-summary>Roles, estado y centro de cada cuenta.</p>
                </div>
              </div>
              <button class="btn-primary-soft" type="button" data-admin-action="refresh">
                <i class="ri-refresh-line" aria-hidden="true"></i><span class="btn-label">Actualizar</span>
              </button>
            </div>
            <div class="admin-toolbar">
              <label class="admin-search" for="admin-search">
                <i class="ri-search-line" aria-hidden="true"></i>
                <input id="admin-search" type="search" data-admin-search
                       placeholder="Buscar por nombre, correo o UID…" autocomplete="off">
              </label>
              <select data-admin-filter-rol aria-label="Filtrar por rol">
                <option value="todos">Todos los roles</option>
                <option value="docente">Docentes</option>
                 <option value="invitado">Invitados</option>
                <option value="admin">Administradores</option>
              </select>
              <select data-admin-filter-estado aria-label="Filtrar por estado">
                <option value="todos">Cualquier estado</option>
                <option value="activas">Solo activas</option>
                <option value="inactivas">Solo inactivas</option>
              </select>
              <button class="btn-primary-soft" type="button" data-admin-action="clear-filters">
                <i class="ri-filter-off-line" aria-hidden="true"></i> Limpiar
              </button>
            </div>
            <p class="admin-resultados" data-admin-results aria-live="polite"></p>
            <div id="admin-users-list" aria-live="polite">
              <p class="admin-users-message">Cargando cuentas...</p>
            </div>
          </section>
        </div>
        <div class="admin-profile-modal" id="admin-profile-modal" hidden>
          <section class="admin-panel admin-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-profile-title">
            <div class="admin-users-heading">
              <h2 id="admin-profile-title">Editar datos institucionales</h2>
              <button class="btn-primary-soft" type="button" data-admin-action="close-profile">Cerrar</button>
            </div>
            <form class="admin-create-form" id="admin-edit-profile-form">
              <input type="hidden" name="uid" id="admin-edit-profile-uid">
              <div class="form-group"><label for="admin-edit-first-name">Nombres</label><input id="admin-edit-first-name" name="firstName" maxlength="80" required></div>
              <div class="form-group"><label for="admin-edit-last-name">Apellidos</label><input id="admin-edit-last-name" name="lastName" maxlength="100" required></div>
              <div class="form-group"><label for="admin-edit-phone">Teléfono institucional</label><input id="admin-edit-phone" name="phone" type="tel" maxlength="32"></div>
              <div class="form-group"><label for="admin-edit-employee-code">Código de empleado</label><input id="admin-edit-employee-code" name="employeeCode" maxlength="40"></div>
              <div class="form-group"><label for="admin-edit-position">Cargo</label><input id="admin-edit-position" name="position" maxlength="100"></div>
              <div class="form-group">
                <label for="admin-edit-area">Área docente</label>
                <select id="admin-edit-area" name="area" required>
                  <option value="general">General</option><option value="ingles">Inglés</option>
                  <option value="tic">Tecnologías de la información</option><option value="otra">Otra área</option>
                </select>
              </div>
              <div class="form-group"><label for="admin-edit-specialty">Especialidad o módulos</label><input id="admin-edit-specialty" name="specialty" maxlength="180"></div>
              <button class="btn-primary" type="submit">Guardar datos institucionales</button>
            </form>
          </section>
        </div>
        <div class="admin-profile-modal" id="admin-password-modal" hidden>
          <section class="admin-panel admin-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-password-title">
            <div class="admin-users-heading">
              <h2 id="admin-password-title"><i class="ri-lock-password-line" aria-hidden="true"></i> Cambiar contraseña</h2>
              <button class="btn-primary-soft" type="button" data-admin-action="close-password">Cerrar</button>
            </div>
            <p class="admin-panel-description" data-password-user></p>
            <form class="admin-create-form" id="admin-change-password-form">
              <input type="hidden" name="uid" id="admin-change-password-uid">
              <div class="form-group">
                <label for="admin-change-password-current">Contraseña actual de la cuenta</label>
                <input id="admin-change-password-current" name="currentPassword" type="password" maxlength="128" autocomplete="current-password" required>
                <small class="admin-field-help">Es la que diste al crear la cuenta o la que la persona ya tenía. El navegador necesita iniciar sesión con ella para poder cambiarla; no se guarda.</small>
              </div>
              <div class="form-group">
                <label for="admin-change-password-new">Nueva contraseña</label>
                <input id="admin-change-password-new" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
                <small class="admin-field-help">Mínimo 8 caracteres y sin espacios. Comunícala a la persona por un canal confiable; la usará para entrar en su próximo acceso.</small>
              </div>
              <div class="form-group">
                <label for="admin-change-password-confirm">Repite la nueva contraseña</label>
                <input id="admin-change-password-confirm" name="confirmPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
              </div>
              <button class="btn-primary" type="submit" data-password-submit>
                <i class="ri-lock-password-line" aria-hidden="true"></i> Guardar contraseña
              </button>
              <button class="btn-primary-soft" type="button" data-admin-action="reset-password" data-uid="">
                <i class="ri-mail-send-line" aria-hidden="true"></i> No recuerdo la actual: enviar correo de recuperación
              </button>
            </form>
            <p class="admin-field-help admin-console-help">
              <i class="ri-external-link-line" aria-hidden="true"></i> ¿Nadie recuerda la contraseña y no hay tiempo? En la consola de Firebase se restablece en segundos, sin correo y gratis:
              <a href="https://console.firebase.google.com/project/ina-tions/authentication/users" target="_blank" rel="noopener noreferrer">
                Authentication → Usuarios
              </a>
              , busca a la persona y usa el menú ⋮ → «Restablecer contraseña» (fija una nueva) o «Eliminar usuario» (recrea la cuenta desde este panel con la misma contraseña).
            </p>
          </section>
        </div>

        <section class="bloque-analisis" aria-label="Auditoría institucional y papelera">
          <div class="bloque-titulo">
            <h2><i class="ri-file-shield-2-line" aria-hidden="true"></i> Auditoría y papelera</h2>
            <span class="bloque-nota">Cada acción sensible queda registrada · lo eliminado se recupera</span>
          </div>
          <div class="audit-rejilla">
            <div class="audit-col">
              <h3 class="audit-titulo"><i class="ri-history-line" aria-hidden="true"></i> Bitácora de acciones</h3>
              <div id="audit-lista"><p class="audit-vacio">Cargando bitácora…</p></div>
            </div>
            <div class="audit-col">
              <h3 class="audit-titulo"><i class="ri-recycle-line" aria-hidden="true"></i> Papelera de restablecidos</h3>
              <div id="papelera-lista"><p class="audit-vacio">Cargando papelera…</p></div>
            </div>
          </div>
        </section>
      </section>`;
  },

  _bindWorkspace() {
    if (this._workspaceBound) return;
    const workspace = document.getElementById('workspace');
    if (!workspace) throw new Error('No se encontró el contenedor de administración.');
    workspace.addEventListener('submit', event => {
      if (event.target.id === 'admin-create-user-form') {
        event.preventDefault();
        this.createUser(event.target);
      } else if (event.target.id === 'admin-create-center-form') {
        event.preventDefault();
        this.createCenter(event.target);
      } else if (event.target.id === 'admin-edit-profile-form') {
        event.preventDefault();
        this.saveStaffProfile(event.target);
      } else if (event.target.id === 'admin-change-password-form') {
        event.preventDefault();
        this.changePassword(event.target);
      }
    });
    workspace.addEventListener('click', event => {
      const button = event.target.closest('[data-admin-action]');
      if (!button) return;
      const { adminAction: action, uid } = button.dataset;
      if (action === 'refresh') this.cargarUsuarios();
      else if (action === 'clear-filters') this.limpiarFiltros();
      else if (action === 'switch-center') this.switchCenter();
      else if (action === 'close-profile') this.closeStaffProfile();
      else if (action === 'edit-profile') this.openStaffProfile(uid);
      else if (action === 'change-password') this.openPasswordModal(uid);
      else if (action === 'close-password') this.closePasswordModal();
      else if (action === 'toggle-new-password') this._alternarVisibilidadCampo(button);
      else if (action === 'assign-center') {
        const centerId = button.closest('[data-user-row]')?.querySelector('[data-user-center]')?.value;
        this.assignCenter(uid, centerId);
      }
      else if (action === 'toggle-active') this.toggleActive(uid);
      else if (action === 'reset-password') this.sendPasswordReset(uid);
      else if (action === 'save-role') {
        const role = button.closest('[data-user-row]')?.querySelector('[data-user-role]')?.value;
        this.updateRole(uid, role);
      }
    });
    /* Buscador y filtros: se delegan en el workspace para que sigan
       funcionando cada vez que se repinta la lista de cuentas. */
    workspace.addEventListener('input', event => {
      if (!event.target || !event.target.matches?.('[data-admin-search]')) return;
      this._filtros.texto = event.target.value;
      this._repintarCuentas();
    });
    workspace.addEventListener('change', event => {
      const destino = event.target;
      if (!destino || !destino.matches) return;
      if (destino.matches('[data-admin-filter-rol]')) this._filtros.rol = destino.value;
      else if (destino.matches('[data-admin-filter-estado]')) this._filtros.estado = destino.value;
      else return;
      this._repintarCuentas();
    });
    /* Escucha en vivo de sesiones: actualiza «En línea» y el último acceso sin
       recargar la vista. */
    if (!this._sesionBound) {
      this._sesionBound = true;
      const services = window.FirebaseServices || {};
      if (services.database) {
        services.database.ref('userSessions').on('value', snapshot => {
          this.userSessions = snapshot.val() || {};
          this._repintarCuentas();
        });
      }
    }
    this._workspaceBound = true;
  },

  _repintarCuentas() {
    const list = document.getElementById('admin-users-list');
    if (list) this._renderUsers(list);
  },

  limpiarFiltros() {
    this._filtros = { texto: '', rol: 'todos', estado: 'todos' };
    const buscar = document.querySelector?.('[data-admin-search]');
    if (buscar) buscar.value = '';
    const rol = document.querySelector?.('[data-admin-filter-rol]');
    if (rol) rol.value = 'todos';
    const estado = document.querySelector?.('[data-admin-filter-estado]');
    if (estado) estado.value = 'todos';
    this._repintarCuentas();
  },

  async cargarUsuarios() {
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    try {
      this._requireAdmin();
      list.innerHTML = '<p class="admin-users-message">Cargando cuentas...</p>';
      const database = window.FirebaseServices.database;
      const [usersSnapshot, centersSnapshot, staffProfilesSnapshot, sessionsSnapshot] = await Promise.all([
        database.ref('users').once('value'),
        database.ref('centers').once('value'),
        database.ref('staffProfiles').once('value'),
        database.ref('userSessions').once('value')
      ]);
      const centerRecords = centersSnapshot.val() || {};
      this.centers = Object.fromEntries(Object.entries(centerRecords)
        .filter(([, record]) => record?.metadata)
        .map(([id, record]) => [id, record.metadata]));
      this.users = usersSnapshot.val() || {};
      this.staffProfiles = staffProfilesSnapshot.val() || {};
      this.userSessions = sessionsSnapshot.val() || {};
      if (AuthManager.user?.uid && this.users[AuthManager.user.uid]) {
        this.users[AuthManager.user.uid].email ||= AuthManager.user.email || '';
      }
      this._renderCenterSelects();
      this._renderUsers(list);
    } catch (error) {
      console.error('No se pudieron cargar los usuarios:', error);
      list.innerHTML = `<p class="admin-users-message" role="alert">${this._escape(error.message || 'No se pudieron cargar las cuentas.')}</p>`;
    }
  },

  _renderCenterSelects() {
    let centers = Object.entries(this.centers)
      .filter(([, center]) => center.active !== false)
      .sort((left, right) => String(left[1].name).localeCompare(String(right[1].name), 'es'));
    /* El administrador del centro solo ve su propio centro en lista
       y selector; el Administrador Global ve todos. */
    if (AuthManager.profile?.role !== 'global') {
      const propio = AuthManager.profile?.centerId || '';
      centers = centers.filter(([id]) => id === propio);
    }
    const options = selected => centers.map(([id, center]) =>
      `<option value="${this._escape(id)}"${id === selected ? ' selected' : ''}>${this._escape(center.name)}</option>`
    ).join('');
    const newCenter = document.getElementById('admin-new-center');
    const activeCenter = document.getElementById('admin-active-center');
    if (newCenter) newCenter.innerHTML = options(AuthManager.activeCenterId);
    if (activeCenter) activeCenter.innerHTML = options(AuthManager.activeCenterId);
  },

  /* Filtros de la lista de cuentas (texto, rol y estado). */
  _filtros: { texto: '', rol: 'todos', estado: 'todos' },

  /* ¿Esta cuenta está dentro del alcance del rol actual?
     (admin del centro → solo su centro; global → todas). */
  _enAlcance(profile) {
    if (!profile) return false;
    if (AuthManager.profile?.role === 'global') return true;
    const propio = AuthManager.profile?.centerId || '';
    return !profile.centerId || profile.centerId === propio;
  },

  _filtrarCuentas(entries) {
    const { texto, rol, estado } = this._filtros;
    const busqueda = String(texto || '').trim().toLowerCase();
    return entries.filter(([uid, profile]) => {
      /* El Administrador solo administra las cuentas de SU centro;
         el Administrador Global ve todas. */
      if (!this._enAlcance(profile)) return false;
      if (rol !== 'todos' && (profile.role === 'admin' || profile.role === 'global' ? 'admin' : (profile.role === 'invitado' ? 'invitado' : 'docente')) !== rol) return false;
      if (estado === 'activas' && profile.active !== true) return false;
      if (estado === 'inactivas' && profile.active === true) return false;
      if (!busqueda) return true;
      const staff = (this.staffProfiles && this.staffProfiles[uid]) || {};
      const nombreStaff = [staff.firstName, staff.lastName].filter(Boolean).join(' ');
      const contenido = [
        profile.displayName, profile.email, nombreStaff, profile.centerId
      ].filter(Boolean).join(' ').toLowerCase();
      return contenido.includes(busqueda);
    });
  },

  _renderUsers(container) {
    const esGlobal = AuthManager.profile?.role === 'global';
    const entries = Object.entries(this.users)
      .filter(([, profile]) => profile && typeof profile === 'object' && this._enAlcance(profile))
      .sort((left, right) => String(left[1].displayName || left[1].email || left[0])
        .localeCompare(String(right[1].displayName || right[1].email || right[0]), 'es'));
    const totalAlcance = entries.length;
    this._actualizarResumen(entries);
    const filtrados = this._filtrarCuentas(entries);
    const resumen = document.querySelector?.('[data-admin-results]');
    if (resumen) {
      resumen.textContent = esGlobal
        ? (filtrados.length === entries.length
          ? `${entries.length} cuenta${entries.length === 1 ? '' : 's'} en TODOS los centros.`
          : `${filtrados.length} de ${entries.length} cuentas coinciden con el filtro.`)
        : (filtrados.length === entries.length
          ? `${entries.length} cuenta${entries.length === 1 ? '' : 's'} en este centro.`
          : `${filtrados.length} de ${entries.length} cuentas coinciden con el filtro.`);
    }
    if (entries.length === 0) {
      container.innerHTML = `<div class="admin-empty"><i class="ri-user-search-line" aria-hidden="true"></i><p>Todavía no hay perfiles registrados.</p></div>`;
      return;
    }
    if (filtrados.length === 0) {
      container.innerHTML = `
        <div class="admin-sin-resultados">
          <i class="ri-user-search-line" aria-hidden="true"></i>
          <p>Ninguna cuenta coincide con «${this._escape(this._filtros.texto || 'los filtros elegidos')}».</p>
          <button class="btn-primary-soft" type="button" data-admin-action="clear-filters">
            <i class="ri-filter-off-line" aria-hidden="true"></i> Limpiar filtros
          </button>
        </div>`;
      return;
    }

    const activeAdmins = entries.filter(([, profile]) => profile.active === true && (profile.role === 'admin' || profile.role === 'global')).length;
    /* Aviso de arranque: sin ningún Global activo, el admin del centro
       puede conceder el rol Global una vez (desde el selector). */
    const hayGlobal = entries.some(([, profile]) => profile && profile.role === 'global' && profile.active === true);
    const aviso = !hayGlobal
      ? `<div class="admin-aviso-global"><i class="ri-key-2-line" aria-hidden="true"></i> Aún no existe un <strong>Administrador Global</strong>. Como administrador del centro, elige a la persona correcta en la columna «Rol» y selecciona <strong>Administrador Global</strong> para designarla. Este permiso de designación se cerrará en cuanto exista un Global activo.</div>`
      : '';
    container.innerHTML = `
      ${aviso}
      <div class="admin-users-table-wrap">
        <table class="admin-users-table">
          <thead><tr><th>Usuario</th><th>Rol y permisos</th><th>Centro y acciones</th></tr></thead>
          <tbody>
            ${filtrados.map(([uid, profile]) => this._renderUserRow(uid, profile, activeAdmins)).join('')}
          </tbody>
        </table>
      </div>`;
  },

  /* Contadores de la cabecera y resumen del panel de cuentas. */
  _actualizarResumen(entries) {
    const lista = Array.isArray(entries) ? entries : [];
    const cuentas = lista.length;
    const activas = lista.filter(([, profile]) => profile && profile.active === true).length;
    const docentes = lista.filter(([, profile]) => profile && profile.role !== 'admin' && profile.role !== 'global').length;
    const admins = lista.filter(([, profile]) => profile && (profile.role === 'admin' || profile.role === 'global')).length;
    const centros = Object.values(this.centers || {})
      .filter(center => center && center.active !== false).length;
    const poner = (clave, valor) => {
      const celda = document.querySelector?.(`[data-admin-stat="${clave}"]`);
      if (celda) celda.textContent = String(valor);
      const tarjeta = document.querySelector?.(`[data-admin-kpi="${clave}"]`);
      if (tarjeta) tarjeta.textContent = String(valor);
    };
    poner('cuentas', cuentas);
    poner('activas', activas);
    poner('docentes', docentes);
    poner('admins', admins);
    poner('centros', centros);
    const pieActivas = document.querySelector?.('[data-admin-kpi-pie="activas"]');
    if (pieActivas) {
      pieActivas.textContent = cuentas
        ? `${Math.round((activas / cuentas) * 100)}% del total de cuentas`
        : 'Todavía no hay cuentas';
    }
    const resumen = document.querySelector?.('[data-admin-summary]');
    if (resumen) {
      resumen.textContent = `${cuentas} cuenta${cuentas === 1 ? '' : 's'} · ${activas} activa${activas === 1 ? '' : 's'} · ${centros} centro${centros === 1 ? '' : 's'}.`;
    }
  },

  /* «En línea» y última vez que el usuario inició sesión. */
  _ultimaSesionTexto(session) {
    if (!session || !session.lastSignInAt) return 'Último acceso: sin registros todavía';
    return `Último acceso: ${this._haceCuanto(Number(session.lastSignInAt))}`;
  },

  _haceCuanto(timestamp) {
    const value = Number(timestamp);
    if (!Number.isFinite(value)) return 'recientemente';
    const diff = Date.now() - value;
    if (diff < 0) return 'recientemente';
    const minutos = Math.floor(diff / 60000);
    if (minutos < 1) return 'ahora mismo';
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias} día${dias === 1 ? '' : 's'}`;
  },

  _renderUserRow(uid, profile, activeAdmins) {
    const safeUid = this._escape(uid);
    const role = profile.role || 'docente'; /* global | admin | docente | invitado */
    const isAdminish = role === 'admin' || role === 'global';
    const isCurrentUser = uid === AuthManager.user?.uid;
    const isOnlyActiveAdmin = isAdminish && profile.active === true && activeAdmins <= 1;
    const roleDisabled = isCurrentUser || isOnlyActiveAdmin;
    const statusText = profile.active === true ? 'Activa' : 'Inactiva';
    const email = profile.email || 'Correo no registrado en el perfil';
    const staff = this.staffProfiles[uid] || {};
    const session = this.userSessions[uid] || {};
    const staffName = [staff.firstName, staff.lastName].filter(Boolean).join(' ').trim();
    const name = staffName || profile.displayName || email || uid;
    const centerId = profile.centerId || '';
    const area = staff.area || 'general';
    const resumenRol = typeof Permisos !== 'undefined' ? Permisos.resumenRol(role) : '';
    const iniciales = name.split(/\s+/).slice(0, 2).map(parte => parte.charAt(0))
      .join('').toLocaleUpperCase('es') || '?';
    /* En la fila, el selector de centro ofrece todos los centros SOLO
       al Administrador Global; el admin local ve el nombre del suyo. */
    const listaCentros = AuthManager.profile?.role === 'global'
      ? Object.entries(this.centers).filter(([, center]) => center.active !== false)
      : Object.entries(this.centers).filter(([id, center]) => id === (AuthManager.profile?.centerId || '') && center.active !== false);
    const centers = (listaCentros.length ? listaCentros : Object.entries(this.centers).filter(([id]) => id === centerId))
      .sort((left, right) => String(left[1].name).localeCompare(String(right[1].name), 'es'))
      .map(([id, center]) => `<option value="${this._escape(id)}"${id === centerId ? ' selected' : ''}>${this._escape(center.name)}</option>`)
      .join('');
    return `
      <tr data-user-row data-uid="${safeUid}">
        <td class="admin-cell-user">
          <div class="admin-user-cell">
            <span class="admin-avatar ${isAdminish ? 'admin' : (role === 'invitado' ? 'invitado' : 'docente')}" aria-hidden="true">${this._escape(iniciales)}</span>
            <span class="admin-user-copy">
              <span class="admin-user-name">${this._escape(name)}${isCurrentUser ? '<span class="admin-you">tú</span>' : ''}</span>
              <span class="admin-user-email">${this._escape(email)}</span>
              <span class="admin-rol-badge${role === 'global' ? ' es-global' : (isAdminish ? ' es-admin' : '')}">${role === 'global' ? 'Administrador Global' : (role === 'admin' ? 'Administrador' : (role === 'invitado' ? 'Invitado' : 'Docente'))}</span>
              <span class="admin-user-uid" title="Identificador de la cuenta: ${safeUid}">UID: ${safeUid}</span>
            </span>
          </div>
        </td>
        <td class="admin-cell-role">
          <div class="admin-user-actions">
            <select aria-label="Rol de ${this._escape(name)}" data-user-role ${roleDisabled ? 'disabled' : ''} onchange="AdminManager.actualizarPistaRol(this)">
              <option value="docente"${role === 'docente' ? ' selected' : ''}>Docente</option>
              <option value="invitado"${role === 'invitado' ? ' selected' : ''}>Invitado (solo lectura)</option>
              <option value="admin"${role === 'admin' ? ' selected' : ''}>Administrador</option>
              <option value="global"${role === 'global' ? ' selected' : ''}>Administrador Global</option>
            </select>
            ${roleDisabled ? '' : `<button class="btn-primary-soft" type="button" data-admin-action="save-role" data-uid="${safeUid}"><i class="ri-check-line" aria-hidden="true"></i> Guardar</button>`}
          </div>
          <div class="admin-badges">
            <span class="admin-user-status${profile.active === true ? '' : ' is-inactive'}">${statusText}</span>
            <span class="admin-area-chip">${this._escape(AuthManager.getAreaLabel(area))}</span>
            <span class="admin-online-badge${session.online === true ? ' is-online' : ''}"><i class="ri-checkbox-circle-fill" aria-hidden="true"></i> ${session.online === true ? 'En línea' : 'Desconectado'}</span>
          </div>
          <span class="admin-role-hint" data-role-hint title="${this._escape(resumenRol)}">${this._escape(resumenRol)}</span>
          <span class="admin-last-session" title="Último inicio de sesión">${this._escape(this._ultimaSesionTexto(session))}</span>
        </td>
        <td class="admin-cell-actions">
          <div class="admin-center-row">
            <select aria-label="Centro de ${this._escape(name)}" data-user-center ${isCurrentUser ? 'disabled' : ''}>
              <option value=""${centerId ? '' : ' selected'} disabled>Seleccionar centro</option>${centers}
            </select>
            ${isCurrentUser ? '' : `<button class="btn-primary-soft" type="button" data-admin-action="assign-center" data-uid="${safeUid}"><i class="ri-map-pin-line" aria-hidden="true"></i> Asignar</button>`}
          </div>
          <div class="admin-user-actions">
            <button class="btn-primary-soft" type="button" data-admin-action="edit-profile" data-uid="${safeUid}"><i class="ri-pencil-line" aria-hidden="true"></i> Editar datos</button>
            ${isCurrentUser || isOnlyActiveAdmin ? '' : `<button class="btn-primary-soft${profile.active === true ? ' is-danger' : ' is-success'}" type="button" data-admin-action="toggle-active" data-uid="${safeUid}">${profile.active === true ? '<i class="ri-user-unfollow-line" aria-hidden="true"></i> Desactivar' : '<i class="ri-user-follow-line" aria-hidden="true"></i> Activar'}</button>`}
            <button class="btn-primary-soft" type="button" data-admin-action="change-password" data-uid="${safeUid}"><i class="ri-lock-password-line" aria-hidden="true"></i> Contraseña</button>
            <button class="btn-primary-soft" type="button" data-admin-action="reset-password" data-uid="${safeUid}"><i class="ri-mail-send-line" aria-hidden="true"></i> Recuperación</button>
          </div>
        </td>
      </tr>`;
  },

  /* Deja la línea que explica qué implica cada rol al día mientras se
     elige (antes de pulsar «Guardar rol»). */
  actualizarPistaRol(select) {
    const acciones = select && select.parentElement ? select.parentElement : null;
    const celda = acciones && acciones.parentElement ? acciones.parentElement : null;
    const pista = celda ? celda.querySelector('[data-role-hint]') : null;
    if (pista && typeof Permisos !== 'undefined') {
      pista.textContent = Permisos.resumenRol(select.value);
      pista.title = pista.textContent;
    }
  },

  async _getSecondaryAuth() {
    this._requireAdmin();
    const appName = 'inatec-admin-user-provisioning';
    const app = firebase.apps.find(item => item.name === appName) ||
      firebase.initializeApp(window.FirebaseServices.app.options, appName);
    const auth = firebase.auth(app);
    await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
    return auth;
  },

  _generateTemporaryPassword() {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  async createCenter(form) {
    try {
      this._requireAdmin();
      const values = new FormData(form);
      const name = String(values.get('centerName') || '').trim();
      const id = String(values.get('centerCode') || '').trim().toLowerCase();
      if (!name || !/^[a-z0-9_-]{3,60}$/.test(id)) {
        throw new Error('Usa un nombre y un identificador de 3 a 60 caracteres (letras, números, guion o guion bajo).');
      }
      if (this.centers[id]) throw new Error('Ya existe un centro con ese identificador.');
      const reference = window.FirebaseServices.database.ref(`centers/${id}`);
      const existing = await reference.once('value');
      if (existing.exists()) throw new Error('Ya existe información con ese identificador.');
      const emptyData = DataEngine._serializeDatabase({ version: '1.0', grupos: [], equipos: [] });
      await reference.set({
        metadata: { id, name, active: true, createdAt: new Date().toISOString() },
        appData: { ...emptyData, updatedBy: AuthManager.user.uid }
      });
      this.centers[id] = { id, name, active: true };
      form.reset();
      UI.showToast(`✅ Centro «${name}» creado.`);
      await this.cargarUsuarios();
    } catch (error) {
      console.error('No se pudo crear el centro tecnológico:', error);
      UI.showToast(`❌ No se pudo crear el centro: ${error.message}`);
    }
  },

  async assignCenter(uid, centerId) {
    try {
      this._requireAdmin();
      /* Asignar cuentas entre centros es exclusivo del Administrador Global;
         el administrador local solo ve (y nunca mueve) las de su centro. */
      if (AuthManager.profile?.role !== 'global') {
        throw new Error('Solo el Administrador Global puede asignar centros a otras cuentas.');
      }
      if (uid === AuthManager.user?.uid) throw new Error('No puedes cambiar tu propio centro desde esta lista.');
      this._getTargetProfile(uid);
      if (!this.centers[centerId] || this.centers[centerId].active === false) {
        throw new Error('Selecciona un centro activo.');
      }
      const centerSnapshot = await window.FirebaseServices.database.ref(`centers/${centerId}/appData`).once('value');
      if (!centerSnapshot.exists()) throw new Error('El centro no tiene su espacio de datos preparado.');
      await window.FirebaseServices.database.ref(`users/${uid}`).update({ centerId });
      UI.showToast(`✅ Usuario asignado a ${this.centers[centerId].name}.`);
      await this.cargarUsuarios();
    } catch (error) {
      console.error('No se pudo asignar el centro al usuario:', error);
      UI.showToast(`❌ No se pudo asignar el centro: ${error.message}`);
    }
  },

  async switchCenter(idSolicitado) {
    try {
      this._requireAdmin();
      const centerId = idSolicitado || document.getElementById('admin-active-center')?.value;
      if (!this.centers[centerId] || this.centers[centerId].active === false) {
        throw new Error('Selecciona un centro activo.');
      }
      /* Alcance: el administrador del centro SOLO opera su centro
         asignado; abrir otro espacio es exclusivo del Administrador
         Global (que no pertenece a uno solo). */
      if (AuthManager.profile?.role !== 'global') {
        if (centerId !== AuthManager.profile?.centerId) {
          throw new Error('Como Administrador solo puedes operar tu propio centro. Abrir otro centro es del Administrador Global.');
        }
      } else {
        try { localStorage.setItem('tic-centro-activo', centerId); } catch (_) { }
      }
      AuthManager.activeCenterId = centerId;
      AuthManager.profile.centerName = this.centers[centerId].name;
      DataEngine._listeners.forEach(({ reference, event, callback }) => reference.off(event, callback));
      DataEngine._listeners = [];
      await DataEngine.init();
      const centerLabel = document.getElementById('current-user-center');
      if (centerLabel) centerLabel.textContent = this.centers[centerId].name;
      const sidebarCenterName = document.getElementById('sidebar-center-name');
      if (sidebarCenterName) sidebarCenterName.textContent = this.centers[centerId].name;
      const loadingCenterName = document.getElementById('loading-center-name');
      if (loadingCenterName) loadingCenterName.textContent = this.centers[centerId].name;
      document.title = `INATEC | ${this.centers[centerId].name} | Cuaderno Docente`;
      UI.irA('dashboard');
      UI.showToast(`✅ Centro activo: ${this.centers[centerId].name}.`);
    } catch (error) {
      console.error('No se pudo cambiar el centro operativo:', error);
      UI.showToast(`❌ No se pudo abrir el centro: ${error.message}`);
    }
  },

  async createUser(form) {
    const submitButton = form.querySelector('[data-admin-submit]');
    if (submitButton?.disabled) return;
    const formData = new FormData(form);
    const displayName = String(formData.get('displayName') || '').trim();
    const nameParts = displayName.split(/\s+/);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const role = String(formData.get('role') || '');
    const centerId = String(formData.get('centerId') || '');
    const area = String(formData.get('area') || '');
    if (!displayName || !email || !['admin', 'docente', 'invitado'].includes(role) ||
      !['general', 'ingles', 'tic', 'otra'].includes(area) || !this.centers[centerId]) {
      UI.showToast('❌ Completa los datos, selecciona un área y asigna un centro activo.');
      return;
    }
    /* Contraseña manual opcional: si el administrador la escribe, la cuenta
       nace con esa contraseña y no se envía correo de acceso. */
    const passwordManual = String(formData.get('password') || '');
    let passwordCuenta = '';
    try {
      passwordCuenta = passwordManual
        ? this._validarNuevaContrasena(passwordManual, passwordManual)
        : '';
    } catch (passwordError) {
      UI.showToast(`❌ ${passwordError.message}`);
      return;
    }

    if (submitButton) submitButton.disabled = true;
    let secondaryAuth;
    let newUser = null;
    let profileSaved = false;
    try {
      this._requireAdmin();
      secondaryAuth = await this._getSecondaryAuth();
      const credential = await secondaryAuth.createUserWithEmailAndPassword(
        email,
        passwordCuenta || this._generateTemporaryPassword()
      );
      newUser = credential.user;
      await newUser.updateProfile({ displayName });
      await window.FirebaseServices.database.ref().update({
        [`users/${newUser.uid}`]: {
          active: true,
          displayName,
          email,
          role,
          centerId
        },
        [`staffProfiles/${newUser.uid}`]: {
          firstName,
          lastName,
          phone: '',
          employeeCode: '',
          position: '',
          area,
          specialty: ''
        }
      });
      profileSaved = true;

      if (passwordCuenta) {
        UI.showToast(`✅ Cuenta creada para ${email} en ${this.centers[centerId].name}. Contraseña manual: compártela con la persona por un canal confiable.`);
      } else {
        try {
          await secondaryAuth.sendPasswordResetEmail(email);
          UI.showToast(`✅ Cuenta creada para ${email} en ${this.centers[centerId].name}. Se envió un correo para establecer su contraseña.`);
        } catch (emailError) {
          console.error('Se creó la cuenta, pero no se pudo enviar el correo de acceso:', emailError);
          UI.showToast(`⚠️ La cuenta se creó, pero no se pudo enviar el correo: ${emailError.message}. Usa «Enviar recuperación» para reintentarlo.`);
        }
      }
      form.reset();
      if (typeof Mejoras !== 'undefined' && Mejoras.registrarEvento) {
        Mejoras.registrarEvento({
          tipo: 'cambio', titulo: 'Cuenta creada',
          texto: `${firstName} ${lastName} (${email}) en ${this.centers[centerId].name}.`,
          afectado: `${firstName} ${lastName}`.trim(),
          detalle: `Área: ${area}`,
          seccion: 'administracion', clave: `cuenta-${email}`
        });
      }
      await this.cargarUsuarios();
    } catch (error) {
      if (newUser && !profileSaved) {
        await newUser.delete().catch(cleanupError => {
          console.error('No se pudo eliminar una cuenta sin perfil durante la reversión:', cleanupError);
        });
      }
      console.error('No se pudo crear la cuenta docente:', error);
      UI.showToast(`❌ No se pudo crear la cuenta: ${error.message}`);
    } finally {
      if (secondaryAuth?.currentUser) {
        await secondaryAuth.signOut().catch(error => console.error('No se pudo cerrar la sesión temporal de creación:', error));
      }
      if (submitButton) submitButton.disabled = false;
    }
  },

  _getTargetProfile(uid) {
    this._requireAdmin();
    if (!uid || !Object.prototype.hasOwnProperty.call(this.users, uid)) {
      throw new Error('No se encontró el perfil seleccionado. Actualiza la lista.');
    }
    return this.users[uid];
  },

  openStaffProfile(uid) {
    try {
      this._requireAdmin();
      const account = this._getTargetProfile(uid);
      const stored = this.staffProfiles[uid] || {};
      const nameParts = String(account.displayName || '').trim().split(/\s+/);
      const values = {
        firstName: stored.firstName || nameParts.shift() || '',
        lastName: stored.lastName || nameParts.join(' '),
        phone: stored.phone || '',
        employeeCode: stored.employeeCode || '',
        position: stored.position || '',
        area: stored.area || 'general',
        specialty: stored.specialty || ''
      };
      const form = document.getElementById('admin-edit-profile-form');
      if (!form) throw new Error('No se encontró el formulario de perfil institucional.');
      Object.entries(values).forEach(([key, value]) => {
        const field = form.elements.namedItem(key);
        if (field) field.value = value;
      });
      form.elements.namedItem('uid').value = uid;
      document.getElementById('admin-profile-modal').hidden = false;
    } catch (error) {
      console.error('No se pudo abrir el perfil institucional:', error);
      UI.showToast(`❌ No se pudo abrir el perfil: ${error.message}`);
    }
  },

  closeStaffProfile() {
    const modal = document.getElementById('admin-profile-modal');
    if (modal) modal.hidden = true;
  },

  async saveStaffProfile(form) {
    try {
      this._requireAdmin();
      const values = new FormData(form);
      const uid = String(values.get('uid') || '');
      this._getTargetProfile(uid);
      const profile = {
        firstName: String(values.get('firstName') || '').trim(),
        lastName: String(values.get('lastName') || '').trim(),
        phone: String(values.get('phone') || '').trim(),
        employeeCode: String(values.get('employeeCode') || '').trim(),
        position: String(values.get('position') || '').trim(),
        area: String(values.get('area') || ''),
        specialty: String(values.get('specialty') || '').trim()
      };
      if (!profile.firstName || !profile.lastName ||
        !['general', 'ingles', 'tic', 'otra'].includes(profile.area)) {
        throw new Error('Completa nombres, apellidos y un área docente válida.');
      }
      /* Se mezcla con lo ya guardado para no borrar campos que este
         formulario no edita (foto, biografía, horario…). */
      const guardado = this.staffProfiles[uid] || {};
      const perfilCompleto = { ...guardado, ...profile };
      await window.FirebaseServices.database.ref(`staffProfiles/${uid}`).set(perfilCompleto);
      this.staffProfiles[uid] = perfilCompleto;
      this.closeStaffProfile();
      const list = document.getElementById('admin-users-list');
      if (list) this._renderUsers(list);
      UI.showToast('✅ Datos institucionales actualizados.');
    } catch (error) {
      console.error('No se pudo guardar el perfil institucional:', error);
      UI.showToast(`❌ No se pudieron guardar los datos institucionales: ${error.message}`);
    }
  },

  _preventLockout(uid, profile, nextActive, nextRole) {
    if (uid === AuthManager.user?.uid && (nextActive === false || nextRole && nextRole !== AuthManager.profile?.role)) {
      throw new Error('No puedes desactivar tu propia cuenta ni modificarte tu propio rol.');
    }
    const roleActual = profile.role || '';
    const esAdminish = roleActual === 'admin' || roleActual === 'global';
    const removesActiveAdmin = esAdminish && profile.active === true &&
      (nextActive === false || nextRole && nextRole !== roleActual);
    const activeAdminCount = Object.values(this.users)
      .filter(user => user?.active === true && (user.role === 'admin' || user.role === 'global')).length;
    if (removesActiveAdmin && activeAdminCount <= 1) {
      throw new Error('No puedes desactivar ni cambiar el rol del último administrador activo.');
    }
  },

  async updateRole(uid, role) {
    try {
      const profile = this._getTargetProfile(uid);
      /* ARRANQUE: mientras no exista ningún Administrador Global activo,
         el admin del centro puede conceder ese rol una vez (el primer
         Global). Después, solo el Global gestiona cuentas. */
      const hayGlobal = Object.values(this.users || {})
        .some(user => user && user.role === 'global' && user.active === true);
      if (!hayGlobal && AuthManager.profile?.role === 'admin') {
        if (role !== 'global') throw new Error('Sin Administrador Global activo: el único cambio permitido es conceder ese rol.');
      } else if (typeof Permisos !== 'undefined' && !Permisos.exigir('gestionarUsuarios')) {
        throw new Error('Solo el Administrador Global gestiona cuentas.');
      }
      if (role === 'global' && AuthManager.profile?.role !== 'global' && hayGlobal) throw new Error('Solo el Administrador Global puede conceder ese rol.');
      if (!['global', 'admin', 'docente', 'invitado'].includes(role)) throw new Error('El rol seleccionado no es válido.');
      this._preventLockout(uid, profile, undefined, role);
      await window.FirebaseServices.database.ref(`users/${uid}`).update({ role });
      UI.showToast('✅ Rol actualizado.');
      if (typeof Mejoras !== 'undefined' && Mejoras.registrarEvento) {
        Mejoras.registrarEvento({
          tipo: 'cambio', titulo: 'Rol de cuenta actualizado',
          texto: `${profile.displayName || profile.email || uid}: ahora es ${role === 'global' ? 'administrador global' : (role === 'admin' ? 'administrador' : (role === 'invitado' ? 'invitado' : 'docente'))}.`,
          afectado: profile.displayName || profile.email || uid,
          detalle: `Rol anterior: ${profile.role || 'sin rol'}`,
          seccion: 'administracion', clave: `rol-${uid}`
        });
      }
      await this.cargarUsuarios();
    } catch (error) {
      console.error('No se pudo actualizar el rol:', error);
      UI.showToast(`❌ No se pudo actualizar el rol: ${error.message}`);
    }
  },

  async toggleActive(uid) {
    try {
      const profile = this._getTargetProfile(uid);
      const nextActive = profile.active !== true;
      this._preventLockout(uid, profile, nextActive);
      await window.FirebaseServices.database.ref(`users/${uid}`).update({ active: nextActive });
      UI.showToast(nextActive ? '✅ Cuenta activada.' : '✅ Cuenta desactivada.');
      if (typeof Mejoras !== 'undefined' && Mejoras.registrarEvento) {
        Mejoras.registrarEvento({
          tipo: 'cambio', titulo: nextActive ? 'Cuenta activada' : 'Cuenta desactivada',
          texto: `${profile.displayName || profile.email || uid}: cuenta ${nextActive ? 'activada' : 'desactivada'}.`,
          afectado: profile.displayName || profile.email || uid,
          detalle: `Estado anterior: ${profile.active === true ? 'activa' : 'inactiva'}`,
          seccion: 'administracion', clave: `estado-${uid}`
        });
      }
      await this.cargarUsuarios();
    } catch (error) {
      console.error('No se pudo cambiar el estado de la cuenta:', error);
      UI.showToast(`❌ No se pudo cambiar el estado: ${error.message}`);
    }
  },

  /* Devuelve el correo de la cuenta; si no existe, pide escribirlo y lo
     guarda en el perfil. Devuelve cadena vacía si se cancela. */
  async _asegurarCorreo(uid, profile) {
    let email = String(profile.email || (uid === AuthManager.user?.uid ? AuthManager.user.email : '') || '').trim();
    if (email) return email;
    email = String(window.prompt('Este perfil no tiene correo guardado. Escribe el correo de su cuenta Firebase:') || '').trim().toLowerCase();
    if (!email) return '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('El correo escrito no tiene un formato válido.');
    }
    await window.FirebaseServices.database.ref(`users/${uid}`).update({ email });
    profile.email = email;
    return email;
  },

  async sendPasswordReset(uid) {
    try {
      const profile = this._getTargetProfile(uid);
      const email = await this._asegurarCorreo(uid, profile);
      if (!email) return;
      const actionCodeSettings = { url: `${window.location.origin}/`, handleCodeInApp: false };
     try {
       await window.FirebaseServices.auth.sendPasswordResetEmail(email, actionCodeSettings);
     } catch (settingsError) {
       await window.FirebaseServices.auth.sendPasswordResetEmail(email);
     }
      UI.showToast(`✅ Se envió un correo de recuperación a ${email}.`);
    } catch (error) {
      console.error('No se pudo enviar el correo de recuperación:', error);
      UI.showToast(`❌ No se pudo enviar el correo de recuperación: ${error.message}`);
    }
  },

  /* Cambio manual de contraseña. El navegador no puede actualizar la
     contraseña de otra cuenta directamente (Firebase solo permite cambiar la
     propia), así que se abre una sesión secundaria temporal —con la
     contraseña actual que conoce el administrador—, se actualiza y se cierra
     sin tocar la sesión del panel. Todo ocurre en el navegador: no requiere
     plan de pago ni funciones de servidor. */
  openPasswordModal(uid) {
    try {
      this._requireAdmin();
      const profile = this._getTargetProfile(uid);
      const form = document.getElementById('admin-change-password-form');
      if (!form) throw new Error('No se encontró el formulario para cambiar la contraseña.');
      const destino = profile.displayName || profile.email || uid;
      const etiqueta = document.querySelector?.('[data-password-user]');
      if (etiqueta) {
        etiqueta.textContent = `Escribe la contraseña actual de ${destino} (${profile.email || 'sin correo registrado'}) y después la nueva. Dejará de usar la anterior en su próximo inicio de sesión.`;
      }
      form.reset();
      form.elements.namedItem('uid').value = uid;
      const recuperacion = form.querySelector('[data-admin-action="reset-password"]');
      if (recuperacion) recuperacion.dataset.uid = uid;
      const modal = document.getElementById('admin-password-modal');
      modal.hidden = false;
      document.getElementById('admin-change-password-current')?.focus();
    } catch (error) {
      console.error('No se pudo abrir el cambio de contraseña:', error);
      UI.showToast(`❌ No se pudo abrir el formulario: ${error.message}`);
    }
  },

  closePasswordModal() {
    const modal = document.getElementById('admin-password-modal');
    if (modal) modal.hidden = true;
    const form = document.getElementById('admin-change-password-form');
    if (form) form.reset();
  },

  /* Política de contraseña: 8 a 128 caracteres sin espacios. */
  _validarNuevaContrasena(password, confirmPassword) {
    const value = String(password ?? '');
    if (value.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    if (value.length > 128) throw new Error('La contraseña no puede superar los 128 caracteres.');
    if (/\s/.test(value)) throw new Error('La contraseña no debe contener espacios.');
    if (value !== String(confirmPassword ?? '')) throw new Error('Las contraseñas no coinciden.');
    return value;
  },

  _alternarVisibilidadCampo(button) {
    const input = button?.parentElement?.querySelector('input');
    if (!input) return;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    const icono = button.querySelector('i');
    if (icono) icono.className = visible ? 'ri-eye-line' : 'ri-eye-off-line';
    button.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
    button.title = button.getAttribute('aria-label');
  },

  _describirErrorCambioContrasena(error) {
    const messages = {
      'auth/wrong-password': 'La contraseña actual no coincide con la de esa cuenta.',
      'auth/invalid-credential': 'La contraseña actual no coincide con la de esa cuenta.',
      'auth/invalid-login-credentials': 'La contraseña actual no coincide con la de esa cuenta.',
      'auth/user-not-found': 'No existe una cuenta de Firebase Authentication con ese correo.',
      'auth/invalid-email': 'El correo de la cuenta no tiene un formato válido.',
      'auth/user-disabled': 'La cuenta está deshabilitada en Firebase Authentication.',
      'auth/too-many-requests': 'Se bloquearon temporalmente los intentos. Espera un momento y vuelve a intentarlo.',
      'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.',
      'auth/requires-recent-login': 'Firebase pidió verificar la sesión otra vez. Cierra el formulario e inténtalo de nuevo.',
      'auth/operation-not-allowed': 'El administrador debe habilitar el acceso con correo y contraseña en Firebase Authentication.'
    };
    return messages[error?.code] || error?.message || 'No se pudo cambiar la contraseña.';
  },

  /* Abre una sesión temporal (persistencia NONE) como la cuenta destino,
     actualiza la contraseña y cierra la sesión. La sesión del administrador
     en el panel no se ve afectada. */
  async _updatePasswordAsUser(email, currentPassword, newPassword) {
    this._requireAdmin();
    const services = window.FirebaseServices;
    const appName = 'inatec-admin-password-change';
    const app = firebase.apps.find(item => item.name === appName) ||
      firebase.initializeApp(services.app.options, appName);
    const auth = firebase.auth(app);
    await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
    try {
      const credential = await auth.signInWithEmailAndPassword(email, currentPassword);
      await credential.user.updatePassword(newPassword);
    } catch (error) {
      console.error('No se pudo actualizar la contraseña con la sesión temporal:', error);
      throw new Error(this._describirErrorCambioContrasena(error));
    } finally {
      await auth.signOut().catch(signOutError => {
        console.error('No se pudo cerrar la sesión temporal de cambio de contraseña:', signOutError);
      });
    }
  },

  async changePassword(form) {
    const submitButton = form.querySelector('[data-password-submit]');
    if (submitButton?.disabled) return;
    const values = new FormData(form);
    const uid = String(values.get('uid') || '');
    if (submitButton) submitButton.disabled = true;
    try {
      this._requireAdmin();
      const profile = this._getTargetProfile(uid);
      const actual = String(values.get('currentPassword') || '');
      if (!actual) throw new Error('Escribe la contraseña actual de la cuenta para poder cambiarla.');
      const password = this._validarNuevaContrasena(values.get('password'), values.get('confirmPassword'));
      const email = await this._asegurarCorreo(uid, profile);
      if (!email) throw new Error('La cuenta no tiene correo guardado; escribe uno para continuar.');
      await this._updatePasswordAsUser(email, actual, password);
      const destino = profile.displayName || profile.email || uid;
      this.closePasswordModal();
      UI.showToast(`✅ Contraseña actualizada para ${destino}. Avísale para que la use en su próximo acceso.`);
      if (typeof Mejoras !== 'undefined' && Mejoras.registrarEvento) {
        Mejoras.registrarEvento({
          tipo: 'cambio', titulo: 'Contraseña actualizada',
          texto: `El administrador cambió manualmente la contraseña de ${destino}.`,
          afectado: destino,
          detalle: 'Debe usar la nueva contraseña en su próximo inicio de sesión.',
          seccion: 'administracion', clave: `contrasena-${uid}`
        });
      }
    } catch (error) {
      console.error('No se pudo cambiar la contraseña:', error);
      UI.showToast(`❌ No se pudo cambiar la contraseña: ${error.message}`);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }
};
