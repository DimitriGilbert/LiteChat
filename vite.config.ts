/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { readFileSync, existsSync } from "fs";

// Custom plugin to read system prompt and user configuration files at build time
function buildTimeConfigPlugin() {
  return {
    name: 'build-time-config-plugin',
    resolveId(id: string) {
      if (id === 'virtual:system-prompt' || id === 'virtual:user-config') {
        return id;
      }
    },
    load(id: string) {
      if (id === 'virtual:system-prompt') {
        // Check for environment variable pointing to custom system prompt file
        const customPromptFile = process.env.VITE_SYSTEM_PROMPT_FILE;
        let systemPrompt = 'You are a helpful AI assistant.'; // Default fallback
        
        if (customPromptFile) {
          try {
            const filePath = path.resolve(process.cwd(), customPromptFile);
            if (existsSync(filePath)) {
              systemPrompt = readFileSync(filePath, 'utf-8').trim();
              console.log(`✅ Loaded custom system prompt from: ${customPromptFile}`);
            } else {
              console.warn(`⚠️  System prompt file not found: ${customPromptFile}, using default`);
            }
          } catch (error) {
            console.error(`❌ Error reading system prompt file: ${customPromptFile}`, error);
            console.log('Using default system prompt');
          }
        }
        
        return `export const BUNDLED_SYSTEM_PROMPT = ${JSON.stringify(systemPrompt)};`;
      }
      
      if (id === 'virtual:user-config') {
        // Check for environment variable pointing to user configuration file
        const userConfigFile = process.env.VITE_USER_CONFIG_FILE;
        let userConfig = null;
        
        if (userConfigFile) {
          try {
            const filePath = path.resolve(process.cwd(), userConfigFile);
            if (existsSync(filePath)) {
              const configText = readFileSync(filePath, 'utf-8');
              userConfig = JSON.parse(configText);
              console.log(`✅ Loaded user configuration from: ${userConfigFile}`);
            } else {
              console.warn(`⚠️  User config file not found: ${userConfigFile}, using defaults`);
            }
          } catch (error) {
            console.error(`❌ Error reading user config file: ${userConfigFile}`, error);
            console.log('Using default configuration');
          }
        }
        
        return `export const BUNDLED_USER_CONFIG = ${JSON.stringify(userConfig)};`;
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    buildTimeConfigPlugin(),
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
  worker: {
    format: 'es',
    plugins: () => [
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        protocolImports: true,
      }),
    ],
  },
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
