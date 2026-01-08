import { createMemo, Show } from "solid-js"
import type { JSX } from "solid-js"
import { createSortable } from "@thisbeyond/solid-dnd"
import { FileIcon } from "@anyon/ui/file-icon"
import { IconButton } from "@anyon/ui/icon-button"
import { Icon } from "@anyon/ui/icon"
import { Tooltip } from "@anyon/ui/tooltip"
import { Tabs } from "@anyon/ui/tabs"
import { getFilename } from "@anyon/util/path"
import { useFile } from "@/context/file"

export function FileVisual(props: { path: string; active?: boolean }): JSX.Element {
  return (
    <div class="flex items-center gap-x-1.5">
      <FileIcon
        node={{ path: props.path, type: "file" }}
        classList={{
          "grayscale-100 group-data-[selected]/tab:grayscale-0": !props.active,
          "grayscale-0": props.active,
        }}
      />
      <span class="text-14-medium truncate">{getFilename(props.path)}</span>
    </div>
  )
}

export function SortableSessionTab(props: {
  sessionId: string
  title: string
  onClose: (id: string) => void
  onClick?: (id: string) => void
}): JSX.Element {
  const sortable = createSortable("session-" + props.sessionId)
  return (
    // @ts-ignore
    <div
      use:sortable
      classList={{
        "h-full flex-shrink min-w-0": true,
        "transition-transform duration-200 ease-out": !sortable.isActiveDraggable,
        "opacity-0": sortable.isActiveDraggable,
      }}
    >
      <div class="relative h-full">
        <Tooltip value={props.title} placement="bottom">
          <Tabs.Trigger
            value={"session-" + props.sessionId}
            onClick={() => props.onClick?.(props.sessionId)}
            closeButton={
              <IconButton
                icon="close"
                variant="ghost"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation()
                  props.onClose(props.sessionId)
                }}
              />
            }
          >
            <Icon name="bubble-5" />
            <span class="ml-1 truncate">{props.title}</span>
          </Tabs.Trigger>
        </Tooltip>
      </div>
    </div>
  )
}

export function SortableTab(props: {
  tab: string
  onTabClose: (tab: string) => void
  onTabClick?: (tab: string) => void
}): JSX.Element {
  const file = useFile()
  const sortable = createSortable(props.tab)
  const path = createMemo(() => file.pathFromTab(props.tab))
  return (
    // @ts-ignore
    <div
      use:sortable
      classList={{
        "h-full flex-shrink min-w-0": true,
        "transition-transform duration-200 ease-out": !sortable.isActiveDraggable,
        "opacity-0": sortable.isActiveDraggable,
      }}
    >
      <div class="relative h-full">
        <Tooltip value={path() ?? props.tab} placement="bottom">
          <Tabs.Trigger
            value={props.tab}
            onClick={() => props.onTabClick?.(props.tab)}
            closeButton={<IconButton icon="close" variant="ghost" onClick={() => props.onTabClose(props.tab)} />}
            hideCloseButton
          >
            <Show when={path()}>{(p) => <FileVisual path={p()} />}</Show>
          </Tabs.Trigger>
        </Tooltip>
      </div>
    </div>
  )
}
