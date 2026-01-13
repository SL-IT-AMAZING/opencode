import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { useTerminal } from "@/context/terminal"

export function QuickActionBar() {
  const terminal = useTerminal()

  const sendCommand = (cmd: string) => {
    const ref = terminal.activeRef?.()
    if (ref?.write) {
      // Clear line (Ctrl+U) before command to avoid leftover chars
      ref.write("\x15" + cmd + "\n")
    }
  }

  const handleSave = () => {
    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    const msg = `Update: ${timestamp}`
    sendCommand(`git add -A && git commit -m "${msg}" && git push -u origin HEAD`)
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
        onClick={() => sendCommand("git pull")}
      >
        <Icon name="download" size="small" />
        Sync
      </Button>
      <Button
        size="small"
        class="rounded-lg px-3 gap-1.5 bg-surface-subtle hover:bg-surface-base transition-colors"
        onClick={() => sendCommand("npm install && npm run dev")}
      >
        <Icon name="console" size="small" />
        Run
      </Button>
    </div>
  )
}
