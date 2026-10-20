'use strict';
/* ═══════════════════════════════════════════════════════════════
   31-pwa.js — Instalación guiada + aviso de nueva versión
   ───────────────────────────────────────────────────────────────
   Dos mejoras para el despliegue en los centros:

   1 · INSTALAR APP: cuando el navegador dispara beforeinstallprompt
       aparece el botón de instalación en la barra superior; con un
       toque el docente deja la app en su escritorio/panel sin tocar
       dominios ni consola. En iOS no hay ese evento (el botón ni
       aparece): ahí la instalación se hace desde «Compartir »
       Añadir a pantalla de inicio».

   2 · NUEVA VERSIÓN: antes la app se reembobillaba SILENCIOSAMENTE
       (podía perderse el form en pantalla). Ahora, cuando el service
       worker ya está controlando esta sesión y entra una versión
       nueva, se muestra una franja fija con botón «Recargar»: el
       docente decide el momento (como en toda app instalada).

   La maquinaria del SW (skipWaiting + mensaje 'tic-actualizar' que
   navega los clientes) vive en sw.js y no cambia aquí.
   ═══════════════════════════════════════════════════════════════ */
window.PWA = (function () {

  var eventoInstalacion = null;

  function mensaje(texto) {
    if (typeof UI !== 'undefined' && UI && typeof UI.showToast === 'function') {
      UI.showToast(texto);
    } else if (typeof console !== 'undefined') {
      console.log('[PWA]', texto);
    }
  }

  /* ── 1 · Instalación en un toque ───────────────────────────── */
  function ocultarBoton() {
    var boton = document.getElementById('btn-instalar-pwa');
    if (boton) boton.hidden = true;
  }

  function instalar() {
    if (!eventoInstalacion) {
      mensaje('Instálala desde el menú del navegador: «Añadir a pantalla de inicio».');
      return;
    }
    eventoInstalacion.prompt();
    eventoInstalacion.userChoice.then(function (eleccion) {
      if (eleccion && eleccion.outcome === 'accepted') {
        mensaje('✨ La app quedó instalada en este equipo.');
      } else {
        mensaje('Listo. Puedes instalarla después desde el botón de la barra.');
      }
      eventoInstalacion = null;
      ocultarBoton();
    }).catch(function () { /* el navegador canceló el diálogo */ });
  }

  function prepararInstalacion() {
    window.addEventListener('beforeinstallprompt', function (evento) {
      evento.preventDefault();
      eventoInstalacion = evento;
      var boton = document.getElementById('btn-instalar-pwa');
      if (boton) boton.hidden = false;
    });
    window.addEventListener('appinstalled', function () {
      ocultarBoton();
      eventoInstalacion = null;
      mensaje('✨ La app quedó instalada en este equipo.');
    });
  }

  /* ── 2 · Aviso de versión nueva ────────────────────────────── */
  function quitarAviso() {
    var aviso = document.getElementById('pwa-aviso-version');
    if (aviso) aviso.remove();
  }

  function mostrarAviso() {
    if (document.getElementById('pwa-aviso-version')) return;
    var strip = document.createElement('div');
    strip.className = 'pwa-aviso';
    strip.id = 'pwa-aviso-version';
    strip.setAttribute('role', 'status');
    strip.innerHTML =
      '<i class="ri-refresh-line" aria-hidden="true"></i>' +
      '<span class="pwa-aviso-texto"><strong>Nueva versión disponible</strong> — recarga para estrenarla</span>' +
      '<button type="button" class="pwa-aviso-btn">Recargar</button>' +
      '<button type="button" class="pwa-aviso-cerrar" aria-label="Cerrar aviso de actualización">' +
      '<i class="ri-close-line" aria-hidden="true"></i></button>';

    strip.querySelector('.pwa-aviso-btn').addEventListener('click', function () {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage('tic-actualizar');
        }
      } catch (e) { /* el SW tardó: el recado de abajo lo cubre */ }
      /* Red de seguridad: si el SW no navega los clientes (mensajes
         que llegan tarde, worker dormido) recargamos nosotros. */
      setTimeout(function () { location.reload(); }, 1200);
    });
    strip.querySelector('.pwa-aviso-cerrar').addEventListener('click', quitarAviso);

    document.body.appendChild(strip);
  }

  function vigilar(registro) {
    if (!registro || !('serviceWorker' in navigator)) return;
    var avisado = false;
    /* La primera activación de un SW (primera visita) no es una
       actualización: solo cuentan los cambios con la sesión ya
       controlada por una versión anterior. */
    var yaControlaba = Boolean(navigator.serviceWorker.controller);

    function avisar() {
      if (avisado) return;
      avisado = true;
      mostrarAviso();
    }

    /* Una versión nueva ya estaba esperando cuando cargó la página
       (p. ej. descargó mientras el docente leía una nota). */
    if (registro.waiting && navigator.serviceWorker.controller) avisar();

    registro.addEventListener('updatefound', function () {
      var nuevo = registro.installing;
      if (!nuevo) return;
      nuevo.addEventListener('statechange', function () {
        if ((nuevo.state === 'installed' || nuevo.state === 'activated') &&
          navigator.serviceWorker.controller) {
          avisar();
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!yaControlaba) { yaControlaba = true; return; }
      avisar();
    });
  }

  function init() {
    if (!('serviceWorker' in navigator)) return;
    prepararInstalacion();
    navigator.serviceWorker.getRegistration().then(function (registro) {
      if (registro) vigilar(registro);
    }).catch(function () { /* sin registro: nada que vigilar */ });
  }

  return {
    instalar: instalar,
    vigilar: vigilar,
    /* init se llama al DOMContentLoaded propia de este módulo. */
    init: init
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.PWA.init);
} else {
  window.PWA.init();
}
