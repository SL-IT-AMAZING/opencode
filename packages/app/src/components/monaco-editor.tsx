import { onMount, onCleanup, createEffect, createSignal, Show } from "solid-js"
import loader from "@monaco-editor/loader"
import type * as Monaco from "monaco-editor"

interface MonacoEditorProps {
  content: string
  path?: string
  onSelect?: (text: string, startLine: number, endLine: number, position: { top: number; left: number } | null) => void
  onChange?: (content: string) => void
  onSave?: () => void
}

function detectLanguage(path?: string): string {
  if (!path) return "plaintext"
  const ext = path.split(".").pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    sql: "sql",
    md: "markdown",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    r: "r",
  }
  return map[ext || ""] || "plaintext"
}

export default function MonacoEditor(props: MonacoEditorProps) {
  let containerRef: HTMLDivElement | undefined
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined
  let monacoInstance: typeof Monaco | undefined
  const [error, setError] = createSignal<string | null>(null)

  onMount(async () => {
    try {
      monacoInstance = await loader.init()

      if (!containerRef || !monacoInstance) return

      // Dark theme
      monacoInstance.editor.defineTheme("opencode-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#0a0a0a",
          "editor.foreground": "#e4e4e7",
          "editor.lineHighlightBackground": "#18181b",
          "editorLineNumber.foreground": "#52525b",
          "editorLineNumber.activeForeground": "#a1a1aa",
          "editor.selectionBackground": "#3b82f640",
        },
      })

      editor = monacoInstance.editor.create(containerRef, {
        value: props.content,
        language: detectLanguage(props.path),
        theme: "opencode-dark",
        readOnly: false,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        padding: { top: 16, bottom: 16 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        overviewRulerBorder: false,
        folding: true,
        contextmenu: false,
      })

      // Force layout after mount to ensure proper dimensions
      setTimeout(() => editor?.layout(), 50)
      setTimeout(() => editor?.layout(), 200)

      // Selection handler
      editor.onDidChangeCursorSelection(() => {
        if (!editor) return
        const selection = editor.getSelection()
        if (!selection || selection.isEmpty()) {
          props.onSelect?.("", 0, 0, null)
          return
        }
        const text = editor.getModel()?.getValueInRange(selection) || ""
        if (text.trim()) {
          // Calculate screen position for popup
          const endPosition = selection.getEndPosition()
          const scrolledPos = editor.getScrolledVisiblePosition(endPosition)
          const editorDom = editor.getDomNode()
          const editorRect = editorDom?.getBoundingClientRect()

          let popupPosition: { top: number; left: number } | null = null
          if (scrolledPos && editorRect) {
            popupPosition = {
              top: editorRect.top + scrolledPos.top,
              left: editorRect.left + scrolledPos.left + 10,
            }
          }

          props.onSelect?.(text, selection.startLineNumber, selection.endLineNumber, popupPosition)
        }
      })

      // Content change handler
      editor.onDidChangeModelContent(() => {
        if (!editor) return
        props.onChange?.(editor.getValue())
      })

      // Save handler (Ctrl/Cmd+S)
      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
        props.onSave?.()
      })
    } catch (e: any) {
      console.error("Monaco failed:", e)
      setError(e.message || "Failed to load editor")
    }
  })

  // Update content
  createEffect(() => {
    const content = props.content
    if (editor && editor.getValue() !== content) {
      editor.setValue(content)
    }
  })

  // Update language
  createEffect(() => {
    const path = props.path
    if (editor && monacoInstance) {
      const model = editor.getModel()
      if (model) {
        monacoInstance.editor.setModelLanguage(model, detectLanguage(path))
      }
    }
  })

  onCleanup(() => {
    editor?.dispose()
  })

  return (
    <div class="flex-1 min-h-0 w-full flex flex-col">
      <Show
        when={!error()}
        fallback={
          <pre class="flex-1 min-h-0 w-full overflow-auto p-4 text-sm font-mono bg-zinc-900 text-zinc-300">
            {props.content}
          </pre>
        }
      >
        <div ref={containerRef} class="flex-1 min-h-0 w-full" />
      </Show>
    </div>
  )
}
