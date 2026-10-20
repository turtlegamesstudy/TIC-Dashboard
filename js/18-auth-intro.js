/* ═══════════════════════════════════════════════════════════════
   18-auth-intro.js — Intro «El Agujero Negro del Conocimiento» (v5)
   Fase 1 · Íconos del saber flotan alrededor del centro (deriva ligera).
   Fase 2 · El logo INATEC se comporta como un agujero negro: disco de
            acreción girando, y cada ícono cae en espiral hacia el
            horizonte, encogiéndose y desdibujándose mientras el logo
            «absorbe» su luz (latido + onda de choque).
   Fase 3 · Título, subtítulo, progreso y log de arranque (etapa previa,
            retemporizada para que arranque tras la absorción).
   Se omite con ESC o clic. Duración total ≈ 5.6s.
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
  var lineaTexto = null;

  var RETRASO_PROGRESO = 3200;
  var DURACION = 5600;
  var SEGURIDAD = 11000;

  var ICONOS = [
    'ri-book-open-line', 'ri-bar-chart-box-line', 'ri-flask-line',
    'ri-calculator-line', 'ri-global-line', 'ri-laptop-line',
    'ri-graduation-cap-line', 'ri-lightbulb-flash-line',
    'ri-pencil-line', 'ri-compass-3-line', 'ri-microscope-line'
  ];

  var reducido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }

  function preparar() {
    var titulo = $('ai-title');
    if (titulo) {
      titulo.textContent = '';
      'TIC Dashboard'.split('').forEach(function (ch, i) {
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
    if (estado) estado.textContent = 'CANALIZANDO CONOCIMIENTO';

    montarAgujero();
    prepararLineaAnime();
  }

  /* ── Fase textual con Anime.js ───────────────────────────────
     El agujero negro sigue siendo arte en CSS; lo que entra con
     Anime.js es la aparición del título, el subtítulo y el registro
     de arranque: escalonados, con giro en X y con rebote. */
  function prepararLineaAnime() {
    if (typeof window.anime !== 'function' || reducido) return;
    if (!overlay) overlay = $('auth-intro');
    if (!overlay) return;
    var a = window.anime;
    var letras = overlay.querySelectorAll('.ai-letter');
    if (!letras.length) return;

    overlay.classList.add('ai-anime');
    var sub = overlay.querySelector('.ai-sub');
    var registro = overlay.querySelectorAll('.ai-log li');

    var linea = a.timeline({ autoplay: false, easing: 'cubicBezier(.16, 1, .3, 1)' });
    linea
      .add({
        targets: letras,
        translateY: ['118%', '0%'],
        opacity: [0, 1],
        filter: ['blur(10px)', 'blur(0px)'],
        duration: 900,
        delay: a.stagger(46)
      })
      .add({ targets: sub, translateY: [16, 0], opacity: [0, 1], duration: 560, easing: 'easeOutQuart' }, '-=520')
      .add({
        targets: registro,
        translateX: [-32, 0],
        opacity: [0, 1],
        duration: 560,
        delay: a.stagger(150),
        easing: 'easeOutExpo'
      }, '-=360');

    lineaTexto = linea;
    setTimeout(function () { if (lineaTexto) lineaTexto.play(); }, 3000);
  }

  /* Construye una sola vez la escena del agujero negro: discos de
     acreción + horizonte + logo + 11 íconos del saber en órbitas
     aleatorias (ángulo/radio/desfase distintos en cada reproducción). */
  function montarAgujero() {
    var core = document.querySelector('.ai-core');
    if (!core || core.querySelector('.ai-ag-wrap')) return;

    var wrap = document.createElement('span');
    wrap.className = 'ai-ag-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<span class="ai-ag-tilt ai-ag-tilt1"><span class="ai-ag-disco ai-ag-d1"></span></span>' +
      '<span class="ai-ag-tilt ai-ag-tilt2"><span class="ai-ag-disco ai-ag-d2"></span></span>' +
      '<span class="ai-ag-tilt ai-ag-tilt3"><span class="ai-ag-disco ai-ag-d3"></span></span>' +
      '<span class="ai-ag-horizonte"></span>' +
      '<img class="ai-ag-logo" src="assets/logo-inatec-blanco.png" alt="">' +
      '<span class="ai-ag-onda"></span>';
    core.insertBefore(wrap, core.firstChild);

    var capa = document.createElement('div');
    capa.className = 'ai-icos';
    capa.setAttribute('aria-hidden', 'true');
    ICONOS.forEach(function (clase, i) {
      var ico = document.createElement('i');
      ico.className = 'ai-ico ' + clase;
      var angulo = (i * 2.399963 + 0.7) % (Math.PI * 2);   // espiral áurea
      var radio = 30 + (i % 4) * 13 + Math.random() * 9;  // vmin
      var sx = Math.cos(angulo) * radio;
      var sy = Math.sin(angulo) * radio * 0.72;           // elipse
      ico.style.setProperty('--sx', sx.toFixed(1) + 'vmin');
      ico.style.setProperty('--sy', sy.toFixed(1) + 'vmin');
      ico.style.setProperty('--d', (Math.random() * 0.55).toFixed(2) + 's');
      ico.style.fontSize = (1.15 + Math.random() * 0.75).toFixed(2) + 'rem';
      capa.appendChild(ico);
    });
    overlay.appendChild(capa);
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
        estado.textContent = p < 35 ? 'CONOCIENDO TU CAMPUS'
          : p < 65 ? 'SINCRONIZANDO NOTAS'
          : p < 85 ? 'PREPARANDO EL PANEL'
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
    // Salida: el núcleo se aleja y se difumina (Anime.js) mientras el
    // velo del CSS termina de cerrar.
    if (typeof window.anime === 'function' && !reducido) {
      var nucleo = overlay.querySelector('.ai-core');
      if (nucleo) {
        window.anime({
          targets: nucleo,
          scale: 1.09,
          opacity: 0,
          filter: 'blur(10px)',
          duration: 700,
          easing: 'easeInQuad'
        });
      }
    }
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
