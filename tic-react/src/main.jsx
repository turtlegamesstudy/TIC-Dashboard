import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./styles/style.css";
import "./styles/remodelacion.css";

// Por defecto el tema oscuro (estilo login) hereda del remodelacion.css.
// Mantenemos la preferencia guardada por el usuario si existe.
const _t = localStorage.getItem("tic-theme");
document.documentElement.setAttribute("data-theme", _t === "light" ? "light" : "dark");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
