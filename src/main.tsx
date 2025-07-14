// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { enableMapSet } from "immer";
import { PWAService } from "./services/pwa.service";
// import { initializeWebSearch } from "./lib/litechat/websearch-initialization"; // DISABLED - now handled by control module
import "./i18n/config"; // Initialize i18next

enableMapSet();

// Initialize websearch system - DISABLED, now handled by WorkflowWebSearchControlModule
// initializeWebSearch();

// Initialize PWA service for proper architecture
if (import.meta.env.PROD) {
  PWAService.initialize()
    .then(() => {
      console.log('PWA service initialized successfully');
    })
    .catch((error) => {
      console.error('PWA service initialization failed:', error);
      // Error handling is done through the event system in PWAService
      // No DOM manipulation here - let the Control Module handle notifications
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
