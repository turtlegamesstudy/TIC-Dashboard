import { motion } from "framer-motion";

export default function SectionScreen({ title = "Sección", descrip = "En construcción en React", icon = "ri-dashboard-3-line" }) {
  return (
    <div className="module-fade-enter">
      <div className="view-header">
        <div>
          <h1>{title}</h1>
          <p>{descrip}</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary-soft"><i className="ri-file-excel-2-line" /> Exportar</button>
        </div>
      </div>
      <motion.div
        className="empty-state"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{ padding: 48, textAlign: "center", marginTop: 28 }}
      >
        <i className={icon} style={{ fontSize: "3.2rem", color: "var(--acento)" }} />
        <h3 style={{ marginTop: 12, fontFamily: "Bitter, serif" }}>Módulo en migración</h3>
        <p style={{ marginTop: 6, color: "var(--text-muted)" }}>
          Este módulo se portará desde el dashboard original con sus tablas, formularios y gráficas.
          La capa visual ya usa glass + paleta tricolor + animaciones Framer Motion.
        </p>
      </motion.div>
    </div>
  );
}
