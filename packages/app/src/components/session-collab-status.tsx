import { Show, createMemo, createEffect } from "solid-js"
import { Button } from "@anyon/ui/button"
import { Popover } from "@anyon/ui/popover"
import { Tooltip } from "@anyon/ui/tooltip"
import { useDialog } from "@anyon/ui/context/dialog"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { DialogConflictResolution } from "./dialog-conflict-resolution"
import { DialogSyncRequired } from "./dialog-sync-required"
import { DialogMergeBlocked } from "./dialog-merge-blocked"

export function SessionCollabStatus() {
  const sync = useSync()
  const sdk = useSDK()
  const dialog = useDialog()

  const collab = () => sync.data.collab

  const statusIcon = createMemo(() => {
    const s = collab()
    if (!s) return { color: "bg-border-weak-base", label: "..." }
    if (s.hasConflicts) return { color: "bg-icon-critical-base", label: "Conflicts" }
    if (s.isDetached) return { color: "bg-surface-info-strong", label: "Browsing" }
    if (!s.isOnline) return { color: "bg-surface-warning-strong", label: "Offline" }
    if (s.isDirty || s.hasUnpushed) return { color: "bg-icon-critical-base", label: "Sync needed" }
    return { color: "bg-icon-success-base", label: "Synced" }
  })

  const handleSave = async () => {
    await sdk.client.collab.save({})
  }

  const handleSync = async () => {
    await sdk.client.collab.sync({})
  }

  const handleExitBrowse = async () => {
    const original = collab()?.originalBranch
    if (original) {
      await sdk.client.collab.revertExitBrowse({ originalBranch: original })
    }
  }

  const handleResolveConflicts = () => {
    dialog.show(() => <DialogConflictResolution />)
  }

  // Watch for sync required dialog trigger
  createEffect(() => {
    if (sync.data.showSyncRequiredDialog) {
      sync.set("showSyncRequiredDialog", false)
      dialog.show(() => <DialogSyncRequired />)
    }
  })

  // Watch for merge blocked dialog trigger
  createEffect(() => {
    if (sync.data.showMergeBlockedDialog) {
      const reason = sync.data.mergeBlockedReason
      const files = sync.data.mergeBlockedFiles
      sync.set("showMergeBlockedDialog", false)
      sync.set("mergeBlockedReason", undefined)
      sync.set("mergeBlockedFiles", [])
      dialog.show(() => <DialogMergeBlocked reason={reason ?? ""} files={files ?? []} />)
    }
  })

  // Watch for conflict dialog trigger
  createEffect(() => {
    if (sync.data.showConflictDialog) {
      sync.set("showConflictDialog", false)
      dialog.show(() => <DialogConflictResolution />)
    }
  })

  return (
    <Show when={collab()}>
      <Popover
        title="Collaboration"
        trigger={
          <Tooltip value={statusIcon().label}>
            <Button variant="ghost" class="gap-1.5">
              <div class={`size-1.5 rounded-full ${statusIcon().color}`} />
              <span class="text-12-regular text-text-weak">{statusIcon().label}</span>
            </Button>
          </Tooltip>
        }
      >
        <div class="w-56 p-2 flex flex-col gap-2">
          <Show when={collab()}>
            {(s) => (
              <>
                <div class="text-12-regular text-text-weak flex items-center gap-1.5">
                  <span>Branch:</span>
                  <span class="text-text-base font-medium">{s().branch}</span>
                </div>

                {/* Conflict resolution button */}
                <Show when={s().hasConflicts}>
                  <Button variant="secondary" class="w-full text-text-critical" onClick={handleResolveConflicts}>
                    Resolve conflicts ({s().conflictCount})
                  </Button>
                </Show>

                {/* Browse mode exit button */}
                <Show when={s().isDetached && s().originalBranch}>
                  <Button variant="secondary" onClick={handleExitBrowse} class="w-full">
                    Back to {s().originalBranch}
                  </Button>
                </Show>

                {/* Normal mode buttons */}
                <Show when={!s().isDetached && !s().hasConflicts}>
                  <Button variant="secondary" onClick={handleSave} class="w-full">
                    Save
                  </Button>
                  <Button variant="secondary" onClick={handleSync} class="w-full">
                    Sync
                  </Button>
                </Show>
              </>
            )}
          </Show>
        </div>
      </Popover>
    </Show>
  )
}
