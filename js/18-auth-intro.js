/* ═══════════════════════════════════════════════════════════════
   18-auth-intro.js — Intro épica INATEC al iniciar sesión (v3)
   Secuencia cinemática: regla fina → logo con barrido escáner →
   banda tricolor → tipografía cinética enmascarada → subtitulo con
   borrado lateral → progreso con cifras tabulares → log de
   arranque → salida tipo obturador con línea de luz.
   Se omite con ESC o clic. Duración total ≈ 4.2s.
   ═══════════════════════════════════════════════════════════════ */
window.AuthIntro = (function () {
  'use strict';

  var overlay = null;
  var promesa = null;
  var resolver = null;
  var timers = [];
  var rafId = null;
  var cierreTimer = null;
  var escuchasActivas = false;

  var RETRASO_PROGRESO = 1600;
  var DURACION = 4200;
  var SEGURIDAD = 9000;

  var reducido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }

  function preparar() {
    var titulo = $('ai-title');
    if (titulo) {
      titulo.textContent = '';
      'INATEC'.split('').forEach(function (ch, i) {
        var span = document.createElement('span');
        span.className = 'ai-letter';
        span.style.setProperty('--i', i);
        span.textContent = ch;
        titulo.appendChild(span);
      });
    }

    var relleno = $('ai-progress-fill');
    if (relleno) relleno.style.width = '0%';
    var pct = $('ai-pct');
    if (pct) pct.textContent = '00';
    var estado = $('ai-status-text');
    if (estado) estado.textContent = 'VERIFICANDO ACCESO';
  }

  function correrProgreso() {
    var inicio = performance.now();
    var relleno = $('ai-progress-fill');
    var pctEl = $('ai-pct');
    var estado = $('ai-status-text');

    function paso(t) {
      var e = Math.min(1, (t - inicio) / (DURACION - RETRASO_PROGRESO - 200));
      var p = Math.round(e * 100);
      if (relleno) relleno.style.width = p + '%';
      if (pctEl) pctEl.textContent = String(p).padStart(2, '0');
      if (estado) {
        estado.textContent = p < 25 ? 'VERIFICANDO ACCESO'
          : p < 55 ? 'CARGANDO DATOS'
          : p < 85 ? 'PREPARANDO PANEL'
          : p < 100 ? 'FINALIZANDO'
          : 'BIENVENIDO';
      }
      if (e < 1) rafId = requestAnimationFrame(paso);
    }
    rafId = requestAnimationFrame(paso);
  }

  function limpiar() {
    timers.forEach(clearTimeout);
    timers = [];
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (cierreTimer) { clearTimeout(cierreTimer); cierreTimer = null; }
    if (escuchasActivas) {
      document.removeEventListener('keydown', alTecla);
      overlay && overlay.removeEventListener('click', alClic);
      escuchasActivas = false;
    }
  }

  function terminar() {
    if (!overlay || overlay.hidden) { finalizarPromesa(); return; }
    if (overlay.classList.contains('is-exit')) return;
    limpiar();
    overlay.classList.add('is-exit');
    cierreTimer = setTimeout(function () {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('is-playing', 'is-exit');
      cierreTimer = null;
      finalizarPromesa();
    }, 820);
  }

  function finalizarPromesa() {
    if (resolver) {
      var r = resolver;
      resolver = null;
      promesa = null;
      r();
    }
  }

  function alTecla(event) {
    if (event.key === 'Escape') terminar();
  }

  function alClic() { terminar(); }

  function play() {
    overlay = $('auth-intro');
    if (!overlay) return Promise.resolve();
    if (promesa) return promesa;

    preparar();
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.remove('is-exit');
    void overlay.offsetWidth;
    overlay.classList.add('is-playing');

    promesa = new Promise(function (ok) { resolver = ok; });

    document.addEventListener('keydown', alTecla);
    overlay.addEventListener('click', alClic);
    escuchasActivas = true;

    if (reducido) {
      timers.push(setTimeout(terminar, 1000));
      return promesa;
    }

    timers.push(setTimeout(correrProgreso, RETRASO_PROGRESO));
    timers.push(setTimeout(terminar, DURACION));
    timers.push(setTimeout(terminar, SEGURIDAD)); // por si algo falla

    return promesa;
  }

  return {
    play: play,
    finish: terminar
  };
})();
