import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../components/Sidebar.jsx";
import Topbar from "../components/Topbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile, user, logout } = useAuth();

  return (
    <div className="app-container" style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="main-wrapper" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main className="workspace" id="workspace" style={{ position: "relative" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ width: "100%" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
