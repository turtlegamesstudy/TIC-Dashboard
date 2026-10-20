/* ══════════════════════════════════════════════════════════════════════════
   sw.js — PWA del TIC Dashboard
   Objetivo: que un docente con mala señal pueda REABRIR el panel
   y seguir viendo su base (los datos de la sesión se guardan en
   localStorage; la cola de escrituras la gestiona el SDK de
   Firebase mientras la pestaña siga abierta).

   Estrategia:
   · Navegación (HTML)      → red primero, cae a caché si no hay red.
   · CSS/JS/imagenes/CDN    → caché primero, se refresca de fondo.
   Esto evita dos males: pantalla en blanco sin red, y quedarse
   clavados en una versión vieja cuando sí hay red.
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';

var CACHE = 'tic-dashboard-v9';
var SHELL = [
  './',
  './index.html',
  './style.css',
  './remodelacion.css',
  './flat.css',
  './sw.js',
  './manifest.json',
  'js/00-main.js',
  'js/01-cuaderno-engine.js',
  'js/02-data-engine.js',
  'js/03-config-export.js',
  'js/04-ui-core.js',
  'js/05-message-engine.js',
  'js/06-stats-engine.js',
  'js/07-examenes-engine.js',
  'js/08-informe-engine.js',
  'js/09-equipos-engine.js',
  'js/10-firebase-bootstrap.js',
  'js/11-auth.js',
  'js/12-admin-manager.js',
  'js/13-profile-manager.js',
  'js/14-secciones.js',
  'js/15-permisos.js',
  'js/16-mejoras.js',
  'js/17-auth-carousel.js',
  'js/18-auth-intro.js',
  'js/19-auditoria.js',
  'js/20-plantillas.js',
  'js/21-reportes.js',
  'js/22-asistencia.js',
  'js/23-carga-diferida.js',
  'js/24-tutorial.js',
  'js/25-recordatorios.js',
  'js/26-riesgo.js',
  'js/27-jefe-panel.js',
  'js/28-panel-global.js',
  'js/30-legal.js',
  'js/31-pwa.js',
  'assets/logo-inatec.png',
  'assets/logo-inatec-blanco.png',
  'assets/fondo-profundo.gif',
  'assets/fondo-claro.gif',
  'assets/fondo-claro.png',
  'assets/fondo-oscuro.png'
];

self.addEventListener('install', function (evento) {
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        /* El shell completo no es obligatorio: lo que falle no rompe el resto. */
        return Promise.all(SHELL.map(function (url) {
          return cache.add(url).catch(function () { /* ausente: se cachea en vuelo */ });
        }));
      })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys().then(function (llaves) {
      return Promise.all(
        llaves.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (evento) {
  /* La página pide actualizarse apenas se carga una versión nueva. */
  if (evento.data === 'tic-actualizar') {
    self.skipWaiting().then(function () {
      self.clients.matchAll({ type: 'window' }).then(function (clientes) {
        clientes.forEach(function (cliente) { cliente.navigate(cliente.url); });
      });
    });
  }
});

self.addEventListener('fetch', function (evento) {
  var peticion = evento.request;
  if (peticion.method !== 'GET') return;
  var url = new URL(peticion.url);

  /* Solo http(s): las peticiones de extensiones o del devtools se pasan. */
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  var esNavegacion = peticion.mode === 'navigate' ||
    (peticion.destination === 'document' && url.origin === location.origin);

  if (esNavegacion) {
    /* HTML: primero la red (así la app se actualiza sola); si no hay
       red se sirve la copia â€” el docente reabre el panel igual. */
    evento.respondWith(
      fetch(peticion).then(function (respuesta) {
        var copia = respuesta.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(peticion, copia).catch(function () { });
        });
        return respuesta;
      }).catch(function () {
        return caches.match(peticion)
          .then(function (hit) { return hit || caches.match('./index.html'); });
      })
    );
    return;
  }

  /* Resto de assets (locales y CDN): caché primero y refresco de fondo. */
  evento.respondWith(
    caches.match(peticion, { ignoreVary: true }).then(function (hit) {
      var red = fetch(peticion).then(function (respuesta) {
        if (respuesta && (respuesta.status === 200 || respuesta.type === 'opaque')) {
          var copia = respuesta.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(peticion, copia).catch(function () { });
          });
        }
        return respuesta;
      }).catch(function () {
        return hit; /* sin red y sin recompra: sin problema */
      });
      return hit || red; /* con red lenta, primero la copia ya existente */
    })
  );
});
