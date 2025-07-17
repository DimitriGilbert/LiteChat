/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync, existsSync } from "fs";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
// import { analyzer } from 'vite-bundle-analyzer';

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

// Get build configuration from environment
const base = process.env.VITE_BASE || '/';
const lang = process.env.VITE_APP_LANG || 'en';

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    buildTimeConfigPlugin(),
    nodePolyfills({
      // Whether to polyfill specific globals.
      globals: {
        Buffer: true, // can also be 'build', 'dev', or false
      },
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,txt}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB limit
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/__.*$/],
        // Fix: Add modifyURLPrefix to ensure assets use correct base path
        modifyURLPrefix: {
          '': base  // Transform relative URLs to use the correct base path
        },
        runtimeCaching: [
          // {
          //   urlPattern: /^https:\/\/api\.openai\.com\/.*/i,
          //   handler: 'NetworkFirst',
          //   options: {
          //     cacheName: 'openai-api-cache',
          //     expiration: {
          //       maxEntries: 100,
          //       maxAgeSeconds: 60 * 60 * 24 // 24 hours
          //     }
          //   }
          // },
          // {
          //   urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
          //   handler: 'NetworkFirst',
          //   options: {
          //     cacheName: 'anthropic-api-cache',
          //     expiration: {
          //       maxEntries: 100,
          //       maxAgeSeconds: 60 * 60 * 24 // 24 hours
          //     }
          //   }
          // }
        ]
      },
      includeAssets: ['favicon.ico', 'icons/*.png', 'manifest.json'],
      manifest: {
        name: 'LiteChat',
        short_name: 'LiteChat',
        description: 'Your private, customizable, high-performance AI chat interface.',
        theme_color: '#4fd1c5',
        background_color: '#1a2a3a',
        display: 'standalone',
        lang: lang,
        scope: base,
        start_url: base,
        icons: [
          {
            src: `${base}icons/192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: `${base}icons/384.png`,
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: `${base}icons/512.png`,
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    // analyzer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: [], // Don't externalize any modules for better compatibility
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
