import { For, Show, createResource, createSignal } from "solid-js"
import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import { Button } from "@anyon/ui/button"
import { useSDK } from "@/context/sdk"
import { showToast } from "@anyon/ui/toast"
import type { CollabConflictFile } from "@anyon/sdk/v2/client"

export function DialogConflictResolution() {
  const dialog = useDialog()
  const sdk = useSDK()
  const [loading, setLoading] = createSignal(false)

  const [conflicts, { refetch }] = createResource(async () => {
    const result = await sdk.client.collab.conflicts({})
    return result.data ?? []
  })

  const handleResolve = async (file: string, resolution: "ours" | "theirs") => {
    setLoading(true)
    const result = await sdk.client.collab.conflictResolve({
      file: encodeURIComponent(file),
      resolution,
    })
    setLoading(false)
    if (result.data?.success) {
      showToast({ variant: "success", title: "Resolved", description: file })
      await refetch()
    }
  }

  const handleAbort = async () => {
    setLoading(true)
    const result = await sdk.client.collab.conflictAbort({})
    setLoading(false)
    if (result.data?.success) {
      showToast({ variant: "success", title: "Merge aborted" })
      dialog.close()
    }
  }

  const handleContinue = async () => {
    setLoading(true)
    const result = await sdk.client.collab.conflictContinue({})
    setLoading(false)
    if (result.data?.success) {
      showToast({ variant: "success", title: "Merge completed" })
      dialog.close()
    } else {
      showToast({ variant: "error", title: "Error", description: "Please resolve all conflicts first" })
    }
  }

  const allResolved = () => conflicts()?.length === 0

  return (
    <Dialog title="Resolve conflicts">
      <div class="flex flex-col gap-4 px-2.5 pb-3 w-[600px] max-h-[70vh] overflow-y-auto">
        <Show
          when={!allResolved()}
          fallback={
            <div class="text-center py-8">
              <div class="text-14-medium text-text-base">All conflicts resolved!</div>
              <div class="text-12-regular text-text-weak mt-2">Click the button below to complete the merge.</div>
            </div>
          }
        >
          <For each={conflicts()}>
            {(file) => <ConflictFileCard file={file} onResolve={handleResolve} disabled={loading()} />}
          </For>
        </Show>

        {/* Actions */}
        <div class="flex justify-between gap-2 pt-4 border-t border-border-weak-base">
          <Button variant="ghost" onClick={handleAbort} disabled={loading()}>
            Abort merge
          </Button>
          <div class="flex gap-2">
            <Button variant="ghost" onClick={() => dialog.close()}>
              Later
            </Button>
            <Button variant="primary" onClick={handleContinue} disabled={!allResolved() || loading()}>
              {loading() ? "Processing..." : "Complete merge"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function ConflictFileCard(props: {
  file: CollabConflictFile
  onResolve: (file: string, resolution: "ours" | "theirs") => void
  disabled: boolean
}) {
  const [expanded, setExpanded] = createSignal(false)

  return (
    <div class="rounded border border-border-weak-base overflow-hidden">
      {/* Header */}
      <div
        class="flex justify-between items-center p-3 bg-surface-secondary cursor-pointer"
        onClick={() => setExpanded(!expanded())}
      >
        <div class="flex items-center gap-2">
          <span class="text-12-medium text-text-base">{props.file.path}</span>
          <span class="text-11-regular text-text-weak">
            {props.file.conflicts.length} conflict{props.file.conflicts.length > 1 ? "s" : ""}
          </span>
        </div>
        <div class="flex gap-2">
          <Button
            variant="ghost"
            size="small"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              props.onResolve(props.file.path, "ours")
            }}
            disabled={props.disabled}
          >
            Keep mine
          </Button>
          <Button
            variant="ghost"
            size="small"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              props.onResolve(props.file.path, "theirs")
            }}
            disabled={props.disabled}
          >
            Keep theirs
          </Button>
        </div>
      </div>

      {/* Conflict details */}
      <Show when={expanded()}>
        <div class="p-3 space-y-4">
          <For each={props.file.conflicts}>
            {(conflict) => (
              <div class="grid grid-cols-2 gap-2">
                <div class="p-2 rounded bg-surface-success-subtle">
                  <div class="text-11-medium text-text-weak mb-1">Mine</div>
                  <pre class="text-11-regular text-text-base whitespace-pre-wrap font-mono">{conflict.ours}</pre>
                </div>
                <div class="p-2 rounded bg-surface-info-subtle">
                  <div class="text-11-medium text-text-weak mb-1">Theirs</div>
                  <pre class="text-11-regular text-text-base whitespace-pre-wrap font-mono">{conflict.theirs}</pre>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
