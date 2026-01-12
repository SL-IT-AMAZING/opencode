import { For, onCleanup, Show, Match, Switch, createMemo, createEffect, on, createSignal } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { Dynamic } from "solid-js/web"
import { useLocal } from "@/context/local"
import { selectionFromLines, useFile, type SelectedLineRange } from "@/context/file"
import { createStore } from "solid-js/store"
import { PromptInput } from "@/components/prompt-input"
import { SessionContextUsage } from "@/components/session-context-usage"
import { IconButton } from "@anyon/ui/icon-button"
import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { Tooltip, TooltipKeybind } from "@anyon/ui/tooltip"
import { DiffChanges } from "@anyon/ui/diff-changes"
import { ResizeHandle } from "@anyon/ui/resize-handle"
import { Tabs } from "@anyon/ui/tabs"
import { useCodeComponent } from "@anyon/ui/context/code"
import { SessionTurn } from "@anyon/ui/session-turn"
import { createAutoScroll } from "@anyon/ui/hooks"
import { SessionReview } from "@anyon/ui/session-review"
import { SessionMessageRail } from "@anyon/ui/session-message-rail"

import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { useSync } from "@/context/sync"
import { useTerminal, type LocalPTY } from "@/context/terminal"
import { useLayout } from "@/context/layout"
import { Terminal } from "@/components/terminal"
import { QuickActionBar } from "@/components/quick-action-bar"
import { FileExplorerPanel } from "@/components/file-explorer-panel"
import { CollabTimeline } from "@/components/collab-timeline"
import { CollabTeam } from "@/components/collab-team"
import { FileViewer } from "@/components/file-viewer"
import { checksum, base64Encode, base64Decode } from "@anyon/util/encode"
import { useDialog } from "@anyon/ui/context/dialog"
import { DialogSelectFile } from "@/components/dialog-select-file"
import { DialogSelectModel } from "@/components/dialog-select-model"
import { DialogSelectMcp } from "@/components/dialog-select-mcp"
import { DialogGitInit } from "@/components/dialog-git-init"
import { DialogGitHubConnect } from "@/components/dialog-github-connect"
import { useCommand } from "@/context/command"
import { useNavigate, useParams } from "@solidjs/router"
import { UserMessage } from "@anyon/sdk/v2"
import type { FileDiff } from "@anyon/sdk/v2/client"
import { useSDK } from "@/context/sdk"
import { usePrompt } from "@/context/prompt"
import { extractPromptFromParts } from "@/utils/prompt"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { usePermission } from "@/context/permission"
import { showToast } from "@anyon/ui/toast"
import {
  SessionContextTab,
  SortableTab,
  SortableSessionTab,
  FileVisual,
  SortableTerminalTab,
  NewSessionView,
} from "@/components/session"
import { usePlatform } from "@/context/platform"
import { same } from "@/utils/same"

type DiffStyle = "unified" | "split"

interface SessionReviewTabProps {
  diffs: () => FileDiff[]
  view: () => ReturnType<ReturnType<typeof useLayout>["view"]>
  diffStyle: DiffStyle
  onDiffStyleChange?: (style: DiffStyle) => void
  classes?: {
    root?: string
    header?: string
    container?: string
  }
}

function SessionReviewTab(props: SessionReviewTabProps) {
  let scroll: HTMLDivElement | undefined
  let frame: number | undefined
  let pending: { x: number; y: number } | undefined

  const restoreScroll = (retries = 0) => {
    const el = scroll
    if (!el) return

    const s = props.view().scroll("review")
    if (!s) return

    // Wait for content to be scrollable - content may not have rendered yet
    if (el.scrollHeight <= el.clientHeight && retries < 10) {
      requestAnimationFrame(() => restoreScroll(retries + 1))
      return
    }

    if (el.scrollTop !== s.y) el.scrollTop = s.y
    if (el.scrollLeft !== s.x) el.scrollLeft = s.x
  }

  const handleScroll = (event: Event & { currentTarget: HTMLDivElement }) => {
    pending = {
      x: event.currentTarget.scrollLeft,
      y: event.currentTarget.scrollTop,
    }
    if (frame !== undefined) return

    frame = requestAnimationFrame(() => {
      frame = undefined

      const next = pending
      pending = undefined
      if (!next) return

      props.view().setScroll("review", next)
    })
  }

  createEffect(
    on(
      () => props.diffs().length,
      () => {
        requestAnimationFrame(restoreScroll)
      },
      { defer: true },
    ),
  )

  onCleanup(() => {
    if (frame === undefined) return
    cancelAnimationFrame(frame)
  })

  return (
    <SessionReview
      scrollRef={(el: HTMLDivElement | undefined) => {
        scroll = el
        restoreScroll()
      }}
      onScroll={handleScroll}
      open={props.view().review.open()}
      onOpenChange={props.view().review.setOpen}
      classes={{
        root: props.classes?.root ?? "pb-40",
        header: props.classes?.header ?? "px-6",
        container: props.classes?.container ?? "px-6",
      }}
      diffs={props.diffs()}
      diffStyle={props.diffStyle}
      onDiffStyleChange={props.onDiffStyleChange}
    />
  )
}

