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
  registerServiceWorker()
    .then((registration) => {
      if (registration) {
        console.log('PWA service worker registered successfully');
      }
    })
    .catch((error) => {
      console.error('PWA service worker registration failed:', error);
      // Show user notification about PWA features being unavailable
      // Using setTimeout to ensure DOM is ready for notifications
      setTimeout(() => {
        // Create a simple notification banner for PWA registration failure
        const banner = document.createElement('div');
        banner.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #f59e0b;
          color: white;
          padding: 8px 16px;
          text-align: center;
          font-size: 14px;
          z-index: 9999;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        banner.innerHTML = `
          ⚠️ PWA features unavailable - some offline functionality may be limited
          <button onclick="this.parentElement.remove()" style="margin-left: 12px; background: rgba(255,255,255,0.2); border: none; color: white; padding: 2px 8px; border-radius: 3px; cursor: pointer;">×</button>
        `;
        document.body.appendChild(banner);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
          if (banner.parentElement) {
            banner.remove();
          }
        }, 10000);
      }, 1000);
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
