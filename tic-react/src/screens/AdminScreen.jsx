import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { db, auth } from "../lib/firebase";
import { ref, get } from "firebase/database";
import { sendPasswordResetEmail } from "firebase/auth";

export default function AdminScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    (async () => {
      try {
        const snap = await get(ref(db, "usuarios"));
        const val = snap.exists() ? snap.val() : {};
        const arr = Object.entries(val || {})
          .map(([uid, data]) => ({
            uid,
            ...data,
            correo: data?.correo || data?.email || data?.correoElectronico || ""
          }))
          .filter((u) => u.correo);
        setUsers(arr);
      } catch (e) {
        setMsg({ tipo: "error", texto: "No se pudo cargar la lista de usuarios." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.nombre || "").toLowerCase().includes(q) || (u.correo || "").toLowerCase().includes(q) || (u.rol || "").toLowerCase().includes(q));
  }, [users, query]);

  const sendReset = async (e) => {
    e?.preventDefault?.();
    if (!selected) return;
    if (password.length < 8) {
      setMsg({ tipo: "error", texto: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    setSending(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/`,
        handleCodeInApp: false
      };
      const emailOptions = {
        url: `${window.location.origin}/`,
        handleCodeInApp: false
      };
      try {
        await sendPasswordResetEmail(auth, selected.correo, actionCodeSettings);
      } catch (settingsErr) {
        await sendPasswordResetEmail(auth, selected.correo, emailOptions);
      }
      setMsg({ tipo: "success", texto: `Enlace de restablecimiento enviado a ${selected.correo}.` });
      setSelected(null);
      setPassword("");
    } catch (err) {
      setMsg({ tipo: "error", texto: `No se pudo enviar el enlace: ${err?.message || "error desconocido"}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="module-fade-enter">
      <div className="view-header">
        <div>
          <h1>Administración</h1>
          <p>Gestión de accesos: restablecer contraseñas de usuarios del centro.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary-soft"><i className="ri-download-cloud-2-line" /> Exportar</button>
        </div>
      </div>

      <motion.div className="avisos-filtros" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 18 }}>
        <div style={{ display: "flex", gap: 12, padding: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div className="search-box" style={{ flex: "1 1 280px" }}>
            <i className="ri-search-line" aria-hidden="true" style={{ pointerEvents: "none" }} />
            <input type="search" placeholder="Buscar por nombre, correo o rol…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar usuario" />
          </div>
        </div>
      </motion.div>

      <motion.div className="table-container" style={{ marginTop: 18 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        {loading ? <div style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Cargando usuarios…</div> : (
          <table className="custom-table">
            <thead>
              <tr><th>No.</th><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {visible.map((u, i) => (
                <motion.tr key={u.uid} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.04 }}>
                  <td><strong>{i + 1}</strong></td>
                  <td>{u.nombre || "—"}</td>
                  <td>{u.correo}</td>
                  <td><span className="badge-modulo">{u.rol || "—"}</span></td>
                  <td><span className="badge-status activo">Activo</span></td>
                  <td style={{ textAlign: "center" }}>
                    <button type="button" className="btn-primary-soft" onClick={() => { setSelected(u); setPassword(""); }}>
                      <i className="ri-key-2-line" /> Cambiar contraseña
                    </button>
                  </td>
                </motion.tr>
              ))}
              {visible.length === 0 ? <tr><td colSpan="6" style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>Sin resultados para tu búsqueda.</td></tr> : null}
            </tbody>
          </table>
        )}
      </motion.div>

      {selected ? (
        <motion.div className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 120, display: "grid", placeItems: "center", background: "rgba(2,6,14,0.66)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal-content panel" initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.25 }} style={{ width: "min(440px, 92vw)" }}>
            <div className="panel-cabecera">
              <span className="panel-titular"><i className="ri-key-2-line" /> Restablecer contraseña</span>
              <button type="button" className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar"><i className="ri-close-line" /></button>
            </div>
            <div className="panel-cuerpo" style={{ padding: 18 }}>
              <p style={{ marginTop: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Estás generando un enlace de restablecimiento de contraseña para <strong style={{ color: "var(--text-primary)" }}>{selected.correo}</strong>. El usuario recibirá el correo con las instrucciones para crear una nueva contraseña.
              </p>
              <form onSubmit={sendReset} style={{ display: "grid", gap: 14 }}>
                <div className="form-group">
                  <label htmlFor="admin-new-password">Nueva contraseña temporal (mín. 8 caracteres)</label>
                  <input id="admin-new-password" className="form-control" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: 12, borderRadius: 12, background: "var(--input-fondo)", border: "1px solid var(--input-borde)", color: "var(--text-primary)" }} />
                </div>
                {msg.tipo ? <div style={{ padding: 12, borderRadius: 12, background: msg.tipo === "error" ? "rgba(220,38,38,0.16)" : "rgba(0,168,89,0.16)", border: `1px solid ${msg.tipo === "error" ? "rgba(220,38,38,0.45)" : "rgba(0,168,89,0.45)"}`, color: msg.tipo === "error" ? "#ff8a96" : "var(--neon-green)", fontSize: "0.85rem" }}>{msg.texto}</div> : null}
                <div className="panel-acciones" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" className="btn-ghost" onClick={() => { setSelected(null); setPassword(""); setMsg({ tipo: "", texto: "" }); }}>Cancelar</button>
                  <motion.button type="submit" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} disabled={sending} className="btn-primary">
                    <i className="ri-send-plane-2-line" /> {sending ? "Enviando…" : "Enviar enlace"}
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </div>
  );
}
