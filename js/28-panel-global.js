'use strict';
/* ════════════════════════════════════════════════════════════════════════
   28-panel-global.js — Vista comparativa de TODOS los centros

   Sección exclusiva del Administrador Global (que no pertenece a un
   solo centro): en una sola lectura `centers/` trae cada centro con su
   metadata y su appData, y calcula LOCALLY por centro:

   · Matrícula: grupos, activos, retirados.
   · Notas: promedio general con la fórmula oficial del cuaderno.
   · Riesgo: estudiantes en alerta (usa window.Riesgo, mismos criterios).
   · Asistencia: porcentaje global de ausencias y grupos sin familia
     registrada hoy (usa window.Recordatorios).

   Cada tarjeta permite ABRIR ese centro como centro operativo
   (AdminManager.switchCenter(id)), así el Global salta de centro sin
   salir de la sesión. Modelo "pull": se recarga solo con el botón
   «Recargar centros» (nada de listeners).
   ════════════════════════════════════════════════════════════════════════ */
window.PanelGlobal = (function () {

  const escapar = valor => String(valor ?? '')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fecha = iso => {
    const d = Date.parse(iso || '');
    return Number.isFinite(d)
      ? new Date(d).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
  };

  function esGlobal() {
    return typeof AuthManager !== 'undefined' && AuthManager.profile?.role === 'global';
  }

  /* Métricas de un centro a partir de su appData deserializado. */
  function evaluarCentro(id, metadata, appData) {
    const grupos = (appData?.grupos || []);
    let activos = 0, retirados = 0;
    let registrosNota = [], pesoFaltas = 0, pesoSesiones = 0, riesgoTotal = 0, riesgoAlto = 0;
    const fechaHoy = (typeof Recordatorios !== 'undefined' && Recordatorios.hoy) ? Recordatorios.hoy() : '';
    let sinAsistenciaHoy = 0;
    let gruposValidos = 0;
    /* Módulos del grupo: estructura → módulos observados → transversales
       (misma regla que Riesgo.modulosDe para que las cifras cuadren). */
    const modulosDe = grupo => {
      const estructura = grupo?.estructuraModulos && Object.keys(grupo.estructuraModulos);
      if (estructura && estructura.length) return estructura;
      if (typeof Riesgo !== 'undefined' && typeof Riesgo.modulosDe === 'function') return Riesgo.modulosDe(grupo);
      const vistos = new Set();
      (grupo?.estudiantes || []).forEach(estudiante => {
        Object.keys(estudiante?.evaluacionesPorModulo || {}).forEach(modulo => vistos.add(modulo));
      });
      if (vistos.size) return Array.from(vistos);
      return (typeof MODULOS_TRANSVERSALES !== 'undefined' && Array.isArray(MODULOS_TRANSVERSALES))
        ? MODULOS_TRANSVERSALES.slice() : [];
    };
    grupos.forEach(grupo => {
      try {
        if (!grupo) return;
        gruposValidos += 1;
        const lista = Array.isArray(grupo.estudiantes) ? grupo.estudiantes : [];
        const activosGrupo = lista.filter(e => e?.estado === 'Activo');
        activos += activosGrupo.length;
        retirados += lista.length - activosGrupo.length;
        /* Promedio con la fórmula oficial del cuaderno. */
        if (typeof CuadernoEngine !== 'undefined' && typeof CuadernoEngine.notaFinalModuloSistema === 'function') {
          const modulos = modulosDe(grupo);
          activosGrupo.forEach(estudiante => {
            modulos.forEach(modulo => {
              if (estudiante.convalidaciones && estudiante.convalidaciones[modulo]) return;
              try {
                const nota = CuadernoEngine.notaFinalModuloSistema(estudiante, modulo, null);
                if (typeof nota === 'number' && Number.isFinite(nota)) registrosNota.push(nota);
              } catch (_) { /* nota malformada: se omite */ }
            });
          });
        }
        if (typeof Riesgo !== 'undefined') {
          const informe = Riesgo.evaluarGrupo(grupo);
          riesgoTotal += informe.total;
          informe.estudiantes.forEach(fila => { if (fila.motivos.some(m => m.nivel === 'alto')) riesgoAlto += 1; });
          const mapa = Riesgo.asistencias(grupo);
          Object.values(mapa).forEach(a => { pesoFaltas += a.faltas; pesoSesiones += a.ses; });
        }
        if (fechaHoy && !(grupo.asistencia || {})[fechaHoy] && activosGrupo.length) sinAsistenciaHoy += 1;
      } catch (_) { /* grupo corrupto: el resto del centro sigue */ }
    });
    const promedio = registrosNota.length
      ? Math.round((registrosNota.reduce((a, b) => a + b, 0) / registrosNota.length) * 10) / 10
      : null;
    const faltasPct = pesoSesiones ? Math.round((pesoFaltas / pesoSesiones) * 100) : null;
    return {
      id: String(id),
      nombre: metadata?.name || id,
      activo: metadata?.active !== false,
      grupos: gruposValidos,
      activos,
      retirados,
      promedio,
      riesgoTotal,
      riesgoAlto,
      faltasPct,
      sinAsistenciaHoy,
      actualizado: appData?.lastUpdated || metadata?.createdAt || '',
      esActual: id === (typeof AuthManager !== 'undefined' ? AuthManager.activeCenterId : '')
    };
  }

  /* Lectura única de centers/ (metadata + appData juntos). */
  let _cache = null;

  async function cargarCentros({ forzar = false } = {}) {
    if (!esGlobal()) return [];
    if (_cache && !forzar) return _cache.centros;
    const database = window.FirebaseServices?.database;
    if (!database) throw new Error('La sesión de Firebase no está activa.');
    const snapshot = await database.ref('centers').once('value');
    const raiz = snapshot.val() || {};
    const centros = Object.entries(raiz)
      .filter(([, registro]) => registro && (registro.metadata ||registro.appData))
      .map(([id, registro]) => {
        try {
          const appData = DataEngine._deserializeDatabase(registro.appData || {});
          return evaluarCentro(id, registro.metadata || {}, appData);
        } catch (_) {
          return { id: String(id), nombre: registro?.metadata?.name || id, activo: registro?.metadata?.active !== false, corrupto: true, grupos: 0, activos: 0, retirados: 0, promedio: null, riesgoTotal: 0, riesgoAlto: 0, faltasPct: null, sinAsistenciaHoy: 0, actualizado: registro?.appData?.lastUpdated || '', esActual: false };
        }
      })
      .sort((a, b) => (a.esActual === b.esActual ? a.nombre.localeCompare(b.nombre, 'es') : a.esActual ? -1 : 1));
    _cache = { ts: new Date().toISOString(), centros };
    return centros;
  }

  function abrirCentro(id) {
    if (!esGlobal()) return;
    /* El panel switch usa el mapa de centros del AdminManager: si el
       admin nunca se abrió, se lo poblamos desde esta vista. */
    if (typeof AdminManager !== 'undefined' && _cache?.centros) {
      AdminManager.centers = Object.fromEntries(_cache.centros.map(c => [c.id, { name: c.nombre, active: c.activo, id: c.id }]));
    }
    if (typeof AdminManager !== 'undefined' && typeof AdminManager.switchCenter === 'function') {
      AdminManager.switchCenter(String(id));
    }
  }

  function renderVista() {
    if (!esGlobal()) {
      return `<div class="module-fade-enter">${typeof UI !== 'undefined' && UI.estadoVacioHTML ? UI.estadoVacioHTML({
        icono: 'ri-lock-2-line', titulo: 'Vista exclusiva del Administrador Global',
        texto: 'Este panel compara todos los centros tecnológicos de la institución.'
      }) : ''}</div>`;
    }
    return `<div class="module-fade-enter">
      <header class="view-header" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
        <div><h1>Vista Global de la institución</h1>
          <p>Comparativa de todos los centros tecnológicos: matrícula, promedios, asistencia y riesgo. Abre el que quieras operar.</p></div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button type="button" class="btn-primary-soft" data-pg-recargar><i class="ri-refresh-line" aria-hidden="true"></i> Recargar centros</button>
        </div>
      </header>
      <div id="pg-contenido"><p class="pg-cargando"><i class="ri-loader-4-line pg-giro"></i> Cargando centros…</p></div>
    </div>`;
  }

  /* Dispara tras pintar la sección. */
  async function alMostrar() {
    if (!esGlobal()) return;
    const cont = document.getElementById('pg-contenido');
    if (!cont) return;
    const boton = document.querySelector('[data-pg-recargar]');
    if (boton) boton.onclick = () => { _cache = null; alMostrar(); };
    try {
      const centros = await cargarCentros();
      if (!document.getElementById('pg-contenido')) return; // cambiaron de sección
      cont.innerHTML = pintar(centros);
    } catch (error) {
      cont.innerHTML = `<p class="pg-error">⚠ No se pudieron cargar los centros: ${escapar(error.message || 'error de red')}. Pulsa «Recargar centros» para reintentar.</p>`;
    }
  }

  function pintar(centros) {
    if (!centros.length) {
      return typeof UI !== 'undefined' && UI.estadoVacioHTML ? UI.estadoVacioHTML({
        icono: 'ri-building-2-line', titulo: 'No hay centros registrados todavía',
        texto: 'Se crean desde Administración — crear centro, o al llegar la primera cuenta de cada uno.'
      }) : '';
    }
    const activosOk = centros.filter(c => c.activo && !c.corrupto);
    const kpi = (valor, etiqueta, icono, tono, pie) => `
      <div class="kpi-card"><span class="kpi-etiqueta"><span class="kpi-texto">${escapar(etiqueta)}</span></span>
        <span class="kpi-cuerpo"><span class="kpi-icono ${tono}"><i class="${icono}" aria-hidden="true"></i></span>
        <span class="kpi-datos"><span class="kpi-valor">${valor}</span><span class="kpi-pie">${pie}</span></span></span></div>`;
    const totalActivos = activosOk.reduce((s, c) => s + c.activos, 0);
    const totalRiesgo = activosOk.reduce((s, c) => s + c.riesgoTotal, 0);
    const promedios = activosOk.map(c => c.promedio).filter(n => typeof n === 'number');
    const promedioGlobal = promedios.length
      ? Math.round((promedios.reduce((a, b) => a + b, 0) / promedios.length) * 10) / 10 : null;
    const kpis = [
      kpi(`${activosOk.length}/${centros.length}`, 'Centros operativos', 'ri-building-2-line', 'azul', 'Cuentas con espacio de datos'),
      kpi(totalActivos, 'Matrícula total', 'ri-group-line', 'verde', `${activosOk.reduce((s, c) => s + c.grupos, 0)} grupo(s) en total`),
      kpi(promedioGlobal === null ? '—' : promedioGlobal, 'Promedio intercentros', 'ri-bar-chart-grouped-line', 'cyan', 'Media de los promedios de centro'),
      kpi(totalRiesgo, 'Estudiantes en riesgo', 'ri-alarm-warning-line', totalRiesgo ? 'rojo' : 'verde', 'Mismos criterios que cada centro')
    ].join('');

    const filas = centros.map(c => {
      const clasesTapa = ['pg-card'];
      if (c.esActual) clasesTapa.push('pg-actual');
      if (!c.activo) clasesTapa.push('pg-inactivo');
      if (c.riesgoAlto) clasesTapa.push('pg-card-atencion');
      const filaTarjeta = c.corrupto
        ? `<span class="pg-sub">Datos ilegibles — revisar base del centro.</span>`
        : `<span class="pg-metricas">
            <b>${c.grupos}</b> grupo(s) · <b>${c.activos}</b> activos · <b>${c.retirados}</b> retirados
          </span>
          <span class="pg-metricas">
            <em>promedio <b>${c.promedio === null ? '—' : c.promedio}</b></em> ·
            <em>riesgo <b class="${c.riesgoTotal ? 'pg-alerta' : ''}">${c.riesgoTotal}</b>${c.riesgoAlto ? ` (${c.riesgoAlto} alto)` : ''}</em> ·
            <em>ausencias <b>${c.faltasPct === null ? '—' : c.faltasPct + '%'}</b></em>
          </span>
          <span class="pg-sub">Sin asistencia de hoy: <b>${c.sinAsistenciaHoy}</b> grupo(s) · actualizado ${fecha(c.actualizado)}</span>`;
      return `<div class="${clasesTapa.join(' ')}">
        ${c.esActual ? '<em class="pg-remache">CENTRO ACTIVO</em>' : ''}
        <span class="pg-titulo"><i class="${c.activo ? 'ri-building-2-fill' : 'ri-building-2-line'}" aria-hidden="true"></i> ${escapar(c.nombre)}</span>
        ${filaTarjeta}
        <span class="pg-acciones">
          ${c.esActual ? '<span class="pg-chip ok">✔ tienes abierto este centro</span>' : `<button type="button" class="btn-primary-soft" onclick="PanelGlobal.abrirCentro('${c.id.replace(/'/g, "\\'")}')"><i class="ri-folder-open-line"></i> Abrir centro</button>`}
        </span>
      </div>`;
    }).join('');

    return `
      <section class="bloque-analisis pg-resumen" aria-label="Resumen intercentros">
        <div class="bloque-titulo"><h2><i class="ri-global-line" aria-hidden="true"></i> Resumen intercentros</h2>
          <span class="bloque-nota">${centros.length} centro(s) · lectura ${fecha(_cache?.ts)}</span></div>
        <div class="kpi-grid">${kpis}</div>
      </section>
      <section class="bloque-analisis pg-listado" aria-label="Centros">
        <div class="bloque-titulo"><h2><i class="ri-community-line" aria-hidden="true"></i> Centros</h2>
          <span class="bloque-nota">El marcado «CENTRO ACTIVO» es el espacio donde están trabajando sus operaciones</span></div>
        <div class="pg-cards">${filas}</div>
      </section>`;
  }

  return { renderVista, alMostrar, cargarCentros, evaluarCentro, abrirCentro };
})();
