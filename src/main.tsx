// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { enableMapSet } from "immer";
import { registerServiceWorker } from "./lib/litechat/pwa-utils";

enableMapSet();

// Register service worker for PWA functionality
if (import.meta.env.PROD) {
  registerServiceWorker().catch(console.error);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
