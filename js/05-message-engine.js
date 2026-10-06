'use strict';
    /* ═══════════════════════════════════════════════════════════════
   MESSAGE ENGINE — Envío de Mensajes Inteligentes
   ═══════════════════════════════════════════════════════════════ */

const MessageEngine = {
  // Contraseña institucional por defecto
  CONTRASENA_DEFAULT: 'Inatec26*',

  // Plantillas de mensajes con placeholders dinámicos
  plantillas: [
    {
      id: 'credenciales',
      nombre: '🎓 Credenciales de Campus',
      icono: 'ri-key-2-line',
      descripcion: 'Envía usuario y contraseña del campus virtual. El usuario se genera automáticamente del correo.',
      camposExtra: [
        { 
          id: 'campus-pass', 
          label: 'Contraseña Temporal', 
          placeholder: 'ej: Inatec2026!',
          defaultValue: 'Inatec26*'  // Pre-llenado por defecto
        }
      ],
      generar: (est, extra) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        // Auto-generar usuario: correo sin extensión (@dominio)
        const usuarioCampus = est.correo ? est.correo.split('@')[0] : '';
        const pass = extra.pass || MessageEngine.CONTRASENA_DEFAULT;
        
        if (!usuarioCampus) return null; // No se puede generar sin correo
        
        return `*Centro Tecnológico Ariel Darce — INATEC*\n\nHola *${nombre}*,\n\nTe enviamos tus credenciales de acceso al *Campus Virtual*:\n\n👤 *Usuario:* ${usuarioCampus}\n🔒 *Contraseña:* ${pass}\n🔗 *Plataforma:* campus.tecnacional.edu.ni\n\n⚠️ *Importante:* Cambia tu contraseña al ingresar por primera vez.\n\nSi tienes problemas, responde este mensaje.\n\n*Docente TIC*\nHanzell Mayorga`;
      }
    },
    {
      id: 'avance-modulos',
      nombre: '📚 Recordatorio de Avance',
      icono: 'ri-book-open-line',
      descripcion: 'Detecta automáticamente módulos sin notas o con promedio < 60.',
      camposExtra: [],
      generar: (est) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        const pendientes = [];
        const modulos = [
          "Historia e Identidad Nacional",
          "Adaptación al Cambio Climático",
          "Orientación Laboral",
          "Cultura de Paz",
          "Identidad Histórica y Sociocultural de Nicaragua"
        ];
        
        modulos.forEach(mod => {
          if (est.convalidaciones && est.convalidaciones[mod]) return;
          if (est.estado === 'Retirado') return;
          const modData = est.evaluacionesPorModulo?.[mod];
          let tieneNotas = false;
          let promedio = 0;
          if (modData) {
            const notasObj = modData.notas || modData.evaluaciones;
            if (notasObj) {
              const vals = Object.values(notasObj).filter(v => typeof v === 'number' && !isNaN(v));
              if (vals.length > 0) {
                tieneNotas = true;
                promedio = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
              }
            }
          }
          if (!tieneNotas) pendientes.push({mod, estado: '❌ Sin notas'});
          else if (promedio < 60) pendientes.push({mod, estado: `⚠️ Promedio ${promedio}`});
        });

        if (pendientes.length === 0) {
          return `*Centro Tecnológico Ariel Darce — INATEC*\n\n¡Hola *${nombre}*! 👋\n\n✅ *Excelente noticia:* Tienes todos tus módulos transversales al día. ¡Sigue así!\n\n*Docente TIC*\nHanzell Mayorga`;
        }

        let msg = `*Centro Tecnológico Ariel Darce — INATEC*\n\nHola *${nombre}*,\n\nTe contacto porque detectamos módulos que necesitan atención:\n\n`;
        pendientes.forEach((p, i) => {
          msg += `${i+1}. *${p.mod}*\n   ${p.estado}\n\n`;
        });
        msg += `📝 *Acción requerida:* Ingresa al campus y completa los cuestionarios pendientes lo antes posible.\n\n¿Necesitas ayuda? Responde este mensaje.\n\n*Docente TIC*\nHanzell Mayorga`;
        return msg;
      }
    },
    {
      id: 'cuestionarios-pendientes',
      nombre: '⏰ Cuestionarios Pendientes',
      icono: 'ri-time-line',
      descripcion: 'Recordatorio específico para cuestionarios sin resolver.',
      camposExtra: [
        { id: 'fecha-limite', label: 'Fecha Límite (opcional)', placeholder: 'ej: 30 de agosto' }
      ],
      generar: (est, extra) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        const modulos = [
          "Historia e Identidad Nacional",
          "Adaptación al Cambio Climático",
          "Orientación Laboral",
          "Cultura de Paz",
          "Identidad Histórica y Sociocultural de Nicaragua"
        ];
        const sinNotas = [];
        modulos.forEach(mod => {
          if (est.convalidaciones?.[mod]) return;
          const modData = est.evaluacionesPorModulo?.[mod];
          const notasObj = modData?.notas || modData?.evaluaciones;
          const tieneNotas = notasObj && Object.values(notasObj).some(v => typeof v === 'number' && !isNaN(v));
          if (!tieneNotas) sinNotas.push(mod);
        });

        let msg = `*Centro Tecnológico Ariel Darce — INATEC*\n\nHola *${nombre}*,\n\n`;
        if (sinNotas.length > 0) {
          msg += `Tienes *cuestionarios pendientes* en los siguientes módulos:\n\n`;
          sinNotas.forEach((m, i) => msg += `${i+1}. ${m}\n`);
          msg += `\n🔗 Ingresa a: campus.tecnacional.edu.ni\n`;
          if (extra.fecha) msg += `📅 Fecha límite: *${extra.fecha}*\n`;
          msg += `\n⚠️ Recuerda que estos cuestionarios afectan tu promedio final.\n`;
        } else {
          msg += `✅ ¡Todos tus cuestionarios están resueltos! Excelente trabajo.\n`;
        }
        msg += `\n*Docente TIC*\nHanzell Mayorga`;
        return msg;
      }
    },
    {
      id: 'convalidacion',
      nombre: '🏆 Notificación de Convalidación',
      icono: 'ri-award-line',
      descripcion: 'Informa al estudiante que un módulo fue convalidado.',
      camposExtra: [],
      generar: (est) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        const convals = est.convalidaciones ? Object.keys(est.convalidaciones).filter(k => est.convalidaciones[k]) : [];
        if (convals.length === 0) return null;
        return `*Centro Tecnológico Ariel Darce — INATEC*\n\nHola *${nombre}*,\n\n✅ *Buenas noticias:* Se ha registrado la convalidación de los siguientes módulos:\n\n${convals.map((c,i) => `${i+1}. *${c}*`).join('\n')}\n\n📋 Estado: *APROBADO POR CONVALIDACIÓN*\n\nNo necesitas presentar evaluaciones en estos módulos.\n\n*Docente TIC*\nHanzell Mayorga`;
      }
    },
    {
      id: 'bienvenida',
      nombre: '👋 Bienvenida al Grupo',
      icono: 'ri-emotion-happy-line',
      descripcion: 'Mensaje de bienvenida con datos del grupo.',
      camposExtra: [],
      generar: (est, extra, grupo) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        return `*Centro Tecnológico Ariel Darce — INATEC*\n\n¡Hola *${nombre}*! 👋\n\nBienvenido(a) al grupo *${grupo?.nombre || 'TIC'}* — *${grupo?.carrera || 'Técnico General'}*.\n\nSoy *Hanzell Mayorga*, tu docente de TIC. Cualquier duda sobre el campus virtual, cuestionarios o convalidaciones, puedes escribirme por aquí.\n\n📌 *Datos importantes:*\n• Grupo: ${grupo?.nombre || 'N/A'}\n• Turno: ${grupo?.turno || 'General'}\n• Correo institucional: ${est.correo}\n\n¡Éxitos en este ciclo académico! 🎓\n\n*Docente TIC*\nHanzell Mayorga`;
      }
    },
    {
      id: 'examen-reparacion',
      nombre: '📝 Examen / Reparación',
      icono: 'ri-file-edit-line',
      descripcion: 'Notifica sobre exámenes de reparación o recuperación.',
      camposExtra: [
        { id: 'exam-fecha', label: 'Fecha del Examen', placeholder: 'ej: 15 de agosto, 8:00 AM' },
        { id: 'exam-lugar', label: 'Lugar / Enlace', placeholder: 'ej: Aula 305 o Zoom' },
        { id: 'exam-modulo', label: 'Módulo', placeholder: 'ej: Historia e Identidad Nacional' }
      ],
      generar: (est, extra) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        return `*Centro Tecnológico Ariel Darce — INATEC*\n\nHola *${nombre}*,\n\n📢 *Notificación de Examen de Reparación*\n\nMódulo: *${extra.modulo || 'Pendiente de definir'}*\n📅 Fecha: *${extra.fecha || 'Por confirmar'}*\n📍 Lugar/Enlace: *${extra.lugar || 'Por confirmar'}*\n\n⚠️ *Requisito:* Traer carnet estudiantil y llegar 15 min antes.\n\n¿Dudas? Responde este mensaje.\n\n*Docente TIC*\nHanzell Mayorga`;
      }
    },
    {
      id: 'aviso-notas-plazo',
      nombre: '📊 Aviso General de Notas + Plazo',
      icono: 'ri-alarm-warning-line',
      descripcion: 'Mensaje genérico para cualquier grupo: avisa que las notas ya están disponibles y da un plazo límite para revisarlas.',
      camposExtra: [
        { id: 'fecha-limite', label: 'Fecha Límite', placeholder: 'ej: viernes 15 de agosto' }
      ],
      generar: (est, extra, grupo) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        const fechaLimite = extra.fecha || 'la fecha indicada por el docente';
        return `*Centro Tecnológico Ariel Darce — INATEC*\n\nHola *${nombre}*,\n\n📊 Te comparto tus *notas actuales* del grupo *${grupo?.nombre || 'TIC'}*. Por favor ingresa al campus virtual y revísalas con calma.\n\n🔗 campus.tecnacional.edu.ni\n\n⏰ *Tienes plazo hasta el ${fechaLimite}* para revisar tus calificaciones, resolver cuestionarios pendientes o notificarme cualquier inconsistencia.\n\n⚠️ Pasada esa fecha, las notas quedan cerradas tal como están registradas — lo que no se haya completado a tiempo, no podrá modificarse después.\n\nCualquier duda, respóndeme por este medio antes del plazo.\n\n*Docente TIC*\nHanzell Mayorga`;
      }
    },
    {
      id: 'equipo-aviso',
      nombre: '🏆 Aviso a Equipo Innovatec/Hackathon',
      icono: 'ri-trophy-line',
      descripcion: 'Mensaje exclusivo para los integrantes del equipo seleccionado (fecha, lugar y entregable).',
      camposExtra: [
        { id: 'eq-fecha', label: 'Fecha / Hora', placeholder: 'ej: 20 de septiembre, 9:00 AM' },
        { id: 'eq-lugar', label: 'Lugar / Enlace', placeholder: 'ej: Auditorio Central o Meet' },
        { id: 'eq-detalle', label: 'Detalle / Entregable', placeholder: 'ej: Traer prototipo funcional y presentación', type: 'textarea' }
      ],
      generar: (est, extra, grupo) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        return `*Centro Tecnológico Ariel Darce — INATEC*\n\nHola *${nombre}*,\n\n🏆 *Aviso para el equipo "${grupo?.nombre || 'Innovatec/Hackathon'}"*\nProyecto: *${grupo?.turno || 'N/A'}*\n\n📅 Fecha: *${extra.fecha || 'Por confirmar'}*\n📍 Lugar/Enlace: *${extra.lugar || 'Por confirmar'}*\n\n${extra.detalle ? `📝 ${extra.detalle}\n\n` : ''}¡Éxitos, equipo! 💪\n\n*Docente TIC*\nHanzell Mayorga`;
      }
    },
    {
      id: 'invitacion-grupo-wa',
      nombre: '💬 Invitación al Grupo de WhatsApp',
      icono: 'ri-whatsapp-line',
      descripcion: 'Invita al estudiante al grupo de WhatsApp con un enlace que puedes cambiar.',
      camposExtra: [
        { id: 'wa-link', label: 'Enlace de invitación (cámbialo aquí)', placeholder: 'https://chat.whatsapp.com/...' },
        { id: 'wa-nota', label: 'Aviso adicional (opcional)', placeholder: 'ej: Primera clase virtual el lunes 7:00 AM' }
      ],
      generar: (est, extra, grupo) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        const link = String(extra.link || '').trim();
        const aviso = String(extra.aviso || '').trim();
        return `*{CENTRO}*\n\nHola *${nombre}*! 👋\n\n📲 *Te invito a unirte al grupo de WhatsApp* del grupo *${grupo?.nombre || 'TIC'}* — *${grupo?.carrera || 'Técnico General'}*.\n\nAllí se publican los avisos, las fechas de cuestionarios, las notas y cualquier cambio de horario.\n\n🔗 *Enlace de invitación:*\n${link || 'https://chat.whatsapp.com/...'}\n\n📌 *Datos del grupo:*\n• Grupo: ${grupo?.nombre || 'N/A'}\n• Turno: ${grupo?.turno || 'General'}\n• Docente: {DOCENTE}\n\n${aviso ? `📢 *Aviso:* ${aviso}\n\n` : ''}Si tienes dudas antes de entrar, escríbeme por aquí. ¡Te esperamos! 🎓\n\n*Docente TIC*\n{DOCENTE}`;
      }
    },
    {
      id: 'personalizado',
      nombre: '✏️ Mensaje Personalizado',
      icono: 'ri-chat-3-line',
      descripcion: 'Escribe tu propio mensaje con variables dinámicas.',
      camposExtra: [
        { id: 'msg-personalizado', label: 'Tu Mensaje', placeholder: 'Usa {{nombre}}, {{correo}}, {{grupo}}, {{turno}}, {{equipo}}, {{proyecto}}', type: 'textarea' }
      ],
      generar: (est, extra, grupo) => {
        const nombre = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]}`;
        let msg = extra.mensaje || '';
        msg = msg.replace(/{{nombre}}/gi, nombre);
        msg = msg.replace(/{{nombres}}/gi, est.nombres);
        msg = msg.replace(/{{apellidos}}/gi, est.apellidos);
        msg = msg.replace(/{{correo}}/gi, est.correo);
        msg = msg.replace(/{{telefono}}/gi, est.telefono);
        msg = msg.replace(/{{grupo}}/gi, grupo?.nombre || 'N/A');
        msg = msg.replace(/{{turno}}/gi, grupo?.turno || 'General');
        msg = msg.replace(/{{carrera}}/gi, grupo?.carrera || 'N/A');
        msg = msg.replace(/{{equipo}}/gi, grupo?.nombre || 'N/A');
        msg = msg.replace(/{{proyecto}}/gi, grupo?.turno || 'N/A');
        msg = msg.replace(/{{estado}}/gi, est.estado);
        return `*Centro Tecnológico Ariel Darce — INATEC*\n\n${msg}\n\n*Docente TIC*\nHanzell Mayorga`;
      }
    }
  ],

  estudianteSeleccionado: null,
  grupoSeleccionado: null,
  equipoSeleccionado: null, // [NUEVO] Equipo Innovatec/Hackathon cuando se envían mensajes solo a un equipo
  plantillaActual: null,
  enviados: new Set(),   // estudiantes cuyo WhatsApp ya se abrió en este grupo
  memoriaExtras: {},     // valores escritos por el docente (enlace, fechas, textos…)
  LOTE: 5,               // cuántos mensajes abre de golpe el botón "Ir con próximos 5"

  // ── Centro real (AuthManager) y docente real (sesión) ─────────────
  centroTitulo() {
    let nombre = '';
    try {
      if (typeof AuthManager !== 'undefined' && typeof AuthManager.getActiveCenterName === 'function') {
        nombre = AuthManager.getActiveCenterName();
      }
    } catch (e) { nombre = ''; }
    nombre = String(nombre || '').trim();
    if (!nombre || nombre === 'Centro asignado') nombre = 'Centro Tecnológico Ariel Darce';
    return /INATEC/i.test(nombre) ? nombre : `${nombre} — INATEC`;
  },

  nombreDocente() {
    try {
      if (typeof AuthManager !== 'undefined') {
        const sp = AuthManager.staffProfile;
        const pf = AuthManager.profile;
        const us = AuthManager.user;
        const nombre = [sp?.firstName, sp?.lastName].filter(Boolean).join(' ').trim()
          || String(pf?.displayName || '').trim()
          || [pf?.firstName, pf?.lastName].filter(Boolean).join(' ').trim()
          || String(us?.displayName || '').trim();
        if (nombre) return nombre;
      }
    } catch (e) { /* sin sesión */ }
    return 'Docente TIC';
  },

  // Encabezado y firma de cualquier plantilla con datos reales
  personalizar(txt) {
    if (typeof txt !== 'string' || !txt) return txt;
    const centro = this.centroTitulo();
    const docente = this.nombreDocente();
    return txt
      .replace(/\{CENTRO\}/g, centro)
      .replace(/\{DOCENTE\}/g, docente)
      .replace(/\*?Centro Tecnológico Ariel Darce(\s*—\s*INATEC)?\*/g, `*${centro}*`)
      .replace(/Hanzell Mayorga/g, docente);
  },

  // Única vía de generar mensajes (preview, copia y envío comparten texto)
  generarMensaje(est, extra) {
    if (!this.plantillaActual) return null;
    const msg = this.plantillaActual.generar(est, extra, this.grupoParaPlantilla());
    return (msg === null || msg === undefined) ? null : this.personalizar(String(msg));
  },

  // Lee los campos extra del formulario
  leerExtras() {
    const extra = {};
    (this.plantillaActual?.camposExtra || []).forEach(c => {
      const el = document.getElementById(`extra-${c.id}`);
      extra[c.id] = el ? String(el.value) : (c.defaultValue || '');
    });
    return {
      user: extra['campus-user'], pass: extra['campus-pass'],
      fecha: extra['fecha-limite'] || extra['exam-fecha'] || extra['eq-fecha'],
      lugar: extra['exam-lugar'] || extra['eq-lugar'],
      modulo: extra['exam-modulo'],
      detalle: extra['eq-detalle'],
      mensaje: extra['msg-personalizado'],
      link: extra['wa-link'],
      aviso: extra['wa-nota']
    };
  },

  // Guarda lo escrito antes de volver a pintar los campos (el enlace no se pierde)
  _guardarExtras() {
    document.querySelectorAll('#msg-campos-extra [id^="extra-"]').forEach(el => {
      this.memoriaExtras[el.id.replace(/^extra-/, '')] = String(el.value);
    });
  },

  _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  normalizarTelefono(tel) {
    let num = String(tel || '').replace(/\D/g, '');
    // Nicaragua: celulares empiezan con 8 y tienen 8 dígitos
    if (num.length === 8 && num.startsWith('8')) {
      num = '505' + num;
    }
    // Si ya tiene 11 dígitos y empieza con 505
    else if (num.length === 11 && num.startsWith('505')) {
      // ya está bien formateado
    }
    // Si tiene 8 dígitos pero no empieza con 8 (número fijo u otro)
    else if (num.length === 8 && !num.startsWith('505')) {
      num = '505' + num;
    }
    // Si tiene 9 dígitos y empieza con 5 (ya tiene indicativo sin 505)
    else if (num.length === 9 && num.startsWith('5')) {
      num = '505' + num.substring(1);
    }
    return num;
  },

  renderVistaMensajes() {
    const grupos = DataEngine.getGrupos();
    const equipos = DataEngine.getEquipos();
    return `
      <div class="module-fade-enter">
        <div class="view-header">
          <h1><i class="ri-send-plane-fill"></i> Envío de Mensajes</h1>
          <p>Envía mensajes estructurados por WhatsApp usando los datos ya cargados en el sistema.</p>
        </div>

        <div class="group-header-card" data-section-settings data-settings-title="Grupo, destinatarios y selección" style="display: flex; gap: 16px;">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <label class="tb-label"><i class="ri-group-line"></i> Grupo:</label>
              <select id="msg-select-grupo" class="form-control" style="width: 260px;" onchange="MessageEngine.cambiarGrupo()">
                <option value="">-- Seleccionar Grupo --</option>
                <optgroup label="Grupos de Clase">
                  ${grupos.map(g => `<option value="${g.id}">${g.codigo || g.nombre} — ${g.carrera} (${g.turno})</option>`).join('')}
                </optgroup>
                ${equipos.length > 0 ? `
                <optgroup label="🏆 Equipos Innovatec / Hackathon">
                  ${equipos.map(eq => `<option value="EQUIPO:${eq.id}">${eq.nombreEquipo} — ${eq.categoria}</option>`).join('')}
                </optgroup>` : ''}
              </select>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <label class="tb-label"><i class="ri-filter-3-line"></i> Filtro:</label>
              <select id="msg-select-filtro" class="form-control" style="width: 180px;" onchange="MessageEngine.filtrarEstudiantes()">
                <option value="todos">Todos los estudiantes</option>
                <option value="activos">Solo Activos</option>
                <option value="retirados">Solo Retirados</option>
                <option value="sin-notas">Con módulos sin notas</option>
                <option value="convalidados">Con convalidaciones</option>
              </select>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-primary-soft" onclick="MessageEngine.seleccionarTodos()"><i class="ri-check-double-line"></i> Seleccionar Todos</button>
            <button class="btn-secondary" onclick="MessageEngine.limpiarSeleccion()"><i class="ri-close-line"></i> Limpiar</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 24px;">
          <!-- PANEL IZQUIERDO: Lista de estudiantes -->
          <div class="table-container" style="max-height: 65vh; overflow-y: auto;">
            <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-default); font-weight: 600; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
              <span><i class="ri-user-search-line" style="color: var(--p-400);"></i> Estudiantes</span>
              <span id="msg-contador" style="font-size: 0.75rem; color: var(--text-muted);">0 seleccionados</span>
            </div>
            <div id="msg-lista-estudiantes" style="padding: 8px;">
              <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="ri-arrow-up-line" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>
                Selecciona un grupo para ver los estudiantes.
              </div>
            </div>
          </div>

          <!-- PANEL DERECHO: Plantillas y preview -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            
            <!-- Selector de plantilla -->
            <div class="group-header-card" style="margin-bottom: 0;">
              <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 10px;"><i class="ri-mail-star-line"></i> Tipo de Mensaje:</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;" id="msg-plantillas-grid">
                ${MessageEngine.plantillas.map(p => `
                  <button class="btn-plantilla" onclick="MessageEngine.seleccionarPlantilla('${p.id}')" id="btn-plantilla-${p.id}">
                    <i class="${p.icono}"></i>
                    <div>
                      <div style="font-weight: 600; font-size: 0.82rem;">${p.nombre}</div>
                      <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 400;">${p.descripcion}</div>
                    </div>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Campos extra dinámicos -->
            <div id="msg-campos-extra" style="display: none;" class="group-header-card" style="margin-bottom: 0; padding: 16px;"></div>

            <!-- Preview del mensaje -->
            <div class="table-container" style="flex: 1; display: flex; flex-direction: column;">
              <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-default); font-weight: 600; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="display:flex; flex-direction:column; line-height:1.3;">
                  <span><i class="ri-whatsapp-line" style="color: #25D366;"></i> Vista Previa</span>
                  <span style="font-size:0.68rem; font-weight:500; color:var(--text-muted);">${MessageEngine.centroTitulo()} · ${MessageEngine.nombreDocente()}</span>
                </span>
                <span id="msg-preview-estado" style="font-size: 0.75rem; color: var(--text-muted);">Selecciona un estudiante</span>
              </div>
              <div style="flex: 1; padding: 16px; background: #0b141a; border-radius: 0 0 var(--r-xl) var(--r-xl); position: relative;">
                <div id="msg-bubble-preview" style="background: #005c4b; color: #e9edef; padding: 12px 14px; border-radius: 8px; font-size: 0.85rem; line-height: 1.5; max-width: 90%; white-space: pre-wrap; font-family: inherit; display: none;">
                </div>
                <div id="msg-bubble-empty" style="text-align: center; color: var(--text-muted); padding-top: 40px;">
                  <i class="ri-chat-smile-2-line" style="font-size: 2.5rem; display: block; margin-bottom: 10px; opacity: 0.5;"></i>
                  <p>Selecciona una plantilla y un estudiante<br>para ver el mensaje generado.</p>
                </div>
              </div>
            </div>

            <!-- Acciones -->
            <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
              <span id="msg-cola-info" style="font-size: 0.75rem; color: var(--text-muted); margin-right: auto;"><i class="ri-list-check-2"></i> Selecciona una plantilla para armar la cola</span>
              <button class="btn-secondary" onclick="MessageEngine.copiarMensaje()"><i class="ri-file-copy-line"></i> Copiar Texto</button>
              <button class="btn-secondary" id="btn-enviar-wa" onclick="MessageEngine.abrirWhatsApp()" disabled><i class="ri-whatsapp-fill"></i> Abrir WhatsApp (todos)</button>
              <button class="btn-primary" id="btn-siguientes-5" onclick="MessageEngine.abrirSiguientesCinco()" disabled style="background: linear-gradient(135deg, #25D366, #128C7E);">
                <i class="ri-skip-forward-line"></i> Ir con próximos 5
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>
        .btn-plantilla {
          display: flex; align-items: center; gap: 10px;
          padding: 12px; border-radius: var(--r-lg);
          background: var(--bg-elevated);
          border: 1.5px solid var(--border-default);
          color: var(--text-primary);
          cursor: pointer; text-align: left;
          transition: all 0.2s;
        }
        .btn-plantilla:hover {
          border-color: var(--p-500);
          background: linear-gradient(135deg, rgba(20,87,139,0.1), rgba(225,11,123,0.05));
          transform: translateY(-1px);
        }
        .btn-plantilla.active {
          border-color: var(--p-500);
          background: linear-gradient(135deg, rgba(20,87,139,0.15), rgba(225,11,123,0.1));
          box-shadow: 0 0 15px rgba(20,87,139,0.15);
        }
        .btn-plantilla i { font-size: 1.3rem; color: var(--p-400); }
        .msg-estudiante-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: var(--r-md);
          cursor: pointer; transition: all 0.15s;
          border: 1.5px solid transparent;
        }
        .msg-estudiante-item:hover { background: var(--bg-hover); }
        .msg-estudiante-item.selected {
          background: linear-gradient(90deg, rgba(20,87,139,0.12), rgba(225,11,123,0.06));
          border-color: rgba(20,87,139,0.3);
        }
        .msg-estudiante-item input[type="checkbox"] {
          width: 18px; height: 18px; accent-color: var(--p-500);
        }
        .msg-avatar-mini {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, var(--p-500), var(--neon-purple));
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.8rem; flex-shrink: 0;
        }
        .msg-est-info { flex: 1; min-width: 0; }
        .msg-est-nombre { font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .msg-est-meta { font-size: 0.72rem; color: var(--text-muted); }
        .msg-est-telefono { font-size: 0.72rem; color: var(--neon-green); font-family: var(--font-mono); }
        .msg-check-enviado { color: #25D366; font-size: 1.05rem; flex-shrink: 0; display: flex; align-items: center; }
        .msg-estudiante-item.enviado { opacity: 0.72; border-color: rgba(37,211,102,0.35); background: rgba(37,211,102,0.07); }
        .msg-estudiante-item.enviado .msg-est-telefono { color: #25D366; }
        #btn-siguientes-5:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
      </style>
    `;
  },

  cambiarGrupo() {
    const val = document.getElementById('msg-select-grupo')?.value;
    // Cada grupo arranca su propia cola de envío
    this.enviados = new Set();
    if (val && val.startsWith('EQUIPO:')) {
      const eqId = val.split(':')[1];
      this.equipoSeleccionado = DataEngine.getEquipoById(eqId) || null;
      this.grupoSeleccionado = null;
    } else {
      this.grupoSeleccionado = val ? DataEngine.getGrupoById(val) : null;
      this.equipoSeleccionado = null;
    }
    this.filtrarEstudiantes();
  },

  // [NUEVO] Devuelve la lista de "estudiantes" a mostrar/enviar: si hay un
  // equipo Innovatec/Hackathon seleccionado, solo sus integrantes; si no,
  // los estudiantes del grupo de clase seleccionado.
  getListaActual() {
    if (this.equipoSeleccionado) {
      return (this.equipoSeleccionado.integrantes || []).map(i => ({
        id: i.id, nombres: i.nombres, apellidos: i.apellidos,
        correo: i.correo, telefono: i.telefono, estado: 'Activo', rol: i.rol
      }));
    }
    const grupoId = document.getElementById('msg-select-grupo')?.value;
    return DataEngine.getEstudiantesByGrupo(grupoId);
  },

  // [NUEVO] Objeto tipo "grupo" que reciben las plantillas: si se envía a un
  // equipo, se usa el nombre/proyecto del equipo en vez del grupo de clase.
  grupoParaPlantilla() {
    if (this.equipoSeleccionado) {
      return {
        nombre: this.equipoSeleccionado.nombreEquipo,
        carrera: this.equipoSeleccionado.categoria,
        turno: this.equipoSeleccionado.nombreProyecto
      };
    }
    return this.grupoSeleccionado;
  },

  filtrarEstudiantes() {
    this._pintarLista();
    this.actualizarContador();
  },

  _pintarLista() {
    const val = document.getElementById('msg-select-grupo')?.value;
    const filtro = document.getElementById('msg-select-filtro')?.value;
    const contenedor = document.getElementById('msg-lista-estudiantes');
    if (!val) {
      contenedor.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="ri-arrow-up-line" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>Selecciona un grupo para ver los estudiantes.</div>`;
      return;
    }

    let estudiantes = this.getListaActual();

    if (this.equipoSeleccionado) {
      if (estudiantes.length === 0) {
        contenedor.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="ri-inbox-line" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>Este equipo aún no tiene integrantes registrados.</div>`;
        return;
      }
      contenedor.innerHTML = estudiantes.map(e => this._renderItemEstudiante(e)).join('');
      return;
    }

    if (filtro === 'activos') estudiantes = estudiantes.filter(e => e.estado === 'Activo');
    if (filtro === 'retirados') estudiantes = estudiantes.filter(e => e.estado === 'Retirado');
    if (filtro === 'sin-notas') {
      estudiantes = estudiantes.filter(e => {
        if (e.estado === 'Retirado') return false;
        const modulos = ["Historia e Identidad Nacional","Adaptación al Cambio Climático","Orientación Laboral","Cultura de Paz","Identidad Histórica y Sociocultural de Nicaragua"];
        return modulos.some(m => {
          if (e.convalidaciones?.[m]) return false;
          const modData = e.evaluacionesPorModulo?.[m];
          const notasObj = modData?.notas || modData?.evaluaciones;
          return !notasObj || !Object.values(notasObj).some(v => typeof v === 'number' && !isNaN(v));
        });
      });
    }
    if (filtro === 'convalidados') {
      estudiantes = estudiantes.filter(e => e.convalidaciones && Object.keys(e.convalidaciones).length > 0);
    }

    if (estudiantes.length === 0) {
      contenedor.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="ri-inbox-line" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>No hay estudiantes con este filtro.</div>`;
      return;
    }

    contenedor.innerHTML = estudiantes.map(e => this._renderItemEstudiante(e)).join('');
  },

  // [NUEVO] Extraído para reutilizarse tanto con estudiantes de un grupo
  // como con integrantes de un equipo Innovatec/Hackathon.
  _renderItemEstudiante(e) {
    const iniciales = `${e.nombres?.[0]||''}${e.apellidos?.[0]||''}`.toUpperCase();
    const tel = this.normalizarTelefono(e.telefono);
    const enviado = this.enviados.has(e.id);
    return `
        <div class="msg-estudiante-item${enviado ? ' enviado' : ''}" onclick="MessageEngine.toggleEstudiante('${e.id}', this)" id="msg-item-${e.id}" data-id="${e.id}">
          <input type="checkbox" id="chk-${e.id}" onchange="event.stopPropagation(); MessageEngine.toggleEstudiante('${e.id}')" style="cursor: pointer;">
          <div class="msg-avatar-mini">${iniciales}</div>
          <div class="msg-est-info">
            <div class="msg-est-nombre">${e.nombres} ${e.apellidos}</div>
            <div class="msg-est-meta">${e.estado}${e.rol ? ' • ' + e.rol : ''} • ${e.correo}</div>
          </div>
          <div class="msg-est-telefono">${tel ? '+' + tel : 'Sin teléfono'}</div>
          ${enviado ? '<span class="msg-check-enviado" title="Ya se abrió su WhatsApp"><i class="ri-check-double-line"></i></span>' : ''}
        </div>
      `;
  },

  toggleEstudiante(estId, el) {
    const checkbox = document.getElementById(`chk-${estId}`);
    const item = el || document.getElementById(`msg-item-${estId}`);
    if (!item) return;
    
    const isSelected = item.classList.contains('selected');
    if (isSelected) {
      item.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
      if (this.estudianteSeleccionado?.id === estId) {
        this.estudianteSeleccionado = null;
      }
    } else {
      // Deseleccionar otros si solo queremos uno a la vez para preview
      document.querySelectorAll('.msg-estudiante-item.selected').forEach(s => {
        s.classList.remove('selected');
        const sid = s.getAttribute('data-id');
        const schk = document.getElementById(`chk-${sid}`);
        if (schk) schk.checked = false;
      });
      item.classList.add('selected');
      if (checkbox) checkbox.checked = true;
      const est = this.getListaActual().find(e => e.id === estId);
      this.estudianteSeleccionado = est;
      this.generarPreview();
    }
    this.actualizarContador();
  },

  seleccionarTodos() {
    document.querySelectorAll('.msg-estudiante-item').forEach(item => {
      item.classList.add('selected');
      const id = item.getAttribute('data-id');
      const chk = document.getElementById(`chk-${id}`);
      if (chk) chk.checked = true;
    });
    this.actualizarContador();
  },

  limpiarSeleccion() {
    document.querySelectorAll('.msg-estudiante-item.selected').forEach(item => {
      item.classList.remove('selected');
      const id = item.getAttribute('data-id');
      const chk = document.getElementById(`chk-${id}`);
      if (chk) chk.checked = false;
    });
    this.estudianteSeleccionado = null;
    this.actualizarContador();
    this.generarPreview();
  },

  actualizarContador() {
    const count = document.querySelectorAll('.msg-estudiante-item.selected').length;
    const el = document.getElementById('msg-contador');
    if (el) el.textContent = `${count} seleccionado${count !== 1 ? 's' : ''}`;
    const btn = document.getElementById('btn-enviar-wa');
    if (btn) btn.disabled = count === 0 || !this.plantillaActual;

    // Cola "Ir con próximos 5"
    const btnLote = document.getElementById('btn-siguientes-5');
    const info = document.getElementById('msg-cola-info');
    const haySeleccion = document.querySelectorAll('.msg-estudiante-item.selected').length > 0;
    const pendientes = this.plantillaActual ? this.colaPendiente() : [];
    if (btnLote) btnLote.disabled = pendientes.length === 0;
    if (info) {
      info.innerHTML = !this.plantillaActual
        ? `<i class="ri-mail-star-line"></i> Elige un tipo de mensaje para armar la cola`
        : pendientes.length === 0
          ? (this.enviados.size > 0
              ? `<i class="ri-checkbox-circle-fill" style="color:#25D366;"></i> Cola terminada · ${this.enviados.size} mensaje(s) abiertos`
              : `<i class="ri-list-check-2"></i> Sin mensajes pendientes`)
          : `<i class="ri-list-check-2"></i> Quedan ${pendientes.length} por enviar${haySeleccion ? ' en tu selección' : ' en la lista visible'}${this.enviados.size ? ` · ${this.enviados.size} ya abiertos` : ''}`;
    }
  },

  // Orden de la cola: los seleccionados (si los hay) o toda la lista visible,
  // sin los que ya se abrieron ni los que no tienen teléfono.
  colaPendiente() {
    let lista = [];
    try { lista = this.getListaActual() || []; } catch (e) { lista = []; }
    const items = Array.from(document.querySelectorAll('#msg-lista-estudiantes .msg-estudiante-item'));
    const seleccionados = items.filter(i => i.classList.contains('selected'));
    const base = seleccionados.length > 0 ? seleccionados : items;
    return base.filter(i => {
      if (i.classList.contains('enviado')) return false;
      const est = lista.find(e => e.id === i.getAttribute('data-id'));
      return est ? !!this.normalizarTelefono(est.telefono) : false;
    });
  },

  // Marca en la lista a los que ya se les abrió WhatsApp
  pintarEnviados() {
    document.querySelectorAll('#msg-lista-estudiantes .msg-estudiante-item').forEach(item => {
      const enviado = this.enviados.has(item.getAttribute('data-id'));
      item.classList.toggle('enviado', enviado);
      const badge = item.querySelector('.msg-check-enviado');
      if (enviado && !badge) {
        const span = document.createElement('span');
        span.className = 'msg-check-enviado';
        span.title = 'Ya se abrió su WhatsApp';
        span.innerHTML = '<i class="ri-check-double-line"></i>';
        item.appendChild(span);
      } else if (!enviado && badge) {
        badge.remove();
      }
    });
  },

  // Botón principal: abre WhatsApp con los próximos 5 mensajes de la cola
  abrirSiguientesCinco() {
    if (!this.plantillaActual) { UI.showToast('⚠️ Selecciona un tipo de mensaje.'); return; }
    const pendientes = this.colaPendiente();
    if (pendientes.length === 0) { UI.showToast('✅ No quedan mensajes pendientes en esta lista.'); return; }

    const lista = this.getListaActual();
    const extraAdaptado = this.leerExtras();
    let abiertos = 0;

    pendientes.slice(0, this.LOTE).forEach(item => {
      const est = lista.find(e => e.id === item.getAttribute('data-id'));
      if (!est) return;
      const mensaje = this.generarMensaje(est, extraAdaptado);
      if (!mensaje) return;
      const tel = this.normalizarTelefono(est.telefono);
      if (!tel) return;
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank');
      this.enviados.add(est.id);
      abiertos++;
    });

    this.pintarEnviados();
    this.actualizarContador();

    if (abiertos > 0) {
      const quedan = this.colaPendiente().length;
      UI.showToast(quedan > 0
        ? `📤 WhatsApp abierto con ${abiertos} mensaje(s) · quedan ${quedan}`
        : `🎉 Se abrieron los últimos ${abiertos} mensaje(s): cola terminada`);
    }
  },

  seleccionarPlantilla(plantillaId) {
    this._guardarExtras(); // lo que ya escribió el docente no se pierde
    this.plantillaActual = this.plantillas.find(p => p.id === plantillaId);
    
    // UI activa
    document.querySelectorAll('.btn-plantilla').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-plantilla-${plantillaId}`)?.classList.add('active');
    
    // Render campos extra
    const extraContainer = document.getElementById('msg-campos-extra');
    if (this.plantillaActual.camposExtra.length > 0) {
      extraContainer.style.display = 'block';
      extraContainer.innerHTML = `
        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 10px;"><i class="ri-edit-box-line"></i> Datos adicionales:</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${this.plantillaActual.camposExtra.map(c => {
            const valor = this.memoriaExtras[c.id] ?? c.defaultValue ?? '';
            return `
            <div class="form-group" style="margin-bottom: 0;">
              <label style="font-size: 0.75rem; margin-bottom: 4px;">${c.label}</label>
              ${c.type === 'textarea' 
                ? `<textarea id="extra-${c.id}" class="form-control" rows="3" placeholder="${this._esc(c.placeholder)}" oninput="MessageEngine.generarPreview()" style="resize: vertical;">${this._esc(valor)}</textarea>`
                : `<input type="text" id="extra-${c.id}" class="form-control" placeholder="${this._esc(c.placeholder)}" value="${this._esc(valor)}" oninput="MessageEngine.generarPreview()">`
              }
            </div>
          `; }).join('')}
        </div>
      `;
    } else {
      extraContainer.style.display = 'none';
      extraContainer.innerHTML = '';
    }
    
    this.generarPreview();
    this.actualizarContador();
  },

  generarPreview() {
    const bubble = document.getElementById('msg-bubble-preview');
    const empty = document.getElementById('msg-bubble-empty');
    const estado = document.getElementById('msg-preview-estado');
    
    if (!this.estudianteSeleccionado || !this.plantillaActual) {
      bubble.style.display = 'none';
      empty.style.display = 'block';
      if (estado) estado.textContent = this.plantillaActual ? 'Selecciona un estudiante' : 'Selecciona una plantilla';
      return;
    }

    const est = this.estudianteSeleccionado;
    const mensaje = this.generarMensaje(est, this.leerExtras());
    
    if (mensaje === null) {
      bubble.style.display = 'none';
      empty.style.display = 'block';
      empty.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding-top: 40px;"><i class="ri-information-line" style="font-size: 2rem; display: block; margin-bottom: 8px;"></i>Este estudiante no aplica para esta plantilla.</div>`;
      if (estado) estado.textContent = 'No aplica';
      return;
    }

    bubble.textContent = mensaje;
    bubble.style.display = 'block';
    empty.style.display = 'none';
    if (estado) estado.textContent = `${est.nombres.split(' ')[0]} ${est.apellidos.split(' ')[0]} • ${this.plantillaActual.nombre}`;
  },

  getMensajeActual() {
    if (!this.estudianteSeleccionado || !this.plantillaActual) return '';
    return this.generarMensaje(this.estudianteSeleccionado, this.leerExtras()) || '';
  },

  copiarMensaje() {
    const texto = this.getMensajeActual();
    if (!texto) { UI.showToast("⚠️ No hay mensaje para copiar."); return; }
    navigator.clipboard.writeText(texto).then(() => {
      UI.showToast("📋 Mensaje copiado al portapapeles.");
    }).catch(() => {
      UI.showToast("❌ Error al copiar.");
    });
  },

  abrirWhatsApp() {
    const seleccionados = Array.from(document.querySelectorAll('.msg-estudiante-item.selected'));
    if (seleccionados.length === 0) { UI.showToast("⚠️ Selecciona al menos un estudiante."); return; }
    if (!this.plantillaActual) { UI.showToast("⚠️ Selecciona un tipo de mensaje."); return; }

    const todos = this.getListaActual();
    
    let enviados = 0;
    seleccionados.forEach(item => {
      const id = item.getAttribute('data-id');
      const est = todos.find(e => e.id === id);
      if (!est) return;
      
      const extraAdaptado = this.leerExtras();
      
      const mensaje = this.generarMensaje(est, extraAdaptado);
      if (!mensaje) return;
      
      const tel = this.normalizarTelefono(est.telefono);
      if (!tel) { UI.showToast(`⚠️ ${est.nombres} no tiene teléfono.`); return; }
      
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
      this.enviados.add(est.id);
      enviados++;
    });

    this.pintarEnviados();
    this.actualizarContador();
    
    if (enviados > 0) UI.showToast(`📤 Abriendo WhatsApp para ${enviados} estudiante(s)...`);
  }
};