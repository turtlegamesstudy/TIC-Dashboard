'use strict';
/* ═══════════════════════════════════════════════════════════════
   INFORME ENGINE — Llenado automático del "Informe de avance
   acciones formativas en Modalidad Virtual" (formato oficial INATEC)
   a partir de los datos ya cargados en el Dashboard TIC.

   Cómo funciona:
   1) El profesor asigna (una sola vez) cada Grupo de Clase a la fila
      del informe que le corresponde (English A1, Carreras del CNFDI,
      etc.). Esa asignación se guarda en db.json.
   2) Los 4 Módulos Transversales que coinciden con el informe
      (Historia e Identidad Nacional, Adaptación al Cambio Climático,
      Orientación Laboral, Optativo/Cultura de Paz) se calculan 100%
      automático para TODOS los grupos, porque esos datos ya existen
      en el cuaderno.
   3) Con un clic se descarga el .docx oficial ya lleno.

   Requiere que en index.html estén cargados PizZip y Docxtemplater
   (CDN) y que exista el archivo de plantilla
   "plantilla_informe_avance.docx" en la raíz del proyecto (junto a
   index.html). Ver RUTA_PLANTILLA más abajo si lo guardas en otra
   carpeta.
   ═══════════════════════════════════════════════════════════════ */

// Filas del informe que NO se pueden calcular solas (dependen de a
// qué "carrera/curso" pertenece cada Grupo de Clase). El profesor las
// asigna manualmente una sola vez desde la vista.
const INFORME_FILAS_MANUALES = [
  { key: 'r1', label: 'English A1 Breakthrough' },
  { key: 'r2', label: 'English A2 Waystage' },
  { key: 'r7', label: 'Cursos libres virtuales' },
  { key: 'r8', label: 'Carrera Virtuales' },
  { key: 'r9', label: 'Carreras del CNFDI' },
  { key: 'r10', label: 'Cursos de Capacitación CNFDI' }
];

// Filas que SÍ se calculan 100% automático porque coinciden con los
// Módulos Transversales que ya llevas en el Cuaderno Docente.
// OJO: en la plantilla .docx oficial, la fila impresa como "Optativo."
// usa las etiquetas {r11_...}, y ese componente es en realidad el
// Módulo Transversal "Cultura de Paz" (ya se registra solo por
// estudiante en el Cuaderno Docente, no requiere asignar grupos).
//
// El módulo de cada fila se resuelve en cada uso (getter) y por NOMBRE,
// no por posición: el centro puede añadir módulos ("Inglés") o quitar
// alguno mientras la app está abierta y estas filas siguen apuntando al
// módulo correcto. Si un módulo oficial desaparece, la fila queda en 0.
function buscarModuloTransversal(fragmento) {
  const normalizar = texto => String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const clave = normalizar(fragmento);
  if (!clave) return '';
  return MODULOS_TRANSVERSALES.find(modulo => normalizar(modulo).includes(clave)) || '';
}

const INFORME_FILAS_TRANSVERSALES = [
  { key: 'r3', label: 'Historia e identidad Nacional', get modulo() { return buscarModuloTransversal('historia e identidad'); } },
  { key: 'r4', label: 'Adaptación al cambio climático', get modulo() { return buscarModuloTransversal('cambio climático'); } },
  { key: 'r5', label: 'Orientación laboral', get modulo() { return buscarModuloTransversal('orientación laboral'); } },
  { key: 'r11', label: 'Optativo (Cultura de Paz)', get modulo() { return buscarModuloTransversal('cultura de paz'); } }
];

