/* ═══════════════════════════════════════════════════════════════
   17-auth-carousel.js — Carrusel de imágenes INATEC en el login
   Dos capas con crossfade, efecto Ken Burns, barras de progreso,
   flechas laterales, pausa automática y controles de teclado.
   Sustituye a los videos de YouTube (js/17-auth-videos.js).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var IMAGENES = [
    { src: 'assets/inatec-lanzamiento-01.jpg', alt: 'Lanzamiento de matrículas del Tecnológico Nacional' },
    { src: 'assets/inatec-lanzamiento-02.jpg', alt: 'Lanzamiento de matrículas del Tecnológico Nacional, segundo semestre' },
    { src: 'assets/inatec-lanzamiento-08.jpg', alt: 'Oferta académica del Tecnológico Nacional' },
    { src: 'assets/tn8-2-107.jpg', alt: 'Estudiantes del Tecnológico Nacional' },
    { src: 'assets/inatec-bootcamp-pedagogico.jpg', alt: 'Bootcamp pedagógico INATEC' },
    { src: 'assets/el19-inatec5.webp', alt: 'INATEC en El 19 Digital' },
    { src: 'assets/canal2-bootcamp.png', alt: 'Bootcamp INATEC en Canal 2' }
  ];

  var carrusel = document.getElementById('auth-carousel');
  if (!carrusel) return;

  var capaA = document.getElementById('auth-carousel-a');
  var capaB = document.getElementById('auth-carousel-b');
  var contenedorBarras = document.getElementById('auth-carousel-bars');

  var activaCapa = 0;   // 0 = capa A, 1 = capa B
  var indice = 0;
  var temporizador = null;
  var TIEMPO = 6000;

  function capa(i) {
    return i === 0 ? capaA : capaB;
  }

  /* Precargar: las transiciones no esperan a la red */
  IMAGENES.forEach(function (imagen) {
    var precarga = new Image();
    precarga.src = imagen.src;
  });

  /* ── Barras de progreso ── */
  function pintarBarras() {
    contenedorBarras.innerHTML = '';
    IMAGENES.forEach(function (imagen, i) {
      var barra = document.createElement('button');
      barra.type = 'button';
      barra.className = 'auth-carousel-bar';
      barra.setAttribute('aria-label', 'Imagen ' + (i + 1) + ' de ' + IMAGENES.length);
      var relleno = document.createElement('span');
      relleno.className = 'auth-carousel-fill';
      barra.appendChild(relleno);
      barra.addEventListener('click', function () {
        irA(i);
        reiniciar();
      });
      contenedorBarras.appendChild(barra);
    });
  }

  function activarBarra(i) {
    var barras = contenedorBarras.children;
    for (var k = 0; k < barras.length; k++) {
      barras[k].classList.toggle('is-on', k === i);
    }
  }

  /* ── Cambio de imagen con crossfade entre las dos capas ── */
  function irA(n) {
    if (n === indice) return;
    indice = (n + IMAGENES.length) % IMAGENES.length;

    var otra = activaCapa === 0 ? 1 : 0;
    var img = capa(otra).querySelector('img');
    img.src = IMAGENES[indice].src;
    img.alt = IMAGENES[indice].alt;
    capa(otra).classList.add('is-active');
    capa(activaCapa).classList.remove('is-active');
    activaCapa = otra;

    activarBarra(indice);
  }

  function avanzar() {
    irA(indice + 1);
  }

  /* ── Temporizador con pausa automática ── */
  function detener() {
    if (temporizador) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  }

  function reiniciar() {
    detener();
    temporizador = setTimeout(function () {
      avanzar();
      reiniciar();
    }, TIEMPO);
  }

  carrusel.addEventListener('mouseenter', detener);
  carrusel.addEventListener('mouseleave', reiniciar);
  window.addEventListener('blur', detener);
  window.addEventListener('focus', reiniciar);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) detener();
    else reiniciar();
  });

  /* ── Controles ── */
  carrusel.addEventListener('click', function (event) {
    var boton = event.target.closest('[data-carrusel]');
    if (!boton) return;
    if (boton.dataset.carrusel === 'prev') {
      irA(indice - 1);
    } else if (boton.dataset.carrusel === 'next') {
      irA(indice + 1);
    }
    reiniciar();
  });

  document.addEventListener('keydown', function (event) {
    var authVisible = !document.getElementById('auth-screen').hidden;
    if (!authVisible) return;
    if (event.key === 'ArrowLeft') {
      irA(indice - 1);
      reiniciar();
    } else if (event.key === 'ArrowRight') {
      irA(indice + 1);
      reiniciar();
    }
  });

  /* ── Arranque ── */
  var primerImg = capaA.querySelector('img');
  primerImg.src = IMAGENES[0].src;
  primerImg.alt = IMAGENES[0].alt;

  pintarBarras();
  activarBarra(0);
  reiniciar();
})();
