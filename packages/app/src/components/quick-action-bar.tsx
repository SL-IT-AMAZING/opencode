import { Button } from "@anyon/ui/button"
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
    sendCommand(`git add -A && git commit -m "${msg}" && git push`)
  }

  return (
    <div class="flex items-center gap-1 px-2 py-1 border-b border-border-weak-base">
      <Button size="small" variant="ghost" onClick={handleSave}>
        Save
      </Button>
      <Button size="small" variant="ghost" onClick={() => sendCommand("git pull")}>
        Sync
      </Button>
      <Button size="small" variant="ghost" onClick={() => sendCommand("npm install && npm run dev")}>
        Run
      </Button>
    </div>
  )
}
