'use strict';
/* ═══════════════════════════════════════════════════════════════
   18-auth-intro.js — CINEMÁTICA ACUÁTICA (v7)
   ───────────────────────────────────────────────────────────────
   Una película de 8 segundos antes de abrir el panel. Todo el
   movimiento lo dirige Anime.js (js/vendor/anime.min.js, local
   para que la PWA funcione sin internet).

   LA PELÍCULA
     · EL MAR        — tres olas se DIBUJAN solas (strokeDashoffset)
                       y luego nadan sin parar.
     · EL DESCENSO   — los rayos de luz barren el agua; la cámara
                       baja hacia el fondo.
     · LA TORTUGA    — entra nadando por una TRAYECTORIA REAL
                       (anime.path sobre un SVG),比亚 las aletas y
                       deja un reguero de burbujas.
     · EL REMOLINO   — se hunde en el centro, las partículas caen
                       y los once iconos del saber son absorbidos.
     · LA MARCA      — el logo INATEC emerge con anillos de choque.
     · LA TITULACIÓN — el título entra en 3D (rotateX con
                       perspectiva) y el estado se descifra letra a
                       letra.
     · LA COMPUERTA  — el agua se cierra y el panel aparece.

   Se salta con ESC o un clic. Si el docente dejó «Animaciones» en
   off, o el sistema pide menos movimiento, se ve una versión estática
   y corta. Si no hay Anime.js, sigue valiendo la versión en CSS.
   ═══════════════════════════════════════════════════════════════ */

