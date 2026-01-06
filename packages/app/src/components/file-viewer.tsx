import { createEffect, createMemo, createSignal, Match, onCleanup, Show, Switch } from "solid-js"
import { useFile } from "@/context/file"
import { Markdown } from "@opencode-ai/ui/markdown"
import { Code } from "@opencode-ai/ui/code"
import { Icon } from "@opencode-ai/ui/icon"

interface FileViewerProps {
  path: string
  onClose?: () => void
  onAskAboutSelection?: (selection: { text: string; startLine: number; endLine: number }) => void
}

function getViewMode(path: string): "markdown" | "code" {
  const ext = path.split(".").pop()?.toLowerCase()
  return ext === "md" || ext === "mdx" ? "markdown" : "code"
}

export function FileViewer(props: FileViewerProps) {
  const file = useFile()
  const [selectionPosition, setSelectionPosition] = createSignal<{ x: number; y: number } | null>(null)
  const [selectedText, setSelectedText] = createSignal<string>("")
  let containerRef: HTMLDivElement | undefined

  const fileState = createMemo(() => file.get(props.path))
  const content = createMemo(() => fileState()?.content?.content ?? "")
  const viewMode = createMemo(() => getViewMode(props.path))

  // FileContents format for the Code component (from @pierre/diffs)
  const fileContents = createMemo(() => ({
    name: props.path,
    contents: content(),
    cacheKey: `${props.path}-${content().length}`,
  }))

  // Load file content
  createEffect(() => {
    if (props.path) {
      file.load(props.path)
    }
  })

  // Handle text selection
  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setSelectionPosition(null)
      return
    }

    const text = selection.toString()
    if (!text.trim()) {
      setSelectionPosition(null)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    setSelectedText(text)
    setSelectionPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }

  const handleMouseDown = (e: MouseEvent) => {
    // Close floating button if clicking outside
    if (selectionPosition() && containerRef && !containerRef.contains(e.target as Node)) {
      setSelectionPosition(null)
    }
  }

  const handleAskClick = () => {
    const text = selectedText()
    if (!text || !props.onAskAboutSelection) return

    // Estimate line numbers from selection
    const lines = text.split("\n")
    props.onAskAboutSelection({
      text,
      startLine: 1,
      endLine: lines.length,
    })
    setSelectionPosition(null)
    window.getSelection()?.removeAllRanges()
  }

  createEffect(() => {
    document.addEventListener("mousedown", handleMouseDown)
    onCleanup(() => document.removeEventListener("mousedown", handleMouseDown))
  })

  return (
    <div ref={containerRef} class="flex flex-col h-full bg-background-base overflow-hidden">
      {/* Content - full height, no header (file name shown in tab bar) */}
      <div class="flex-1 overflow-auto p-4" onMouseUp={handleMouseUp}>
        <Switch>
          <Match when={!fileState() || fileState()?.loading}>
            {() => (
              <div class="flex items-center justify-center h-32 text-text-muted">
                <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span class="ml-2">Loading...</span>
              </div>
            )}
          </Match>
          <Match when={fileState()?.error}>
            {() => (
              <div class="flex items-center justify-center h-32 text-text-danger">
                <Icon name="circle-x" />
                <span class="ml-2">{fileState()?.error}</span>
              </div>
            )}
          </Match>
          <Match when={fileState()?.loaded && !content()}>
            {() => (
              <div class="flex items-center justify-center h-32 text-text-muted">
                <span>Empty file</span>
              </div>
            )}
          </Match>
          <Match when={viewMode() === "markdown"}>
            {() => (
              <div class="prose prose-sm prose-invert max-w-none">
                <Markdown text={content()} />
              </div>
            )}
          </Match>
          <Match when={viewMode() === "code" && content()}>
            {() => (
              <Code
                file={fileContents()}
                overflow="wrap"
                class="select-text"
              />
            )}
          </Match>
        </Switch>
      </div>

      {/* Floating "Ask" button */}
      <Show when={selectionPosition()}>
        {(pos) => (
          <div
            class="fixed z-50 bg-background-stronger border border-border-base rounded-md shadow-lg p-1 flex items-center gap-1"
            style={{
              left: `${pos().x}px`,
              top: `${pos().y - 8}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <button
              class="flex items-center gap-1.5 px-2 py-1 text-12-medium text-text-strong hover:bg-background-element rounded transition-colors"
              onClick={handleAskClick}
            >
              <Icon name="speech-bubble" />
              Ask
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}
