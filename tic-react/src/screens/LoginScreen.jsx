import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const PASOS = [
  { texto: "Verificando credenciales", icono: "ri-shield-check-line" },
  { texto: "Cargando tu perfil docente", icono: "ri-user-star-line" },
  { texto: "Preparando tu panel", icono: "ri-dashboard-line" }
];

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [paso, setPaso] = useState(0);
  const [progreso, setProgreso] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (signingIn) return;
    setError("");
    setPaso(0);
    setProgreso(0);
    setSigningIn(true);

    // Progreso visual: sube hasta 92% mientras el acceso real ocurre.
    const intervalo = setInterval(
      () => setProgreso((p) => Math.min(p + 2, 92)),
      55
    );

    try {
      const inicio = Date.now();
      await login(email, password);
      // La secuencia dura al menos 2.6 s para que se disfrute completa.
      const resto = Math.max(0, 2600 - (Date.now() - inicio));
      await new Promise((r) => setTimeout(r, resto));
      clearInterval(intervalo);
      setPaso(PASOS.length);
      setProgreso(100);
      await new Promise((r) => setTimeout(r, 380));
      navigate("/", { replace: true });
    } catch (e) {
      clearInterval(intervalo);
      setSigningIn(false);
      setPaso(0);
      setProgreso(0);
      setError("Credenciales inválidas. Verifica tu correo y contraseña.");
    }
  };

  const entrada = (delay) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }
  });

  const estiloEtiqueta = {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 6
  };

  const estiloCampo = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 6,
    background: "var(--input-fondo)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
    outline: "none",
    fontSize: "0.92rem",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 160ms ease"
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
        padding: "24px",
        zIndex: 9999
      }}
    >
      {/* Formulario: se atenúa cuando arranca la sesión */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{
          opacity: signingIn ? 0.35 : 1,
          scale: signingIn ? 0.98 : 1
        }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="auth-panel"
        style={{
          position: "relative",
          width: "min(400px, 100%)",
          padding: "36px 32px 26px",
          borderRadius: 8
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <motion.img
            {...entrada(0.05)}
            src="/assets/logo-inatec-blanco.png"
            alt="TIC Dashboard"
            width={64}
            height={64}
            style={{ opacity: 0.92 }}
          />
          <motion.h1
            {...entrada(0.1)}
            style={{
              fontFamily: "inherit",
              fontSize: "1.55rem",
              margin: "14px 0 4px",
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
              fontWeight: 650
            }}
          >
            TIC Dashboard
          </motion.h1>
          <motion.p
            {...entrada(0.15)}
            style={{
              color: "var(--text-muted)",
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              margin: 0
            }}
          >
            Cuaderno Docente Digital
          </motion.p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <motion.div {...entrada(0.2)}>
            <label style={estiloEtiqueta}>Correo institucional</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@inatec.edu.ni"
              style={{
                ...estiloCampo
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--text-primary)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border-default)"; }}
            />
          </motion.div>

          <motion.div {...entrada(0.26)}>
            <label style={estiloEtiqueta}>Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                ...estiloCampo
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--text-primary)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border-default)"; }}
            />
          </motion.div>

          <AnimatePresence>
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  padding: 12,
                  borderRadius: 5,
                  background: "var(--acento-suave)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem"
                }}
              >
                {error}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.button
            {...entrada(0.32)}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={signingIn}
            style={{
              marginTop: 4,
              padding: "12px 16px",
              borderRadius: 5,
              border: "1px solid var(--text-primary)",
              background: "var(--text-primary)",
              color: "var(--bg-body)",
              fontFamily: "inherit",
              fontWeight: 560,
              fontSize: "0.92rem",
              letterSpacing: "0.01em",
              cursor: signingIn ? "wait" : "pointer",
              opacity: signingIn ? 0.55 : 1
            }}
          >
            {signingIn ? "Ingresando…" : "Ingresar"}
          </motion.button>
        </form>

        <motion.div
          {...entrada(0.38)}
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--border-subtle)",
            textAlign: "center",
            fontSize: "0.68rem",
            color: "var(--text-muted)",
            letterSpacing: "0.04em"
          }}
        >
          Desarrollado por <strong style={{ color: "var(--text-secondary)" }}>Turtle Games Dev</strong>
        </motion.div>
      </motion.div>

      {/* ═══ Pantalla de inicio de sesión: vidrio monocromo, pasos y progreso ═══ */}
      <AnimatePresence>
        {signingIn ? (
          <motion.div
            key="signin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              display: "grid",
              placeItems: "center",
              background: "var(--overlay-bg, rgba(0,0,0,0.4))",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)"
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              style={{
                position: "relative",
                width: "min(380px, 92vw)",
                padding: "32px 30px 26px",
                borderRadius: 8,
                textAlign: "center",
                background: "var(--bg-elevated, rgba(18,18,18,0.88))",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid var(--border-default, rgba(255,255,255,0.15))",
                boxShadow: "0 16px 44px rgba(0,0,0,0.65)"
              }}
            >
              {/* Puntos de progreso alrededor del logo */}
              <div style={{ position: "relative", width: 62, height: 62, margin: "0 auto", display: "grid", placeItems: "center" }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "2px solid var(--border-subtle, rgba(255,255,255,0.1))",
                    borderTopColor: "var(--text-primary, #fafafa)"
                  }}
                />
                <img
                  src="/assets/logo-inatec-blanco.png"
                  alt="TIC Dashboard"
                  width={36}
                  height={36}
                  style={{ opacity: 0.9 }}
                />
              </div>

              <div
                style={{
                  fontFamily: "inherit",
                  fontSize: "1.25rem",
                  color: "var(--text-primary, #fafafa)",
                  margin: "16px 0 2px",
                  fontWeight: 650,
                  letterSpacing: "-0.02em"
                }}
              >
                TIC Dashboard
              </div>
              <div
                style={{
                  color: "var(--text-muted, rgba(255,255,255,0.45))",
                  fontSize: "0.66rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase"
                }}
              >
                Inicio de sesión
              </div>

              {/* Pasos con checks */}
              <div style={{ display: "grid", gap: 7, margin: "20px 0 16px", textAlign: "left" }}>
                {PASOS.map((p, i) => {
                  const hecho = i < paso;
                  const activo = i === paso;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: hecho || activo ? 1 : 0.4, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.55, duration: 0.3 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 11px",
                        borderRadius: 5,
                        background: activo ? "var(--acento-suave, rgba(255,255,255,0.09))" : "var(--bg-input, rgba(255,255,255,0.06))",
                        border: "1px solid",
                        borderColor: activo ? "var(--border-strong, rgba(255,255,255,0.34))" : "var(--border-subtle, rgba(255,255,255,0.08))"
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          flex: "0 0 auto",
                          background: hecho
                            ? "var(--text-primary, #fafafa)"
                            : activo
                              ? "var(--bg-active, rgba(255,255,255,0.1))"
                              : "var(--bg-input, rgba(255,255,255,0.06))",
                          border: "1px solid var(--border-subtle)",
                          color: hecho ? "var(--bg-body, #050505)" : "var(--text-muted, rgba(255,255,255,0.45))"
                        }}
                      >
                        {hecho ? (
                          <i className="ri-check-line" aria-hidden="true"></i>
                        ) : (
                          <i className={p.icono} aria-hidden="true"></i>
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          color: hecho || activo ? "var(--text-primary, #fafafa)" : "var(--text-muted, rgba(255,255,255,0.45))",
                          fontWeight: activo ? 600 : 400
                        }}
                      >
                        {p.texto}
                        {activo ? "…" : ""}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Barra de progreso + porcentaje */}
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "var(--acento-suave, rgba(255,255,255,0.09))",
                  overflow: "hidden"
                }}
              >
                <motion.div
                  animate={{ width: `${progreso}%` }}
                  transition={{ duration: 0.15 }}
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    background: "var(--text-primary, #fafafa)"
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: "0.7rem",
                  color: "var(--text-muted, rgba(255,255,255,0.45))",
                  fontVariantNumeric: "tabular-nums"
                }}
              >
                {progreso}%
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
