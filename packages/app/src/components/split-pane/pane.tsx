import { For, Show, Match, Switch, createMemo, createEffect, on, onCleanup, onMount, createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { useSync } from "@/context/sync"
import { useFile } from "@/context/file"
import { useSDK } from "@/context/sdk"
import { useLayout } from "@/context/layout"
import { usePrompt } from "@/context/prompt"
import { usePermission } from "@/context/permission"
import { useCodeComponent } from "@anyon/ui/context/code"
import { useLocal } from "@/context/local"
import { usePlatform } from "@/context/platform"
import { SessionTurn } from "@anyon/ui/session-turn"
import { createAutoScroll } from "@anyon/ui/hooks"
import { SessionReview } from "@anyon/ui/session-review"
import { SessionMessageRail } from "@anyon/ui/session-message-rail"
import { FileViewer } from "@/components/file-viewer"
import { TextSelectionPopup } from "@/components/text-selection-popup"
import { PromptInput } from "@/components/prompt-input"
import { PreviewPane } from "@/components/preview/preview-pane"
import {
  SessionContextTab,
  SortableTab,
  SortableSessionTab,
  FileVisual,
  NewSessionView,
} from "@/components/session"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { same } from "@/utils/same"
import type { UserMessage } from "@anyon/sdk/v2"
import type { FileDiff } from "@anyon/sdk/v2/client"
import { PaneTabBar } from "./pane-tab-bar"
import type { PaneLeaf } from "./types"

export interface PaneProps {
  leaf: PaneLeaf
  isFocused: boolean
  onFocus: () => void
  onActiveSessionChange: (sessionId: string | undefined) => void
  onSplit: (tabToMove?: string) => void
  canSplit: boolean
  isDesktop: boolean
  sessionKey: string
  newSessionWorktree: string
  onNewSessionWorktreeReset: () => void
}

export function Pane(props: PaneProps) {
  const sync = useSync()
  const file = useFile()
  const sdk = useSDK()
  const layout = useLayout()
  const prompt = usePrompt()
  const permission = usePermission()
  const local = useLocal()
  const platform = usePlatform()

  // Per-pane tab API from split layout
  const splitApi = createMemo(() => layout.split(props.sessionKey))
  const paneTabs = createMemo(() => splitApi().pane(props.leaf.id))

  // Track opened preview URLs to avoid duplicates
  const openedPreviewUrls = new Set<string>()

  // Derive activeSessionId from this pane's active tab
  const activeSessionId = createMemo(() => {
    const active = paneTabs().active()
    if (active?.startsWith("session-")) {
      return active.replace("session-", "")
    }
    return undefined
  })

  // Track the last active session tab (for returning after file operations)
  const [lastActiveSession, setLastActiveSession] = createSignal<string | undefined>()

  // Notify parent when active session changes
  createEffect(() => {
    props.onActiveSessionChange(activeSessionId())
  })

  // Per-pane store for scroll spy and message expansion
  const [store, setStore] = createStore({
    expanded: {} as Record<string, boolean>,
    messageId: undefined as string | undefined,
    activeDraggable: undefined as string | undefined,
  })

  // Session data memos (all derived from activeSessionId)
  const info = createMemo(() => (activeSessionId() ? sync.session.get(activeSessionId()!) : undefined))
  const getSessionTitle = (sessionId: string) => {
    const session = sync.session.get(sessionId)
    return session?.title || "New Session"
  }
  const revertMessageID = createMemo(() => info()?.revert?.messageID)
  const messages = createMemo(() => (activeSessionId() ? (sync.data.message[activeSessionId()!] ?? []) : []))
  const messagesReady = createMemo(() => {
    const id = activeSessionId()
    if (!id) return true
    return sync.data.message[id] !== undefined
  })
  const emptyUserMessages: UserMessage[] = []
  const userMessages = createMemo(() => messages().filter((m) => m.role === "user") as UserMessage[], emptyUserMessages)
  const visibleUserMessages = createMemo(() => {
    const revert = revertMessageID()
    if (!revert) return userMessages()
    return userMessages().filter((m) => m.id < revert)
  }, emptyUserMessages)
  const lastUserMessage = createMemo(() => visibleUserMessages().at(-1))

  const idle = { type: "idle" as const }
  const status = createMemo(() => sync.data.session_status[activeSessionId() ?? ""] ?? idle)
  const diffs = createMemo(() => (activeSessionId() ? (sync.data.session_diff[activeSessionId()!] ?? []) : []))

  const activeMessage = createMemo(() => {
    if (!store.messageId) return lastUserMessage()
    const found = visibleUserMessages()?.find((m) => m.id === store.messageId)
    return found ?? lastUserMessage()
  })
  const setActiveMessage = (message: UserMessage | undefined) => {
    setStore("messageId", message?.id)
  }

  const isWorking = createMemo(() => status().type !== "idle")

  // Tab memos (derived from pane's leaf tabs)
  const contextOpen = createMemo(() => paneTabs().active() === "context" || paneTabs().tabs().includes("context"))
  const contextActive = createMemo(() => paneTabs().active() === "context")
  const openedTabs = createMemo(() =>
    paneTabs()
      .tabs()
      .filter((tab) => tab !== "context"),
  )
  const allTabs = createMemo(() =>
    paneTabs()
      .tabs()
      .filter((tab) => tab.startsWith("session-") || tab.startsWith("file://") || tab.startsWith("preview://")),
  )
  const hasFileTabs = createMemo(() => allTabs().some((tab) => tab.startsWith("file://")))
  const activeFileTab = createMemo(() => {
    const active = paneTabs().active()
    if (!active?.startsWith("file://")) return null
    return file.pathFromTab(active)
  })
  const activePreviewTab = createMemo(() => {
    const active = paneTabs().active()
    if (!active?.startsWith("preview://")) return null
    return file.previewFromTab(active)
  })
  const reviewTab = createMemo(() => diffs().length > 0 || paneTabs().active() === "review")
  const mobileReview = createMemo(() => !props.isDesktop && diffs().length > 0)
  const showTabs = createMemo(() => props.isDesktop)

  const activeTab = createMemo(() => {
    const active = paneTabs().active()
    if (active) return active
    if (reviewTab()) return "review"
    const first = openedTabs()[0]
    if (first) return first
    if (contextOpen()) return "context"
    return "review"
  })

  // Scroll management (per-pane)
  const autoScroll = createAutoScroll({
    working: isWorking,
  })

  let scroller: HTMLDivElement | undefined
  let scrollSpyFrame: number | undefined
  let scrollSpyTarget: HTMLDivElement | undefined

  const anchor = (id: string) => `message-${id}`

  const setScrollRef = (el: HTMLDivElement | undefined) => {
    scroller = el
    autoScroll.scrollRef(el)
  }

  const updateHash = (id: string) => {
    if (!props.isFocused) return
    window.history.replaceState(null, "", `#${anchor(id)}`)
  }

  const scrollToMessage = (message: UserMessage, behavior: ScrollBehavior = "smooth") => {
    setActiveMessage(message)
    const el = document.getElementById(anchor(message.id))
    if (el && scroller) {
      scroller.scrollTo({ top: el.offsetTop, behavior })
    }
    updateHash(message.id)
  }

  const getActiveMessageId = (container: HTMLDivElement) => {
    const cutoff = container.scrollTop + 100
    const nodes = container.querySelectorAll<HTMLElement>("[data-message-id]")
    let id: string | undefined
    for (const node of nodes) {
      const next = node.dataset.messageId
      if (!next) continue
      if (node.offsetTop > cutoff) break
      id = next
    }
    return id
  }

  const scheduleScrollSpy = (container: HTMLDivElement) => {
    scrollSpyTarget = container
    if (scrollSpyFrame !== undefined) return
    scrollSpyFrame = requestAnimationFrame(() => {
      scrollSpyFrame = undefined
      const target = scrollSpyTarget
      scrollSpyTarget = undefined
      if (!target) return
      const id = getActiveMessageId(target)
      if (!id) return
      if (id === store.messageId) return
      setStore("messageId", id)
    })
  }

  function navigateMessageByOffset(offset: number) {
    const msgs = visibleUserMessages()
    if (msgs.length === 0) return
    const current = activeMessage()
    const currentIndex = current ? msgs.findIndex((m) => m.id === current.id) : -1
    let targetIndex: number
    if (currentIndex === -1) {
      targetIndex = offset > 0 ? 0 : msgs.length - 1
    }
    targetIndex = currentIndex + offset
    if (targetIndex < 0 || targetIndex >= msgs.length) return
    scrollToMessage(msgs[targetIndex], "auto")
  }

  // Tab helpers
  function normalizeTab(tab: string) {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }

  function normalizeTabs(list: string[]) {
    const seen = new Set<string>()
    const next: string[] = []
    for (const item of list) {
      const value = normalizeTab(item)
      if (seen.has(value)) continue
      seen.add(value)
      next.push(value)
    }
    return next
  }

  const openTab = (value: string) => {
    const next = normalizeTab(value)
    if (next.startsWith("file://")) {
      const currentActive = paneTabs().active()
      if (currentActive?.startsWith("session-")) {
        setLastActiveSession(currentActive)
      }
    }
    paneTabs().open(next)
    const path = file.pathFromTab(next)
    if (path) file.load(path)
  }

  const closeTab = (tab: string) => {
    paneTabs().close(tab)
  }

  // Handle ask about selection from file viewer
  const handleAskAboutSelection = (selection: { text: string; startLine: number; endLine: number }) => {
    const path = activeFileTab()
    if (!path) return
    prompt.context.add({
      type: "file",
      path,
      selection: {
        startLine: selection.startLine,
        endLine: selection.endLine,
        startChar: 0,
        endChar: 0,
      },
    })
    const targetSession = lastActiveSession()
    if (targetSession) {
      paneTabs().setActive(targetSession)
      return
    }
    paneTabs().setActive(undefined)
  }

  // === EFFECTS ===

  // Sync active session
  createEffect(() => {
    if (!activeSessionId()) return
    sync.session.sync(activeSessionId()!)
  })

  // Agent/model tracking (only from focused pane)
  createEffect(
    on(
      () => lastUserMessage()?.id,
      () => {
        if (!props.isFocused) return
        const msg = lastUserMessage()
        if (!msg) return
        if (msg.agent) local.agent.set(msg.agent)
        if (msg.model) local.model.set(msg.model)
      },
    ),
  )

  // Auto-load file from active tab
  createEffect(() => {
    const active = paneTabs().active()
    if (!active) return
    const path = file.pathFromTab(active)
    if (path) file.load(path)
  })

  // Normalize file tabs (dedup)
  createEffect(() => {
    const current = paneTabs().tabs()
    if (current.length === 0) return
    const next = normalizeTabs(current)
    if (same(current, next)) return
    // Need to update all tabs for this pane
    // For now, we handle this via the layout API
  })

  // Clear messageId on new last message
  createEffect(
    on(
      () => visibleUserMessages().at(-1)?.id,
      (lastId, prevLastId) => {
        if (lastId && prevLastId && lastId > prevLastId) {
          setStore("messageId", undefined)
        }
      },
      { defer: true },
    ),
  )

  // Clear messageId/expanded on session change
  createEffect(
    on(
      () => activeSessionId(),
      () => {
        setStore("messageId", undefined)
        setStore("expanded", {})
      },
      { defer: true },
    ),
  )

  // Auto-expand last message if working
  createEffect(() => {
    const id = lastUserMessage()?.id
    if (!id) return
    setStore("expanded", id, status().type !== "idle")
  })

  // Set default active tab
  createEffect(() => {
    if (!layout.ready()) return
    if (paneTabs().active()) return
    if (diffs().length === 0 && openedTabs().length === 0 && !contextOpen()) return
    paneTabs().setActive(activeTab())
  })

  // Restore scroll from hash on mount (only focused pane)
  createEffect(() => {
    const sessionID = activeSessionId()
    const ready = messagesReady()
    if (!sessionID || !ready) return
    requestAnimationFrame(() => {
      if (props.isFocused) {
        const id = window.location.hash.slice(1)
        const hashTarget = id ? document.getElementById(id) : undefined
        if (hashTarget) {
          hashTarget.scrollIntoView({ behavior: "auto", block: "start" })
          return
        }
      }
      autoScroll.forceScrollToBottom()
    })
  })

  // Detect localhost URLs in AI tool output
  createEffect(() => {
    const sessionId = activeSessionId()
    if (!sessionId) return
    const msgs = sync.data.message[sessionId] ?? []
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "")
    for (const msg of msgs) {
      const parts = sync.data.part[msg.id] ?? []
      for (const part of parts) {
        if (part.type !== "tool") continue
        if (part.state.status !== "completed") continue
        const output = stripAnsi(part.state.output ?? "")
        const serverReadyPatterns = [
          /Local:\s*(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/i,
          /listening.*?(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/i,
          /started.*?(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/i,
          /running.*?(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/i,
        ]
        for (const pattern of serverReadyPatterns) {
          const match = output.match(pattern)
          if (match && match[1] && !openedPreviewUrls.has(match[1])) {
            openedPreviewUrls.add(match[1])
            paneTabs().open(`preview://url:${match[1]}`)
            break
          }
        }
      }
    }
  })

  // Intercept localhost link clicks to open in preview tab
  onMount(() => {
    const handler = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) return
      const target = e.target as HTMLElement
      const anchor = target.closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href) return
      try {
        const url = new URL(href)
        const isHttpUrl = url.protocol === "http:" || url.protocol === "https:"
        if (isHttpUrl) {
          e.preventDefault()
          e.stopPropagation()
          const previewTabValue = file.previewTab(href)
          openTab(previewTabValue)
        }
      } catch {
        // Invalid URL, ignore
      }
    }
    document.addEventListener("click", handler, true)
    onCleanup(() => document.removeEventListener("click", handler, true))
  })

  // Cleanup
  onCleanup(() => {
    if (scrollSpyFrame !== undefined) cancelAnimationFrame(scrollSpyFrame)
  })

  // DnD handlers for tab reordering within this pane
  const handleDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeDraggable", id)
  }

  const handleDragOver = (_event: DragEvent) => {
    // SortableProvider handles visual reordering during drag
  }

  const handleDragEnd = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (draggable && droppable) {
      const currentTabs = paneTabs().tabs()
      const fromIndex = currentTabs.indexOf(draggable.id.toString())
      const toIndex = currentTabs.indexOf(droppable.id.toString())
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        paneTabs().move(draggable.id.toString(), toIndex)
      }
    }
    setStore("activeDraggable", undefined)
  }

  const view = createMemo(() => layout.view(props.sessionKey))

  // Per-pane prompt height tracking
  const [promptHeight, setPromptHeight] = createSignal(0)
  let promptDock: HTMLDivElement | undefined

  createResizeObserver(
    () => promptDock,
    ({ height }) => {
      const next = Math.ceil(height)
      if (next === promptHeight()) return
      setPromptHeight(next)
    },
  )

  return (
    <div
      class="flex flex-col flex-1 min-h-0 h-full relative"
      style={{ "--prompt-height": promptHeight() ? `${promptHeight()}px` : undefined }}
      onClick={() => props.onFocus()}
    >
      {/* Tab bar with DragDrop for this pane */}
      <DragDropProvider
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        collisionDetector={closestCenter}
      >
        <DragDropSensors />
        <ConstrainDragYAxis />
        <PaneTabBar
          tabs={allTabs()}
          active={paneTabs().active()}
          onTabClick={openTab}
          onTabClose={closeTab}
          onNewSession={async () => {
            const newSession = await sdk.client.session.create().then((x) => x.data)
            if (newSession) {
              paneTabs().open(`session-${newSession.id}`)
              setLastActiveSession(`session-${newSession.id}`)
            }
          }}
          onSplit={async () => {
            const newSession = await sdk.client.session.create().then((x) => x.data)
            if (newSession) {
              props.onSplit(`session-${newSession.id}`)
            }
          }}
          canSplit={props.canSplit}
          showContextTab={contextOpen()}
          onContextClose={() => paneTabs().close("context")}
          rightPanelOpened={layout.rightPanel.opened()}
          getSessionTitle={getSessionTitle}
        />
        <DragOverlay>
          <Show when={store.activeDraggable}>
            {(draggedId) => {
              const isSession = () => draggedId().startsWith("session-")
              const sessionId = () => draggedId().replace("session-", "")
              const path = createMemo(() => file.pathFromTab(draggedId()))
              return (
                <div class="relative p-1 h-12 flex items-center bg-background-stronger text-14-regular">
                  <Show
                    when={isSession()}
                    fallback={<Show when={path()}>{(p) => <FileVisual path={p()} />}</Show>}
                  >
                    <span class="ml-1 truncate">{getSessionTitle(sessionId())}</span>
                  </Show>
                </div>
              )
            }}
          </Show>
        </DragOverlay>
      </DragDropProvider>

      {/* Content area */}
      <div
        classList={{
          "flex-1 min-h-0 overflow-hidden relative": true,
          "py-6 md:py-3": !activeSessionId() && !hasFileTabs(),
        }}
      >
        <Switch>
          <Match when={activePreviewTab()}>{(preview) => <PreviewPane preview={preview()} />}</Match>
          <Match when={activeFileTab()}>
            {(path) => (
              <div
                class="absolute inset-x-0 top-0"
                style={{
                  "background-color": "#1e1e1e",
                  bottom: "calc(var(--prompt-height, 8rem) + 32px)",
                }}
              >
                <FileViewer path={path()} onAskAboutSelection={handleAskAboutSelection} />
              </div>
            )}
          </Match>
          <Match when={contextActive()}>
            <div class="relative h-full overflow-hidden">
              <SessionContextTab
                messages={messages}
                visibleUserMessages={() => visibleUserMessages()}
                view={() => view()}
                info={() => info()}
              />
            </div>
          </Match>
          <Match when={activeSessionId()}>
            <Show when={activeMessage()}>
              <Show
                when={!mobileReview()}
                fallback={
                  <div class="relative h-full overflow-hidden">
                    <SessionReview
                      diffs={diffs()}
                      diffStyle="unified"
                      open={view().review.open()}
                      onOpenChange={view().review.setOpen}
                      classes={{
                        root: "pb-[calc(var(--prompt-height,8rem)+32px)]",
                        header: "px-4",
                        container: "px-4",
                      }}
                    />
                  </div>
                }
              >
                <div class="relative w-full h-full min-w-0">
                  <Show when={props.isDesktop}>
                    <div class="absolute inset-0 pointer-events-none z-10">
                      <SessionMessageRail
                        messages={visibleUserMessages()}
                        current={activeMessage()}
                        onMessageSelect={scrollToMessage}
                        wide={!showTabs()}
                        class="pointer-events-auto"
                      />
                    </div>
                  </Show>
                  <div
                    ref={setScrollRef}
                    onScroll={(e) => {
                      autoScroll.handleScroll()
                      if (props.isDesktop) scheduleScrollSpy(e.currentTarget)
                    }}
                    onClick={autoScroll.handleInteraction}
                    class="relative min-w-0 w-full h-full overflow-y-auto no-scrollbar"
                  >
                    <TextSelectionPopup>
                      <div
                        ref={autoScroll.contentRef}
                        class="flex flex-col gap-32 items-start justify-start pb-[calc(var(--prompt-height,8rem)+64px)] md:pb-[calc(var(--prompt-height,10rem)+64px)] transition-[margin]"
                        classList={{
                          "mt-0.5": !showTabs(),
                          "mt-0": showTabs(),
                        }}
                      >
                        <For each={visibleUserMessages()}>
                          {(message) => (
                            <div
                              id={anchor(message.id)}
                              data-message-id={message.id}
                              classList={{
                                "min-w-0 w-full max-w-full": true,
                                "last:min-h-[calc(100vh-5.5rem-var(--prompt-height,8rem)-64px)] md:last:min-h-[calc(100vh-4.5rem-var(--prompt-height,10rem)-64px)]":
                                  platform.platform !== "desktop",
                                "last:min-h-[calc(100vh-7rem-var(--prompt-height,8rem)-64px)] md:last:min-h-[calc(100vh-6rem-var(--prompt-height,10rem)-64px)]":
                                  platform.platform === "desktop",
                              }}
                            >
                              <SessionTurn
                                sessionID={activeSessionId()!}
                                messageID={message.id}
                                lastUserMessageID={lastUserMessage()?.id}
                                stepsExpanded={store.expanded[message.id] ?? false}
                                onStepsExpandedToggle={() =>
                                  setStore("expanded", message.id, (open: boolean | undefined) => !open)
                                }
                                classes={{
                                  root: "min-w-0 w-full relative",
                                  content:
                                    "flex flex-col justify-between !overflow-visible [&_[data-slot=session-turn-message-header]]:top-[-32px]",
                                  container:
                                    "px-4 md:px-6 " +
                                    (!showTabs()
                                      ? "md:max-w-200 md:mx-auto"
                                      : visibleUserMessages().length > 1
                                        ? "md:pr-6 md:pl-18"
                                        : ""),
                                }}
                              />
                            </div>
                          )}
                        </For>
                      </div>
                    </TextSelectionPopup>
                  </div>
                </div>
              </Show>
            </Show>
          </Match>
          <Match when={true}>
            <NewSessionView
              worktree="main"
              onWorktreeChange={() => {}}
            />
          </Match>
        </Switch>
      </div>

      {/* Per-pane prompt input */}
      <div
        ref={(el) => (promptDock = el)}
        class="absolute inset-x-0 bottom-0 pt-12 pb-4 md:pb-8 flex flex-col justify-center items-center z-50 px-4 md:px-0 bg-gradient-to-t from-background-stronger via-background-stronger to-transparent pointer-events-none"
      >
        <div class="w-full md:px-6 pointer-events-auto">
          <PromptInput
            activeSessionId={activeSessionId()}
            newSessionWorktree={props.newSessionWorktree}
            onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
            onMessageSent={() => {
              const active = paneTabs().active()
              if (active?.startsWith("session-")) {
                setLastActiveSession(active)
              }
              if (active?.startsWith("preview://") || active?.startsWith("file://")) {
                const sessionTab = lastActiveSession()
                if (sessionTab) paneTabs().setActive(sessionTab)
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
