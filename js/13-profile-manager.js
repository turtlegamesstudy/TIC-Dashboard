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
    return `
      <section class="module-fade-enter profile-page">
        <header class="admin-page-header">
          <p class="admin-page-eyebrow">MI ESPACIO INSTITUCIONAL</p>
          <h1>Mi perfil</h1>
          <p>Actualiza tus datos de contacto y tu información docente.</p>
        </header>
        <form class="admin-panel profile-form" id="staff-profile-form">
          <div class="profile-account-summary">
            <span class="profile-account-icon"><i class="ri-user-3-line" aria-hidden="true"></i></span>
            <div>
              <strong>${this._escape([profile.firstName, profile.lastName].filter(Boolean).join(' ') || AuthManager.profile?.displayName || AuthManager.user?.email)}</strong>
              <span>${this._escape(AuthManager.user?.email)}</span>
              <span>${this._escape(centerName)}</span>
            </div>
            <span class="admin-user-status">${this._escape(AuthManager.getAreaLabel(area))}</span>
          </div>
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
              <label for="profile-phone">Teléfono institucional</label>
              <input id="profile-phone" name="phone" type="tel" maxlength="32" autocomplete="tel" value="${this._escape(profile.phone)}">
            </div>
            <div class="form-group">
              <label for="profile-employee-code">Código de empleado</label>
              <input id="profile-employee-code" name="employeeCode" type="text" maxlength="40" value="${this._escape(profile.employeeCode)}">
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
            <div class="form-group profile-field-wide">
              <label for="profile-center">Centro tecnológico asignado</label>
              <input id="profile-center" type="text" value="${this._escape(centerName)}" readonly aria-describedby="profile-center-help">
              <small id="profile-center-help">El centro solo puede cambiarlo la administración.</small>
            </div>
            <div class="form-group profile-field-wide">
              <label for="profile-email">Correo de acceso</label>
              <input id="profile-email" type="email" value="${this._escape(AuthManager.user?.email)}" readonly>
            </div>
          </div>
          <div class="modal-actions">
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
