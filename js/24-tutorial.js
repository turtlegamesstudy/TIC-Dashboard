/* ═══════════════════════════════════════════════════════════════
   24-tutorial.js — Tutorial de primera vez por sección
   La primera vez que un docente abre cada área de la plataforma
   recibe una guía breve de sus partes; se marca como vista y no
   vuelve a aparecer (a menos que la pidan desde la Ayuda).
   Hecho para la inclusión: texto plano y claro, pasos cortos,
   se puede saltar todo con un click.
   Marca local: tic-tutoriales-vistos (por equipo, no sync: cada
   persona aprende a su ritmo en su propia pantalla).
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.Tutorial = (function () {
  const CLAVE = 'tic-tutoriales-vistos';

  /* ── Guías por sección: pasos con título y texto llano ── */
  const GUIAS = {
    'dashboard': [
      { t: 'Tu tablero de inicio', x: 'Esta pantalla resume lo del día: grupos, estudiantes y avisos del centro. Todo cambia solo: se toma de la base compartida.' },
      { t: 'El menú de la izquierda', x: 'Cada botón del menú abre un área distinta. Lo que uses seguido aparecerá arriba en “Recientes”.' }
    ],
    'grupos': [
      { t: 'Grupos', x: 'Aquí vives tus grupos con su listado de estudiantes. Puedes crear un grupo nuevo o abrir uno existente.' },
      { t: 'Cargar el listado', x: 'En “Cargar listado (.xlsx / .csv)” puedes subir el Excel de matrícula: los estudiantes se crean solos.' }
    ],
    'estudiantes': [
      { t: 'Directorio de estudiantes', x: 'La lista completa de todos los grupos: buscar por nombre, ver el detalle y editar los datos.' },
      { t: 'Cuidado con eliminar', x: 'Si eliminas un estudiante va a la Papelera (sección Administración) por si hay que restaurarlo.' }
    ],
    'cuaderno-docente': [
      { t: 'Tu cuaderno docente', x: 'Este es el corazón del sistema: el registro de notas por grupo y módulo.' },
      { t: 'Elegir grupo y módulo', x: 'Con los dos selectores de arriba eliges el grupo y luego el módulo (o “TODOS” para un resumen).' },
      { t: 'Asistencia rápida', x: 'El botón “Asistencia” toma lista en un click por estudiante: Presente → Tarde → Ausente.' },
      { t: 'Hoja de cálculo de notas', x: 'Puedes escribir las notas directo en la tabla, como en Excel: guardar solo con pasar a otra celda. Y si pegas desde Excel, respeta las filas y columnas.' },
      { t: 'Plantillas e informes', x: '“Guardar esta estructura” y “Plantillas” copian tu configuración de parciales a otros grupos. “Informes en lote” genera un PDF por estudiante.' }
    ],
    'Examenes-Reparacion': [
      { t: 'Exámenes de reparación', x: 'Configura aquí los exámenes de reparación de cada módulo: fecha, responsables y resultado.' }
    ],
    'informe-avance': [
      { t: 'Informe de avance', x: 'El formato institucional que reporta el avance del centro. Puedes editarlo, completar dificultades y plan de acción, y descargarlo como Word.' }
    ],
    'envio-mensajes': [
      { t: 'Mensajes al aula', x: 'Envía avisos a las familias por WhatsApp o correo, con plantillas listas. Se sincroniza con el directorio.' }
    ],
    'equipos': [
      { t: 'Equipos técnicos', x: 'Organiza los equipos de trabajo, asigna coordinador e integrantes, y consulta sus entregas.' }
    ],
    'estadisticas': [
      { t: 'Estadísticas', x: 'Las gráficas del centro: promedio por módulo y estado de los estudiantes. Se arma automáticamente con las notas del cuaderno.' },
      { t: 'Comparar períodos', x: 'Cada vez que se guarda información queda una fotografía; puedes comparar cómo va el grupo contra días anteriores.' }
    ],
    'perfil': [
      { t: 'Tu perfil', x: 'Tus datos personales y de tu institución. Mantenlos al día: aquí salen en los documentos que firmas.' }
    ],
    'administracion': [
      { t: 'Administración', x: 'Solo para administradores: auditoría de acciones, papelera de restauración, módulos del centro y respaldo de la base.' },
      { t: 'Bitácora de auditoría', x: 'Cada acción importante queda registrada: quién, qué y cuándo. Nada de “pero yo no hice eso”.' },
      { t: 'Papelera', x: 'Lo eliminado va aquí primero: se puede restaurar si alguien borró por error.' }
    ]
  };

  /* Texto de referencia rápida de los roles (aparece en la primera
     visita de Administración y en la bienvenida inicial). */
  function textoRol() {
    if (typeof Permisos === 'undefined') return '';
    try { return ' ' + Permisos.resumenRol(Permisos.rolActual()); } catch (_) { return ''; }
  }

  GUIAS['dashboard'].push(
    { t: '¿Qué rol tengo?', x: 'En INATEC hay tres niveles:' +
        ' el Administrador Global gestiona usuarios y la plataforma;' +
        ' el Administrador carga bases y configura módulos del centro;' +
        ' el Docente trabaja las notas y la asistencia de sus grupos.' + textoRol() }
  );

  let _pasos = null;
  let _paso = 0;
  let _seccion = null;

  function vistos() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function marcarVisto(id) {
    const mapa = vistos();
    mapa[id] = true;
    try { localStorage.setItem(CLAVE, JSON.stringify(mapa)); } catch (_) { }
  }
  function quedanPendientes(id) {
    return Array.isArray(GUIAS[id]) && !vistos()[id];
  }

  /* ── La tarjeta del tutorial ── */
  function tabla(id) {
    let tarjeta = document.getElementById('tutorial-tarjeta');
    if (!tarjeta) {
      tarjeta = document.createElement('div');
      tarjeta.id = 'tutorial-tarjeta';
      tarjeta.className = 'tutorial-tarjeta';
      tarjeta.setAttribute('role', 'dialog');
      tarjeta.setAttribute('aria-live', 'polite');
      document.body.appendChild(tarjeta);
    }
    tarjeta.dataset.para = id;
    return tarjeta;
  }

  function pintar() {
    if (!_pasos || !_pasos.length) return;
    const paso = _pasos[_paso];
    const tarjeta = tabla(_seccion);
    const ultimo = _paso === _pasos.length - 1;
    tarjeta.innerHTML =
      `<div class="tutorial-cabecera">
        <span class="tutorial-kicker"><i class="ri-graduation-cap-line" aria-hidden="true"></i> Tutorial</span>
        <small class="tutorial-pasos">${_paso + 1} de ${_pasos.length}</small>
      </div>
      <h3 class="tutorial-titulo">${UI.escaparTexto(paso.t)}</h3>
      <p class="tutorial-texto">${UI.escaparTexto(paso.x)}</p>
      <div class="tutorial-acciones">
        <button type="button" class="btn-ghost" onclick="Tutorial.verTodaLaApp()">Recorrer la app</button>
        <span class="tutorial-espacio"></span>
        <button type="button" class="btn-ghost" onclick="Tutorial.cerrarDefinitivo()">No volver a mostrar</button>
        <button type="button" class="btn-primary-soft" onclick="Tutorial.avanzar()">${ultimo ? 'Entendido' : 'Siguiente'}</button>
      </div>
      <button type="button" class="tutorial-cerrar" aria-label="Cerrar tutorial" onclick="Tutorial.omitir()"><i class="ri-close-line" aria-hidden="true"></i></button>`;
    tarjeta.dataset.abierto = 'si';
  }

  function ocultar() {
    const tarjeta = document.getElementById('tutorial-tarjeta');
    if (tarjeta) tarjeta.dataset.abierto = '';
  }

  /* ── API pública ── */
  /* Se llama cada vez que se muestra una sección: solo la primera vez despliega. */
  function ver(id) {
    if (typeof UI === 'undefined' || !UI) return;
    const perfil = (typeof AuthManager !== 'undefined' && AuthManager) ? AuthManager.profile : null;
    if (perfil && perfil.role === 'invitado') return; /* el invitado es de paso rápido */
    if (!quedanPendientes(id)) return;
    if (_pasos && tabla().dataset.abierto === 'si') return; /* no pisar un tour abierto */
    _seccion = id;
    _pasos = GUIAS[id];
    _paso = 0;
    pintar();
  }

  function avanzar() {
    if (_paso < _pasos.length - 1) { _paso++; pintar(); return; }
    marcarVisto(_seccion);
    ocultar();
    _pasos = null;
  }

  function omitir() {
    if (_seccion) marcarVisto(_seccion);
    ocultar();
    _pasos = null;
  }

  function cerrarDefinitivo() {
    if (_seccion) marcarVisto(_seccion);
    ocultar();
    _pasos = null;
  }

  /* Recorrido general de la app: abre las guías pendientes, una por una. */
  let _tourApp = null;
  function verTodaLaApp() {
    ocultar();
    _pasos = null;
    _tourApp = Object.keys(GUIAS).filter(id => quedanPendientes(id) && typeof Secciones !== 'undefined' && Secciones.obtener(id));
    if (!_tourApp.length) { UI.showToast('Ya viste todas las guías: nada pendiente.', 'info'); return; }
    UI.showToast('Empezando el recorrido: se abrirán las guías de cada área…', 'info');
    siguienteTour();
  }
  function siguienteTour() {
    if (!_tourApp || !_tourApp.length) { _tourApp = null; return; }
    const id = _tourApp.shift();
    if (typeof UI !== 'undefined' && UI.irA(id)) {
      /* ver() abre su tarjeta; cuando la cierren, sigue la próxima */
      const esperandoCierre = setInterval(() => {
        const tarjeta = document.getElementById('tutorial-tarjeta');
        if (!tarjeta || tarjeta.dataset.abierto !== 'si' || (tarjeta.dataset.para && tarjeta.dataset.para !== id)) {
          clearInterval(esperandoCierre);
          setTimeout(siguienteTour, 300);
        }
      }, 400);
    } else {
      marcarVisto(id);
      siguienteTour();
    }
  }

  return {
    ver: ver,
    avanzar: avanzar,
    omitir: omitir,
    cerrarDefinitivo: cerrarDefinitivo,
    verTodaLaApp: verTodaLaApp,
    pendientes: function () { return Object.keys(GUIAS).filter(id => quedanPendientes(id)); }
  };
})();
