/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_MODE?: 'off' | 'shadow' | 'on';
  readonly PLAYWRIGHT_PROTECTION_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
