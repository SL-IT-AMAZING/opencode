export namespace Flag {
  export const ANYON_AUTO_SHARE = truthy("ANYON_AUTO_SHARE")
  export const ANYON_GIT_BASH_PATH = process.env["ANYON_GIT_BASH_PATH"]
  export const ANYON_CONFIG = process.env["ANYON_CONFIG"]
  export const ANYON_CONFIG_DIR = process.env["ANYON_CONFIG_DIR"]
  export const ANYON_CONFIG_CONTENT = process.env["ANYON_CONFIG_CONTENT"]
  export const ANYON_DISABLE_AUTOUPDATE = truthy("ANYON_DISABLE_AUTOUPDATE")
  export const ANYON_DISABLE_PRUNE = truthy("ANYON_DISABLE_PRUNE")
  export const ANYON_DISABLE_TERMINAL_TITLE = truthy("ANYON_DISABLE_TERMINAL_TITLE")
  export const ANYON_PERMISSION = process.env["ANYON_PERMISSION"]
  export const ANYON_DISABLE_DEFAULT_PLUGINS = truthy("ANYON_DISABLE_DEFAULT_PLUGINS")
  export const ANYON_DISABLE_LSP_DOWNLOAD = truthy("ANYON_DISABLE_LSP_DOWNLOAD")
  export const ANYON_ENABLE_EXPERIMENTAL_MODELS = truthy("ANYON_ENABLE_EXPERIMENTAL_MODELS")
  export const ANYON_DISABLE_AUTOCOMPACT = truthy("ANYON_DISABLE_AUTOCOMPACT")
  export const ANYON_DISABLE_MODELS_FETCH = truthy("ANYON_DISABLE_MODELS_FETCH")
  export const ANYON_FAKE_VCS = process.env["ANYON_FAKE_VCS"]
  export const ANYON_CLIENT = process.env["ANYON_CLIENT"] ?? "cli"

  // Experimental
  export const ANYON_EXPERIMENTAL = truthy("ANYON_EXPERIMENTAL")
  export const ANYON_EXPERIMENTAL_FILEWATCHER = truthy("ANYON_EXPERIMENTAL_FILEWATCHER")
  export const ANYON_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("ANYON_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const ANYON_EXPERIMENTAL_ICON_DISCOVERY =
    ANYON_EXPERIMENTAL || truthy("ANYON_EXPERIMENTAL_ICON_DISCOVERY")
  export const ANYON_EXPERIMENTAL_DISABLE_COPY_ON_SELECT = truthy("ANYON_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const ANYON_ENABLE_EXA =
    truthy("ANYON_ENABLE_EXA") || ANYON_EXPERIMENTAL || truthy("ANYON_EXPERIMENTAL_EXA")
  export const ANYON_EXPERIMENTAL_BASH_MAX_OUTPUT_LENGTH = number("ANYON_EXPERIMENTAL_BASH_MAX_OUTPUT_LENGTH")
  export const ANYON_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("ANYON_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const ANYON_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("ANYON_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const ANYON_EXPERIMENTAL_OXFMT = ANYON_EXPERIMENTAL || truthy("ANYON_EXPERIMENTAL_OXFMT")
  export const ANYON_EXPERIMENTAL_LSP_TY = truthy("ANYON_EXPERIMENTAL_LSP_TY")
  export const ANYON_EXPERIMENTAL_LSP_TOOL = ANYON_EXPERIMENTAL || truthy("ANYON_EXPERIMENTAL_LSP_TOOL")

  function truthy(key: string) {
    const value = process.env[key]?.toLowerCase()
    return value === "true" || value === "1"
  }

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}
