// PreviewPane component - placeholder for US-006
// This component will render iframe-based preview for URLs and local files

interface PreviewPaneProps {
  preview: { type: "url" | "file"; value: string }
}

export function PreviewPane(props: PreviewPaneProps) {
  return (
    <div class="absolute inset-0 flex items-center justify-center" style={{ "background-color": "#1e1e1e" }}>
      <div class="text-gray-400 text-center">
        <div class="text-lg">Preview: {props.preview.type === "url" ? "URL" : "File"}</div>
        <div class="text-sm mt-2 font-mono">{props.preview.value}</div>
        <div class="text-xs mt-4 opacity-50">Full implementation in US-006</div>
      </div>
    </div>
  )
}
