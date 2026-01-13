import { usePlatform } from "@/context/platform"
import { IconButton } from "@anyon/ui/icon-button"
import { Tooltip } from "@anyon/ui/tooltip"

interface PreviewToolbarProps {
  url: string
  onRefresh: () => void
}

export function PreviewToolbar(props: PreviewToolbarProps) {
  const platform = usePlatform()

  return (
    <div
      class="h-10 flex items-center gap-2 px-3 border-b shrink-0"
      style={{
        "background-color": "#252526",
        "border-color": "#3c3c3c",
      }}
    >
      {/* URL display - readonly input */}
      <input
        type="text"
        readonly
        value={props.url}
        class="flex-1 h-7 px-2 text-12-regular text-text-weak rounded outline-none cursor-default"
        style={{
          "background-color": "#1e1e1e",
          "border": "1px solid #3c3c3c",
        }}
      />

      {/* Refresh button */}
      <Tooltip value="Refresh">
        <button
          type="button"
          onClick={props.onRefresh}
          class="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          aria-label="Refresh"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            class="text-text-weak"
          >
            <path
              d="M17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 5.85786 5.85786 2.5 10 2.5C12.7614 2.5 15.1756 4.01472 16.5 6.25M17.5 3.75V7.5H13.75"
              stroke-linecap="square"
            />
          </svg>
        </button>
      </Tooltip>

      {/* Open external button */}
      <Tooltip value="Open in browser">
        <IconButton
          icon="square-arrow-top-right"
          variant="ghost"
          onClick={() => platform.openLink(props.url)}
          aria-label="Open in browser"
        />
      </Tooltip>
    </div>
  )
}
