import { createStore } from "solid-js/store"
import { createSimpleContext } from "@anyon/ui/context"
import { persisted } from "@/utils/persist"

export type Language = "en" | "ko"

export const { use: useLanguage, provider: LanguageProvider } = createSimpleContext({
  name: "Language",
  init: () => {
    const [store, setStore, _, ready] = persisted(
      "language.v1",
      createStore({
        language: undefined as Language | undefined,
      }),
    )

    return {
      ready,
      language: () => store.language,
      set: (lang: Language) => setStore("language", lang),
    }
  },
})