window.AuthIntro = (function () {
  'use strict';

  var overlay = null, promesa = null, resolver = null;
  var timers = [], rafId = null, cierreTimer = null, escuchasActivas = false;
  var escena = null, rutaNodo = null, rutaSvg = null;

  var DURACION = 8400;
  var RETRASO_PROGRESO = 4200;
  var SEGURIDAD = 13000;

  var ICONOS = [
    'ri-book-open-line', 'ri-bar-chart-box-line', 'ri-flask-line',
    'ri-calculator-line', 'ri-global-line', 'ri-laptop-line',
    'ri-graduation-cap-line', 'ri-lightbulb-flash-line',
    'ri-pencil-line', 'ri-compass-3-line', 'ri-microscope-line'
  ];

  var reducido = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(id) { return document.getElementById(id); }
  function anime() { return (typeof window.anime === 'function') ? window.anime : null; }

  /* ══ EL MAR: tres olas que se dibujan y luego nadan ══════════ */
  function olasSVG() {
    return '<svg class="ai-mar" viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="ai-ola" d="M-250 150 Q-125 78 0 150 T250 150 T500 150 T750 150 T1000 150 T1250 150"></path>' +
      '<path class="ai-ola ai-ola-2" d="M-250 120 Q-125 168 0 120 T250 120 T500 120 T750 120 T1000 120 T1250 120"></path>' +
      '<path class="ai-ola ai-ola-3" d="M-250 90 Q-125 40 0 90 T250 90 T500 90 T750 90 T1000 90 T1250 90"></path>' +
      '</svg>';
  }

  /* ══ LA TORTUGA (SVG con aletas animables) ═══════════════════ */
  function tortugaSVG() {
    return '<div class="ai-tortuga-wrap">' +
    '<svg class="ai-tortuga" viewBox="0 0 240 150" aria-hidden="true">' +
      '<g class="ai-aleta ai-aleta-izq">' +
        '<path d="M74 58 Q28 28 2 46 Q30 80 78 72 Z" fill="rgba(12,62,76,.88)" stroke="rgba(150,235,255,.55)" stroke-width="2"/></g>' +
      '<g class="ai-aleta ai-aleta-der">' +
        '<path d="M166 58 Q212 28 238 46 Q210 80 162 72 Z" fill="rgba(12,62,76,.88)" stroke="rgba(150,235,255,.55)" stroke-width="2"/></g>' +
      '<g class="ai-aleta ai-aleta-tras-izq">' +
        '<path d="M72 96 Q36 118 44 142 Q74 132 94 108 Z" fill="rgba(12,62,76,.8)" stroke="rgba(150,235,255,.45)" stroke-width="2"/></g>' +
      '<g class="ai-aleta ai-aleta-tras-der">' +
        '<path d="M168 96 Q204 118 196 142 Q166 132 146 108 Z" fill="rgba(12,62,76,.8)" stroke="rgba(150,235,255,.45)" stroke-width="2"/></g>' +
      '<g class="ai-casco">' +
        '<ellipse cx="120" cy="75" rx="74" ry="50" fill="rgba(10,54,68,.9)" stroke="rgba(150,235,255,.75)" stroke-width="2.5"/>' +
        '<path d="M120 25 L120 125" stroke="rgba(150,235,255,.34)" stroke-width="2" fill="none"/>' +
        '<path d="M60 44 Q120 75 60 106" stroke="rgba(150,235,255,.26)" stroke-width="2" fill="none"/>' +
        '<path d="M180 44 Q120 75 180 106" stroke="rgba(150,235,255,.26)" stroke-width="2" fill="none"/>' +
        '<path d="M90 29 Q120 75 90 121" stroke="rgba(150,235,255,.2)" stroke-width="2" fill="none"/>' +
        '<path d="M150 29 Q120 75 150 121" stroke="rgba(150,235,255,.2)" stroke-width="2" fill="none"/>' +
        '<ellipse cx="120" cy="75" rx="30" ry="20" fill="none" stroke="rgba(150,235,255,.22)" stroke-width="2"/>' +
      '</g>' +
      '<g class="ai-cabeza">' +
        '<ellipse cx="205" cy="75" rx="25" ry="20" fill="rgba(12,66,80,.92)" stroke="rgba(150,235,255,.6)" stroke-width="2"/>' +
        '<circle cx="213" cy="67" r="3.6" fill="rgba(225,248,255,.95)"/>' +
        '<circle cx="213" cy="67" r="1.6" fill="rgba(10,40,55,.9)"/>' +
      '</g>' +
      '</svg></div>';
  }

  /* ══ NADAR POR UNA TRAYECTORIA REAL ══════════════════════════
     anime.path() de la v3 solo anima trazos SVG: para mover un
     elemento DOM por una curva hay que leer el trazo a mano. Se
     hace aquí con getPointAtLength + requestAnimationFrame, y el
     envoltorio (no el SVG) es el que se mueve: así Anime.js sigue
     libre para animar la escala y el desvanecido sin pelearse
     con la trayectoria. */
  function nadarPorRuta(el, ruta, duracion, retraso, bucle, alTerminar, suave) {
    if (!el || !ruta) return;
    var total = ruta.getTotalLength();
    if (!total) return;
    var inicio = null;
    function paso(ts) {
      if (inicio === null) inicio = ts;
      var p = Math.min(1, (ts - inicio) / duracion);
      var q = suave ? (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2) : p;
      var punto = ruta.getPointAtLength(q * total);
      var sig = ruta.getPointAtLength(Math.min(total, q * total + 7));
      var ant = ruta.getPointAtLength(Math.max(0, q * total - 7));
      var angulo = 180 * Math.atan2(sig.y - ant.y, sig.x - ant.x) / Math.PI;
      el.style.transform = 'translate(' + punto.x.toFixed(1) + 'px,' + punto.y.toFixed(1) + 'px) rotate(' +
        (angulo - 90).toFixed(1) + 'deg)';
      if (p < 1) requestAnimationFrame(paso);
      else if (bucle) { inicio = null; requestAnimationFrame(paso); }
      else if (alTerminar) alTerminar();
    }
    setTimeout(function () { requestAnimationFrame(paso); }, retraso || 0);
  }

  /* ══ TRAZOS DE BURBUJAS Y RUTA DE LA TORTUGA ═════════════════ */
  function rutasSVG() {
    return '<svg class="ai-rutas" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">' +
      '<path id="ruta-tortuga" d="M-260 640 C 80 200 260 700 520 380 S 820 120 1240 520" fill="none"></path>' +
      '<path id="ruta-burbuja" d="M60 820 C 20 640 120 560 80 380 S 40 120 140 -60" fill="none"></path>' +
      '<path id="ruta-burbuja2" d="M420 860 C 470 660 380 560 430 360 S 490 120 420 -80" fill="none"></path>' +
      '<path id="ruta-burbuja3" d="M780 840 C 730 640 840 540 790 340 S 760 100 850 -70" fill="none"></path>' +
      '</svg>';
  }

  /* ══ ESCENA ════════════════════════════════════════════════════ */
  function construirEscena() {
    if (!overlay || overlay.querySelector('.ai-cine')) return;
    var a = anime();
    var capa = document.createElement('div');
    capa.className = 'ai-cine';
    capa.setAttribute('aria-hidden', 'true');

    /* Superficie y rayos */
    var rayos = '';
    for (var r = 0; r < 6; r++) {
      rayos += '<span class="ai-ray" style="left:' + (5 + r * 16) + '%;transform:rotate(' + (-16 + r * 6.5) + 'deg);"></span>';
    }
    capa.innerHTML = '<span class="ai-surface"></span>' + rayos + olasSVG() + rutasSVG();

    /* Burbujas que suben por trayectorias reales */
    var burbujas = '';
    for (var b = 0; b < 16; b++) {
      var tam = 4 + Math.round(Math.random() * 14);
      burbujas += '<span class="ai-bubble" style="width:' + tam + 'px;height:' + tam + 'px"></span>';
    }
    capa.innerHTML += burbujas;

    /* Remolino de partículas */
    var particulas = '';
    for (var p = 0; p < 30; p++) {
      var ang = p * 0.618033 * Math.PI * 2;
      var rad = 8 + (p / 30) * 32;
      particulas += '<span class="ai-particle" data-x="' + (Math.cos(ang) * rad).toFixed(2) +
        'vmin" data-y="' + (Math.sin(ang) * rad).toFixed(2) + 'vmin" style="width:' + (2 + (p % 4)) +
        'px;height:' + (2 + (p % 4)) + 'px"></span>';
    }
    capa.innerHTML += '<span class="ai-vortex">' + particulas + '</span>';

    /* Anillos de choque (sonar) */
    capa.innerHTML += '<span class="ai-wave"></span><span class="ai-wave"></span><span class="ai-wave"></span>';

    /* La tortuga */
    capa.innerHTML += tortugaSVG();

    /* Los once iconos del saber */
    var icos = '';
    for (var i = 0; i < ICONOS.length; i++) {
      var angulo = (i * 2.399963 + 0.7);
      var radio = 22 + (i % 4) * 9;
      var dx = Math.cos(angulo) * radio * 1.3;
      var dy = Math.sin(angulo) * radio * 1.0;
      icos += '<i class="ai-cine-ico ' + ICONOS[i] + '" style="left:' +
        (50 + Math.cos(angulo) * 16).toFixed(2) + '%;top:' +
        (50 + Math.sin(angulo) * 16).toFixed(2) + '%;opacity:0" data-dx="' + dx.toFixed(2) +
        'vmin" data-dy="' + dy.toFixed(2) + 'vmin"></i>';
    }
    capa.innerHTML += icos;

    overlay.insertBefore(capa, overlay.firstChild);
    escena = capa;
    rutaNodo = document.getElementById('ruta-tortuga');
    rutaSvg = capa.querySelector('.ai-rutas');
    dimensionarRutas();
  }

  /* Las rutas SVG se miden en píxeles reales: si no, la tortuga
     nadaría en coordenadas equivocadas según la pantalla. */
  function dimensionarRutas() {
    if (!rutaSvg || !rutaNodo) return;
    var w = Math.max(320, window.innerWidth);
    var h = Math.max(400, window.innerHeight);
    rutaSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    rutaNodo.setAttribute('d',
      'M -260 ' + (h * 0.80) +
      ' C ' + (w * 0.08) + ' ' + (h * 0.22) + ', ' + (w * 0.28) + ' ' + (h * 0.88) + ', ' + (w * 0.52) + ' ' + (h * 0.46) +
      ' S ' + (w * 0.74) + ' ' + (h * 0.10) + ', ' + (w * 1.25) + ' ' + (h * 0.64));
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

    var logo = document.querySelector('.ai-logo');
    if (logo) logo.style.opacity = '0';
    var anillo = document.querySelector('.ai-logo-ring');
    if (anillo) anillo.style.opacity = '0';
    var borde = document.querySelector('.ai-logo-edge');
    if (borde) borde.style.opacity = '0';

    construirEscena();
  }

  /* ══ TEXTO QUE SE DESCIFRA (para el estado de arranque) ══════ */
  function descifrar(nodo, texto, duracion) {
    if (!nodo) return;
    var a = anime();
    var simbolos = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%&·';
    if (!a) { nodo.textContent = texto; return; }
    a({
      targets: nodo,
      opacity: [0, 1],
      duration: duracion,
      easing: 'linear',
      update: function (inst) {
        var visibles = Math.floor(inst.progress * texto.length);
        var salida = '';
        for (var i = 0; i < texto.length; i++) {
          salida += (i < visibles) ? texto.charAt(i)
            : simbolos.charAt(Math.floor(Math.random() * simbolos.length));
        }
        nodo.textContent = salida;
      },
      complete: function () { nodo.textContent = texto; }
    });
  }

  /* ══ BARRA DE PROGRESO ════════════════════════════════════════ */
  function correrProgreso() {
    var relleno = $('ai-progress-fill');
    var pctEl = $('ai-pct');
    var inicio = Date.now();
    var total = DURACION - RETRASO_PROGRESO - 300;
    function paso() {
      var e = Math.min(1, (Date.now() - inicio) / total);
      var p = Math.round(e * 100);
      if (relleno) relleno.style.width = p + '%';
      if (pctEl) pctEl.textContent = String(p).padStart(2, '0');
      if (e < 1) rafId = requestAnimationFrame(paso);
    }
    rafId = requestAnimationFrame(paso);
  }

  /* ══ LÍNEA DE TIEMPO ═══════════════════════════════════════════ */
  function lineaTiempo() {
    var a = anime();
    if (!a) return null;

    var icos = escena ? escena.querySelectorAll('.ai-cine-ico') : [];
    var particulas = escena ? escena.querySelectorAll('.ai-particle') : [];
    var burbujas = escena ? escena.querySelectorAll('.ai-bubble') : [];
    var rayos = escena ? escena.querySelectorAll('.ai-ray') : [];
    var ondas = escena ? escena.querySelectorAll('.ai-wave') : [];
    var vortice = escena ? escena.querySelector('.ai-vortex') : null;
    var rutaTortuga = document.getElementById('ruta-tortuga');
    var rutasBurbuja = ['ruta-burbuja', 'ruta-burbuja2', 'ruta-burbuja3'].map(function (id) {
      return document.getElementById(id);
    });

    var tl = a.timeline({ easing: 'easeOutExpo' });

    /* I · EL MAR se dibuja ------------------------------------- */
    tl.add({
      targets: '.ai-ola',
      strokeDashoffset: [a.setDashoffset, 0],
      duration: 1400,
      delay: a.stagger(200),
      easing: 'easeInOutSine'
    }, 0);

    /* II · DESCANSO DE LA LUZ ----------------------------------- */
    tl.add({
      targets: rayos,
      opacity: [0, 0.5],
      scaleY: [0.4, 1],
      duration: 1400,
      delay: a.stagger(120),
      easing: 'easeOutSine'
    }, 150);

    tl.add({
      targets: rayos,
      translateX: [0, 28],
      opacity: [0.5, 0.2],
      duration: 3600,
      delay: a.stagger(120),
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    }, 1600);

    /* Burbujas por trayectorias reales (bucle infinito) */
    burbujas.forEach(function (burbuja, bi) {
      var ruta = rutasBurbuja[bi % rutasBurbuja.length];
      if (!ruta) return;
      var dur = a.random(4200, 7000);
      var ret = 300 + bi * 240;
      nadarPorRuta(burbuja, ruta, dur, ret, true);
      a({
        targets: burbuja,
        opacity: [{ value: 0.8, duration: 700 }, { value: 0, duration: 600 }],
        duration: dur,
        delay: ret,
        loop: true,
        easing: 'linear'
      });
    });

    /* III · LA TORTUGA ------------------------------------------ */
    tl.add({
      targets: '.ai-tortuga',
      opacity: [0, 1],
      scale: [0.72, 1],
      duration: 700,
      easing: 'easeOutQuad'
    }, 1150);

    /* La tortuga recorre la trayectoria real */
    nadarPorRuta(document.querySelector('.ai-tortuga-wrap'), rutaTortuga, 4600, 1150, false, null, true);

    /* Las aletas baten (una hacia cada lado) */
    tl.add({
      targets: '.ai-aleta-izq',
      rotate: [0, -28],
      duration: 460,
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    }, 1200);

    tl.add({
      targets: '.ai-aleta-der',
      rotate: [0, 28],
      duration: 460,
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    }, 1200);

    tl.add({
      targets: '.ai-aleta-tras-izq, .ai-aleta-tras-der',
      rotate: [0, 20],
      duration: 520,
      direction: 'alternate',
      loop: true,
      easing: 'easeInOutSine'
    }, 1200);

    /* IV · LOS ICONOS DEL SABER nadan hacia el centro ----------- */
    tl.add({
      targets: icos,
      translateX: function (el) { return [el.dataset.dx, '0vmin']; },
      translateY: function (el) { return [el.dataset.dy, '0vmin']; },
      scale: [0, 1],
      opacity: [0, 0.95],
      rotate: function () { return [a.random(-40, 40), 0]; },
      duration: 1600,
      delay: a.stagger(90, { from: 'center' }),
      easing: 'easeOutElastic(1, .65)'
    }, 1500);

    if (vortice) {
      tl.add({
        targets: vortice,
        rotate: 360,
        duration: 26000,
        loop: true,
        easing: 'linear'
      }, 1200);
    }

    /* V · EL REMOLINO: la tortuga se hunde y todo cae al centro -- */
    tl.add({
      targets: '.ai-tortuga',
      scale: 0.35,
      opacity: 0,
      filter: ['blur(0px)', 'blur(12px)'],
      duration: 1300,
      easing: 'easeInQuad'
    }, 3300);

    tl.add({
      targets: particulas,
      translateX: function (el) { return [el.dataset.x, '0vmin']; },
      translateY: function (el) { return [el.dataset.y, '0vmin']; },
      scale: [1, 0.12],
      opacity: [0.85, 0],
      duration: 1900,
      delay: a.stagger(12),
      easing: 'easeInExpo'
    }, 3400);

    tl.add({
      targets: icos,
      translateX: 0,
      translateY: 0,
      scale: 0.08,
      opacity: 0,
      filter: ['blur(0px)', 'blur(9px)'],
      duration: 1400,
      delay: a.stagger(26, { from: 'center' }),
      easing: 'easeInExpo'
    }, 3700);

    /* Anillos de choque */
    tl.add({
      targets: ondas,
      scale: [0.18, 2.8],
      opacity: [0.8, 0],
      duration: 1900,
      delay: a.stagger(500),
      loop: true,
      easing: 'easeOutQuad'
    }, 3900);

    /* VI · LA MARCA emerge -------------------------------------- */
    tl.add({
      targets: '.ai-logo',
      scale: [0.45, 1],
      opacity: [0, 1],
      filter: ['blur(28px)', 'blur(0px)'],
      duration: 1700,
      easing: 'easeOutExpo'
    }, 3900);

    tl.add({
      targets: '.ai-logo-ring',
      rotate: 340,
      scale: [0.55, 1],
      opacity: [0, 0.9],
      duration: 2300,
      easing: 'easeOutExpo'
    }, 3900);

    tl.add({
      targets: '.ai-logo-edge',
      opacity: [0, 0.9],
      duration: 1400,
      easing: 'easeOutQuad'
    }, 4100);

    /* VII · EL TÍTULO entra en 3D ------------------------------- */
    tl.add({
      targets: '.ai-letter',
      translateY: ['118%', '0%'],
      rotateX: [-92, 0],
      opacity: [0, 1],
      filter: ['blur(10px)', 'blur(0px)'],
      duration: 950,
      delay: a.stagger(48),
      easing: 'cubicBezier(.16, 1, .3, 1)'
    }, 4600);

    tl.add({
      targets: '.ai-sub',
      translateY: [18, 0],
      opacity: [0, 1],
      duration: 650,
      easing: 'easeOutQuart'
    }, 5500);

    tl.add({
      targets: '.ai-log li',
      translateX: [-34, 0],
      opacity: [0, 1],
      duration: 580,
      delay: a.stagger(160),
      easing: 'easeOutExpo'
    }, 5700);

    /* El estado se descifra */
    tl.add({
      targets: '#ai-status-text',
      duration: 700,
      easing: 'linear',
      begin: function () { descifrar($('ai-status-text'), 'CUADERNO ABIERTO', 900); }
    }, 5900);

    /* VIII · LA COMPUERTA --------------------------------------- */
    tl.add({
      targets: '.ai-core',
      translateY: [0, '-16vh'],
      scale: [1, 1.09],
      opacity: [1, 0],
      filter: ['blur(0px)', 'blur(16px)'],
      duration: 1150,
      easing: 'easeInQuad'
    }, 6900);

    tl.add({
      targets: '.ai-cine',
      opacity: [1, 0],
      duration: 950,
      easing: 'easeInQuad'
    }, 7100);

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
      a({
        targets: overlay.querySelector('.ai-core'),
        scale: 1.12,
        opacity: 0,
        filter: 'blur(18px)',
        duration: 640,
        easing: 'easeInQuad'
      });
      a({
        targets: overlay.querySelector('.ai-cine'),
        opacity: 0,
        scale: 1.18,
        duration: 640,
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

  return { play: play, finish: terminar };
})();
