/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTROL_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
