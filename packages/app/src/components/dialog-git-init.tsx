import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import { Button } from "@anyon/ui/button"
import { IconButton } from "@anyon/ui/icon-button"
import { TextField } from "@anyon/ui/text-field"
import { Icon } from "@anyon/ui/icon"
import { createSignal, Show } from "solid-js"

interface DialogGitInitProps {
  onInit: () => void
  onClone: (url: string) => void
  /** Called after init to show GitHub connect dialog */
  onShowGitHubConnect?: () => void
}

export function DialogGitInit(props: DialogGitInitProps) {
  const dialog = useDialog()
  const [showClone, setShowClone] = createSignal(false)
  const [url, setUrl] = createSignal("")

  const handleInit = () => {
    props.onInit()
    dialog.close()
    // Show GitHub connect dialog after a short delay
    if (props.onShowGitHubConnect) {
      setTimeout(() => props.onShowGitHubConnect?.(), 100)
    }
  }

  const handleClone = () => {
    if (url().trim()) {
      props.onClone(url().trim())
      dialog.close()
    }
  }

  return (
    <Dialog
      title={
        showClone() ? (
          <div class="flex items-center gap-2">
            <IconButton icon="arrow-left" size="normal" onClick={() => setShowClone(false)} />
            <span>GitHub에서 Clone</span>
          </div>
        ) : (
          "프로젝트 시작"
        )
      }
      action={showClone() ? undefined : <></>}
      preventClose={!showClone()}
    >
      <div class="flex flex-col gap-6 px-2.5 pb-3">
        <Show
          when={!showClone()}
          fallback={
            <>
              <TextField
                label="Repository URL"
                placeholder="https://github.com/user/repo"
                value={url()}
                onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) =>
                  setUrl(e.currentTarget.value)
                }
                onKeyDown={(e: KeyboardEvent) => e.key === "Enter" && handleClone()}
                autofocus
              />
              <div class="flex justify-end gap-2">
                <Button variant="ghost" size="large" onClick={() => dialog.close()}>
                  취소
                </Button>
                <Button
                  variant="primary"
                  size="large"
                  onClick={handleClone}
                  disabled={!url().trim()}
                >
                  Clone
                </Button>
              </div>
            </>
          }
        >
          <p class="text-14-regular text-text-subtle">
            이 폴더에 Git 저장소가 없습니다. 어떻게 시작할까요?
          </p>
          <div class="grid grid-cols-2 gap-3">
            <button
              class="flex flex-col items-center gap-3 p-5 rounded-lg border border-border-base hover:bg-surface-raised-base transition-colors cursor-pointer"
              onClick={handleInit}
            >
              <Icon name="folder" size="large" class="text-text-subtle" />
              <div class="text-center">
                <div class="text-14-medium text-text-base">새로 시작</div>
                <div class="text-13-regular text-text-subtle">빈 저장소로 시작</div>
              </div>
            </button>
            <button
              class="flex flex-col items-center gap-3 p-5 rounded-lg border border-border-base hover:bg-surface-raised-base transition-colors cursor-pointer"
              onClick={() => setShowClone(true)}
            >
              <Icon name="github" size="large" class="text-text-subtle" />
              <div class="text-center">
                <div class="text-14-medium text-text-base">Clone</div>
                <div class="text-13-regular text-text-subtle">GitHub에서 복제</div>
              </div>
            </button>
          </div>
        </Show>
      </div>
    </Dialog>
  )
}
