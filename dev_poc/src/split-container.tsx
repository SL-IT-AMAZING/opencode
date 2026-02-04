import { createSignal, Match, Switch, type JSX } from "solid-js"
import { isLeaf, isSplit } from "./utils"
import type { PaneLeaf, PaneNode, PaneSplit } from "./types"

export interface SplitContainerProps {
  root: PaneNode
  focusedPane?: string
  onFocusPane?: (id: string) => void
  onRatioChange?: (splitId: string, ratio: number) => void
  /** Render function for leaf panes */
  renderPane: (leaf: PaneLeaf, isFocused: boolean, onFocus: () => void) => JSX.Element
}

/** Recursive renderer for split pane tree */
export function SplitContainer(props: SplitContainerProps) {
  return (
    <div class="split-container" style={{ display: "flex", width: "100%", height: "100%" }}>
      <Switch>
        <Match when={isLeaf(props.root)}>
          {props.renderPane(
            props.root as PaneLeaf,
            props.focusedPane === (props.root as PaneLeaf).id,
            () => props.onFocusPane?.((props.root as PaneLeaf).id),
          )}
        </Match>
        <Match when={isSplit(props.root)}>
          <SplitView
            split={props.root as PaneSplit}
            focusedPane={props.focusedPane}
            onFocusPane={props.onFocusPane}
            onRatioChange={props.onRatioChange}
            renderPane={props.renderPane}
          />
        </Match>
      </Switch>
    </div>
  )
}

interface SplitViewProps {
  split: PaneSplit
  focusedPane?: string
  onFocusPane?: (id: string) => void
  onRatioChange?: (splitId: string, ratio: number) => void
  renderPane: SplitContainerProps["renderPane"]
}

function SplitView(props: SplitViewProps) {
  const [containerWidth, setContainerWidth] = createSignal(800)
  let containerRef: HTMLDivElement | undefined

  const leftWidth = () => Math.round(containerWidth() * props.split.ratio)
  const rightWidth = () => containerWidth() - leftWidth()

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    const start = e.clientX
    const startRatio = props.split.ratio
    const width = containerWidth()

    document.body.style.userSelect = "none"

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - start
      const newRatio = startRatio + delta / width
      const clamped = Math.min(0.9, Math.max(0.1, newRatio))
      props.onRatioChange?.(props.split.id, clamped)
    }

    const onMouseUp = () => {
      document.body.style.userSelect = ""
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  return (
    <div
      ref={(el) => {
        containerRef = el
        // Use ResizeObserver in real code; for PoC, use getBoundingClientRect
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.width > 0) setContainerWidth(rect.width)
        }
      }}
      data-testid="split-view"
      data-split-id={props.split.id}
      style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}
    >
      <div
        data-testid="split-left"
        style={{ width: `${leftWidth()}px`, overflow: "hidden", "flex-shrink": "0" }}
      >
        <SplitContainer
          root={props.split.children[0]}
          focusedPane={props.focusedPane}
          onFocusPane={props.onFocusPane}
          onRatioChange={props.onRatioChange}
          renderPane={props.renderPane}
        />
      </div>
      <div
        data-testid="resize-handle"
        onMouseDown={handleMouseDown}
        style={{
          width: "4px",
          cursor: "col-resize",
          "background-color": "#333",
          "flex-shrink": "0",
        }}
      />
      <div
        data-testid="split-right"
        style={{ flex: "1", overflow: "hidden" }}
      >
        <SplitContainer
          root={props.split.children[1]}
          focusedPane={props.focusedPane}
          onFocusPane={props.onFocusPane}
          onRatioChange={props.onRatioChange}
          renderPane={props.renderPane}
        />
      </div>
    </div>
  )
}
