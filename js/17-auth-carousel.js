/* ═══════════════════════════════════════════════════════════════
   17-auth-carousel.js — Carrusel de imágenes INATEC en el login
   Dos capas con crossfade, efecto Ken Burns, barras de progreso,
   flechas laterales, pausa automática y controles de teclado.
   Sustituye a los videos de YouTube (js/17-auth-videos.js).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var IMAGENES = [
    { src: 'assets/carousel/inatec-graduacion-2k.jpg', alt: 'Graduación INATEC · entrega de diplomas' },
    { src: 'assets/carousel/inatec-clase-2k.jpg', alt: 'Aula del Tecnológico Nacional' },
    { src: 'assets/carousel/inatec-certificados-2k.jpg', alt: 'Estudiantes egresados certificados por INATEC' },
    { src: 'assets/carousel/inatec-docentes-ia-2k.jpg', alt: 'Docentes INATEC en formación en inteligencia artificial' },
    { src: 'assets/carousel/inatec-tecnicas-2k.jpg', alt: 'Nuevas técnicas para la capacitación de docentes INATEC' },
    { src: 'assets/carousel/inatec-taller-2k.jpg', alt: 'Estudiantes en taller técnico del Tecnológico Nacional' },
    { src: 'assets/carousel/inatec-jinotega-2k.jpg', alt: 'Centro Tecnológico Marcos Ramírez, Jinotega' },
    { src: 'assets/carousel/inatec-campus-2k.jpg', alt: 'Campus del Tecnológico Nacional' },
    { src: 'assets/carousel/inatec-acto-2025.jpg', alt: 'Acto cultural INATEC 2025' },
    { src: 'assets/carousel/inatec-acto-2k.jpg', alt: 'Acto de graduación INATEC' },
    { src: 'assets/carousel/inatec-inaugura-2k.jpg', alt: 'Inauguración INATEC · label de flores' },
    { src: 'assets/carousel/inatec-campus-banner.jpg', alt: 'Campus Virtual · SoyTecNicaragua' },
    { src: 'assets/tn8-2-107.jpg', alt: 'Estudiantes del Tecnológico Nacional' },
    { src: 'assets/canal2-bootcamp.png', alt: 'Bootcamp pedagógico INATEC' },
    { src: 'assets/inatec-lanzamiento-01.jpg', alt: 'Lanzamiento de matrículas del Tecnológico Nacional' },
    { src: 'assets/inatec-lanzamiento-08.jpg', alt: 'Oferta académica del Tecnológico Nacional' },
    { src: 'assets/el19-inatec5.webp', alt: 'INATEC en El 19 Digital' }
  ];

  var carrusel = document.getElementById('auth-carousel');
  if (!carrusel) return;

  var capaA = document.getElementById('auth-carousel-a');
  var capaB = document.getElementById('auth-carousel-b');
  var contenedorBarras = document.getElementById('auth-carousel-bars');

  var activaCapa = 0;   // 0 = capa A, 1 = capa B
  var indice = 0;
  var temporizador = null;
  var TIEMPO = 3600;

  function capa(i) {
    return i === 0 ? capaA : capaB;
  }

  /* Precargar: solo las 2 primeras al instante (el login no debe
     descargar MB de puro carrusel); el resto baja en cola, una por
     transición, mientras el usuario escribe su usuario. */
  function precargar(imagen) {
    var precarga = new Image();
    precarga.src = imagen.src;
  }
  IMAGENES.slice(0, 2).forEach(precargar);
  var enCola = IMAGENES.slice(2);
  function cargarEnCola() {
    if (!enCola.length) return;
    precargar(enCola.shift());
    setTimeout(cargarEnCola, TIEMPO);
  }
  setTimeout(cargarEnCola, TIEMPO);

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
