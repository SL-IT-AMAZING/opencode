import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { useTerminal } from "@/context/terminal"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useLocal } from "@/context/local"
import { useParams, useNavigate } from "@solidjs/router"
import { base64Encode } from "@anyon/util/encode"
import { showToast } from "@anyon/ui/toast"
import { Identifier } from "@/utils/id"
import { produce } from "solid-js/store"

export function QuickActionBar() {
  const terminal = useTerminal()
  const sdk = useSDK()
  const sync = useSync()
  const local = useLocal()
  const params = useParams()
  const navigate = useNavigate()

  const sendCommand = (cmd: string) => {
    terminal.writeWhenReady("\x15" + cmd + "\n")
  }

  const handleSave = () => {
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    const msg = `Update: ${timestamp}`
    sendCommand(`git add -A && git commit -m "${msg}" && git push -u origin HEAD`)
  }

  const handleRun = async () => {
    const currentModel = local.model.current()
    const currentAgent = local.agent.current()

    if (!currentModel || !currentAgent) {
      showToast({
        title: "Select an agent and model",
        description: "Choose an agent and model before using the Run button.",
      })
      return
    }

    const projectDirectory = sdk.directory
    const variant = local.model.variant.current()

    // Get existing session from params or create new one
    let session = params.id ? sync.session.get(params.id) : undefined

    if (!session) {
      session = await sdk.client.session.create().then((x) => x.data ?? undefined)
      if (session) {
        navigate(`/${base64Encode(projectDirectory)}/session/${session.id}`)
      }
    }
    if (!session) return

    const messageID = Identifier.ascending("message")
    const promptText = `Analyze this project and run it for me.

Project directory: ${projectDirectory}

Instructions:
1. Read the project's package.json, Makefile, or other build configuration files
2. Determine the appropriate package manager (npm, yarn, bun, pnpm)
3. Install dependencies if needed
4. Find and run the correct development/start command (dev, start, serve, etc.)
5. Execute the command in the terminal

Do NOT ask me any questions - just analyze and run the project.`

    const model = {
      modelID: currentModel.id,
      providerID: currentModel.provider.id,
    }

    const agent = currentAgent.name

    const textPart = {
      id: Identifier.ascending("part"),
      type: "text" as const,
      text: promptText,
    }

    // Create optimistic parts with required fields
    const optimisticParts = [
      {
        ...textPart,
        sessionID: session.id,
        messageID,
      },
    ]

    // Add optimistic message to UI
    const optimisticMessage = {
      id: messageID,
      sessionID: session.id,
      role: "user" as const,
      time: { created: Date.now() },
      agent,
      model,
    }

    sync.set(
      produce((draft) => {
        const messages = draft.message[session!.id]
        if (!messages) {
          draft.message[session!.id] = [optimisticMessage]
        } else {
          messages.push(optimisticMessage)
        }
        draft.part[messageID] = optimisticParts
      }),
    )

    sdk.client.session
      .prompt({
        sessionID: session.id,
        agent,
        model,
        messageID,
        parts: [textPart],
        variant,
      })
      .catch((err) => {
        // Remove optimistic message on error
        sync.set(
          produce((draft) => {
            const messages = draft.message[session!.id]
            if (messages) {
              const idx = messages.findIndex((m) => m.id === messageID)
              if (idx !== -1) messages.splice(idx, 1)
            }
            delete draft.part[messageID]
          }),
        )
        showToast({
          title: "Failed to send run command",
          description: err instanceof Error ? err.message : "Request failed",
        })
      })
  }

  return (
    <div class="flex items-center justify-center gap-6 px-3 py-1.5 border-t border-border-weak-base bg-background-base">
      <Button
        size="small"
        class="rounded-lg px-3 gap-1.5 bg-surface-subtle hover:bg-surface-base transition-colors"
        onClick={handleSave}
      >
        <Icon name="share" size="small" />
        Save
      </Button>
      <Button
        size="small"
        class="rounded-lg px-3 gap-1.5 bg-surface-subtle hover:bg-surface-base transition-colors"
        onClick={() => sendCommand("git pull --no-rebase")}
      >
        <Icon name="download" size="small" />
        Sync
      </Button>
      <Button
        size="small"
        class="rounded-lg px-3 gap-1.5 bg-surface-subtle hover:bg-surface-base transition-colors"
        onClick={handleRun}
      >
        <Icon name="console" size="small" />
        Run
      </Button>
    </div>
  )
}
