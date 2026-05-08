/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
  readonly VITE_NHOST_SUBDOMAIN: string;
  readonly VITE_NHOST_REGION: string;
  readonly VITE_MCP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
