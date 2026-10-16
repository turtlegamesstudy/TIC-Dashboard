import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Topbar({ onToggleSidebar }) {
  const [theme, setTheme] = useState(() => (localStorage.getItem("tic-theme") === "light" ? "light" : "dark"));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tic-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <header className="topbar" style={{ position: "sticky", top: "var(--s-4)" }}>
      <div className="topbar-left">
        <button
          type="button"
          className="btn-icon"
          onClick={onToggleSidebar}
          title="Cambiar navegación"
          aria-label="Cambiar navegación"
        >
          <i className="ri-menu-unfold-line" aria-hidden="true" />
        </button>
        <div className="search-box">
          <i className="ri-search-line" aria-hidden="true" style={{ pointerEvents: "none" }} />
          <input
            type="search"
            placeholder="Buscar estudiante o grupo…"
            aria-label="Buscar estudiante o grupo"
            autoComplete="off"
          />
        </div>
      </div>
      <div className="topbar-right">
        <motion.button
          whileHover={{ rotate: 8, scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          className="btn-icon"
          onClick={toggleTheme}
          title="Cambiar tema"
          aria-label="Cambiar tema"
        >
          <i className={theme === "dark" ? "ri-sun-line" : "ri-moon-clear-line"} aria-hidden="true" />
        </motion.button>
        <div className="topbar-data-actions">
          <span className="toolbar-group-label" aria-hidden="true">Datos</span>
          <button type="button" className="btn-primary-soft">
            <i className="ri-download-cloud-2-line" /> Descargar DB.json
          </button>
        </div>
      </div>
    </header>
  );
}
