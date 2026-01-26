import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import { Switch } from "@anyon/ui/switch"
import { Select } from "@anyon/ui/select"
import { useLanguage, type Language } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useTheme } from "@anyon/ui/theme"
import { useTranslation } from "@/i18n"
import { createMemo } from "solid-js"

export function DialogSettings() {
  const dialog = useDialog()
  const language = useLanguage()
  const layout = useLayout()
  const theme = useTheme()
  const t = useTranslation()

  const currentThemeId = createMemo(() => theme.themeId())
  const availableThemes = createMemo(() => {
    const entries = Object.entries(theme.themes())
    return entries.map(([id, def]) => ({
      id,
      name: def.name ?? id,
    }))
  })

  const languageOptions: { value: Language; label: string; flag: string }[] = [
    { value: "en", label: "English", flag: "🇺🇸" },
    { value: "ko", label: "한국어", flag: "🇰🇷" },
  ]

  return (
    <Dialog title={t("settings.title")}>
      <div class="flex flex-col gap-6 px-2.5 pb-3 min-w-[320px]">
        {/* Language Section */}
        <div class="flex flex-col gap-3">
          <div class="text-12-medium text-text-subtle uppercase tracking-wider">
            {t("settings.language")}
          </div>
          <div class="grid grid-cols-2 gap-2">
            {languageOptions.map((option) => (
              <button
                classList={{
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors": true,
                  "border-border-info-base bg-surface-info-base": language.language() === option.value,
                  "border-border-base hover:bg-surface-raised-base-hover": language.language() !== option.value,
                }}
                onClick={() => language.set(option.value)}
              >
                <span class="text-lg">{option.flag}</span>
                <span class="text-14-regular text-text-base">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Section */}
        <div class="flex flex-col gap-3">
          <div class="text-12-medium text-text-subtle uppercase tracking-wider">
            {t("settings.theme")}
          </div>
          <Select
            options={availableThemes()}
            current={availableThemes().find((t) => t.id === currentThemeId())}
            label={(t) => t.name}
            value={(t) => t.id}
            onSelect={(selected) => {
              if (selected) {
                theme.setTheme(selected.id)
              }
            }}
            class="w-full"
          />
        </div>

        {/* Appearance Section */}
        <div class="flex flex-col gap-3">
          <div class="text-12-medium text-text-subtle uppercase tracking-wider">
            {t("settings.appearance")}
          </div>
          <div class="flex items-center justify-between py-1">
            <span class="text-14-regular text-text-base">{t("settings.diffStyle")}</span>
            <Select
              options={["split", "unified"] as const}
              current={layout.review.diffStyle()}
              label={(s) => (s === "split" ? t("settings.diffSplit") : t("settings.diffUnified"))}
              onSelect={(selected) => {
                if (selected) {
                  layout.review.setDiffStyle(selected)
                }
              }}
              variant="ghost"
            />
          </div>
        </div>
      </div>
    </Dialog>
  )
}
