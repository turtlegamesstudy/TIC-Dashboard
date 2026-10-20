'use strict';
/* ═══════════════════════════════════════════════════════════════
   MAIN — Punto de entrada de la aplicación.
   Se carga al final, después de todos los módulos, para garantizar
   que DataEngine, UI, CuadernoEngine, MessageEngine, StatsEngine
   y ExamenesEngine ya existen en memoria.
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    /* PWA: el panel reabre incluso sin internet (cáscara en caché).
       No aplica en file:// (no hay service worker ahí). */
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      try {
        const registro = await navigator.serviceWorker.register('sw.js');
        /* El aviso de versión nueva es VISIBLE ahora (franja con botón
           «Recargar»): la UX la lleva js/31-pwa.js. */
        if (window.PWA) window.PWA.vigilar(registro);
        // Chequeo silencioso para no quedarnos pegados a una versión vieja.
        registro.update().catch(() => { });
      } catch (error) {
        console.warn('Sin modo offline (Service Worker no disponible):', error.message);
      }
    }
    await AuthManager.init();
  } catch (error) {
    console.error('No se pudo preparar el acceso al panel docente:', error);
    AuthManager.showLogin(`No se pudo iniciar el panel: ${AuthManager.describeError(error)}`);
  }
});