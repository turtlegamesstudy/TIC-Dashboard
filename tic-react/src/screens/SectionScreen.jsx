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
        style={{ marginTop: 20 }}
      >
        <i className={icon} style={{ fontSize: "2.6rem", color: "var(--text-disabled)" }} />
        <h3 style={{ marginTop: 14, fontFamily: "inherit", fontSize: "1rem", fontWeight: 600 }}>Módulo en preparación</h3>
        <p style={{ marginTop: 6, color: "var(--text-muted)", maxWidth: "44ch", marginInline: "auto" }}>
          Este módulo se portará desde el dashboard original con todas sus tablas, formularios y gráficas, aplicando el nuevo sistema de diseño monochrome de la interfaz.
        </p>
      </motion.div>
    </div>
  );
}
