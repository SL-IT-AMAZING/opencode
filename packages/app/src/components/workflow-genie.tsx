import { createSignal, onCleanup, Show } from "solid-js"

interface GenieRect {
  x: number
  y: number
  width: number
  height: number
}

interface WorkflowGenieProps {
  onComplete: () => void
}

const DURATION = 300

export function useWorkflowGenie() {
  const [animating, setAnimating] = createSignal(false)
  const [mode, setMode] = createSignal<"minimize" | "restore">("minimize")
  const [sourceRect, setSourceRect] = createSignal<GenieRect>({ x: 0, y: 0, width: 0, height: 0 })
  const [targetRect, setTargetRect] = createSignal<GenieRect>({ x: 0, y: 0, width: 0, height: 0 })

  function minimize(from: GenieRect, to: GenieRect, onComplete: () => void) {
    setSourceRect(from)
    setTargetRect(to)
    setMode("minimize")
    setAnimating(true)
    setTimeout(() => {
      setAnimating(false)
      onComplete()
    }, DURATION)
  }

  function restore(from: GenieRect, to: GenieRect, onComplete: () => void) {
    setSourceRect(from)
    setTargetRect(to)
    setMode("restore")
    setAnimating(true)
    setTimeout(() => {
      setAnimating(false)
      onComplete()
    }, DURATION)
  }

  return {
    animating,
    mode,
    sourceRect,
    targetRect,
    minimize,
    restore,
  }
}

export function WorkflowGenieOverlay(props: {
  animating: boolean
  mode: "minimize" | "restore"
  sourceRect: GenieRect
  targetRect: GenieRect
}) {
  const from = () => (props.mode === "minimize" ? props.sourceRect : props.targetRect)
  const to = () => (props.mode === "minimize" ? props.targetRect : props.sourceRect)

  return (
    <Show when={props.animating}>
      <div class="fixed inset-0 z-[9999] pointer-events-none">
        <div
          class="absolute rounded-lg overflow-hidden bg-background-base border border-border-weak-base shadow-lg"
          style={{
            animation: `workflow-genie ${DURATION}ms ease-in-out forwards`,
            "--genie-from-x": `${from().x}px`,
            "--genie-from-y": `${from().y}px`,
            "--genie-from-w": `${from().width}px`,
            "--genie-from-h": `${from().height}px`,
            "--genie-to-x": `${to().x}px`,
            "--genie-to-y": `${to().y}px`,
            "--genie-to-w": `${to().width}px`,
            "--genie-to-h": `${to().height}px`,
          }}
        >
          <div class="flex items-center justify-center h-full text-text-tertiary-base">
            <span class="text-12-medium">Workflow</span>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes workflow-genie {
          0% {
            left: var(--genie-from-x);
            top: var(--genie-from-y);
            width: var(--genie-from-w);
            height: var(--genie-from-h);
            opacity: 1;
          }
          100% {
            left: var(--genie-to-x);
            top: var(--genie-to-y);
            width: var(--genie-to-w);
            height: var(--genie-to-h);
            opacity: 0.3;
          }
        }
      `}</style>
    </Show>
  )
}
