import { useLanguage } from "@/context/language"
import { en, type TranslationKey } from "./en"
import { ko } from "./ko"

const translations = {
  en,
  ko,
} as const

export function useTranslation() {
  const language = useLanguage()

  return function t(key: TranslationKey): string {
    const lang = language.language() ?? "en"
    return translations[lang][key] ?? translations.en[key] ?? key
  }
}

export type { TranslationKey }
