'use strict';
/* ═══════════════════════════════════════════════════════════════
   EQUIPOS ENGINE — Control de Equipos Innovatec / Hackathon
   Gestiona equipos (proyecto, propuesta de valor, entregables,
   archivos adjuntos) y sus integrantes (datos personales + rol:
   Coordinador de Equipo / Integrante).
   Los datos viven en DataEngine.db.equipos (ver 02-data-engine.js).
   ═══════════════════════════════════════════════════════════════ */

const EquiposEngine = {
  _busqueda: '',
  _filtroCategoria: 'todos',
  _filtroReporte: 'todos', // 'todos' | 'Innovatec' | 'Hackathon' — qué equipos entran en los Reportes Generales

  // Tamaño máximo permitido por archivo adjunto (en bytes). Los archivos se
  // guardan como Base64 dentro del propio DB.json / localStorage, así que un
  // límite evita romper el guardado local por exceso de peso.
  MAX_ARCHIVO_BYTES: 25 * 1024 * 1024, // 25 MB; el contenido vive en Firebase Storage.

  TIPOS_ARCHIVO: ['Perfil de Proyecto', 'Propuesta de Valor', 'Entregable', 'Otro'],

  generarId(prefijo) {
    return `${prefijo}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  },

  formatearTamano(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  badgeCategoria(categoria) {
    const esHack = categoria === 'Hackathon';
    const color = esHack ? 'var(--neon-purple)' : 'var(--neon-cyan)';
    const icono = esHack ? 'ri-terminal-box-line' : 'ri-lightbulb-flash-line';
    return `<span class="badge-status" style="background:${color}18; color:${color};"><i class="${icono}"></i> ${categoria}</span>`;
  },

  badgeRol(rol) {
    if (rol === 'Coordinador') {
      return `<span class="badge-status" style="background:var(--neon-amber)18; color:var(--neon-amber); font-weight:700;"><i class="ri-vip-crown-2-fill"></i> Coordinador de Equipo</span>`;
    }
    return `<span class="badge-status" style="background:var(--p-400)18; color:var(--p-400);"><i class="ri-user-line"></i> Integrante</span>`;
  },

  badgeTipoArchivo(tipo) {
    const colores = {
      'Perfil de Proyecto': 'var(--p-400)',
      'Propuesta de Valor': 'var(--neon-amber)',
      'Entregable': 'var(--neon-green)',
      'Otro': 'var(--text-muted)'
    };
    const c = colores[tipo] || 'var(--text-muted)';
    return `<span class="badge-status" style="background:${c}18; color:${c};">${tipo}</span>`;
  },

  /* ══════════════ VISTA PRINCIPAL ══════════════ */

  renderVista() {
    const equipos = DataEngine.getEquipos();
    const totalEquipos = equipos.length;
    const totalIntegrantes = equipos.reduce((acc, eq) => acc + (eq.integrantes || []).length, 0);
    const totalInnovatec = equipos.filter(eq => eq.categoria === 'Innovatec').length;
    const totalHackathon = equipos.filter(eq => eq.categoria === 'Hackathon').length;
    const equiposSinCoordinador = equipos.filter(eq => !(eq.integrantes || []).some(i => i.rol === 'Coordinador')).length;

    return `
      <div class="module-fade-enter">
        <div class="view-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
          <div>
            <h1><i class="ri-trophy-line" style="color:var(--neon-amber);"></i> Equipos Innovatec / Hackathon</h1>
            <p>Administra los equipos, proyectos, entregables y participantes de Innovatec y Hackathon.</p>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <div data-section-settings data-settings-title="Filtro de reportes" style="display:flex; align-items:center; gap:6px;">
              <label class="tb-label"><i class="ri-file-list-3-line"></i> Reporte:</label>
              <select id="equipos-filtro-reporte" class="form-control" style="width:170px;"
                      onchange="EquiposEngine._filtroReporte = this.value;"
                      title="Elige qué equipos incluir en los Reportes Generales (PDF/Excel)">
                <option value="todos" ${this._filtroReporte === 'todos' ? 'selected' : ''}>Todos (Innovatec + Hackathon)</option>
                <option value="Innovatec" ${this._filtroReporte === 'Innovatec' ? 'selected' : ''}>Solo Innovatec</option>
                <option value="Hackathon" ${this._filtroReporte === 'Hackathon' ? 'selected' : ''}>Solo Hackathon</option>
              </select>
            </div>
            <button class="btn-secondary" onclick="EquiposEngine.exportarReporteGeneralPDF()"><i class="ri-file-pdf-2-line"></i> Reporte General PDF</button>
            <button class="btn-secondary" onclick="EquiposEngine.exportarReporteGeneralExcel()"><i class="ri-file-excel-2-line"></i> Reporte General Excel</button>
            <button class="btn-primary" onclick="EquiposEngine.abrirModalEquipo()"><i class="ri-add-line"></i> Nuevo Equipo</button>
          </div>
        </div>

        <!-- Estadísticas -->
        <div class="grid-cards" style="margin-bottom:20px;">
          <div class="card-widget">
            <div class="widget-icon blue"><i class="ri-flag-2-line"></i></div>
            <div class="widget-info"><h4>Equipos Registrados</h4><div class="value">${totalEquipos}</div></div>
          </div>
          <div class="card-widget">
            <div class="widget-icon green"><i class="ri-team-line"></i></div>
            <div class="widget-info"><h4>Total Participantes</h4><div class="value">${totalIntegrantes}</div></div>
          </div>
          <div class="card-widget">
            <div class="widget-icon navy"><i class="ri-lightbulb-flash-line"></i></div>
            <div class="widget-info"><h4>Innovatec</h4><div class="value">${totalInnovatec}</div></div>
          </div>
          <div class="card-widget">
            <div class="widget-icon navy"><i class="ri-terminal-box-line"></i></div>
            <div class="widget-info"><h4>Hackathon</h4><div class="value">${totalHackathon}</div></div>
          </div>
          <div class="card-widget">
            <div class="widget-icon ${equiposSinCoordinador > 0 ? '' : 'green'}"><i class="ri-vip-crown-2-line"></i></div>
            <div class="widget-info"><h4>Sin Coordinador</h4><div class="value" style="color:${equiposSinCoordinador > 0 ? 'var(--neon-red)' : 'var(--text-main)'};">${equiposSinCoordinador}</div></div>
          </div>
        </div>

        <!-- Toolbar: búsqueda y filtro -->
        <div class="group-header-card" data-section-settings data-settings-title="Búsqueda y categoría" style="gap:12px; flex-wrap:wrap; margin-bottom:16px;">
          <div style="display:flex; gap:8px; align-items:center; flex:1; min-width:220px;">
            <i class="ri-search-line" style="color:var(--text-muted);"></i>
            <input type="text" id="equipos-buscador" class="form-control" placeholder="Buscar por equipo, proyecto o integrante..."
                   value="${this._busqueda.replace(/"/g, '&quot;')}"
                   oninput="EquiposEngine._busqueda = this.value; EquiposEngine._programarRefresco();">
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <label class="tb-label"><i class="ri-filter-3-line"></i> Categoría:</label>
            <select id="equipos-filtro-categoria" class="form-control" style="width:180px;"
                    onchange="EquiposEngine._filtroCategoria = this.value; EquiposEngine.refrescarLista();">
              <option value="todos" ${this._filtroCategoria === 'todos' ? 'selected' : ''}>Todas</option>
              <option value="Innovatec" ${this._filtroCategoria === 'Innovatec' ? 'selected' : ''}>Solo Innovatec</option>
              <option value="Hackathon" ${this._filtroCategoria === 'Hackathon' ? 'selected' : ''}>Solo Hackathon</option>
            </select>
          </div>
        </div>

        <div id="equipos-lista-container">
          ${this.renderListaEquipos()}
        </div>
      </div>
    `;
  },

  // [OPT] La búsqueda de equipos repinta la lista completa (todas las
  // fichas con sus integrantes y archivos). Al agrupar las teclas se
  // evita reconstruir ese HTML en cada pulsación.
  _programarRefresco() {
    clearTimeout(this._timerRefresco);
    this._timerRefresco = setTimeout(() => {
      this._timerRefresco = null;
      this.refrescarLista();
    }, 140);
  },

  refrescarLista() {
    const cont = document.getElementById('equipos-lista-container');
    if (cont) cont.innerHTML = this.renderListaEquipos();
  },

  // Vuelve a pintar la lista completa pero mantiene abierto el acordeón del
  // equipo indicado (usado tras editar integrantes/archivos para no perder
  // el contexto de dónde estaba trabajando el usuario).
  refrescarManteniendoAbierto(equipoId) {
    this.refrescarLista();
    const details = document.querySelector(`details[data-equipo-id="${equipoId}"]`);
    if (details) details.open = true;
  },

  renderListaEquipos() {
    const query = CuadernoEngine.normalizarTexto(this._busqueda || '');
    let equipos = DataEngine.getEquipos();

    if (this._filtroCategoria !== 'todos') {
      equipos = equipos.filter(eq => eq.categoria === this._filtroCategoria);
    }
    if (query.length > 0) {
      equipos = equipos.filter(eq => {
        const enEquipo = CuadernoEngine.normalizarTexto(eq.nombreEquipo || '').includes(query) ||
          CuadernoEngine.normalizarTexto(eq.nombreProyecto || '').includes(query);
        const enIntegrantes = (eq.integrantes || []).some(i =>
          CuadernoEngine.normalizarTexto(`${i.nombres} ${i.apellidos}`).includes(query) ||
          CuadernoEngine.normalizarTexto(i.correo || '').includes(query)
        );
        return enEquipo || enIntegrantes;
      });
    }

    if (equipos.length === 0) {
      return `
        <div style="background: var(--bg-card); padding: 40px; text-align: center; border-radius: var(--r-xl); border: 1px solid var(--border-default);">
          <i class="ri-folder-add-line" style="font-size: 3rem; color: var(--text-muted);"></i>
          <h3 style="margin-top: 10px;">No hay equipos registrados</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Crea el primer equipo con el botón "Nuevo Equipo".</p>
        </div>`;
    }

    return equipos.map((eq, idx) => this.renderTarjetaEquipo(eq, idx === 0)).join('');
  },

  renderTarjetaEquipo(eq, abrirPorDefecto) {
    const integrantes = eq.integrantes || [];
    const archivos = eq.archivos || [];
    const coordinador = integrantes.find(i => i.rol === 'Coordinador');
    const grupoClase = DataEngine.getGrupoClaseDeEquipo(eq);

    const idSeguro = String(eq.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
      <details class="group-accordion" data-equipo-id="${eq.id}" ${abrirPorDefecto ? 'open' : ''}>
        <summary>
          <div style="display:flex; align-items:center; gap:12px;">
            <i class="ri-arrow-right-s-line accordion-icon" style="font-size:1.2rem; color:var(--primary-blue);"></i>
            <div>
              <h3 style="margin:0; font-size:1.05rem; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <i class="ri-flag-2-line" style="color:var(--primary-blue);"></i> ${eq.nombreEquipo}
                ${this.badgeCategoria(eq.categoria)}
              </h3>
              <p style="margin:2px 0 0 0; font-size:0.8rem; color:var(--text-muted);">
                📌 ${eq.nombreProyecto}${coordinador ? ` &nbsp;•&nbsp; <i class="ri-vip-crown-2-fill" style="color:var(--neon-amber);"></i> ${coordinador.nombres} ${coordinador.apellidos}` : ' • <span style="color:var(--neon-red);">Sin coordinador asignado</span>'}
                <br>
                <i class="ri-group-line"></i> ${grupoClase ? (grupoClase.codigo || grupoClase.nombre) : '<span style="color:var(--neon-red);">Sin grupo de clases</span>'}
                &nbsp;•&nbsp;
                <i class="ri-user-star-line" style="color:var(--neon-amber);"></i> ${grupoClase && grupoClase.docenteGuia ? grupoClase.docenteGuia : '<span style="color:var(--neon-red);">Sin profesor guía</span>'}
              </p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span class="badge-status activo"><i class="ri-team-line"></i> ${integrantes.length} integrante(s)</span>
            <span class="badge-status" style="background:var(--p-400)18; color:var(--p-400);"><i class="ri-attachment-2"></i> ${archivos.length} archivo(s)</span>
            <button class="btn-icon" title="Reporte PDF" onclick="event.stopPropagation(); EquiposEngine.exportarReportePDF('${idSeguro}')"><i class="ri-file-pdf-2-line" style="color:#dc2626;"></i></button>
            <button class="btn-icon" title="Reporte Excel" onclick="event.stopPropagation(); EquiposEngine.exportarReporteExcel('${idSeguro}')"><i class="ri-file-excel-2-line" style="color:var(--neon-green);"></i></button>
            <button class="btn-icon" title="Editar Equipo" onclick="event.stopPropagation(); EquiposEngine.abrirModalEquipo('${idSeguro}')"><i class="ri-pencil-line" style="color:var(--secondary-blue);"></i></button>
            <button class="btn-icon btn-delete" title="Eliminar Equipo" onclick="event.stopPropagation(); EquiposEngine.eliminarEquipo('${idSeguro}')"><i class="ri-delete-bin-line" style="color:#dc2626;"></i></button>
          </div>
        </summary>

        <div class="accordion-content" style="padding:18px; border-top:1px solid var(--border-default);">

          <!-- Datos del proyecto -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-bottom:20px;">
            <div style="background:var(--bg-elevated); border:1px solid var(--border-default); border-radius:var(--r-lg); padding:12px 14px;">
              <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px;"><i class="ri-file-text-line"></i> Descripción del Proyecto</div>
              <div style="font-size:0.85rem;">${eq.descripcionProyecto ? eq.descripcionProyecto.replace(/</g, '&lt;') : '<span style="color:var(--text-muted);">Sin descripción registrada.</span>'}</div>
            </div>
            <div style="background:var(--bg-elevated); border:1px solid var(--border-default); border-radius:var(--r-lg); padding:12px 14px;">
              <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px;"><i class="ri-star-line"></i> Propuesta de Valor</div>
              <div style="font-size:0.85rem;">${eq.propuestaValor ? eq.propuestaValor.replace(/</g, '&lt;') : '<span style="color:var(--text-muted);">Sin propuesta de valor registrada.</span>'}</div>
            </div>
            <div style="background:var(--bg-elevated); border:1px solid var(--border-default); border-radius:var(--r-lg); padding:12px 14px;">
              <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px;"><i class="ri-truck-line"></i> Entregables</div>
              <div style="font-size:0.85rem;">${eq.entregables ? eq.entregables.replace(/</g, '&lt;') : '<span style="color:var(--text-muted);">Sin entregables registrados.</span>'}</div>
            </div>
            <div style="background:var(--bg-elevated); border:1px solid var(--border-default); border-radius:var(--r-lg); padding:12px 14px;">
              <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:6px;"><i class="ri-group-line"></i> Grupo de Clases / Profesor Guía</div>
              <div style="font-size:0.85rem;">
                ${grupoClase ? `<strong>${grupoClase.codigo || grupoClase.nombre}</strong> — ${grupoClase.carrera || ''} (${grupoClase.turno || ''})` : '<span style="color:var(--text-muted);">Sin grupo de clases asignado.</span>'}
                <br><i class="ri-user-star-line" style="color:var(--neon-amber);"></i> ${grupoClase && grupoClase.docenteGuia ? grupoClase.docenteGuia : '<span style="color:var(--text-muted);">Profesor guía no asignado.</span>'}
              </div>
            </div>
          </div>

          <!-- Integrantes -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0; font-size:0.95rem; display:flex; align-items:center; gap:6px;"><i class="ri-team-line" style="color:var(--p-400);"></i> Participantes del Equipo</h4>
            <button class="btn-primary-soft" onclick="EquiposEngine.abrirModalIntegrante('${eq.id}')"><i class="ri-user-add-line"></i> Agregar Integrante</button>
          </div>
          <div class="table-container" style="margin-bottom:20px; overflow-x:auto;">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Nombres</th><th>Apellidos</th><th>Correo</th><th>Teléfono</th><th>Cédula</th><th>Rol</th>
                  <th style="text-align:center;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${integrantes.length === 0
                  ? `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Aún no hay integrantes registrados en este equipo.</td></tr>`
                  : integrantes.map(i => `
                    <tr>
                      <td><strong>${i.nombres}</strong></td>
                      <td>${i.apellidos}</td>
                      <td>${i.correo}</td>
                      <td>${i.telefono}</td>
                      <td>${i.cedula || '<span style="color:var(--text-muted);">—</span>'}</td>
                      <td>${this.badgeRol(i.rol)}</td>
                      <td style="text-align:center; display:flex; justify-content:center; gap:6px;">
                        <button class="btn-icon" title="Editar Integrante" onclick="EquiposEngine.abrirModalIntegrante('${eq.id}', '${i.id}')"><i class="ri-pencil-line" style="color:var(--secondary-blue);"></i></button>
                        <button class="btn-icon" title="Eliminar Integrante" onclick="EquiposEngine.eliminarIntegrante('${eq.id}', '${i.id}')"><i class="ri-delete-bin-line" style="color:#dc2626;"></i></button>
                      </td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Archivos del proyecto -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
            <h4 style="margin:0; font-size:0.95rem; display:flex; align-items:center; gap:6px;"><i class="ri-attachment-2" style="color:var(--p-400);"></i> Archivos del Proyecto</h4>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <select id="archivo-tipo-${eq.id}" class="form-control" style="width:200px;">
                ${this.TIPOS_ARCHIVO.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
              <button class="btn-primary-soft" onclick="document.getElementById('archivo-input-${eq.id}').click()"><i class="ri-upload-2-line"></i> Subir Archivo</button>
              <input type="file" id="archivo-input-${eq.id}" multiple style="display:none;" onchange="EquiposEngine.manejarSubidaArchivo('${eq.id}', event)">
            </div>
          </div>
          <div class="table-container" style="overflow-x:auto;">
            <table class="custom-table">
              <thead>
                <tr><th>Archivo</th><th>Tipo</th><th>Tamaño</th><th>Subido</th><th style="text-align:center;">Acciones</th></tr>
              </thead>
              <tbody>
                ${archivos.length === 0
                  ? `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No se han adjuntado archivos a este equipo.</td></tr>`
                  : archivos.map(a => `
                    <tr>
                      <td><i class="ri-file-line" style="color:var(--text-muted); margin-right:4px;"></i>${a.nombre}</td>
                      <td>${this.badgeTipoArchivo(a.tipo)}</td>
                      <td>${this.formatearTamano(a.tamano)}</td>
                      <td style="font-size:0.78rem; color:var(--text-muted);">${a.fechaSubida ? new Date(a.fechaSubida).toLocaleDateString() : '—'}</td>
                      <td style="text-align:center; display:flex; justify-content:center; gap:6px;">
                        <button class="btn-icon" title="${DataEngine.canManageAttachment(a) ? 'Descargar' : 'Solo quien subió el archivo puede descargarlo'}" ${DataEngine.canManageAttachment(a) ? '' : 'disabled'} onclick="EquiposEngine.descargarArchivo('${eq.id}', '${a.id}')"><i class="ri-download-2-line" style="color:var(--p-400);"></i></button>
                        <button class="btn-icon" title="${DataEngine.canManageAttachment(a) ? 'Eliminar' : 'Solo quien subió el archivo puede eliminarlo'}" ${DataEngine.canManageAttachment(a) ? '' : 'disabled'} onclick="EquiposEngine.eliminarArchivo('${eq.id}', '${a.id}')"><i class="ri-delete-bin-line" style="color:#dc2626;"></i></button>
                      </td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    `;
  },

  /* ══════════════ CRUD: EQUIPO ══════════════ */

  abrirModalEquipo(equipoId) {
    const modal = document.getElementById('modal-equipo');
    const titulo = document.getElementById('titulo-modal-equipo');
    document.getElementById('form-equipo').reset();
    document.getElementById('equipo-id').value = '';

    // [NUEVO] Poblar el selector de Grupo de Clases con todos los grupos
    // registrados en el sistema (misma base de datos que "Grupos de Clase").
    const selectGrupo = document.getElementById('equipo-grupo-clase');
    if (selectGrupo) {
      const grupos = DataEngine.getGrupos();
      selectGrupo.innerHTML = '<option value="">-- Seleccionar Grupo --</option>' +
        grupos.map(g => `<option value="${g.id}">${g.codigo || g.nombre} — ${g.carrera} (${g.turno})</option>`).join('');
    }

    if (equipoId) {
      const eq = DataEngine.getEquipoById(equipoId);
      if (!eq) return;
      titulo.innerHTML = '<i class="ri-pencil-line"></i> Editar Equipo';
      document.getElementById('equipo-id').value = eq.id;
      document.getElementById('equipo-nombre').value = eq.nombreEquipo || '';
      document.getElementById('equipo-categoria').value = eq.categoria || 'Innovatec';
      document.getElementById('equipo-proyecto').value = eq.nombreProyecto || '';
      document.getElementById('equipo-descripcion').value = eq.descripcionProyecto || '';
      document.getElementById('equipo-propuesta-valor').value = eq.propuestaValor || '';
      document.getElementById('equipo-entregables').value = eq.entregables || '';
      if (selectGrupo) selectGrupo.value = eq.grupoClaseId || '';
    } else {
      titulo.innerHTML = '<i class="ri-flag-2-line"></i> Nuevo Equipo';
    }

    this.actualizarProfesorGuiaPreview();
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  },

  // [NUEVO] Muestra en el modal el docente guía del grupo de clases elegido
  // (el docente guía se gestiona a nivel de grupo, en "Grupos de Clase").
  actualizarProfesorGuiaPreview() {
    const grupoId = document.getElementById('equipo-grupo-clase')?.value;
    const grupo = grupoId ? DataEngine.getGrupoById(grupoId) : null;
    const el = document.getElementById('equipo-profesor-guia-preview');
    if (!el) return;
    el.innerHTML = `<i class="ri-user-star-line"></i> Profesor Guía: <strong>${grupo && grupo.docenteGuia ? grupo.docenteGuia : 'No asignado en el grupo'}</strong>`;
  },

  cerrarModalEquipo() {
    const modal = document.getElementById('modal-equipo');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  },

  async guardarEquipo(event) {
    event.preventDefault();
    const id = document.getElementById('equipo-id').value;
    const datos = {
      nombreEquipo: document.getElementById('equipo-nombre').value.trim(),
      categoria: document.getElementById('equipo-categoria').value,
      nombreProyecto: document.getElementById('equipo-proyecto').value.trim(),
      descripcionProyecto: document.getElementById('equipo-descripcion').value.trim(),
      propuestaValor: document.getElementById('equipo-propuesta-valor').value.trim(),
      entregables: document.getElementById('equipo-entregables').value.trim(),
      grupoClaseId: document.getElementById('equipo-grupo-clase')?.value || ''
    };

    if (!datos.nombreEquipo || !datos.nombreProyecto) {
      UI.showToast('⚠️ El nombre del equipo y del proyecto son obligatorios.');
      return;
    }

    const previousTeams = DataEngine.db.equipos;
    let addedTeam = null;
    let editedTeam = null;
    let previousTeamValues = null;
    try {
      if (id) {
        const eq = DataEngine.getEquipoById(id);
        if (!eq) return;
        editedTeam = eq;
        previousTeamValues = { ...eq };
        Object.assign(eq, datos);
      } else {
        addedTeam = {
          id: this.generarId('EQP'),
          ...datos,
          fechaCreacion: new Date().toISOString(),
          integrantes: [],
          archivos: []
        };
        DataEngine.db.equipos.push(addedTeam);
      }
      await DataEngine.save();
      UI.showToast(id ? '✅ Equipo actualizado correctamente.' : '✅ Equipo creado correctamente.');
      this.cerrarModalEquipo();
      UI.renderCurrentModule();
    } catch (err) {
      if (DataEngine.db.equipos === previousTeams) {
        if (addedTeam) DataEngine.db.equipos = previousTeams.filter(team => team !== addedTeam);
        if (editedTeam && previousTeamValues) Object.assign(editedTeam, previousTeamValues);
      }
      console.error('Error al guardar equipo:', err);
      UI.showToast('❌ No se pudo guardar el equipo.');
    }
  },

  async eliminarEquipo(equipoId) {
    const eq = DataEngine.getEquipoById(equipoId);
    if (!eq) return;
    const adjuntosDeOtros = (eq.archivos || []).filter(file =>
      file.storagePath && !DataEngine.canManageAttachment(file)
    );
    if (adjuntosDeOtros.length > 0) {
      UI.showToast('⚠️ No se puede eliminar el equipo mientras tenga archivos subidos por otras cuentas. Solicita a sus propietarios que los eliminen primero.');
      return;
    }
    if (!confirm(`¿Estás seguro de eliminar el equipo "${eq.nombreEquipo}"? Se perderán sus ${eq.integrantes.length} integrante(s) y ${eq.archivos.length} archivo(s).`)) return;
    const previousTeams = DataEngine.db.equipos;
    const storagePaths = (eq.archivos || []).map(file => file.storagePath).filter(Boolean);
    DataEngine.db.equipos = DataEngine.db.equipos.filter(e => e.id !== equipoId);
    try {
      await DataEngine.save();
      const cleanupResults = await Promise.allSettled(storagePaths.map(path => DataEngine.deleteStoredFile(path)));
      const failedCleanupCount = cleanupResults.filter(result => result.status === 'rejected').length;
      cleanupResults.forEach(result => {
        if (result.status === 'rejected') console.error('No se pudo eliminar un archivo de Firebase Storage:', result.reason);
      });
      UI.showToast(failedCleanupCount
        ? `⚠️ Equipo eliminado, pero quedaron ${failedCleanupCount} archivo(s) pendientes de limpieza en Storage.`
        : `🗑️ El equipo "${eq.nombreEquipo}" ha sido eliminado.`);
      UI.renderCurrentModule();
    } catch (error) {
      if (!DataEngine.getEquipoById(equipoId)) DataEngine.db.equipos = previousTeams;
      console.error('No se pudo eliminar el equipo:', error);
      UI.showToast(`❌ No se pudo eliminar el equipo: ${error.message}`);
      UI.renderCurrentModule();
    }
  },

  /* ══════════════ CRUD: INTEGRANTE ══════════════ */

  abrirModalIntegrante(equipoId, integranteId) {
    const modal = document.getElementById('modal-integrante');
    const titulo = document.getElementById('titulo-modal-integrante');
    document.getElementById('form-integrante').reset();
    document.getElementById('integrante-id').value = '';
    document.getElementById('integrante-equipo-id').value = equipoId;
    document.getElementById('integrante-estudiante-id').value = '';
    document.getElementById('integrante-estudiante-grupo-id').value = '';

    // [NUEVO] Llena el selector con TODOS los estudiantes ya registrados en
    // el sistema (misma base de datos que "Grupos de Clase"), agrupados por
    // grupo, para poder elegirlos en vez de tipear todo a mano.
    const selectEst = document.getElementById('integrante-estudiante-select');
    if (selectEst) {
      const estudiantes = DataEngine.getEstudiantes();
      const porGrupo = {};
      estudiantes.forEach(e => {
        if (!porGrupo[e.grupoNombre]) porGrupo[e.grupoNombre] = [];
        porGrupo[e.grupoNombre].push(e);
      });
      let opciones = '<option value="">-- Ingresar manualmente --</option>';
      Object.keys(porGrupo).sort().forEach(grupoNombre => {
        opciones += `<optgroup label="${grupoNombre}">`;
        porGrupo[grupoNombre].forEach(e => {
          // La base reutiliza IDs como STU-030 en distintos grupos. La clave
          // del option debe identificar ambas cosas para no traer otro alumno.
          const clave = `${e.grupoId}::${e.id}`;
          opciones += `<option value="${clave}" data-estudiante-id="${e.id}" data-grupo-id="${e.grupoId}">${e.apellidos}, ${e.nombres}</option>`;
        });
        opciones += `</optgroup>`;
      });
      selectEst.innerHTML = opciones;
    }

    if (integranteId) {
      const eq = DataEngine.getEquipoById(equipoId);
      const integrante = eq ? (eq.integrantes || []).find(i => i.id === integranteId) : null;
      if (!integrante) return;
      titulo.innerHTML = '<i class="ri-pencil-line"></i> Editar Integrante';
      document.getElementById('integrante-id').value = integrante.id;
      document.getElementById('integrante-nombres').value = integrante.nombres || '';
      document.getElementById('integrante-apellidos').value = integrante.apellidos || '';
      document.getElementById('integrante-correo').value = integrante.correo || '';
      document.getElementById('integrante-telefono').value = integrante.telefono || '';
      document.getElementById('integrante-cedula').value = integrante.cedula || '';
      document.getElementById('integrante-rol').value = integrante.rol || 'Integrante';
      if (integrante.estudianteId && selectEst) {
        const match = Array.from(selectEst.options).find(o =>
          o.dataset.estudianteId === String(integrante.estudianteId) &&
          (!integrante.estudianteGrupoId || o.dataset.grupoId === String(integrante.estudianteGrupoId))
        );
        if (match) selectEst.value = match.value;
      }
    } else {
      titulo.innerHTML = '<i class="ri-user-add-line"></i> Nuevo Integrante';
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  },

  // [NUEVO] Autocompleta el formulario con los datos ya existentes de un
  // estudiante seleccionado desde la base de datos del sistema.
  autocompletarDesdeEstudiante(valor) {
    if (!valor) {
      document.getElementById('integrante-estudiante-id').value = '';
      document.getElementById('integrante-estudiante-grupo-id').value = '';
      return;
    }
    const separador = valor.indexOf('::');
    if (separador < 1) return;
    const grupoId = valor.slice(0, separador);
    const estudianteId = valor.slice(separador + 2);
    // El mismo ID puede existir en más de un grupo. La selección del usuario
    // incluye el grupo y debe resolverse dentro de ese grupo, no con una
    // búsqueda global que devolvería el primer estudiante coincidente.
    const estudiante = DataEngine.getEstudiantesByGrupo(grupoId).find(e => e.id === estudianteId);
    if (!estudiante) return;
    document.getElementById('integrante-estudiante-id').value = estudianteId;
    document.getElementById('integrante-estudiante-grupo-id').value = grupoId || '';
    document.getElementById('integrante-nombres').value = estudiante.nombres || '';
    document.getElementById('integrante-apellidos').value = estudiante.apellidos || '';
    document.getElementById('integrante-correo').value = estudiante.correo || '';
    document.getElementById('integrante-telefono').value = estudiante.telefono || '';
  },

  cerrarModalIntegrante() {
    const modal = document.getElementById('modal-integrante');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  },

  async guardarIntegrante(event) {
    event.preventDefault();
    const equipoId = document.getElementById('integrante-equipo-id').value;
    const integranteId = document.getElementById('integrante-id').value;
    const eq = DataEngine.getEquipoById(equipoId);
    if (!eq) return;

    const datos = {
      nombres: document.getElementById('integrante-nombres').value.trim(),
      apellidos: document.getElementById('integrante-apellidos').value.trim(),
      correo: document.getElementById('integrante-correo').value.trim(),
      telefono: document.getElementById('integrante-telefono').value.trim(),
      cedula: document.getElementById('integrante-cedula').value.trim(),
      rol: document.getElementById('integrante-rol').value,
      // [NUEVO] Si se eligió del selector, queda enlazado al estudiante real
      // de la base de datos (útil para reportes/estadísticas cruzadas).
      estudianteId: document.getElementById('integrante-estudiante-id').value || null,
      estudianteGrupoId: document.getElementById('integrante-estudiante-grupo-id').value || null
    };

    if (!datos.nombres || !datos.apellidos || !datos.correo || !datos.telefono) {
      UI.showToast('⚠️ Nombres, apellidos, correo y teléfono son obligatorios.');
      return;
    }

    // Aviso (no bloqueante) si ya existe otro coordinador en el equipo.
    if (datos.rol === 'Coordinador') {
      const otroCoordinador = (eq.integrantes || []).find(i => i.rol === 'Coordinador' && i.id !== integranteId);
      if (otroCoordinador) {
        UI.showToast(`ℹ️ ${otroCoordinador.nombres} ${otroCoordinador.apellidos} también es Coordinador de este equipo.`);
      }
    }

    const previousMembers = eq.integrantes || [];
    let editedMember = null;
    let previousMemberValues = null;
    let addedMember = null;
    try {
      if (!eq.integrantes) eq.integrantes = [];
      if (integranteId) {
        const integrante = eq.integrantes.find(i => i.id === integranteId);
        if (integrante) {
          editedMember = integrante;
          previousMemberValues = { ...integrante };
          Object.assign(integrante, datos);
        }
      } else {
        addedMember = { id: this.generarId('INT'), ...datos };
        eq.integrantes.push(addedMember);
      }
      await DataEngine.save();
      UI.showToast(integranteId ? '✅ Integrante actualizado correctamente.' : '✅ Integrante agregado correctamente.');
      this.cerrarModalIntegrante();
      this.refrescarManteniendoAbierto(equipoId);
    } catch (err) {
      const currentTeam = DataEngine.getEquipoById(equipoId);
      if (currentTeam === eq) {
        if (addedMember) eq.integrantes = (eq.integrantes || []).filter(member => member !== addedMember);
        if (editedMember && previousMemberValues) Object.assign(editedMember, previousMemberValues);
        if (!eq.integrantes) eq.integrantes = previousMembers;
      }
      console.error('Error al guardar integrante:', err);
      UI.showToast('❌ No se pudo guardar el integrante.');
    }
  },

  async eliminarIntegrante(equipoId, integranteId) {
    const eq = DataEngine.getEquipoById(equipoId);
    if (!eq) return;
    const integrante = (eq.integrantes || []).find(i => i.id === integranteId);
    if (!integrante) return;
    if (!confirm(`¿Eliminar a ${integrante.nombres} ${integrante.apellidos} del equipo "${eq.nombreEquipo}"?`)) return;
    const previousMembers = eq.integrantes;
    eq.integrantes = eq.integrantes.filter(i => i.id !== integranteId);
    try {
      await DataEngine.save();
      UI.showToast('🗑️ Integrante eliminado correctamente.');
      this.refrescarManteniendoAbierto(equipoId);
    } catch (error) {
      if (DataEngine.getEquipoById(equipoId) === eq) eq.integrantes = previousMembers;
      console.error('No se pudo eliminar el integrante:', error);
      UI.showToast(`❌ No se pudo eliminar el integrante: ${error.message}`);
    }
  },

  /* ══════════════ ARCHIVOS DEL PROYECTO ══════════════ */

  async manejarSubidaArchivo(equipoId, event) {
    const eq = DataEngine.getEquipoById(equipoId);
    const files = Array.from(event.target.files || []);
    if (!eq || files.length === 0) return;

    const tipo = document.getElementById(`archivo-tipo-${equipoId}`)?.value || 'Otro';
    const aceptados = [];
    const rechazadosPorPeso = [];

    files.forEach(file => {
      if (file.size > this.MAX_ARCHIVO_BYTES) { rechazadosPorPeso.push(file.name); }
      else { aceptados.push(file); }
    });

    if (rechazadosPorPeso.length > 0) {
      UI.showToast(`⚠️ No se subieron (muy pesados, máx. ${this.formatearTamano(this.MAX_ARCHIVO_BYTES)}): ${rechazadosPorPeso.join(', ')}`);
    }
    if (aceptados.length === 0) { event.target.value = ''; return; }

    const nuevosArchivos = [];
    UI.showLoading(`Subiendo ${aceptados.length} archivo(s) a la nube…`, 'subida');
    try {
      for (const file of aceptados) {
        const metadata = {
        id: this.generarId('ARCH'),
        nombre: file.name,
        tipo,
        tamano: file.size,
          fechaSubida: new Date().toISOString()
        };
        nuevosArchivos.push(await DataEngine.uploadAttachment(equipoId, file, metadata));
      }
      if (!eq.archivos) eq.archivos = [];
      eq.archivos.push(...nuevosArchivos);
      await DataEngine.save();
      UI.showToast(`✅ ${nuevosArchivos.length} archivo(s) subido(s) correctamente.`);
      event.target.value = '';
      this.refrescarManteniendoAbierto(equipoId);
    } catch (error) {
      eq.archivos = (eq.archivos || []).filter(file => !nuevosArchivos.some(uploaded => uploaded.id === file.id));
      await Promise.all(nuevosArchivos.map(file => DataEngine.deleteStoredFile(file.storagePath).catch(cleanupError => {
        console.error('No se pudo limpiar un archivo fallido de Firebase Storage:', cleanupError);
      })));
      console.error('Error al subir archivos del equipo:', error);
      UI.showToast(`❌ No se pudieron subir los archivos: ${error.message}`);
      event.target.value = '';
      this.refrescarManteniendoAbierto(equipoId);
    } finally {
      UI.hideLoading(300);
    }
  },

  async eliminarArchivo(equipoId, archivoId) {
    const eq = DataEngine.getEquipoById(equipoId);
    if (!eq) return;
    const archivo = (eq.archivos || []).find(a => a.id === archivoId);
    if (!archivo) return;
    if (!DataEngine.canManageAttachment(archivo)) {
      UI.showToast('❌ Solo la cuenta que subió este archivo puede eliminarlo.');
      return;
    }
    if (!confirm(`¿Eliminar el archivo "${archivo.nombre}"?`)) return;
    const previousFiles = eq.archivos;
    eq.archivos = eq.archivos.filter(a => a.id !== archivoId);
    try {
      await DataEngine.save();
    } catch (error) {
      if (DataEngine.getEquipoById(equipoId) === eq) eq.archivos = previousFiles;
      console.error('No se pudo quitar el archivo del equipo:', error);
      UI.showToast(`❌ No se pudo eliminar el archivo: ${error.message}`);
      return;
    }
    if (archivo.storagePath) {
      try {
        await DataEngine.deleteStoredFile(archivo.storagePath);
      } catch (error) {
        console.error('El archivo se desvinculó, pero no se pudo limpiar Storage:', error);
        UI.showToast('⚠️ El archivo se quitó del equipo, pero quedó pendiente de limpieza en Storage.');
        this.refrescarManteniendoAbierto(equipoId);
        return;
      }
    }
    try {
      UI.showToast('🗑️ Archivo eliminado correctamente.');
      this.refrescarManteniendoAbierto(equipoId);
    } catch (error) {
      console.error('No se pudo actualizar la vista tras eliminar el archivo:', error);
    }
  },

  async descargarArchivo(equipoId, archivoId) {
    const eq = DataEngine.getEquipoById(equipoId);
    const archivo = eq ? (eq.archivos || []).find(a => a.id === archivoId) : null;
    if (!archivo) { UI.showToast('❌ No se encontró el archivo.'); return; }
    if (!DataEngine.canManageAttachment(archivo)) {
      UI.showToast('❌ Solo la cuenta que subió este archivo puede descargarlo.');
      return;
    }
    try {
      let blob;
      if (archivo.storagePath) {
        const downloadUrl = await window.FirebaseServices.storage.ref(archivo.storagePath).getDownloadURL();
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`Firebase Storage respondió con el estado ${response.status}.`);
        blob = await response.blob();
      } else if (archivo.dataUrl) {
        const response = await fetch(archivo.dataUrl);
        if (!response.ok) throw new Error('No se pudo recuperar el archivo antiguo.');
        blob = await response.blob();
      } else {
        throw new Error('El archivo no contiene una ubicación válida.');
      }
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = archivo.nombre;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error('No se pudo descargar el archivo del equipo:', error);
      UI.showToast(`❌ No se pudo descargar el archivo: ${error.message}`);
    }
  },

  /* ══════════════ REPORTE POR EQUIPO (PDF / EXCEL) ══════════════ */

  // Arma las filas de la tabla de integrantes (una fila por integrante),
  // repitiendo los datos del equipo, grupo de clases y profesor guía para
  // que el reporte quede completo por sí solo.
  _datosReporteEquipo(eq) {
    const grupoClase = DataEngine.getGrupoClaseDeEquipo(eq);
    const integrantes = eq.integrantes || [];
    const cabecera = ['Nombres', 'Apellidos', 'Correo', 'Teléfono', 'Cédula', 'Rol', 'Grupo de Clases', 'Profesor Guía'];
    const filas = integrantes.length > 0
      ? integrantes.map(i => [
          i.nombres || '', i.apellidos || '', i.correo || '', i.telefono || '', i.cedula || '—',
          i.rol || 'Integrante',
          grupoClase ? (grupoClase.codigo || grupoClase.nombre) : 'Sin asignar',
          (grupoClase && grupoClase.docenteGuia) ? grupoClase.docenteGuia : 'No asignado'
        ])
      : [['—', '—', '—', '—', '—', '—', grupoClase ? (grupoClase.codigo || grupoClase.nombre) : 'Sin asignar', (grupoClase && grupoClase.docenteGuia) ? grupoClase.docenteGuia : 'No asignado']];
    return { grupoClase, cabecera, filas };
  },

  // Paleta según categoría, usada en PDF y Excel para dar identidad visual
  // (Innovatec = cian, Hackathon = morado), consistente con las badges de la UI.
  _colorCategoria(categoria) {
    return categoria === 'Hackathon'
      ? { rgb: [147, 51, 234], argb: 'FF9333EA', argbClaro: 'FFF3E8FF' }
      : { rgb: [8, 145, 178], argb: 'FF0891B2', argbClaro: 'FFE0F7FA' };
  },

  // Dibuja la banda de encabezado institucional + chip de categoría.
  // Devuelve el eje Y donde puede continuar el contenido.
  _dibujarEncabezadoPDF(doc, eq, subtitulo) {
    const w = doc.internal.pageSize.getWidth();
    const col = this._colorCategoria(eq.categoria);

    doc.setFillColor(11, 78, 162);
    doc.rect(0, 0, w, 58, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    doc.text('INATEC — Centro Tecnológico Ariel Darce', 40, 24);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(subtitulo, 40, 42);

    const chipTexto = ` ${eq.categoria} `;
    doc.setFontSize(10);
    const chipW = doc.getTextWidth(chipTexto) + 16;
    const chipX = w - chipW - 40;
    doc.setFillColor(...col.rgb);
    doc.roundedRect(chipX, 17, chipW, 24, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text(chipTexto.trim(), chipX + chipW / 2, 33, { align: 'center' });

    doc.setTextColor(20, 20, 20);
    doc.setFont(undefined, 'normal');
    return 58;
  },

  // Dibuja la tarjeta con los datos del equipo (proyecto, grupo, profesor guía).
  // Devuelve el eje Y donde debe iniciar la tabla.
  _dibujarInfoEquipoPDF(doc, eq, grupoClase, startY) {
    const w = doc.internal.pageSize.getWidth();
    doc.setDrawColor(215, 219, 226);
    doc.setFillColor(248, 249, 251);
    doc.roundedRect(40, startY, w - 80, 48, 4, 4, 'FD');

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(eq.nombreEquipo || 'Sin nombre', 52, startY + 18);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9.5);
    doc.text(`Proyecto: ${eq.nombreProyecto || '—'}`, 52, startY + 34);

    const midX = w / 2 + 10;
    doc.setFont(undefined, 'bold');
    doc.text('Grupo de Clases:', midX, startY + 18);
    doc.setFont(undefined, 'normal');
    doc.text(`${grupoClase ? (grupoClase.codigo || grupoClase.nombre) : 'Sin asignar'}`, midX + 95, startY + 18);
    doc.setFont(undefined, 'bold');
    doc.text('Profesor Guía:', midX, startY + 34);
    doc.setFont(undefined, 'normal');
    doc.text(`${(grupoClase && grupoClase.docenteGuia) ? grupoClase.docenteGuia : 'No asignado'}`, midX + 95, startY + 34);

    return startY + 48 + 14;
  },

  // Dibuja el bloque de confirmación + firmas con estilo de tarjeta.
  _dibujarConfirmacionPDF(doc, startY) {
    const w = doc.internal.pageSize.getWidth();
    doc.setDrawColor(215, 219, 226);
    doc.setFillColor(248, 249, 251);
    doc.roundedRect(40, startY, w - 80, 34, 4, 4, 'FD');
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('¿El equipo confirma su participación?', 52, startY + 21);
    doc.setDrawColor(90, 90, 90);
    doc.rect(280, startY + 9, 13, 13);
    doc.setFont(undefined, 'normal');
    doc.text('SÍ', 298, startY + 19);
    doc.rect(335, startY + 9, 13, 13);
    doc.text('NO', 353, startY + 19);

    const firmaY = startY + 34 + 38;
    doc.setDrawColor(150, 150, 150);
    doc.line(40, firmaY, 260, firmaY);
    doc.line(w - 260, firmaY, w - 40, firmaY);
    doc.setFontSize(9);
    doc.text('Firma Coordinador de Equipo', 40, firmaY + 13);
    doc.text('Firma Profesor Guía', w - 260, firmaY + 13);
  },

  // Pie de página consistente en todos los reportes.
  _dibujarPiePDF(doc, pagina, totalPaginas) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(225, 225, 225);
    doc.line(40, h - 32, w - 40, h - 32);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont(undefined, 'normal');
    doc.text(`Generado el ${new Date().toLocaleDateString('es-NI')}`, 40, h - 18);
    doc.text(`Página ${pagina} de ${totalPaginas}`, w - 40, h - 18, { align: 'right' });
    doc.setTextColor(20, 20, 20);
  },

  exportarReportePDF(equipoId) {
    const eq = DataEngine.getEquipoById(equipoId);
    if (!eq) return;
    if (typeof window.jspdf === 'undefined') { UI.showToast('❌ No se pudo cargar el módulo de PDF.'); return; }

    const { grupoClase, cabecera, filas } = this._datosReporteEquipo(eq);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const col = this._colorCategoria(eq.categoria);

    this._dibujarEncabezadoPDF(doc, eq, 'Reporte de Equipo');
    const infoBottom = this._dibujarInfoEquipoPDF(doc, eq, grupoClase, 74);

    doc.autoTable({
      head: [cabecera],
      body: filas,
      startY: infoBottom,
      styles: { fontSize: 8, cellPadding: 5, lineColor: [222, 226, 232], lineWidth: 0.5 },
      headStyles: { fillColor: col.rgb, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 251] }
    });

    this._dibujarConfirmacionPDF(doc, doc.lastAutoTable.finalY + 18);
    this._dibujarPiePDF(doc, 1, 1);

    doc.save(`Reporte_${eq.nombreEquipo.replace(/\s+/g, '_')}.pdf`);
    UI.showToast('✅ Reporte PDF generado correctamente.');
  },

  // [NUEVO] Reporte GENERAL en PDF: un solo archivo con una tabla por cada
  // equipo registrado (Innovatec y Hackathon juntos), en vez de exportar
  // equipo por equipo.
  exportarReporteGeneralPDF() {
    const alcance = this._filtroReporte || 'todos';
    const equipos = alcance === 'todos' ? DataEngine.getEquipos() : DataEngine.getEquipos().filter(eq => eq.categoria === alcance);
    if (equipos.length === 0) { UI.showToast('⚠️ No hay equipos registrados para el alcance seleccionado.'); return; }
    if (typeof window.jspdf === 'undefined') { UI.showToast('❌ No se pudo cargar el módulo de PDF.'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const subtitulo = alcance === 'todos'
      ? 'Reporte General de Equipos — Innovatec / Hackathon'
      : `Reporte General de Equipos — Solo ${alcance}`;

    equipos.forEach((eq, idx) => {
      if (idx > 0) doc.addPage();
      const { grupoClase, cabecera, filas } = this._datosReporteEquipo(eq);
      const col = this._colorCategoria(eq.categoria);

      this._dibujarEncabezadoPDF(doc, eq, subtitulo);
      const infoBottom = this._dibujarInfoEquipoPDF(doc, eq, grupoClase, 74);

      doc.autoTable({
        head: [cabecera],
        body: filas,
        startY: infoBottom,
        styles: { fontSize: 8, cellPadding: 5, lineColor: [222, 226, 232], lineWidth: 0.5 },
        headStyles: { fillColor: col.rgb, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 249, 251] }
      });

      this._dibujarConfirmacionPDF(doc, doc.lastAutoTable.finalY + 18);
      this._dibujarPiePDF(doc, idx + 1, equipos.length);
    });

    const sufijo = alcance === 'todos' ? 'Todos' : alcance;
    doc.save(`Reporte_General_Equipos_${sufijo}_${new Date().toISOString().slice(0,10)}.pdf`);
    UI.showToast('✅ Reporte general PDF generado correctamente.');
  },

  // Aplica el estilo común (título, franja de categoría, tabla, firmas) a una
  // hoja de Excel para un equipo. Se reutiliza en el reporte individual y en
  // cada hoja del reporte general para mantener el mismo look & feel.
  _estilizarHojaEquipo(ws, eq, grupoClase, cabecera, filas) {
    const col = this._colorCategoria(eq.categoria);
    const nCols = cabecera.length;
    const lastColLetter = ws.getColumn(nCols).letter || String.fromCharCode(64 + nCols);

    // Título con franja de color institucional
    ws.mergeCells(`A1:${lastColLetter}1`);
    ws.getCell('A1').value = 'INATEC — Centro Tecnológico Ariel Darce';
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4EA2' } };
    ws.getCell('A1').alignment = { vertical: 'middle' };
    ws.getRow(1).height = 22;

    ws.mergeCells(`A2:${lastColLetter}2`);
    ws.getCell('A2').value = `Reporte de Equipo — ${eq.nombreEquipo}`;
    ws.getCell('A2').font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.argb } };
    ws.getCell('A2').alignment = { vertical: 'middle' };

    ws.getCell('A4').value = 'Categoría:';
    ws.getCell('B4').value = eq.categoria;
    ws.getCell('B4').font = { bold: true, color: { argb: col.argb } };
    ws.getCell('A5').value = 'Proyecto:';
    ws.getCell('B5').value = eq.nombreProyecto || '—';
    ws.getCell('D5').value = 'Grupo de Clases:';
    ws.getCell('E5').value = grupoClase ? (grupoClase.codigo || grupoClase.nombre) : 'Sin asignar';
    ws.getCell('A6').value = 'Profesor Guía:';
    ws.getCell('B6').value = (grupoClase && grupoClase.docenteGuia) ? grupoClase.docenteGuia : 'No asignado';
    ['A4', 'A5', 'D5', 'A6'].forEach(c => ws.getCell(c).font = { bold: true });

    const headerRowIdx = 8;
    const headerRow = ws.getRow(headerRowIdx);
    cabecera.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.height = 18;
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.argb } };
      cell.border = { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    filas.forEach((fila, idx) => {
      const row = ws.getRow(headerRowIdx + 1 + idx);
      fila.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.border = { top: { style: 'hair', color: { argb: 'FFE5E7EB' } }, bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.argbClaro } };
      });
    });

    ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: nCols } };
    ws.views = [{ state: 'frozen', ySplit: headerRowIdx }];

    const finalRow = headerRowIdx + filas.length + 2;
    ws.getCell(`A${finalRow}`).value = '¿El equipo confirma su participación?';
    ws.getCell(`A${finalRow}`).font = { bold: true };
    ws.getCell(`C${finalRow}`).value = 'SÍ ☐';
    ws.getCell(`D${finalRow}`).value = 'NO ☐';
    ws.getCell(`A${finalRow + 2}`).value = 'Firma Coordinador de Equipo: ____________________________';
    ws.getCell(`E${finalRow + 2}`).value = 'Firma Profesor Guía: ____________________________';

    const anchos = { 'Nombres': 18, 'Apellidos': 18, 'Correo': 26, 'Teléfono': 14, 'Cédula': 16, 'Rol': 20, 'Grupo de Clases': 18, 'Profesor Guía': 22 };
    ws.columns.forEach((c, i) => { c.width = anchos[cabecera[i]] || 20; });
  },

  async exportarReporteExcel(equipoId) {
    const eq = DataEngine.getEquipoById(equipoId);
    if (!eq) return;
    if (typeof ExcelJS === 'undefined') { UI.showToast('❌ No se pudo cargar el módulo de Excel.'); return; }

    const { grupoClase, cabecera, filas } = this._datosReporteEquipo(eq);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(eq.nombreEquipo.substring(0, 28) || 'Equipo');
    this._estilizarHojaEquipo(ws, eq, grupoClase, cabecera, filas);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_${eq.nombreEquipo.replace(/\s+/g, '_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    UI.showToast('✅ Reporte Excel generado correctamente.');
  },

  // [NUEVO] Reporte GENERAL en Excel: un solo libro con una hoja (tabla) por
  // cada equipo registrado, en vez de exportar equipo por equipo.
  async exportarReporteGeneralExcel() {
    const alcance = this._filtroReporte || 'todos';
    const equipos = alcance === 'todos' ? DataEngine.getEquipos() : DataEngine.getEquipos().filter(eq => eq.categoria === alcance);
    if (equipos.length === 0) { UI.showToast('⚠️ No hay equipos registrados para el alcance seleccionado.'); return; }
    if (typeof ExcelJS === 'undefined') { UI.showToast('❌ No se pudo cargar el módulo de Excel.'); return; }

    const wb = new ExcelJS.Workbook();
    const nombresUsados = {};

    // Hoja índice/resumen al inicio del libro
    const wsResumen = wb.addWorksheet('Resumen');
    wsResumen.mergeCells('A1:D1');
    wsResumen.getCell('A1').value = 'INATEC — Centro Tecnológico Ariel Darce';
    wsResumen.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    wsResumen.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4EA2' } };
    wsResumen.getRow(1).height = 22;
    wsResumen.mergeCells('A2:D2');
    wsResumen.getCell('A2').value = alcance === 'todos' ? 'Reporte General de Equipos — Innovatec / Hackathon' : `Reporte General de Equipos — Solo ${alcance}`;
    wsResumen.getCell('A2').font = { bold: true, size: 11 };
    wsResumen.getCell('A4').value = 'Generado:';
    wsResumen.getCell('B4').value = new Date().toLocaleDateString('es-NI');
    wsResumen.getCell('A4').font = { bold: true };
    wsResumen.getCell('A5').value = 'Total de equipos:';
    wsResumen.getCell('B5').value = equipos.length;
    wsResumen.getCell('A5').font = { bold: true };

    const filaHeaderIdx = 7;
    ['#', 'Equipo', 'Categoría', 'Proyecto'].forEach((h, i) => {
      const cell = wsResumen.getRow(filaHeaderIdx).getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4EA2' } };
    });
    equipos.forEach((eq, i) => {
      const row = wsResumen.getRow(filaHeaderIdx + 1 + i);
      const col = this._colorCategoria(eq.categoria);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = eq.nombreEquipo;
      row.getCell(3).value = eq.categoria;
      row.getCell(3).font = { bold: true, color: { argb: col.argb } };
      row.getCell(4).value = eq.nombreProyecto || '—';
    });
    wsResumen.columns = [{ width: 6 }, { width: 26 }, { width: 14 }, { width: 34 }];

    equipos.forEach(eq => {
      const { grupoClase, cabecera, filas } = this._datosReporteEquipo(eq);

      // Excel no permite hojas con más de 31 caracteres ni nombres repetidos.
      let nombreHoja = (eq.nombreEquipo || 'Equipo').replace(/[\\/*?:[\]]/g, '').substring(0, 28) || 'Equipo';
      if (nombresUsados[nombreHoja] !== undefined) {
        nombresUsados[nombreHoja]++;
        nombreHoja = `${nombreHoja} (${nombresUsados[nombreHoja]})`;
      } else {
        nombresUsados[nombreHoja] = 0;
      }

      const ws = wb.addWorksheet(nombreHoja, {
        properties: { tabColor: { argb: this._colorCategoria(eq.categoria).argb } }
      });
      this._estilizarHojaEquipo(ws, eq, grupoClase, cabecera, filas);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sufijo = alcance === 'todos' ? 'Todos' : alcance;
    a.download = `Reporte_General_Equipos_${sufijo}_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    UI.showToast('✅ Reporte general Excel generado correctamente.');
  }
};
