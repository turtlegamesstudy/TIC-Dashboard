'use strict';
/* ═══════════════════════════════════════════════════════════════
   EXAMENES ENGINE v3 — Ultra Simple: Registro Directo + Importador
   ═══════════════════════════════════════════════════════════════ */

const ExamenesEngine = {
  _filtroGrupo: '', _filtroModulo: 'ALL',

  promedioModulo(est, modulo) {
    if (est.estado === 'Retirado') return null;
    if (est.convalidaciones?.[modulo]) return 'Convalidado';
    const modData = est.evaluacionesPorModulo?.[modulo];
    const notasObj = modData?.notas || modData?.evaluaciones;
    if (!notasObj) return null;
    const vals = Object.values(notasObj).filter(v => typeof v === 'number');
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  },

  obtenerRiesgo(grupoId, moduloFiltro) {
    const grupos = grupoId ? [DataEngine.getGrupoById(grupoId)].filter(Boolean) : DataEngine.getGrupos();
    const res=[]; 
    grupos.forEach(g => {
      (g.estudiantes||[]).forEach(e => {
        if(e.estado==='Retirado') return;
        MODULOS_TRANSVERSALES.forEach(mod => {
          if(moduloFiltro && moduloFiltro!=='ALL' && moduloFiltro!==mod) return;
          if(e.convalidaciones?.[mod]) return;
          const prom=this.promedioModulo(e,mod);
          if(prom===null || prom<60) {
            const notaExamen = e.evaluacionesPorModulo?.[mod]?.notas?.['Examen Reparación'] ?? null;
            res.push({
              estudiante:e, grupo:g, modulo:mod, 
              promedioOriginal:prom===null?'S/N':prom,
              notaExamen
            });
          }
        });
      });
    }); 
    // Orden alfabético: primero los nombres completos y luego los apellidos.
    res.sort((a, b) => String(a.grupo?.nombre || '').localeCompare(String(b.grupo?.nombre || ''))
      || DataEngine.cmpNombres(a.estudiante, b.estudiante));
    return res;
  },

  async guardarNotaExamen(estId, grupoId, modulo, nota) {
    const student = DataEngine.getEstudiantesByGrupo(grupoId).find(item => item.id === estId);
    if (!student) return;
    UI.showLoading('Guardando la nota del examen…', 'subida');
    try {
      await DataEngine._mutateGroupAndSave(grupoId, grupo => {
        const currentStudent = (grupo.estudiantes || []).find(item => item.id === estId);
        if (!currentStudent) throw new Error('El estudiante ya no pertenece a este grupo.');
        if (!currentStudent.evaluacionesPorModulo) currentStudent.evaluacionesPorModulo = {};
        if (!currentStudent.evaluacionesPorModulo[modulo]) currentStudent.evaluacionesPorModulo[modulo] = { notas: {} };
        if (!currentStudent.evaluacionesPorModulo[modulo].notas) currentStudent.evaluacionesPorModulo[modulo].notas = {};
        currentStudent.evaluacionesPorModulo[modulo].notas['Examen Reparación'] = parseInt(nota);
      });
      UI.hideLoading(500);
    } catch (error) {
      UI.hideLoading(300);
      console.error('No se pudo guardar la nota del examen:', error);
      UI.showToast(`No se pudo guardar la nota del examen: ${error.message}`, 'error');
      return;
    }
    UI.showToast('✅ Nota registrada: ' + nota);
    this.actualizarVista();
  },

  enviarWhatsAppExamen(est, modulo, grupo) {
    const tel = MessageEngine.normalizarTelefono(est.telefono);
    if(!tel){ UI.showToast('⚠️ Sin teléfono'); return; }
    const nombre = est.nombres.split(' ')[0] + ' ' + est.apellidos.split(' ')[0];
    const msg = MessageEngine.personalizar(`*Centro Tecnológico Ariel Darce — INATEC*\n\nHola *${nombre}*,\n\n📢 Tienes *examen de reparación* pendiente en:\n\n*${modulo}*\n\n📅 El docente te contactará con fecha y lugar.\n\nResponde este mensaje si tienes dudas.\n\n*Docente TIC*\nHanzell Mayorga`);
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  },

  /* ── IMPORTADOR DESDE GOOGLE FORMS / EXCEL / TEXTO ── */
  async procesarImportacionMasiva() {
    const raw = document.getElementById('import-masivo-texto')?.value || '';
    const out = document.getElementById('import-masivo-resultado');
    if(!raw.trim()){ out.innerHTML=''; return; }
    
    const lineas = raw.split('\n').filter(l => l.trim());
    let registrados = 0, noEncontrados = [];
    const previousGroups = new Map();
    
    lineas.forEach(linea => {
      // Formatos soportados: "Juan Perez, 85" | "Juan Perez\t85" | "Juan Perez;85"
      const partes = linea.split(/,|;|\t/).map(x => x.trim()).filter(x => x);
      if(partes.length < 2) return;
      const nombreRaw = partes[0];
      const notaStr = partes[partes.length-1].replace(/\D/g,'');
      const nota = parseInt(notaStr);
      if(isNaN(nota) || nota < 0 || nota > 100) return;
      
      const nomNorm = CuadernoEngine.normalizarTexto(nombreRaw);
      let encontrado = null, grupoEncontrado = null, moduloEncontrado = null;
      
      for(const g of DataEngine.getGrupos()){
        for(const e of (g.estudiantes||[])){
          const full = CuadernoEngine.normalizarTexto(e.nombres + ' ' + e.apellidos);
          const rev = CuadernoEngine.normalizarTexto(e.apellidos + ' ' + e.nombres);
          if(full.includes(nomNorm) || rev.includes(nomNorm) || nomNorm.includes(full)){
            // Buscar en qué módulo está en riesgo (tomamos el primero sin nota de examen)
            for(const mod of MODULOS_TRANSVERSALES){
              const prom = this.promedioModulo(e, mod);
              if((prom === null || prom < 60) && !e.convalidaciones?.[mod]){
                const yaTiene = e.evaluacionesPorModulo?.[mod]?.notas?.['Examen Reparación'];
                if(yaTiene === null || yaTiene === undefined){
                  encontrado = e; grupoEncontrado = g; moduloEncontrado = mod; break;
                }
              }
            }
            if(!moduloEncontrado){
              // Si ya tiene en todos, tomamos el primer módulo en riesgo para actualizar
              for(const mod of MODULOS_TRANSVERSALES){
                const prom = this.promedioModulo(e, mod);
                if((prom === null || prom < 60) && !e.convalidaciones?.[mod]){
                  encontrado = e; grupoEncontrado = g; moduloEncontrado = mod; break;
                }
              }
            }
            if(moduloEncontrado) break;
          }
        }
        if(moduloEncontrado) break;
      }
      
      if(encontrado && moduloEncontrado){
        if (!previousGroups.has(grupoEncontrado.id)) {
          previousGroups.set(grupoEncontrado.id, {
            group: grupoEncontrado,
            value: DataEngine._clone(grupoEncontrado)
          });
        }
        if(!encontrado.evaluacionesPorModulo) encontrado.evaluacionesPorModulo = {};
        if(!encontrado.evaluacionesPorModulo[moduloEncontrado]) encontrado.evaluacionesPorModulo[moduloEncontrado] = { notas:{} };
        if(!encontrado.evaluacionesPorModulo[moduloEncontrado].notas) encontrado.evaluacionesPorModulo[moduloEncontrado].notas = {};
        encontrado.evaluacionesPorModulo[moduloEncontrado].notas['Examen Reparación'] = nota;
        registrados++;
      } else {
        noEncontrados.push(nombreRaw);
      }
    });
    
    if (registrados > 0) {
      UI.showLoading(`Guardando ${registrados} nota(s) del examen…`, 'subida');
      try {
        await DataEngine.save();
        UI.hideLoading(600);
      } catch (error) {
        UI.hideLoading(300);
        previousGroups.forEach(({ group, value }, groupId) => {
          if (DataEngine.getGrupoById(groupId) !== group) return;
          Object.keys(group).forEach(key => delete group[key]);
          Object.assign(group, value);
        });
        console.error('No se pudo guardar la importación masiva de exámenes:', error);
        UI.showToast(`No se guardaron las notas del examen: ${error.message}`, 'error');
        return;
      }
    }
    
    let html = '';
    if(registrados > 0){
      html += `<div style="background:rgba(16,185,129,0.1);border:1px solid var(--neon-green);padding:16px;border-radius:12px;color:var(--neon-green);margin-bottom:12px;">
        <strong>✅ ${registrados} nota(s) registrada(s) correctamente.</strong>
      </div>`;
    }
    if(noEncontrados.length > 0){
      html += `<div style="background:rgba(239,68,68,0.1);border:1px solid var(--neon-red);padding:16px;border-radius:12px;color:var(--neon-red);">
        <strong>❌ No encontrados (${noEncontrados.length}):</strong><br>
        <span style="font-size:0.8rem;">${noEncontrados.join(', ')}</span>
      </div>`;
    }
    out.innerHTML = html || '<div style="color:var(--text-muted);text-align:center;">No se procesó ninguna línea.</div>';
    if(registrados > 0) this.actualizarVista();
  },

  actualizarVista() {
    if(UI.currentModule === 'Examenes-Reparacion'){
      document.getElementById('workspace').innerHTML = this.renderVistaExamenesReparaciones();
      UI.mountSectionSettings();
    }
  },

  /* ── VISTA PRINCIPAL LIMPIA ── */
  renderVistaExamenesReparaciones() {
    const grupoId = this._filtroGrupo || '';
    const moduloFiltro = this._filtroModulo || 'ALL';
    const lista = this.obtenerRiesgo(grupoId || null, moduloFiltro === 'ALL' ? null : moduloFiltro);
    const grupos = DataEngine.getGrupos();
    
    // Estadísticas rápidas
    const conNota = lista.filter(x => x.notaExamen !== null).length;
    const sinNota = lista.filter(x => x.notaExamen === null).length;
    const aprobados = lista.filter(x => x.notaExamen >= 60).length;
    const reprobados = lista.filter(x => x.notaExamen !== null && x.notaExamen < 60).length;

    return `
      <div class="module-fade-enter">
        <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
          <div>
            <h1><i class="ri-file-edit-line" style="color:var(--neon-amber);"></i> Exámenes y Reparación</h1>
            <p>Registra notas de reparación directamente o impórtalas desde Google Forms.</p>
          </div>
        </div>

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
          <div style="background:linear-gradient(145deg,var(--bg-card),var(--bg-elevated));border:1px solid var(--border-default);border-radius:var(--r-xl);padding:16px;text-align:center;">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--neon-red);">${lista.length}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">En Riesgo</div>
          </div>
          <div style="background:linear-gradient(145deg,var(--bg-card),var(--bg-elevated));border:1px solid var(--border-default);border-radius:var(--r-xl);padding:16px;text-align:center;">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--text-muted);">${sinNota}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Sin Nota Rep.</div>
          </div>
          <div style="background:linear-gradient(145deg,var(--bg-card),var(--bg-elevated));border:1px solid var(--border-default);border-radius:var(--r-xl);padding:16px;text-align:center;">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--neon-green);">${aprobados}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Aprobados Rep.</div>
          </div>
          <div style="background:linear-gradient(145deg,var(--bg-card),var(--bg-elevated));border:1px solid var(--border-default);border-radius:var(--r-xl);padding:16px;text-align:center;">
            <div style="font-size:var(--text-2xl);font-weight:700;color:var(--neon-red);">${reprobados}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Reprobados Rep.</div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="group-header-card" data-section-settings data-settings-title="Filtros de riesgo" style="flex-wrap:wrap;gap:12px;margin-bottom:20px;">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <div style="display:flex;gap:8px;align-items:center;">
              <label class="tb-label"><i class="ri-group-line"></i> Grupo:</label>
              <select id="exm-filtro-grupo" class="form-control" style="width:200px;" onchange="ExamenesEngine._filtroGrupo=this.value;ExamenesEngine.actualizarVista();">
                <option value="">Todos</option>
                ${grupos.map(g=>`<option value="${g.id}" ${grupoId===g.id?'selected':''}>${g.codigo||g.nombre}</option>`).join('')}
              </select>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <label class="tb-label"><i class="ri-book-read-line"></i> Módulo:</label>
              <select id="exm-filtro-modulo" class="form-control" style="width:240px;" onchange="ExamenesEngine._filtroModulo=this.value;ExamenesEngine.actualizarVista();">
                <option value="ALL" ${moduloFiltro==='ALL'?'selected':''}>Todos</option>
                ${MODULOS_TRANSVERSALES.map(m=>`<option value="${m}" ${moduloFiltro===m?'selected':''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Tabla Principal -->
        <div class="table-container" style="overflow-x:auto;margin-bottom:24px;">
          <table class="custom-table">
            <thead>
              <tr>
                <th style="width:40px;">No.</th>
                <th>Estudiante</th>
                <th>Grupo</th>
                <th>Módulo</th>
                <th style="text-align:center;">Promedio</th>
                <th style="text-align:center;">Nota Rep.</th>
                <th style="text-align:center;min-width:140px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${lista.length===0?'<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">🎉 No hay estudiantes en riesgo.</td></tr>':''}
              ${lista.map((r,idx)=>{
                const e=r.estudiante;
                const yaTiene = r.notaExamen !== null;
                const colorNota = yaTiene ? (r.notaExamen>=60?'var(--neon-green)':'var(--neon-red)') : 'var(--text-muted)';
                return `
                  <tr>
                    <td style="text-align:center;">${idx+1}</td>
                    <td><strong>${e.nombres} ${e.apellidos}</strong></td>
                    <td><span class="badge-status activo" style="font-size:0.7rem;">${r.grupo.nombre}</span></td>
                    <td style="font-size:0.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${r.modulo}</td>
                    <td style="text-align:center;font-weight:700;color:${r.promedioOriginal==='S/N'?'var(--text-muted)':'var(--neon-red)'};">${r.promedioOriginal}</td>
                    <td style="text-align:center;">
                      ${yaTiene 
                        ? `<span style="font-weight:800;font-size:1.1rem;color:${colorNota};">${r.notaExamen}</span>`
                        : `<span style="color:var(--text-muted);font-size:0.85rem;">—</span>`
                      }
                    </td>
                    <td style="text-align:center;">
                      <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;">
                        <button class="btn-icon" title="${yaTiene?'Editar':'Registrar'} Nota" onclick="ExamenesEngine.mostrarInputNota('${e.id}','${r.grupo.id}','${r.modulo.replace(/'/g,"\\'")}',${r.notaExamen??'null'},'${(e.nombres+' '+e.apellidos).replace(/'/g,"\\'")}')" style="width:34px;height:34px;font-size:1rem;background:rgba(20,87,139,0.1);">
                          <i class="ri-pencil-line" style="color:var(--p-400);"></i>
                        </button>
                        <button class="btn-icon" title="WhatsApp" onclick="ExamenesEngine.enviarWhatsAppExamen({nombres:'${e.nombres.replace(/'/g,"\\'")}',apellidos:'${e.apellidos.replace(/'/g,"\\'")}',telefono:'${e.telefono}'},'${r.modulo.replace(/'/g,"\\'")}')" style="width:34px;height:34px;font-size:1rem;background:rgba(37,211,102,0.1);">
                          <i class="ri-whatsapp-line" style="color:#25D366;"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Importador Google Forms / Texto -->
        <div style="background:linear-gradient(145deg,var(--bg-card),var(--bg-elevated));border:1px solid var(--border-default);border-radius:var(--r-xl);padding:24px;">
          <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
            <i class="ri-google-fill" style="color:#ea4335;"></i> Importar desde Google Forms / Excel / Texto
          </h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">
            Pega aquí las respuestas. Formato: <code style="background:var(--bg-hover);padding:2px 6px;border-radius:4px;">Nombre del estudiante, Nota</code> (una por línea). El sistema buscará el estudiante y asignará la nota al módulo donde esté en riesgo.
          </p>
          <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:flex-start;">
            <textarea id="import-masivo-texto" class="form-control" rows="5" placeholder="ej:
Juan Perez, 85
Maria Garcia, 92
Luis Martinez, 78"></textarea>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn-primary" onclick="ExamenesEngine.procesarImportacionMasiva()" style="white-space:nowrap;"><i class="ri-upload-line"></i> Procesar</button>
              <button class="btn-secondary" onclick="document.getElementById('import-masivo-texto').value='';document.getElementById('import-masivo-resultado').innerHTML='';" style="white-space:nowrap;">Limpiar</button>
            </div>
          </div>
          <div id="import-masivo-resultado" style="margin-top:16px;"></div>
        </div>
      </div>
    `;
  },

  mostrarInputNota(estId, grupoId, modulo, notaActual, nombreDisplay) {
    const nuevaNota = prompt(`Registrar nota de reparación para:\n${nombreDisplay}\nMódulo: ${modulo}\n\n${notaActual !== null ? 'Nota actual: ' + notaActual + '\n' : ''}Escribe la nueva nota (0-100):`, notaActual ?? '');
    if(nuevaNota === null) return;
    const n = parseInt(nuevaNota);
    if(isNaN(n) || n < 0 || n > 100){ UI.showToast('⚠️ Nota inválida. Debe ser entre 0 y 100.'); return; }
    this.guardarNotaExamen(estId, grupoId, modulo, n);
  }
};