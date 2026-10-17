import { motion } from "framer-motion";

const kpis = [
  { icon: "ri-user-star-line", label: "Estudiantes", value: "148", hint: "8 grupos activos" },
  { icon: "ri-award-line", label: "Promedio general", value: "84.2", hint: "+2.1 vs. periodo" },
  { icon: "ri-calendar-check-line", label: "Asistencia", value: "93%", hint: "Meta: 90%" },
  { icon: "ri-chat-1-line", label: "Mensajes enviados", value: "312", hint: "Este mes" }
];

const containerVars = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.06 } }
};
const itemVars = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

export default function DashboardScreen() {
  return (
    <div className="module-fade-enter">
      <div className="view-header">
        <div>
          <span className="view-eyebrow">Panel académico</span>
          <h1>Dashboard</h1>
          <p>Resumen general del centro: grupos, rendimiento y actividad reciente del Cuaderno Docente Digital.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary"><i className="ri-add-line" /> Nuevo registro</button>
          <button className="btn-primary-soft"><i className="ri-file-excel-2-line" /> Exportar</button>
          <button className="btn-ghost"><i className="ri-printer-line" /> Imprimir</button>
        </div>
      </div>

      <motion.div variants={containerVars} initial="hidden" animate="show" className="kpi-grid">
        {kpis.map((k, i) => (
          <motion.div key={i} variants={itemVars} className="kpi-card">
            <span className="kpi-etiqueta">{k.label}</span>
            <div className="kpi-cuerpo">
              <div className="kpi-icono">
                <i className={k.icon} />
              </div>
              <div className="kpi-datos">
                <span className="kpi-valor">{k.value}</span>
                <span className="kpi-pie">{k.hint}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="group-header-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        style={{ marginTop: 16 }}
      >
        <div>
          <label className="tb-label"><i className="ri-group-line" /> Grupo</label>
          <select className="form-control" style={{ marginTop: 6 }}>
            <option>Grupo 1º A — Desarrollo de Software</option>
            <option>Grupo 2º B — Redes</option>
          </select>
        </div>
        <div>
          <label className="tb-label"><i className="ri-book-2-line" /> Módulo</label>
          <input className="form-control" type="text" placeholder="Buscar módulo…" style={{ marginTop: 6 }} />
        </div>
        <motion.button whileTap={{ scale: 0.98 }} className="btn-primary" style={{ alignSelf: "flex-end" }}>
          <i className="ri-check-line" /> Aplicar
        </motion.button>
      </motion.div>

      <motion.div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginTop: 16 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="chart-box">
          <h3>Rendimiento por grupo</h3>
        </div>
        <div className="chart-box">
          <h3>Asistencia semanal</h3>
        </div>
        <div className="card-widget">
          <div className="widget-icon"><i className="ri-trophy-line" /></div>
          <div>
            <strong>Top del mes</strong>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 4 }}>María G. · 98 puntos</p>
            <span className="badge-status activo">Activo</span>
            <span className="badge-modulo" style={{ marginLeft: 6 }}>Módulo de Inglés</span>
          </div>
        </div>
      </motion.div>

      <motion.div className="table-container" style={{ marginTop: 16 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>No.</th><th>Estudiante</th><th>Grupo</th><th>Promedio</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {[["María Gabriela López Ruiz","1º A — Software",98,"activo"],
              ["Carlos Eduardo Martínez","1º A — Software",76,"activo"],
              ["Ana Lucía Fernández","2º B — Redes",54,"retirado"]].map((r, i) => (
              <motion.tr key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                <td><strong>{i + 1}</strong></td>
                <td>{r[0]}</td><td>{r[1]}</td>
                <td><span className={r[3] === "retirado" ? "badge-status retirado" : "badge-status activo"}>{r[2]}</span></td>
                <td><span className={r[3] === "retirado" ? "badge-status retirado" : "badge-status activo"}>{r[3] === "retirado" ? "Retirado" : "Activo"}</span></td>
                <td style={{ textAlign: "center" }}>
                  <button className="btn-icon" title="Editar"><i className="ri-pencil-line" /></button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
