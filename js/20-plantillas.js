/* ═══════════════════════════════════════════════════════════════
   20-plantillas.js — Plantillas de estructura de evaluaciones
   Un docente arma una vez las columnas de parciales de un módulo
   (Parcial 1, Laboratorios, Total…) y las reusa en cualquier grupo
   o un nuevo ciclo escolar: nada de repetir el trabajo a mano.
   Sincronizado con el centro: también vive en
   centers/<centro>/plantillas para que la institución comparta.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.Plantillas = (function () {
  const CLAVE = 'tic-plantillas-notas';

  function database() { return (window.FirebaseServices || {}).database || null; }
  function centerId() { return (AuthManager && AuthManager.profile) ? AuthManager.profile.centerId : null; }

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') || []; }
    catch (_) { return []; }
  }
  function anotar(pl) {
    const lista = leer().filter(t => t.id !== pl.id);
    lista.unshift(pl);
    try { localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, 30))); } catch (_) { }
    // Compartida con el centro (la base institucional, no la cuenta personal)
    const db = database();
    if (db && centerId()) {
      try { db.ref(`centers/${centerId()}/plantillas/${pl.id}`).set(pl); } catch (_) { }
    }
  }
  function borrar(id) {
    const lista = leer().filter(t => t.id !== id);
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (_) { }
    const db = database();
    if (db && centerId()) {
      db.ref(`centers/${centerId()}/plantillas/${id}`).remove().catch(() => { });
    }
  }

  /* ── Guardar la estructura actual del módulo como plantilla ── */
  function guardarDesdeGrupo(grupoId, modulo, nombreElegido) {
    const grupo = DataEngine.getGrupoById(grupoId);
    if (!grupo) return null;
    const cols = ((grupo.estructuraModulos || {})[modulo] || {}).columnasOrdenadas || [];
    const editables = cols.filter(c => !c.esTotal);
    if (!editables.length) { UI.showToast('⚠ Este módulo aún no tiene columnas de evaluación.', 'warning'); return null; }
    const nombre = String(nombreElegido || '').trim();
    if (!nombre) { UI.showToast('⚠ Escribe un nombre para la plantilla.', 'warning'); return null; }
    const plantilla = {
      id: 'pl-' + Date.now().toString(36),
      nombre: nombre,
      modulo: modulo,
      columnas: JSON.parse(JSON.stringify(editables)),
      ts: new Date().toISOString(),
      por: (AuthManager && AuthManager.profile) ? AuthManager.profile.nombre || '' : ''
    };
    anotar(plantilla);
    UI.showToast(`✔ Plantilla «${nombre}» guardada (${editables.length} columna(s)).`, 'success');
    return plantilla;
  }

  /* ── Aplicar a un grupo+módulo: añade las que faltan (o reemplaza) ── */
  async function aplicar(id, grupoId, modulo, reemplazar) {
    const plantilla = leer().find(t => t.id === id);
    if (!plantilla) { UI.showToast('⚠ La plantilla ya no existe.', 'warning'); return; }
    const grupo = DataEngine.getGrupoById(grupoId);
    if (!grupo) return;
    if (!grupo.estructuraModulos) grupo.estructuraModulos = {};
    if (!grupo.estructuraModulos[modulo]) grupo.estructuraModulos[modulo] = { columnasOrdenadas: [] };
    const config = grupo.estructuraModulos[modulo];
    const actuales = config.columnasOrdenadas || [];
    const copia = JSON.parse(JSON.stringify(plantilla.columnas));
    if (reemplazar) {
      config.columnasOrdenadas = [...copia, ...(actuales.filter(c => c.esTotal))];
      UI.showToast(`✔ Estructura reemplazada: ${copia.length} columna(s).`, 'success');
    } else {
      const presentes = new Set(actuales.map(c => CuadernoEngine.normalizarTexto(c.nombreDisplay)));
      const nuevas = copia.filter(c => !presentes.has(CuadernoEngine.normalizarTexto(c.nombreDisplay)));
      if (!nuevas.length) { UI.showToast('Ya tienes esas columnas: nada que añadir.', 'info'); return; }
      actuales.push(...nuevas);
      UI.showToast(`✔ ${nuevas.length} columna(s) añadidas (${plantilla.nombre}).`, 'success');
    }
    if (typeof Auditoria !== 'undefined') {
      Auditoria.registrar('Plantilla de evaluaciones', `${grupo.nombre}: ${plantilla.nombre} → ${modulo}`);
    }
    try { await DataEngine.save(); } catch (_) { } /* save() avisa su cuenta */
    UI.actualizarTablaCuaderno();
  }

  /* ── Las plantillas guardadas en la base compartida del centro
     bajan a este navegador (una sola vía, sin pisar las propias) ── */
  let yaSincronizado = false;
  function sincronizarRemotas() {
    const db = database();
    if (yaSincronizado || !db || !centerId()) return;
    yaSincronizado = true;
    db.ref(`centers/${centerId()}/plantillas`).once('value')
      .then(snap => {
        const remotas = Object.values(snap.val() || {}).filter(p => p && p.id);
        if (!remotas.length) return;
        const claves = new Set(leer().map(t => t.id));
        const nuevas = remotas.filter(p => !claves.has(p.id));
        if (!nuevas.length) return;
        try { localStorage.setItem(CLAVE, JSON.stringify([...nuevas, ...leer()].slice(0, 30))); } catch (_) { }
        UI.showToast(`📥 ${nuevas.length} plantilla(s) compartidas por el centro.`, 'info');
      })
      .catch(() => { });
  }

  /* ── Barra de acciones sobre la tabla del cuaderno ── */
  function botoneria(contenedor, moduloFiltro) {
    sincronizarRemotas();
    const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
    if (!contenedor || !grupoId || moduloFiltro === 'ALL') return;
    const previa = contenedor.querySelector('.plantillas-bar');
    if (previa) previa.remove();
    const barra = document.createElement('div');
    barra.className = 'plantillas-bar no-imprimir';
    barra.innerHTML =
      `<button type="button" class="btn-ghost" onclick="Plantillas.dialogoGuardar('${grupoId.replace(/'/g, "\\'")}', '${String(moduloFiltro).replace(/'/g, "\\'")}')">` +
      `<i class="ri-booklet-line" aria-hidden="true"></i> Guardar esta estructura</button>` +
      `<button type="button" class="btn-ghost" onclick="Plantillas.dialogoAplicar('${grupoId.replace(/'/g, "\\'")}', '${String(moduloFiltro).replace(/'/g, "\\'")}')">` +
      `<i class="ri-file-copy-2-line" aria-hidden="true"></i> Plantillas (${leer().length})</button>`;
    contenedor.prepend(barra);
  }

  /* ── Diálogos propios (plano, sin alert nativo) ── */
  function modal(html, clase) {
    let marco = document.getElementById('plantillas-modal');
    if (!marco) {
      marco = document.createElement('div');
      marco.id = 'plantillas-modal';
      marco.setAttribute('role', 'dialog');
      marco.setAttribute('aria-modal', 'true');
      document.body.appendChild(marco);
      marco.addEventListener('click', e => { if (e.target === marco) marco.dataset.abierto = ''; });
    }
    marco.className = 'plantillas-modal ' + (clase || '');
    marco.dataset.abierto = 'si';
    marco.innerHTML = `<div class="plantillas-modal-caja" role="document">${html}</div>`;
  }
  function cerrar() {
    const marco = document.getElementById('plantillas-modal');
    if (marco) { marco.dataset.abierto = ''; marco.innerHTML = ''; }
  }

  function dialogoGuardar(grupoId, modulo) {
    const grupo = DataEngine.getGrupoById(grupoId);
    modal(`
      <h3 class="plantillas-titulo"><i class="ri-booklet-line" aria-hidden="true"></i> Guardar estructura como plantilla</h3>
      <p class="plantillas-nota">Las columnas de evaluación de <strong>${UI.escaparTexto(grupo ? grupo.nombre : '')} · ${UI.escaparTexto(modulo)}</strong> quedarán disponibles para aplicar a cualquier grupo.</p>
      <form id="form-plantilla-guardar">
        <input type="text" id="plantilla-nombre" class="form-control" maxlength="60" placeholder="Ej.: Técnico Básico — 3 parciales" required />
        <div class="plantillas-acciones">
          <button type="submit" class="btn-primary-soft"><i class="ri-save-3-line" aria-hidden="true"></i> Guardar plantilla</button>
          <button type="button" class="btn-ghost" onclick="Plantillas.cerrar()">Cancelar</button>
        </div>
      </form>`);
    const form = document.getElementById('form-plantilla-guardar');
    form?.addEventListener('submit', e => {
      e.preventDefault();
      guardarDesdeGrupo(grupoId, modulo, document.getElementById('plantilla-nombre').value);
      cerrar();
      botoneria(document.getElementById('contenedor-tabla-cuaderno'), modulo);
    });
    document.getElementById('plantilla-nombre')?.focus();
  }

  function dialogoAplicar(grupoId, modulo) {
    const lista = leer();
    const grupo = DataEngine.getGrupoById(grupoId);
    const filas = lista.length ? lista.map(p =>
      `<div class="plantilla-item">
        <div class="plantilla-texto">
          <strong>${UI.escaparTexto(p.nombre)}</strong>
          <small>${p.columnas.length} columna(s) · ${UI.escaparTexto(p.modulo === modulo ? 'este módulo' : p.modulo)} · ${UI.escaparTexto(p.por || '')}</small>
        </div>
        <button type="button" class="btn-primary-soft" onclick="Plantillas.aplicarDialogo('${p.id}','${grupoId.replace(/'/g, "\\'")}','${String(modulo).replace(/'/g, "\\'")}')">
          <i class="ri-file-copy-2-line" aria-hidden="true"></i> Aplicar
        </button>
        <button type="button" class="btn-icon" onclick="Plantillas.borrar('${p.id}');Plantillas.cerrar();Plantillas.botoneria(document.getElementById('contenedor-tabla-cuaderno'),'${String(modulo).replace(/'/g, "\\'")}')" title="Eliminar plantilla" aria-label="Eliminar plantilla">
          <i class="ri-delete-bin-6-line" aria-hidden="true"></i>
        </button>
      </div>`).join('')
      : '<p class="audit-vacio">No hay plantillas todavía: configura primero las columnas en un módulo y guárdalas como plantilla.</p>';
    modal(`
      <h3 class="plantillas-titulo"><i class="ri-file-copy-2-line" aria-hidden="true"></i> Plantillas de evaluaciones</h3>
      <p class="plantillas-nota">Se aplican a <strong>${UI.escaparTexto(grupo ? grupo.nombre : '')} · ${UI.escaparTexto(modulo)}</strong>. De primera mano se añaden solo las columnas que falten — nada se pisa por accidente.</p>
      ${filas}
      <div class="plantillas-acciones"><button type="button" class="btn-ghost" onclick="Plantillas.cerrar()">Cerrar</button></div>`);
  }

  /* Confirmar el reemplazo, si el docente lleva plantilla a un módulo
     que ya trae columnas distintas. */
  function aplicarDialogo(id, grupoId, modulo) {
    cerrar();
    aplicar(id, grupoId, modulo, false);
  }

  return {
    guardarDesdeGrupo: guardarDesdeGrupo,
    aplicar: aplicar,
    aplicarDialogo: aplicarDialogo,
    listar: leer,
    borrar: borrar,
    dialogoGuardar: dialogoGuardar,
    dialogoAplicar: dialogoAplicar,
    botoneria: botoneria,
    cerrar: cerrar
  };
})();
