/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRESENT_ONLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
