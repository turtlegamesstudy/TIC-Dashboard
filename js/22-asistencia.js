/* ═══════════════════════════════════════════════════════════════
   22-asistencia.js — Asistencia rápida
   Tomar lista de un grupo en un par de toques: cada estudiante
   alterna Presente → Tarde → Ausente con un solo click; se guarda
   con fecha dentro del propio registro del grupo (viaja igual
   que las notas, con la misma cache offline del PWA).
   Estructura: grupo.asistencia[ '2026-10-17' ] = { <idEst>: 'P'|'T'|'A' }
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.Asistencia = (function () {

  const ETIQUETAS = { P: 'Presente', T: 'Tarde', A: 'Ausente' };
  /* Marcas aceptadas al leer registros viejos; cualquier otra cosa es Presente. */
  const VALIDAS = { P: 'P', T: 'T', A: 'A' };

  function hoy(fechaElegida) {
    if (fechaElegida) return fechaElegida;
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }

  function leerRegistro(grupo, fecha) {
    const mapa = (grupo.asistencia || {})[fecha] || {};
    const limpio = {};
    Object.keys(mapa).forEach(id => { limpio[id] = VALIDAS[mapa[id]] || 'P'; });
    return limpio;
  }

  /* ── Barra con fecha + resumen del día, sobre la tabla del cuaderno ── */
  function botoneria(contenedor) {
    if (!contenedor) return;
    const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
    const previa = contenedor.querySelector('.asistencia-bar');
    if (previa) previa.remove();
    if (!grupoId) return;
    const grupo = DataEngine.getGrupoById(grupoId);
    if (!grupo || !(grupo.estudiantes || []).length) return;
    const fecha = hoy();
    const registro = leerRegistro(grupo, fecha);
    const tomada = Object.keys(registro).length;
    let resumen = 'Sin tomar hoy';
    if (tomada) {
      const p = Object.values(registro).filter(v => v === 'P').length;
      const t = Object.values(registro).filter(v => v === 'T').length;
      const a = Object.values(registro).filter(v => v === 'A').length;
      resumen = `✔ Tomada · ${p} P · ${t} T · ${a} A`;
    }
    const barra = document.createElement('div');
    barra.className = 'asistencia-bar no-imprimir';
    barra.innerHTML =
      `<button type="button" class="btn-ghost" onclick="Asistencia.dialogo('${grupoId.replace(/'/g, "\\'")}')">` +
      `<i class="ri-calendar-check-line" aria-hidden="true"></i> Asistencia</button>` +
      `<small class="asistencia-resumen">${UI.escaparTexto(resumen)}</small>`;
    contenedor.prepend(barra);
  }

  /* ── Diálogo: lista del grupo con chips de 3 estados ── */
  function dialogo(grupoId) {
    const grupo = DataEngine.getGrupoById(grupoId);
    if (!grupo || !(grupo.estudiantes || []).length) {
      UI.showToast('⚠ Ese grupo no tiene estudiantes.', 'warning');
      return;
    }
    const fecha = hoy();
    const registro = leerRegistro(grupo, fecha);
    const filas = grupo.estudiantes.map(est => {
      const estado = registro[est.id] || 'P';
      const retirado = est.estado === 'Retirado';
      return `<div class="asi-fila ${retirado ? 'es-retirado' : ''}" data-id="${est.id}">
        <span class="asi-nombre">${UI.escaparTexto(`${est.nombres || ''} ${est.apellidos || ''}`.trim())}${retirado ? ' <em>(retirado)</em>' : ''}</span>
        <button type="button" class="asi-chip asi-${estado}" data-estado="${estado}"
          title="Click cambia: Presente → Tarde → Ausente"
          onclick="Asistencia.ciclar(this)">${ETIQUETAS[estado]}</button>
      </div>`;
    }).join('');

    let marco = document.getElementById('asistencia-modal');
    if (!marco) {
      marco = document.createElement('div');
      marco.id = 'asistencia-modal';
      marco.className = 'plantillas-modal';
      marco.setAttribute('role', 'dialog');
      marco.setAttribute('aria-modal', 'true');
      document.body.appendChild(marco);
      marco.addEventListener('click', e => { if (e.target === marco) Asistencia.cerrar(); });
    }
    marco.dataset.abierto = 'si';
    marco.innerHTML = `<div class="plantillas-modal-caja" role="document">
      <h3 class="plantillas-titulo"><i class="ri-calendar-check-line" aria-hidden="true"></i> Tomar asistencia</h3>
      <p class="plantillas-nota"><strong>${UI.escaparTexto(grupo.nombre || '')}</strong> · ${UI.escaparTexto(fecha)}. Un click por estudiante: <span class="asi-P">Presente</span> → <span class="asi-T">Tarde</span> → <span class="asi-A">Ausente</span>. Guarda directo en la base, funciona sin internet.</p>
      <div class="asi-acciones-rapidas">
        <button type="button" class="btn-ghost" onclick="Asistencia.marcarTodos('P','${grupoId.replace(/'/g, "\\'")}')"><i class="ri-check-double-line" aria-hidden="true"></i> Todos presentes</button>
      </div>
      <div class="asi-lista" role="list">${filas}</div>
      <div class="plantillas-acciones">
        <button type="button" class="btn-primary-soft" onclick="Asistencia.guardar('${grupoId.replace(/'/g, "\\'")}','${fecha}')"><i class="ri-save-3-line" aria-hidden="true"></i> Guardar asistencia</button>
        <button type="button" class="btn-ghost" onclick="Asistencia.cerrar()">Cancelar</button>
      </div></div>`;
  }

  function ciclar(boton) {
    const orden = { P: 'T', T: 'A', A: 'P' };
    const siguiente = orden[boton.dataset.estado] || 'P';
    boton.dataset.estado = siguiente;
    boton.className = 'asi-chip asi-' + siguiente;
    boton.textContent = ETIQUETAS[siguiente];
  }

  function marcarTodos(estado, grupoId) {
    document.querySelectorAll('#asistencia-modal .asi-fila').forEach(fila => {
      if (fila.classList.contains('es-retirado')) return;
      const boton = fila.querySelector('.asi-chip');
      boton.dataset.estado = estado;
      boton.className = 'asi-chip asi-' + estado;
      boton.textContent = ETIQUETAS[estado];
    });
  }

  async function guardar(grupoId, fecha) {
    const grupo = DataEngine.getGrupoById(grupoId);
    if (!grupo) return;
    const mapa = {};
    let cuenta = 0;
    document.querySelectorAll('#asistencia-modal .asi-fila').forEach(fila => {
      const estado = fila.querySelector('.asi-chip')?.dataset.estado;
      if (estado) mapa[fila.dataset.id] = estado;
      if (estado === 'P' || estado === 'T') cuenta++;
    });
    if (!grupo.asistencia) grupo.asistencia = {};
    grupo.asistencia[fecha] = mapa;
    cerrar();
    try {
      await DataEngine.save();
      UI.showToast(`✔ Asistencia guardada: ${cuenta} de ${Object.keys(mapa).length} presente(s).`, 'success');
      if (typeof Auditoria !== 'undefined') {
        Auditoria.registrar('Asistencia', `${grupo.nombre} · ${fecha} · ${Object.keys(mapa).length} estudiante(s)`);
      }
    } catch (err) {
      UI.showToast('⚠ No se pudo guardar: ' + (err.message || err), 'error');
    }
    botoneria(document.getElementById('contenedor-tabla-cuaderno'));
  }

  function cerrar() {
    const marco = document.getElementById('asistencia-modal');
    if (marco) { marco.dataset.abierto = ''; marco.innerHTML = ''; }
  }

  return { botoneria: botoneria, dialogo: dialogo, ciclar: ciclar, marcarTodos: marcarTodos, guardar: guardar, cerrar: cerrar };
})();
