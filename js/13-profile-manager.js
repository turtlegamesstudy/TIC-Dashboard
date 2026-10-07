'use strict';

const ProfileManager = {
  _bound: false,
  /* Foto en curso: data URL ya redimensionada (o cadena vacía si no hay). */
  _foto: '',
  _fotoPendiente: false,

  _escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  },

  /* ── Iniciales y nombre visible ─────────────────────────────── */
  _nombreVisible(profile) {
    return [profile.firstName, profile.lastName].filter(Boolean).join(' ')
      || AuthManager.profile?.displayName || AuthManager.user?.email || 'Docente';
  },

  _iniciales(nombre) {
    return String(nombre).split(/\s+/).slice(0, 2).map(parte => parte.charAt(0))
      .join('').toLocaleUpperCase('es') || '?';
  },

  /* Coloca la foto en la barra superior (y borra la inicial). */
  applyAvatar() {
    if (typeof document === 'undefined') return;
    const avatar = document.querySelector('.avatar');
    if (!avatar) return;
    const foto = String(AuthManager.staffProfile?.photoURL || this._foto || '').trim();
    if (foto) {
      avatar.textContent = '';
      avatar.classList.add('has-photo');
      avatar.style.backgroundImage = `url("${foto.replace(/["'()]/g, '')}")`;
    } else {
      avatar.classList.remove('has-photo');
      avatar.style.backgroundImage = '';
      const nombre = this._nombreVisible(AuthManager.staffProfile || {});
      avatar.textContent = nombre.trim().charAt(0).toLocaleUpperCase('es') || '?';
    }
  },

  /* Grado de completitud del perfil (foto y biografía pesan más). */
  _completitud(profile) {
    const campos = [
      ['photoURL', 25], ['bio', 20], ['firstName', 10], ['lastName', 10],
      ['position', 8], ['specialty', 7], ['phone', 6], ['employeeCode', 5],
      ['personalEmail', 4], ['office', 3], ['schedule', 2]
    ];
    const total = campos.reduce((suma, [campo, peso]) =>
      suma + (String(profile[campo] || '').trim() ? peso : 0), 0);
    return Math.min(100, total);
  },

  renderVista() {
    this._bind();
    const profile = AuthManager.staffProfile || {};
    const centerName = AuthManager.profile?.centerName || AuthManager.getActiveCenterName();
    const area = ['general', 'ingles', 'tic', 'otra'].includes(profile.area) ? profile.area : 'general';
    const nombreVisible = this._nombreVisible(profile);
    const iniciales = this._iniciales(nombreVisible);
    const esAdmin = AuthManager.profile?.role === 'admin';
    const bio = String(profile.bio || '');
    const foto = String(profile.photoURL || '');
    this._foto = foto;
    this._fotoPendiente = false;
    const porcentaje = this._completitud(profile);

    const ficha = `
      <aside class="admin-panel profile-identity" aria-labelledby="profile-identity-title">
        <div class="profile-cover" aria-hidden="true"></div>
        <div class="profile-avatar-wrap">
          <span class="profile-avatar" id="profile-avatar">${foto
            ? `<img src="${this._escape(foto)}" alt="Foto de ${this._escape(nombreVisible)}">`
            : this._escape(iniciales)}</span>
          <div class="profile-photo-actions">
            <label class="profile-photo-btn" for="profile-photo-input">
              <i class="ri-camera-line" aria-hidden="true"></i> ${foto ? 'Cambiar foto' : 'Subir foto'}
            </label>
            <input type="file" id="profile-photo-input" name="photoFile"
                   accept="image/png,image/jpeg,image/webp" hidden>
            <button class="profile-photo-btn is-quiet" type="button" data-profile-quitar-foto
                    ${foto ? '' : 'hidden'}>
              <i class="ri-delete-bin-line" aria-hidden="true"></i> Quitar
            </button>
          </div>
        </div>
        <div class="profile-identity-copy">
          <h2 id="profile-identity-title">${this._escape(nombreVisible)}</h2>
          <p class="profile-identity-role">${this._escape(profile.position || AuthManager.getAreaLabel(area))}</p>
          <p class="profile-identity-meta"><i class="ri-building-2-line" aria-hidden="true"></i> ${this._escape(centerName)}</p>
          <p class="profile-identity-meta"><i class="ri-mail-line" aria-hidden="true"></i> ${this._escape(AuthManager.user?.email)}</p>
          ${profile.office ? `<p class="profile-identity-meta"><i class="ri-map-pin-line" aria-hidden="true"></i> ${this._escape(profile.office)}</p>` : ''}
          ${profile.schedule ? `<p class="profile-identity-meta"><i class="ri-time-line" aria-hidden="true"></i> ${this._escape(profile.schedule)}</p>` : ''}
          <div class="profile-identity-chips">
            <span class="admin-rol-badge${esAdmin ? ' es-admin' : ''}"><i class="ri-shield-user-line" aria-hidden="true"></i> ${esAdmin ? 'Administrador' : 'Docente'}</span>
            <span class="admin-area-chip">${this._escape(AuthManager.getAreaLabel(area))}</span>
          </div>
        </div>
        <p class="profile-identity-bio${bio ? '' : ' is-empty'}" id="profile-bio-vista">${
          bio ? this._escape(bio) : 'Aún no añades una descripción. Cuéntale a tus colegas qué módulos imparte' + (esAdmin ? 's y cómo localizarte.' : ' y cómo localizarte.')
        }</p>
        <div class="profile-completitud">
          <div class="profile-completitud-barra"><span id="profile-completitud-barra" style="width:${porcentaje}%"></span></div>
          <small id="profile-completitud-texto">Perfil ${porcentaje}% completo${porcentaje < 100 ? ' · sube la foto y añade una descripción' : ''}</small>
        </div>
      </aside>`;

    return `
      <section class="module-fade-enter profile-page">
        <header class="view-header">
          <div class="admin-header-copy">
            <p class="view-eyebrow">MI ESPACIO INSTITUCIONAL</p>
            <h1><i class="ri-user-settings-line" aria-hidden="true"></i> Mi perfil</h1>
            <p>Foto, presentación y datos de contacto que verán tus colegas en el panel.</p>
          </div>
          <div class="header-actions admin-header-stats">
            <span class="admin-stat"><i class="ri-shield-user-line" aria-hidden="true"></i> ${this._escape(esAdmin ? 'Administrador' : AuthManager.getAreaLabel(area))}</span>
            <span class="admin-stat"><i class="ri-building-2-line" aria-hidden="true"></i> ${this._escape(centerName)}</span>
          </div>
        </header>

        <div class="profile-layout">
          ${ficha}
          <form class="admin-panel profile-form" id="staff-profile-form">
            <input type="hidden" name="photoURL" id="profile-photo-url" value="${this._escape(foto)}">

            <fieldset class="profile-fieldset">
              <legend><i class="ri-quill-pen-line" aria-hidden="true"></i> Presentación</legend>
              <div class="profile-fields-grid">
                <div class="form-group profile-field-wide">
                  <label for="profile-bio">Descripción profesional</label>
                  <textarea id="profile-bio" name="bio" maxlength="400" rows="4"
                    placeholder="Ej.: Docente de Tecnologías de la Información, 8 años de experiencia. Imparto redes y soporte técnico.">${this._escape(profile.bio)}</textarea>
                  <small class="profile-bio-counter" data-bio-counter>0 / 400</small>
                </div>
              </div>
            </fieldset>

            <fieldset class="profile-fieldset">
              <legend><i class="ri-contacts-line" aria-hidden="true"></i> Datos institucionales</legend>
              <div class="profile-fields-grid">
                <div class="form-group">
                  <label for="profile-first-name">Nombres</label>
                  <input id="profile-first-name" name="firstName" type="text" maxlength="80" autocomplete="given-name" value="${this._escape(profile.firstName)}" required>
                </div>
                <div class="form-group">
                  <label for="profile-last-name">Apellidos</label>
                  <input id="profile-last-name" name="lastName" type="text" maxlength="100" autocomplete="family-name" value="${this._escape(profile.lastName)}" required>
                </div>
                <div class="form-group">
                  <label for="profile-position">Cargo</label>
                  <input id="profile-position" name="position" type="text" maxlength="100" value="${this._escape(profile.position)}" placeholder="Docente">
                </div>
                <div class="form-group">
                  <label for="profile-area">Área docente</label>
                  <select id="profile-area" name="area" required>
                    <option value="general"${area === 'general' ? ' selected' : ''}>General</option>
                    <option value="ingles"${area === 'ingles' ? ' selected' : ''}>Inglés</option>
                    <option value="tic"${area === 'tic' ? ' selected' : ''}>Tecnologías de la información</option>
                    <option value="otra"${area === 'otra' ? ' selected' : ''}>Otra área</option>
                  </select>
                </div>
                <div class="form-group profile-field-wide">
                  <label for="profile-specialty">Especialidad o módulos que imparte</label>
                  <input id="profile-specialty" name="specialty" type="text" maxlength="180" value="${this._escape(profile.specialty)}" placeholder="Ej.: Inglés técnico, conversación, gramática">
                </div>
                <div class="form-group">
                  <label for="profile-employee-code">Código de empleado</label>
                  <input id="profile-employee-code" name="employeeCode" type="text" maxlength="40" value="${this._escape(profile.employeeCode)}" placeholder="IN-000">
                </div>
                <div class="form-group">
                  <label for="profile-joined-at">Fecha de ingreso</label>
                  <input id="profile-joined-at" name="joinedAt" type="date" value="${this._escape(profile.joinedAt)}">
                </div>
              </div>
            </fieldset>

            <fieldset class="profile-fieldset">
              <legend><i class="ri-phone-line" aria-hidden="true"></i> Contacto y despacho</legend>
              <div class="profile-fields-grid">
                <div class="form-group">
                  <label for="profile-phone">Teléfono institucional</label>
                  <input id="profile-phone" name="phone" type="tel" maxlength="32" autocomplete="tel" value="${this._escape(profile.phone)}" placeholder="9999-0000">
                </div>
                <div class="form-group">
                  <label for="profile-personal-email">Correo personal</label>
                  <input id="profile-personal-email" name="personalEmail" type="email" maxlength="254" value="${this._escape(profile.personalEmail)}" placeholder="nombre@correo.com">
                </div>
                <div class="form-group">
                  <label for="profile-office">Oficina o aula</label>
                  <input id="profile-office" name="office" type="text" maxlength="80" value="${this._escape(profile.office)}" placeholder="Edificio B, aula 12">
                </div>
                <div class="form-group">
                  <label for="profile-schedule">Horario de atención</label>
                  <input id="profile-schedule" name="schedule" type="text" maxlength="80" value="${this._escape(profile.schedule)}" placeholder="Lunes a viernes, 7:00–12:00">
                </div>
                <div class="form-group profile-field-wide">
                  <label for="profile-website">Página o red profesional</label>
                  <input id="profile-website" name="website" type="url" maxlength="200" value="${this._escape(profile.website)}" placeholder="https://…">
                </div>
              </div>
            </fieldset>

            <fieldset class="profile-fieldset">
              <legend><i class="ri-lock-password-line" aria-hidden="true"></i> Acceso y centro</legend>
              <div class="profile-fields-grid">
                <div class="form-group profile-field-wide profile-readonly">
                  <label for="profile-center">Centro tecnológico asignado</label>
                  <input id="profile-center" type="text" value="${this._escape(centerName)}" readonly aria-describedby="profile-center-help">
                  <i class="ri-lock-line profile-readonly-icon" aria-hidden="true"></i>
                  <small id="profile-center-help">El centro solo puede cambiarlo la administración.</small>
                </div>
                <div class="form-group profile-field-wide profile-readonly">
                  <label for="profile-email">Correo de acceso</label>
                  <input id="profile-email" type="email" value="${this._escape(AuthManager.user?.email)}" readonly>
                  <i class="ri-lock-line profile-readonly-icon" aria-hidden="true"></i>
                  <small>Se usa para entrar al panel; se cambia desde Firebase Authentication.</small>
                </div>
              </div>
            </fieldset>

            <div class="profile-actions">
              <p><i class="ri-information-line" aria-hidden="true"></i> Los cambios se guardan en tu perfil institucional y aparecen en la barra superior.</p>
              <button class="btn-primary" type="submit" data-profile-submit><i class="ri-save-line" aria-hidden="true"></i> Guardar perfil</button>
            </div>
          </form>
        </div>
      </section>`;
  },

  _bind() {
    if (this._bound) return;
    const workspace = document.getElementById('workspace');
    if (!workspace) return;
    workspace.addEventListener('submit', event => {
      if (event.target.id !== 'staff-profile-form') return;
      event.preventDefault();
      this.save(event.target);
    });
    /* Foto, contador y botón de quitar viven dentro del workspace. */
    workspace.addEventListener('change', event => {
      if (event.target.id === 'profile-photo-input') this.procesarFoto(event.target);
    });
    workspace.addEventListener('input', event => {
      if (event.target.id !== 'profile-bio') return;
      const contador = workspace.querySelector('[data-bio-counter]');
      if (contador) contador.textContent = `${event.target.value.length} / 400`;
      const vista = document.getElementById('profile-bio-vista');
      if (vista) {
        vista.textContent = event.target.value;
        vista.classList.toggle('is-empty', !event.target.value.trim());
      }
    });
    workspace.addEventListener('click', event => {
      const button = event.target.closest('[data-profile-quitar-foto]');
      if (!button) return;
      this.quitarFoto();
    });
    this._bound = true;
  },

  /* Recorta y comprime la foto a 256px: cabe en el perfil sin pesar. */
  procesarFoto(input) {
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      UI.showToast('❌ La foto debe ser una imagen (PNG, JPG o WebP).');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      UI.showToast('❌ La imagen supera los 5 MB; elige una más ligera.');
      input.value = '';
      return;
    }
    const lector = new FileReader();
    lector.onerror = () => UI.showToast('❌ No se pudo leer la imagen.');
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => UI.showToast('❌ No se pudo procesar la imagen.');
      imagen.onload = () => {
        try {
          const lado = 256;
          const lienzo = document.createElement('canvas');
          lienzo.width = lado;
          lienzo.height = lado;
          const contexto = lienzo.getContext('2d');
          const escala = Math.max(lado / imagen.width, lado / imagen.height);
          const ancho = imagen.width * escala;
          const alto = imagen.height * escala;
          contexto.drawImage(imagen,
            (lado - ancho) / 2, (lado - alto) / 2, ancho, alto);
          const dataURL = lienzo.toDataURL('image/jpeg', 0.82);
          this._foto = dataURL;
          this._fotoPendiente = true;
          this._pintarFoto(dataURL);
          UI.showToast('📷 Foto lista: guarda el perfil para aplicarla.');
        } catch (error) {
          console.error('No se pudo recortar la foto:', error);
          UI.showToast('❌ No se pudo preparar la foto.');
        }
      };
      imagen.src = String(lector.result);
    };
    lector.readAsDataURL(file);
  },

  _pintarFoto(dataURL) {
    if (typeof document === 'undefined') return;
    const avatar = document.getElementById('profile-avatar');
    if (avatar) {
      avatar.innerHTML = `<img src="${this._escape(dataURL)}" alt="Vista previa de la foto">`;
    }
    const ocultar = document.querySelector('[data-profile-quitar-foto]');
    if (ocultar) ocultar.hidden = false;
    const campo = document.getElementById('profile-photo-url');
    if (campo) campo.value = dataURL;
  },

  quitarFoto() {
    this._foto = '';
    this._fotoPendiente = true;
    const campo = document.getElementById('profile-photo-url');
    if (campo) campo.value = '';
    const entrada = document.getElementById('profile-photo-input');
    if (entrada) entrada.value = '';
    const avatar = document.getElementById('profile-avatar');
    if (avatar) {
      avatar.textContent = this._iniciales(this._nombreVisible(AuthManager.staffProfile || {}));
    }
    const ocultar = document.querySelector('[data-profile-quitar-foto]');
    if (ocultar) ocultar.hidden = true;
    const entradaFoto = document.getElementById('profile-photo-input');
    const etiqueta = entradaFoto ? document.querySelector(`label[for="${entradaFoto.id}"]`) : null;
    if (etiqueta) etiqueta.innerHTML = '<i class="ri-camera-line" aria-hidden="true"></i> Subir foto';
    UI.showToast('🗑️ Foto retirada: guarda el perfil para confirmar.');
  },

  async save(form) {
    const submitButton = form.querySelector('[data-profile-submit]');
    if (submitButton?.disabled) return;
    const values = new FormData(form);
    const existente = AuthManager.staffProfile || {};
    const area = String(values.get('area') || '');
    /* Se conservan campos que este formulario no edita (foto incluida). */
    const profile = {
      ...existente,
      firstName: String(values.get('firstName') || '').trim(),
      lastName: String(values.get('lastName') || '').trim(),
      phone: String(values.get('phone') || '').trim(),
      employeeCode: String(values.get('employeeCode') || '').trim(),
      position: String(values.get('position') || '').trim(),
      area,
      specialty: String(values.get('specialty') || '').trim(),
      bio: String(values.get('bio') || '').trim(),
      personalEmail: String(values.get('personalEmail') || '').trim(),
      office: String(values.get('office') || '').trim(),
      schedule: String(values.get('schedule') || '').trim(),
      website: String(values.get('website') || '').trim(),
      joinedAt: String(values.get('joinedAt') || '').trim(),
      photoURL: this._fotoPendiente
        ? String(values.get('photoURL') || '').trim()
        : String(existente.photoURL || String(values.get('photoURL') || '').trim())
    };
    if (!profile.firstName || !profile.lastName ||
      !['general', 'ingles', 'tic', 'otra'].includes(profile.area)) {
      UI.showToast('❌ Completa nombres, apellidos y un área válida.');
      return;
    }
    const displayName = `${profile.firstName} ${profile.lastName}`;
    if (submitButton) submitButton.disabled = true;
    try {
      const uid = AuthManager.user.uid;
      await window.FirebaseServices.database.ref(`staffProfiles/${uid}`).set(profile);
      AuthManager.staffProfile = profile;
      AuthManager.profile.displayName = displayName;
      const currentName = document.getElementById('current-user-name');
      if (currentName) currentName.textContent = displayName;
      const currentRole = document.getElementById('current-user-role');
      if (currentRole) currentRole.textContent = AuthManager.profile.role === 'admin'
        ? 'Administrador global'
        : AuthManager.getAreaLabel(profile.area);
      this.applyAvatar();
      let authDisplayNameUpdated = true;
      try {
        await AuthManager.user.updateProfile({ displayName });
      } catch (error) {
        console.error('El perfil institucional se guardó, pero no se actualizó el nombre en Authentication:', error);
        authDisplayNameUpdated = false;
      }
      UI.showToast(authDisplayNameUpdated
        ? '✅ Perfil institucional actualizado.'
        : '⚠️ Tus datos se guardaron, pero no se pudo sincronizar el nombre visible de la cuenta.');
      UI.renderCurrentModule();
    } catch (error) {
      console.error('No se pudo guardar el perfil institucional:', error);
      UI.showToast(`❌ No se pudo guardar el perfil: ${error.message}`);
    } finally {
      if (submitButton) submitButton.disabled = false;
      this._fotoPendiente = false;
    }
  }
};
