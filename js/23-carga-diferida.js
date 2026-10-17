/* ═══════════════════════════════════════════════════════════════
   23-carga-diferida.js — Motores de segunda línea diferidos
   Los módulos que solo se usan con clicks propios de la
   experiencia (plantillas, informes, reportes, exámenes, informe
   de avance) no se cargan en el arranque: entran en reposo y
   bajan solos cuando la aplicación ya está viva. El arranque
   inicial queda pesando menos y pinta antes.
   Todo lo que se usa SÍ en el arranque (cuaderno, datos, UI,
   auditoría) sigue cargándose normal con <script defer>.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const LISTA = [
    'js/07-examenes-engine.js',
    'js/08-informe-engine.js',
    'js/20-plantillas.js',
    'js/21-reportes.js',
    'js/22-asistencia.js'
  ];
  const YA_INYECTADOS = new Set();

  function cargar(src) {
    if (YA_INYECTADOS.has(src)) return;
    YA_INYECTADOS.add(src);
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  function cargarTodoPocoAPoco() {
    LISTA.forEach((src, i) => setTimeout(() => cargar(src), i * 400));
  }

  /* Cuando la aplicación ya está lista y el navegador está libre:
     entran en cola y bajan en tandas sin bloquear nada. */
  window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(cargarTodoPocoAPoco, { timeout: 3000 });
    } else {
      setTimeout(cargarTodoPocoAPoco, 1000);
    }
  });
})();
