import { Fragment, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";

const grupos = [
  { label: "Principal", items: [
      { to: "/", icon: "ri-dashboard-3-line", text: "Dashboard" },
      { to: "/estadisticas", icon: "ri-bar-chart-box-line", text: "Estadísticas" }
  ]},
  { label: "Académico", items: [
      { to: "/personas", icon: "ri-user-star-line", text: "Personas" },
      { to: "/cuaderno", icon: "ri-book-read-fill", text: "Cuaderno Docente" }
  ]},
  { label: "Comunicación", items: [
      { to: "/avisos", icon: "ri-notification-3-line", text: "Avisos" },
      { to: "/mensajes", icon: "ri-whatsapp-line", text: "Envío de Mensajes" }
  ]}
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside className="sidebar" style={{ width: collapsed ? "var(--sidebar-mini, 92px)" : "var(--sidebar-w, 300px)" }}>
      <div className="sidebar-header" style={{ position: "relative" }}>
        <div className="logo-box" style={{ position: "relative", zIndex: 2 }}>
          <img src="/assets/logo-inatec-blanco.png" alt="INATEC" width={52} height={52} />
        </div>
        <div className="brand-info" style={{ position: "relative", zIndex: 2 }}>
          <h2>INATEC</h2>
          <span className="brand-subtitle">Tecnológico Nacional</span>
          <span>Centro tecnológico</span>
        </div>
      </div>

      <nav className="sidebar-nav" style={{ padding: "12px 8px", flex: 1 }}>
        {grupos.map((g, gi) => (
          <Fragment key={g.label}>
            <div className="nav-section nav-grupo" style={{ margin: "14px 8px 6px", color: "var(--text-muted)" }}>
              <span>{g.label}</span>
            </div>
            {g.items.map((it, i) => (
              <motion.div key={it.to} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * (gi + i), duration: 0.35 }}>
                <NavLink
                  to={it.to}
                  end={it.to === "/"}
                  className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
                >
                  <i className={it.icon} />
                  <span>{it.text}</span>
                </NavLink>
              </motion.div>
            ))}
          </Fragment>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-divider" />
        <p className="sidebar-footer-text">
          Sistema de Gestión Académica
          <br />
          Cuaderno Docente Digital
        </p>
        <p className="sidebar-footer-credit">
          Desarrollado por <strong>Turtle Games Dev</strong>
          <br />
          Docente TIC · Hanzell Mayorga · INATEC
        </p>
      </div>
    </aside>
  );
}
