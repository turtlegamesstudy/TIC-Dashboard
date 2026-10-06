'use strict';
/* ═══════════════════════════════════════════════════════════════
   PERMISOS POR ROL Y AJUSTES GLOBALES DEL EQUIPO
  ───────────────────────────────────────────────────────────────
   Antes la comprobación "¿es admin?" estaba repartida por cuatro
   archivos (el botón de cargar DB, la sección de administración,
   dos métodos de DataEngine...) y el botón de "＋ / −" del catálogo
   de módulos no comprobaba nada. Aquí vive TODO en una sola tabla:

     Permisos.ACCIONES  → qué puede hacer cada rol
     Permisos.puede()   → consulta
     Permisos.exigir()  → guarda dentro de la acción (defensa en profundidad)
     Permisos.aplicar() → oculta del DOM lo que el rol no debe ver
                          (elementos con [data-permiso="claveAccion"])

   Ajustes guarda preferencias de ESTE equipo en localStorage (no se
   sincronizan entre compañeros, cada uno configura su pantalla):
     tic-motion  → 'auto' (seguir al sistema) | 'on' | 'off'
     tic-sidebar → 'expandido' (etiquetas)    | 'iconos'
   ═══════════════════════════════════════════════════════════════ */

const Permisos = {
  /* Cada acción declara los roles que pueden realizarla. Una acción que
     no aparece en la tabla está permitida para todos. */
  ACCIONES: {
    gestionarUsuarios:    { roles: ['admin'], etiqueta: 'gestionar usuarios y roles' },
    cargarBase:           { roles: ['admin'], etiqueta: 'cargar una DB.json sobre la base compartida' },
    migrarAdjuntos:       { roles: ['admin'], etiqueta: 'migrar adjuntos antiguos' },
    cambiarCentro:        { roles: ['admin'], etiqueta: 'cambiar de centro tecnológico' },
    configurarMateria:    { roles: ['admin'], etiqueta: 'ampliar o recortar el catálogo de módulos del centro' },
    configurarInstitucion:{ roles: ['admin'], etiqueta: 'fijar responsables institucionales' },
    /* Permitidas a ambos roles: el trabajo diario del aula. */
    importarListado:      { roles: ['admin', 'docente'], etiqueta: 'importar listados y notas desde Excel' },
    editarRegistros:      { roles: ['admin', 'docente'], etiqueta: 'editar estudiantes y registros' },
    eliminarRegistros:    { roles: ['admin', 'docente'], etiqueta: 'eliminar estudiantes y registros' },
    exportarDocumentos:   { roles: ['admin', 'docente'], etiqueta: 'exportar e imprimir documentos' },
    descargarBase:        { roles: ['admin', 'docente'], etiqueta: 'descargar una copia de la base' }
  },

  rolesDe(accion) {
    const accion_ = this.ACCIONES[accion];
    return accion_ && Array.isArray(accion_.roles) ? accion_.roles.slice() : null;
  },

  /* Rol de la sesión abierta (vacío si aún no hay sesión). */
  rolActual() {
    if (typeof AuthManager !== 'undefined' && AuthManager && AuthManager.profile && AuthManager.profile.role) {
      return AuthManager.profile.role;
    }
    return '';
  },

  /* ¿Puede el rol (por defecto, el de la sesión) realizar la acción?
     Las acciones sin registrar en ACCIONES están permitidas a todos. */
  puede(accion, rol) {
    const roles = this.rolesDe(accion);
    if (!roles) return true;
    const actual = rol || this.rolActual();
    if (!actual) return false;
    return roles.includes(actual);
  },

  /* Guarda dentro de la función (no basta con ocultar el botón: una
     llamada directa desde la consola o un atajo deben frenarse igual). */
  exigir(accion, mensaje) {
    if (this.puede(accion)) return true;
    const texto = mensaje || this.motivoDenegacion(accion);
    if (typeof UI !== 'undefined' && UI && typeof UI.showToast === 'function') UI.showToast(texto);
    else if (typeof console !== 'undefined') console.warn(texto);
    return false;
  },

  motivoDenegacion(accion) {
    const accion_ = this.ACCIONES[accion];
    if (!accion_) return '🔒 Tu rol no puede realizar esta acción.';
    const soloAdmin = accion_.roles.length === 1 && accion_.roles[0] === 'admin';
    return soloAdmin
      ? '🔒 Solo un administrador puede ' + accion_.etiqueta + '.'
      : '🔒 Tu rol no puede ' + accion_.etiqueta + '.';
  },

  /* Resumen legible de un rol (se muestra en Administración y en el
     selector de rol para que nunca sea un misterio qué implica cada uno). */
  resumenRol(rol) {
    const permitidas = Object.entries(this.ACCIONES)
      .filter(([, def]) => Array.isArray(def.roles) && def.roles.includes(rol))
      .map(([, def]) => def.etiqueta);
    const rol_ = rol === 'admin' ? 'Administrador' : 'Docente';
    return permitidas.length
      ? `${rol_}: ${permitidas.join('; ')}.`
      : `${rol_}: sin permisos registrados.`;
  },

  /* Oculta del DOM lo que el rol no debe ver. Busca [data-permiso="..."]
     y lo marca con `hidden`. Devuelve cuántos nodos se ocultaron. */
  aplicar(raiz) {
    if (typeof document === 'undefined') return 0;
    const base = raiz || document;
    if (!base || typeof base.querySelectorAll !== 'function') return 0;
    let ocultos = 0;
    base.querySelectorAll('[data-permiso]').forEach(nodo => {
      const permitido = this.puede(nodo.getAttribute('data-permiso'));
      const oculto = !permitido;
      if (nodo.hidden !== oculto) nodo.hidden = oculto;
      if (oculto) ocultos++;
    });
    return ocultos;
  }
};

