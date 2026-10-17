/* ═══════════════════════════════════════════════════════════════
   19-auditoria.js — Auditoría institucional + Papelera de restore
   PARTE 1 · Auditoría: cada acción sensible deja una fila con
   usuario, fecha, centro y detalle. Se guarda en la base compartida
   (centers/<centro>/auditoria) y se refleja en localStorage para que
   sobreviva a caídas de red; el panel de Administración la muestra.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.Auditoria = (function () {
  const CLAVE = 'tic-auditoria';
  const MAX = 300;
  const MOSTRAR = 50;

  function database() { return (window.FirebaseServices || {}).database || null; }
  function centerId() { return (AuthManager && AuthManager.profile) ? AuthManager.profile.centerId : null; }
  function perfil() { return (AuthManager && AuthManager.profile) ? AuthManager.profile : {}; }

  function leerLocal() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') || []; }
    catch (_) { return []; }
  }

  function guardarLocal(filas) {
    try { localStorage.setItem(CLAVE, JSON.stringify(filas.slice(0, MAX))); }
    catch (_) { /* sin almacenamiento: la fila queda solo remota */ }
  }

  function registrar(accion, detalle) {
    const fila = {
      ts: new Date().toISOString(),
      uid: (AuthManager && AuthManager.user) ? AuthManager.user.uid : null,
      nombre: perfil().nombre || 'Sesión desconocida',
      rol: perfil().rol || '',
      centro: perfil().centro || perfil().centerId || '',
      accion: String(accion || ''),
      detalle: String(detalle || '')
    };
    const local = leerLocal();
    local.unshift(fila);
    guardarLocal(local);
    const db = database();
    if (db && centerId()) {
      try { db.ref(`centers/${centerId()}/auditoria`).push(fila); }
      catch (_) { /* offline: ya quedó en la copia local */ }
    }
    return fila;
  }

  function escape(v) {
    return UI && UI.escaparTexto
      ? UI.escaparTexto(String(v == null ? '' : v))
      : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* Panel de Administración: bitácora reciente + papelera de restablecidos. */
  function pintarPaneles() {
    const bitacora = document.getElementById('audit-lista');
    let filas = leerLocal().slice(0, MOSTRAR);
    const db = database();
    if (bitacora && db && centerId()) {
      /* Se complementa con la copia remota (last 50) sin bloquear la vista. */
      db.ref(`centers/${centerId()}/auditoria`).limitToLast(MOSTRAR).once('value')
        .then(snap => {
          const remotas = Object.values(snap.val() || {})
            .filter(f => f && f.ts)
            .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
          if (remotas.length) filas = remotas.slice(0, MOSTRAR);
          bitacora.innerHTML = filasHTML(filas);
        })
        .catch(() => { bitacora.innerHTML = filasHTML(filas); });
      return;
    }
    if (bitacora) bitacora.innerHTML = filasHTML(filas);
  }

  function filasHTML(filas) {
    if (!filas.length) {
      return `<p class="audit-vacio">Sin eventos registrados todavía. Cada eliminación o carga de base quedará aquí con usuario, fecha y detalle.</p>`;
    }
    return `<div class="table-container" style="overflow-x:auto;"><table class="custom-table audit-tabla"><thead><tr>
        <th style="width:150px;">Fecha</th><th style="width:180px;">Usuario</th>
        <th style="width:150px;">Acción</th><th>Detalle</th></tr></thead><tbody>` +
      filas.map(f => `<tr>
        <td style="white-space:nowrap;">${new Date(f.ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${escape(f.nombre)}<br><small style="color:var(--text-muted);">${escape(f.rol || f.centro || '')}</small></td>
        <td><strong>${escape(f.accion)}</strong></td>
        <td style="color:var(--text-secondary);">${escape(f.detalle)}</td>
      </tr>`).join('') + `</tbody></table></div>`;
  }

  return { registrar: registrar, pintarPaneles: pintarPaneles, leerLocal: leerLocal };
})();

/* ═══════════════════════════════════════════════════════════════
   Papelera de Restore: lo eliminado (estudiante / grupo entero)
   se guarda con su snapshot completo en centers/<centro>/papelera
   y en localStorage. Se restauran desde Administración, en orden
   o al completo — nada desaparece para siempre por un clic. ═══ */
