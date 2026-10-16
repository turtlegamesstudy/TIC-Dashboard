import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (e) {
      setError("Credenciales inválidas. Verifica tu correo y contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-screen"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "auto",
        display: "grid",
        placeItems: "center",
        padding: "40px",
        zIndex: 9999
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(900px 500px at 85% -5%, rgba(230, 0,126, .18), transparent 60%), radial-gradient(800px 600px at -5% 15%, rgba(0,92,169,.28), transparent 55%), radial-gradient(1000px 800px at 50% 115%, rgba(0,168,89,.12), transparent 60%)",
          pointerEvents: "none"
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="auth-panel"
        style={{
          position: "relative",
          width: "min(440px, 100%)",
          padding: "36px 34px 30px",
          borderRadius: 24,
          background: "rgba(8, 16, 30, 0.72)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 30px 70px rgba(0,0,0,.5), 0 0 60px rgba(230,0,126,.1)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img
            src="/assets/logo-inatec-blanco.png"
            alt="INATEC"
            width={64}
            height={64}
            style={{ filter: "drop-shadow(0 0 18px rgba(230,0,126,.4))" }}
          />
          <h1
            style={{
              fontFamily: "Bitter, serif",
              fontSize: "2rem",
              margin: "12px 0 6px",
              color: "#eef4ff",
              letterSpacing: "0.02em",
              fontWeight: 700
            }}
          >
            TIC Dashboard
          </h1>
          <p
            style={{
              color: "#8496b0",
              fontSize: "0.85rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              margin: 0
            }}
          >
            Cuaderno Docente Digital · INATEC
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#b7c5db",
                marginBottom: 6
              }}
            >
              Correo institucional
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@inatec.edu.ni"
              style={{
                width: "100%",
                padding: "13px 18px",
                borderRadius: 999,
                background: "rgba(4, 9, 19, 0.62)",
                color: "#eef4ff",
                border: "1px solid rgba(255,255,255,0.13)",
                outline: "none",
                fontSize: "0.95rem",
                boxSizing: "border-box"
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.22 }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#b7c5db",
                marginBottom: 6
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "13px 18px",
                borderRadius: 999,
                background: "rgba(4, 9, 19, 0.62)",
                color: "#eef4ff",
                border: "1px solid rgba(255,255,255,0.13)",
                outline: "none",
                fontSize: "0.95rem",
                boxSizing: "border-box"
              }}
            />
          </motion.div>

          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(220,38,38,0.16)",
                border: "1px solid rgba(220,38,38,0.45)",
                color: "#ff8a96",
                fontSize: "0.85rem"
              }}
            >
              {error}
            </motion.div>
          ) : null}

          <motion.button
            whileHover={{ y: -2, boxShadow: "0 8px 26px rgba(230,0,126,0.55)" }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: "14px 18px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #E6007E, #c4006a)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.95rem",
              letterSpacing: "0.02em",
              cursor: loading ? "wait" : "pointer",
              boxShadow: "0 4px 18px rgba(230,0,126,0.38)"
            }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </motion.button>
        </form>

        <div
          style={{
            marginTop: 22,
            textAlign: "center",
            fontSize: "0.7rem",
            color: "#6b7d99",
            letterSpacing: "0.04em"
          }}
        >
          Desarrollado por <strong style={{ color: "#eef4ff" }}>Turtle Games Dev</strong>
        </div>
      </motion.div>
    </div>
  );
}
