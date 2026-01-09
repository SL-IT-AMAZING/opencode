import { onMount, createEffect } from "solid-js"
import { createStore } from "solid-js/store"
import type { DesktopTheme } from "./types"
import { resolveThemeVariant, themeToCss } from "./resolve"
import { DEFAULT_THEMES } from "./default-themes"
import { createSimpleContext } from "../context/helper"

export type ColorScheme = "dark"

const STORAGE_KEYS = {
  THEME_ID: "opencode-theme-id",
  THEME_CSS_DARK: "opencode-theme-css-dark",
} as const

const THEME_STYLE_ID = "oc-theme"

function ensureThemeStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null
  if (existing) return existing
  const element = document.createElement("style")
  element.id = THEME_STYLE_ID
  document.head.appendChild(element)
  return element
}

function applyThemeCss(theme: DesktopTheme, themeId: string) {
  const variant = theme.dark
  const tokens = resolveThemeVariant(variant, true)
  const css = themeToCss(tokens)

  if (themeId !== "oc-1") {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME_CSS_DARK, css)
    } catch {}
  }

  const fullCss = `:root {
  color-scheme: dark;
  --text-mix-blend-mode: plus-lighter;
  ${css}
}`

  document.getElementById("oc-theme-preload")?.remove()
  ensureThemeStyleElement().textContent = fullCss
  document.documentElement.dataset.theme = themeId
  document.documentElement.dataset.colorScheme = "dark"
}

function cacheThemeVariants(theme: DesktopTheme, themeId: string) {
  if (themeId === "oc-1") return
  const variant = theme.dark
  const tokens = resolveThemeVariant(variant, true)
  const css = themeToCss(tokens)
  try {
    localStorage.setItem(STORAGE_KEYS.THEME_CSS_DARK, css)
  } catch {}
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { defaultTheme?: string }) => {
    const [store, setStore] = createStore({
      themes: DEFAULT_THEMES as Record<string, DesktopTheme>,
      themeId: props.defaultTheme ?? "oc-1",
      previewThemeId: null as string | null,
    })

    onMount(() => {
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME_ID)
      if (savedTheme && store.themes[savedTheme]) {
        setStore("themeId", savedTheme)
      }
      const currentTheme = store.themes[store.themeId]
      if (currentTheme) {
        cacheThemeVariants(currentTheme, store.themeId)
      }
    })

    createEffect(() => {
      const theme = store.themes[store.themeId]
      if (theme) {
        applyThemeCss(theme, store.themeId)
      }
    })

    const setTheme = (id: string) => {
      const theme = store.themes[id]
      if (!theme) {
        console.warn(`Theme "${id}" not found`)
        return
      }
      setStore("themeId", id)
      localStorage.setItem(STORAGE_KEYS.THEME_ID, id)
      cacheThemeVariants(theme, id)
    }

    return {
      themeId: () => store.themeId,
      colorScheme: (): ColorScheme => "dark",
      mode: (): "dark" => "dark",
      themes: () => store.themes,
      setTheme,
      setColorScheme: (_scheme: ColorScheme) => {},
      registerTheme: (theme: DesktopTheme) => setStore("themes", theme.id, theme),
      previewTheme: (id: string) => {
        const theme = store.themes[id]
        if (!theme) return
        setStore("previewThemeId", id)
        applyThemeCss(theme, id)
      },
      previewColorScheme: (_scheme: ColorScheme) => {},
      commitPreview: () => {
        if (store.previewThemeId) {
          setTheme(store.previewThemeId)
        }
        setStore("previewThemeId", null)
      },
      cancelPreview: () => {
        setStore("previewThemeId", null)
        const theme = store.themes[store.themeId]
        if (theme) {
          applyThemeCss(theme, store.themeId)
        }
      },
    }
  },
})
