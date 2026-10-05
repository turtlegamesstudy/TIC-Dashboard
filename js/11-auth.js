'use strict';

const AuthManager = {
  user: null,
  profile: null,
  staffProfile: null,
  activeCenterId: null,
  _activatingUid: null,
  _activation: null,
  _notice: '',

  async init() {
    const services = window.FirebaseServices;
    if (!services || services.error || !services.auth || !services.database) {
      this.showLogin(services?.error?.message || 'No se pudo conectar con Firebase. Recarga la página o contacta al administrador.');
      return;
    }

    this.bindEvents();
    try {
      await services.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (error) {
      console.error('No se pudo configurar la sesión de Firebase:', error);
      this.showLogin('No se pudo preparar la sesión segura. Verifica que el sitio esté publicado mediante HTTPS.');
      return;
    }

    services.auth.onAuthStateChanged(
      user => {
        if (user) {
          this.activate(user);
        } else {
          this.user = null;
          this.profile = null;
          this.staffProfile = null;
          this.activeCenterId = null;
          this._activatingUid = null;
          this._activation = null;
          this.showLogin(this._notice);
        }
      },
      error => {
        console.error('Error al comprobar la sesión de Firebase:', error);
        this.showLogin(this.describeError(error));
      }
    );
  },

  bindEvents() {
    document.getElementById('auth-login-form')?.addEventListener('submit', event => this.signIn(event));
    document.getElementById('auth-reset')?.addEventListener('click', () => this.resetPassword());
  },

  async activate(user) {
    if (this._activatingUid === user.uid && this._activation) return this._activation;
    this._activatingUid = user.uid;
    this._activation = this._activateUser(user);
    try {
      await this._activation;
    } finally {
      if (this._activatingUid === user.uid) {
        this._activatingUid = null;
        this._activation = null;
      }
    }
  },

  async _activateUser(user) {
    const services = window.FirebaseServices;
    this.showLoading('Verificando acceso...');
    try {
      const snapshot = await services.database.ref(`users/${user.uid}`).once('value');
      const profile = snapshot.val();
      if (!profile || profile.active !== true || !['admin', 'docente'].includes(profile.role)) {
        this._notice = 'La cuenta no está habilitada para este panel. Solicita acceso al administrador.';
        await services.auth.signOut();
        this.showLogin(this._notice);
        return;
      }

      await DataEngine.prepareAccount(profile, user, services.database);
      this.user = user;
      this.profile = profile;
      this.activeCenterId = profile.centerId;
      const staffSnapshot = await services.database.ref(`staffProfiles/${user.uid}`).once('value');
      this.staffProfile = {
        firstName: '',
        lastName: '',
        phone: '',
        employeeCode: '',
        position: '',
        area: 'general',
        specialty: '',
        ...(staffSnapshot.val() || {})
      };
      this._notice = '';
      const appContainer = document.getElementById('app-container');
      const authScreen = document.getElementById('auth-screen');
      appContainer.hidden = false;
      appContainer.inert = false;
      appContainer.setAttribute('aria-hidden', 'false');
      authScreen.hidden = true;
      document.body.classList.add('is-authenticated');
      document.body.classList.remove('auth-required');

      const profileName = [this.staffProfile.firstName, this.staffProfile.lastName].filter(Boolean).join(' ').trim();
      const displayName = String(profileName || profile.displayName || user.displayName || user.email || 'Docente');
      document.getElementById('current-user-name').textContent = displayName;
      document.getElementById('current-user-role').textContent = profile.role === 'admin'
        ? 'Administrador global'
        : this.getAreaLabel(this.staffProfile.area);
      const centerName = document.getElementById('current-user-center');
      if (centerName) centerName.textContent = this.getActiveCenterName();
      const sidebarCenterName = document.getElementById('sidebar-center-name');
      if (sidebarCenterName) sidebarCenterName.textContent = this.getActiveCenterName();
      const loadingCenterName = document.getElementById('loading-center-name');
      if (loadingCenterName) loadingCenterName.textContent = this.getActiveCenterName();
      document.title = `INATEC | ${this.getActiveCenterName()} | Cuaderno Docente`;
      document.querySelector('.avatar').textContent = displayName.trim().charAt(0).toLocaleUpperCase('es');
      const importTrigger = document.getElementById('admin-import-trigger');
      if (importTrigger) importTrigger.hidden = profile.role !== 'admin';
      const adminNav = document.getElementById('admin-nav-item');
      const adminNavSection = document.getElementById('admin-nav-section');
      if (adminNav) adminNav.hidden = profile.role !== 'admin';
      if (adminNavSection) adminNavSection.hidden = profile.role !== 'admin';

      await DataEngine.init();
      if (typeof CuadernoEngine !== 'undefined' && CuadernoEngine.inicializarSelectoresExportacion) {
        CuadernoEngine.inicializarSelectoresExportacion();
      }
      UI.init();
      if (DataEngine._migrationNotice) {
        UI.showToast(`ℹ️ ${DataEngine._migrationNotice}`);
        DataEngine._migrationNotice = '';
      }
      try {
        await DataEngine.migrateLegacyAttachments();
      } catch (migrationError) {
        console.error('No se pudieron migrar algunos adjuntos antiguos:', migrationError);
        UI.showToast(`⚠️ No se pudieron migrar algunos adjuntos antiguos a Storage: ${migrationError.message}`);
      }
    } catch (error) {
      console.error('No se pudo abrir la sesión del panel:', error);
      const message = error.code === 'PERMISSION_DENIED'
        ? 'Firebase rechazó el acceso. El administrador debe revisar las reglas y habilitar tu cuenta.'
        : `No se pudo cargar el panel: ${this.describeError(error)}`;
      this._notice = message;
      await services.auth.signOut().catch(signOutError => console.error('No se pudo cerrar la sesión no autorizada:', signOutError));
      this.showLogin(message);
    }
  },

  getAreaLabel(area) {
    return ({
      ingles: 'Docente de Inglés',
      tic: 'Docente TIC',
      general: 'Docente',
      otra: 'Docente'
    })[area] || 'Docente';
  },

  getActiveCenterName() {
    return this.profile?.centerName ||
      (typeof AdminManager !== 'undefined' ? AdminManager.centers?.[this.activeCenterId]?.name : '') ||
      (this.activeCenterId === 'ct-ariel-darce' ? 'Centro Tecnológico Ariel Darce' : 'Centro asignado');
  },

  async signIn(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) {
      this.setMessage('Ingresa tu correo y contraseña.');
      return;
    }

    const button = document.getElementById('auth-submit');
    button.disabled = true;
    button.querySelector('span').textContent = 'Verificando...';
    this.setMessage('');
    try {
      await window.FirebaseServices.auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('No se pudo iniciar sesión:', error);
      this.setMessage(this.describeError(error));
    } finally {
      button.disabled = false;
      button.querySelector('span').textContent = 'Iniciar sesión';
    }
  },

  async resetPassword() {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) {
      this.setMessage('Escribe tu correo para enviarte el enlace de recuperación.');
      document.getElementById('auth-email').focus();
      return;
    }
    try {
      await window.FirebaseServices.auth.sendPasswordResetEmail(email);
      this.setMessage('Si la cuenta existe, recibirás un correo para restablecer la contraseña.', 'success');
    } catch (error) {
      console.error('No se pudo solicitar el restablecimiento:', error);
      this.setMessage(this.describeError(error));
    }
  },

  async signOut() {
    try {
      this.showLoading('Cerrando sesión...');
      await window.FirebaseServices.auth.signOut();
    } catch (error) {
      console.error('No se pudo cerrar la sesión:', error);
      UI.showToast(`No se pudo cerrar la sesión: ${this.describeError(error)}`);
      document.getElementById('app-loading')?.classList.add('is-hidden');
    }
  },

  showLogin(message = '') {
    const appContainer = document.getElementById('app-container');
    const authScreen = document.getElementById('auth-screen');
    if (!appContainer || !authScreen) return;
    appContainer.hidden = true;
    appContainer.inert = true;
    appContainer.setAttribute('aria-hidden', 'true');
    authScreen.hidden = false;
    document.body.classList.remove('is-authenticated');
    document.body.classList.add('auth-required');
    document.getElementById('app-loading')?.classList.add('is-hidden');
    this.setMessage(message);
  },

  showLoading(message) {
    const loading = document.getElementById('app-loading');
    const loadingMessage = document.getElementById('app-loading-message');
    if (!loading) return;
    loading.classList.remove('is-hidden', 'has-error');
    loading.setAttribute('aria-hidden', 'false');
    if (loadingMessage) loadingMessage.textContent = message;
    document.getElementById('auth-screen').hidden = true;
  },

  setMessage(message, kind = 'error') {
    const node = document.getElementById('auth-message');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-success', kind === 'success');
    node.hidden = !message;
  },

  describeError(error) {
    if (error?.code?.includes('api-key-not-valid') || error?.code === 'auth/invalid-api-key') {
      return 'La clave web de Firebase no es válida o está restringida. Verifica la apiKey del proyecto y sus restricciones en Google Cloud.';
    }
    const messages = {
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/user-not-found': 'Correo o contraseña incorrectos.',
      'auth/wrong-password': 'Correo o contraseña incorrectos.',
      'auth/invalid-email': 'El correo electrónico no tiene un formato válido.',
      'auth/user-disabled': 'La cuenta está deshabilitada. Contacta al administrador.',
      'auth/too-many-requests': 'Se bloquearon temporalmente los intentos. Espera un momento y vuelve a intentarlo.',
      'auth/network-request-failed': 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.',
      'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication. Solicita al administrador que lo agregue.',
      'auth/operation-not-allowed': 'El administrador debe habilitar el acceso con correo y contraseña en Firebase Authentication.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.'
    };
    return messages[error?.code] || error?.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }
};
