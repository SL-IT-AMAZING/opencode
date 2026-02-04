import { Match, Switch } from "solid-js"
import type { PaneLeaf, PaneNode, PaneSplit } from "./types"
import { isLeaf, isSplit } from "./utils"
import { Pane } from "./pane"

export interface SplitContainerProps {
  root: PaneNode
  focusedPane?: string
  onFocusPane: (id: string) => void
  onRatioChange: (splitId: string, ratio: number) => void
  onSplit: (paneId: string, tabToMove?: string) => void
  onUnsplit: (paneId: string) => void
  canSplit: boolean
  isDesktop: boolean
  sessionKey: string
  onActiveSessionChange: (paneId: string, sessionId: string | undefined) => void
  onMoveTab?: (fromPaneId: string, toPaneId: string, tab: string) => void
  newSessionWorktree: string
  onNewSessionWorktreeReset: () => void
}

export function SplitContainer(props: SplitContainerProps) {
  return (
    <div class="flex-1 min-h-0 flex overflow-hidden">
      <RenderNode
        node={props.root}
        focusedPane={props.focusedPane}
        onFocusPane={props.onFocusPane}
        onRatioChange={props.onRatioChange}
        onSplit={props.onSplit}
        onUnsplit={props.onUnsplit}
        canSplit={props.canSplit}
        isDesktop={props.isDesktop}
        sessionKey={props.sessionKey}
        onActiveSessionChange={props.onActiveSessionChange}
        newSessionWorktree={props.newSessionWorktree}
        onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
      />
    </div>
  )
}

interface RenderNodeProps {
  node: PaneNode
  focusedPane?: string
  onFocusPane: (id: string) => void
  onRatioChange: (splitId: string, ratio: number) => void
  onSplit: (paneId: string, tabToMove?: string) => void
  onUnsplit: (paneId: string) => void
  canSplit: boolean
  isDesktop: boolean
  sessionKey: string
  onActiveSessionChange: (paneId: string, sessionId: string | undefined) => void
  newSessionWorktree: string
  onNewSessionWorktreeReset: () => void
}

function RenderNode(props: RenderNodeProps) {
  return (
    <Switch>
      <Match when={isLeaf(props.node) && (props.node as PaneLeaf)}>
        {(_leaf) => {
          const leaf = () => props.node as PaneLeaf
          return (
            <Pane
              leaf={leaf()}
              isFocused={props.focusedPane === leaf().id}
              onFocus={() => props.onFocusPane(leaf().id)}
              onActiveSessionChange={(sessionId) => props.onActiveSessionChange(leaf().id, sessionId)}
              onSplit={(tabToMove) => props.onSplit(leaf().id, tabToMove)}
              canSplit={props.canSplit}
              isDesktop={props.isDesktop}
              sessionKey={props.sessionKey}
              newSessionWorktree={props.newSessionWorktree}
              onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
            />
          )
        }}
      </Match>
      <Match when={isSplit(props.node) && (props.node as PaneSplit)}>
        {(_split) => {
          const split = () => props.node as PaneSplit
          return (
            <SplitView
              split={split()}
              focusedPane={props.focusedPane}
              onFocusPane={props.onFocusPane}
              onRatioChange={props.onRatioChange}
              onSplit={props.onSplit}
              onUnsplit={props.onUnsplit}
              canSplit={props.canSplit}
              isDesktop={props.isDesktop}
              sessionKey={props.sessionKey}
              onActiveSessionChange={props.onActiveSessionChange}
              newSessionWorktree={props.newSessionWorktree}
              onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
            />
          )
        }}
      </Match>
    </Switch>
  )
}

interface SplitViewProps {
  split: PaneSplit
  focusedPane?: string
  onFocusPane: (id: string) => void
  onRatioChange: (splitId: string, ratio: number) => void
  onSplit: (paneId: string, tabToMove?: string) => void
  onUnsplit: (paneId: string) => void
  canSplit: boolean
  isDesktop: boolean
  sessionKey: string
  onActiveSessionChange: (paneId: string, sessionId: string | undefined) => void
  newSessionWorktree: string
  onNewSessionWorktreeReset: () => void
}

function SplitView(props: SplitViewProps) {
  let containerRef: HTMLDivElement | undefined

  return (
    <div
      ref={(el) => { containerRef = el }}
      class="flex w-full h-full relative"
    >
      <div
        class="overflow-hidden shrink-0 transition-[width] duration-200 ease-out"
        style={{ width: `${props.split.ratio * 100}%` }}
      >
        <RenderNode
          node={props.split.children[0]}
          focusedPane={props.focusedPane}
          onFocusPane={props.onFocusPane}
          onRatioChange={props.onRatioChange}
          onSplit={props.onSplit}
          onUnsplit={props.onUnsplit}
          canSplit={props.canSplit}
          isDesktop={props.isDesktop}
          sessionKey={props.sessionKey}
          onActiveSessionChange={props.onActiveSessionChange}
          newSessionWorktree={props.newSessionWorktree}
          onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
        />
      </div>
      <div
        class="w-1 shrink-0 cursor-col-resize bg-border-weak-base hover:bg-border-strong-base transition-colors"
        onMouseDown={(e) => {
          e.preventDefault()
          const container = containerRef
          if (!container) return
          const startX = e.clientX
          const startRatio = props.split.ratio
          const width = container.getBoundingClientRect().width

          document.body.style.userSelect = "none"

          const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX
            const newRatio = startRatio + delta / width
            const clamped = Math.min(0.9, Math.max(0.1, newRatio))
            props.onRatioChange(props.split.id, clamped)
          }

          const onMouseUp = () => {
            document.body.style.userSelect = ""
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onMouseUp)
          }

          document.addEventListener("mousemove", onMouseMove)
          document.addEventListener("mouseup", onMouseUp)
        }}
      />
      <div class="flex-1 overflow-hidden">
        <RenderNode
          node={props.split.children[1]}
          focusedPane={props.focusedPane}
          onFocusPane={props.onFocusPane}
          onRatioChange={props.onRatioChange}
          onSplit={props.onSplit}
          onUnsplit={props.onUnsplit}
          canSplit={props.canSplit}
          isDesktop={props.isDesktop}
          sessionKey={props.sessionKey}
          onActiveSessionChange={props.onActiveSessionChange}
          newSessionWorktree={props.newSessionWorktree}
          onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
        />
      </div>
    </div>
  )
}
