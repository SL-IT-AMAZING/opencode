import { For, onCleanup, Show, createMemo, createEffect, on, createSignal } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { useLocal } from "@/context/local"
import { useFile } from "@/context/file"
import { createStore } from "solid-js/store"
import { IconButton } from "@anyon/ui/icon-button"
import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { TooltipKeybind } from "@anyon/ui/tooltip"
import { ResizeHandle } from "@anyon/ui/resize-handle"
import { Tabs } from "@anyon/ui/tabs"
import { SessionReview } from "@anyon/ui/session-review"

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
import { useDialog } from "@anyon/ui/context/dialog"
import { DialogSelectFile } from "@/components/dialog-select-file"
import { DialogSelectModel } from "@/components/dialog-select-model"
import { DialogSelectMcp } from "@/components/dialog-select-mcp"
import { DialogGitInit } from "@/components/dialog-git-init"
import { DialogGitHubConnect } from "@/components/dialog-github-connect"
import { DialogWorkflowStart } from "@/components/dialog-workflow-start"
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
import { SortableTerminalTab } from "@/components/session"
import { useServer } from "@/context/server"
import { SplitContainer } from "@/components/split-pane/split-container"
import { collectPaneIds } from "@/components/split-pane/utils"

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
  const command = useCommand()
  const server = useServer()
  const params = useParams()
  const navigate = useNavigate()
  const sdk = useSDK()
  const prompt = usePrompt()
  const permission = usePermission()
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const sessions = createMemo(() => layout.sessions(params.dir ?? ""))
  const projectTerminal = createMemo(() => {
    const dir = sync.directory
    return dir ? layout.terminalFor(dir) : layout.terminal
  })

  const isDesktop = createMediaQuery("(min-width: 768px)")

  // Split layout state
  const splitLayout = createMemo(() => layout.split(sessionKey()))
  const [focusedSessionId, setFocusedSessionId] = createSignal<string | undefined>()
  const focusedActiveSessionId = createMemo(() => focusedSessionId() ?? params.id)
  const activeSessionId = focusedActiveSessionId

  // Right panel always shows on desktop, so showTabs reflects that for styling purposes
  const showTabs = createMemo(() => isDesktop())

  const idle = { type: "idle" as const }

  const [store, setStore] = createStore({
    activeDraggable: undefined as string | undefined,
    activeTerminalDraggable: undefined as string | undefined,
    expanded: {} as Record<string, boolean>,
    messageId: undefined as string | undefined,
    mobileTab: "session" as "session" | "review",
    newSessionWorktree: "main",
  })

  // Parent-level memos derived from focusedActiveSessionId (needed by commands)
  const newSessionWorktree = createMemo(() => {
    if (store.newSessionWorktree === "create") return "create"
    const project = sync.project
    if (project && sync.data.path.directory !== project.worktree) return sync.data.path.directory
    return "main"
  })
  const info = createMemo(() => (focusedActiveSessionId() ? sync.session.get(focusedActiveSessionId()!) : undefined))
  const messages = createMemo(() => (focusedActiveSessionId() ? (sync.data.message[focusedActiveSessionId()!] ?? []) : []))
  const emptyUserMessages: UserMessage[] = []
  const userMessages = createMemo(() => messages().filter((m) => m.role === "user") as UserMessage[], emptyUserMessages)
  const revertMessageID = createMemo(() => info()?.revert?.messageID)
  const visibleUserMessages = createMemo(() => {
    const revert = revertMessageID()
    if (!revert) return userMessages()
    return userMessages().filter((m) => m.id < revert)
  }, emptyUserMessages)
  const lastUserMessage = createMemo(() => visibleUserMessages().at(-1))
  const status = createMemo(() => sync.data.session_status[focusedActiveSessionId() ?? ""] ?? idle)
  const diffs = createMemo(() => (focusedActiveSessionId() ? (sync.data.session_diff[focusedActiveSessionId()!] ?? []) : []))
  const activeMessage = createMemo(() => {
    if (!store.messageId) return lastUserMessage()
    const found = visibleUserMessages()?.find((m) => m.id === store.messageId)
    return found ?? lastUserMessage()
  })

  // Simplified navigateMessageByOffset - just updates messageId, pane handles scrolling
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

    setStore("messageId", msgs[targetIndex].id)
  }

  const setActiveMessage = (message: UserMessage | undefined) => {
    setStore("messageId", message?.id)
  }

  // Tab helpers for right panel file explorer
  function normalizeTab(tab: string) {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }

  // openTab delegates to focused pane's tab API
  const openTab = (value: string) => {
    const next = normalizeTab(value)
    const focusedId = splitLayout().focusedPane() ?? collectPaneIds(splitLayout().root())[0]
    if (!focusedId) return
    splitLayout().pane(focusedId).open(next)
    const path = file.pathFromTab(next)
    if (path) file.load(path)
  }

  // Listen for workflow step completion and auto-open workflow tab in split pane
  createEffect(() => {
    const unsub = sdk.event.listen((e) => {
      const event = e.details
      if (event.type !== "workflow.step.completed") return

      const { sessionID, filePath } = event.properties

      // Only handle events for the currently focused session
      if (sessionID !== focusedActiveSessionId()) return

      // Create workflow tab ID for the file
      const workflowTabId = file.workflowTab(filePath)

      // Get current pane structure
      const allPaneIds = collectPaneIds(splitLayout().root())
      const focusedId = splitLayout().focusedPane() ?? allPaneIds[0]
      if (!focusedId) return

      // Check if workflow tab is already open in any pane
      const alreadyOpen = allPaneIds.some((id) => splitLayout().pane(id).tabs().includes(workflowTabId))
      if (alreadyOpen) {
        // Just activate it in its current pane
        const paneWithTab = allPaneIds.find((id) => splitLayout().pane(id).tabs().includes(workflowTabId))
        if (paneWithTab) {
          splitLayout().pane(paneWithTab).setActive(workflowTabId)
        }
        return
      }

      // If no split exists yet (only one pane), split the current pane
      if (allPaneIds.length === 1 && isDesktop()) {
        splitLayout().splitPane(focusedId)
        // Get the new pane that was created (it will be the second one)
        const newPaneIds = collectPaneIds(splitLayout().root())
        const newPaneId = newPaneIds.find((id) => id !== focusedId)
        if (newPaneId) {
          splitLayout().pane(newPaneId).open(workflowTabId)
        }
      } else {
        // If split already exists, open in the focused pane
        splitLayout().pane(focusedId).open(workflowTabId)
      }
    })

    onCleanup(() => unsub())
  })

  // Track last workflow file path for restore
  const [lastWorkflowPath, setLastWorkflowPath] = createSignal<string | undefined>()

  // Save workflow path when a workflow tab is opened anywhere
  createEffect(() => {
    const allPaneIds = collectPaneIds(splitLayout().root())
    for (const id of allPaneIds) {
      const tabs = splitLayout().pane(id).tabs()
      const workflowTab = tabs.find(t => t.startsWith("workflow://"))
      if (workflowTab) {
        const path = file.workflowFromTab(workflowTab)
        if (path) setLastWorkflowPath(path)
      }
    }
  })

  // Restore workflow: when isMinimized goes from true→false, re-open workflow tab in split pane
  createEffect(
    on(
      () => layout.workflow.isMinimized(sessionKey()),
      (minimized, prevMinimized) => {
        if (prevMinimized && !minimized) {
          const workflowPath = lastWorkflowPath()
          if (!workflowPath) return
          const workflowTabId = file.workflowTab(workflowPath)
          const allPaneIds = collectPaneIds(splitLayout().root())
          const focusedId = splitLayout().focusedPane() ?? allPaneIds[0]
          if (!focusedId) return

          if (allPaneIds.length === 1 && isDesktop()) {
            splitLayout().splitPane(focusedId)
            const newPaneIds = collectPaneIds(splitLayout().root())
            const newPaneId = newPaneIds.find((id) => id !== focusedId)
            if (newPaneId) {
              splitLayout().pane(newPaneId).open(workflowTabId)
            }
          } else {
            splitLayout().pane(focusedId).open(workflowTabId)
          }
        }
      },
      { defer: true },
    ),
  )

  // Agent/model tracking from focusedActiveSessionId
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

  // Auto-add session to open tabs when navigating via sidebar
  // Uses on() to only trigger when params.id changes, not when layout changes
  // (otherwise closing a tab re-triggers this and re-adds the tab)
  createEffect(
    on(
      () => params.id,
      (sessionId) => {
        if (!sessionId) return
        // Don't add tabs for sessions that no longer exist (archived/deleted)
        if (!sync.session.get(sessionId)) return
        const sessionTab = `session-${sessionId}`
        // Check if any pane already has this session open
        const allPaneIds = collectPaneIds(splitLayout().root())
        const alreadyOpen = allPaneIds.some((id) => splitLayout().pane(id).tabs().includes(sessionTab))
        if (alreadyOpen) return
        // Only add to the first pane if no pane has it
        const targetId = allPaneIds[0]
        if (!targetId) return
        splitLayout().pane(targetId).open(sessionTab)
        sessions().open(sessionId)
      },
    ),
  )

  // Auto git init dialog when opening a folder without .git
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
  const isUserFolder = (path: string) => {
    const normalized = path.replace(/\\/g, "/").toLowerCase()

    // macOS user folders
    if (normalized.startsWith("/users/")) return true

    // Linux user/home folders
    if (normalized.startsWith("/home/")) return true

    // Windows: Allow any drive letter path that's not a system folder
    if (/^[a-z]:\//.test(normalized)) {
      const systemPaths = [
        "/windows/",
        "/program files/",
        "/program files (x86)/",
        "/programdata/",
        "/$recycle.bin/",
        "/system volume information/",
      ]
      return !systemPaths.some((sys) => normalized.includes(sys))
    }

    return false
  }

  const showWorkflowDialog = () => {
    setTimeout(() => {
      dialog.show(() => (
        <DialogWorkflowStart
          onStartWorkflow={() => {
            local.agent.set("anyon-alpha")
            local.workflow.set(true)
          }}
          onSkip={() => {}}
        />
      ))
    }, 100)
  }

  createEffect(() => {
    if (!server.ready()) return

    const directory = sync.directory
    if (!directory) return
    if (!isUserFolder(directory)) return

    if (getAskedFolders().includes(directory)) return

    setTimeout(() => {
      sdk.client.project
        .current()
        .then((res) => {
          const isGitRepo = res.data?.vcs === "git"
          if (!isGitRepo) {
            markAsked(directory)
            dialog.show(() => (
              <DialogGitInit
                onInit={() => {
                  terminal.writeWhenReady("\x15git init && git branch -M main\n")
                }}
                onClone={(url) => {
                  terminal.writeWhenReady(`\x15git clone ${url} . && npm install\n`)
                  showWorkflowDialog()
                }}
                onShowGitHubConnect={() => {
                  dialog.show(() => (
                    <DialogGitHubConnect
                      onConnect={(repoUrl) => {
                        terminal.writeWhenReady(
                          `\x15git remote add origin ${repoUrl} && git add -A && git commit -m "Initial commit" && git push -u origin main\n`,
                        )
                        showWorkflowDialog()
                      }}
                      onSkip={() => {
                        showWorkflowDialog()
                      }}
                    />
                  ))
                }}
              />
            ))
          }
        })
        .catch((err) => {
          console.error("Failed to check project status for git init popup:", err)
        })
    }, 100)
  })

  // Create terminal on project entry (regardless of panel state)
  createEffect(() => {
    if (!sync.directory) return
    if (terminal.all().length === 0) {
      terminal.new()
    }
  })

  // Handle resize when panel opens
  createEffect(() => {
    if (projectTerminal().opened()) {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"))
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"))
        }, 350)
      })
    }
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
      onSelect: () => projectTerminal().toggle(),
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
        const message = userMessages().findLast((x) => !revert || x.id < revert)
        if (!message) return
        await sdk.client.session.revert({ sessionID, messageID: message.id })
        const parts = sync.data.part[message.id]
        if (parts) {
          const restored = extractPromptFromParts(parts, { directory: sdk.directory })
          prompt.set(restored)
        }
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
          await sdk.client.session.unrevert({ sessionID })
          prompt.reset()
          const lastMsg = userMessages().findLast((x) => x.id >= revertMessageID)
          setActiveMessage(lastMsg)
          return
        }
        await sdk.client.session.revert({ sessionID, messageID: nextMessage.id })
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
    {
      id: "workflow.start",
      title: "Start guided workflow",
      description: "Start a guided PRD → User Flow → ERD workflow",
      category: "Workflow",
      slash: "plan-workflow",
      disabled: !activeSessionId(),
      onSelect: async () => {
        const sessionID = activeSessionId()
        if (!sessionID) return
        const parts = prompt.current()
        const textPart = parts.find((p) => p.type === "text" && p.content.trim())
        const idea = textPart && "content" in textPart ? textPart.content.trim() : ""
        if (!idea) return
        await fetch(`${sdk.url}/session/${sessionID}/workflow/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idea }),
        })
        prompt.reset()
      },
    },
    {
      id: "pane.split",
      title: "Split pane",
      description: "Split the current pane side by side",
      category: "View",
      keybind: "mod+\\",
      disabled: !isDesktop(),
      onSelect: () => {
        const focusedId = splitLayout().focusedPane() ?? collectPaneIds(splitLayout().root())[0]
        if (!focusedId) return
        splitLayout().splitPane(focusedId)
      },
    },
  ])

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

  // Track opened preview URLs for terminal localhost detection
  const openedPreviewUrls = new Set<string>()

  return (
    <div class="relative bg-background-base size-full overflow-hidden flex flex-col">
      <div class="flex-1 min-h-0 flex flex-col md:flex-row md:gap-3">
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
            "flex-1 rounded-[26px] border border-border-weak-base overflow-hidden": true,
          }}
          style={{
            "min-width": isDesktop() ? "400px" : undefined,
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
                  class="group/panel-toggle shrink-0 size-8 p-0 rounded-xl"
                  onClick={layout.rightPanel.toggle}
                >
                  <Icon name="layout-right-partial" size="small" />
                </Button>
              </TooltipKeybind>
            </div>
          </Show>

          {/* Split container replaces the tab bar + content area */}
          <SplitContainer
            root={splitLayout().root()}
            focusedPane={splitLayout().focusedPane()}
            onFocusPane={(id) => splitLayout().setFocusedPane(id)}
            onRatioChange={(splitId, ratio) => splitLayout().updateRatio(splitId, ratio)}
            onSplit={(paneId, tab) => splitLayout().splitPane(paneId, tab)}
            onUnsplit={(paneId) => splitLayout().unsplitPane(paneId)}
            canSplit={true}
            isDesktop={isDesktop()}
            sessionKey={sessionKey()}
            onActiveSessionChange={(paneId, sessionId) => {
              if (paneId === splitLayout().focusedPane() || !splitLayout().focusedPane()) {
                setFocusedSessionId(sessionId)
              }
            }}
            newSessionWorktree={newSessionWorktree()}
            onNewSessionWorktreeReset={() => setStore("newSessionWorktree", "main")}
          />

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
              "rounded-[22px] border border-border-weak-base overflow-hidden": layout.rightPanel.opened(),
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
                "shrink-0 grow-0": projectTerminal().opened(),
                "flex-1": !projectTerminal().opened(),
              }}
              style={{
                height: projectTerminal().opened() ? `${layout.fileExplorer.height()}px` : undefined,
                "flex-basis": projectTerminal().opened() ? `${layout.fileExplorer.height()}px` : undefined,
              }}
            >
              <Tabs.List class="h-12 shrink-0">
                <Tabs.Trigger value="files">Files</Tabs.Trigger>
                <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
                <Tabs.Trigger value="team">Team</Tabs.Trigger>
              </Tabs.List>
              <div class="flex-1 min-h-0 flex flex-col">
                <Tabs.Content value="files" class="flex-1 min-h-0 overflow-auto">
                  <FileExplorerPanel onFileOpen={openTab} activeFile={undefined} />
                </Tabs.Content>
                <Tabs.Content value="timeline" class="flex-1 min-h-0 overflow-auto">
                  <CollabTimeline />
                </Tabs.Content>
                <Tabs.Content value="team" class="flex-1 min-h-0 overflow-auto">
                  <CollabTeam />
                </Tabs.Content>
              </div>
            </Tabs>

            {/* Quick Action Bar - Always visible above terminal */}
            <QuickActionBar activeSessionId={activeSessionId()} />

            {/* Terminal - Bottom */}
            <div
              classList={{
                "flex flex-col": true,
                "flex-1 min-h-[100px]": projectTerminal().opened(),
                "shrink-0": !projectTerminal().opened(),
              }}
              data-prevent-autofocus
            >
              {/* Full panel - animated with grid */}
              <div
                classList={{
                  "grid transition-[grid-template-rows] duration-300 ease-out overflow-hidden": true,
                  "flex-1": projectTerminal().opened(),
                }}
                style={{
                  "grid-template-rows": projectTerminal().opened() ? "1fr" : "0fr",
                }}
              >
                <div class="min-h-0 flex flex-col overflow-hidden">
                  {/* Resize handle - INSIDE animated container, moves with terminal */}
                  <ResizeHandle
                    direction="vertical"
                    size={layout.fileExplorer.height()}
                    min={50}
                    max={Math.min(window.innerHeight * 0.7, window.innerHeight - 200)}
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
                              title={projectTerminal().opened() ? "Close terminal" : "Open terminal"}
                              keybind={command.keybind("terminal.toggle")}
                              class="flex items-center"
                            >
                              <Button
                                variant="ghost"
                                class="group/terminal-toggle size-6 p-0"
                                onClick={() => projectTerminal().toggle()}
                              >
                                <div class="relative flex items-center justify-center size-4 [&>*]:absolute [&>*]:inset-0">
                                  <Icon
                                    size="small"
                                    name={projectTerminal().opened() ? "layout-bottom-full" : "layout-bottom"}
                                    class="group-hover/terminal-toggle:hidden"
                                  />
                                  <Icon
                                    size="small"
                                    name="layout-bottom-partial"
                                    class="hidden group-hover/terminal-toggle:inline-block"
                                  />
                                  <Icon
                                    size="small"
                                    name={projectTerminal().opened() ? "layout-bottom" : "layout-bottom-full"}
                                    class="hidden group-active/terminal-toggle:inline-block"
                                  />
                                </div>
                              </Button>
                            </TooltipKeybind>
                          </div>
                        </Tabs.List>
                        {/* Content area - fills remaining space */}
                        <div class="flex-1 min-h-0 flex flex-col">
                          <For each={terminal.all()}>
                            {(pty) => (
                              <Tabs.Content value={pty.id} class="flex-1 min-h-0 flex flex-col">
                                <Terminal
                                  class="flex-1 !h-auto min-h-0"
                                  pty={pty}
                                  onCleanup={terminal.update}
                                  onConnectError={() => terminal.clone(pty.id)}
                                  onRef={(ref) => {
                                    if (ref && terminal.active() === pty.id) {
                                      terminal.setActiveRef(ref)
                                      terminal.markReady(pty.id)
                                    }
                                  }}
                                  onLocalhostDetected={(url) => {
                                    if (!openedPreviewUrls.has(url)) {
                                      openedPreviewUrls.add(url)
                                      const focusedId = splitLayout().focusedPane() ?? collectPaneIds(splitLayout().root())[0]
                                      if (focusedId) {
                                        splitLayout().pane(focusedId).open(`preview://url:${url}`)
                                      }
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

              {/* Collapsed bar - visible when terminal is closed */}
              <div
                class="grid transition-[grid-template-rows] duration-300 ease-out overflow-hidden"
                style={{
                  "grid-template-rows": projectTerminal().opened() ? "0fr" : "1fr",
                }}
              >
                <div class="min-h-0 overflow-hidden">
                  <button
                    onClick={projectTerminal().open}
                    class="h-8 w-full flex items-center px-3 gap-2 text-text-subtle hover:text-text-base hover:bg-surface-subtle transition-colors cursor-pointer border-t border-border-weak-base"
                  >
                    <Icon name="chevron-right" size="small" class="-rotate-90" />
                    <span class="text-13-regular">Terminal</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
