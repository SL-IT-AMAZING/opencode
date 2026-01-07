import { onMount } from "solid-js"
import { useLocal } from "@/context/local"
import FileTree from "./file-tree"

export function FileExplorerPanel(props: {
  onFileOpen: (path: string) => void
  activeFile?: string
}) {
  const local = useLocal()

  // Load root directory on mount
  onMount(() => {
    local.file.expand("")
  })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center justify-between px-3 h-12 border-b border-border-weak-base shrink-0">
        <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">Explorer</span>
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