window.Papelera = (function () {
  const CLAVE = 'tic-papelera';
  const MAX = 20;

  function database() { return (window.FirebaseServices || {}).database || null; }
  function centerId() { return (AuthManager && AuthManager.profile) ? AuthManager.profile.centerId : null; }

  function guardar(item) {
    item.ts = new Date().toISOString();
    item.uid = (AuthManager && AuthManager.user) ? AuthManager.user.uid : null;
    item.nombre = (AuthManager && AuthManager.profile) ? AuthManager.profile.nombre || '' : '';
    let local = [];
    try { local = JSON.parse(localStorage.getItem(CLAVE) || '[]') || []; } catch (_) { }
    local.unshift(item);
    local = local.slice(0, MAX);
    try { localStorage.setItem(CLAVE, JSON.stringify(local)); } catch (_) { }
    const db = database();
    if (db && centerId()) {
      try {
        item.claveRemota = db.ref(`centers/${centerId()}/papelera`).push().key;
        db.ref(`centers/${centerId()}/papelera/${item.claveRemota}`).set(item);
      } catch (_) { /* offline backup: solo la copia local se conserva */ }
    }
    pintar();
  }

  function listar() {
    try { const l = JSON.parse(localStorage.getItem(CLAVE) || '[]') || []; return l; }
    catch (_) { return []; }
  }

  function quitar(atTimestamp) {
    const lista = listar().filter(f => f.ts !== atTimestamp);
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (_) { }
    pintar();
  }

  async function restaurar(atTimestamp) {
    const item = listar().find(f => f.ts === atTimestamp);
    if (!item) return;
    try {
      if (item.tipo === 'estudiante') {
        const grupo = DataEngine.getGrupoById(item.groupId);
        if (!grupo) throw new Error('el grupo ya no existe');
        grupo.estudiantes.push(item.estudiante);
      } else {
        const yaEsta = Array.isArray(DataEngine.db.grupos) &&
          DataEngine.db.grupos.some(g => g.id === item.grupo.id);
        if (yaEsta) throw new Error('el grupo ya está en la base');
        DataEngine.db.grupos.push(item.grupo);
      }
      await DataEngine.save();
      quitar(item.ts);
      const db = database();
      if (db && centerId() && item.claveRemota) {
        db.ref(`centers/${centerId()}/papelera/${item.claveRemota}`).remove().catch(() => { });
      }
      UI.showToast('✔ Elemento restaurado a la base.', 'success');
      if (typeof Auditoria !== 'undefined') Auditoria.registrar('Restaurar de papelera', item.tipo === 'estudiante' ? `${item.estudiante.nombres || ''} ${item.estudiante.apellidos || ''}` : (item.grupo.nombre || ''));
      UI.renderCurrentModule();
    } catch (error) {
      UI.showToast(`⚠ No se pudo restaurar: ${error.message}`, 'warning');
    }
  }

  function escape(v) { return Auditoria.leerLocal ? String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : String(v == null ? '' : v); }

  function pintar() {
    const lista = document.getElementById('papelera-lista');
    if (!lista) return;
    const items = listar();
    if (!items.length) { lista.innerHTML = '<p class="audit-vacio">La papelera está vacía: lo que se elimine aquí se podrá recuperar.</p>'; return; }
    lista.innerHTML = items.map(i => {
      const titulo = i.tipo === 'estudiante'
        ? `${(i.estudiante.nombres || '') + ' ' + (i.estudiante.apellidos || '')} · grupo ${i.groupName || i.groupId || ''}`
        : `${i.grupo.nombre || ''} · ${Array.isArray(i.grupo.estudiantes) ? i.grupo.estudiantes.length : 0} estudiantes`;
      return `<div class="papelera-item">
        <i class="${i.tipo === 'estudiante' ? 'ri-user-line' : 'ri-inbox-archive-line'}" aria-hidden="true"></i>
        <div class="papelera-texto">
          <strong>${escape(titulo.trim())}</strong>
          <small>Eliminado ${new Date(i.ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} por ${escape(i.nombre || '—')}</small>
        </div>
        <button type="button" class="btn-ghost" onclick="Papelera.restaurar('${i.ts}')" title="Regresa el elemento a la base de datos">
          <i class="ri-arrow-go-back-line" aria-hidden="true"></i> Restaurar
        </button>
      </div>`;
    }).join('');
  }

  return { guardar: guardar, listar: listar, restaurar: restaurar, pintar: pintar };
})();
