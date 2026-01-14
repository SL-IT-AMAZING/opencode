import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { useSDK } from "@/context/sdk"
import { useFile } from "@/context/file"
import { usePrompt } from "@/context/prompt"
import { PreviewToolbar } from "./preview-toolbar"
import type { ElementContextItem } from "@/context/prompt"

interface PreviewPaneProps {
  preview: { type: "url" | "file"; value: string }
}

export function PreviewPane(props: PreviewPaneProps) {
  const sdk = useSDK()
  const file = useFile()
  const prompt = usePrompt()
  const [refreshKey, setRefreshKey] = createSignal(0)
  const [selectionMode, setSelectionMode] = createSignal(false)
  let iframeRef: HTMLIFrameElement | undefined

  // Determine preview type
  const isFilePreview = createMemo(() => props.preview.type === "file")

  // Base URL without cache buster
  const baseUrl = createMemo(() => {
    if (props.preview.type === "url") {
      const url = props.preview.value
      // Auto-convert direct localhost URLs to proxy (for old persisted tabs)
      if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
        if (!url.includes("/proxy?url=")) {
          return `${sdk.url}/proxy?url=${encodeURIComponent(url)}`
        }
      }
      return url
    }
    // For file previews, construct URL using server's preview route
    // Include directory param so server knows the workspace root
    return `${sdk.url}/preview/${props.preview.value}?directory=${encodeURIComponent(sdk.directory)}`
  })

  const isLocalhostPreview = createMemo(() => {
    if (props.preview.type !== "url") return false
    // Check if baseUrl contains /proxy?url= (proxied localhost)
    // This catches both new proxied tabs and old direct localhost tabs (auto-converted)
    return baseUrl().includes("/proxy?url=")
  })

  // Original URL for "Open in browser" (extracts localhost URL from proxy)
  const externalUrl = createMemo(() => {
    return file.getOriginalUrl(baseUrl())
  })

  // URL with cache buster for iframe src
  const iframeSrc = createMemo(() => {
    const key = refreshKey()
    const url = baseUrl()
    if (key === 0) return url
    // Add cache buster param
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}_r=${key}`
  })

  // Listen for file changes and trigger reload for HTML/CSS/JS files
  const unsub = sdk.event.listen((e) => {
    const event = e.details
    if (event.type !== "file.watcher.updated") return

    const file = event.properties.file
    // Check if the changed file is HTML, CSS, or JS
    if (/\.(html?|css|js|jsx|ts|tsx)$/i.test(file)) {
      setRefreshKey((k) => k + 1)
    }
  })
  onCleanup(unsub)

  // Handle messages from iframe (component selection)
  const handleMessage = (event: MessageEvent) => {
    if (!event.data || typeof event.data !== "object") return

    switch (event.data.type) {
      case "anyon-component-selected": {
        const data = event.data.data as ElementContextItem
        prompt.context.add({
          type: "element",
          tagName: data.tagName,
          id: data.id,
          className: data.className,
          html: data.html,
          cssSelector: data.cssSelector,
          textContent: data.textContent,
        })
        break
      }
      case "anyon-component-selector-activated":
        setSelectionMode(true)
        break
      case "anyon-component-selector-deactivated":
        setSelectionMode(false)
        break
    }
  }

  onMount(() => {
    window.addEventListener("message", handleMessage)
  })

  onCleanup(() => {
    window.removeEventListener("message", handleMessage)
  })

  // Toggle selection mode - send message to iframe
  const handleToggleSelectionMode = () => {
    console.log("[PreviewPane] handleToggleSelectionMode called")
    console.log("[PreviewPane] iframeRef:", iframeRef)
    console.log("[PreviewPane] iframeRef?.contentWindow:", iframeRef?.contentWindow)

    if (!iframeRef?.contentWindow) {
      console.log("[PreviewPane] EARLY RETURN - no contentWindow!")
      return
    }

    const newMode = !selectionMode()
    const messageType = newMode ? "activate-anyon-component-selector" : "deactivate-anyon-component-selector"

    console.log("[PreviewPane] Sending postMessage:", messageType)
    iframeRef.contentWindow.postMessage({ type: messageType }, "*")
    setSelectionMode(newMode)
    console.log("[PreviewPane] selectionMode set to:", newMode)
  }

  // Deactivate selection mode when iframe src changes (navigation/refresh)
  createEffect(() => {
    iframeSrc() // Subscribe to changes
    setSelectionMode(false)
  })

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div class="absolute inset-0 flex flex-col" style={{ "background-color": "#1e1e1e" }}>
      <PreviewToolbar
        url={baseUrl()}
        externalUrl={externalUrl()}
        onRefresh={handleRefresh}
        selectionMode={selectionMode()}
        onToggleSelectionMode={handleToggleSelectionMode}
        isFilePreview={isFilePreview()}
        isLocalhostPreview={isLocalhostPreview()}
      />
      <div class="flex-1 relative">
        <iframe
          ref={(el) => (iframeRef = el)}
          src={iframeSrc()}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          class="absolute inset-0 w-full h-full border-0"
          style={{ "background-color": "#ffffff" }}
        />
      </div>
    </div>
  )
}
