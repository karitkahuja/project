// src/main.jsx

import "bootstrap/dist/css/bootstrap.min.css"; // ✅ Bootstrap
import "./index.css"; // ✅ Tailwind & global styles

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// ✅ Mount React app to root
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