const InformeEngine = {
  RUTA_PLANTILLA: './plantilla_informe_avance.docx',

  getConfig() {
    if (!DataEngine.db.informe) {
      DataEngine.db.informe = { centro: '', periodo: '', umbral: 60, mapeo: {}, dificultades: '', planAccion: '' };
    }
    if (!DataEngine.db.informe.mapeo) DataEngine.db.informe.mapeo = {};
    return DataEngine.db.informe;
  },

  async actualizarCampo(campo, valor) {
    const cfg = this.getConfig();
    const previousValue = cfg[campo];
    cfg[campo] = valor;
    try {
      await DataEngine.save();
    } catch (error) {
      if (DataEngine.db.informe === cfg) cfg[campo] = previousValue;
      console.error('No se pudo guardar la configuración del informe:', error);
    }
  },

  async actualizarMapeo(grupoId, valor) {
    const cfg = this.getConfig();
    const previousValue = cfg.mapeo[grupoId];
    if (!valor) delete cfg.mapeo[grupoId]; else cfg.mapeo[grupoId] = valor;
    try {
      await DataEngine.save();
      this.refrescarPreview();
    } catch (error) {
      if (DataEngine.db.informe === cfg) {
        if (previousValue === undefined) delete cfg.mapeo[grupoId];
        else cfg.mapeo[grupoId] = previousValue;
      }
      console.error('No se pudo guardar el mapeo del informe:', error);
    }
  },

  refrescarPreview() {
    const cont = document.getElementById('informe-preview-container');
    if (cont) cont.innerHTML = this.renderPreviewHTML();
  },

  // [CÁLCULO PRINCIPAL] Calcula los datos reales del informe usando
  // exactamente la misma lógica de estados que usa el Cuaderno Docente
  // y Estadísticas (convalidaciones, notas, retirados).
  calcularDatosInforme() {
    const cfg = this.getConfig();
    const umbral = Number(cfg.umbral) || 60;
    const grupos = DataEngine.getGrupos();

    const todosEst = DataEngine.getEstudiantes();
    const activos = todosEst.filter(e => e.estado === 'Activo');
    const retirados = todosEst.filter(e => e.estado === 'Retirado');

    const filasTransversales = INFORME_FILAS_TRANSVERSALES.map(f => {
      let convalidado = 0, sinAvance = 0, finalizado = 0;
      activos.forEach(e => {
        if (e.convalidaciones && e.convalidaciones[f.modulo]) { convalidado++; return; }
        const modData = e.evaluacionesPorModulo ? e.evaluacionesPorModulo[f.modulo] : null;
        const notasObj = modData ? (modData.notas || modData.evaluaciones) : null;
        const vals = notasObj ? Object.values(notasObj).filter(v => typeof v === 'number') : [];
        if (vals.length === 0) { sinAvance++; return; }
        const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
        if (prom >= umbral) finalizado++;
      });
      const pendiente = Math.max(activos.length - convalidado - sinAvance - finalizado, 0);
      return {
        key: f.key, label: f.label, auto: true,
        grupos: grupos.length, mi: todosEst.length, ma: activos.length,
        conv: convalidado, ret: retirados.length, pend: pendiente, sin: sinAvance, fin: finalizado
      };
    });

    const filasManuales = INFORME_FILAS_MANUALES.map(f => {
      const asignados = grupos.filter(g => cfg.mapeo[g.id] === f.key);
      let mi = 0, ma = 0, ret = 0;
      asignados.forEach(g => {
        const ests = g.estudiantes || [];
        mi += ests.length;
        ma += ests.filter(e => e.estado === 'Activo').length;
        ret += ests.filter(e => e.estado === 'Retirado').length;
      });
      return {
        key: f.key, label: f.label, auto: false,
        grupos: asignados.length, mi, ma, conv: '-', ret, pend: '-', sin: '-', fin: '-'
      };
    });

    const mapaFilas = {};
    filasManuales.forEach(f => mapaFilas[f.key] = f);
    filasTransversales.forEach(f => mapaFilas[f.key] = f);
    const filas = ['r1', 'r2', 'r3', 'r4', 'r5', 'r11', 'r7', 'r8', 'r9', 'r10'].map(k => mapaFilas[k]);

    // Grupos críticos: activos con más de 30% sin ninguna nota en los
    // módulos transversales, o con alguna baja registrada.
    const criticos = grupos.map(g => {
      const ests = g.estudiantes || [];
      const act = ests.filter(e => e.estado === 'Activo');
      const inactivo = ests.filter(e => e.estado === 'Retirado').length;
      let sinAvanceCount = 0;
      act.forEach(e => {
        const tieneAlgo = INFORME_FILAS_TRANSVERSALES.some(f => {
          if (e.convalidaciones && e.convalidaciones[f.modulo]) return true;
          const modData = e.evaluacionesPorModulo ? e.evaluacionesPorModulo[f.modulo] : null;
          const notasObj = modData ? (modData.notas || modData.evaluaciones) : null;
          const vals = notasObj ? Object.values(notasObj).filter(v => typeof v === 'number') : [];
          return vals.length > 0;
        });
        if (!tieneAlgo) sinAvanceCount++;
      });
      const filaKey = cfg.mapeo[g.id];
      const filaInfo = INFORME_FILAS_MANUALES.find(f => f.key === filaKey);
      const componente = filaInfo ? filaInfo.label : 'Módulos Transversales';
      return {
        componente, carrera: g.carrera || '', grupo: g.nombre || g.id,
        ma: act.length, sin: sinAvanceCount, inactivo
      };
    })
      .filter(c => c.ma > 0 && (c.sin / c.ma >= 0.3 || c.inactivo > 0))
      .sort((a, b) => (b.sin / (b.ma || 1)) - (a.sin / (a.ma || 1)))
      .slice(0, 8);

    return {
      centro: cfg.centro || '', periodo: cfg.periodo || '',
      dificultades: cfg.dificultades || '', planAccion: cfg.planAccion || '',
      filas, criticos, umbral
    };
  },

  renderPreviewHTML() {
    const d = this.calcularDatosInforme();
    const filaHTML = f => `<tr>
      <td>${f.label}${f.auto ? ' <span style="color:var(--accent-green,#16a34a);font-size:0.7rem;">(auto)</span>' : ''}</td>
      <td style="text-align:center;">${f.grupos}</td>
      <td style="text-align:center;">${f.mi}</td>
      <td style="text-align:center;">${f.ma}</td>
      <td style="text-align:center;">${f.conv}</td>
      <td style="text-align:center;">${f.ret}</td>
      <td style="text-align:center;">${f.pend}</td>
      <td style="text-align:center;">${f.sin}</td>
      <td style="text-align:center;">${f.fin}</td>
    </tr>`;

    const criticosHTML = d.criticos.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:12px;">No se detectaron grupos críticos por ahora.</td></tr>`
      : d.criticos.map(c => `<tr>
          <td>${c.componente}</td><td>${c.carrera}</td><td>${c.grupo}</td>
          <td style="text-align:center;">${c.ma}</td>
          <td style="text-align:center;">${c.sin}</td>
          <td style="text-align:center;">${c.inactivo}</td>
        </tr>`).join('');

    return `
      <div class="table-container" style="margin-bottom:16px;">
        <table class="custom-table">
          <thead><tr>
            <th>Componente/Módulo</th><th>Grupos</th><th>Mat. Inicial</th><th>Mat. Actual</th>
            <th>Convalidado</th><th>Retirado</th><th>Pendientes</th><th>Sin Avance</th><th>Finalizado</th>
          </tr></thead>
          <tbody>${d.filas.map(filaHTML).join('')}</tbody>
        </table>
      </div>
      <p style="font-size:0.78rem;color:var(--text-muted);margin:0 0 16px;">
        Las filas marcadas <strong>(auto)</strong> se calculan solas con los datos del Cuaderno Docente.
        Las demás dependen de cómo asignaste tus Grupos de Clase arriba; sus columnas de
        Convalidado/Pendientes/Sin Avance/Finalizado no se pueden calcular con los datos disponibles
        y quedan marcadas con "-" para que las completes tú si aplica.
      </p>
      <div class="table-container">
        <table class="custom-table">
          <thead><tr>
            <th>Componente</th><th>Carrera</th><th>Grupo de Clase</th><th>Mat. Actual</th><th>Sin Avance</th><th>Inactivo</th>
          </tr></thead>
          <tbody>${criticosHTML}</tbody>
        </table>
      </div>
    `;
  },

  renderVista() {
    const cfg = this.getConfig();
    const grupos = DataEngine.getGrupos();

    const opcionesFila = (grupoId) => {
      const actual = cfg.mapeo[grupoId] || '';
      let html = `<option value="">-- No incluir en este informe --</option>`;
      INFORME_FILAS_MANUALES.forEach(f => {
        html += `<option value="${f.key}" ${actual === f.key ? 'selected' : ''}>${f.label}</option>`;
      });
      return html;
    };

    const filasGrupos = grupos.length === 0
      ? `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:16px;">No hay grupos cargados todavía.</td></tr>`
      : grupos.map(g => `<tr>
          <td><strong>${g.nombre}</strong></td>
          <td>${g.carrera || ''}</td>
          <td>
            <select class="form-control" style="min-width:260px;" onchange="InformeEngine.actualizarMapeo('${g.id}', this.value)">
              ${opcionesFila(g.id)}
            </select>
          </td>
        </tr>`).join('');

    return `
      <div class="module-fade-enter">
        <div class="view-header">
          <h1><i class="ri-file-word-2-line"></i> Informe de Avance (Word)</h1>
          <p>Llena automáticamente el "Informe de avance acciones formativas en Modalidad Virtual" con los datos que ya tienes en el Dashboard.</p>
        </div>

        <div class="chart-box" data-section-settings style="margin-bottom:20px;">
          <h3><i class="ri-building-2-line"></i> Datos del encabezado</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:10px;">
            <div>
              <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">Centro Tecnológico</label>
              <input type="text" class="form-control" value="${cfg.centro || ''}" placeholder="Ej: Centro Tecnológico Ariel Darce"
                onchange="InformeEngine.actualizarCampo('centro', this.value)">
            </div>
            <div>
              <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">Periodo reportado</label>
              <input type="text" class="form-control" value="${cfg.periodo || ''}" placeholder="Ej: Agosto 2026"
                onchange="InformeEngine.actualizarCampo('periodo', this.value)">
            </div>
          </div>
          <div style="margin-top:14px;max-width:260px;">
            <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">Nota mínima aprobatoria (para "Finalizado")</label>
            <input type="number" class="form-control" value="${cfg.umbral || 60}" min="0" max="100"
              onchange="InformeEngine.actualizarCampo('umbral', this.value); InformeEngine.refrescarPreview();">
          </div>
        </div>

        <div class="chart-box" data-section-settings style="margin-bottom:20px;">
          <h3><i class="ri-list-check-2"></i> Asigna cada Grupo de Clase a su fila del informe</h3>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:-4px;">
            Los Módulos Transversales (Historia e Identidad Nacional, Adaptación al Cambio Climático, Orientación Laboral, Optativo/Cultura de Paz) ya se calculan solos, no hace falta asignarlos aquí.
          </p>
          <div class="table-container">
            <table class="custom-table">
              <thead><tr><th>Grupo</th><th>Carrera</th><th>Fila del informe</th></tr></thead>
              <tbody>${filasGrupos}</tbody>
            </table>
          </div>
        </div>

        <div class="chart-box" style="margin-bottom:20px;">
          <h3><i class="ri-eye-line"></i> Vista previa</h3>
          <div id="informe-preview-container">${this.renderPreviewHTML()}</div>
        </div>

        <div class="chart-box" data-section-settings style="margin-bottom:20px;">
          <h3><i class="ri-edit-2-line"></i> Secciones 3 y 4 (redacción manual)</h3>
          <div style="margin-bottom:14px;">
            <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">Principales dificultades e incidencias presentadas durante el periodo</label>
            <textarea class="form-control" rows="3" style="resize:vertical;" placeholder="Escribe aquí, se copiará al Word tal cual..."
              onchange="InformeEngine.actualizarCampo('dificultades', this.value)">${cfg.dificultades || ''}</textarea>
          </div>
          <div>
            <label style="font-weight:600;font-size:0.85rem;display:block;margin-bottom:4px;">Plan de acción para superar dificultades e incidencias</label>
            <textarea class="form-control" rows="3" style="resize:vertical;" placeholder="Escribe aquí, se copiará al Word tal cual..."
              onchange="InformeEngine.actualizarCampo('planAccion', this.value)">${cfg.planAccion || ''}</textarea>
          </div>
        </div>

        <div style="text-align:right;">
          <button class="btn-primary" onclick="InformeEngine.generarDocumento()">
            <i class="ri-download-2-line"></i> Generar y Descargar Informe (Word)
          </button>
        </div>
      </div>
    `;
  },

  async generarDocumento() {
    if (typeof PizZip === 'undefined' || typeof window.docxtemplater === 'undefined') {
      UI.showToast('⚠️ No se pudo cargar el motor de Word (PizZip/Docxtemplater). Revisa tu conexión a internet.');
      return;
    }
    const datos = this.calcularDatosInforme();
    if (!datos.centro || !datos.periodo) {
      UI.showToast('⚠️ Completa el Centro Tecnológico y el Periodo reportado antes de generar.');
      return;
    }

    try {
      const response = await fetch(this.RUTA_PLANTILLA);
      if (!response.ok) throw new Error('No se encontró "plantilla_informe_avance.docx" en el proyecto');
      const contenido = await response.arrayBuffer();
      const zip = new PizZip(contenido);
      const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      const limpiar = (t) => (t || '').replace(/\r?\n+/g, ' ').trim();
      const tags = {
        centro: datos.centro,
        periodo: datos.periodo,
        dificultades: limpiar(datos.dificultades) || '_______________________________________________',
        plan_accion: limpiar(datos.planAccion) || '_______________________________________________'
      };
      datos.filas.forEach(f => {
        tags[`${f.key}_grupos`] = f.grupos;
        tags[`${f.key}_mi`] = f.mi;
        tags[`${f.key}_ma`] = f.ma;
        tags[`${f.key}_conv`] = f.conv;
        tags[`${f.key}_ret`] = f.ret;
        tags[`${f.key}_pend`] = f.pend;
        tags[`${f.key}_sin`] = f.sin;
        tags[`${f.key}_fin`] = f.fin;
      });
      for (let i = 1; i <= 8; i++) {
        const c = datos.criticos[i - 1];
        tags[`gc${i}_comp`] = c ? c.componente : '';
        tags[`gc${i}_carrera`] = c ? c.carrera : '';
        tags[`gc${i}_grupo`] = c ? c.grupo : '';
        tags[`gc${i}_ma`] = c ? c.ma : '';
        tags[`gc${i}_sin`] = c ? c.sin : '';
        tags[`gc${i}_inactivo`] = c ? c.inactivo : '';
      }

      doc.render(tags);
      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      const fecha = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `Informe_Avance_${(datos.centro || 'Centro').replace(/\s+/g, '_')}_${fecha}.docx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = nombreArchivo;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      UI.showToast('📄 Informe de avance generado y descargado correctamente.');
    } catch (err) {
      console.error('Error generando informe:', err);
      UI.showToast('❌ Error al generar el informe: ' + err.message);
    }
  }
};