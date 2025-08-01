/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:system-prompt' {
  export const BUNDLED_SYSTEM_PROMPT: string;
}

declare module 'virtual:user-config' {
  export const BUNDLED_USER_CONFIG: any | null;
}
