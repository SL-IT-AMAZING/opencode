import { useLocal, type LocalFile } from "@/context/local"
import { Collapsible } from "@anyon/ui/collapsible"
import { FileIcon } from "@anyon/ui/file-icon"
import { Tooltip } from "@anyon/ui/tooltip"
import { For, Match, Switch, type ComponentProps, type ParentProps } from "solid-js"
import { Dynamic } from "solid-js/web"

const INDENT_SIZE = 16 // VS Code uses ~16px per level

export default function FileTree(props: {
  path: string
  class?: string
  nodeClass?: string
  level?: number
  activeFile?: string
  onFileClick?: (file: LocalFile) => void
}) {
  const local = useLocal()
  const level = props.level ?? 0

  const isActive = (path: string) => props.activeFile === path

  const Node = (p: ParentProps & ComponentProps<"div"> & { node: LocalFile; as?: "div" | "button" }) => (
    <Dynamic
      component={p.as ?? "div"}
      classList={{
        // Base styles
        "relative py-1 px-2 w-full flex items-center gap-x-2 rounded-sm transition-colors cursor-pointer": true,
        // Hover state (VS Code-like)
        "hover:bg-background-element/70": !isActive(p.node.path),
        // Active state (more prominent)
        "bg-primary/15 text-text-strong": isActive(p.node.path),
        [props.nodeClass ?? ""]: !!props.nodeClass,
      }}
      style={`padding-left: ${8 + level * INDENT_SIZE}px`}
      draggable={true}
      onDragStart={(e: any) => {
        const evt = e as globalThis.DragEvent
        evt.dataTransfer!.effectAllowed = "copy"
        evt.dataTransfer!.setData("text/plain", `file:${p.node.path}`)

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
      {...p}
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

      {p.children}

      <span
        classList={{
          "text-sm whitespace-nowrap truncate flex-1": true,
          "text-text-muted/40": p.node.ignored && !isActive(p.node.path),
          "text-text-muted": !p.node.ignored && !isActive(p.node.path),
          "text-text-strong font-medium": isActive(p.node.path),
        }}
      >
        {p.node.name}
      </span>

      {/* TODO: Modified indicator - uncomment when local.file.changed() is implemented */}
      {/* <Show when={local.file.changed(p.node.path)}>
        <span class="ml-auto mr-1 w-2 h-2 rounded-full bg-primary/70 shrink-0" />
      </Show> */}
    </Dynamic>
  )

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
                    />
                  </Collapsible.Content>
                </Collapsible>
              </Match>
              <Match when={node.type === "file"}>
                <Node node={node} as="button" onClick={() => props.onFileClick?.(node)}>
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
