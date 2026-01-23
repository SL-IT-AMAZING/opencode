import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import type { Language } from "@/context/language"

interface DialogSelectLanguageProps {
  onSelect: (language: Language) => void
}

export function DialogSelectLanguage(props: DialogSelectLanguageProps) {
  const dialog = useDialog()

  const handleSelect = (lang: Language) => {
    props.onSelect(lang)
    dialog.close()
  }

  return (
    <Dialog title="Choose Language" action={<></>} preventClose>
      <div class="flex flex-col gap-6 px-2.5 pb-3">
        <p class="text-14-regular text-text-subtle">Select your preferred language</p>
        <div class="grid grid-cols-2 gap-3">
          <button
            class="flex flex-col items-center gap-3 p-5 rounded-lg border border-border-base hover:bg-surface-raised-base transition-colors cursor-pointer"
            onClick={() => handleSelect("en")}
          >
            <span class="text-3xl">🇺🇸</span>
            <div class="text-center">
              <div class="text-14-medium text-text-base">English</div>
              <div class="text-13-regular text-text-subtle">Use English</div>
            </div>
          </button>
          <button
            class="flex flex-col items-center gap-3 p-5 rounded-lg border border-border-base hover:bg-surface-raised-base transition-colors cursor-pointer"
            onClick={() => handleSelect("ko")}
          >
            <span class="text-3xl">🇰🇷</span>
            <div class="text-center">
              <div class="text-14-medium text-text-base">한국어</div>
              <div class="text-13-regular text-text-subtle">한국어 사용</div>
            </div>
          </button>
        </div>
      </div>
    </Dialog>
  )
}
