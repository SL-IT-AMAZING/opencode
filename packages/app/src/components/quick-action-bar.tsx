import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { useTerminal } from "@/context/terminal"
import { useSDK } from "@/context/sdk"
import { useLocal } from "@/context/local"
import { showToast } from "@anyon/ui/toast"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@anyon/util/encode"
import { Identifier } from "@/utils/id"

interface QuickActionBarProps {
  activeSessionId?: string
}

export function QuickActionBar(props: QuickActionBarProps) {
  const terminal = useTerminal()
  const sdk = useSDK()
  const navigate = useNavigate()
  const local = useLocal()

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
    const projectDir = sdk.directory
    const promptText = `# SYSTEM CONTEXT
Working Directory: ${projectDir}
Task: Start the development server

# MANDATORY EXECUTION PROTOCOL

You MUST execute these steps IN ORDER.
Do not skip any step.

## Step 1: Detect Package Manager
Run this exact bash command:
\`\`\`bash
ls -la ${projectDir} | grep -E "(bun.lockb|pnpm-lock.yaml|yarn.lock|package-lock.json)"
\`\`\`

Based on output:
- "bun.lockb" found -> PM = bun
- "pnpm-lock.yaml" found -> PM = pnpm
- "yarn.lock" found -> PM = yarn
- "package-lock.json" found -> PM = npm
- Nothing found -> PM = npm (default)

## Step 2: Check Available Scripts
Run this exact bash command:
\`\`\`bash
cat ${projectDir}/package.json | grep -A 20 '"scripts"'
\`\`\`

Find the first available script from this priority list:
1. "dev"
2. "start"
3. "serve"
4. "preview"

## Step 3: EXECUTE THE SERVER
(CRITICAL)
Based on PM detected in Step 1 and script from Step 2, run ONE of these:

If PM = bun:
\`\`\`bash
cd ${projectDir} && bun <script>
\`\`\`

If PM = pnpm:
\`\`\`bash
cd ${projectDir} && pnpm <script>
\`\`\`

If PM = yarn:
\`\`\`bash
cd ${projectDir} && yarn <script>
\`\`\`

If PM = npm:
\`\`\`bash
cd ${projectDir} && npm run <script>
\`\`\`

# ANTI-HALLUCINATION RULES

DO NOT say "I would run..." - ACTUALLY RUN IT
DO NOT say "You can run..." - ACTUALLY RUN IT
DO NOT describe what the command does - JUST EXECUTE IT
DO NOT ask for confirmation - JUST EXECUTE IT
DO NOT skip steps - EXECUTE ALL THREE STEPS
DO NOT check if a server is already running - JUST START IT
DO NOT run lsof, curl, netstat, or any port-checking commands
DO NOT look at terminal history to see if server was running before
DO NOT assume anything is already running - ALWAYS execute Step 3

USE the Bash tool for EVERY step
SHOW the actual command output
If port is in use, the command will fail - show that error
If a command fails, show the error and try the next fallback

# FALLBACK CHAIN
If "dev" script doesn't exist -> try "start"
If "start" doesn't exist -> try "serve"
If "serve" doesn't exist -> try "preview"
If none exist -> run "npx vite" or "npx next dev" based on dependencies`

    // Get model and agent from local context
    const currentModel = local.model.current()
    const currentAgent = local.agent.current()
    const variant = local.model.variant.current()

    if (!currentModel || !currentAgent) {
      showToast({
        title: "No model selected",
        description: "Please select a model first.",
      })
      return
    }

    // Use existing session if available, otherwise create new one
    let sessionId = props.activeSessionId
    if (!sessionId) {
      const newSession = await sdk.client.session.create().then((x) => x.data)
      if (!newSession) {
        showToast({
          title: "Failed to create session",
          description: "Could not start a new AI session.",
        })
        return
      }
      sessionId = newSession.id
      navigate(`/${base64Encode(sdk.directory)}/session/${sessionId}`)
    }

    const messageID = Identifier.ascending("message")

    // Send prompt with correct API structure
    await sdk.client.session.prompt({
      sessionID: sessionId,
      agent: currentAgent.name,
      model: {
        modelID: currentModel.id,
        providerID: currentModel.provider.id,
      },
      messageID,
      system: promptText,  // Full instructions (hidden from UI)
      parts: [{
        id: Identifier.ascending("part"),
        type: "text" as const,
        text: "Start the development server",  // Short visible message
      }],
      variant,
    }).catch((err) => {
      showToast({
        title: "Failed to send prompt",
        description: String(err),
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
