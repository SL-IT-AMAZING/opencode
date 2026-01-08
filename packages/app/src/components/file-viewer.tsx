import { createEffect, createMemo, createSignal, Show, Suspense, ErrorBoundary, lazy } from "solid-js"
import { Portal } from "solid-js/web"
import { useFile } from "@/context/file"
import { Markdown } from "@anyon/ui/markdown"
import { Button } from "@anyon/ui/button"

// Lazy load Monaco - won't crash app if it fails
const MonacoEditor = lazy(() => import("./monaco-editor"))

interface FileViewerProps {
  path: string
  onAskAboutSelection?: (selection: { text: string; startLine: number; endLine: number }) => void
}

export function FileViewer(props: FileViewerProps) {
  const file = useFile()
  const [selection, setSelection] = createSignal<{
    text: string
    startLine: number
    endLine: number
  } | null>(null)

  const normalizedPath = createMemo(() => file.normalize(props.path))
  const isMarkdown = createMemo(() => {
    const p = normalizedPath()
    return p?.endsWith(".md") || p?.endsWith(".mdx")
  })

  // Load file when path changes
  createEffect(() => {
    const path = normalizedPath()
    if (path) file.load(path)
  })

  // Direct store access - Solid handles reactivity automatically
  const fileData = createMemo(() => file.get(normalizedPath() ?? ""))

  const content = createMemo(() => fileData()?.content?.content ?? "")
  const isLoading = createMemo(() => fileData()?.loading ?? false)
  const isLoaded = createMemo(() => fileData()?.loaded ?? false)
  const error = createMemo(() => fileData()?.error)

  const handleSelect = (text: string, startLine: number, endLine: number) => {
    if (text.trim()) {
      setSelection({ text, startLine, endLine })
    } else {
      setSelection(null)
    }
  }

  const handleAskAI = () => {
    const sel = selection()
    if (!sel) return
    props.onAskAboutSelection?.(sel)
    setSelection(null)
  }

  return (
    <div class="h-full w-full flex flex-col bg-background-base overflow-hidden">
      {/* Loading */}
      <Show when={isLoading() || (!fileData() && !error())}>
        <div class="flex-1 flex items-center justify-center">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span class="text-text-muted">Loading...</span>
          </div>
        </div>
      </Show>

      {/* Error */}
      <Show when={error()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-red-400">Error: {error()}</div>
        </div>
      </Show>

      {/* Content */}
      <Show when={isLoaded() && content()}>
        <Show
          when={isMarkdown()}
          fallback={
            <ErrorBoundary
              fallback={(err) => (
                <pre class="flex-1 overflow-auto p-4 text-sm font-mono bg-zinc-900 text-zinc-300 whitespace-pre-wrap">
                  {content()}
                </pre>
              )}
            >
              <Suspense
                fallback={
                  <div class="flex-1 flex items-center justify-center">
                    <div class="flex items-center gap-2">
                      <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span class="text-text-muted">Loading editor...</span>
                    </div>
                  </div>
                }
              >
                <div class="flex-1 min-h-0 flex flex-col">
                  <MonacoEditor path={normalizedPath() ?? ""} content={content()} onSelect={handleSelect} />
                </div>
              </Suspense>
            </ErrorBoundary>
          }
        >
          {/* Markdown */}
          <div class="flex-1 overflow-auto">
            <div class="max-w-4xl mx-auto p-6">
              <Markdown text={content()} class="prose prose-invert prose-zinc max-w-none" />
            </div>
          </div>
        </Show>
      </Show>

      {/* Empty */}
      <Show when={isLoaded() && !content() && !error()}>
        <div class="flex-1 flex items-center justify-center">
          <span class="text-text-muted">Empty file</span>
        </div>
      </Show>

      {/* Ask AI button */}
      <Show when={selection()}>
        <Portal>
          <div class="fixed z-[9999] bottom-20 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2">
            <Button variant="primary" size="small" onClick={handleAskAI}>
              Ask AI about selection
            </Button>
          </div>
        </Portal>
      </Show>
    </div>
  )
}
