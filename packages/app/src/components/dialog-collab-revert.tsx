import { createSignal, Show } from "solid-js"
import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import { Button } from "@anyon/ui/button"
import { TextField } from "@anyon/ui/text-field"
import { useSDK } from "@/context/sdk"
import { showToast } from "@anyon/ui/toast"
import type { CollabCommitInfo } from "@anyon/sdk/v2/client"

type RevertMode = "browse" | "fresh" | "replace"

export function DialogCollabRevert(props: { commit: CollabCommitInfo }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const [mode, setMode] = createSignal<RevertMode>("browse")
  const [branchName, setBranchName] = createSignal("")
  const [forcePush, setForcePush] = createSignal(false)
  const [loading, setLoading] = createSignal(false)
  const [confirmReplace, setConfirmReplace] = createSignal(false)

  const shortHash = props.commit.hash.slice(0, 7)

  const handleBrowse = async () => {
    setLoading(true)
    const result = await sdk.client.collab.revertBrowse({
      commitHash: props.commit.hash,
    })
    setLoading(false)
    if (result.data?.success) {
      showToast({ variant: "success", title: "Browse mode", description: `Viewing commit ${shortHash}` })
      dialog.close()
    } else {
      showToast({ variant: "error", title: "Failed", description: "Cannot checkout this commit" })
    }
  }

  const handleFresh = async () => {
    if (!branchName()) {
      showToast({ variant: "error", title: "Error", description: "Please enter a branch name" })
      return
    }
    setLoading(true)
    const result = await sdk.client.collab.revertFresh({
      commitHash: props.commit.hash,
      branchName: branchName(),
    })
    setLoading(false)
    if (result.data?.success) {
      showToast({ variant: "success", title: "New branch created", description: `Started on ${result.data.newBranch}` })
      dialog.close()
    } else {
      showToast({ variant: "error", title: "Failed", description: "Cannot create branch" })
    }
  }

  const handleReplace = async () => {
    if (!confirmReplace()) {
      setConfirmReplace(true)
      return
    }
    setLoading(true)
    const result = await sdk.client.collab.revertReplace({
      commitHash: props.commit.hash,
      forcePush: forcePush(),
    })
    setLoading(false)
    if (result.data?.success) {
      const msg = result.data.lostCommits > 0 ? `${result.data.lostCommits} commits removed` : "Replaced successfully"
      showToast({ variant: "success", title: "Branch replaced", description: msg })
      dialog.close()
    } else {
      showToast({ variant: "error", title: "Failed", description: "Cannot replace branch" })
    }
  }

  return (
    <Dialog title="Revert to commit">
      <div class="flex flex-col gap-4 px-2.5 pb-3 w-96">
        {/* Commit Info */}
        <div class="p-3 rounded bg-surface-secondary">
          <div class="text-12-medium text-text-base truncate">{props.commit.message}</div>
          <div class="text-11-regular text-text-weak">
            {props.commit.author.name} · {shortHash}
          </div>
        </div>

        {/* Mode Selection */}
        <div class="flex gap-2">
          <Button
            variant={mode() === "browse" ? "primary" : "ghost"}
            size="small"
            onClick={() => {
              setMode("browse")
              setConfirmReplace(false)
            }}
          >
            Browse
          </Button>
          <Button
            variant={mode() === "fresh" ? "primary" : "ghost"}
            size="small"
            onClick={() => {
              setMode("fresh")
              setConfirmReplace(false)
            }}
          >
            New branch
          </Button>
          <Button
            variant={mode() === "replace" ? "primary" : "ghost"}
            size="small"
            class={mode() === "replace" ? "bg-icon-critical-base" : ""}
            onClick={() => {
              setMode("replace")
              setConfirmReplace(false)
            }}
          >
            Replace
          </Button>
        </div>

        {/* Mode-specific content */}
        <Show when={mode() === "browse"}>
          <p class="text-12-regular text-text-subtle">
            View this commit in read-only mode. Your changes will be stashed.
          </p>
        </Show>

        <Show when={mode() === "fresh"}>
          <div class="flex flex-col gap-2">
            <p class="text-12-regular text-text-subtle">Create a new branch from this commit.</p>
            <TextField
              placeholder="New branch name"
              value={branchName()}
              onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setBranchName(e.currentTarget.value)}
            />
          </div>
        </Show>

        <Show when={mode() === "replace"}>
          <div class="flex flex-col gap-2">
            <p class="text-12-regular text-text-critical">Warning: All changes after this commit will be lost!</p>
            <Show when={confirmReplace()}>
              <p class="text-12-medium text-text-critical">Are you sure? This action cannot be undone.</p>
              <label class="flex items-center gap-2 text-12-regular cursor-pointer">
                <input type="checkbox" checked={forcePush()} onChange={(e) => setForcePush(e.currentTarget.checked)} />
                Also force push to remote
              </label>
            </Show>
          </div>
        </Show>

        {/* Actions */}
        <div class="flex justify-end gap-2">
          <Button variant="ghost" size="large" onClick={() => dialog.close()}>
            Cancel
          </Button>
          <Show when={mode() === "browse"}>
            <Button variant="primary" size="large" onClick={handleBrowse} disabled={loading()}>
              {loading() ? "Loading..." : "Browse"}
            </Button>
          </Show>
          <Show when={mode() === "fresh"}>
            <Button variant="primary" size="large" onClick={handleFresh} disabled={loading()}>
              {loading() ? "Creating..." : "Create branch"}
            </Button>
          </Show>
          <Show when={mode() === "replace"}>
            <Button
              variant="secondary"
              size="large"
              class="text-text-critical"
              onClick={handleReplace}
              disabled={loading()}
            >
              {loading() ? "Replacing..." : confirmReplace() ? "Confirm replace" : "Replace"}
            </Button>
          </Show>
        </div>
      </div>
    </Dialog>
  )
}
