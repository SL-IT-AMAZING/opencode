import { createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from "solid-js"
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
  // Use global selection mode from file context so it persists across tab switches
  const selectionMode = () => file.selectionMode()
  const setSelectionMode = (mode: boolean) => file.setSelectionMode(mode)
  const [scriptReady, setScriptReady] = createSignal(false)
  let iframeRef: HTMLIFrameElement | undefined
  let overlaysRestored = false

  // Determine preview type
  const isFilePreview = createMemo(() => props.preview.type === "file")

  // Base URL without cache buster
  const baseUrl = createMemo(() => {
    if (props.preview.type === "url") {
      let url = props.preview.value

      // Handle legacy persisted proxy URLs - extract original and rebuild with current sdk.url
      if (url.includes("/proxy?url=")) {
        const originalUrl = file.getOriginalUrl(url)
        return `${sdk.url}/proxy?url=${encodeURIComponent(originalUrl)}`
      }

      // Route localhost URLs through proxy for script injection (http AND https)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url)) {
        return `${sdk.url}/proxy?url=${encodeURIComponent(url)}`
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
      case "anyon-component-selector-ready":
        console.log("[PreviewPane] Selector script is ready")
        setScriptReady(true)
        // Note: overlay restoration is handled by effect that watches scriptReady + prompt.ready
        break
    }
  }

  // Add message listener immediately (not in onMount) to avoid race condition
  // where iframe loads and sends ready message before listener is attached
  window.addEventListener("message", handleMessage)

  onCleanup(() => {
    window.removeEventListener("message", handleMessage)
  })

  // Toggle selection mode - send message to iframe
  const handleToggleSelectionMode = () => {
    console.log("[PreviewPane] handleToggleSelectionMode called")
    console.log("[PreviewPane] scriptReady:", scriptReady())

    if (!iframeRef?.contentWindow) {
      console.log("[PreviewPane] EARLY RETURN - no contentWindow!")
      return
    }

    if (!scriptReady()) {
      console.log("[PreviewPane] EARLY RETURN - script not ready yet!")
      return
    }

    const newMode = !selectionMode()
    const messageType = newMode ? "activate-anyon-component-selector" : "deactivate-anyon-component-selector"

    console.log("[PreviewPane] Sending postMessage:", messageType)
    iframeRef.contentWindow.postMessage({ type: messageType }, "*")
    setSelectionMode(newMode)
    console.log("[PreviewPane] selectionMode set to:", newMode)
  }

  // Reset state when iframe src changes (navigation/refresh)
  // Note: selectionMode is NOT reset - it persists across tab switches
  createEffect(() => {
    iframeSrc() // Subscribe to changes
    setScriptReady(false)
    overlaysRestored = false
  })

  // Auto-activate selection mode in new iframe when it loads (if selection mode is ON)
  createEffect(() => {
    if (scriptReady() && selectionMode() && iframeRef?.contentWindow) {
      console.log("[PreviewPane] Auto-activating selection mode in new tab")
      iframeRef.contentWindow.postMessage({ type: "activate-anyon-component-selector" }, "*")
    }
  })

  // Restore overlays ONCE when BOTH script is ready AND prompt context is loaded
  createEffect(() => {
    if (overlaysRestored) return
    if (!scriptReady() || !prompt.ready() || !iframeRef?.contentWindow) return

    // Use untrack to read items without subscribing to changes
    const items = untrack(() => prompt.context.items())
    const elementItems = items.filter((i): i is ElementContextItem & { key: string } => i.type === "element")

    if (elementItems.length > 0) {
      console.log("[PreviewPane] Restoring overlays for", elementItems.length, "elements")
      elementItems.forEach((el) => {
        if (el.cssSelector) {
          iframeRef!.contentWindow!.postMessage(
            { type: "highlight-anyon-element", cssSelector: el.cssSelector },
            "*",
          )
        }
      })
    }

    overlaysRestored = true
  })

  // Track element context items to sync overlays with iframe
  let prevElementKeys = new Set<string>()

  // Sync overlays when element context items change (add/remove)
  createEffect(() => {
    const items = prompt.context.items()
    const elementItems = items.filter((i): i is ElementContextItem & { key: string } => i.type === "element")
    const currentKeys = new Set(elementItems.map((i) => i.key))

    // Detect if any elements were removed
    const hasRemovals = [...prevElementKeys].some((k) => !currentKeys.has(k))

    if (hasRemovals && iframeRef?.contentWindow) {
      // Clear all overlays first
      iframeRef.contentWindow.postMessage({ type: "clear-anyon-component-overlays" }, "*")

      // Re-highlight remaining elements
      elementItems.forEach((el) => {
        if (el.cssSelector) {
          iframeRef!.contentWindow!.postMessage(
            { type: "highlight-anyon-element", cssSelector: el.cssSelector },
            "*",
          )
        }
      })
    }

    prevElementKeys = currentKeys
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
        scriptReady={scriptReady()}
      />
      <div class="flex-1 relative">
        <iframe
          ref={(el) => (iframeRef = el)}
          src={iframeSrc()}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          class="absolute inset-0 w-full h-full border-0"
          style={{ "background-color": "#ffffff" }}
          onLoad={() => {
            console.log("[PreviewPane] iframe onload fired")
            // Note: scriptReady and restoreOverlays are handled by anyon-component-selector-ready message
          }}
        />
      </div>
    </div>
  )
}
