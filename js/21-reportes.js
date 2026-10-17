/* ═══════════════════════════════════════════════════════════════
   21-reportes.js — Informes de avance en lote (por estudiante)
   Genera un único documento imprimible/PDF con UNA PÁGINA por
   estudiante del grupo: notas por módulo y columna, promedio final
   y sello del docente. Ideal para entregar a la familia, file del
   centro o firma deEnterIBUTE consecutivo del subdirector.
   No descarga librerías extra: usa la misma lógica de notas del
   Cuaderno (notaFinalModuloSistema) para que todo cuadre.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.Reportes = (function () {

  function notaFinalDe(estudiante, modulo) {
    let cols = null;
    const grupo = DataEngine.getGrupos().find(g => (g.estudiantes || []).some(s => s.id === estudiante.id));
    if (grupo && grupo.estructuraModulos && grupo.estructuraModulos[modulo]) cols = grupo.estructuraModulos[modulo].columnasOrdenadas;
    const perfecta = (typeof CuadernoEngine !== 'undefined' && CuadernoEngine.notaFinalModuloSistema)
      ? CuadernoEngine.notaFinalModuloSistema(estudiante, modulo, cols) : null;
    if (typeof perfecta === 'number') return perfecta;
    const mData = estudiante.evaluacionesPorModulo ? estudiante.evaluacionesPorModulo[modulo] : null;
    const notas = mData ? (mData.notas || mData.evaluaciones) : null;
    const vals = notas ? Object.values(notas).filter(v => typeof v === 'number') : [];
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }

  /* ── Página de un estudiante ── */
  function paginaDe(estudiante, grupo, umbral, incluirRetirados) {
    const retirado = (estudiante.estado === 'Retirado');
    if (retirado && !incluirRetirados) return '';
    const nombre = `${estudiante.nombres || ''} ${estudiante.apellidos || ''}`.trim();
    let filas = '';
    let suma = 0, cuenta = 0;
    MODULOS_TRANSVERSALES.forEach(m => {
      const conv = estudiante.convalidaciones && estudiante.convalidaciones[m];
      let nota = conv ? 'Convalidado' : notaFinalDe(estudiante, m);
      const conval = conv || typeof nota !== 'number';
      filas += `<tr>
        <td>${m}</td>
        <td class="${conval ? 'celda-estado' : (nota >= umbral ? 'celda-ok' : 'celda-riesgo')}">${nota === null ? 'Sin notas' : (conval ? 'Convalidado' : '')}</td>
      </tr>`;
      if (typeof nota === 'number') { suma += nota; cuenta++; }
      // detalle de columnas (parciales) si la estructura existe
      const grupoE = grupo.estructuraModulos && grupo.estructuraModulos[m];
      if (grupoE && grupoE.columnasOrdenadas && !conval) {
        detalles(m, grupoE.columnasOrdenadas, estudiante, meta => {
          filas += meta;
        });
      }
    });

    function detalles(modulo, cols, estudiante, add) {
      cols.filter(c => !c.esTotal).forEach(c => {
        const nota = CuadernoEngine.obtenerNotaEstudiante(estudiante, modulo, c.nombreDisplay);
        if (typeof nota === 'number') {
          add(`<tr class="fila-detalle"><td>&nbsp;&nbsp;· ${c.nombreDisplay}</td><td>${nota}</td></tr>`);
        }
      });
    }

    const promedio = cuenta ? Math.round(suma / cuenta) : null;
    const resultado = cuenta === 0 ? 'Sin calificaciones' : (promedio >= umbral ? 'APROBADO' : 'EN RIESGO');
    return `
      <section class="rep-pagina">
        <header class="rep-cabecera">
          <img src="assets/logo-inatec.png" alt="" class="rep-logo">
          <div class="rep-titulos">
            <div class="rep-institucion">Tecnológico Nacional — INATEC</div>
            <h1>Informe de Avance Académico</h1>
            <div class="rep-sub">${grupo.nombre || ''} · ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </header>
        <p class="rep-datos"><strong>Estudiante:</strong> ${nombre} <span class="rep-datos-sep">|</span>
          <strong>Estado:</strong> ${estudiante.estado || 'Activo'}</p>
        <table class="rep-tabla">
          <thead><tr><th style="text-align:left;">Módulo / Parcial</th><th style="width:120px;">Nota</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <div class="rep-resumen">
          <div class="rep-promedio ${promedio !== null && promedio >= umbral ? 'es-ok' : 'es-riesgo'}">
            <span>Promedio general</span><strong>${promedio === null ? '—' : promedio + '/100'}</strong>
          </div>
          <div class="rep-resultado">${resultado}</div>
        </div>
        <footer class="rep-firmas">
          <div class="rep-firma"><span class="rep-firma-linea"></span>Docente / Instructor</div>
          <div class="rep-firma"><span class="rep-firma-linea"></span>Coordinación académica</div>
        </footer>
      </section>`;
  }

  /* ── Diálogo del diálogo modal (reutiliza el style de las Plantillas) ── */
  function dialogo(grupoId) {
    const grupos = DataEngine.getGrupos();
    const grupo = grupos.find(g => g.id === grupoId) || grupos[0];
    if (!grupo) { UI.showToast('⚠ Crea primero un grupo con estudiantes.', 'warning'); return; }
    const opciones = grupos.map(g => `<option value="${g.id}" ${g.id === grupo.id ? 'selected' : ''}>${UI.escaparTexto(g.nombre)}</option>`).join('');
    let marco = document.getElementById('reportes-modal');
    if (!marco) {
      marco = document.createElement('div');
      marco.id = 'reportes-modal';
      marco.className = 'plantillas-modal';
      marco.setAttribute('role', 'dialog');
      marco.setAttribute('aria-modal', 'true');
      document.body.appendChild(marco);
    }
    marco.dataset.abierto = 'si';
    marco.innerHTML = `<div class="plantillas-modal-caja" role="document">
      <h3 class="plantillas-titulo"><i class="ri-file-group-line" aria-hidden="true"></i> Informes de avance en lote</h3>
      <p class="plantillas-nota">Un documento por cada estudiante, en pleno formato institucional con sus notas por módulo — para imprimir o guardar como PDF (en la ventana de impresión elige «Guardar como PDF»).</p>
      <form id="reportes-form">
        <label class="tb-label" for="rep-grupo">Grupo</label>
        <select id="rep-grupo" class="form-control">${opciones}</select>
        <div class="rep-checks">
          <label><input type="checkbox" id="rep-retirados"> Incluir estudiantes retirados</label>
        </div>
        <div class="plantillas-acciones">
          <button type="submit" class="btn-primary-soft"><i class="ri-printer-line" aria-hidden="true"></i> Generar documento</button>
          <button type="button" class="btn-ghost" onclick="Reportes.cerrar()">Cancelar</button>
        </div>
      </form></div>`;
    document.getElementById('reportes-form')?.addEventListener('submit', e => {
      e.preventDefault();
      cerrar();
      generar(document.getElementById('rep-grupo').value, document.getElementById('rep-retirados').checked);
    });
  }
  function cerrar() {
    const marco = document.getElementById('reportes-modal');
    if (marco) { marco.dataset.abierto = ''; marco.innerHTML = ''; }
  }

  /* ── Genera el documento y abre la ventana de impresión ── */
  function generar(grupoId, incluirRetirados) {
    const grupo = DataEngine.getGrupoById(grupoId);
    if (!grupo || !(grupo.estudiantes || []).length) { UI.showToast('⚠ Ese grupo no tiene estudiantes.', 'warning'); return; }
    const umbral = 60;
    const paginas = grupo.estudiantes.map(e => paginaDe(e, grupo, umbral, incluirRetirados)).filter(Boolean).join('');
    if (!paginas) { UI.showToast('⚠ No salió ninguna página con esa combinación.', 'warning'); return; }
    const centro = (AuthManager && AuthManager.profile) ? AuthManager.profile.centro || '' : '';
    const doc = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
      <title>Informes de avance · ${grupo.nombre || ''}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; color: #111; background: #f5f5f5; }
        .rep-pagina { width: 190mm; min-height: 250mm; margin: 12px auto; padding: 18mm 16mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.15); page-break-after: always; }
        .rep-cabecera { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #E6007E; padding-bottom: 10px; }
        .rep-logo { width: 74px; height: auto; }
        .rep-institucion { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #555; }
        h1 { margin: 2px 0; font-size: 20px; }
        .rep-sub { font-size: 13px; color: #555; }
        .rep-datos { font-size: 13px; margin: 14px 0 10px; }
        .rep-datos-sep { color: #999; margin: 0 8px; }
        .rep-tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
        .rep-tabla th { background: #1a1a1a; color: #fff; padding: 7px 10px; text-align: left; }
        .rep-tabla td { border-bottom: 1px solid #ddd; padding: 6px 10px; }
        .fila-detalle td { font-size: 11.5px; color: #666; padding: 2px 10px; }
        .celda-ok { font-weight: 700; color: #0f7b3a; }
        .celda-riesgo { font-weight: 700; color: #b3261e; }
        .celda-estado { font-style: italic; color: #555; }
        .rep-resumen { display: flex; align-items: center; gap: 18px; margin-top: 16px; }
        .rep-promedio { flex: 1; padding: 10px 14px; border: 1px solid #ccc; border-radius: 5px; }
        .rep-promedio span { display: block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #666; }
        .rep-promedio strong { font-size: 22px; }
        .rep-promedio.es-ok strong { color: #0f7b3a; }
        .rep-promedio.es-riesgo strong { color: #b3261e; }
        .rep-resultado { font-size: 16px; font-weight: 800; letter-spacing: .06em; }
        .rep-firmas { display: flex; gap: 60px; margin-top: 48px; }
        .rep-firma { flex: 1; text-align: center; font-size: 12px; color: #444; }
        .rep-firma-linea { display: block; border-top: 1px solid #333; margin-bottom: 6px; }
        .rep-barra { max-width: 190mm; margin: 10px auto; display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 14px; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.15); }
        .rep-barra button { padding: 10px 18px; border: 0; border-radius: 5px; background: #E6007E; color: #fff; font-weight: 700; cursor: pointer; font-size: 14px; }
        .rep-barra small { color: #666; }
        @media print { .rep-barra { display: none; } body { background: #fff; } .rep-pagina { box-shadow: none; margin: 0; } }
      </style></head><body>
      <div class="rep-barra">
        <small>${(grupo.estudiantes || []).length} estudiante(s) · ${centro}</small>
        <button onclick="window.print()">Imprimir / Guardar como PDF</button>
      </div>
      ${paginas}
      <script>window.print()<\/script></body></html>`;
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    const ventana = window.open(url, '_blank');
    if (!ventana) {
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `Informes_${(grupo.nombre || 'grupo').replace(/\s+/g, '_')}.html`;
      document.body.appendChild(enlace); enlace.click(); enlace.remove();
      UI.showToast('ℹ No se pudo abrir la ventana: descargue el archivo y ábralo para imprimir.', 'info');
    }
    if (typeof Auditoria !== 'undefined') {
      Auditoria.registrar('Reporte en lote', `${grupo.nombre}: ${grupo.estudiantes.length} estudiante(s)`);
    }
  }

  return { dialogo: dialogo, generar: generar, cerrar: cerrar };
})();
