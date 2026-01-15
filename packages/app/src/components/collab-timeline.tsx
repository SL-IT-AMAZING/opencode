import { For, Show, createSignal, createMemo, createResource } from "solid-js"
import { Icon } from "@anyon/ui/icon"
import { Button } from "@anyon/ui/button"
import { useDialog } from "@anyon/ui/context/dialog"
import { useSDK } from "@/context/sdk"
import type { CollabCommitInfo } from "@anyon/sdk/v2/client"
import { DialogCollabRevert } from "./dialog-collab-revert"

// CSS constants for consistent timeline positioning
const TIMELINE_OFFSET = 15 // px from left edge to line center
const NODE_SIZE = 12 // px diameter

type TimelineItem = { type: "date"; label: string } | { type: "commit"; commit: CollabCommitInfo }

export function CollabTimeline() {
  const sdk = useSDK()
  const dialog = useDialog()
  const [hoveredCommit, setHoveredCommit] = createSignal<string | null>(null)
  const [selectedCommit, setSelectedCommit] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)

  // Fetch history directly from SDK
  const [historyData, { refetch }] = createResource(async () => {
    const result = await sdk.client.collab.history({ limit: 1000, offset: 0 })
    return result.data ?? []
  })

  const handleRefresh = async () => {
    setLoading(true)
    await refetch()
    setLoading(false)
  }

  // Memoized history access
  const history = createMemo(() => historyData() ?? [])

  // Sort by timestamp descending to ensure correct order regardless of backend
  const sortedHistory = createMemo(() => [...history()].sort((a, b) => b.timestamp - a.timestamp))

  const handleRevert = (commit: CollabCommitInfo) => {
    setSelectedCommit(commit.hash)
    dialog.show(() => <DialogCollabRevert commit={commit} />)
    // Clear selection after dialog opens (small delay for visual feedback)
    setTimeout(() => setSelectedCommit(null), 150)
  }

  const handleKeyDown = (e: KeyboardEvent, commit: CollabCommitInfo) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleRevert(commit)
    }
  }

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return "just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const getDateLabel = (ts: number): string => {
    const today = new Date()
    const date = new Date(ts)
    const isToday = date.toDateString() === today.toDateString()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) return "Today"
    if (isYesterday) return "Yesterday"
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Memoized: group commits with date dividers
  const commitsWithDates = createMemo((): TimelineItem[] => {
    const items: TimelineItem[] = []
    let lastDate = ""

    for (const commit of sortedHistory()) {
      const dateLabel = getDateLabel(commit.timestamp)
      if (dateLabel !== lastDate) {
        items.push({ type: "date", label: dateLabel })
        lastDate = dateLabel
      }
      items.push({ type: "commit", commit })
    }
    return items
  })

  const getNodeState = (hash: string): "default" | "hover" | "selected" => {
    if (selectedCommit() === hash) return "selected"
    if (hoveredCommit() === hash) return "hover"
    return "default"
  }

  return (
    <div class="flex flex-col h-full">
      <div class="flex justify-end items-center p-2">
        <Button variant="ghost" size="small" onClick={handleRefresh} disabled={loading()}>
          {loading() ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Show when={historyData.loading}>
        <div class="p-4 text-12-regular text-text-weak text-center">Loading...</div>
      </Show>

      <Show when={!historyData.loading && history().length === 0}>
        <div class="p-4 text-12-regular text-text-weak text-center">No commit history</div>
      </Show>

      <Show when={!historyData.loading && history().length > 0}>
        <div class="flex-1 overflow-auto">
          <div class="relative py-3 pr-3" style={{ "padding-left": `${TIMELINE_OFFSET + NODE_SIZE}px` }}>
            {/* Vertical timeline line */}
            <div class="absolute top-0 bottom-0 w-px bg-border-weak-base" style={{ left: `${TIMELINE_OFFSET}px` }} />

            {/* Current state indicator - visual anchor, not a commit */}
            <div class="relative flex items-center gap-3 mb-3">
              <div
                class="absolute rounded-full bg-icon-success-base border-2 border-background-base z-10"
                style={{
                  left: `${-NODE_SIZE * 1.5}px`,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: `${NODE_SIZE}px`,
                  height: `${NODE_SIZE}px`,
                }}
              />
              <span class="text-11-medium text-text-success">Current state</span>
            </div>

            {/* Timeline items */}
            <For each={commitsWithDates()}>
              {(item) => (
                <Show
                  when={item.type === "commit"}
                  fallback={
                    /* Date divider */
                    <div class="relative flex items-center gap-2 py-2 my-1">
                      <div
                        class="absolute h-px bg-border-weak-base"
                        style={{
                          left: `${-TIMELINE_OFFSET}px`,
                          width: `${NODE_SIZE}px`,
                        }}
                      />
                      <div class="h-px flex-1 bg-border-weak-base" />
                      <span class="text-10-medium text-text-weak px-2 shrink-0">
                        {(item as { type: "date"; label: string }).label}
                      </span>
                      <div class="h-px flex-1 bg-border-weak-base" />
                    </div>
                  }
                >
                  {(() => {
                    const commit = (item as { type: "commit"; commit: CollabCommitInfo }).commit
                    const state = () => getNodeState(commit.hash)
                    return (
                      /* Commit node - accessible button */
                      <button
                        type="button"
                        class="relative flex items-center gap-3 py-2 w-full text-left cursor-pointer group rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-icon-info-base focus-visible:ring-offset-2 focus-visible:ring-offset-background-base"
                        onMouseEnter={() => setHoveredCommit(commit.hash)}
                        onMouseLeave={() => setHoveredCommit(null)}
                        onClick={() => handleRevert(commit)}
                        onKeyDown={(e) => handleKeyDown(e, commit)}
                      >
                        {/* Commit dot */}
                        <div
                          classList={{
                            "absolute rounded-full border-2 border-background-base z-10 transition-all duration-150": true,
                            "bg-border-strong-base": state() === "default",
                            "bg-icon-info-base": state() === "hover",
                            "bg-icon-info-base scale-110": state() === "selected",
                          }}
                          style={{
                            left: `${-NODE_SIZE * 1.5}px`,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: `${NODE_SIZE}px`,
                            height: `${NODE_SIZE}px`,
                          }}
                        />
                        {/* Commit info */}
                        <div class="flex-1 min-w-0">
                          <div class="text-12-regular text-text-base truncate group-hover:text-text-info group-focus-visible:text-text-info transition-colors">
                            {commit.message}
                          </div>
                          <div class="text-11-regular text-text-weak">
                            {commit.author.name} · {formatTime(commit.timestamp)}
                          </div>
                        </div>
                        {/* Revert indicator - always visible on touch (opacity-60), hover on desktop */}
                        <div class="shrink-0 flex items-center gap-1 text-11-regular text-text-info opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 transition-opacity">
                          <Icon name="enter" size="small" />
                          <span class="hidden sm:inline">Revert</span>
                        </div>
                      </button>
                    )
                  })()}
                </Show>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
