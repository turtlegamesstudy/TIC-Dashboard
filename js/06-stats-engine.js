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

  obtenerDatos() {
    const grupos = DataEngine.getGrupos();
    let totalEst = 0, activos = 0, retirados = 0, convalidaciones = 0;
    let conNotas = 0, sinNotas = 0;
    const porGrupo = [];
    const porModulo = MODULOS_TRANSVERSALES.map(m => ({ 
      nombre: m, 
      conNotas: 0, sinNotas: 0, convalidados: 0, 
      sumaPromedios: 0, cuentaPromedios: 0,
      promedioGeneral: 0 
    }));
    const ranking = [];

    grupos.forEach(g => {
      const ests = g.estudiantes || [];
      totalEst += ests.length;
      activos += ests.filter(e => e.estado === 'Activo').length;
      retirados += ests.filter(e => e.estado === 'Retirado').length;
      
      ests.forEach(e => {
        if (e.estado === 'Retirado') return;
        
        let tieneAlgunaNota = false;
        let sumaMods = 0, cuentaMods = 0;
        
        MODULOS_TRANSVERSALES.forEach((m, i) => {
          if (e.convalidaciones?.[m]) {
            porModulo[i].convalidados++;
            convalidaciones++;
            return;
          }
          const modData = e.evaluacionesPorModulo?.[m];
          const notasObj = modData?.notas || modData?.evaluaciones;
          if (notasObj) {
            const vals = Object.values(notasObj).filter(v => typeof v === 'number');
            if (vals.length > 0) {
              tieneAlgunaNota = true;
              const promMod = vals.reduce((a,b)=>a+b,0)/vals.length;
              porModulo[i].sumaPromedios += promMod;
              porModulo[i].cuentaPromedios++;
              porModulo[i].conNotas++;
              sumaMods += promMod;
              cuentaMods++;
            } else {
              porModulo[i].sinNotas++;
            }
          } else {
            porModulo[i].sinNotas++;
          }
        });

        const promGlobal = cuentaMods > 0 ? Math.round(sumaMods / cuentaMods) : null;
        if (promGlobal !== null) {
          conNotas++;
          ranking.push({ ...e, grupo: g.nombre, promedio: promGlobal });
        } else {
          sinNotas++;
          ranking.push({ ...e, grupo: g.nombre, promedio: 0 });
        }
      });

      porGrupo.push({ nombre: g.nombre, total: ests.length, activos: ests.filter(e=>e.estado==='Activo').length });
    });

    porModulo.forEach(m => {
      m.promedioGeneral = m.cuentaPromedios > 0 ? Math.round(m.sumaPromedios / m.cuentaPromedios) : 0;
    });

    ranking.sort((a,b) => b.promedio - a.promedio);
    
    return { totalEst, activos, retirados, convalidaciones, conNotas, sinNotas, porGrupo, porModulo, ranking };
  },

  barraCSS(porcentaje, colorVar, label) {
    const pct = Math.min(100, Math.max(0, porcentaje));
    return `
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.82rem; color: var(--text-secondary); font-weight: 500;">${label}</span>
          <span style="font-size: 0.82rem; color: var(${colorVar}); font-weight: 700;">${Math.round(pct)}%</span>
        </div>
        <div style="height: 10px; background: var(--bg-input); border-radius: var(--r-full); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);">
          <div style="width: 0%; height: 100%; background: linear-gradient(90deg, var(${colorVar}), var(--neon-purple)); border-radius: var(--r-full); animation: growBar 1s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: 0.2s; box-shadow: 0 0 12px rgba(20,87,139,0.25);" onload="this.style.width='${pct}%'"></div>
        </div>
      </div>
    `.replace('width: 0%', `width: ${pct}%`);
  },

  doughnutSVG(valor, total, color, label, sublabel) {
    const pct = total > 0 ? (valor / total) * 100 : 0;
    const circ = 2 * Math.PI * 40;
    const offset = circ - (pct / 100) * circ;
    return `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="position: relative; width: 90px; height: 90px; flex-shrink: 0;">
          <svg width="90" height="90" viewBox="0 0 100 100" style="transform: rotate(-90deg);">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-input)" stroke-width="10"/>
            <circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="10" 
              stroke-dasharray="${circ}" stroke-dashoffset="${circ}" stroke-linecap="round"
              style="filter: drop-shadow(0 0 6px ${color}); animation: drawCircle 1.2s cubic-bezier(0.16,1,0.3,1) forwards;"/>
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
    `;
  },

  renderVistaEstadisticas() {
    const d = this.obtenerDatos();
    const maxGrupo = Math.max(...d.porGrupo.map(g=>g.total), 1);
    const maxProm = Math.max(...d.porModulo.map(m=>m.promedioGeneral), 1);
    
    const top5 = d.ranking.slice(0, 5);
    const riesgo = d.ranking.filter(e => e.promedio > 0 && e.promedio < 60).slice(0, 5);
    const sinNotasList = d.ranking.filter(e => e.promedio === 0).slice(0, 5);

    return `
      <div class="module-fade-enter">
        <style>
          @keyframes growBar { from { width: 0%; } to { width: var(--target-w); } }
          @keyframes drawCircle { to { stroke-dashoffset: var(--target-o); } }
          .stat-card-mini { background: linear-gradient(145deg, var(--bg-card), var(--bg-elevated)); border: 1px solid var(--border-default); border-radius: var(--r-xl); padding: var(--s-5); transition: all var(--t-base); }
          .stat-card-mini:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: var(--border-strong); }
          .stat-val { font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); line-height: 1.2; }
          .stat-label { font-size: var(--text-2xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-top: 4px; }
          .chart-box { background: linear-gradient(145deg, var(--bg-card), var(--bg-elevated)); border: 1px solid var(--border-default); border-radius: var(--r-xl); padding: var(--s-6); }
          .chart-box h3 { font-size: var(--text-lg); font-weight: 700; margin-bottom: var(--s-5); display: flex; align-items: center; gap: var(--s-2); color: var(--text-primary); }
          .bar-h { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
          .bar-h-label { font-size: 0.78rem; color: var(--text-secondary); width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
          .bar-h-track { flex: 1; height: 22px; background: var(--bg-input); border-radius: var(--r-md); overflow: hidden; position: relative; }
          .bar-h-fill { height: 100%; border-radius: var(--r-md); display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-size: 0.7rem; font-weight: 700; color: #fff; transition: width 1s cubic-bezier(0.16,1,0.3,1); text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
          .rank-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-subtle); }
          .rank-row:last-child { border-bottom: none; }
          .rank-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; }
          .rank-1 { background: linear-gradient(135deg, #fbbf24, #d97706); color: #000; box-shadow: 0 0 10px rgba(251,191,36,0.3); }
          .rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: #fff; }
          .rank-3 { background: linear-gradient(135deg, #b45309, #92400e); color: #fff; }
          .rank-n { background: var(--bg-hover); color: var(--text-muted); }
        </style>

        <div class="view-header">
          <h1><i class="ri-bar-chart-2-fill"></i> Estadísticas</h1>
          <p>Panel analítico de rendimiento académico, asistencia y avance por módulos transversales.</p>
        </div>

        <!-- KPIs -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--s-4); margin-bottom: var(--s-8);">
          <div class="stat-card-mini">
            <div class="stat-val">${d.totalEst}</div>
            <div class="stat-label">Total Estudiantes</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-val" style="color: var(--neon-green);">${d.activos}</div>
            <div class="stat-label">Activos</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-val" style="color: var(--neon-red);">${d.retirados}</div>
            <div class="stat-label">Retirados</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-val" style="color: var(--neon-amber);">${d.convalidaciones}</div>
            <div class="stat-label">Convalidaciones</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-val" style="color: var(--neon-cyan);">${d.conNotas}</div>
            <div class="stat-label">Con Evaluaciones</div>
          </div>
          <div class="stat-card-mini">
            <div class="stat-val" style="color: var(--text-muted);">${d.sinNotas}</div>
            <div class="stat-label">Sin Notas</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6); margin-bottom: var(--s-6);">
          <!-- Promedio por Módulo -->
          <div class="chart-box">
            <h3><i class="ri-book-read-line" style="color: var(--p-400);"></i> Promedio por Módulo</h3>
            ${d.porModulo.map(m => {
              const pct = maxProm > 0 ? (m.promedioGeneral / 100) * 100 : 0;
              const color = m.promedioGeneral >= 60 ? '--neon-green' : m.promedioGeneral >= 40 ? '--neon-amber' : '--neon-red';
              return this.barraCSS(pct, color, m.nombre.length > 35 ? m.nombre.substring(0,35)+'...' : m.nombre);
            }).join('')}
            ${d.porModulo.every(m=>m.cuentaPromedios===0) ? '<div style="text-align:center;color:var(--text-muted);padding:20px;">No hay calificaciones importadas aún.</div>' : ''}
          </div>

          <!-- Distribución -->
          <div class="chart-box">
            <h3><i class="ri-pie-chart-line" style="color: var(--neon-purple);"></i> Distribución General</h3>
            <div style="display: flex; flex-direction: column; gap: var(--s-6); margin-top: var(--s-2);">
              ${this.doughnutSVG(d.activos, d.totalEst, '#10b981', 'Estudiantes Activos', `${d.activos} de ${d.totalEst} matriculados`)}
              ${this.doughnutSVG(d.retirados, d.totalEst, '#ef4444', 'Estudiantes Retirados', `${d.retirados} bajas registradas`)}
              ${this.doughnutSVG(d.convalidaciones, d.totalEst * 5, '#e10b7b', 'Convalidaciones', `${d.convalidaciones} módulos convalidados`)}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6); margin-bottom: var(--s-6);">
          <!-- Por Grupo -->
          <div class="chart-box">
            <h3><i class="ri-team-line" style="color: var(--neon-cyan);"></i> Estudiantes por Grupo</h3>
            ${d.porGrupo.map(g => `
              <div class="bar-h">
                <div class="bar-h-label">${g.nombre}</div>
                <div class="bar-h-track">
                  <div class="bar-h-fill" style="width: ${(g.total/maxGrupo)*100}%; background: linear-gradient(90deg, var(--p-500), var(--neon-purple));">
                    ${g.total}
                  </div>
                </div>
              </div>
            `).join('')}
            ${d.porGrupo.length===0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px;">No hay grupos.</div>' : ''}
          </div>

          <!-- Estado por Módulo -->
          <div class="chart-box">
            <h3><i class="ri-stack-line" style="color: var(--neon-amber);"></i> Estado por Módulo</h3>
            <div style="overflow-x: auto;">
              <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
                <thead>
                  <tr style="color: var(--text-muted); text-align: left; border-bottom: 1px solid var(--border-default);">
                    <th style="padding: 8px;">Módulo</th>
                    <th style="padding: 8px; text-align: center;">✅ Con Notas</th>
                    <th style="padding: 8px; text-align: center;">⏳ Sin Notas</th>
                    <th style="padding: 8px; text-align: center;">🏆 Conval.</th>
                  </tr>
                </thead>
                <tbody>
                  ${d.porModulo.map(m => `
                    <tr style="border-bottom: 1px solid var(--border-subtle);">
                      <td style="padding: 8px; color: var(--text-secondary); font-weight: 500;">${m.nombre.length > 30 ? m.nombre.substring(0,30)+'...' : m.nombre}</td>
                      <td style="padding: 8px; text-align: center; color: var(--neon-green); font-weight: 700;">${m.conNotas}</td>
                      <td style="padding: 8px; text-align: center; color: var(--neon-amber); font-weight: 700;">${m.sinNotas}</td>
                      <td style="padding: 8px; text-align: center; color: var(--p-400); font-weight: 700;">${m.convalidados}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-6);">
          <!-- Top 5 -->
          <div class="chart-box">
            <h3><i class="ri-trophy-line" style="color: #fbbf24;"></i> Top 5 — Mejores Promedios</h3>
            ${top5.length === 0 ? '<div style="color:var(--text-muted);text-align:center;padding:20px;">Sin datos de calificaciones.</div>' : top5.map((e,i) => `
              <div class="rank-row">
                <div class="rank-num rank-${i+1}">${i+1}</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.apellidos}, ${e.nombres}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${e.grupo}</div>
                </div>
                <div style="font-weight: 700; font-size: 1rem; color: ${e.promedio>=80?'var(--neon-green)':e.promedio>=60?'var(--neon-amber)':'var(--neon-red)'};">${e.promedio}</div>
              </div>
            `).join('')}
          </div>

          <!-- Riesgo -->
          <div class="chart-box">
            <h3><i class="ri-alarm-warning-line" style="color: var(--neon-red);"></i> En Riesgo — Promedio &lt; 60</h3>
            ${riesgo.length === 0 && sinNotasList.length === 0 ? '<div style="color:var(--text-muted);text-align:center;padding:20px;">🎉 No hay estudiantes en riesgo.</div>' : ''}
            ${riesgo.map((e,i) => `
              <div class="rank-row">
                <div class="rank-num rank-n">${i+1}</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.apellidos}, ${e.nombres}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${e.grupo}</div>
                </div>
                <div style="font-weight: 700; font-size: 1rem; color: var(--neon-red);">${e.promedio}</div>
              </div>
            `).join('')}
            ${sinNotasList.length > 0 ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-subtle); font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Sin calificaciones registradas:</div>` : ''}
            ${sinNotasList.map((e,i) => `
              <div class="rank-row">
                <div class="rank-num rank-n">•</div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.apellidos}, ${e.nombres}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${e.grupo}</div>
                </div>
                <span class="badge-status retirado" style="font-size: 0.65rem;">Sin notas</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
};