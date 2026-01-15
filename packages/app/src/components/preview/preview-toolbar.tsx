import { Show } from "solid-js"
import { usePlatform } from "@/context/platform"
import { IconButton } from "@anyon/ui/icon-button"
import { Tooltip } from "@anyon/ui/tooltip"

interface PreviewToolbarProps {
  url: string
  externalUrl?: string // Original URL for "Open in browser" (e.g., original localhost URL instead of proxy)
  onRefresh: () => void
  selectionMode?: boolean
  onToggleSelectionMode?: () => void
  isFilePreview?: boolean
  isLocalhostPreview?: boolean
  scriptReady?: boolean
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
        value={props.externalUrl || props.url}
        class="flex-1 h-7 px-2 text-12-regular text-text-weak rounded outline-none cursor-default"
        style={{
          "background-color": "#1e1e1e",
          border: "1px solid #3c3c3c",
        }}
      />

      {/* Select Element button - shown for file and localhost previews */}
      <Show when={(props.isFilePreview || props.isLocalhostPreview) && props.onToggleSelectionMode}>
        <Tooltip value={props.scriptReady ? (props.selectionMode ? "Cancel selection" : "Select element") : "Loading..."}>
          <button
            type="button"
            onClick={props.onToggleSelectionMode}
            disabled={!props.scriptReady}
            classList={{
              "w-7 h-7 flex items-center justify-center rounded transition-all duration-100": true,
              "bg-blue-500/30 hover:bg-blue-500/40 active:bg-blue-500/50 active:scale-90": props.selectionMode,
              "hover:bg-white/10 active:bg-white/20 active:scale-90": !props.selectionMode && props.scriptReady,
              "opacity-50 cursor-not-allowed": !props.scriptReady,
            }}
            aria-label={props.selectionMode ? "Cancel selection" : "Select element"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="text-text-weak">
              <path
                d="M4 4L10.5 20.5L13 13L20.5 10.5L4 4Z"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
      </Show>

      {/* Refresh button */}
      <Tooltip value="Refresh">
        <button
          type="button"
          onClick={props.onRefresh}
          class="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 active:bg-white/20 active:scale-90 transition-all duration-100"
          aria-label="Refresh"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" class="text-text-weak">
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
          onClick={() => platform.openLink(props.externalUrl || props.url)}
          aria-label="Open in browser"
        />
      </Tooltip>
    </div>
  )
}
