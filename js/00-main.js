'use strict';
/* ═══════════════════════════════════════════════════════════════
   MAIN — Punto de entrada de la aplicación.
   Se carga al final, después de todos los módulos, para garantizar
   que DataEngine, UI, CuadernoEngine, MessageEngine, StatsEngine
   y ExamenesEngine ya existen en memoria.
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await AuthManager.init();
  } catch (error) {
    console.error('No se pudo preparar el acceso al panel docente:', error);
    AuthManager.showLogin(`No se pudo iniciar el panel: ${AuthManager.describeError(error)}`);
  }
});