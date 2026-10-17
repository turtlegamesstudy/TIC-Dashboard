import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import LoginScreen from "./screens/LoginScreen.jsx";
import DashboardScreen from "./screens/DashboardScreen.jsx";
import SectionScreen from "./screens/SectionScreen.jsx";
import AdminScreen from "./screens/AdminScreen.jsx";
import AppLayout from "./layouts/AppLayout.jsx";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="app-loading" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, minHeight: "100vh" }}>
        <div style={{ fontFamily: "inherit", fontSize: "1.05rem", fontWeight: 550, letterSpacing: "0.01em" }}>Cargando sesión…</div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardScreen />} />
          <Route path="estadisticas" element={<SectionScreen title="Estadísticas" descrip="Indicadores académicos y de rendimiento." icon="ri-bar-chart-box-line" />} />
          <Route path="personas" element={<SectionScreen title="Personas" descrip="Listado y gestión de personas del centro." icon="ri-user-star-line" />} />
          <Route path="informe-avance" element={<SectionScreen title="Informe de Avance" descrip="Reporte Word/PDF de avance institucional." icon="ri-file-chart-line" />} />
          <Route path="examen" element={<SectionScreen title="Examen" descrip="Gestión de exámenes y calificaciones." icon="ri-survey-line" />} />
          <Route path="equipos" element={<SectionScreen title="Equipos" descrip="Equipos de innovación y hackathon." icon="ri-team-line" />} />
          <Route path="avisos" element={<SectionScreen title="Avisos" descrip="Centro de mensajes y notificaciones." icon="ri-notification-3-line" />} />
          <Route path="cuaderno" element={<SectionScreen title="Cuaderno Docente" descrip="Registro de actividades docentes." icon="ri-book-read-fill" />} />
          <Route path="mensajes" element={<SectionScreen title="Envío de Mensajes" descrip="WhatsApp y comunicaciones." icon="ri-whatsapp-line" />} />
          <Route path="admin" element={<AdminScreen />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
