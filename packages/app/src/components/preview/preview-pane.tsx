import { createMemo, createSignal, onCleanup } from "solid-js"
import { useSDK } from "@/context/sdk"
import { PreviewToolbar } from "./preview-toolbar"

interface PreviewPaneProps {
  preview: { type: "url" | "file"; value: string }
}

export function PreviewPane(props: PreviewPaneProps) {
  const sdk = useSDK()
  const [refreshKey, setRefreshKey] = createSignal(0)

  // Base URL without cache buster
  const baseUrl = createMemo(() => {
    if (props.preview.type === "url") {
      return props.preview.value
    }
    // For file previews, construct URL using server's preview route
    // Include directory param so server knows the workspace root
    return `${sdk.url}/preview/${props.preview.value}?directory=${encodeURIComponent(sdk.directory)}`
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

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div class="absolute inset-0 flex flex-col" style={{ "background-color": "#1e1e1e" }}>
      <PreviewToolbar url={baseUrl()} onRefresh={handleRefresh} />
      <div class="flex-1 relative">
        <iframe
          src={iframeSrc()}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          class="absolute inset-0 w-full h-full border-0"
          style={{ "background-color": "#ffffff" }}
        />
      </div>
    </div>
  )
}
