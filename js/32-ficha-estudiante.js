'use strict';
/* ═══════════════════════════════════════════════════════════════
   32-ficha-estudiante.js — Ficha 360 del estudiante
   ───────────────────────────────────────────────────────────────
   Una sola pantalla con TODO lo que el docente necesita saber de un
   alumno sin abrir cinco secciones distintas:
     · datos personales y de contacto
     · notas por módulo (con las columnas reales del grupo) + promedio
     · convalidaciones
     · asistencia acumulada (P / T / A)
     · señales de riesgo (si el motor 26-riesgo ya está cargado)

   Es de SOLO LECTURA: para corregir algo hay que ir a la sección
   correspondiente (el botón «Editar» abre el modal de estudiantes).

   Por qué existe: a diario el docente pregunta "¿cómo va ese alumno?"
   y hasta ahora tenía que cruzar Cuaderno + Asistencia + Riesgo.
   ═══════════════════════════════════════════════════════════════ */

window.FichaEstudiante = (function () {
  const UMBRAL = 60;                 // nota mínima de aprobación en INATEC
  const CLAVE_GRUPO = 'tic-ficha-grupo';

  /* ── utilidades ─────────────────────────────────────────────── */
  function esc(v) {
    if (window.UI && typeof UI.escaparTexto === 'function') return UI.escaparTexto(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function grupos() {
    try {
      return (typeof DataEngine !== 'undefined' && DataEngine && typeof DataEngine.getGrupos === 'function')
        ? (DataEngine.getGrupos() || []) : [];
    } catch (e) { return []; }
  }

  function nombreCompleto(s) {
    return `${s.nombres || ''} ${s.apellidos || ''}`.trim() || '(sin nombre)';
  }

  /* Lista de estudiantes del centro. Usa el directorio de DataEngine
     y, si viene vacío (primer arranque / arnés), aplana los grupos. */
  function estudiantes() {
    let lista = [];
    try {
      if (typeof DataEngine !== 'undefined' && DataEngine && typeof DataEngine.getEstudiantes === 'function') {
        lista = DataEngine.getEstudiantes() || [];
      }
    } catch (e) { lista = []; }
    if (Array.isArray(lista) && lista.length) return lista;

    const salida = [];
    grupos().forEach(g => {
      (g.estudiantes || []).forEach(s => {
        salida.push(Object.assign({}, s, {
          grupoId: s.grupoId || g.id,
          grupoNombre: s.grupoNombre || g.nombre,
          carrera: s.carrera || g.carrera,
          turno: s.turno || g.turno
        }));
      });
    });
    return salida;
  }

  function buscar(id) {
    if (id === null || id === undefined || id === '') return null;
    return estudiantes().find(s => String(s.id) === String(id)) || null;
  }

  function grupoDe(s) {
    return grupos().find(g => String(g.id) === String(s && s.grupoId)) || null;
  }

  function modulos() {
    try {
      if (window.ModulosAcademicos && typeof ModulosAcademicos.listar === 'function') {
        return ModulosAcademicos.listar() || [];
      }
    } catch (e) { /* sin catálogo: se usa la lista transversal */ }
    return (typeof MODULOS_TRANSVERSALES !== 'undefined' && Array.isArray(MODULOS_TRANSVERSALES))
      ? MODULOS_TRANSVERSALES.slice() : [];
  }

  /* Columnas de notas del grupo (P1, P2, …): unión de las claves que
     realmente aparecen, ordenadas, para que la tabla sea consistente. */
  function columnasDeNotas(grupo) {
    const cols = new Set();
    (grupo && grupo.estudiantes ? grupo.estudiantes : []).forEach(s => {
      Object.values((s && s.evaluacionesPorModulo) || {}).forEach(mod => {
        Object.keys((mod && mod.notas) || {}).forEach(k => cols.add(k));
      });
    });
    return Array.from(cols).sort();
  }

  function notasDe(s, modulo) {
    const mod = s.evaluacionesPorModulo && s.evaluacionesPorModulo[modulo];
    return mod && mod.notas ? mod.notas : null;
  }

  function convalidado(s, modulo) {
    return Boolean(s.convalidaciones && s.convalidaciones[modulo]);
  }

  function promedioModulo(s, modulo) {
    const notas = notasDe(s, modulo);
    if (!notas) return null;
    const valores = Object.values(notas).filter(v => typeof v === 'number' && !isNaN(v));
    if (!valores.length) return null;
    return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
  }

  function resumen(s) {
    let suma = 0, evaluados = 0, aprobados = 0, convalidados = 0, sinNotas = 0;
    modulos().forEach(m => {
      if (convalidado(s, m)) { convalidados++; return; }
      const prom = promedioModulo(s, m);
      if (prom === null) { sinNotas++; return; }
      suma += prom; evaluados++;
      if (prom >= UMBRAL) aprobados++;
    });
    return {
      promedio: evaluados ? Math.round(suma / evaluados) : null,
      aprobados, evaluados, convalidados, sinNotas,
      total: modulos().length
    };
  }

  /* Asistencia acumulada: grupo.asistencia[fecha] = { idEst: 'P'|'T'|'A' } */
  function asistenciaDe(s, grupo) {
    const reg = grupo && grupo.asistencia ? grupo.asistencia : null;
    if (!reg || typeof reg !== 'object') return null;
    let p = 0, t = 0, a = 0;
    Object.keys(reg).forEach(fecha => {
      const marca = reg[fecha] && reg[fecha][String(s.id)];
      if (marca === 'P') p++;
      else if (marca === 'T') t++;
      else if (marca === 'A') a++;
    });
    const total = p + t + a;
    return total ? { p, t, a, total, pct: Math.round(((p + t) / total) * 100) } : null;
  }

  /* Señales de riesgo: solo si 26-riesgo.js ya está en memoria. */
  function riesgoDe(s, grupo) {
    if (typeof Riesgo === 'undefined' || !Riesgo || typeof Riesgo.evaluarGrupo !== 'function') return null;
    try {
      const informe = Riesgo.evaluarGrupo(grupo);
      const fila = (informe.estudiantes || []).find(f =>
        f && f.estudiante && String(f.estudiante.id) === String(s.id));
      return fila ? fila.motivos : [];
    } catch (e) { return null; }
  }

  function iniciales(s) {
    const n = (s.nombres || '').trim().charAt(0);
    const a = (s.apellidos || '').trim().charAt(0);
    return (n + a).toUpperCase() || '?';
  }

  /* ── vista ──────────────────────────────────────────────────── */
  function renderVista() {
    const lista = estudiantes();
    const g = grupos();
    const opcionesGrupo = `<option value="">Todos los grupos</option>` +
      g.map(gr => `<option value="${esc(gr.id)}">${esc(gr.nombre)}</option>`).join('');
    const opcionesEst = lista.map(s =>
      `<option value="${esc(s.id)}">${esc(nombreCompleto(s))}</option>`).join('');

    return `<div class="module-fade-enter">
      <div class="view-header">
        <h1>Ficha del Estudiante <span class="ficha-contador">${lista.length} alumnos</span></h1>
        <p>Una sola pantalla con lo académico, la asistencia y las señales de riesgo de un alumno.</p>
      </div>
      <div class="ficha-barra no-imprimir">
        <label class="tb-label" for="ficha-grupo"><i class="ri-team-line"></i> Grupo</label>
        <select id="ficha-grupo" class="form-control ficha-sel-grupo">${opcionesGrupo}</select>
        <label class="tb-label" for="ficha-est"><i class="ri-user-3-line"></i> Estudiante</label>
        <select id="ficha-est" class="form-control ficha-sel-est">${opcionesEst}</select>
        <div class="barra-acciones">
          <button type="button" class="btn-ghost" onclick="FichaEstudiante.imprimirFicha()"><i class="ri-printer-line"></i> Imprimir</button>
        </div>
      </div>
      <div id="ficha-360" class="ficha-360"></div>
    </div>`;
  }

  function fichaHTML(s) {
    const grupo = grupoDe(s);
    const res = resumen(s);
    const asis = asistenciaDe(s, grupo);
    const riesgo = riesgoDe(s, grupo);
    const cols = columnasDeNotas(grupo);

    const filasModulos = modulos().map(m => {
      const con = convalidado(s, m);
      const prom = promedioModulo(s, m);
      const notas = notasDe(s, m) || {};
      const celdas = cols.length
        ? cols.map(c => `<td>${notas[c] === undefined || notas[c] === null || notas[c] === ''
            ? '<span class="ficha-celda-vacia">—</span>' : esc(notas[c])}</td>`).join('')
        : '<td><span class="ficha-celda-vacia">sin columnas</span></td>';
      const estado = con
        ? '<span class="ficha-estado convalidado">Convalidado</span>'
        : (prom === null
          ? '<span class="ficha-estado sin-notas">Sin notas</span>'
          : (prom >= UMBRAL
            ? '<span class="ficha-estado aprobado">Aprobado</span>'
            : '<span class="ficha-estado reprobado">Reprobado</span>'));
      return `<tr>
        <td><strong>${esc(m)}</strong></td>
        ${celdas}
        <td class="ficha-prom">${prom === null ? '—' : prom}</td>
        <td>${estado}</td>
      </tr>`;
    }).join('');

    const cabecerasCols = cols.length
      ? cols.map(c => `<th class="ficha-col-nota">${esc(c)}</th>`).join('')
      : '<th class="ficha-col-nota">Nota</th>';

    const tarjeta = (icono, titulo, valor, nota) => `
      <div class="ficha-stat">
        <i class="${icono}" aria-hidden="true"></i>
        <div>
          <strong>${valor}</strong>
          <small>${titulo}</small>
          ${nota ? `<em>${nota}</em>` : ''}
        </div>
      </div>`;

    const contacto = `
      <div class="ficha-tarjeta">
        <h3 class="ficha-tarjeta-titulo"><i class="ri-contacts-line" aria-hidden="true"></i> Contacto y ubicación</h3>
        <dl class="ficha-datos">
          <div><dt>Correo</dt><dd>${esc(s.correo || '—')}</dd></div>
          <div><dt>Teléfono</dt><dd>${esc(s.telefono || '—')}</dd></div>
          <div><dt>Grupo</dt><dd>${esc(s.grupoNombre || (grupo && grupo.nombre) || '—')}</dd></div>
          <div><dt>Carrera</dt><dd>${esc((grupo && grupo.carrera) || s.carrera || '—')}</dd></div>
          <div><dt>Turno</dt><dd>${esc((grupo && grupo.turno) || s.turno || '—')}</dd></div>
          <div><dt>Estado</dt><dd><span class="ficha-estado estado-${String(s.estado).toLowerCase() === 'activo' ? 'activo' : 'retirado'}">${esc(s.estado || 'Activo')}</span></dd></div>
        </dl>
      </div>`;

    let riesgoHTML;
    if (riesgo === null) {
      riesgoHTML = '<p class="ficha-nota">Las señales de riesgo se calculan cuando el motor de riesgo está cargado.</p>';
    } else if (!riesgo.length) {
      riesgoHTML = '<p class="ficha-ok"><i class="ri-check-line" aria-hidden="true"></i> Sin señales de riesgo.</p>';
    } else {
      riesgoHTML = '<ul class="ficha-riesgo">' + riesgo.map(m =>
        `<li class="ficha-riesgo-item nivel-${esc(m.nivel || 'medio')}">
          <i class="${m.nivel === 'alto' ? 'ri-error-warning-fill' : 'ri-information-fill'}" aria-hidden="true"></i>
          <span><strong>${esc(m.tipo)}</strong> — ${esc(m.detalle)}</span>
        </li>`).join('') + '</ul>';
    }

    const asistenciaHTML = asis
      ? `<div class="ficha-tarjeta">
          <h3 class="ficha-tarjeta-titulo"><i class="ri-calendar-check-line" aria-hidden="true"></i> Asistencia acumulada</h3>
          <div class="ficha-asistencia">
            <span class="ficha-asistencia-num">${asis.pct}%</span>
            <span class="ficha-asistencia-detalle">
              <span><strong>${asis.p}</strong> presentes</span>
              <span><strong>${asis.t}</strong> tardanzas</span>
              <span><strong>${asis.a}</strong> ausencias</span>
            </span>
          </div>
        </div>`
      : '';

    return `
      <div class="ficha-hero">
        <div class="ficha-avatar">${iniciales(s)}</div>
        <div class="ficha-hero-texto">
          <h2>${esc(nombreCompleto(s))}</h2>
          <p>${esc(s.grupoNombre || (grupo && grupo.nombre) || 'Sin grupo')}${grupo && grupo.carrera ? ' · ' + esc(grupo.carrera) : ''}</p>
        </div>
        <div class="ficha-hero-acciones" data-permiso="editarRegistros">
          <button type="button" class="btn-ghost" onclick="UI.openEditStudentModal('${esc(s.grupoId || (grupo && grupo.id) || '')}', '${esc(s.id)}')">
            <i class="ri-pencil-line"></i> Editar
          </button>
        </div>
      </div>

      <div class="ficha-stats">
        ${tarjeta('ri-award-line', 'Promedio general', res.promedio === null ? '—' : res.promedio,
          res.evaluados ? `${res.aprobados}/${res.evaluados} módulos aprobados` : 'sin notas registradas')}
        ${tarjeta('ri-checkbox-circle-line', 'Aprobados', `${res.aprobados}`, `de ${res.evaluados} evaluados`)}
        ${tarjeta('ri-exchange-line', 'Convalidados', `${res.convalidados}`, `de ${res.total} módulos`)}
        ${tarjeta('ri-calendar-check-line', 'Asistencia', asis ? asis.pct + '%' : '—',
          asis ? `${asis.a} ausencia(s)` : 'sin registros')}
      </div>

      <div class="ficha-tarjeta">
        <h3 class="ficha-tarjeta-titulo"><i class="ri-file-list-3-line" aria-hidden="true"></i> Notas por módulo</h3>
        <div class="table-container"><table class="custom-table ficha-tabla">
          <thead><tr><th>Módulo</th>${cabecerasCols}<th class="ficha-col-prom">Promedio</th><th>Estado</th></tr></thead>
          <tbody>${filasModulos}</tbody>
        </table></div>
      </div>

      <div class="ficha-columnas">
        ${contacto}
        <div class="ficha-tarjeta">
          <h3 class="ficha-tarjeta-titulo"><i class="ri-alarm-warning-line" aria-hidden="true"></i> Señales de riesgo</h3>
          ${riesgoHTML}
        </div>
      </div>

      ${asistenciaHTML}`;
  }

  function estadoVacio() {
    return `<div class="estado-panel estado-vacio" role="status">
      <i class="ri-user-search-line" aria-hidden="true"></i>
      <h3>No hay estudiantes cargados</h3>
      <p>Carga un listado de grupo en «Grupos de Clase» para ver aquí su ficha.</p>
    </div>`;
  }

  function pintarFicha(id) {
    const cont = document.getElementById('ficha-360');
    if (!cont) return;
    const s = buscar(id);
    cont.innerHTML = s ? fichaHTML(s) : estadoVacio();
    if (typeof Permisos !== 'undefined' && Permisos && typeof Permisos.aplicar === 'function') {
      Permisos.aplicar(cont);
    }
  }

  function guardarGrupo(valor) {
    try {
      if (valor) localStorage.setItem(CLAVE_GRUPO, String(valor));
      else localStorage.removeItem(CLAVE_GRUPO);
    } catch (e) { /* sin almacenamiento: no se recuerda */ }
  }

  function grupoGuardado() {
    try { return localStorage.getItem(CLAVE_GRUPO) || ''; } catch (e) { return ''; }
  }

  /* Repuebla el select de estudiantes según el grupo elegido y deja
     seleccionado el que pedía la URL (?est=…) o el primero. */
  function repoblarEstudiantes(preseleccion) {
    const selG = document.getElementById('ficha-grupo');
    const selE = document.getElementById('ficha-est');
    if (!selE) return;
    const filtro = selG ? selG.value : '';
    const lista = estudiantes();
    let html = '';
    grupos().forEach(g => {
      if (filtro && String(g.id) !== String(filtro)) return;
      const ests = lista.filter(s => String(s.grupoId) === String(g.id));
      if (!ests.length) return;
      html += `<optgroup label="${esc(g.nombre)}">` +
        ests.map(s => `<option value="${esc(s.id)}">${esc(nombreCompleto(s))}</option>`).join('') +
        `</optgroup>`;
    });
    selE.innerHTML = html;

    let elegido = preseleccion;
    if (!elegido) {
      const primero = selE.querySelector('option');
      elegido = primero ? primero.value : '';
    }
    if (elegido && selE.querySelector(`option[value="${CSS && CSS.escape ? CSS.escape(elegido) : elegido}"]`)) {
      selE.value = elegido;
    }
    pintarFicha(selE.value);
  }

  function iniciar() {
    const selG = document.getElementById('ficha-grupo');
    const selE = document.getElementById('ficha-est');
    if (!selE) return;

    if (selG) {
      const guardado = grupoGuardado();
      if (guardado && selG.querySelector(`option[value="${CSS && CSS.escape ? CSS.escape(guardado) : guardado}"]`)) {
        selG.value = guardado;
      }
      selG.addEventListener('change', () => {
        guardarGrupo(selG.value);
        repoblarEstudiantes();
      });
    }

    selE.addEventListener('change', () => pintarFicha(selE.value));

    // La ficha puede llegar con ?est=<id> en la URL (enlaces desde otras vistas).
    let inicial = '';
    try {
      const consulta = location.hash.split('?')[1] || '';
      inicial = new URLSearchParams(consulta).get('est') || '';
    } catch (e) { inicial = ''; }

    repoblarEstudiantes(inicial);
  }

  function imprimirFicha() {
    if (window.UI && typeof UI.imprimirVista === 'function') UI.imprimirVista();
    else window.print();
  }

  return {
    renderVista,
    iniciar,
    pintarFicha,
    repoblarEstudiantes,
    imprimirFicha,
    todosLosEstudiantes: estudiantes
  };
})();
