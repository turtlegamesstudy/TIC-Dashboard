'use strict';
/* ═══════════════════════════════════════════════════════════════
   STATS ENGINE — Módulo de Estadísticas
   ═══════════════════════════════════════════════════════════════ */

const StatsEngine = {
  calcularPromedioEstudiante(est) {
    if (est.estado === 'Retirado') return null;
    const modulos = MODULOS_TRANSVERSALES;
    let sumaTotal = 0, cantidadTotal = 0;
    modulos.forEach(mod => {
      if (est.convalidaciones?.[mod]) return;
      const modData = est.evaluacionesPorModulo?.[mod];
      const notasObj = modData?.notas || modData?.evaluaciones;
      if (notasObj) {
        const vals = Object.values(notasObj).filter(v => typeof v === 'number');
        if (vals.length > 0) {
          sumaTotal += vals.reduce((a,b) => a+b, 0) / vals.length;
          cantidadTotal++;
        }
      }
    });
    return cantidadTotal > 0 ? Math.round(sumaTotal / cantidadTotal) : null;
  },

  /* Datos del panel aplicando los filtros activos (grupo, estado y
     módulo). Con `f` vacío el cálculo es idéntico al de siempre. */
  obtenerDatos(f = {}) {
    const soloGrupo = f.grupo || '';
    const soloEstado = f.estado || '';
    const soloModulo = f.modulo || '';
    const modulos = MODULOS_TRANSVERSALES.filter(m => !soloModulo || m === soloModulo);
    const listaModulos = modulos.length ? modulos : MODULOS_TRANSVERSALES;
    const grupos = DataEngine.getGrupos().filter(g => !soloGrupo || g.id === soloGrupo);
    let totalEst = 0, activos = 0, retirados = 0, convalidaciones = 0;
    let conNotas = 0, sinNotas = 0;
    const porGrupo = [];
    const porModulo = listaModulos.map(m => ({
      nombre: m,
      conNotas: 0, sinNotas: 0, convalidados: 0,
      sumaPromedios: 0, cuentaPromedios: 0,
      promedioGeneral: 0
    }));
    const ranking = [];

    grupos.forEach(g => {
      const ests = (g.estudiantes || []).filter(e => !soloEstado || (e.estado || '') === soloEstado);
      totalEst += ests.length;
      activos += ests.filter(e => e.estado === 'Activo').length;
      retirados += ests.filter(e => e.estado === 'Retirado').length;

      ests.forEach(e => {
        // El retirado entra en la tabla (y en el CSV), pero queda marcado
        // para que sus notas no contaminen promedios ni cobertura.
        const excluido = e.estado === 'Retirado' && soloEstado !== 'Retirado';

        let sumaMods = 0, cuentaMods = 0, convEst = 0;

        listaModulos.forEach((m, i) => {
          if (e.convalidaciones?.[m]) {
            if (!excluido) {
              porModulo[i].convalidados++;
              convalidaciones++;
            }
            convEst++;
            return;
          }
          const modData = e.evaluacionesPorModulo?.[m];
          const notasObj = modData?.notas || modData?.evaluaciones;
          if (notasObj) {
            const vals = Object.values(notasObj).filter(v => typeof v === 'number');
            if (vals.length > 0) {
              const promMod = vals.reduce((a,b)=>a+b,0)/vals.length;
              if (!excluido) {
                porModulo[i].sumaPromedios += promMod;
                porModulo[i].cuentaPromedios++;
                porModulo[i].conNotas++;
              }
              sumaMods += promMod;
              cuentaMods++;
            } else if (!excluido) {
              porModulo[i].sinNotas++;
            }
          } else if (!excluido) {
            porModulo[i].sinNotas++;
          }
        });

        const promGlobal = cuentaMods > 0 ? Math.round(sumaMods / cuentaMods) : null;
        if (!excluido) {
          if (promGlobal !== null) conNotas++;
          else sinNotas++;
        }
        ranking.push({
          ...e,
          grupo: g.nombre,
          promedio: promGlobal === null ? 0 : promGlobal,
          modsConNota: cuentaMods,
          convalsEst: convEst,
          excluido
        });
      });

      porGrupo.push({ id: g.id, nombre: g.nombre, total: ests.length, activos: ests.filter(e=>e.estado==='Activo').length });
    });

    porModulo.forEach(m => {
      m.promedioGeneral = m.cuentaPromedios > 0 ? Math.round(m.sumaPromedios / m.cuentaPromedios) : 0;
    });

    ranking.sort((a,b) => b.promedio - a.promedio);

    // Indicadores derivados (ver glosario). Los retirados están en la
    // tabla, pero solo entran al promedio si el filtro los incluye.
    const enPromedio = ranking.filter(r => !r.excluido);
    const evaluados = enPromedio.length;
    const conPromedio = enPromedio.filter(r => r.promedio > 0);
    const rendimiento = conPromedio.length
      ? Math.round(conPromedio.reduce((suma, r) => suma + r.promedio, 0) / conPromedio.length)
      : 0;
    const cobertura = evaluados > 0 ? Math.round((conNotas / evaluados) * 100) : 0;
    const enRiesgo = conPromedio.filter(r => r.promedio < 60).length;

    return { totalEst, activos, retirados, convalidaciones, conNotas, sinNotas,
             porGrupo, porModulo, ranking, rendimiento, cobertura, enRiesgo, evaluados };
  },


  /* `extra` es opcional: { valor } cambia la cifra que se muestra
     (unidades reales en vez de un % relativo), { tip } añade el
     texto completo para el tooltip flotante y { filtro } convierte
     la barra en un acceso que aplica ese filtro en Estadísticas. */
  barraCSS(porcentaje, colorVar, label, extra) {
    const ex = extra || {};
    const pct = Math.min(100, Math.max(0, porcentaje));
    const ancho = `${Math.round(pct * 100) / 100}%`;
    const atributo = (clave, valor) => (valor === undefined || valor === null || valor === '') ? '' : ` ${clave}="${String(valor).replace(/"/g, '&quot;')}"`;
    const filtro = ex.filtro ? atributo('data-grafico-filtro', JSON.stringify(ex.filtro)) : '';
    const texto = ex.valor || `${Math.round(pct)}%`;
    return `
      <div class="grafico-barra" data-grafico${atributo('data-grafico-tip', ex.tip || `${label} — ${texto}`)}${filtro}
           role="img" aria-label="${String(label).replace(/"/g, '&quot;')}: ${String(texto).replace(/"/g, '&quot;')}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.82rem; color: var(--text-secondary); font-weight: 500;">${label}</span>
          <span class="grafico-valor" style="font-size: 0.82rem; color: var(${colorVar}); font-weight: 700;">${texto}</span>
        </div>
        <div style="height: 10px; background: var(--bg-input); border-radius: var(--r-full); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);">
          <div style="width: ${ancho}; transform-origin: left center; height: 100%; background: linear-gradient(90deg, var(${colorVar}), var(--neon-purple)); border-radius: var(--r-full); animation: growBar 1s cubic-bezier(0.16,1,0.3,1) 0.2s both; box-shadow: 0 0 12px rgba(10,10,10,0.15);"></div>
        </div>
      </div>
    `;
  },

  /* ══ Gráfica suave (línea / área apilada estilo Google Charts) ══
     Curvas catmull-rom → bezier, rejilla fina, puntos que llevan el
     tooltip global (data-grafico-tip) y relleno con degradado plano
     coloreado desde flat.css (vars --gt-*), así funciona en claro y oscuro. */
  _graficaSVG(series, etiquetasX, max, alto, sufixo = '', guia = null) {
    const esc = UI.escaparTexto;
    const W = 680, P = { t: 16, r: 18, b: 34, l: 42 };
    const iw = W - P.l - P.r, ih = alto - P.t - P.b;
    const maxV = Math.max(max, ...series.flatMap(s => s.data), 1);
    const n = Math.max(etiquetasX.length, 1);
    const xAt = i => P.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
    const yAt = v => P.t + ih - (Math.min(v, maxV) / maxV) * ih;

    const suave = pts => {
      if (pts.length < 3) return pts.map(p => p.join(' ')).join(' L');
      let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d;
    };

    // Series apiladas: acumulan del eje hacia arriba en su orden dado
    const apiladas = series.some(s => s.apilada);
    if (apiladas) {
      const base = new Array(n).fill(0);
      series.forEach(s => {
        const inferior = base.slice();
        s.data.forEach((v, i) => { base[i] += (typeof v === 'number' ? v : 0); });
        s._low = inferior.map(yAt);
        s._top = base.map(yAt);
      });
    }

    const rejilla = [0, 0.25, 0.5, 0.75, 1].map(f => {
      const y = P.t + ih - f * ih;
      const val = Math.round(maxV * f);
      return `<line x1="${P.l}" y1="${y.toFixed(1)}" x2="${P.l + iw}" y2="${y.toFixed(1)}" class="gv-grid"/>` +
        `<text x="${P.l - 7}" y="${(y + 3).toFixed(1)}" class="gv-eje-y" text-anchor="end">${val}${sufixo}</text>`;
    }).join('');

    const guiaLinea = guia ? `<line x1="${P.l}" y1="${yAt(guia.valor).toFixed(1)}" x2="${P.l + iw}" y2="${yAt(guia.valor).toFixed(1)}" class="gv-guia"/>` +
      `<text x="${P.l + iw + 2}" y="${(yAt(guia.valor) - 4).toFixed(1)}" class="gv-eje-y">${esc(guia.etiqueta)}</text>` : '';

    const xLabels = etiquetasX.map((t, i) =>
      `<text x="${xAt(i).toFixed(1)}" y="${alto - 10}" class="gv-eje-x ${i % 2 ? 'gv-impares' : ''}" text-anchor="middle">${esc(String(t).length > 12 ? String(t).slice(0, 11) + '…' : t)}</text>`).join('');

    const capas = series.map((s, idx) => {
      const coords = apiladas ? s._top.map((y, i) => [xAt(i), y]) : s.data.map((v, i) => [xAt(i), yAt(typeof v === 'number' ? v : 0)]);
      const linea = suave(coords);
      const tono = s.tono === 'rosa' ? 'rosa' : 'mono';
      /* El borde inferior recorre de derecha a izquierda: en las series
         apiladas hay que emparejar de nuevo cada y con su x (vienen como
         números sueltos); en las simples solo baja al eje 0. */
      const abajo = apiladas
        ? s._low.slice().reverse().map((y, j) => [coords[coords.length - 1 - j][0], y])
        : coords.slice().reverse().map(c => [c[0], yAt(0)]);
      const relleno = linea + ' L ' + abajo.map(c => c.join(' ')).join(' L ') + ' Z';
      return `<path d="${relleno}" class="gv-area gv-${tono}" fill="url(#grad-${tono}-${Math.min(idx, 2)})" data-grad="grad-${tono}-${Math.min(idx, 2)}"/>` +
        `<path d="${linea}" class="gv-linea gv-${tono}"/>`;
    }).join('');

    // Puntos interactivos encima de las áreas
    const puntos = series.map((s, idx) => {
      const coords = apiladas ? s._top.map((y, i) => [xAt(i), y]) : s.data.map((v, i) => [xAt(i), yAt(typeof v === 'number' ? v : 0)]);
      return coords.map((c, i) => {
        const v = s.data[i];
        const tip = `${etiquetasX[i]} · ${s.nombre}: ${typeof v === 'number' ? Math.round(v * 100) / 100 : '—'}${sufixo}${s.tipExtra ? ' · ' + s.tipExtra(i) : ''}`;
        return `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="4.5" class="gv-punto gv-${s.tono === 'rosa' ? 'rosa' : 'mono'}" data-grafico-tip="${esc(tip).replace(/"/g, '&quot;')}"${s.filtroPor ? ` data-grafico-filtro="${esc(JSON.stringify(s.filtroPor(i))).replace(/"/g, '&quot;')}"` : ''} tabindex="0"/>`;
      }).join('');
    }).join('');

    const leyenda = series.map(s =>
      `<span class="gv-leyenda"><i class="gv-muestra gv-${s.tono === 'rosa' ? 'rosa' : 'mono'}"></i> ${esc(s.nombre)}</span>`).join('');

    return `
      <div class="grafica-suave">
        <svg viewBox="0 0 ${W} ${alto}" class="gv-svg" role="img" aria-label="${esc(series.map(s => s.nombre).join(', '))} por ${esc(etiquetasX.length ? 'categoria' : '')}">
          <defs>
            <linearGradient id="grad-rosa-0" x1="0" y1="0" x2="0" y2="1" class="gv-grad gv-grad-rosa"><stop offset="0"/><stop offset="1"/></linearGradient>
            <linearGradient id="grad-mono-1" x1="0" y1="0" x2="0" y2="1" class="gv-grad gv-grad-mono"><stop offset="0"/><stop offset="1"/></linearGradient>
            <linearGradient id="grad-mono-2" x1="0" y1="0" x2="0" y2="1" class="gv-grad gv-grad-mono2"><stop offset="0"/><stop offset="1"/></linearGradient>
          </defs>
          ${rejilla}${guiaLinea}${capas}${xLabels}${puntos}
        </svg>
        <div class="gv-leyendas">${leyenda}</div>
      </div>`;
  },

  doughnutSVG(valor, total, color, label, sublabel, extra) {
    const ex = extra || {};
    const pct = total > 0 ? (valor / total) * 100 : 0;
    const circ = 2 * Math.PI * 40;
    const offset = circ - (pct / 100) * circ;
    const atributo = (clave, v) => (v === undefined || v === null || v === '') ? '' : ` ${clave}="${String(v).replace(/"/g, '&quot;')}"`;
    const filtro = ex.filtro ? atributo('data-grafico-filtro', JSON.stringify(ex.filtro)) : '';
    const tip = ex.tip || `${label}: ${valor} de ${total} (${Math.round(pct)}%) — ${sublabel}`;
    return `
      <div class="grafico-dona" data-grafico${atributo('data-grafico-tip', tip)}${filtro}
           role="img" aria-label="${String(tip).replace(/"/g, '&quot;')}">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="position: relative; width: 90px; height: 90px; flex-shrink: 0;">
            <svg width="90" height="90" viewBox="0 0 100 100" style="transform: rotate(-90deg);" focusable="false" aria-hidden="true">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-input)" stroke-width="10"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="10"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
                style="filter: drop-shadow(0 0 6px ${color}); animation: drawCircle 1.2s cubic-bezier(0.16,1,0.3,1) both;"/>
            </svg>
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">
              ${Math.round(pct)}%
            </div>
          </div>
          <div>
            <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${label}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${sublabel}</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: ${color}; margin-top: 4px;">${valor}</div>
          </div>
        </div>
      </div>
    `;
  },

  /* ── Filtros persistentes y reversibles ─────────────────────────
     El estado vive en la URL (#/estadisticas?grupo=…&estado=…), así
     que sobrevive a los repintados, se puede compartir como enlace y
     se revierte quitando el chip o con «Limpiar filtros». */
  leerFiltros() {
    const guardados = (typeof UI !== 'undefined' && UI.filtrosGuardados)
      ? UI.filtrosGuardados('estadisticas')
      : {};
    const grupos = DataEngine.getGrupos();
    const grupo = grupos.some(g => g.id === guardados.grupo) ? guardados.grupo : '';
    const estado = (guardados.estado === 'Activo' || guardados.estado === 'Retirado') ? guardados.estado : '';
    const modulo = MODULOS_TRANSVERSALES.includes(guardados.modulo) ? guardados.modulo : '';
    const comparar = (guardados.comparar === 'todos' || grupos.some(g => g.id === guardados.comparar))
      ? guardados.comparar
      : '';
    return { grupo, estado, modulo, comparar };
  },

  cambiarFiltro(clave, valor) {
    if (typeof UI === 'undefined') return;
    const filtros = { ...this.leerFiltros(), [clave]: valor };
    UI.fijarFiltros('estadisticas', filtros);
    UI.renderCurrentModule({ background: true });
  },

  /* Conjunto de referencia para comparar el filtro actual con otro
     grupo o con el total (null cuando la comparación no aporta). */
  datosComparacion(filtros) {
    if (!filtros.comparar) return null;
    const destino = filtros.comparar === 'todos' ? '' : filtros.comparar;
    if (destino === (filtros.grupo || '')) return null;
    try {
      const datos = this.obtenerDatos({ ...filtros, grupo: destino });
      const grupo = DataEngine.getGrupos().find(g => g.id === destino);
      return { datos, etiqueta: grupo ? grupo.nombre : 'todos los grupos' };
    } catch (e) {
      return null;
    }
  },

  kpiHTML({ valor, sufijo = '', etiqueta, ayuda, icono, tono, base }) {
    let delta = '';
    if (base && typeof base.valor === 'number' && typeof valor === 'number') {
      const dif = valor - base.valor;
      const clase = dif > 0 ? 'sube' : dif < 0 ? 'baja' : 'igual';
      const marca = dif > 0 ? '▲ +' : dif < 0 ? '▼ ' : '● ';
      delta = `<span class="kpi-delta ${clase}">${marca}${dif} <span>vs. ${UI.escaparTexto(base.etiqueta)}</span></span>`;
    }
    return `
      <div class="kpi-card">
        <span class="kpi-etiqueta"><span class="kpi-texto">${UI.escaparTexto(etiqueta)}</span>${UI.ayudaHTML(ayuda)}</span>
        <span class="kpi-cuerpo">
          <span class="kpi-icono ${tono}"><i class="${icono}" aria-hidden="true"></i></span>
          <span class="kpi-datos">
            <span class="kpi-valor">${valor}${sufijo ? `<small>${sufijo}</small>` : ''}</span>
            ${delta}
          </span>
        </span>
      </div>`;
  },

  resultadoDe(promedio) {
    if (!promedio) return 'Sin datos';
    return promedio >= 60 ? 'Aprobado' : 'En riesgo';
  },

  claseResultado(promedio) {
    if (!promedio) return 'inactivo';
    return promedio >= 60 ? 'activo' : 'pendiente';
  },

  /* Tabla de detalle en CSV, con los filtros activos ya aplicados. */
  exportarCSV() {
    try {
      const filtros = this.leerFiltros();
      const datos = this.obtenerDatos(filtros);
      if (!datos.ranking.length) {
        UI.showToast('No hay filas para exportar con estos filtros.', 'warning');
        return;
      }
      const filas = datos.ranking.map((e, i) => [
        i + 1,
        `${e.nombres || ''} ${e.apellidos || ''}`,
        e.grupo || '',
        e.estado || 'Activo',
        e.modsConNota || 0,
        e.convalsEst || 0,
        e.promedio || 0,
        this.resultadoDe(e.promedio)
      ]);
      UI.descargarCSV('estadisticas-detalle',
        ['#', 'Estudiante', 'Grupo', 'Estado', 'Módulos con nota', 'Convalidaciones', 'Promedio', 'Resultado'],
        filas);
      UI.showToast(`✅ CSV descargado con ${filas.length} fila(s), filtros aplicados.`);
    } catch (error) {
      console.error('No se pudo exportar el CSV de estadísticas:', error);
      UI.showToast(`No se pudo exportar el CSV: ${error.message}`, 'error');
    }
  },

  /* Glosario desplegable: qué mide cada indicador y cómo se calcula. */
  glosarioHTML() {
    const claves = ['estudiantes', 'activos', 'retirados', 'rendimiento', 'cobertura',
      'convalidaciones', 'promedioModulo', 'enRiesgo', 'sinNotas', 'asistencia', 'usoTIC', 'periodo'];
    const glosario = (typeof UI !== 'undefined' && UI.INDICADORES) ? UI.INDICADORES : {};
    const items = claves.filter(clave => glosario[clave]).map(clave => `
        <div class="glosario-item">
          <h4>${UI.escaparTexto(glosario[clave].titulo)}</h4>
          <p>${UI.escaparTexto(glosario[clave].texto)}</p>
        </div>`).join('');
    return `
      <details class="glosario-panel no-imprimir">
        <summary><i class="ri-book-2-line" aria-hidden="true"></i> ¿Qué significa cada indicador?</summary>
        <div class="glosario-rejilla">${items}
        </div>
      </details>`;
  },

  /* ══ Historial de instantáneas ══
     Cada vez que los datos globales cambian (firma distinta) se guarda
     una copia de los KPI en localStorage. Al renderizar, el punto de
     comparación automático es la última actualización anterior. */
  snapshotKPIs() {
    try {
      const d = this.obtenerDatos({});
      return {
        totalEst: d.totalEst, activos: d.activos, retirados: d.retirados,
        rendimiento: d.rendimiento, cobertura: d.cobertura,
        convalidaciones: d.convalidaciones, enRiesgo: d.enRiesgo,
        conNotas: d.conNotas, sinNotas: d.sinNotas
      };
    } catch (e) { return null; }
  },

  firmaSnapshot(kpis) { return JSON.stringify(kpis); },

  leerHistorial() {
    try {
      const bruto = JSON.parse(localStorage.getItem('tic-stats-historial') || '[]');
      return Array.isArray(bruto) ? bruto.filter(x => x && x.ts && x.kpis) : [];
    } catch (e) { return []; }
  },

  registrarSnapshot() {
    const kpis = this.snapshotKPIs();
    if (!kpis) return;
    const firma = this.firmaSnapshot(kpis);
    const historial = this.leerHistorial();
    const ultimo = historial[historial.length - 1];
    if (ultimo && ultimo.firma === firma) return;
    historial.push({ ts: Date.now(), firma, kpis });
    try { localStorage.setItem('tic-stats-historial', JSON.stringify(historial.slice(-30))); } catch (e) { /* cuota */ }
  },

  /* Referencia automática: la última instantánea cuyo estado de datos
     difiere del actual. Si todo está igual, devuelve la última igual. */
  comparacionAuto() {
    try {
      const historial = this.leerHistorial();
      if (!historial.length) return null;
      const kpis = this.snapshotKPIs();
      if (!kpis) return null;
      const firma = this.firmaSnapshot(kpis);
      let base = null;
      for (let i = historial.length - 1; i >= 0; i--) {
        if (historial[i].firma !== firma) { base = historial[i]; break; }
      }
      if (!base) base = historial[historial.length - 1];
      const fecha = new Date(base.ts);
      const sinCambios = base.firma === firma;
      return {
        sinCambios,
        ts: base.ts,
        actual: kpis,
        datos: {
          totalEst: base.kpis.totalEst, activos: base.kpis.activos,
          retirados: base.kpis.retirados, rendimiento: base.kpis.rendimiento,
          cobertura: base.kpis.cobertura, convalidaciones: base.kpis.convalidaciones
        },
        etiqueta: sinCambios
          ? 'sin cambios desde la última actualización'
          : 'la última actualización (' + fecha.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ')'
      };
    } catch (e) { return null; }
  },

  /* Franja de resumen: qué KPI cambiaron y cuánto, en chips planos. */
  cambiosHTML(auto) {
    if (!auto) return '';
    const items = [
      { etq: 'Estudiantes', icono: 'ri-group-line', clave: 'totalEst', sufijo: '' },
      { etq: 'Activos', icono: 'ri-user-follow-line', clave: 'activos', sufijo: '' },
      { etq: 'Retirados', icono: 'ri-user-unfollow-line', clave: 'retirados', sufijo: '' },
      { etq: 'Rendimiento', icono: 'ri-line-chart-line', clave: 'rendimiento', sufijo: '/100' },
      { etq: 'Cobertura', icono: 'ri-checkbox-circle-line', clave: 'cobertura', sufijo: '%' },
      { etq: 'Convalidaciones', icono: 'ri-award-line', clave: 'convalidaciones', sufijo: '' }
    ].map(f => {
      const actual = auto.actual[f.clave];
      const antes = auto.datos[f.clave];
      const dif = (typeof actual === 'number' && typeof antes === 'number') ? actual - antes : 0;
      const dir = dif > 0 ? 'sube' : dif < 0 ? 'baja' : 'igual';
      const marca = dif > 0 ? '▲' : dif < 0 ? '▼' : '●';
      const texto = dif === 0 ? 'sin cambios' : `${marca} ${dif > 0 ? '+' : ''}${dif}${f.sufijo}`;
      return `<span class="cambio-chip cambio-${dir}"><i class="${f.icono}" aria-hidden="true"></i> ${UI.escaparTexto(f.etq)} <strong>${UI.escaparTexto(texto)}</strong></span>`;
    }).join('');
    const cuando = new Date(auto.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `
      <section class="bloque-analisis cambios-bloque no-imprimir" aria-label="Cambios respecto a la última actualización">
        <div class="bloque-titulo">
          <h2><i class="ri-history-line" aria-hidden="true"></i> vs. última actualización</h2>
          <span class="bloque-nota">${auto.sinCambios ? 'Los datos no han cambiado desde la última captura' : UI.escaparTexto('Cambios detectados desde ' + cuando)}</span>
        </div>
        <div class="cambios-rejilla">${items}</div>
      </section>`;
  },

  renderVistaEstadisticas() {
    const filtros = this.leerFiltros();
    let d = null;
    let errorVista = '';
    try {
      d = this.obtenerDatos(filtros);
    } catch (e) {
      errorVista = (e && e.message) ? e.message : String(e);
    }

    const grupos = DataEngine.getGrupos();
    const hayFiltros = Boolean(filtros.grupo || filtros.estado || filtros.modulo || filtros.comparar);
    const comparacion = errorVista ? null : this.datosComparacion(filtros);
    if (!comparacion && !errorVista) this.registrarSnapshot();
    const auto = (errorVista || comparacion) ? null : this.comparacionAuto();
    const base = comparacion ? comparacion.datos : (auto ? auto.datos : null);
    const etiquetaBase = comparacion ? comparacion.etiqueta : (auto ? auto.etiqueta : 'la última actualización');

    // ── Cabecera y barra de filtros: presentes en todos los estados ──
    const cabecera = `
      <div class="view-header">
        <h1><i class="ri-bar-chart-2-fill"></i> Estadísticas</h1>
        <p>Primero los indicadores esenciales, después los filtros, luego las gráficas y al final la tabla de detalle. Cada métrica lleva un ícono <strong>ⓘ</strong> con su definición y los filtros quedan guardados en el enlace para poder compartirlos.</p>
      </div>`;

    const opcionesGrupo = (excluir) => grupos
      .filter(g => g.id !== excluir)
      .map(g => `<option value="${UI.escaparTexto(g.id)}">${UI.escaparTexto(g.nombre)}</option>`)
      .join('');

    const barraFiltros = `
      <div class="barra-filtros no-imprimir" role="search" aria-label="Filtros del panel de estadísticas">
        <div class="campo-filtro">
          <label class="tb-label" for="st-grupo"><i class="ri-team-line"></i> Grupo</label>
          <select id="st-grupo" class="form-control" onchange="StatsEngine.cambiarFiltro('grupo', this.value)">
            <option value="">Todos los grupos</option>
            ${grupos.map(g => `<option value="${UI.escaparTexto(g.id)}" ${filtros.grupo === g.id ? 'selected' : ''}>${UI.escaparTexto(g.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="campo-filtro">
          <label class="tb-label" for="st-estado"><i class="ri-user-follow-line"></i> Estado</label>
          <select id="st-estado" class="form-control" onchange="StatsEngine.cambiarFiltro('estado', this.value)">
            <option value="" ${filtros.estado === '' ? 'selected' : ''}>Todos</option>
            <option value="Activo" ${filtros.estado === 'Activo' ? 'selected' : ''}>Solo activos</option>
            <option value="Retirado" ${filtros.estado === 'Retirado' ? 'selected' : ''}>Solo retirados</option>
          </select>
        </div>
        <div class="campo-filtro">
          <label class="tb-label" for="st-modulo"><i class="ri-book-read-line"></i> Módulo</label>
          <select id="st-modulo" class="form-control" onchange="StatsEngine.cambiarFiltro('modulo', this.value)">
            <option value="">Todos los módulos</option>
            ${MODULOS_TRANSVERSALES.map(m => `<option value="${UI.escaparTexto(m)}" ${filtros.modulo === m ? 'selected' : ''}>${UI.escaparTexto(m)}</option>`).join('')}
          </select>
        </div>
        <div class="campo-filtro">
          <label class="tb-label" for="st-comparar" title="Contrasta los KPI con otro grupo o con el total"><i class="ri-scales-3-line"></i> Comparar con</label>
          <select id="st-comparar" class="form-control" onchange="StatsEngine.cambiarFiltro('comparar', this.value)">
            <option value="">Sin comparación</option>
            <option value="todos" ${filtros.comparar === 'todos' ? 'selected' : ''}>Todos los grupos</option>
            ${opcionesGrupo(filtros.grupo)}
          </select>
        </div>
        <div class="barra-acciones">
          <button type="button" class="btn-ghost" onclick="StatsEngine.exportarCSV()" title="Descarga la tabla de detalle en CSV">
            <i class="ri-file-download-line"></i> CSV
          </button>
          <button type="button" class="btn-ghost" onclick="UI.imprimirVista()" title="Imprimir o guardar en PDF">
            <i class="ri-printer-line"></i> PDF
          </button>
          <button type="button" class="btn-ghost" onclick="UI.copiarEnlaceVista()" title="Copia el enlace con estos filtros">
            <i class="ri-link"></i> Compartir vista
          </button>
        </div>
      </div>
      ${UI.chipsFiltrosHTML('estadisticas', filtros, {
        grupo: valor => `Grupo: ${(grupos.find(g => g.id === valor) || {}).nombre || valor}`,
        estado: valor => `Estado: ${valor === 'Activo' ? 'Activos' : valor === 'Retirado' ? 'Retirados' : valor}`,
        modulo: valor => `Módulo: ${valor}`,
        comparar: valor => `Comparar con: ${valor === 'todos' ? 'todos los grupos' : ((grupos.find(g => g.id === valor) || {}).nombre || valor)}`
      })}`;

    // ── Estado de error: nunca pantalla en blanco ──
    if (errorVista) {
      return `<div class="module-fade-enter">${cabecera}${barraFiltros}
        ${UI.estadoErrorHTML(`estadisticas · ${errorVista}`)}
        ${this.glosarioHTML()}
      </div>`;
    }

    // ── Estado vacío: dice por qué no hay datos y cómo salir ──
    if (d.totalEst === 0) {
      const vacio = UI.estadoVacioHTML(hayFiltros ? {
        icono: 'ri-filter-3-line',
        titulo: 'No hay datos para este periodo.',
        texto: 'Prueba otro rango o quita algún filtro: quizá ese grupo, estado o módulo no tiene registros.',
        accion: `<button type="button" class="btn-ghost" data-limpiar-filtros data-vista-filtro="estadisticas"><i class="ri-filter-off-line" aria-hidden="true"></i> Limpiar filtros</button>`
      } : {
        icono: 'ri-team-line',
        titulo: 'Todavía no hay estudiantes registrados.',
        texto: 'Carga la lista de un grupo desde «Grupos de Clase» y estos indicadores se llenarán solos.'
      });
      return `<div class="module-fade-enter">${cabecera}${barraFiltros}${vacio}${this.glosarioHTML()}</div>`;
    }

    const maxGrupo = Math.max(...d.porGrupo.map(g=>g.total), 1);
    const maxProm = Math.max(...d.porModulo.map(m=>m.promedioGeneral), 1);
    const enLista = d.ranking.filter(e => !e.excluido);
    const top5 = enLista.slice(0, 5);
    const riesgo = enLista.filter(e => e.promedio > 0 && e.promedio < 60).slice(0, 5);
    const sinNotasList = enLista.filter(e => e.promedio === 0).slice(0, 5);

    const comparar = (actual, clave) => base ? { valor: base[clave], etiqueta: comparacion ? etiquetaBase : 'últ. actualización' } : null;

    // ── 1 · KPIs esenciales ──
    const kpis = `
      <section class="bloque-analisis" aria-label="Indicadores esenciales">
        <div class="bloque-titulo">
          <h2><i class="ri-speed-line" aria-hidden="true"></i> Indicadores esenciales</h2>
          <span class="bloque-nota">${comparacion ? `Comparando con ${UI.escaparTexto(etiquetaBase)}` : auto ? (auto.sinCambios ? `Sin cambios respecto a la última actualización` : 'Comparando contra la última captura de datos') : '6 métricas del periodo en curso'}</span>
        </div>
        <div class="kpi-grid">
          ${this.kpiHTML({ valor: d.totalEst, etiqueta: 'Estudiantes', ayuda: 'estudiantes', icono: 'ri-group-line', tono: 'azul', base: comparar(d.totalEst, 'totalEst') })}
          ${this.kpiHTML({ valor: d.activos, etiqueta: 'Activos', ayuda: 'activos', icono: 'ri-user-follow-line', tono: 'verde', base: comparar(d.activos, 'activos') })}
          ${this.kpiHTML({ valor: d.retirados, etiqueta: 'Retirados', ayuda: 'retirados', icono: 'ri-user-unfollow-line', tono: 'rojo', base: comparar(d.retirados, 'retirados') })}
          ${this.kpiHTML({ valor: d.rendimiento, sufijo: '/100', etiqueta: 'Rendimiento promedio', ayuda: 'rendimiento', icono: 'ri-line-chart-line', tono: 'morado', base: comparar(d.rendimiento, 'rendimiento') })}
          ${this.kpiHTML({ valor: d.cobertura, sufijo: '%', etiqueta: 'Cobertura de evaluación', ayuda: 'cobertura', icono: 'ri-checkbox-circle-line', tono: 'cyan', base: comparar(d.cobertura, 'cobertura') })}
          ${this.kpiHTML({ valor: d.convalidaciones, etiqueta: 'Convalidaciones', ayuda: 'convalidaciones', icono: 'ri-award-line', tono: 'ambar', base: comparar(d.convalidaciones, 'convalidaciones') })}
        </div>
      </section>`;

    // ── 2 · Cambios respecto a la última actualización de datos ──
    const cambios = auto ? this.cambiosHTML(auto) : '';

    // ── 3 · Visualizaciones ──
    const graficas = `
      <section class="bloque-analisis" aria-label="Gráficas principales">
        <div class="bloque-titulo">
          <h2><i class="ri-bar-chart-box-line" aria-hidden="true"></i> Visualizaciones</h2>
          <span class="bloque-nota">Todas responden a los filtros de arriba</span>
        </div>
        <div class="rejilla-graficas">
          <div class="chart-box">
            <h3><i class="ri-line-chart-line"></i> Promedio por Módulo ${UI.ayudaHTML('promedioModulo')}</h3>
            ${d.porModulo.some(m=>m.cuentaPromedios>0)
              ? this._graficaSVG(
                  [{ nombre: 'Promedio', tono: 'rosa', data: d.porModulo.map(m => m.promedioGeneral) }],
                  d.porModulo.map(m => m.nombre.split(/\s+/).slice(0, 2).join(' ')),
                  100, 230, '/100', { valor: 60, etiqueta: 'aprobado' })
              : '<div style="text-align:center;color:var(--text-muted);padding:20px;">No hay calificaciones importadas aún.</div>'}
            ${d.porModulo.length === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:16px;">Sin módulos.</div>' : ''}
          </div>

          <div class="chart-box">
            <h3><i class="ri-pie-chart-line" style="color: var(--neon-purple);"></i> Distribución General ${UI.ayudaHTML('estudiantes')}</h3>
            <div style="display: flex; flex-direction: column; gap: var(--s-6); margin-top: var(--s-2);">
              ${this.doughnutSVG(d.activos, d.totalEst, '#0a0a0a', 'Estudiantes Activos', `${d.activos} de ${d.totalEst} matriculados`, { filtro: { clave: 'estado', valor: 'Activo' } })}
              ${this.doughnutSVG(d.retirados, d.totalEst, 'rgba(10,10,10,0.45)', 'Estudiantes Retirados', `${d.retirados} bajas registradas`, { filtro: { clave: 'estado', valor: 'Retirado' } })}
              ${this.doughnutSVG(d.convalidaciones, Math.max(d.totalEst * 5, 1), 'rgba(10,10,10,0.3)', 'Convalidaciones', `${d.convalidaciones} módulos convalidados`)}
            </div>
          </div>

          <div class="chart-box">
            <h3><i class="ri-team-line" style="color: var(--neon-cyan);"></i> Estudiantes por Grupo ${UI.ayudaHTML('grupos')}</h3>
            ${d.porGrupo.map(g => `
              <div class="bar-h" data-grafico
                   data-grafico-tip="${(g.nombre + ' — ' + g.total + ' estudiante(s), ' + g.activos + ' activo(s) · clic para filtrar').replace(/"/g, '&quot;')}"
                   data-grafico-filtro="${JSON.stringify({ clave: 'grupo', valor: g.id }).replace(/"/g, '&quot;')}"
                   role="img" aria-label="${(g.nombre + ': ' + g.total + ' estudiantes').replace(/"/g, '&quot;')}">
                <div class="bar-h-label">${g.nombre}</div>
                <div class="bar-h-track">
                  <div class="bar-h-fill" style="width: ${(g.total/maxGrupo)*100}%; background: linear-gradient(90deg, var(--p-500), var(--neon-purple));">
                    ${g.total}
                  </div>
                </div>
              </div>
            `).join('')}
            ${d.porGrupo.length===0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px;">No hay grupos con este filtro.</div>' : ''}
          </div>

          <div class="chart-box">
            <h3><i class="ri-stacked-area-chart-line"></i> Estado por Módulo ${UI.ayudaHTML('cobertura')}</h3>
            ${this._graficaSVG([
                { nombre: 'Con notas', tono: 'rosa', apilada: true, data: d.porModulo.map(m => m.conNotas),
                  filtroPor: i => ({ clave: 'modulo', valor: d.porModulo[i].nombre }) },
                { nombre: 'Sin notas', tono: 'mono', apilada: true, data: d.porModulo.map(m => m.sinNotas),
                  filtroPor: i => ({ clave: 'modulo', valor: d.porModulo[i].nombre }) },
                { nombre: 'Convalidados', tono: 'mono2', apilada: true, data: d.porModulo.map(m => m.convalidados),
                  filtroPor: i => ({ clave: 'modulo', valor: d.porModulo[i].nombre }) }
              ],
              d.porModulo.map(m => m.nombre.split(/\s+/).slice(0, 2).join(' ')),
              Math.max(...d.porModulo.map(m => m.conNotas + m.sinNotas + m.convalidados), 4),
              230, '', null)}
          </div>

          <div class="chart-box">
            <h3><i class="ri-trophy-line" style="color: #0a0a0a;"></i> Top 5 — Mejores Promedios ${UI.ayudaHTML('rendimiento')}</h3>
            ${top5.length === 0 ? '<div style="color:var(--text-muted);text-align:center;padding:20px;">Sin datos de calificaciones.</div>' : top5.map((e,i) => `
              <div class="rank-row">
                <div class="rank-num rank-${i+1}">${i+1}</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.nombres} ${e.apellidos}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${e.grupo}</div>
                </div>
                <div style="font-weight: 700; font-size: 1rem; color: ${e.promedio>=80?'var(--neon-green)':e.promedio>=60?'var(--neon-amber)':'var(--neon-red)'};">${e.promedio}</div>
              </div>
            `).join('')}
          </div>

          <div class="chart-box">
            <h3><i class="ri-alarm-warning-line" style="color: var(--neon-red);"></i> En Riesgo — Promedio &lt; 60 ${UI.ayudaHTML('enRiesgo')}</h3>
            ${riesgo.length === 0 && sinNotasList.length === 0 ? '<div style="color:var(--text-muted);text-align:center;padding:20px;">🎉 No hay estudiantes en riesgo.</div>' : ''}
            ${riesgo.map((e,i) => `
              <div class="rank-row">
                <div class="rank-num rank-n">${i+1}</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.nombres} ${e.apellidos}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${e.grupo}</div>
                </div>
                <div style="font-weight: 700; font-size: 1rem; color: var(--neon-red);">${e.promedio}</div>
              </div>
            `).join('')}
            ${sinNotasList.length > 0 ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Sin calificaciones registradas:</div>` : ''}
            ${sinNotasList.map((e) => `
              <div class="rank-row">
                <div class="rank-num rank-n">•</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.nombres} ${e.apellidos}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${e.grupo}</div>
                </div>
                <span class="badge-status retirado" style="font-size: 0.65rem;">Sin notas</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`;

    // ── 4 · Tabla de detalle (al final, como en todo panel analítico) ──
    const filasDetalle = d.ranking.map((e, i) => {
      const promedio = e.promedio || 0;
      return `
              <tr class="${e.excluido ? 'fila-excluida' : ''}">
                <td style="text-align: center; color: var(--text-muted);">${i + 1}</td>
                <td><strong>${UI.escaparTexto(`${e.nombres || ''} ${e.apellidos || ''}`)}</strong></td>
                <td>${UI.escaparTexto(e.grupo || '')}</td>
                <td>${typeof UI.renderBadgeEstado === 'function' ? UI.renderBadgeEstado(e) : UI.escaparTexto(e.estado || 'Activo')}</td>
                <td style="text-align: center;">${e.modsConNota || 0}</td>
                <td style="text-align: center;">${e.convalsEst || 0}</td>
                <td style="text-align: center; font-weight: 700; color: ${promedio ? (promedio >= 60 ? 'var(--neon-green)' : 'var(--neon-red)') : 'var(--text-muted)'};">${promedio || '—'}</td>
                <td style="text-align: center;"><span class="badge-status ${this.claseResultado(promedio)}">${this.resultadoDe(promedio)}</span></td>
              </tr>`;
    }).join('');

    const tablaDetalle = `
      <section class="bloque-analisis" aria-label="Tabla de detalle">
        <div class="bloque-titulo">
          <h2><i class="ri-table-line" aria-hidden="true"></i> Tabla de detalle</h2>
          <span class="bloque-nota">${d.ranking.length} estudiante(s) · ordenado por promedio${d.retirados && !filtros.estado ? ' · los retirados se listan pero no entran al promedio' : ''}</span>
        </div>
        <div class="table-container">
          <table class="custom-table">
            <thead>
              <tr>
                <th style="text-align: center;">#</th>
                <th>Estudiante</th>
                <th>Grupo</th>
                <th>Estado</th>
                <th style="text-align: center;">Módulos con nota</th>
                <th style="text-align: center;">Convalidaciones</th>
                <th style="text-align: center;">Promedio</th>
                <th style="text-align: center;">Resultado</th>
              </tr>
            </thead>
            <tbody>${filasDetalle}
            </tbody>
          </table>
        </div>
      </section>`;

    return `
      <div class="module-fade-enter">
        <style>
          .chart-box { background: linear-gradient(145deg, var(--bg-card), var(--bg-elevated)); border: 1px solid var(--border-default); border-radius: var(--r-xl); padding: var(--s-6); }
          .chart-box h3 { font-size: var(--text-lg); font-weight: 700; margin-bottom: var(--s-5); display: flex; align-items: center; gap: var(--s-2); color: var(--text-primary); }
          .bar-h { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
          .bar-h-label { font-size: 0.78rem; color: var(--text-secondary); width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
          .bar-h-track { flex: 1; height: 22px; background: var(--bg-input); border-radius: var(--r-md); overflow: hidden; position: relative; }
          .bar-h-fill { height: 100%; border-radius: var(--r-md); display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-size: 0.7rem; font-weight: 700; color: #fff; transition: width 1s cubic-bezier(0.16,1,0.3,1); text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
          .rank-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); }
          .rank-row:last-child { border-bottom: none; }
          .rank-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; }
          .rank-1 { background: linear-gradient(135deg, #0a0a0a, #d97706); color: #000; box-shadow: 0 0 10px rgba(251,191,36,0.3); }
          .rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: #fff; }
          .rank-3 { background: linear-gradient(135deg, #b45309, #92400e); color: #fff; }
          .rank-n { background: var(--bg-hover); color: var(--text-muted); }
        </style>

        ${cabecera}
        ${kpis}
        ${cambios}
        ${barraFiltros}
        ${graficas}
        ${tablaDetalle}
        ${this.glosarioHTML()}
      </div>
    `;
  }
};