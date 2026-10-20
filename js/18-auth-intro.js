'use strict';
/* ═══════════════════════════════════════════════════════════════
   18-auth-intro.js — CINEMÁTICA ACUÁTICA (v6)
   ───────────────────────────────────────────────────────────────
   Una película corta antes de abrir el panel. Todo el movimiento
   lo dirige Anime.js (js/vendor/anime.min.js, local para que la
   PWA funcione sin internet).

   LOS CINCO CAPÍTULOS
     1 · EL DESCENSO   — la cámara baja desde la superficie; los
                         rayos de luz barren el agua y las burbujas
                         suben desde el fondo.
     2 · EL ENJAMBRE   — los once iconos del saber nadan desde los
                         bordes y se reacomodan en espiral.
     3 · EL REMOLINO   — las partículas se一枚一枚 caen al centro y
                         el anillo de choque se abre alrededor del
                         logo, que emerge de la penumbra.
     4 · LA SUPERFICIE — el título sube letra a letra con el barrido
                         de brillo, el subtítulo y el registro.
     5 · LA COMPUERTA  — la escena se abre como una columna de agua
                         y el panel aparece debajo.

   Reglas de la casa:
     · ESC o un clic la salta en cualquier momento.
     · Si el docente dejó «Animaciones» en off, o el sistema pide
       menos movimiento, se muestra una versión estática y corta.
     · Si no hay Anime.js, la versión antigua en CSS sigue funcionando.
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
  var escena = null;

  var DURACION = 8600;          // duración total de la cinemática
  var RETRASO_PROGRESO = 3600;  // cuándo arranca la barra de progreso
  var SEGURIDAD = 13000;        // red de seguridad

  var ICONOS = [
    'ri-book-open-line', 'ri-bar-chart-box-line', 'ri-flask-line',
    'ri-calculator-line', 'ri-global-line', 'ri-laptop-line',
    'ri-graduation-cap-line', 'ri-lightbulb-flash-line',
    'ri-pencil-line', 'ri-compass-3-line', 'ri-microscope-line'
  ];

  var reducido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }
  function anime() { return (typeof window.anime === 'function') ? window.anime : null; }

  /* ══ ESCENA ═══════════════════════════════════════════════════
     Se construye con DOM (no con HTML) para no ensuciar el marcado
     y para poder calcular posiciones al vuelo. */
  function construirEscena() {
    var raiz = overlay;
    if (!raiz || raiz.querySelector('.ai-cine')) return;

    var capa = document.createElement('div');
    capa.className = 'ai-cine';
    capa.setAttribute('aria-hidden', 'true');

    /* 1 · Superficie y rayos de luz */
    var rayos = '';
    for (var r = 0; r < 6; r++) {
      rayos += '<span class="ai-ray" style="left:' + (6 + r * 16) + '%;transform:rotate(' +
        (-16 + r * 6.5) + 'deg);"></span>';
    }
    capa.innerHTML = '<span class="ai-surface"></span>' + rayos;

    /* 2 · Burbujas que suben desde el fondo */
    var a = anime();
    var burbujas = '';
    for (var b = 0; b < 22; b++) {
      var tam = 4 + Math.round(Math.random() * 16);
      burbujas += '<span class="ai-bubble" style="left:' + (Math.random() * 100).toFixed(1) +
        '%;width:' + tam + 'px;height:' + tam + 'px;opacity:0"></span>';
    }
    capa.innerHTML += burbujas;

    /* 3 · Partículas del remolino (caen al centro en espiral) */
    var particulas = '';
    for (var p = 0; p < 34; p++) {
      var ang = p * 0.618033 * Math.PI * 2;         // ángulo áureo
      var rad = 8 + (p / 34) * 34;                  // radio en vmin
      var px = (Math.cos(ang) * rad).toFixed(2);
      var py = (Math.sin(ang) * rad).toFixed(2);
      particulas += '<span class="ai-particle" data-x="' + px + 'vmin" data-y="' + py + 'vmin" style="width:' +
        (2 + (p % 4)) + 'px;height:' + (2 + (p % 4)) + 'px"></span>';
    }
    capa.innerHTML += '<span class="ai-vortex">' + particulas + '</span>';

    /* 4 · Anillos de choque */
    capa.innerHTML += '<span class="ai-wave"></span><span class="ai-wave"></span><span class="ai-wave"></span>';

    /* 5 · Los once iconos del saber, nadando hacia el centro */
    var icos = '';
    for (var i = 0; i < ICONOS.length; i++) {
      var angulo = (i * 2.399963 + 0.7);            // espiral áurea
      var radio = 24 + (i % 4) * 9;
      var dx = Math.cos(angulo) * radio * 1.25;
      var dy = Math.sin(angulo) * radio * 0.95;
      icos += '<i class="ai-cine-ico ' + ICONOS[i] + '" style="left:' +
        (50 + Math.cos(angulo) * 15).toFixed(2) + '%;top:' +
        (50 + Math.sin(angulo) * 15).toFixed(2) + '%;opacity:0" ' +
        'data-dx="' + dx.toFixed(2) + 'vmin" data-dy="' + dy.toFixed(2) + 'vmin"></i>';
    }
    capa.innerHTML += icos;

    raiz.insertBefore(capa, raiz.firstChild);
    escena = capa;
  }

  /* ══ PREPARAR ══════════════════════════════════════════════════ */
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
    if (estado) estado.textContent = 'DESCENDIENDO AL CAMPUS';

    /* El logo aparece desde la penumbra: arranca invisible y lo
       enciende la línea de tiempo (capítulo 3). */
    var logo = document.querySelector('.ai-logo');
    if (logo) logo.style.opacity = '0';
    var anillo = document.querySelector('.ai-logo-ring');
    if (anillo) anillo.style.opacity = '0';
    var borde = document.querySelector('.ai-logo-edge');
    if (borde) borde.style.opacity = '0';

    construirEscena();
  }

  /* ══ BARRA DE PROGRESO (con texto que cuenta la historia) ═════ */
  var FASES = [
    { hasta: 0.18, texto: 'DESCENDIENDO AL CAMPUS' },
    { hasta: 0.38, texto: 'CONECTANDO EL SABER' },
    { hasta: 0.58, texto: 'REMOLINO DE CONOCIMIENTO' },
    { hasta: 0.80, texto: 'ABRIENDO EL CUADERNO' },
    { hasta: 1.01, texto: 'BIENVENIDO' }
  ];

  function correrProgreso() {
    var relleno = $('ai-progress-fill');
    var pctEl = $('ai-pct');
    var estado = $('ai-status-text');
    var inicio = Date.now();
    var total = DURACION - RETRASO_PROGRESO - 300;

    function paso() {
      var t = Date.now() - inicio;
      var e = Math.min(1, t / total);
      var p = Math.round(e * 100);
      if (relleno) relleno.style.width = p + '%';
      if (pctEl) pctEl.textContent = String(p).padStart(2, '0');
      if (estado) {
        var texto = FASES[FASES.length - 1].texto;
        for (var i = 0; i < FASES.length; i++) {
          if (e < FASES[i].hasta) { texto = FASES[i].texto; break; }
        }
        estado.textContent = texto;
      }
      if (e < 1) rafId = requestAnimationFrame(paso);
    }
    rafId = requestAnimationFrame(paso);
  }

  /* ══ LÍNEA DE TIEMPO (la cinemática) ══════════════════════════ */
  function lineaTiempo() {
    var a = anime();
    if (!a) return null;

    var icos = escena ? escena.querySelectorAll('.ai-cine-ico') : [];
    var particulas = escena ? escena.querySelectorAll('.ai-particle') : [];
    var burbujas = escena ? escena.querySelectorAll('.ai-bubble') : [];
    var rayos = escena ? escena.querySelectorAll('.ai-ray') : [];
    var ondas = escena ? escena.querySelectorAll('.ai-wave') : [];
    var vortice = escena ? escena.querySelector('.ai-vortex') : null;

    var tl = a.timeline({ easing: 'easeOutExpo' });

    /* CAPÍTULO 1 · El descenso ---------------------------------- */
    tl.add({
      targets: '.ai-cine',
      translateY: ['-7vh', '0vh'],
      scale: [1.14, 1],
      duration: 1900,
      easing: 'easeInOutQuad'
    }, 0);

    tl.add({
      targets: rayos,
      opacity: [0, 0.5],
      scaleY: [0.5, 1],
      duration: 1500,
      delay: a.stagger(130),
      easing: 'easeOutSine'
    }, 120);

    /* Rayos que se mecen como el agua (ambiente, infinito) */
    tl.add({
      targets: rayos,
      translateX: [0, 26],
      opacity: [0.5, 0.22],
      duration: 3400,
      delay: a.stagger(130),
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    }, 1620);

    /* Burbujas que suben sin parar (ambiente, infinito) */
    tl.add({
      targets: burbujas,
      translateY: ['112vh', '-26vh'],
      translateX: function (el) { return a.random(-46, 46); },
      opacity: [
        { value: 0.75, duration: 500 },
        { value: 0, duration: 700 }
      ],
      duration: function () { return a.random(5200, 9200); },
      delay: a.stagger(160),
      loop: true,
      easing: 'linear'
    }, 200);

    /* CAPÍTULO 2 · El enjambre ---------------------------------- */
    tl.add({
      targets: icos,
      translateX: function (el) { return [el.dataset.dx, '0vmin']; },
      translateY: function (el) { return [el.dataset.dy, '0vmin']; },
      scale: [0, 1],
      opacity: [0, 0.95],
      rotate: function () { return [anime().random(-35, 35), 0]; },
      duration: 1700,
      delay: a.stagger(95),
      easing: 'easeOutElastic(1, .68)'
    }, 1250);

    /* El remolino gira lento mientras el enjambre se reacomoda */
    if (vortice) {
      tl.add({
        targets: vortice,
        rotate: 360,
        duration: 24000,
        loop: true,
        easing: 'linear'
      }, 1200);
    }

    /* CAPÍTULO 3 · El remolino ---------------------------------- */
    tl.add({
      targets: icos,
      translateX: function (el) { return (parseFloat(el.dataset.dx) * 0.45) + 'vmin'; },
      translateY: function (el) { return (parseFloat(el.dataset.dy) * 0.45) + 'vmin'; },
      duration: 1500,
      delay: a.stagger(35),
      easing: 'easeInOutQuad'
    }, 3050);

    tl.add({
      targets: particulas,
      translateX: function (el) { return [el.dataset.x, '0vmin']; },
      translateY: function (el) { return [el.dataset.y, '0vmin']; },
      scale: [1, 0.12],
      opacity: [0.85, 0],
      duration: 1900,
      delay: a.stagger(11),
      easing: 'easeInExpo'
    }, 2750);

    /* Anillos de choque (bucle) */
    tl.add({
      targets: ondas,
      scale: [0.18, 2.7],
      opacity: [0.75, 0],
      duration: 1900,
      delay: a.stagger(520),
      loop: true,
      easing: 'easeOutQuad'
    }, 3150);

    /* El logo emerge de la penumbra */
    tl.add({
      targets: '.ai-logo',
      scale: [0.5, 1],
      opacity: [0, 1],
      filter: ['blur(26px)', 'blur(0px)'],
      duration: 1600,
      easing: 'easeOutExpo'
    }, 3400);

    tl.add({
      targets: '.ai-logo-edge',
      opacity: [0, 0.9],
      duration: 1400,
      easing: 'easeOutQuad'
    }, 3600);

    tl.add({
      targets: '.ai-logo-ring',
      rotate: 320,
      scale: [0.6, 1],
      opacity: [0, 0.9],
      duration: 2200,
      easing: 'easeOutExpo'
    }, 3400);

    /* Los iconos son absorbidos por el logo */
    tl.add({
      targets: icos,
      translateX: 0,
      translateY: 0,
      scale: 0.1,
      opacity: 0,
      filter: ['blur(0px)', 'blur(9px)'],
      duration: 1500,
      delay: a.stagger(28),
      easing: 'easeInExpo'
    }, 4100);

    /* CAPÍTULO 4 · La superficie -------------------------------- */
    tl.add({
      targets: '.ai-letter',
      translateY: ['118%', '0%'],
      opacity: [0, 1],
      filter: ['blur(10px)', 'blur(0px)'],
      duration: 900,
      delay: a.stagger(46)
    }, 4300);

    tl.add({
      targets: '.ai-sub',
      translateY: [16, 0],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutQuart'
    }, 5150);

    tl.add({
      targets: '.ai-log li',
      translateX: [-32, 0],
      opacity: [0, 1],
      duration: 560,
      delay: a.stagger(150),
      easing: 'easeOutExpo'
    }, 5350);

    /* CAPÍTULO 5 · La compuerta --------------------------------- */
    tl.add({
      targets: '.ai-core',
      translateY: [0, '-14vh'],
      scale: [1, 1.07],
      opacity: [1, 0],
      filter: ['blur(0px)', 'blur(15px)'],
      duration: 1100,
      easing: 'easeInQuad'
    }, 7050);

    tl.add({
      targets: '.ai-cine',
      opacity: [1, 0],
      duration: 900,
      easing: 'easeInQuad'
    }, 7250);

    return tl;
  }

  /* ══ CICLO DE VIDA ════════════════════════════════════════════ */
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

  function finalizarPromesa() {
    if (resolver) {
      var r = resolver;
      resolver = null;
      promesa = null;
      r();
    }
  }

  function terminar() {
    if (!overlay || overlay.hidden) { finalizarPromesa(); return; }
    if (overlay.classList.contains('is-exit')) return;
    limpiar();

    var a = anime();
    if (a && !reducido) {
      /* Salida: el agua se dispersa y el panel aparece debajo. */
      a({
        targets: overlay.querySelector('.ai-core'),
        translateY: 0,
        scale: 1.1,
        opacity: 0,
        filter: 'blur(16px)',
        duration: 620,
        easing: 'easeInQuad'
      });
      a({
        targets: overlay.querySelector('.ai-cine'),
        opacity: 0,
        scale: 1.15,
        duration: 620,
        easing: 'easeInQuad'
      });
    }

    overlay.classList.add('is-exit');
    cierreTimer = setTimeout(function () {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('is-playing', 'is-exit', 'ai-anime');
      if (escena) { escena.remove(); escena = null; }
      cierreTimer = null;
      finalizarPromesa();
    }, 820);
  }

  function alTecla(event) { if (event.key === 'Escape') terminar(); }
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

    promesa = new Promise(function (ok) { resolver = ok; });

    document.addEventListener('keydown', alTecla);
    overlay.addEventListener('click', alClic);
    escuchasActivas = true;

    var a = anime();
    if (reducido || !a) {
      /* Versión estática (o sin Anime.js): la de CSS de siempre. */
      overlay.classList.add('is-playing');
      timers.push(setTimeout(terminar, reducido ? 1400 : DURACION));
      return promesa;
    }

    overlay.classList.add('is-playing', 'ai-anime');
    lineaTiempo();
    timers.push(setTimeout(correrProgreso, RETRASO_PROGRESO));
    timers.push(setTimeout(terminar, DURACION));
    timers.push(setTimeout(terminar, SEGURIDAD));

    return promesa;
  }

  return {
    play: play,
    finish: terminar
  };
})();
