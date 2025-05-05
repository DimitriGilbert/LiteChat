/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      // Optionally specify which globals to polyfill (true by default)
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Optionally specify which protocols to polyfill (true by default)
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    // Optional: Configure coverage
    // coverage: {
    //   provider: 'v8',
    //   reporter: ['text', 'json', 'html'],
    //   include: ['src/**/*.{ts,tsx}'],
    //   exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/setup.ts', 'src/lib/db.ts', 'src/**/*.d.ts', 'src/components/ui/**'],
    // },
  },
});
