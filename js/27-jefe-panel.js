'use strict';
/* ════════════════════════════════════════════════════════════════════════
   27-jefe-panel.js — Panel del Jefe de Departamento

   Vista consolidada EN PANTALLA (no solo exportación) del alcance de
   cada Jefe configurado en Cuaderno → Configurar responsables
   (cuadernoConfig.jefesDepartamento: jefe + turnos).

   Alcance: los grupos cuyo turno responde a ese jefe — con la MISMA
   resolución que usa la impresión de cuadernos
   (CuadernoEngine.obtenerJefeDepartamento(grupo)) para que el panel y
   los documentos SIEMPRE cuadren.

   El jefe entra por nombre; administrador y Global además pueden
   revisar el alcance de cualquier jefe con el selector.
   Cálculo local (sin red) sobre la base del centro.
   ════════════════════════════════════════════════════════════════════════ */
window.JefePanel = (function () {

  const norm = valor => String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  const escapar = valor => String(valor ?? '')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function jefesConfigurados() {
    try {
      if (typeof CuadernoEngine !== 'undefined' && typeof CuadernoEngine.obtenerJefesDepartamento === 'function') {
        return CuadernoEngine.obtenerJefesDepartamento();
      }
    } catch (_) { /* sin configuración: lista vacía */ }
    return [];
  }

  /* ¿A qué jefe corresponde la cuenta que abrió la sección? */
  function yoComoJefe() {
    const nombre = norm(typeof UI !== 'undefined' && typeof UI.nombreDocente === 'function'
      ? UI.nombreDocente()
      : (typeof AuthManager !== 'undefined'
        ? (AuthManager.profile?.displayName || AuthManager.user?.displayName || '')
        : ''));
    if (!nombre) return null;
    const jefes = jefesConfigurados();
    const exacto = jefes.find(j => norm(j.nombre) === nombre);
    if (exacto) return exacto;
    return jefes.find(j => {
      const otros = norm(j.nombre);
      return otros && (nombre.includes(otros) || otros.includes(nombre));
    }) || null;
  }

  /* Grupos del alcance del jefe — misma resolución que la impresión. */
  function gruposDe(jefe) {
    if (!jefe || typeof DataEngine === 'undefined' || !DataEngine.db) return [];
    const lista = [];
    (DataEngine.db.grupos || []).forEach(grupo => {
      try {
        if (norm(typeof CuadernoEngine !== 'undefined' && CuadernoEngine.obtenerJefeDepartamento
          ? (CuadernoEngine.obtenerJefeDepartamento(grupo) || '')
          : '') === norm(jefe.nombre)) lista.push(grupo);
      } catch (_) { /* grupo si resumen: se omite */ }
    });
    return lista;
  }

  /* Módulos del grupo: estructura → módulos observados → transversales
     (misma regla que Riesgo.modulosDe para que las cifras cuadren). */
  function modulosDe(grupo) {
    const estructura = grupo?.estructuraModulos && Object.keys(grupo.estructuraModulos);
    if (estructura && estructura.length) return estructura;
    if (typeof Riesgo !== 'undefined' && typeof Riesgo.modulosDe === 'function') {
      return Riesgo.modulosDe(grupo);
    }
    const vistos = new Set();
    (grupo?.estudiantes || []).forEach(estudiante => {
      Object.keys(estudiante?.evaluacionesPorModulo || {}).forEach(modulo => vistos.add(modulo));
    });
    if (vistos.size) return Array.from(vistos);
    return (typeof MODULOS_TRANSVERSALES !== 'undefined' && Array.isArray(MODULOS_TRANSVERSALES))
      ? MODULOS_TRANSVERSALES.slice() : [];
  }

  /* Promedio del grupo reutilizando la fórmula oficial del cuaderno. */
  function promedioGrupo(grupo) {
    const valores = [];
    const modulos = modulosDe(grupo);
    (grupo?.estudiantes || []).forEach(estudiante => {
      if (estudiante?.estado !== 'Activo') return;
      modulos.forEach(modulo => {
        if (estudiante.convalidaciones && estudiante.convalidaciones[modulo]) return;
        try {
          const nota = CuadernoEngine.notaFinalModuloSistema(estudiante, modulo, null);
          if (typeof nota === 'number' && Number.isFinite(nota)) valores.push(nota);
        } catch (_) { /* notas malformadas: se omiten */ }
      });
    });
    if (!valores.length) return null;
    return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
  }

  /* Informe completo del alcance; se aprovechan Riesgo y Recordatorios
     para no duplicar criterios. */
  function informe(grupo) {
    const activos = (grupo?.estudiantes || []).filter(e => e?.estado === 'Activo').length;
    const retirados = (grupo?.estudiantes || []).length - activos;
    let riesgo = 0, alto = 0;
    if (typeof Riesgo !== 'undefined') {
      const r = Riesgo.evaluarGrupo(grupo);
      riesgo = r.total;
      r.estudiantes.forEach(fila => { if (fila.motivos.some(m => m.nivel === 'alto')) alto += 1; });
    }
    const fecha = (typeof Recordatorios !== 'undefined' && Recordatorios.hoy) ? Recordatorios.hoy() : '';
    const asistenciaHoy = Boolean(fecha && (grupo.asistencia || {})[fecha]);
    const sinNotas = (typeof Recordatorios !== 'undefined' && Recordatorios.modulosSinNotas)
      ? Recordatorios.modulosSinNotas(grupo) : [];
    return {
      grupo,
      activos,
      retirados,
      riesgo,
      alto,
      riesgoMax: alto > 0 ? 'alto' : (riesgo ? 'medio' : ''),
      promedio: promedioGrupo(grupo),
      asistenciaHoy,
      sinNotas: sinNotas.length
    };
  }

  function renderVista() {
    const rol = typeof AuthManager !== 'undefined' ? AuthManager.profile?.role : null;
    if (rol === 'invitado') {
      return `<div class="module-fade-enter">${typeof UI !== 'undefined' && UI.estadoVacioHTML ? UI.estadoVacioHTML({
        icono: 'ri-lock-2-line', titulo: 'Vista exclusiva del staff.',
        texto: 'Tu cuenta de invitado no tiene panel de Jefe de Departamento.'
      }) : ''}</div>`;
    }
    const jefes = jefesConfigurados();
    if (!jefes.length) {
      return `<div class="module-fade-enter"><header class="view-header"><div><h1>Panel del Jefe de Departamento</h1>
        <p>Aquí verás el consolidado de los grupos de tu turno.</p></div></header>
        ${typeof UI !== 'undefined' && UI.estadoVacioHTML ? UI.estadoVacioHTML({
          icono: 'ri-settings-4-line', titulo: 'Falta configurar los Jefes de Departamento',
          texto: 'Se definen en Cuaderno Docente → Configurar responsables (jefe y turnos a su cargo). Al existir al menos uno, este panel se llena solo.'
        }) : ''}</div>`;
    }
    const yo = yoComoJefe();
    const indiceInicial = yo ? Math.max(0, jefes.findIndex(j => j.nombre === yo.nombre)) : 0;
    const selector = rol === 'admin' || rol === 'global'
      ? `<label class="tb-label" for="select-jefe-panel"><i class="ri-user-star-line" aria-hidden="true"></i> Alcance</label>
         <select id="select-jefe-panel" onchange="JefePanel.repintar()">${jefes.map((j, i) =>
        `<option value="${i}"${i === indiceInicial ? ' selected' : ''}>${escapar(j.nombre)} — ${escapar((j.turnos || []).join(', '))}</option>`).join('')}</select>`
      : '';
    return `<div class="module-fade-enter">
      <header class="view-header" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
        <div><h1>Panel del Jefe de Departamento</h1>
          <p>Consolidado de grupos, notas, asistencia y riesgo del alcance del jefe.</p></div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">${selector}
          <button type="button" class="btn-primary-soft" onclick="JefePanel.repintar()"><i class="ri-refresh-line" aria-hidden="true"></i> Actualizar</button>
        </div>
      </header>
      <div id="jf-contenido"></div>
    </div>`;
  }

  /* Vista ya abierta: pinta el contenido con el alcance elegido. */
  function repintar() {
    const cont = document.getElementById('jf-contenido');
    if (!cont) return;
    const jefes = jefesConfigurados();
    const rol = typeof AuthManager !== 'undefined' ? AuthManager.profile?.role : null;
    let jefe = null;
    if (rol === 'admin' || rol === 'global') {
      const indice = Number(document.getElementById('select-jefe-panel')?.value ?? 0);
      jefe = jefes[indice] || jefes[0];
    } else {
      jefe = yoComoJefe() || jefes[0];
    }
    if (!jefe) {
      cont.innerHTML = typeof UI !== 'undefined' && UI.estadoVacioHTML ? UI.estadoVacioHTML({
        icono: 'ri-user-search-line', titulo: 'Tu cuenta no aparece como Jefe de Departamento',
        texto: 'Se compara tu nombre registrado con la lista configurada en «Configurar responsables».'
      }) : '';
      return;
    }
    const grupos = gruposDe(jefe);
    if (!grupos.length) {
      cont.innerHTML = typeof UI !== 'undefined' && UI.estadoVacioHTML ? UI.estadoVacioHTML({
        icono: 'ri-group-line', titulo: `Sin grupos a cargo de ${escapar(jefe.nombre)}`,
        texto: 'Ningún grupo del centro tiene el turno que este jefe cubre en la configuración.'
      }) : '';
      return;
    }
    const informes = grupos.map(g => informe(g)).filter(Boolean);
    const totalActivos = informes.reduce((s, i) => s + i.activos, 0);
    const totalRiesgo = informes.reduce((s, i) => s + i.riesgo, 0);
    const totalAlto = informes.reduce((s, i) => s + i.alto, 0);
    const promedios = informes.map(i => i.promedio).filter(n => typeof n === 'number');
    const promedio = promedios.length
      ? Math.round((promedios.reduce((a, b) => a + b, 0) / promedios.length) * 10) / 10 : null;
    const sinAsistenciaHoy = informes.filter(i => !i.asistenciaHoy).length;
    const conNotasPendientes = informes.filter(i => i.sinNotas > 0).length;

    const tarjeta = ({ valor, etiqueta, icono, tono, pie }) => `
      <div class="kpi-card"><span class="kpi-etiqueta"><span class="kpi-texto">${escapar(etiqueta)}</span></span>
        <span class="kpi-cuerpo"><span class="kpi-icono ${tono}"><i class="${icono}" aria-hidden="true"></i></span>
        <span class="kpi-datos"><span class="kpi-valor">${valor}</span><span class="kpi-pie">${pie}</span></span></span></div>`;
    const kpis = [
      tarjeta({ valor: informes.length, etiqueta: 'Grupos del jefe', icono: 'ri-team-line', tono: 'azul', pie: `${totalActivos} estudiante(s) activo(s)` }),
      tarjeta({ valor: promedio === null ? '—' : promedio, etiqueta: 'Promedio general', icono: 'ri-bar-chart-grouped-line', tono: 'verde', pie: 'Media de las notas oficiales' }),
      tarjeta({ valor: totalRiesgo, etiqueta: 'Estudiantes en riesgo', icono: 'ri-alarm-warning-line', tono: totalAlto ? 'rojo' : 'azul', pie: totalAlto ? `${totalAlto} en nivel alto` : 'Sin nivel alto' }),
      tarjeta({ valor: sinAsistenciaHoy, etiqueta: 'Grupos sin asistencia hoy', icono: 'ri-calendar-close-line', tono: sinAsistenciaHoy ? 'rojo' : 'verde', pie: `${conNotasPendientes} grupo(s) con módulos sin notas` })
    ].join('');

    /* Filas de riesgo agregadas (docente, grupo, motivos). */
    const filas = [];
    if (typeof Riesgo !== 'undefined') {
      grupos.forEach(grupo => {
        Riesgo.evaluarGrupo(grupo).estudiantes.forEach(fila => {
          const nivel = fila.motivos.some(m => m.nivel === 'alto') ? 'alto' : 'medio';
          filas.push({
            nombre: [fila.estudiante.nombres, fila.estudiante.apellidos].filter(Boolean).join(' '),
            grupo: grupo.nombre || grupo.id,
            grupoId: String(grupo.id || ''),
            nivel,
            motivos: fila.motivos.map(m => `${m.tipo} · ${m.detalle}`)
          });
        });
      });
      filas.sort((a, b) => (a.nivel === b.nivel ? a.grupo.localeCompare(b.grupo, 'es') : a.nivel === 'alto' ? -1 : 1));
    }
    const tablaRiesgo = filas.length
      ? `<div class="table-container"><table class="custom-table">
          <thead><tr><th>Estudiante</th><th>Grupo</th><th>Nivel</th><th>Señales</th><th></th></tr></thead>
          <tbody>${filas.slice(0, 30).map(fila => `<tr>
            <td><strong>${escapar(fila.nombre)}</strong></td>
            <td>${escapar(fila.grupo)}</td>
            <td><span class="badge-status ${fila.nivel === 'alto' ? 'retirado' : ''}">${fila.nivel === 'alto' ? 'Alto' : 'Medio'}</span></td>
            <td style="font-size:0.74rem;color:var(--text-secondary)">${escapar(fila.motivos.join(' · '))}</td>
            <td style="text-align:center">${_abrirBoton(fila.grupoId)}</td>
          </tr>`).join('')}</tbody></table></div>
          ${filas.length > 30 ? `<p class="jf-mas">… y ${filas.length - 30} más.</p>` : ''}`
      : typeof UI !== 'undefined' && UI.estadoVacioHTML ? UI.estadoVacioHTML({
        icono: 'ri-emotion-happy-line', titulo: 'Sin señales de riesgo en tu alcance', texto: 'Ningún estudiante con notas bajas o ausencias altas por ahora.'
      }) : '';

    cont.innerHTML = `
      <section class="bloque-analisis jf-kpis" aria-label="Resumen del jefe">
        <div class="bloque-titulo"><h2><i class="ri-briefcase-4-line" aria-hidden="true"></i> Alcance: ${escapar(jefe.nombre)}</h2>
          <span class="bloque-nota">${escapar((jefe.turnos || []).join(' · '))} · ${informes.length} grupo(s)</span></div>
        <div class="kpi-grid">${kpis}</div>
      </section>
      <section class="bloque-analisis jf-grupos" aria-label="Grupos por grupo">
        <div class="bloque-titulo"><h2><i class="ri-team-line" aria-hidden="true"></i> Estado por grupo</h2>
          <span class="bloque-nota">Clic en un grupo para abrirlo en el Cuaderno</span></div>
        <div class="pg-cards">${informes.map(i => `
          <button type="button" class="pg-card${i.riesgoMax === 'alto' ? ' pg-card-atencion' : ''}" onclick="Recordatorios.abrirGrupo('${String(i.grupo.id || '').replace(/'/g, "\\'")}')">
            <span class="pg-titulo">${escapar(i.grupo.nombre || i.grupo.id || 'Grupo')}</span>
            <span class="pg-sub">${escapar(i.grupo.turno || '')}${i.grupo.carrera ? ` · ${escapar(i.grupo.carrera)}` : ''}</span>
            <span class="pg-metricas"><b>${i.activos}</b> activos · <b>${i.promedio === null ? '—' : i.promedio}</b> promedio ·
              ${i.riesgo ? `<em>${i.riesgo} riesgo${i.alto ? ' (alto)' : ''}</em>` : '<em>sin riesgo</em>'}</span>
            <span class="pg-chips">
              <em class="pg-chip ${i.asistenciaHoy ? 'ok' : 'pend'}">${i.asistenciaHoy ? '✔ asistencia tomada' : '⏱ sin asistencia hoy'}</em>
              ${i.sinNotas ? `<em class="pg-chip pend">${i.sinNotas} módulo(s) sin notas</em>` : ''}
            </span>
          </button>`).join('')}</div>
      </section>
      <section class="bloque-analisis jf-riesgo" aria-label="Estudiantes en riesgo">
        <div class="bloque-titulo"><h2><i class="ri-alarm-warning-line" aria-hidden="true"></i> Estudiantes en seguimiento</h2>
          <span class="bloque-nota">${filas.length} señal(es) en ${informes.length} grupo(s)</span></div>
        ${tablaRiesgo}
      </section>`;
  }

  /* Botón para abrir un grupo en Cuaderno (id seguro para el atributo). */
  function _abrirBoton(grupoId) {
    if (!grupoId) return '';
    return `<button type="button" class="btn-icon" title="Abrir grupo en el Cuaderno" onclick="Recordatorios.abrirGrupo('${String(grupoId).replace(/'/g, "\\'")}')"><i class="ri-external-link-line"></i></button>`;
  }

  return { renderVista, repintar, gruposDe, informe, promedioGrupo, yoComoJefe };
})();
