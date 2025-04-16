/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  // base: "/LiteChat/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true, // Use Vitest global APIs (describe, it, expect, etc.)
    environment: "jsdom", // Simulate DOM environment
    setupFiles: "./src/test/setup.ts", // Path to your setup file
    css: true, // Enable CSS processing if needed for tests (e.g., snapshot testing with styles)
    // Optional: Configure coverage
    // coverage: {
    //   provider: 'v8', // or 'istanbul'
    //   reporter: ['text', 'json', 'html'],
    //   include: ['src/**/*.{ts,tsx}'],
    //   exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/setup.ts', 'src/lib/db.ts', 'src/**/*.d.ts', 'src/components/ui/**'], // Exclude UI primitives, setup, etc.
    // },
  },
});
