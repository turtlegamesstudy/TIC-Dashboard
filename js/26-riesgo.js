'use strict';
/* ════════════════════════════════════════════════════════════════════════
   26-riesgo.js — Alertas de riesgo académico

   Detección LOCAL (sin red) de estudiantes con señales de alerta en el
   grupo activo del Cuaderno Docente:

   · Notas: módulo con promedio por debajo del umbral de aprobación
     (60, igual que el semáforo del cuaderno; 2+ módulos reprobados
     suben la alerta a "alto").
   · Asistencia: ausencia en ≥ 20 % de las sesiones registradas para
     ese estudiante (mínimo 3 sesiones; ≥ 30 % es "alto").
   · Se ignoran retirados y módulos convalidados.

   Se pinta como una barra (junto a la de Asistencia) justo sobre la
   tabla del cuaderno: cuenta los casos y despliega el detalle.
   ════════════════════════════════════════════════════════════════════════ */
window.Riesgo = (function () {

  const UMBRAL = 60;        // misma meta de aprobación del cuaderno
  const SESIONES_MIN = 3;   // pocas asistencias no generan ruido
  const PCT_FALTAS = 20;    // % de ausencias que dispara la alerta
  const PCT_ALTO = 30;      // % que la sube a nivel alto

  /* Nota final de un estudiante en un módulo, con la MISMA fórmula
     del cuaderno; si el motor no está, promedia las notas simples. */
  function notaFinal(estudiante, modulo) {
    try {
      if (typeof CuadernoEngine !== 'undefined' && typeof CuadernoEngine.notaFinalModuloSistema === 'function') {
        return CuadernoEngine.notaFinalModuloSistema(estudiante, modulo, null);
      }
    } catch (_) { /* cae al cálculo de respaldo */ }
    const informe = estudiante?.evaluacionesPorModulo?.[modulo];
    const fuente = informe?.notas || informe?.evaluaciones || {};
    const valores = Object.values(fuente)
      .map(valor => (typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'))))
      .filter(Number.isFinite);
    if (!valores.length) return null;
    return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100;
  }

  /* Asistencia acumulada del grupo: { id: { ses, faltas, tardes } } */
  function asistencias(grupo) {
    const salida = Object.create(null);
    Object.entries(grupo?.asistencia || {}).forEach(([, mapa]) => {
      if (!mapa || typeof mapa !== 'object') return;
      Object.entries(mapa).forEach(([id, valor]) => {
        if (!id) return;
        const a = (salida[id] = salida[id] || { ses: 0, faltas: 0, tardes: 0 });
        a.ses += 1;
        if (valor === 'A') a.faltas += 1;
        else if (valor === 'T') a.tardes += 1;
      });
    });
    return salida;
  }

  /* Módulos a evaluar: estructura definida → módulos observados en las
     evaluaciones (grupos antiguos sin estructura) → transversales. */
  function modulosDe(grupo) {
    const estructura = grupo?.estructuraModulos && Object.keys(grupo.estructuraModulos);
    if (estructura && estructura.length) return estructura;
    const vistos = new Set();
    (grupo?.estudiantes || []).forEach(estudiante => {
      Object.keys(estudiante?.evaluacionesPorModulo || {}).forEach(modulo => vistos.add(modulo));
    });
    if (vistos.size) return Array.from(vistos);
    return (typeof MODULOS_TRANSVERSALES !== 'undefined' && Array.isArray(MODULOS_TRANSVERSALES))
      ? MODULOS_TRANSVERSALES.slice() : [];
  }

  /* Informe del grupo: { grupo, total, estudiantes: [{estudiante, motivos}] } */
  function evaluarGrupo(grupo) {
    const salida = [];
    const mapaAsistencia = asistencias(grupo);
    const modulos = modulosDe(grupo);
    (grupo?.estudiantes || []).forEach(estudiante => {
      if (!estudiante || estudiante.estado === 'Retirado') return;
      const convalidaciones = estudiante.convalidaciones || {};
      const motivos = [];
      let reprobados = 0;
      const detalleNotas = [];
      modulos.forEach(modulo => {
        if (convalidaciones[modulo]) return; // exención: no es reprobar
        const nota = notaFinal(estudiante, modulo);
        if (nota !== null && nota < UMBRAL) {
          reprobados += 1;
          detalleNotas.push(`${modulo}: ${nota}`);
        }
      });
      if (reprobados) {
        motivos.push({
          tipo: 'Notas',
          nivel: reprobados >= 2 ? 'alto' : 'medio',
          detalle: `${reprobados} módulo(s) bajo ${UMBRAL} — ${detalleNotas.slice(0, 2).join(' · ')}${detalleNotas.length > 2 ? ' · …' : ''}`
        });
      }
      const a = mapaAsistencia[String(estudiante.id)];
      if (a && a.ses >= SESIONES_MIN) {
        const pct = Math.round((a.faltas / a.ses) * 100);
        if (pct >= PCT_FALTAS) {
          motivos.push({
            tipo: 'Asistencia',
            nivel: pct >= PCT_ALTO ? 'alto' : 'medio',
            detalle: `${a.faltas} falta(s) en ${a.ses} registro(s)${a.tardes ? ` · ${a.tardes} tarde(s)` : ''}`
          });
        }
      }
      if (motivos.length) salida.push({ estudiante, motivos });
    });
    return { grupo: grupo?.id || null, total: salida.length, estudiantes: salida };
  }

  function niveles(informe) {
    let alto = 0;
    informe.estudiantes.forEach(fila => { if (fila.motivos.some(m => m.nivel === 'alto')) alto += 1; });
    return { alto, medio: informe.total - alto };
  }

  /* Barra sobre la tabla del cuaderno (convive con la de Asistencia). */
  function botoneria(contenedor) {
    if (!contenedor) return;
    contenedor.querySelectorAll('.riesgo-wrap').forEach(nodo => nodo.remove());
    const grupoId = document.getElementById('select-grupo-cuaderno')?.value;
    if (!grupoId) return;
    const grupo = typeof DataEngine !== 'undefined' ? DataEngine.getGrupoById(grupoId) : null;
    if (!grupo || !(grupo.estudiantes || []).length) return;
    const informe = evaluarGrupo(grupo);
    if (!informe.total) return;
    const { alto, medio } = niveles(informe);
    const escapar = typeof UI !== 'undefined' && typeof UI.escaparTexto === 'function'
      ? UI.escaparTexto
      : texto => String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const filas = informe.estudiantes.slice(0, 15).map(fila => {
      const nombre = [fila.estudiante.nombres, fila.estudiante.apellidos].filter(Boolean).join(' ');
      return `<div class="riesgo-fila">
          <span class="riesgo-nombre"><i class="${fila.motivos.some(m => m.nivel === 'alto') ? 'ri-error-warning-fill' : 'ri-information-fill'}" aria-hidden="true"></i>${escapar(nombre)}</span>
          <span class="riesgo-motivos">${fila.motivos.map(m => `<em class="riesgo-motivo nivel-${m.nivel}">${escapar(m.tipo)} · ${escapar(m.detalle)}</em>`).join('')}</span>
        </div>`;
    }).join('');
    const wrap = document.createElement('div');
    wrap.className = 'riesgo-wrap no-imprimir';
    wrap.innerHTML = `
      <button type="button" class="riesgo-toggle" aria-expanded="false">
        <i class="ri-alarm-warning-line" aria-hidden="true"></i>
        <b>${informe.total}</b> estudiante(s) en riesgo académico
        ${alto ? `<small>· ${alto} alto</small>` : ''}${medio ? `<small>· ${medio} medio</small>` : ''}
        <i class="ri-arrow-down-s-line riesgo-flecha"></i>
      </button>
      <div class="riesgo-panel" hidden>
        ${filas}
        ${informe.total > 15 ? `<p class="riesgo-mas">… y ${informe.total - 15} más en el informe</p>` : ''}
      </div>`;
    const toggles = wrap.querySelector('.riesgo-toggle');
    toggles.addEventListener('click', () => {
      const panel = wrap.querySelector('.riesgo-panel');
      panel.hidden = !panel.hidden;
      toggles.setAttribute('aria-expanded', String(!panel.hidden));
      wrap.classList.toggle('abierto', !panel.hidden);
    });
    const barra = contenedor.querySelector('.asistencia-bar');
    if (barra && barra.parentNode === contenedor) {
      barra.insertAdjacentElement('afterend', wrap);
    } else {
      contenedor.prepend(wrap);
    }
  }

  return { UMBRAL, notaFinal, asistencias, modulosDe, evaluarGrupo, botoneria };
})();
