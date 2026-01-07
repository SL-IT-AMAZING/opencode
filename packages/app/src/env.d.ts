interface ImportMetaEnv {
  readonly VITE_ANYON_SERVER_HOST: string
  readonly VITE_ANYON_SERVER_PORT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
