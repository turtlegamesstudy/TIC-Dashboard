'use strict';
/* ═══════════════════════════════════════════════════════════════
   33-animaciones.js — Sistema de animación del panel (Anime.js)
   ───────────────────────────────────────────────────────────────
   Anime.js v3.2.2 (MIT) vive LOCAL en js/vendor/anime.min.js para
   que la PWA siga funcionando sin conexión (nada de CDN).

   Qué anima:
     · la entrada de cada vista: cabecera + bloques escalonados
     · las filas de tabla, una a una
     · las tarjetas con inclinación 3D al pasar el puntero
     · los números que cuentan hacia su valor
     · el realimentado al pulsar botones
     · los avisos y los paneles que se abren

   Regla de la casa: si el docente dejó «Animaciones» en «off» o el
   sistema pide menos movimiento, NO se anima nada. Todo el sistema
   pasa por un solo interruptor.
   ═══════════════════════════════════════════════════════════════ */

window.Anims = (function () {
  'use strict';

  const anime = () => (typeof window.anime === 'function' ? window.anime : null);

  /* ── el interruptor ─────────────────────────────────────────── */
  function motionPermitido() {
    try {
      const mov = document.documentElement.getAttribute('data-motion');
      if (mov === 'off') return false;
      if (mov === 'on') return true;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch (e) { /* sin preferencias: se permite */ }
    return true;
  }

  function listo() { return motionPermitido() && !!anime(); }

  /* ── 1 · Entrada de vista ─────────────────────────────────────
     La cabecera baja con suavidad; los bloques que la siguen entran
     escalonados, como si el panel se "~desplegara". */
  function animarVista(workspace) {
    if (!workspace || !listo()) return;
    const a = anime();

    const cabecera = workspace.querySelector('.view-header');
    if (cabecera) {
      a({
        targets: cabecera,
        translateY: [-16, 0],
        opacity: [0, 1],
        duration: 560,
        easing: 'easeOutCubic'
      });
    }

    // Las tarjetas de resumen se animan aparte (con escala) y por eso
    // se sacan de la lista de bloques: dos animaciones sobre el mismo
    // nodo se pisarían la propiedad transform.
    const tarjetas = workspace.querySelectorAll(
      '.ficha-stat, .kpi-card, .dash-card, .admin-stat, .stat-card, .ficha-tarjeta');
    const enTarjeta = new Set(tarjetas);

    const bloques = Array.from(workspace.children).filter(el =>
      el !== cabecera &&
      !enTarjeta.has(el) &&
      !el.classList.contains('no-imprimir') &&
      !el.hasAttribute('hidden'));
    if (bloques.length) {
      a({
        targets: bloques,
        translateY: [22, 0],
        opacity: [0, 1],
        duration: 660,
        delay: a.stagger(75, { start: 110 }),
        easing: 'easeOutExpo'
      });
    }

    if (tarjetas.length) {
      a({
        targets: tarjetas,
        scale: [0.93, 1],
        opacity: [0, 1],
        duration: 560,
        delay: a.stagger(55, { start: 200 }),
        easing: 'easeOutBack'
      });
    }

    const filas = workspace.querySelectorAll('.custom-table tbody tr');
    if (filas.length) {
      a({
        targets: filas,
        opacity: [0, 1],
        translateX: [-12, 0],
        duration: 430,
        delay: a.stagger(24, { start: 280 }),
        easing: 'easeOutQuad'
      });
    }

    contarNumeros(workspace);
    inclinarTarjetas(workspace);
  }

  /* ── 2 · Números que cuentan ───────────────────────────────────
     Solo los nodos marcados con data-anim-contar (y solo si su
     texto es un número: si vale "—" se queda quieto). */
  function contarNumeros(raiz) {
    if (!raiz || !listo()) return;
    const a = anime();
    raiz.querySelectorAll('[data-anim-contar]').forEach(nodo => {
      const destino = parseFloat(String(nodo.textContent || '').replace(',', '.'));
      if (!isFinite(destino)) return;
      const estado = { v: 0 };
      const sufijo = String(nodo.textContent || '').slice(String(Math.round(destino)).length);
      a({
        targets: estado,
        v: destino,
        duration: 950,
        easing: 'easeOutExpo',
        update: () => { nodo.textContent = String(Math.round(estado.v)) + sufijo; },
        complete: () => { nodo.textContent = String(Math.round(destino)) + sufijo; }
      });
    });
  }

  /* ── 3 · Inclinación 3D al pasar el puntero ───────────────────
     Solo en punteros reales (en el dedo no tiene sentido). */
  function inclinarTarjetas(raiz) {
    if (!raiz || !listo() || !window.matchMedia) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const a = anime();
    raiz.querySelectorAll('.ficha-stat, .kpi-card').forEach(nodo => {
      if (nodo.dataset.animeTilt === '1') return;
      nodo.dataset.animeTilt = '1';
      nodo.classList.add('anim-tilt');
      nodo.addEventListener('pointerenter', () => {
        nodo.dataset.tilting = '1';
      });
      nodo.addEventListener('pointermove', ev => {
        if (nodo.dataset.tilting !== '1') return;
        const r = nodo.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x = (ev.clientX - r.left) / r.width - 0.5;
        const y = (ev.clientY - r.top) / r.height - 0.5;
        a.remove(nodo);
        a({
          targets: nodo,
          rotateY: x * 9,
          rotateX: -y * 9,
          duration: 400,
          easing: 'easeOutQuad'
        });
      });
      nodo.addEventListener('pointerleave', () => {
        nodo.dataset.tilting = '0';
        a.remove(nodo);
        a({
          targets: nodo,
          rotateY: 0,
          rotateX: 0,
          duration: 700,
          easing: 'easeOutElastic(1, .6)'
        });
      });
    });
  }

  /* ── 4 · Realimentado al pulsar ─────────────────────────────── */
  function conectar() {
    if (document.documentElement.dataset.animsListos === '1') return;
    document.documentElement.dataset.animsListos = '1';

    document.addEventListener('click', ev => {
      if (!listo()) return;
      const btn = ev.target.closest('button');
      if (!btn || btn.disabled) return;
      if (btn.dataset.animeSinPulso === '1') return;
      const a = anime();
      a.remove(btn);
      a({
        targets: btn,
        scale: [1, 0.93, 1],
        duration: 330,
        easing: 'easeOutQuad'
      });
    }, true);

    // Avisos y paneles: se detectan cuando aparecen en el DOM.
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(mutas => {
      if (!listo()) return;
      const a = anime();
      mutas.forEach(m => {
        (m.addedNodes || []).forEach(nodo => {
          if (!nodo || nodo.nodeType !== 1) return;
          if (nodo.classList && nodo.classList.contains('toast')) {
            a({
              targets: nodo,
              translateX: [46, 0],
              opacity: [0, 1],
              duration: 430,
              easing: 'easeOutBack'
            });
          }
          if (nodo.classList && nodo.classList.contains('modal-overlay') && !nodo.classList.contains('hidden')) {
            const panel = nodo.querySelector('.modal-content, .panel');
            if (panel) {
              a({
                targets: panel,
                scale: [0.95, 1],
                translateY: [18, 0],
                opacity: [0, 1],
                duration: 440,
                easing: 'easeOutExpo'
              });
            }
          }
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ── Arranque ───────────────────────────────────────────────── */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', conectar);
    } else {
      conectar();
    }
  }

  return {
    animarVista,
    contarNumeros,
    inclinarTarjetas,
    conectar,
    listo,
    motionPermitido
  };
})();