const Ajustes = {
  CLAVES: { movimiento: 'tic-motion', menu: 'tic-sidebar' },
  VALORES_MOVIMIENTO: ['auto', 'on', 'off'],
  VALORES_MENU: ['expandido', 'iconos'],

  _leer(clave, porDefecto) {
    try {
      const valor = localStorage.getItem(clave);
      return valor === null || valor === undefined || valor === '' ? porDefecto : valor;
    } catch (e) { return porDefecto; }
  },

  _escribir(clave, valor) {
    try {
      if (valor === null || valor === undefined) localStorage.removeItem(clave);
      else localStorage.setItem(clave, valor);
    } catch (e) { /* almacenamiento bloqueado: se queda en el valor por defecto */ }
  },

  /* ── ANIMACIONES ──
     'auto' (defecto) sigue a Windows/macOS; por eso a quien tiene el
     sistema con "mostrar animaciones" desactivado no le salen. Con 'on'
     el panel anima aunque el sistema diga que no (es el caso del autor
     del panel) y con 'off' no anima en ningún caso. */
  movimiento() {
    const valor = this._leer(this.CLAVES.movimiento, 'auto');
    return this.VALORES_MOVIMIENTO.includes(valor) ? valor : 'auto';
  },

  sistemaPideReducirMovimiento() {
    try {
      return Boolean(typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  },

  aplicarMovimiento() {
    if (typeof document === 'undefined') return this.movimiento();
    const valor = this.movimiento();
    const raiz = document.documentElement;
    if (valor === 'auto') raiz.removeAttribute('data-motion');
    else raiz.setAttribute('data-motion', valor);
    return valor;
  },

  ponerMovimiento(valor) {
    const elegido = this.VALORES_MOVIMIENTO.includes(valor) ? valor : 'auto';
    this._escribir(this.CLAVES.movimiento, elegido === 'auto' ? null : elegido);
    return this.aplicarMovimiento();
  },

  etiquetaMovimiento() {
    return { auto: 'Seguir el sistema', on: 'Activadas', off: 'Desactivadas' }[this.movimiento()] || 'Seguir el sistema';
  },

  notaMovimiento(valor) {
    const v = valor || this.movimiento();
    if (v === 'on') return 'Las animaciones se verán en este equipo aunque el sistema las tenga apagadas.';
    if (v === 'off') return 'Este equipo mostrará el panel sin animaciones.';
    return this.sistemaPideReducirMovimiento()
      ? 'Tu sistema tiene las animaciones desactivadas: por eso no ves ninguna. Elige «Activadas» para verlas.'
      : 'Sigue la configuración de animaciones de tu equipo.';
  },

  /* Si nadie ha elegido a mano, seguimos los cambios del sistema en vivo
     (p. ej. al activar el ahorro de batería). */
  vigilarSistema() {
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return false;
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (typeof mq.addEventListener !== 'function') return false;
      mq.addEventListener('change', () => { if (this.movimiento() === 'auto') this.aplicarMovimiento(); });
      return true;
    } catch (e) { return false; }
  },

  /* ── MENÚ LATERAL ──
     Se guarda para que el menú se vea IGUAL en todos los equipos y no
     cambie solo al redimensionar la ventana. */
  menu() {
    const valor = this._leer(this.CLAVES.menu, 'expandido');
    return this.VALORES_MENU.includes(valor) ? valor : 'expandido';
  },

  ponerMenu(valor) {
    const elegido = this.VALORES_MENU.includes(valor) ? valor : 'expandido';
    this._escribir(this.CLAVES.menu, elegido);
    return elegido;
  },

  /* Se llama una vez al arrancar (y vuelve a leer el localStorage si
     otra pestaña cambió las preferencias). */
  inicializar() {
    const aplicado = this.aplicarMovimiento();
    this.vigilarSistema();
    try {
      window.addEventListener('storage', (evento) => {
        if (evento && evento.key && Object.values(this.CLAVES).includes(evento.key)) {
          this.aplicarMovimiento();
          if (typeof UI !== 'undefined' && UI && typeof UI.aplicarMenuGuardado === 'function') UI.aplicarMenuGuardado();
        }
      });
    } catch (e) { /* sin eventos de storage (modo privado) */ }
    return aplicado;
  }
};
