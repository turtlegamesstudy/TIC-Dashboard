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
    const toggle = document.getElementById('auth-password-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => this.alternarVisibilidadContrasena());
    }
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
      if (!profile) {
        this._notice = 'No se encontró el perfil de esta cuenta. Solicita acceso al administrador.';
        await services.auth.signOut();
        this.showLogin(this._notice);
        return;
      }
      if (profile.active !== true) {
        this._notice = 'La cuenta está desactivada. Solicita al administrador que la active.';
        await services.auth.signOut();
        this.showLogin(this._notice);
        return;
      }
      if (!['global', 'admin', 'docente', 'invitado'].includes(profile.role)) {
        this._notice = `El rol de la cuenta no está habilitado (rol actual: "${profile.role || 'sin rol'}"). Solicita acceso al administrador.`;
        await services.auth.signOut();
        this.showLogin(this._notice);
        return;
      }

      try {
        await DataEngine.prepareAccount(profile, user, services.database);
      } catch (prepareError) {
        const wrapped = new Error(`Preparación de cuenta (${prepareError.code || 'sin código'}): ${prepareError.message || this.describeError(prepareError)}`);
        wrapped.code = prepareError.code;
        throw wrapped;
      }
      this.user = user;
      this.profile = profile;
      /* Centro operativo de la sesión: el Administrador Global no
         pertenece a un centro fijo — elige uno y queda recordado
         en este equipo; los demás roles siempre trabajan el suyo. */
      let centroInicial = profile.centerId || null;
      if (!centroInicial) {
        try { centroInicial = localStorage.getItem('tic-centro-activo') || null; } catch (_) { }
      }
      this.activeCenterId = centroInicial || 'ct-ariel-darce';
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

      /* Presencia y último acceso: se guardan en `userSessions/{uid}` para que
         el panel de administración muestre «En línea» y la última vez que
         cada usuario inició sesión. */
      this._iniciarSeguimientoSesion(user);

      const profileName = [this.staffProfile.firstName, this.staffProfile.lastName].filter(Boolean).join(' ').trim();
      const displayName = String(profileName || profile.displayName || user.displayName || user.email || 'Docente');
      document.getElementById('current-user-name').textContent = displayName;
      const rolElement = document.getElementById('current-user-role');
      if (rolElement) {
        const esAdmin = profile.role === 'admin' || profile.role === 'global';
        const esInvitado = profile.role === 'invitado';
        rolElement.textContent = esAdmin
          ? 'Administrador global'
          : (esInvitado ? 'Invitado (solo lectura)' : this.getAreaLabel(this.staffProfile.area));
        // Insignia de rol: se distingue de un vistazo en la barra superior.
        rolElement.classList.toggle('rol-admin', esAdmin);
        rolElement.classList.toggle('rol-docente', !esAdmin && !esInvitado);
        rolElement.classList.toggle('rol-invitado', esInvitado);
        rolElement.title = typeof Permisos !== 'undefined'
          ? Permisos.resumenRol(profile.role)
          : '';
      }
      const centerName = document.getElementById('current-user-center');
      if (centerName) centerName.textContent = this.getActiveCenterName();
      const sidebarCenterName = document.getElementById('sidebar-center-name');
      if (sidebarCenterName) sidebarCenterName.textContent = this.getActiveCenterName();
      const loadingCenterName = document.getElementById('loading-center-name');
      if (loadingCenterName) loadingCenterName.textContent = this.getActiveCenterName();
      document.title = `INATEC | ${this.getActiveCenterName()} | Cuaderno Docente`;
      const avatarTopbar = document.querySelector('.avatar');
      if (avatarTopbar) avatarTopbar.textContent = displayName.trim().charAt(0).toLocaleUpperCase('es');
      // Foto del perfil institucional en la barra superior (si existe).
      if (typeof ProfileManager !== 'undefined' && ProfileManager.applyAvatar) {
        ProfileManager.applyAvatar();
      }
      // El botón «Cargar DB.json» lleva data-permiso="cargarBase" y lo oculta
      // Permisos.aplicar() (que se ejecuta en UI.init()). El enlace de
      // Administración tampoco se oculta a mano: el menú se genera desde el
      // registro de secciones (js/14-secciones.js) y solo incluye lo que el
      // rol puede ver.

      try {
        await DataEngine.init();
      } catch (initError) {
        const wrapped = new Error(`Carga de datos (${initError.code || 'sin código'}): ${initError.message || this.describeError(initError)}`);
        wrapped.code = initError.code;
        throw wrapped;
      }
      if (typeof CuadernoEngine !== 'undefined' && CuadernoEngine.inicializarSelectoresExportacion) {
        CuadernoEngine.inicializarSelectoresExportacion();
      }
      UI.init();
      if (typeof Permisos !== 'undefined' && typeof Permisos.aplicarModoInvitado === 'function') {
        Permisos.aplicarModoInvitado();
      }
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
      // Espera a que la intro épica termine para revelar el panel listo.
      if (this._intro) {
        try { await this._intro; } finally { this._intro = null; }
      }
    } catch (error) {
      console.error('No se pudo abrir la sesión del panel:', error);
      const message = error.code === 'PERMISSION_DENIED'
          ? `Firebase rechazó el acceso: ${error.message || 'sin detalle'}. El administrador debe revisar las reglas y habilitar tu cuenta.`
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
      // Intro épica INATEC: se reproduce mientras el panel termina de cargar.
      this._intro = (typeof AuthIntro !== 'undefined') ? AuthIntro.play() : null;
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
      const actionCodeSettings = {
        url: `${window.location.origin}/`,
        handleCodeInApp: false
      };
      try {
        await window.FirebaseServices.auth.sendPasswordResetEmail(email, actionCodeSettings);
      } catch (settingsError) {
        await window.FirebaseServices.auth.sendPasswordResetEmail(email);
      }
      this.setMessage('Si la cuenta existe, recibirás un correo para restablecer la contraseña.', 'success');
    } catch (error) {
      console.error('No se pudo solicitar el restablecimiento:', error);
      this.setMessage(this.describeError(error));
    }
  },

  /* Presencia y último acceso por cuenta. Se escribe en `userSessions/{uid}`:
     - `lastSignInAt`: fecha del último inicio de sesión (timestamp del servidor).
     - `online`: true mientras la cuenta tenga una conexión abierta; Firebase la
       pone en false con onDisconnect al cerrar o perder la red. */
  _iniciarSeguimientoSesion(user) {
    try {
      const services = window.FirebaseServices;
      if (!services?.database) return;
      const sessionRef = services.database.ref(`userSessions/${user.uid}`);
      sessionRef.update({
        email: user.email || '',
        displayName: this.profile?.displayName || user.displayName || '',
        lastSignInAt: firebase.database.ServerValue.TIMESTAMP
      }).catch(error => console.error('No se pudo registrar el inicio de sesión:', error));
      sessionRef.child('online').onDisconnect().set(false)
        .catch(error => console.error('No se pudo preparar la desconexión:', error));
      services.database.ref('.info/connected').on('value', snapshot => {
        if (snapshot.val() === true) {
          sessionRef.update({ online: true })
            .catch(error => console.error('No se pudo marcar la conexión:', error));
        }
      });
    } catch (error) {
      console.error('No se pudo preparar la presencia:', error);
    }
  },

  _marcarDesconectado() {
    if (!this.user) return;
    window.FirebaseServices.database.ref(`userSessions/${this.user.uid}/online`).set(false)
      .catch(() => { /* cerrar sesión no debe fallar por la presencia */ });
  },

  async signOut() {
    try {
      this.showLoading('Cerrando sesión...');
      await this._marcarDesconectado();
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
    // Si había una intro épica en curso (fallo de acceso), se descarta.
    if (typeof AuthIntro !== 'undefined') AuthIntro.finish();
    this._intro = null;
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
    const loadingCaption = document.getElementById('app-loading-caption');
    if (!loading) return;
    const contexto = (typeof UI !== 'undefined' && typeof UI.contextoCarga === 'function')
      ? UI.contextoCarga(message, 'sesion')
      : { id: 'sesion', etiqueta: 'Verificando acceso', pie: 'Validando tu cuenta y tus permisos de docente.' };
    loading.classList.remove('is-hidden', 'has-error');
    loading.setAttribute('aria-hidden', 'false');
    loading.setAttribute('data-modo', contexto.id);
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingCaption) loadingCaption.textContent = contexto.pie;
    const etiqueta = document.getElementById('app-loading-eyebrow');
    if (etiqueta) etiqueta.textContent = contexto.etiqueta;
    loading.classList.remove('is-entering');
    void loading.offsetWidth;
    loading.classList.add('is-entering');
    document.getElementById('auth-screen').hidden = true;
  },

  setMessage(message, kind = 'error') {
    const node = document.getElementById('auth-message');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-success', kind === 'success');
    node.hidden = !message;
  },

  alternarVisibilidadContrasena() {
    const input = document.getElementById('auth-password');
    const toggle = document.getElementById('auth-password-toggle');
    if (!input || !toggle) return;
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    const icono = toggle.querySelector('i');
    if (icono) icono.className = visible ? 'ri-eye-line' : 'ri-eye-off-line';
    toggle.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
    toggle.title = visible ? 'Mostrar contraseña' : 'Ocultar contraseña';
    input.focus();
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