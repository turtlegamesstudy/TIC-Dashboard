/* ═══════════════════════════════════════════════════════════════
   17-auth-videos.js — Carrusel de videos INATEC en el login
   Dos capas de video que se cruzan con transición (crossfade)
   cuando termina un video. Fuente: canal oficial de YouTube
   Tecnológico Nacional (INATEC).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VIDEO_IDS = [
    'Qs61XTYrGeI', // Estudiá en el Tecnológico Nacional
    '1r5A0blFjwA', // Lanzamiento oferta formativa 2026
    'dW-PTLYoEFI', // Oferta académica Cmte. Hugo Chávez Frías
    'ZFhE59VMEno', // Inscripciones segundo semestre
    'axJCLOA0D-s', // Servicios virtuales gratuitos
    'iGt5T9N1gBc'  // Actualización pedagógica
  ];

  var players = [];      // [jugador capa A, jugador capa B]
  var activa = 0;        // índice de capa activa (0 = A, 1 = B)
  var indiceVideo = 0;   // índice del video en reproducción
  var listos = 0;
  var cambiando = false;

  function capa(i) {
    return document.getElementById(i === 0 ? 'auth-video-a' : 'auth-video-b');
  }

  function alTerminar() {
    if (cambiando) { return; }
    cambiando = true;

    var otra = activa === 0 ? 1 : 0;
    indiceVideo = (indiceVideo + 1) % VIDEO_IDS.length;
    var jugadorSiguiente = players[otra];
    if (!jugadorSiguiente) { cambiando = false; return; }

    var alIniciar = function (event) {
      // 1 = PLAYING
      if (event.data === 1) {
        jugadorSiguiente.removeEventListener('onStateChange', alIniciar);
        // Crossfade: la capa nueva entra, la vieja sale (1.4s)
        capa(otra).classList.add('is-active');
        capa(activa).classList.remove('is-active');
        activa = otra;
        cambiando = false;
      }
    };
    jugadorSiguiente.addEventListener('onStateChange', alIniciar);
    jugadorSiguiente.loadVideoById(VIDEO_IDS[indiceVideo]);
  }

  window.onYouTubeIframeAPIReady = function () {
    var opciones = {
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        playsinline: 1,
        disablekb: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1,
        iv_load_policy: 3
      }
    };

    [0, 1].forEach(function (i) {
      var conf = Object.assign({}, opciones, {
        videoId: VIDEO_IDS[i],
        events: {
          onReady: function () {
            listos++;
            if (listos === 2) {
              players[0].playVideo();
            }
          },
          onStateChange: function (event) {
            // 0 = ENDED; solo el video de la capa activa dispara el cambio
            if (event.data === 0 && i === activa) {
              alTerminar();
            }
          }
        }
      });
      players[i] = new YT.Player(
        document.getElementById(i === 0 ? 'auth-video-host-a' : 'auth-video-host-b'),
        conf
      );
    });
  };

  // Cargar la API de YouTube solo si la pantalla de acceso existe
  if (document.getElementById('auth-video-host-a')) {
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
})();
