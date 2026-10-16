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
    initial: { opacity: 0, y: 26, filter: "blur(14px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] }
  });

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
      {/* Fondo del login: auroras rosa/azul muy difuminadas */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(900px 500px at 85% -5%, rgba(230, 0,126, .22), transparent 60%), radial-gradient(800px 600px at -5% 15%, rgba(0,92,169,.32), transparent 55%), radial-gradient(1000px 800px at 50% 115%, rgba(0,168,89,.14), transparent 60%)",
          pointerEvents: "none"
        }}
      />

      {/* Formulario: se difumina y retrocede cuando arranca la sesión */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, filter: "blur(24px)" }}
        animate={{
          opacity: signingIn ? 0.35 : 1,
          scale: signingIn ? 0.96 : 1,
          filter: signingIn ? "blur(10px)" : "blur(0px)"
        }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        className="auth-panel"
        style={{
          position: "relative",
          width: "min(440px, 100%)",
          padding: "38px 34px 30px",
          borderRadius: 24,
          background: "rgba(8, 16, 30, 0.68)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow:
            "0 30px 70px rgba(0,0,0,.5), 0 0 60px rgba(230,0,126,.12), inset 0 1px 0 rgba(255,255,255,.08)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <motion.img
            {...entrada(0.05)}
            src="/assets/logo-inatec-blanco.png"
            alt="TIC Dashboard"
            width={72}
            height={72}
            style={{ filter: "drop-shadow(0 0 22px rgba(230,0,126,.45))" }}
          />
          <motion.h1
            {...entrada(0.12)}
            style={{
              fontFamily: "Bitter, serif",
              fontSize: "2rem",
              margin: "12px 0 4px",
              color: "#eef4ff",
              letterSpacing: "0.02em",
              fontWeight: 700
            }}
          >
            TIC Dashboard
          </motion.h1>
          <motion.p
            {...entrada(0.18)}
            style={{
              color: "#8496b0",
              fontSize: "0.85rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              margin: 0
            }}
          >
            Cuaderno Docente Digital
          </motion.p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <motion.div {...entrada(0.24)}>
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

          <motion.div {...entrada(0.3)}>
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

          <AnimatePresence>
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
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
          </AnimatePresence>

          <motion.button
            {...entrada(0.36)}
            whileHover={{ y: -2, boxShadow: "0 10px 30px rgba(230,0,126,0.6)" }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={signingIn}
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
              cursor: signingIn ? "wait" : "pointer",
              boxShadow: "0 4px 18px rgba(230,0,126,0.38)"
            }}
          >
            {signingIn ? "Ingresando…" : "Ingresar"}
          </motion.button>
        </form>

        <motion.div
          {...entrada(0.42)}
          style={{
            marginTop: 22,
            textAlign: "center",
            fontSize: "0.7rem",
            color: "#6b7d99",
            letterSpacing: "0.04em"
          }}
        >
          Desarrollado por <strong style={{ color: "#eef4ff" }}>Turtle Games Dev</strong>
        </motion.div>
      </motion.div>

      {/* ═══ Animación de inicio de sesión: vidrio, anillo, pasos y progreso ═══ */}
      <AnimatePresence>
        {signingIn ? (
          <motion.div
            key="signin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              display: "grid",
              placeItems: "center",
              background: "rgba(4, 8, 16, 0.5)",
              backdropFilter: "blur(24px) saturate(150%)",
              WebkitBackdropFilter: "blur(24px) saturate(150%)"
            }}
          >
            {/* Orbes difuminados que flotan detrás del vidrio */}
            <motion.div
              animate={{ x: [-60, 60, -60], y: [-40, 50, -40] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                top: "18%",
                left: "12%",
                width: 340,
                height: 340,
                borderRadius: "50%",
                background: "rgba(230, 0, 126, 0.22)",
                filter: "blur(70px)"
              }}
            />
            <motion.div
              animate={{ x: [50, -50, 50], y: [40, -60, 40] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                bottom: "14%",
                right: "10%",
                width: 300,
                height: 300,
                borderRadius: "50%",
                background: "rgba(0, 92, 169, 0.25)",
                filter: "blur(70px)"
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, filter: "blur(24px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                position: "relative",
                width: "min(400px, 92vw)",
                padding: "36px 32px 30px",
                borderRadius: 22,
                textAlign: "center",
                background: "rgba(10, 18, 34, 0.72)",
                backdropFilter: "blur(28px) saturate(160%)",
                WebkitBackdropFilter: "blur(28px) saturate(160%)",
                border: "1px solid rgba(255,255,255,0.16)",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,.55), 0 0 70px rgba(230,0,126,.16), inset 0 1px 0 rgba(255,255,255,.1)"
              }}
            >
              {/* Anillo giratorio alrededor del logo */}
              <div style={{ position: "relative", width: 76, height: 76, margin: "0 auto" }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background:
                      "conic-gradient(from 0deg, #E6007E, #005CA9, #E6007E)"
                  }}
                />
                <motion.div
                  style={{
                    position: "absolute",
                    inset: 3,
                    borderRadius: "50%",
                    background: "#0a1222",
                    display: "grid",
                    placeItems: "center"
                  }}
                >
                  <img
                    src="/assets/logo-inatec-blanco.png"
                    alt="TIC Dashboard"
                    width={44}
                    height={44}
                    style={{ filter: "drop-shadow(0 0 14px rgba(230,0,126,.5))" }}
                  />
                </motion.div>
              </div>

              <div
                style={{
                  fontFamily: "Bitter, serif",
                  fontSize: "1.6rem",
                  color: "#eef4ff",
                  margin: "16px 0 2px",
                  fontWeight: 700
                }}
              >
                TIC Dashboard
              </div>
              <div
                style={{
                  color: "#8496b0",
                  fontSize: "0.7rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase"
                }}
              >
                Inicio de sesión
              </div>

              {/* Pasos con checks */}
              <div style={{ display: "grid", gap: 9, margin: "20px 0 16px", textAlign: "left" }}>
                {PASOS.map((p, i) => {
                  const hecho = i < paso;
                  const activo = i === paso;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -14, filter: "blur(6px)" }}
                      animate={{
                        opacity: hecho || activo ? 1 : 0.4,
                        x: 0,
                        filter: "blur(0px)"
                      }}
                      transition={{ delay: 0.35 + i * 0.55, duration: 0.4 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        borderRadius: 12,
                        background:
                          activo
                            ? "rgba(230,0,126,0.12)"
                            : "rgba(255,255,255,0.04)",
                        border: activo
                          ? "1px solid rgba(230,0,126,0.35)"
                          : "1px solid transparent"
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 13,
                          flex: "0 0 auto",
                          background: hecho
                            ? "#00A859"
                            : activo
                              ? "#E6007E"
                              : "rgba(255,255,255,0.12)",
                          color: hecho || activo ? "#fff" : "#5d6f8c"
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
                          fontSize: "0.84rem",
                          color: hecho || activo ? "#e7eefb" : "#7488a5",
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
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.1)",
                  overflow: "hidden"
                }}
              >
                <motion.div
                  animate={{ width: `${progreso}%` }}
                  transition={{ duration: 0.15 }}
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #E6007E, #005CA9)",
                    boxShadow: "0 0 12px rgba(230,0,126,.6)"
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: "0.72rem",
                  color: "#8496b0",
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
