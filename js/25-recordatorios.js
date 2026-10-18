'use strict';
/* ════════════════════════════════════════════════════════════════════════
   25-recordatorios.js — Pendientes de hoy, en el dashboard

   Reúne lo que un docente/administrador debe atender hoy, calculado
   LOCALEMENTE sobre la base del centro (sin peticiones de red):

   · Asistencia del día todavía no tomada (grupo con alumnos activos).
   · Módulos cuyo cuaderno no tiene ninguna nota importada.
   · Estudiantes en riesgo académico (usa window.Riesgo).
   · Cambios guardados sin conexión que aún no llegaron a la nube.

   Alcance: el docente solo ve SUS grupos (emparejando el docenteGuia
   con su nombre); administrador y Global ven todos los grupos del
   centro. El invitado no ve la tarjeta.
   ════════════════════════════════════════════════════════════════════════ */
window.Recordatorios = (function () {

  const norm = valor => String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /* ¿Qué grupos están dentro del alcance del rol actual? */
  function gruposAlcance(grupos) {
    const rol = typeof AuthManager !== 'undefined' ? AuthManager.profile?.role : null;
    if (rol === 'invitado') return [];
    if (rol === 'docente') {
      const nombre = norm(typeof UI !== 'undefined' && typeof UI.nombreDocente === 'function'
        ? UI.nombreDocente()
        : (AuthManager.profile?.displayName || AuthManager.user?.displayName || ''));
      if (!nombre) return [];
      const propios = (grupos || []).filter(grupo => norm(grupo?.docenteGuia) === nombre);
      if (propios.length) return propios;
      /* Docente sin grupo firmado a su nombre: la lista de su centro no
         es suya para atender pendientes — no muestra nada suyo. */
      return [];
    }
    return grupos || []; // admin / global: todo el centro
  }

  /* Módulos del grupo que todavía no tienen NI UNA nota registrada. */
  function modulosSinNotas(grupo) {
    const estudiantes = Array.isArray(grupo?.estudiantes) ? grupo.estudiantes : [];
    const conNotas = new Set();
    estudiantes.forEach(estudiante => {
      const porModulo = estudiante?.evaluacionesPorModulo || {};
      Object.entries(porModulo).forEach(([modulo, informe]) => {
        const fuente = informe?.notas || informe?.evaluaciones || {};
        if (Object.keys(fuente).length) conNotas.add(modulo);
      });
    });
    const estructura = grupo?.estructuraModulos || {};
    const base = Object.keys(estructura).length
      ? Object.keys(estructura)
      : Array.from(conNotas);
    return base.filter(modulo => !conNotas.has(modulo));
  }

  /* Lista de pendientes: [{ icono, tipo, tono, titulo, detalle, accion }] */
  function pendientes() {
    if (typeof DataEngine === 'undefined' || !DataEngine.db) return [];
    const fecha = hoy();
    const salida = [];
    gruposAlcance(DataEngine.db.grupos || []).forEach(grupo => {
      const activos = (grupo?.estudiantes || []).filter(e => e?.estado === 'Activo');
      if (!activos.length) return;
      if (!((grupo.asistencia || {})[fecha])) {
        salida.push({
          icono: 'ri-calendar-check-line', tipo: 'asistencia',
          titulo: `Asistencia no tomada · ${grupo.nombre || grupo.id || 'grupo'}`,
          detalle: `${activos.length} estudiante(s) esperan su registro de hoy`,
          accion: String(grupo.id || '')
        });
      }
      const sinNotas = modulosSinNotas(grupo);
      if (sinNotas.length) {
        salida.push({
          icono: 'ri-file-excel-2-line', tipo: 'notas',
          titulo: `Cuaderno sin notas · ${grupo.nombre || grupo.id || 'grupo'}`,
          detalle: `Sin ninguna nota en ${sinNotas.length} módulo(s): ${sinNotas.slice(0, 3).join(', ')}${sinNotas.length > 3 ? ` y ${sinNotas.length - 3} más` : ''}`,
          accion: String(grupo.id || '')
        });
      }
      if (typeof Riesgo !== 'undefined' && salida.length < 12) {
        const informe = Riesgo.evaluarGrupo(grupo);
        if (informe.total) {
          salida.push({
            icono: 'ri-alarm-warning-line', tipo: 'riesgo', tono: 'rojo',
            titulo: `Riesgo académico · ${grupo.nombre || grupo.id || 'grupo'}`,
            detalle: `${informe.total} estudiante(s) con notas o asistencia en alerta`,
            accion: String(grupo.id || '')
          });
        }
      }
    });
    if (typeof DataEngine.tieneColaOffline === 'function' && DataEngine.tieneColaOffline()) {
      salida.push({
        icono: 'ri-cloud-off-line', tipo: 'cola',
        titulo: 'Cambios sin enviar a la nube',
        detalle: 'Se guardaron mientras no había internet; se envían al reconectar o al pulsar aquí',
        accion: ''
      });
    }
    return salida.slice(0, 14); // tope por rendimiento y legibilidad
  }

  function abrirGrupo(grupoId) {
    if (!grupoId || typeof UI === 'undefined') return;
    try {
      UI.irA('cuaderno-docente');
      const selector = document.getElementById('select-grupo-cuaderno');
      if (selector) selector.value = grupoId;
      if (typeof UI.actualizarTablaCuaderno === 'function') UI.actualizarTablaCuaderno();
    } catch (_) { /* la navegación es optativa */ }
  }

  /* Cliques de la tarjeta: cola → drenar; el resto abre el grupo en Cuaderno. */
  function pulsar(tipo, grupoId) {
    if (tipo === 'cola') {
      if (typeof DataEngine !== 'undefined' && typeof DataEngine.drenarColaOffline === 'function') {
        DataEngine.drenarColaOffline(true);
      }
      return;
    }
    if (grupoId) abrirGrupo(grupoId);
  }

  function tarjetaHTML() {
    const rol = typeof AuthManager !== 'undefined' ? AuthManager.profile?.role : null;
    if (rol === 'invitado') return '';
    const items = pendientes();
    if (!items.length) return '';
    const escapar = typeof UI !== 'undefined' && typeof UI.escaparTexto === 'function'
      ? texto => UI.escaparTexto(texto)
      : texto => String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const filas = items.map(item => {
      const destino = item.accion ? String(item.accion).replace(/'/g, "\\'") : '';
      return `<button type="button" class="record-item${item.tono ? ` tono-${item.tono}` : ''}" onclick="Recordatorios.pulsar('${item.tipo}','${destino}')">
          <i class="${item.icono}" aria-hidden="true"></i>
          <span class="record-item-texto">
            <strong>${escapar(item.titulo)}</strong>
            <small>${escapar(item.detalle)}</small>
          </span>
          ${item.accion ? '<i class="ri-arrow-right-s-line" aria-hidden="true"></i>' : '<i class="ri-cloud-line" aria-hidden="true"></i>'}
        </button>`;
    }).join('');
    return `<section class="bloque-analisis dash-recordatorios" aria-label="Pendientes de hoy">
      <div class="bloque-titulo">
        <h2><i class="ri-error-notification-line" aria-hidden="true"></i> Pendientes de hoy</h2>
        <span class="bloque-nota">${items.length} pendiente(s) en tu alcance</span>
      </div>
      <div class="record-lista">${filas}</div>
    </section>`;
  }

  return { pendientes, modulosSinNotas, gruposAlcance, abrirGrupo, pulsar, tarjetaHTML, hoy };
})();
