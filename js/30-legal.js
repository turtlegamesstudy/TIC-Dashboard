'use strict';
/* ════════════════════════════════════════════════════════════════════════
   30-legal.js — Legal · Privacidad · Propiedad intelectual
   Turtle Games Dev — TIC Dashboard (INATEC)

   · Titular de la obra: Hanzell René Mayorga Calero / Turtle Games Dev.
     Todos los derechos reservados. El código NO concede licencia alguna;
     todo uso fuera del consentimiento escrito del titular queda prohibido.
   · Sección «Legal & Privacidad» visible para todos los roles del panel.
   · Aviso permanente en la pantalla de acceso, con tres documentos
     abribles en modal: Privacidad / Condiciones / Propiedad.
   · Los textos viven aquí (no en HTML heredado) para editarlos una vez.
   ════════════════════════════════════════════════════════════════════════ */
window.Legal = (function () {

  const EMPRESA = 'Turtle Games Dev';
  const AUTOR = 'Hanzell René Mayorga Calero';
  const CONTACTO = 'hanzell2007.mayorga@gmail.com';
  const YEAR = new Date().getFullYear();

  /* ── Utilidades ──────────────────────────────────────────────────────── */
  const escapar = valor => String(valor ?? '')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const parrafo = texto => `<p>${escapar(texto)}</p>`;
  const lista = puntos => `<ul>${puntos.map(p => `<li>${escapar(p)}</li>`).join('')}</ul>`;

  /* ── 1 · Política de Privacidad ─────────────────────────────────────── */
  function textoPrivacidad() {
    return `
      <blockquote class="legal-resumen">Tus datos se gestionan bajo dos principios: pertenecen al centro que los
      genera y solo el personal autorizado de ese centro los ve, con todas las acciones registradas en una
      auditoría permanente.</blockquote>
      ${parrafo(`Responsable del tratamiento: ${EMPRESA} (titular: ${AUTOR}). Canal de contacto y de derechos: ${CONTACTO}.`)}
      <h3>1 · Datos que recoge y guarda el sistema</h3>
      ${lista([
        'Cuentas del personal: nombre y apellidos, correo de acceso, rol y centro tecnológico asignado.',
        'Información académica del centro: grupos de clase, matrícula (nombres y apellidos de los estudiantes, estado Activo/Retirado), notas por módulo, convalidaciones, asistencia diaria, documentos y configuración del cuaderno docente.',
        'Datos técnicos del servicio: registro de auditoría (quién cambió qué y cuándo), papelera de elementos borrados, copia técnica propia para el modo sin conexión (cola y caché local), preferencias visuales y de sonido del usuario.'
      ])}
      <h3>2 · Para qué se usan (y para qué no)</h3>
      ${parrafo('Única finalidad: operar el dashboard académico del centro — registro de notas y asistencia, informes, impresión de cuadernos y documentos institucionales, y sincronización del trabajo entre el personal autorizado del mismo centro.')}
      ${lista([
        'Sin publicidad ni perfiles de marketing. Sin venta ni alquiler de datos. Sin seguimiento publicitario: los datos que quedan en el navegador son exclusivamente técnicos (tema visual, tutoriales vistos, caché de la app instalada).',
        'Tercero técnico: la información se almacena en Google Cloud Firebase; ese proveedor únicamente aloja y transmite los datos, no los administra.'
      ])}
      <h3>3 · Dónde viven los datos y con qué seguridad</h3>
      ${lista([
        'Base de datos en la nube (Google Cloud Firebase) sobre conexión cifrada HTTPS/TLS en todo momento.',
        'Acceso controlado por roles: cada cuenta ve únicamente la información de su centro; el Administrador Global supervisa todos los espacios de datos.',
        'Auditoría de cambios y papelera con restauración: toda eliminación queda registrada y es recuperable.',
        'Modo sin conexión: los cambios se guardan en una cola local del navegador y se sincronizan al volver la señal, con respaldo del estado previo del servidor antes de sobrescribir.'
      ])}
      <h3>4 · Derechos que se atienden por solicitud</h3>
      ${parrafo(`Por escrito a ${CONTACTO}, el centro o el interesado pueden solicitar: acceso a sus datos, corrección o actualización, eliminación, portabilidad (exportación de la base del centro) y conocer quién accedió a qué (el hilo de auditoría correspondiente).`)}
      ${parrafo('Estudiantes: sus datos provienen de la matrícula oficial entregada por el centro; no se recogen datos sensibles (salud, religión, etnia) ni fotografías. Los padres, madres o tutores legales ejercen sus derechos a través del canal del centro, que es quien entrega y custodia la matrícula.')}
      <h3>5 · Cuánto tiempo permanecen guardados</h3>
      ${parrafo('Los datos permanecen mientras el centro sea parte del sistema (con tolerancia por notas, papelera y respaldos). En el cierre definitivo de un centro: se le entrega copia completa de su base y después se elimina su espacio de datos.')}
      <h3>6 · Cambios de esta política</h3>
      ${parrafo(`Toda modificación se anuncia dentro de esta misma sección «Legal & Privacidad» del panel. Última actualización: ${YEAR}.`)}`;
  }

  /* ── 2 · Condiciones de uso ─────────────────────────────────────────── */
  function textoCondiciones() {
    return `
      <blockquote class="legal-resumen">${EMPRESA} presta el TIC Dashboard como servicio interno académico. La cuenta
      es personal e intransferible; usar la cuenta implica aceptar estas condiciones y reconoce que Turtle Games Dev
      mantiene copia técnica de lo que la propia cuenta guarda, con transparencia de auditoría y sin otros fines.</blockquote>
      <h3>1 · Cuenta y accesos</h3>
      ${lista([
        'Cada usuario es responsable de su contraseña y de la actividad realizada con su cuenta. Compartir credenciales queda prohibido.',
        'El rol de cada cuenta limita qué ve y qué toca; eludir esos límites (por ejemplo, intentar acceder a datos de otro centro) es uso indebido y queda registrado.',
        'La cuenta de invitado es de consulta, autorizada por el centro, y no modifica datos.'
      ])}
      <h3>2 · Uso correcto del contenido</h3>
      ${lista([
        'Cada centro administra sus propios grupos, notas y documentos; el personal no debe alterar información que no le corresponde.',
        'No se permite descargar o exportar datos fuera de las funciones previstas para ello (informes, cuadernos, avisos del propio sistema).',
        'No se permite introducir en el sistema información ajena al ámbito escolar.'
      ])}
      <h3>3 · Disponibilidad del servicio</h3>
      ${parrafo('El sistema trabaja con carga y guardado en momentos previstos y también funciona sin conexión. Turtle Games Dev compromete cuidado diligente para mantener el servicio disponible, sin promesa de cero interrupciones; ante eventos graves se prioriza no perder información del centro (auditoría, papelera y cola sin conexión).')}
      <h3>4 · Suspensión y bajas</h3>
      ${lista([
        'Ante uso indebido (cuentas compartidas, intentos de acceso a otros centros, alteración de datos ajenos), Turtle Games Dev puede suspender temporal o definitivamente la cuenta, informando al administrador del centro.',
        'El centro puede abandonar el servicio cuando quiera: se le entrega su base de datos completa y se retira el acceso de su personal.'
      ])}
      <h3>5 · Reportes de seguridad</h3>
      ${parrafo(`Si encuentras una vulnerabilidad o un acceso indebido a información, repórtalo de inmediato a ${CONTACTO}. Turtle Games Dev agradece los reportes responsables y no toma represalias contra quien reporte de buena fe.`)}`;
  }

  /* ── 3 · Propiedad intelectual ──────────────────────────────────────── */
  function textoPropiedad() {
    return `
      <blockquote class="legal-resumen">© ${YEAR} ${EMPRESA} — ${AUTOR}. Todos los derechos reservados a nivel mundial.
      Este aviso no puede retirarse de la aplicación.</blockquote>
      <h3>1 · Titularidad de la obra</h3>
      ${parrafo(`El TIC Dashboard —incluyendo su código fuente, diseño de interfaz, flujos de trabajo, estructuras de datos, plantillas de documentos, textos de tutoría, nombre y el concepto general como dashboard académico multicentro— es una obra intelectual original de ${AUTOR}, bajo el amparo de ${EMPRESA}.`)}
      ${parrafo(`La autoría y la anterioridad quedan acreditadas con una cadena de desarrollo fechada (etiqueta v1.0OFI e historial de versiones) y con este aviso publicado. La ley protege la obra desde su creación, con o sin registro adicional; ${EMPRESA} se reserva igualmente la posibilidad de registrarlo formalmente o de proteger sus marcas.`)}
      <h3>2 · Qué está permitido</h3>
      ${lista([
        'Uso interno del panel por el personal autorizado de cada centro, dentro de las funciones previstas.',
        'Impresión fiel de los documentos del propio centro (cuadernos, informes, avisos).'
      ])}
      <h3>3 · Qué está expresamente prohibido</h3>
      ${lista([
        'Copiar, reproducir, distribuir o publicar, en todo o en parte, el código, el diseño, la estructura o los textos del sistema.',
        'Realizar ingeniería inversa, descompilación o reconstrucción del sistema o de sus partes.',
        'Construir, ofrecer o promocionar aplicaciones «similares», «inspiradas» o derivadas de este dashboard sin autorización escrita del titular.',
        'Revender, subarrendar u operar este sistema para personas o centros no autorizados por Turtle Games Dev.',
        'Retirar o alterar este aviso, las marcas ni las referencias de autoría visibles en pantalla.'
      ])}
      <h3>4 · Sin licencia de código</h3>
      ${parrafo(`El acceso a los archivos fuente (repositorio, paquete de despliegue o pantalla del panel) NO CONCEDE ninguna licencia. Cualquier uso, adaptación o integración requiere consentimiento previo y por escrito del titular de derechos (${CONTACTO}).`)}
      <h3>5 · Marcas</h3>
      ${parrafo('Las referencias a instituciones educativas y logos que el sistema imprime pertenecen a sus titulares y se muestran por necesidad funcional del documento escolar; nada aquí las transfiere. «TIC Dashboard» y «Turtle Games Dev», con su identidad visual, son de uso exclusivo del titular.')}
      <h3>6 · Infracciones</h3>
      ${parrafo('El uso no autorizado de la obra y de sus elementos constituye violación de derechos reservados y dará lugar a las reclamaciones y medidas correspondientes, incluida la suspensión del acceso del infractor dentro del sistema.')}`;
  }

  /* ── Vistas ─────────────────────────────────────────────────────────── */
  function bloque(clase, tituloHTML, contenido) {
    return `<section class="legal-bloque ${clase}">
      <h2>${tituloHTML}</h2>
      <div class="legal-cuerpo">${contenido}</div>
    </section>`;
  }

  function renderVista() {
    return `<div class="module-fade-enter">
      <header class="view-header"><div>
        <h1>Legal &amp; Privacidad</h1>
        <p>Cómo se protegen los datos del centro y qué derechos reserva ${EMPRESA} sobre su sistema.</p>
      </div></header>
      <div class="legal-banda" role="note">
        <i class="ri-shield-user-line" aria-hidden="true"></i>
        <span>© ${escapar(YEAR)} ${escapar(EMPRESA)} — ${escapar(AUTOR)}. Todos los derechos reservados. Los datos del
        centro se gestionan con acceso por roles, auditoría y respaldo, y <b>nunca</b> se usan para fines distintos del académico.</span>
      </div>
      ${bloque('legal-privacidad', '<i class="ri-lock-2-line" aria-hidden="true"></i> Política de Privacidad', textoPrivacidad())}
      ${bloque('legal-condiciones', '<i class="ri-file-text-line" aria-hidden="true"></i> Condiciones de uso', textoCondiciones())}
      ${bloque('legal-propiedad', '<i class="ri-copyright-line" aria-hidden="true"></i> Propiedad intelectual y de la idea', textoPropiedad())}
      <p class="legal-contacto"><i class="ri-mail-line" aria-hidden="true"></i>
        Dudas, derechos o reportes de seguridad: <a href="mailto:${CONTACTO}">${CONTACTO}</a></p>
    </div>`;
  }

  /* Modal reutilizable (pantalla de acceso y cualquier punto del panel). */
  function abrirDocumento(clave) {
    const documentos = {
      privacidad: { titulo: 'Política de Privacidad', cuerpo: textoPrivacidad() },
      condiciones: { titulo: 'Condiciones de uso', cuerpo: textoCondiciones() },
      propiedad: { titulo: 'Propiedad intelectual', cuerpo: textoPropiedad() }
    };
    const doc = documentos[clave];
    if (!doc) return;
    cerrarDocumento();
    const velo = document.createElement('div');
    velo.id = 'legal-velo';
    velo.className = 'legal-velo';
    const icono = clave === 'privacidad' ? 'ri-lock-2-line'
      : clave === 'condiciones' ? 'ri-file-text-line' : 'ri-copyright-line';
    velo.innerHTML = `<div class="legal-caja" role="dialog" aria-modal="true" aria-label="${escapar(doc.titulo)}">
      <button type="button" class="legal-cerrar" data-legal-cerrar title="Cerrar"><i class="ri-close-line"></i></button>
      <h2><i class="${icono}" aria-hidden="true"></i> ${escapar(doc.titulo)}</h2>
      <div class="legal-cuerpo">${doc.cuerpo}</div>
      <p class="legal-pie-modal">© ${escapar(YEAR)} ${escapar(EMPRESA)} — ${escapar(AUTOR)} · ${escapar(CONTACTO)}</p>
    </div>`;
    velo.addEventListener('click', evento => { if (evento.target === velo) cerrarDocumento(); });
    velo.querySelector('[data-legal-cerrar]').addEventListener('click', cerrarDocumento);
    document.body.appendChild(velo);
  }

  function cerrarDocumento() {
    const velo = document.getElementById('legal-velo');
    if (velo) velo.remove();
  }

  /* ── Pie de la pantalla de acceso ───────────────────────────────────── */
  function pieLoginHTML() {
    return `<div class="legal-pie">
      <span class="legal-copy"><i class="ri-copyright-line" aria-hidden="true"></i> ${escapar(YEAR)} ${escapar(EMPRESA)} · Datos protegidos</span>
      <span class="legal-links">
        <button type="button" data-legal="privacidad">Privacidad</button><em aria-hidden="true">·</em>
        <button type="button" data-legal="condiciones">Condiciones</button><em aria-hidden="true">·</em>
        <button type="button" data-legal="propiedad">Propiedad</button>
      </span>
    </div>`;
  }

  /* ── Consentimiento explícito del acceso ───────────────────────────── */
  function consentimientoHTML() {
    return `<div class="legal-consentir" id="legal-consentir">
      <input type="checkbox" id="legal-consentir-check" aria-describedby="legal-consentir-texto">
      <span id="legal-consentir-texto">Acepto la
        <button type="button" data-legal="privacidad">Política de Privacidad</button>,
        las <button type="button" data-legal="condiciones">Condiciones de uso</button> y la
        <button type="button" data-legal="propiedad">Propiedad intelectual</button>
        de ${escapar(EMPRESA)}.
      </span>
    </div>`;
  }

  function vincularLogin() {
    try {
      const ancla = document.querySelector('.auth-panel') || document.querySelector('.auth-card');
      if (!ancla) return;
      /* Pie de marca legal (una sola vez por pintada de la tarjeta) */
      if (!ancla.querySelector('.legal-pie')) {
        ancla.insertAdjacentHTML('beforeend', pieLoginHTML());
      }
      /* Consentimiento explícito antes de poder ingresar */
      if (!ancla.querySelector('.legal-consentir')) {
        const formulario = ancla.querySelector('.auth-form') || ancla;
        const mensaje = formulario.querySelector('.auth-message');
        const html = consentimientoHTML();
        if (mensaje) mensaje.insertAdjacentHTML('beforebegin', html);
        else formulario.insertAdjacentHTML('beforeend', html);
        /* Pulsar el texto (sin ser un enlace) marca el casillero */
        const caja = ancla.querySelector('.legal-consentir input[type="checkbox"]');
        const texto = ancla.querySelector('.legal-consentir > span');
        texto && texto.addEventListener('click', evento => {
          if (evento.target.closest('button')) return;
          if (caja && evento.target !== caja) caja.click();
        });
      }
      ancla.querySelectorAll('.legal-pie [data-legal], .legal-consentir [data-legal]').forEach(boton => {
        if (boton.dataset.legalVinculado) return;
        boton.dataset.legalVinculado = '1';
        boton.addEventListener('click', () => abrirDocumento(boton.dataset.legal));
      });
      premarcarConsentimiento();
    } catch (_) { /* la pantalla aún no está: se reintenta cuando aparezca */ }
  }

  /* El envío del login NO llega a 11-auth.js si el casillero está vacío.
     Va en fase de captura sobre `document`: corre antes que el manejador
     del formulario sin importar el orden de carga de los scripts. */
  function vigilarEnvio() {
    document.addEventListener('submit', evento => {
      const formulario = evento.target;
      if (!formulario || formulario.id !== 'auth-login-form') return;
      const caja = document.getElementById('legal-consentir-check');
      if (caja && !caja.checked) {
        evento.preventDefault();
        evento.stopImmediatePropagation();
        rechazarConsentimiento();
      }
    }, true);
  }

  function rechazarConsentimiento() {
    const fila = document.getElementById('legal-consentir');
    if (fila) {
      fila.classList.add('is-rechazado');
      setTimeout(() => fila.classList.remove('is-rechazado'), 1800);
    }
    const mensaje = 'Debes aceptar la Política de Privacidad y las Condiciones de uso para ingresar.';
    if (typeof UI !== 'undefined' && UI && typeof UI.showToast === 'function') UI.showToast(mensaje, 'warning');
    const nodo = document.getElementById('auth-message');
    if (nodo) {
      nodo.textContent = mensaje;
      nodo.classList.remove('is-success');
      nodo.hidden = false;
    }
  }

  function consentimientoAceptado() {
    try { return !!localStorage.getItem('tic-legal-consenso'); } catch (_) { return false; }
  }

  function premarcarConsentimiento() {
    const caja = document.getElementById('legal-consentir-check');
    if (caja && consentimientoAceptado()) caja.checked = true;
  }

  /* Se llama desde 11-auth.js tras un ingreso exitoso: deja constancia
     local (fecha) y escribe la aceptación en la cuenta de Firebase.
     Nunca lanza: un fallo del registro no puede impedir el acceso. */
  function guardarAceptacion(user) {
    try {
      const fecha = new Date().toISOString();
      localStorage.setItem('tic-legal-consenso', fecha);
      const caja = document.getElementById('legal-consentir-check');
      if (caja) caja.checked = true;
      const uid = user && user.uid;
      const db = window.FirebaseServices && window.FirebaseServices.database;
      if (!uid || !db) return;
      db.ref(`users/${uid}/legal`).update({
        aceptadoEn: fecha,
        documento: 'legal-v1-' + YEAR
      }).catch(() => { /* sin permiso o sin red: queda el registro local */ });
    } catch (_) { /* nunca bloquea el ingreso */ }
  }

  /* La tarjeta de acceso se vuelve a pintar entre visitas: si falta el
     pie o el consentimiento, se reinyectan. */
  function observarLogin() {
    try {
      if (!window.MutationObserver) return;
      const haceFalta = () => {
        const ancla = document.querySelector('.auth-panel') || document.querySelector('.auth-card');
        return !!ancla && (!ancla.querySelector('.legal-consentir') || !ancla.querySelector('.legal-pie'));
      };
      const observador = new MutationObserver(() => { if (haceFalta()) vincularLogin(); });
      observador.observe(document.body, { childList: true, subtree: true });
    } catch (_) { /* sin observador: queda el intento inicial */ }
  }

  /* ── Registro de la sección (todos los roles pueden verla) ─────────── */
  function init() {
    try {
      if (typeof Secciones !== 'undefined') {
        Secciones.registrar({
          id: 'legal',
          etiqueta: 'Legal & Privacidad',
          icono: 'ri-shield-user-line',
          grupo: 'Administración',
          orden: 130,
          roles: ['admin', 'docente', 'global', 'invitado'],
          render: typeof Secciones.desdeHTML === 'function'
            ? Secciones.desdeHTML(() => renderVista())
            : workspace => { workspace.innerHTML = renderVista(); }
        });
      }
    } catch (error) {
      console.warn('Legal · sección no registrada:', error && error.message);
    }
    vincularLogin();
    vigilarEnvio();
    observarLogin();
    document.addEventListener('keydown', evento => {
      if (evento.key === 'Escape') cerrarDocumento();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    EMPRESA, AUTOR, CONTACTO,
    renderVista, textoPrivacidad, textoCondiciones, textoPropiedad,
    abrirDocumento, cerrarDocumento, vincularLogin,
    consentimientoAceptado, guardarAceptacion
  };
})();
