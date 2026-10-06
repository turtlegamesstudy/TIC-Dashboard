'use strict';

const ProfileManager = {
  _bound: false,

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
    this._bind();
    const profile = AuthManager.staffProfile || {};
    const centerName = AuthManager.profile?.centerName || AuthManager.getActiveCenterName();
    const area = ['general', 'ingles', 'tic', 'otra'].includes(profile.area) ? profile.area : 'general';
    const nombreVisible = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
      || AuthManager.profile?.displayName || AuthManager.user?.email || 'Docente';
    const iniciales = nombreVisible.split(/\s+/).slice(0, 2).map(parte => parte.charAt(0))
      .join('').toLocaleUpperCase('es') || '?';
    return `
      <section class="module-fade-enter profile-page">
        <header class="view-header">
          <div class="admin-header-copy">
            <p class="view-eyebrow">MI ESPACIO INSTITUCIONAL</p>
            <h1><i class="ri-user-settings-line" aria-hidden="true"></i> Mi perfil</h1>
            <p>Actualiza tus datos de contacto y tu información docente.</p>
          </div>
          <div class="header-actions admin-header-stats">
            <span class="admin-stat"><i class="ri-shield-user-line" aria-hidden="true"></i> ${this._escape(AuthManager.profile?.role === 'admin' ? 'Administrador' : AuthManager.getAreaLabel(area))}</span>
            <span class="admin-stat"><i class="ri-building-2-line" aria-hidden="true"></i> ${this._escape(centerName)}</span>
          </div>
        </header>
        <form class="admin-panel profile-form" id="staff-profile-form">
          <div class="profile-account-summary">
            <span class="profile-avatar" aria-hidden="true">${this._escape(iniciales)}</span>
            <div class="profile-account-copy">
              <strong>${this._escape(nombreVisible)}</strong>
              <span><i class="ri-mail-line" aria-hidden="true"></i> ${this._escape(AuthManager.user?.email)}</span>
              <span><i class="ri-building-2-line" aria-hidden="true"></i> ${this._escape(centerName)}</span>
            </div>
            <span class="admin-user-status">${this._escape(AuthManager.getAreaLabel(area))}</span>
          </div>

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
            </div>
          </fieldset>

          <fieldset class="profile-fieldset">
            <legend><i class="ri-phone-line" aria-hidden="true"></i> Contacto</legend>
            <div class="profile-fields-grid">
              <div class="form-group">
                <label for="profile-phone">Teléfono institucional</label>
                <input id="profile-phone" name="phone" type="tel" maxlength="32" autocomplete="tel" value="${this._escape(profile.phone)}" placeholder="9999-0000">
              </div>
              <div class="form-group">
                <label for="profile-employee-code">Código de empleado</label>
                <input id="profile-employee-code" name="employeeCode" type="text" maxlength="40" value="${this._escape(profile.employeeCode)}" placeholder="IN-000">
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
    this._bound = true;
  },

  async save(form) {
    const submitButton = form.querySelector('[data-profile-submit]');
    if (submitButton?.disabled) return;
    const values = new FormData(form);
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
      const avatar = document.querySelector('.avatar');
      if (avatar) avatar.textContent = displayName.trim().charAt(0).toLocaleUpperCase('es');
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
    }
  }
};
