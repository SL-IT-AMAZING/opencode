import { onMount, onCleanup } from "solid-js"
import { useLocal } from "@/context/local"
import FileTree from "./file-tree"

export function FileExplorerPanel(props: { onFileOpen: (path: string) => void; activeFile?: string }) {
  const local = useLocal()

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
