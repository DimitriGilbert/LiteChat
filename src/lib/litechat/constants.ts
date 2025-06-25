// src/lib/litechat/constants.ts
export const SYNC_VFS_KEY = "sync_repos";

// Pyodide configuration - configurable via environment variables
// Set VITE_PYODIDE_VERSION to override default version (e.g., "0.28.0")
// Set VITE_PYODIDE_CDN_URL to use custom CDN (e.g., "https://custom-cdn.com/pyodide")
export const PYODIDE_VERSION = import.meta.env.VITE_PYODIDE_VERSION || "0.27.7";
export const PYODIDE_CDN_BASE_URL = import.meta.env.VITE_PYODIDE_CDN_URL || "https://cdn.jsdelivr.net/pyodide";
export const PYODIDE_VERSION_URL = `${PYODIDE_CDN_BASE_URL}/v${PYODIDE_VERSION}/full/pyodide.js`;
