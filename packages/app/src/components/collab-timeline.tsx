import { For, Show, createSignal } from "solid-js"
import { Button } from "@anyon/ui/button"
import { useDialog } from "@anyon/ui/context/dialog"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import type { CollabCommitInfo } from "@anyon/sdk/v2/client"
import { DialogCollabRevert } from "./dialog-collab-revert"

export function CollabTimeline() {
  const sync = useSync()
  const sdk = useSDK()
  const dialog = useDialog()
  const [loading, setLoading] = createSignal(false)

  const history = (): CollabCommitInfo[] => sync.data.collabHistory ?? []

  const handleRevert = (commit: CollabCommitInfo) => {
    dialog.show(() => <DialogCollabRevert commit={commit} />)
  }

  const loadMore = async () => {
    setLoading(true)
    const currentLen = history().length
    const more = await sdk.client.collab.history({
      limit: 20,
      offset: currentLen,
    })
    // sync.set() 사용 (sync.tsx:20에서 set: setStore로 노출됨)
    sync.set("collabHistory", [...history(), ...(more.data ?? [])])
    setLoading(false)
  }

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return "just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(ts).toLocaleDateString("en-US")
  }

  const groupByDate = (): [string, CollabCommitInfo[]][] => {
    const groups: Record<string, CollabCommitInfo[]> = {}
    for (const commit of history()) {
      const date = new Date(commit.timestamp).toLocaleDateString("en-US")
      if (!groups[date]) groups[date] = []
      groups[date].push(commit)
    }
    return Object.entries(groups)
  }

  return (
    <div class="flex flex-col gap-2 p-2">
      <Show when={history().length === 0}>
        <div class="text-11-regular text-text-weak">No commit history</div>
      </Show>
      <For each={groupByDate()}>
        {([date, commits]) => (
          <div class="flex flex-col gap-1">
            <div class="text-11-regular text-text-weak">{date}</div>
            <For each={commits}>
              {(item) => (
                <div class="p-2 rounded bg-surface-secondary hover:bg-surface-secondary-hover cursor-pointer group">
                  <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                      <div class="text-12-regular text-text-base truncate">{item.message}</div>
                      <div class="text-11-regular text-text-weak">
                        {item.author.name} · {formatTime(item.timestamp)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="small"
                      class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => handleRevert(item)}
                    >
                      Revert
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </For>
      <Show when={history().length >= 20}>
        <Button variant="ghost" size="small" onClick={loadMore} disabled={loading()}>
          {loading() ? "Loading..." : "Load more"}
        </Button>
      </Show>
    </div>
  )
}
