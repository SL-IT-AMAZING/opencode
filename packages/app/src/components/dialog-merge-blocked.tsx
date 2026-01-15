import { For, createSignal } from "solid-js"
import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { useSDK } from "@/context/sdk"
import { showToast } from "@anyon/ui/toast"

export function DialogMergeBlocked(props: { reason: string; files: string[] }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const [loading, setLoading] = createSignal(false)

  const handleStashSync = async () => {
    setLoading(true)
    const result = await sdk.client.collab.stashSync({})
    setLoading(false)

    if (result.data?.success) {
      dialog.close()
      showToast({
        title: "Sync completed",
        description: "Your changes have been restored.",
        variant: "success",
      })
    } else if (result.data?.conflicts) {
      // Conflicts detected - dialog will close and conflict resolution will open
      dialog.close()
    } else {
      showToast({
        title: "Sync failed",
        description: "Please try again or resolve manually.",
        variant: "error",
      })
    }
  }

  return (
    <Dialog title="Cannot Sync">
      <div class="flex flex-col gap-4 px-2.5 pb-3 w-[450px]">
        <div class="flex items-start gap-3 p-3 rounded bg-surface-warning-subtle">
          <Icon name="circle-ban-sign" class="text-icon-warning-base mt-0.5" />
          <div class="flex flex-col gap-1">
            <span class="text-14-medium text-text-base">
              {props.reason === "untracked_files"
                ? "Untracked files would be overwritten"
                : "Uncommitted changes would be overwritten"}
            </span>
            <span class="text-12-regular text-text-weak">
              The following files have local changes that conflict with incoming changes:
            </span>
          </div>
        </div>

        <div class="max-h-40 overflow-y-auto rounded border border-border-weak-base p-2">
          <ul class="space-y-1">
            <For each={props.files}>
              {(file) => <li class="text-12-regular text-text-base font-mono truncate">{file}</li>}
            </For>
          </ul>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => dialog.close()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleStashSync} disabled={loading()}>
            {loading() ? "Processing..." : "Stash & Sync"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
