import { createEffect, createMemo, createSignal, Show, Suspense, ErrorBoundary, lazy } from "solid-js"
import { Portal } from "solid-js/web"
import { useFile } from "@/context/file"
import { Markdown } from "@anyon/ui/markdown"
import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { usePrompt } from "@/context/prompt"

// Lazy load Monaco - won't crash app if it fails
const MonacoEditor = lazy(() => import("./monaco-editor"))

interface FileViewerProps {
  path: string
  onAskAboutSelection?: (selection: { text: string; startLine: number; endLine: number }) => void
}

export function FileViewer(props: FileViewerProps) {
  const file = useFile()
  const prompt = usePrompt()
  const [selection, setSelection] = createSignal<{
    text: string
    startLine: number
    endLine: number
    top: number
    left: number
  } | null>(null)
  const [editedContent, setEditedContent] = createSignal<string | null>(null)
  const [isSaving, setIsSaving] = createSignal(false)
  const [isEditMode, setIsEditMode] = createSignal(false)

  const normalizedPath = createMemo(() => file.normalize(props.path))
  const isMarkdown = createMemo(() => {
    const p = normalizedPath()
    return p?.endsWith(".md") || p?.endsWith(".mdx")
  })

  // Reset edit mode when switching files
  createEffect(() => {
    normalizedPath()
    setIsEditMode(false)
  })

  // Load file when path changes
  createEffect(() => {
    const path = normalizedPath()
    if (path) file.load(path)
  })

  // Direct store access - Solid handles reactivity automatically
  const fileData = createMemo(() => file.get(normalizedPath() ?? ""))

  const originalContent = createMemo(() => fileData()?.content?.content ?? "")
  const content = createMemo(() => editedContent() ?? originalContent())
  const isDirty = createMemo(() => editedContent() !== null && editedContent() !== originalContent())
  const isLoading = createMemo(() => fileData()?.loading ?? false)
  const isLoaded = createMemo(() => fileData()?.loaded ?? false)
  const error = createMemo(() => fileData()?.error)

  // Reset edited content when file changes or reloads
  createEffect(() => {
    originalContent()
    setEditedContent(null)
  })

  const handleChange = (newContent: string) => {
    setEditedContent(newContent)
  }

  const handleSave = async () => {
    const path = normalizedPath()
    const edited = editedContent()
    if (!path || edited === null || isSaving()) return

    setIsSaving(true)
    file.save(path, edited).then(() => {
      setEditedContent(null)
    }).finally(() => {
      setIsSaving(false)
    })
  }

  const handleSelect = (
    text: string,
    startLine: number,
    endLine: number,
    position: { top: number; left: number } | null,
  ) => {
    if (text.trim() && position) {
      setSelection({
        text,
        startLine,
        endLine,
        top: position.top,
        left: position.left,
      })
    } else if (text.trim()) {
      // Fallback for non-Monaco (markdown)
      const browserSel = window.getSelection()
      if (browserSel && !browserSel.isCollapsed) {
        const range = browserSel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setSelection({
          text,
          startLine,
          endLine,
          top: rect.top,
          left: rect.right + 8,
        })
      } else {
        setSelection(null)
      }
    } else {
      setSelection(null)
    }
  }

  const handleAddToContext = () => {
    const sel = selection()
    if (!sel) return
    prompt.context.add({
      type: "snippet",
      text: sel.text,
      source: normalizedPath() ?? undefined,
      startLine: sel.startLine,
      endLine: sel.endLine,
    })
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
                  <MonacoEditor
                    path={normalizedPath() ?? ""}
                    content={content()}
                    onSelect={handleSelect}
                    onChange={handleChange}
                    onSave={handleSave}
                  />
                </div>
              </Suspense>
            </ErrorBoundary>
          }
        >
          {/* Markdown with Edit/Preview toggle */}
          <div class="flex-1 relative min-h-0 overflow-hidden">
            {/* Floating toggle buttons */}
            <div class="absolute top-3 right-3 z-10">
              <div class="flex items-center gap-1 p-1 rounded-lg bg-background-base/80 backdrop-blur-sm border border-border-weak-base shadow-md">
                <Button
                  size="small"
                  variant={!isEditMode() ? "primary" : "ghost"}
                  onClick={() => setIsEditMode(false)}
                >
                  <Icon name="glasses" size="small" />
                  <span class="text-12-regular">Preview</span>
                </Button>
                <Button
                  size="small"
                  variant={isEditMode() ? "primary" : "ghost"}
                  onClick={() => setIsEditMode(true)}
                >
                  <Icon name="edit-small-2" size="small" />
                  <span class="text-12-regular">Edit</span>
                </Button>
              </div>
            </div>
            {/* Content area - full height */}
            <Show
              when={isEditMode()}
              fallback={
                <div class="h-full overflow-auto">
                  <div class="max-w-4xl mx-auto p-6 pt-14">
                    <Markdown text={content()} class="prose prose-invert prose-zinc max-w-none" />
                  </div>
                </div>
              }
            >
              <div class="h-full flex flex-col">
                <MonacoEditor
                  path={normalizedPath() ?? ""}
                  content={content()}
                  onSelect={handleSelect}
                  onChange={handleChange}
                  onSave={handleSave}
                />
              </div>
            </Show>
          </div>
        </Show>
      </Show>

      {/* Empty */}
      <Show when={isLoaded() && !content() && !error()}>
        <div class="flex-1 flex items-center justify-center">
          <span class="text-text-muted">Empty file</span>
        </div>
      </Show>

      {/* Add to Context button - positioned next to selection */}
      <Show when={selection()}>
        {(sel) => (
          <Portal>
            <div
              data-component="file-selection-popup"
              style={{
                position: "fixed",
                top: `${sel().top}px`,
                left: `${sel().left}px`,
                "z-index": "9999",
              }}
              class="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-surface-elevated border border-border-base shadow-lg"
            >
              <Button size="small" onClick={handleAddToContext}>
                <Icon name="plus-small" size="small" />
                <span class="text-12-regular">Add to Context</span>
              </Button>
            </div>
          </Portal>
        )}
      </Show>
    </div>
  )
}
