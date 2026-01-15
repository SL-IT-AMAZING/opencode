import { createSignal } from "solid-js"
import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { useSDK } from "@/context/sdk"
import { showToast } from "@anyon/ui/toast"

export function DialogSyncRequired() {
  const dialog = useDialog()
  const sdk = useSDK()
  const [syncing, setSyncing] = createSignal(false)

  const handleSync = async () => {
    setSyncing(true)
    const result = await sdk.client.collab.sync({})
    setSyncing(false)

    if (result.data?.success) {
      dialog.close()
      showToast({
        title: "Synced",
        description: "You can now save your changes.",
        variant: "success",
      })
    } else if (result.data?.conflicts) {
      // Conflicts detected - dialog will close and conflict resolution will open
      dialog.close()
    } else {
      showToast({
        title: "Sync failed",
        description: "Please try again.",
        variant: "error",
      })
    }
  }

  return (
    <Dialog title="Sync Required">
      <div class="flex flex-col gap-4 px-2.5 pb-3 w-[400px]">
        <div class="flex items-start gap-3 p-3 rounded bg-surface-warning-subtle">
          <Icon name="download" class="text-icon-warning-base mt-0.5" />
          <div class="flex flex-col gap-1">
            <span class="text-14-medium text-text-base">Someone made changes to this project</span>
            <span class="text-12-regular text-text-weak">Please sync to get the latest changes before saving.</span>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => dialog.close()}>
            Later
          </Button>
          <Button variant="primary" onClick={handleSync} disabled={syncing()}>
            {syncing() ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
