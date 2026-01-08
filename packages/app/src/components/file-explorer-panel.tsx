import { onMount, onCleanup } from "solid-js"
import { useLocal } from "@/context/local"
import { useLayout } from "@/context/layout"
import { useCommand } from "@/context/command"
import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { TooltipKeybind } from "@anyon/ui/tooltip"
import FileTree from "./file-tree"

export function FileExplorerPanel(props: { onFileOpen: (path: string) => void; activeFile?: string }) {
  const local = useLocal()
  const layout = useLayout()
  const command = useCommand()

  // Load root directory on mount
  onMount(() => {
    local.file.expand("")

    // Poll for file changes every 3 seconds as a fallback
    // This ensures new files appear even if the file watcher events don't arrive
    const interval = setInterval(() => {
      local.file.refresh()
    }, 3000)

    onCleanup(() => clearInterval(interval))
  })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center justify-between px-3 h-12 border-b border-border-weak-base shrink-0">
        <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">Files</span>
        <TooltipKeybind title="Toggle right panel" keybind={command.keybind("rightPanel.toggle")}>
          <Button variant="ghost" class="group/panel-toggle size-6 p-0" onClick={layout.rightPanel.toggle}>
            <div class="relative flex items-center justify-center size-4 [&>*]:absolute [&>*]:inset-0">
              <Icon name="layout-right" size="small" class="group-hover/panel-toggle:hidden" />
              <Icon name="layout-right-partial" size="small" class="hidden group-hover/panel-toggle:inline-block" />
              <Icon name="layout-right-full" size="small" class="hidden group-active/panel-toggle:inline-block" />
            </div>
          </Button>
        </TooltipKeybind>
      </div>
      <div class="flex-1 overflow-auto py-1 px-1">
        <FileTree
          path=""
          activeFile={props.activeFile}
          onFileClick={(file) => props.onFileOpen(`file://${file.path}`)}
        />
      </div>
    </div>
  )
}