export default function Page() {
  const layout = useLayout()
  const local = useLocal()
  const file = useFile()
  const sync = useSync()
  const terminal = useTerminal()
  const dialog = useDialog()
  const codeComponent = useCodeComponent()
  const command = useCommand()
  const platform = usePlatform()
  const params = useParams()
  const navigate = useNavigate()
  const sdk = useSDK()
  const prompt = usePrompt()
  const permission = usePermission()
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const tabs = createMemo(() => layout.tabs(sessionKey()))
  const view = createMemo(() => layout.view(sessionKey()))
  const sessions = createMemo(() => layout.sessions(params.dir ?? ""))

  // Derive current session from active tab (for multi-tab support)
  const activeSessionId = createMemo(() => {
    const active = tabs().active()
    if (active?.startsWith("session-")) {
      return active.replace("session-", "")
    }
    // Fall back to URL param when no session tab is active
    return params.id
  })

  // Track the last active session tab (for returning after file operations)
  const [lastActiveSession, setLastActiveSession] = createSignal<string | undefined>()

  const isDesktop = createMediaQuery("(min-width: 768px)")

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
    // Track last session before switching to a file tab
    if (next.startsWith("file://")) {
      const currentActive = tabs().active()
      if (currentActive?.startsWith("session-")) {
        setLastActiveSession(currentActive)
      }
    }
    tabs().open(next)
    const path = file.pathFromTab(next)
    if (path) file.load(path)
  }

  createEffect(() => {
    const active = tabs().active()
    if (!active) return

    const path = file.pathFromTab(active)
    if (path) file.load(path)
  })

  createEffect(() => {
    const current = tabs().all()
    if (current.length === 0) return

    const next = normalizeTabs(current)
    if (same(current, next)) return

    tabs().setAll(next)

    const active = tabs().active()
    if (!active) return
    if (!active.startsWith("file://")) return

    const normalized = normalizeTab(active)
    if (active === normalized) return
    tabs().setActive(normalized)
  })

  // Auto-add session to open tabs when navigating via sidebar
  createEffect(() => {
    const sessionId = params.id
    if (!sessionId) return
    // Only add and set active if session wasn't already open
    const sessionTab = `session-${sessionId}`
    const wasOpen = tabs().all().includes(sessionTab)
    if (!wasOpen) {
      // Add to unified tabs list (appends to end - Chrome style)
      tabs().open(sessionTab)
      // Also track in sessions for sidebar
      sessions().open(sessionId)
    }
  })

  // Auto git init dialog when opening a folder without .git
  // Use localStorage to persist "already asked" state across page reloads
  const GIT_INIT_ASKED_KEY = "git-init-asked"
  const getAskedFolders = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(GIT_INIT_ASKED_KEY) || "[]")
    } catch {
      return []
    }
  }
  const markAsked = (dir: string) => {
    const asked = getAskedFolders()
    if (!asked.includes(dir)) {
      localStorage.setItem(GIT_INIT_ASKED_KEY, JSON.stringify([...asked, dir]))
    }
  }
  const isUserFolder = (path: string) => path.startsWith("/Users/") || path.startsWith("/home/")

  createEffect(() => {
    // Use sync.directory (from URL) instead of sync.project?.worktree
    // because new folders aren't registered as projects yet
    const directory = sync.directory
    if (!directory) return
    if (!isUserFolder(directory)) return

    // Check localStorage to see if we already asked about this folder
    if (getAskedFolders().includes(directory)) return

    // Ensure terminal panel is open
    if (!layout.terminal.opened()) {
      layout.terminal.open()
    }

    // Delay to wait for terminal WebSocket connection
    setTimeout(() => {
      sdk.client.file
        .list({ path: "." })
        .then((res) => {
          const hasGit = res.data?.some((f) => f.name === ".git")
          if (!hasGit) {
            // Show dialog to choose git init or clone
            dialog.show(() => (
              <DialogGitInit
                onInit={() => {
                  const ref = terminal.activeRef?.()
                  if (ref?.write) {
                    // Clear line (Ctrl+U) before command to avoid leftover chars
                    ref.write("\x15git init && git branch -M main\n")
                  }
                }}
                onClone={(url) => {
                  const ref = terminal.activeRef?.()
                  if (ref?.write) {
                    // Clear line (Ctrl+U) before command to avoid leftover chars
                    ref.write(`\x15git clone ${url} . && npm install\n`)
                  }
                }}
                onShowGitHubConnect={() => {
                  // Show GitHub connect dialog to create remote repo
                  dialog.show(() => (
                    <DialogGitHubConnect
                      onConnect={(repoUrl) => {
                        const ref = terminal.activeRef?.()
                        if (ref?.write) {
                          // Add remote and push
                          ref.write(
                            `\x15git remote add origin ${repoUrl} && git add -A && git commit -m "Initial commit" && git push -u origin main\n`,
                          )
                        }
                      }}
                      onSkip={() => {
                        // User skipped, no action needed
                      }}
                    />
                  ))
                }}
              />
            ))
          }
          // Mark this folder as asked (regardless of choice) to prevent repeated popups
          markAsked(directory)
        })
        .catch(() => {
          // If file.list fails, still mark as asked to avoid repeated attempts
          markAsked(directory)
        })
    }, 500)
  })

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

  createEffect(
    on(
      () => lastUserMessage()?.id,
      () => {
        const msg = lastUserMessage()
        if (!msg) return
        if (msg.agent) local.agent.set(msg.agent)
        if (msg.model) local.model.set(msg.model)
      },
    ),
  )

  const [store, setStore] = createStore({
    activeDraggable: undefined as string | undefined,
    activeTerminalDraggable: undefined as string | undefined,
    expanded: {} as Record<string, boolean>,
    messageId: undefined as string | undefined,
    mobileTab: "session" as "session" | "review",
    newSessionWorktree: "main",
    promptHeight: 0,
  })

  const newSessionWorktree = createMemo(() => {
    if (store.newSessionWorktree === "create") return "create"
    const project = sync.project
    if (project && sync.data.path.directory !== project.worktree) return sync.data.path.directory
    return "main"
  })

  const activeMessage = createMemo(() => {
    if (!store.messageId) return lastUserMessage()
    const found = visibleUserMessages()?.find((m) => m.id === store.messageId)
    return found ?? lastUserMessage()
  })
  const setActiveMessage = (message: UserMessage | undefined) => {
    setStore("messageId", message?.id)
  }

  function navigateMessageByOffset(offset: number) {
    const msgs = visibleUserMessages()
    if (msgs.length === 0) return

    const current = activeMessage()
    const currentIndex = current ? msgs.findIndex((m) => m.id === current.id) : -1

    let targetIndex: number
    if (currentIndex === -1) {
      targetIndex = offset > 0 ? 0 : msgs.length - 1
    } else {
      targetIndex = currentIndex + offset
    }

    if (targetIndex < 0 || targetIndex >= msgs.length) return

    scrollToMessage(msgs[targetIndex], "auto")
  }

  const diffs = createMemo(() => (activeSessionId() ? (sync.data.session_diff[activeSessionId()!] ?? []) : []))

  const idle = { type: "idle" as const }
  let inputRef!: HTMLDivElement
  let promptDock: HTMLDivElement | undefined
  let scroller: HTMLDivElement | undefined

  createEffect(() => {
    if (!activeSessionId()) return
    sync.session.sync(activeSessionId()!)
  })

  createEffect(() => {
    if (layout.terminal.opened()) {
      if (terminal.all().length === 0) {
        terminal.new()
      }
    }
  })

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

  const status = createMemo(() => sync.data.session_status[activeSessionId() ?? ""] ?? idle)

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

  createEffect(() => {
    const id = lastUserMessage()?.id
    if (!id) return
    setStore("expanded", id, status().type !== "idle")
  })

  command.register(() => [
    {
      id: "session.new",
      title: "New session",
      description: "Create a new session",
      category: "Session",
      keybind: "mod+shift+s",
      slash: "new",
      onSelect: () => navigate(`/${params.dir}/session`),
    },
    {
      id: "file.open",
      title: "Open file",
      description: "Search and open a file",
      category: "File",
      keybind: "mod+p",
      slash: "open",
      onSelect: () => dialog.show(() => <DialogSelectFile />),
    },
    {
      id: "terminal.toggle",
      title: "Toggle terminal",
      description: "Show or hide the terminal",
      category: "View",
      keybind: "ctrl+`",
      slash: "terminal",
      onSelect: () => layout.terminal.toggle(),
    },
    {
      id: "review.toggle",
      title: "Toggle review",
      description: "Show or hide the review panel",
      category: "View",
      keybind: "mod+shift+r",
      onSelect: () => layout.review.toggle(),
    },
    {
      id: "terminal.new",
      title: "New terminal",
      description: "Create a new terminal tab",
      category: "Terminal",
      keybind: "ctrl+shift+`",
      onSelect: () => terminal.new(),
    },
    {
      id: "steps.toggle",
      title: "Toggle steps",
      description: "Show or hide steps for the current message",
      category: "View",
      keybind: "mod+e",
      slash: "steps",
      disabled: !activeSessionId(),
      onSelect: () => {
        const msg = activeMessage()
        if (!msg) return
        setStore("expanded", msg.id, (open: boolean | undefined) => !open)
      },
    },
    {
      id: "message.previous",
      title: "Previous message",
      description: "Go to the previous user message",
      category: "Session",
      keybind: "mod+arrowup",
      disabled: !activeSessionId(),
      onSelect: () => navigateMessageByOffset(-1),
    },
    {
      id: "message.next",
      title: "Next message",
      description: "Go to the next user message",
      category: "Session",
      keybind: "mod+arrowdown",
      disabled: !activeSessionId(),
      onSelect: () => navigateMessageByOffset(1),
    },
    {
      id: "model.choose",
      title: "Choose model",
      description: "Select a different model",
      category: "Model",
      keybind: "mod+'",
      slash: "model",
      onSelect: () => dialog.show(() => <DialogSelectModel />),
    },
    {
      id: "mcp.toggle",
      title: "Toggle MCPs",
      description: "Toggle MCPs",
      category: "MCP",
      keybind: "mod+;",
      slash: "mcp",
      onSelect: () => dialog.show(() => <DialogSelectMcp />),
    },
    {
      id: "agent.cycle",
      title: "Cycle agent",
      description: "Switch to the next agent",
      category: "Agent",
      keybind: "mod+.",
      slash: "agent",
      onSelect: () => local.agent.move(1),
    },
    {
      id: "agent.cycle.reverse",
      title: "Cycle agent backwards",
      description: "Switch to the previous agent",
      category: "Agent",
      keybind: "shift+mod+.",
      onSelect: () => local.agent.move(-1),
    },
    {
      id: "model.variant.cycle",
      title: "Cycle thinking effort",
      description: "Switch to the next effort level",
      category: "Model",
      keybind: "shift+mod+t",
      onSelect: () => {
        local.model.variant.cycle()
        showToast({
          title: "Thinking effort changed",
          description: "The thinking effort has been changed to " + (local.model.variant.current() ?? "Default"),
        })
      },
    },
    {
      id: "permissions.autoaccept",
      title:
        activeSessionId() && permission.isAutoAccepting(activeSessionId()!)
          ? "Stop auto-accepting edits"
          : "Auto-accept edits",
      category: "Permissions",
      keybind: "mod+shift+a",
      disabled: !activeSessionId() || !permission.permissionsEnabled(),
      onSelect: () => {
        const sessionID = activeSessionId()
        if (!sessionID) return
        permission.toggleAutoAccept(sessionID, sdk.directory)
        showToast({
          title: permission.isAutoAccepting(sessionID) ? "Auto-accepting edits" : "Stopped auto-accepting edits",
          description: permission.isAutoAccepting(sessionID)
            ? "Edit and write permissions will be automatically approved"
            : "Edit and write permissions will require approval",
        })
      },
    },
    {
      id: "session.undo",
      title: "Undo",
      description: "Undo the last message",
      category: "Session",
      slash: "undo",
      disabled: !activeSessionId() || visibleUserMessages().length === 0,
      onSelect: async () => {
        const sessionID = activeSessionId()
        if (!sessionID) return
        if (status()?.type !== "idle") {
          await sdk.client.session.abort({ sessionID }).catch(() => {})
        }
        const revert = info()?.revert?.messageID
        // Find the last user message that's not already reverted
        const message = userMessages().findLast((x) => !revert || x.id < revert)
        if (!message) return
        await sdk.client.session.revert({ sessionID, messageID: message.id })
        // Restore the prompt from the reverted message
        const parts = sync.data.part[message.id]
        if (parts) {
          const restored = extractPromptFromParts(parts, { directory: sdk.directory })
          prompt.set(restored)
        }
        // Navigate to the message before the reverted one (which will be the new last visible message)
        const priorMessage = userMessages().findLast((x) => x.id < message.id)
        setActiveMessage(priorMessage)
      },
    },
    {
      id: "session.redo",
      title: "Redo",
      description: "Redo the last undone message",
      category: "Session",
      slash: "redo",
      disabled: !activeSessionId() || !info()?.revert?.messageID,
      onSelect: async () => {
        const sessionID = activeSessionId()
        if (!sessionID) return
        const revertMessageID = info()?.revert?.messageID
        if (!revertMessageID) return
        const nextMessage = userMessages().find((x) => x.id > revertMessageID)
        if (!nextMessage) {
          // Full unrevert - restore all messages and navigate to last
          await sdk.client.session.unrevert({ sessionID })
          prompt.reset()
          // Navigate to the last message (the one that was at the revert point)
          const lastMsg = userMessages().findLast((x) => x.id >= revertMessageID)
          setActiveMessage(lastMsg)
          return
        }
        // Partial redo - move forward to next message
        await sdk.client.session.revert({ sessionID, messageID: nextMessage.id })
        // Navigate to the message before the new revert point
        const priorMsg = userMessages().findLast((x) => x.id < nextMessage.id)
        setActiveMessage(priorMsg)
      },
    },
    {
      id: "session.compact",
      title: "Compact session",
      description: "Summarize the session to reduce context size",
      category: "Session",
      slash: "compact",
      disabled: !activeSessionId() || visibleUserMessages().length === 0,
      onSelect: async () => {
        const sessionID = activeSessionId()
        if (!sessionID) return
        const model = local.model.current()
        if (!model) {
          showToast({
            title: "No model selected",
            description: "Connect a provider to summarize this session",
          })
          return
        }
        await sdk.client.session.summarize({
          sessionID,
          modelID: model.id,
          providerID: model.provider.id,
        })
      },
    },
  ])

  const handleKeyDown = (event: KeyboardEvent) => {
    const activeElement = document.activeElement as HTMLElement | undefined
    if (activeElement) {
      const isProtected = activeElement.closest("[data-prevent-autofocus]")
      const isInput = /^(INPUT|TEXTAREA|SELECT)$/.test(activeElement.tagName) || activeElement.isContentEditable
      if (isProtected || isInput) return
    }
    if (dialog.active) return

    if (activeElement === inputRef) {
      if (event.key === "Escape") inputRef?.blur()
      return
    }

    if (event.key.length === 1 && event.key !== "Unidentified" && !(event.ctrlKey || event.metaKey)) {
      inputRef?.focus()
    }
  }

  const handleDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeDraggable", id)
  }

  const handleDragOver = (_event: DragEvent) => {
    // SortableProvider handles visual reordering during drag
    // Do not modify actual tab order here - it causes index conflicts
  }

  const handleDragEnd = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (draggable && droppable) {
      const currentTabs = tabs().all()
      const fromIndex = currentTabs.indexOf(draggable.id.toString())
      const toIndex = currentTabs.indexOf(droppable.id.toString())
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        tabs().move(draggable.id.toString(), toIndex)
      }
    }
    setStore("activeDraggable", undefined)
  }

  const handleTerminalDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeTerminalDraggable", id)
  }

  const handleTerminalDragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (draggable && droppable) {
      const terminals = terminal.all()
      const fromIndex = terminals.findIndex((t: LocalPTY) => t.id === draggable.id.toString())
      const toIndex = terminals.findIndex((t: LocalPTY) => t.id === droppable.id.toString())
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        terminal.move(draggable.id.toString(), toIndex)
      }
    }
  }

  const handleTerminalDragEnd = () => {
    setStore("activeTerminalDraggable", undefined)
  }

  const contextOpen = createMemo(() => tabs().active() === "context" || tabs().all().includes("context"))
  const contextActive = createMemo(() => tabs().active() === "context")

  const openedTabs = createMemo(() =>
    tabs()
      .all()
      .filter((tab) => tab !== "context"),
  )

  // All tabs unified: sessions + files in single ordered list (Chrome-style)
  // New tabs (sessions or files) appear at the end (right side)
  const allTabs = createMemo(() =>
    tabs()
      .all()
      .filter((tab) => tab.startsWith("session-") || tab.startsWith("file://")),
  )

  // Helper: check if there are any file tabs open
  const hasFileTabs = createMemo(() => allTabs().some((tab) => tab.startsWith("file://")))

  // Active file tab for file viewer
  const activeFileTab = createMemo(() => {
    const active = tabs().active()
    if (!active?.startsWith("file://")) return null
    return file.pathFromTab(active)
  })

  // Switch to session (deactivate file tabs)
  const switchToSession = () => {
    tabs().setActive(undefined)
  }

  // Close a specific tab
  const closeTab = (tab: string) => {
    tabs().close(tab)
  }

  // Handle ask about selection from file viewer
  const handleAskAboutSelection = (selection: { text: string; startLine: number; endLine: number }) => {
    const path = activeFileTab()
    if (!path) return

    // Add selected code to prompt context
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

    // Switch to the last active session (or first session if none)
    const targetSession = lastActiveSession()
    if (targetSession) {
      tabs().setActive(targetSession)
    } else {
      // Fall back to first open session
      const firstSession = sessions().list()[0]
      if (firstSession) {
        tabs().setActive(`session-${firstSession}`)
      } else {
        tabs().setActive(undefined)
      }
    }

    // Focus prompt input
    inputRef?.focus()
  }

  // Close file viewer and go back to session
  const closeFileViewer = () => {
    const active = tabs().active()
    if (active?.startsWith("file://")) {
      tabs().close(active)
    }
  }

  const reviewTab = createMemo(() => diffs().length > 0 || tabs().active() === "review")
  const mobileReview = createMemo(() => !isDesktop() && diffs().length > 0 && store.mobileTab === "review")

  // Right panel always shows on desktop, so showTabs reflects that for styling purposes
  const showTabs = createMemo(() => isDesktop())

  const activeTab = createMemo(() => {
    const active = tabs().active()
    if (active) return active
    if (reviewTab()) return "review"

    const first = openedTabs()[0]
    if (first) return first
    if (contextOpen()) return "context"
    return "review"
  })

  createEffect(() => {
    if (!layout.ready()) return
    if (tabs().active()) return
    if (diffs().length === 0 && openedTabs().length === 0 && !contextOpen()) return
    tabs().setActive(activeTab())
  })

  const isWorking = createMemo(() => status().type !== "idle")
  const autoScroll = createAutoScroll({
    working: isWorking,
  })

  let scrollSpyFrame: number | undefined
  let scrollSpyTarget: HTMLDivElement | undefined

  const anchor = (id: string) => `message-${id}`

  const setScrollRef = (el: HTMLDivElement | undefined) => {
    scroller = el
    autoScroll.scrollRef(el)
  }

  createResizeObserver(
    () => promptDock,
    ({ height }) => {
      const next = Math.ceil(height)

      if (next === store.promptHeight) return

      const el = scroller
      const stick = el ? el.scrollHeight - el.clientHeight - el.scrollTop < 10 : false

      setStore("promptHeight", next)

      if (stick && el) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: "auto" })
        })
      }
    },
  )

  const updateHash = (id: string) => {
    window.history.replaceState(null, "", `#${anchor(id)}`)
  }

  const scrollToMessage = (message: UserMessage, behavior: ScrollBehavior = "smooth") => {
    setActiveMessage(message)

    const el = document.getElementById(anchor(message.id))
    if (el) el.scrollIntoView({ behavior, block: "start" })
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

  createEffect(() => {
    const sessionID = activeSessionId()
    const ready = messagesReady()
    if (!sessionID || !ready) return

    requestAnimationFrame(() => {
      const id = window.location.hash.slice(1)
      const hashTarget = id ? document.getElementById(id) : undefined
      if (hashTarget) {
        hashTarget.scrollIntoView({ behavior: "auto", block: "start" })
        return
      }
      autoScroll.forceScrollToBottom()
    })
  })

  createEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
  })

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown)
    if (scrollSpyFrame !== undefined) cancelAnimationFrame(scrollSpyFrame)
  })

  return (
    <div class="relative bg-background-base size-full overflow-hidden flex flex-col">
      <div class="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Mobile tab bar - only shown on mobile when there are diffs */}
        <Show when={!isDesktop() && diffs().length > 0}>
          <Tabs class="h-auto">
            <Tabs.List>
              <Tabs.Trigger
                value="session"
                class="w-1/2"
                classes={{ button: "w-full" }}
                onClick={() => setStore("mobileTab", "session")}
              >
                Session
              </Tabs.Trigger>
              <Tabs.Trigger
                value="review"
                class="w-1/2 !border-r-0"
                classes={{ button: "w-full" }}
                onClick={() => setStore("mobileTab", "review")}
              >
                {diffs().length} Files Changed
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </Show>

        {/* Session panel */}
        <div
          classList={{
            "@container relative flex flex-col min-h-0 h-full bg-background-stronger": true,
            "flex-1": true,
          }}
          style={{
            "min-width": isDesktop() ? "400px" : undefined,
            "--prompt-height": store.promptHeight ? `${store.promptHeight}px` : undefined,
          }}
        >
          {/* Right panel toggle - shows when panel is closed */}
          <Show when={isDesktop() && !layout.rightPanel.opened()}>
            <div class="absolute top-0 right-0 z-10 h-12 flex items-center pr-2">
              <TooltipKeybind
                placement="left"
                title="Toggle right panel"
                keybind={command.keybind("rightPanel.toggle")}
              >
                <Button
                  variant="ghost"
                  class="group/panel-toggle shrink-0 size-8 p-0 rounded-lg"
                  onClick={layout.rightPanel.toggle}
                >
                  <Icon name="layout-right-partial" size="small" />
                </Button>
              </TooltipKeybind>
            </div>
          </Show>

          {/* Session and file tabs bar - Chrome style */}
          <Show when={allTabs().length > 0}>
            <DragDropProvider
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              collisionDetector={closestCenter}
            >
              <DragDropSensors />
              <ConstrainDragYAxis />
              <Tabs value={tabs().active() ?? "session"} onChange={openTab} class="shrink-0 !h-auto">
                <Tabs.List
                  classList={{
                    "h-12 shrink-0 border-b border-border-weak-base bg-background-base overflow-hidden": true,
                    "pr-10": !layout.rightPanel.opened(),
                  }}
                >
                  {/* Unified tabs: sessions + files mixed together */}
                  <SortableProvider ids={allTabs()}>
                    <For each={allTabs()}>
                      {(tab) => (
                        <Show
                          when={tab.startsWith("session-")}
                          fallback={<SortableTab tab={tab} onTabClose={closeTab} onTabClick={openTab} />}
                        >
                          <SortableSessionTab
                            sessionId={tab.replace("session-", "")}
                            title={getSessionTitle(tab.replace("session-", ""))}
                            onClose={(id) => {
                              const sessionTab = `session-${id}`
                              // Close from unified tabs list (handles active tab switch)
                              tabs().close(sessionTab)
                              // Also remove from sessions tracking
                              sessions().close(id)
                            }}
                            onClick={(id) => {
                              tabs().setActive(`session-${id}`)
                              setLastActiveSession(`session-${id}`)
                            }}
                          />
                        </Show>
                      )}
                    </For>
                  </SortableProvider>

                  {/* Context tab - shown when context is open */}
                  <Show when={contextOpen()}>
                    <div class="h-full flex-shrink min-w-0">
                      <div class="relative h-full">
                        <Tabs.Trigger
                          value="context"
                          closeButton={
                            <IconButton
                              icon="close"
                              variant="ghost"
                              onClick={(e: MouseEvent) => {
                                e.stopPropagation()
                                tabs().close("context")
                              }}
                            />
                          }
                        >
                          <Icon name="brain" />
                          <span class="ml-1">Context</span>
                        </Tabs.Trigger>
                      </div>
                    </div>
                  </Show>

                  {/* New session button */}
                  <Tooltip value="New session">
                    <IconButton
                      icon="plus"
                      variant="ghost"
                      class="ml-1 shrink-0"
                      onClick={async () => {
                        // Create actual session via API
                        const newSession = await sdk.client.session.create().then((x) => x.data)
                        if (newSession) {
                          // Add session tab to unified tabs list (appends to end - Chrome style)
                          tabs().open(`session-${newSession.id}`)
                          // Also track in sessions for sidebar
                          sessions().open(newSession.id)
                          setLastActiveSession(`session-${newSession.id}`)
                        }
                        prompt.reset()
                      }}
                    />
                  </Tooltip>
                </Tabs.List>
              </Tabs>
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
                          <Icon name="bubble-5" />
                          <span class="ml-1 truncate">{getSessionTitle(sessionId())}</span>
                        </Show>
                      </div>
                    )
                  }}
                </Show>
              </DragOverlay>
            </DragDropProvider>
          </Show>

          {/* Content area */}
          <div
            classList={{
              "flex-1 min-h-0 overflow-hidden relative": true,
              "py-6 md:py-3": !activeSessionId() && !hasFileTabs(),
            }}
          >
            {/* File Viewer */}
            <Show when={activeFileTab()}>
              {(path) => (
                <div class="absolute inset-0" style={{ "background-color": "#1e1e1e" }}>
                  <FileViewer path={path()} onAskAboutSelection={handleAskAboutSelection} />
                </div>
              )}
            </Show>

            <Show when={!activeFileTab()}>
              <Switch>
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
                          <SessionReviewTab
                            diffs={diffs}
                            view={view}
                            diffStyle="unified"
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
                        <Show when={isDesktop()}>
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
                            if (isDesktop()) scheduleScrollSpy(e.currentTarget)
                          }}
                          onClick={autoScroll.handleInteraction}
                          class="relative min-w-0 w-full h-full overflow-y-auto no-scrollbar"
                        >
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
                        </div>
                      </div>
                    </Show>
                  </Show>
                </Match>
                <Match when={true}>
                  <NewSessionView
                    worktree={newSessionWorktree()}
                    onWorktreeChange={(value) => {
                      if (value === "create") {
                        setStore("newSessionWorktree", value)
                        return
                      }

                      setStore("newSessionWorktree", "main")

                      const target = value === "main" ? sync.project?.worktree : value
                      if (!target) return
                      if (target === sync.data.path.directory) return
                      layout.projects.open(target)
                      navigate(`/${base64Encode(target)}/session`)
                    }}
                  />
                </Match>
              </Switch>
            </Show>
          </div>

          {/* Prompt input */}
          <div
            ref={(el) => (promptDock = el)}
            class="absolute inset-x-0 bottom-0 pt-12 pb-4 md:pb-8 flex flex-col justify-center items-center z-50 px-4 md:px-0 bg-gradient-to-t from-background-stronger via-background-stronger to-transparent pointer-events-none"
          >
            <div
              classList={{
                "w-full md:px-6 pointer-events-auto": true,
                "md:max-w-200": !showTabs(),
              }}
            >
              <PromptInput
                ref={(el) => {
                  inputRef = el
                }}
                activeSessionId={activeSessionId()}
                newSessionWorktree={newSessionWorktree()}
                onNewSessionWorktreeReset={() => setStore("newSessionWorktree", "main")}
                onMessageSent={() => {
                  // Track the current session as last active when a message is sent
                  const active = tabs().active()
                  if (active?.startsWith("session-")) {
                    setLastActiveSession(active)
                  }
                }}
              />
            </div>
          </div>

          <Show when={isDesktop()}>
            <ResizeHandle
              direction="horizontal"
              size={layout.session.width()}
              min={450}
              max={window.innerWidth * 0.45}
              onResize={layout.session.resize}
            />
          </Show>
        </div>

        {/* Right panel - File Explorer + Terminal */}
        <Show when={isDesktop()}>
          <div
            classList={{
              "relative flex flex-col h-full ml-auto": true,
              "border-l border-border-weak-base": layout.rightPanel.opened(),
              "transition-[width] duration-200 ease-out overflow-y-clip": true,
            }}
            style={{ width: layout.rightPanel.opened() ? `${layout.rightPanel.width()}px` : "0px" }}
          >
            {/* Horizontal resize handle for panel width */}
            <Show when={layout.rightPanel.opened()}>
              <ResizeHandle
                direction="horizontal"
                size={layout.rightPanel.width()}
                min={150}
                max={window.innerWidth * 0.5}
                onResize={layout.rightPanel.resize}
                invert
                style={{
                  "inset-inline-start": "0",
                  "inset-inline-end": "auto",
                  transform: "translateX(-50%)",
                }}
              />
            </Show>

            {/* Toggle button - shows when panel is open */}
            <Show when={layout.rightPanel.opened()}>
              <div class="absolute top-0 right-0 z-10 h-10 flex items-center pr-2">
                <TooltipKeybind
                  placement="left"
                  title="Toggle right panel"
                  keybind={command.keybind("rightPanel.toggle")}
                >
                  <Button
                    variant="ghost"
                    class="group/panel-toggle shrink-0 size-8 p-0 rounded-lg"
                    onClick={layout.rightPanel.toggle}
                  >
                    <Icon name="layout-right-partial" size="small" />
                  </Button>
                </TooltipKeybind>
              </div>
            </Show>

            {/* Panel Tabs - Files, Timeline, Team */}
            <Tabs
              variant="alt"
              data-panel="right"
              value={layout.rightPanel.activeTab()}
              onChange={(tab) => layout.rightPanel.setActiveTab(tab as "files" | "timeline" | "team")}
              classList={{
                "flex flex-col overflow-hidden": true,
                "shrink-0": layout.terminal.opened(),
                "flex-1": !layout.terminal.opened(),
              }}
              style={{ height: layout.terminal.opened() ? `${layout.fileExplorer.height()}px` : undefined }}
            >
              <Tabs.List class="h-10 shrink-0">
                <Tabs.Trigger value="files">Files</Tabs.Trigger>
                <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
                <Tabs.Trigger value="team">Team</Tabs.Trigger>
              </Tabs.List>
              <div class="flex-1 min-h-0 flex flex-col">
                <Tabs.Content value="files" class="flex-1 min-h-0 overflow-auto">
                  <FileExplorerPanel onFileOpen={openTab} activeFile={activeFileTab() ?? undefined} />
                </Tabs.Content>
                <Tabs.Content value="timeline" class="flex-1 min-h-0 overflow-auto">
                  <CollabTimeline />
                </Tabs.Content>
                <Tabs.Content value="team" class="flex-1 min-h-0 overflow-auto">
                  <CollabTeam />
                </Tabs.Content>
              </div>
            </Tabs>

            {/* Terminal - Bottom */}
            <div
              classList={{
                "flex flex-col": true,
                "flex-1": layout.terminal.opened(),
                "h-8 shrink-0": !layout.terminal.opened(),
              }}
              data-prevent-autofocus
            >
              {/* Full panel - animated */}
              <div
                classList={{
                  "overflow-hidden min-h-0 flex flex-col": true,
                  "flex-1": layout.terminal.opened(),
                  "transition-[flex] duration-200 ease-out": true,
                }}
                style={{ flex: layout.terminal.opened() ? "1" : "0" }}
              >
                <div
                  class="flex-1 min-h-0 flex flex-col transition-transform duration-200 ease-out border-t border-border-weak-base"
                  style={{
                    transform: layout.terminal.opened() ? "translateY(0)" : "translateY(100%)",
                  }}
                >
                  {/* Resize handle - INSIDE animated container, moves with terminal */}
                  <ResizeHandle
                    direction="vertical"
                    size={layout.fileExplorer.height()}
                    min={50}
                    max={window.innerHeight * 0.7}
                    collapseThreshold={40}
                    invert
                    onResize={layout.fileExplorer.resize}
                    onCollapse={layout.fileExplorer.close}
                    class="!relative !transform-none h-1 shrink-0 cursor-ns-resize hover:bg-border-strong-base transition-colors"
                  />
                  <div class="flex-1 flex flex-col min-h-0">
                    <DragDropProvider
                      onDragStart={handleTerminalDragStart}
                      onDragEnd={handleTerminalDragEnd}
                      onDragOver={handleTerminalDragOver}
                      collisionDetector={closestCenter}
                    >
                      <DragDropSensors />
                      <ConstrainDragYAxis />
                      <Tabs
                        variant="alt"
                        value={terminal.active()}
                        onChange={terminal.open}
                        class="flex-1 flex flex-col min-h-0"
                      >
                        {/* Tab bar - fixed h-10 (40px), always visible */}
                        <Tabs.List class="h-10 shrink-0 overflow-y-clip">
                          <SortableProvider ids={terminal.all().map((t: LocalPTY) => t.id)}>
                            <For each={terminal.all()}>{(pty) => <SortableTerminalTab terminal={pty} />}</For>
                          </SortableProvider>
                          <div class="h-full flex items-center justify-center">
                            <TooltipKeybind
                              title="New terminal"
                              keybind={command.keybind("terminal.new")}
                              class="flex items-center"
                            >
                              <IconButton
                                icon="plus-small"
                                variant="ghost"
                                iconSize="large"
                                onClick={terminal.new}
                                tabIndex={-1}
                              />
                            </TooltipKeybind>
                          </div>
                          <div class="absolute right-0 h-full flex items-center pr-2">
                            <TooltipKeybind
                              title={layout.terminal.opened() ? "Close terminal" : "Open terminal"}
                              keybind={command.keybind("terminal.toggle")}
                              class="flex items-center"
                            >
                              <Button
                                variant="ghost"
                                class="group/terminal-toggle size-6 p-0"
                                onClick={layout.terminal.toggle}
                              >
                                <div class="relative flex items-center justify-center size-4 [&>*]:absolute [&>*]:inset-0">
                                  <Icon
                                    size="small"
                                    name={layout.terminal.opened() ? "layout-bottom-full" : "layout-bottom"}
                                    class="group-hover/terminal-toggle:hidden"
                                  />
                                  <Icon
                                    size="small"
                                    name="layout-bottom-partial"
                                    class="hidden group-hover/terminal-toggle:inline-block"
                                  />
                                  <Icon
                                    size="small"
                                    name={layout.terminal.opened() ? "layout-bottom" : "layout-bottom-full"}
                                    class="hidden group-active/terminal-toggle:inline-block"
                                  />
                                </div>
                              </Button>
                            </TooltipKeybind>
                          </div>
                        </Tabs.List>
                        {/* Content area - fills remaining space */}
                        <div class="flex-1 min-h-0 flex flex-col">
                          <QuickActionBar />
                          <For each={terminal.all()}>
                            {(pty) => (
                              <Tabs.Content value={pty.id} class="flex-1 min-h-0 flex flex-col">
                                <Terminal
                                  class="flex-1 !h-auto min-h-0"
                                  pty={pty}
                                  onCleanup={terminal.update}
                                  onConnectError={() => terminal.clone(pty.id)}
                                  onRef={(ref) => {
                                    if (terminal.active() === pty.id) {
                                      terminal.setActiveRef(ref)
                                    }
                                  }}
                                />
                              </Tabs.Content>
                            )}
                          </For>
                        </div>
                      </Tabs>
                      <DragOverlay>
                        <Show when={store.activeTerminalDraggable}>
                          {(draggedId) => {
                            const pty = createMemo(() => terminal.all().find((t: LocalPTY) => t.id === draggedId()))
                            return (
                              <Show when={pty()}>
                                {(t) => (
                                  <div class="relative p-1 h-10 flex items-center bg-background-stronger text-14-regular">
                                    {t().title}
                                  </div>
                                )}
                              </Show>
                            )
                          }}
                        </Show>
                      </DragOverlay>
                    </DragDropProvider>
                  </div>
                </div>
              </div>

              {/* Collapsed bar - only shown when terminal is closed */}
              <Show when={!layout.terminal.opened()}>
                <button
                  onClick={layout.terminal.open}
                  class="mt-auto h-8 flex items-center px-3 gap-2 text-text-subtle hover:text-text-base hover:bg-surface-subtle transition-colors cursor-pointer border-t border-border-weak-base"
                >
                  <Icon name="chevron-right" size="small" class="-rotate-90" />
                  <span class="text-13-regular">Terminal</span>
                </button>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
