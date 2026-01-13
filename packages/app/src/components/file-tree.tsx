import { useLocal, type LocalFile } from "@/context/local"
import { Collapsible } from "@anyon/ui/collapsible"
import { FileIcon } from "@anyon/ui/file-icon"
import { IconButton } from "@anyon/ui/icon-button"
import { Tooltip } from "@anyon/ui/tooltip"
import { For, Match, Show, Switch, type ComponentProps, type ParentProps, type JSX } from "solid-js"
import { Dynamic } from "solid-js/web"

const INDENT_SIZE = 16 // VS Code uses ~16px per level

function isHtmlFile(path: string): boolean {
  const lower = path.toLowerCase()
  return lower.endsWith(".html") || lower.endsWith(".htm")
}

export default function FileTree(props: {
  path: string
  class?: string
  nodeClass?: string
  level?: number
  activeFile?: string
  onFileClick?: (file: LocalFile) => void
  onPreviewClick?: (file: LocalFile) => void
}) {
  const local = useLocal()
  const level = props.level ?? 0

  const isActive = (path: string) => props.activeFile === path

  const Node = (p: ParentProps & ComponentProps<"div"> & { node: LocalFile; as?: "div" | "button"; trailing?: JSX.Element }) => {
    // Destructure custom props to avoid spreading them to DOM
    // CRITICAL: Also extract 'class' to prevent it from overwriting classList
    const { node, as: Component = "div", trailing, children, class: className, ...rest } = p
    return (
      <Dynamic
        component={Component}
        classList={{
          // Base styles - MUST include flex items-center for horizontal layout
          "relative py-1 px-2 w-full flex items-center gap-x-2 rounded-sm transition-colors cursor-pointer": true,
          // Hover state (VS Code-like)
          "hover:bg-background-element/70": !isActive(node.path),
          // Active state (more prominent)
          "bg-primary/15 text-text-strong": isActive(node.path),
          [props.nodeClass ?? ""]: !!props.nodeClass,
          // Merge any additional classes passed via class prop (e.g., group/file-row)
          [className ?? ""]: !!className,
        }}
        style={`padding-left: ${8 + level * INDENT_SIZE}px`}
        draggable={true}
        onDragStart={(e: any) => {
          const evt = e as globalThis.DragEvent
          evt.dataTransfer!.effectAllowed = "copy"
          evt.dataTransfer!.setData("text/plain", `file:${node.path}`)

          const dragImage = document.createElement("div")
          dragImage.className =
            "flex items-center gap-x-2 px-2 py-1 bg-background-element rounded-md border border-border-1"
          dragImage.style.position = "absolute"
          dragImage.style.top = "-1000px"

          const icon = e.currentTarget.querySelector("svg")
          const text = e.currentTarget.querySelector("span")
          if (icon && text) {
            dragImage.innerHTML = icon.outerHTML + text.outerHTML
          }

          document.body.appendChild(dragImage)
          evt.dataTransfer!.setDragImage(dragImage, 0, 12)
          setTimeout(() => document.body.removeChild(dragImage), 0)
        }}
        {...rest}
      >
        {/* Indentation guide lines */}
        <For each={Array(level).fill(0)}>
          {(_, i) => (
            <div
              class="absolute top-0 bottom-0 w-px bg-border-weak-base/50"
              style={`left: ${12 + i() * INDENT_SIZE}px`}
            />
          )}
        </For>

        {children}

        <span
          classList={{
            "text-sm whitespace-nowrap truncate flex-1": true,
            "text-text-muted/40": node.ignored && !isActive(node.path),
            "text-text-muted": !node.ignored && !isActive(node.path),
            "text-text-strong font-medium": isActive(node.path),
          }}
        >
          {node.name}
        </span>

        {/* Trailing content (preview button, modified indicator, etc.) */}
        {trailing}
      </Dynamic>
    )
  }

  return (
    <div class={`flex flex-col ${props.class ?? ""}`}>
      <For each={local.file.children(props.path)}>
        {(node) => (
          <Tooltip forceMount={false} openDelay={800} value={node.path} placement="right">
            <Switch>
              <Match when={node.type === "directory"}>
                <Collapsible
                  variant="ghost"
                  class="w-full"
                  forceMount={false}
                  onOpenChange={(open) => (open ? local.file.expand(node.path) : local.file.collapse(node.path))}
                >
                  <Collapsible.Trigger>
                    <Node node={node}>
                      <Collapsible.Arrow class="text-text-muted/70 w-4 h-4 shrink-0" />
                      <FileIcon node={node} class="text-text-muted/70 w-4 h-4 shrink-0" />
                    </Node>
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <FileTree
                      path={node.path}
                      level={level + 1}
                      activeFile={props.activeFile}
                      onFileClick={props.onFileClick}
                      onPreviewClick={props.onPreviewClick}
                    />
                  </Collapsible.Content>
                </Collapsible>
              </Match>
              <Match when={node.type === "file"}>
                <Node
                  node={node}
                  as="button"
                  onClick={() => props.onFileClick?.(node)}
                  class="group/file-row"
                  trailing={
                    <Show when={isHtmlFile(node.path) && props.onPreviewClick}>
                      <IconButton
                        icon="window-cursor"
                        variant="ghost"
                        class="opacity-0 group-hover/file-row:opacity-100 shrink-0"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation()
                          props.onPreviewClick?.(node)
                        }}
                      />
                    </Show>
                  }
                >
                  <div class="w-4 shrink-0" /> {/* Spacer for alignment with folders */}
                  <FileIcon node={node} class="text-primary/80 w-4 h-4 shrink-0" />
                </Node>
              </Match>
            </Switch>
          </Tooltip>
        )}
      </For>
    </div>
  )
}
