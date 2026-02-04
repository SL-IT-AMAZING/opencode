import { Show, For, createMemo } from "solid-js"
import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { FileViewer } from "@/components/file-viewer"

const STEPS = [
  { type: "prd" as const, label: "PRD", icon: "file-text" },
  { type: "userflow" as const, label: "User Flow", icon: "git-branch" },
  { type: "erd" as const, label: "ERD", icon: "database" },
] as const

type StepType = "prd" | "userflow" | "erd"

type WorkflowStep = {
  type: StepType
  status: "pending" | "active" | "complete"
  document?: string
  updatedAt?: number
}

type WorkflowInfo = {
  sessionID: string
  currentStep: StepType
  steps: Record<StepType, WorkflowStep>
  idea: string
  time: { created: number; updated: number }
}

interface WorkflowDocViewProps {
  path: string
  workflow?: WorkflowInfo
  onAdvanceStep?: () => void
  onAskAboutSelection?: (selection: { text: string; startLine: number; endLine: number }) => void
}

export function WorkflowDocView(props: WorkflowDocViewProps) {
  const currentStepIndex = createMemo(() => {
    if (!props.workflow) return 0
    return STEPS.findIndex((s) => s.type === props.workflow!.currentStep)
  })

  const stepStatus = (type: StepType) => {
    if (!props.workflow) return "pending" as const
    return props.workflow.steps[type]?.status ?? ("pending" as const)
  }

  const nextStepLabel = createMemo(() => {
    if (!props.workflow) return undefined
    const idx = currentStepIndex()
    if (idx >= STEPS.length - 1) return undefined
    return STEPS[idx + 1]?.label
  })

  return (
    <div class="flex flex-col h-full">
      {/* Step Progress Bar */}
      <div class="flex items-center gap-1 px-4 py-2 bg-background-base border-b border-border-weak-base shrink-0">
        <For each={STEPS}>
          {(step, index) => {
            const status = createMemo(() => stepStatus(step.type))
            return (
              <>
                <Show when={index() > 0}>
                  <div
                    classList={{
                      "h-px w-6 transition-colors duration-200": true,
                      "bg-text-success-base": status() === "complete",
                      "bg-border-weak-base": status() !== "complete",
                    }}
                  />
                </Show>
                <div
                  classList={{
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-12-medium transition-all duration-200": true,
                    "bg-surface-info-base text-text-info-base": status() === "active",
                    "bg-surface-success-base/10 text-text-success-base": status() === "complete",
                    "text-text-tertiary-base": status() === "pending",
                  }}
                >
                  <Show
                    when={status() === "complete"}
                    fallback={
                      <span
                        classList={{
                          "size-4 rounded-full flex items-center justify-center text-10-medium border": true,
                          "border-text-info-base": status() === "active",
                          "border-border-weak-base": status() === "pending",
                        }}
                      >
                        {index() + 1}
                      </span>
                    }
                  >
                    <Icon name="check" class="size-3.5" />
                  </Show>
                  <span>{step.label}</span>
                </div>
              </>
            )
          }}
        </For>
      </div>

      {/* Document Viewer (reuses existing FileViewer) */}
      <div class="flex-1 min-h-0 relative" style={{ "background-color": "#1e1e1e" }}>
        <FileViewer path={props.path} onAskAboutSelection={props.onAskAboutSelection} />
      </div>

      {/* Action Buttons */}
      <div class="flex items-center justify-between px-4 py-2 bg-background-base border-t border-border-weak-base shrink-0">
        <div class="flex items-center gap-2">
          <Show when={props.workflow}>
            <span class="text-12-medium text-text-secondary-base">
              Step {currentStepIndex() + 1} of {STEPS.length}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <Show when={nextStepLabel()}>
            {(label) => (
              <Button
                variant="ghost"
                size="small"
                class="text-text-info-base hover:bg-surface-info-base/10 gap-1"
                onClick={() => props.onAdvanceStep?.()}
              >
                <span class="text-12-medium">Next: {label()}</span>
                <Icon name="chevron-right" class="size-3.5" />
              </Button>
            )}
          </Show>
          <Show when={!nextStepLabel() && props.workflow?.currentStep === "erd"}>
            <Button
              variant="ghost"
              size="small"
              class="text-text-success-base hover:bg-surface-success-base/10 gap-1"
              onClick={() => props.onAdvanceStep?.()}
            >
              <span class="text-12-medium">Complete Workflow</span>
              <Icon name="check" class="size-3.5" />
            </Button>
          </Show>
        </div>
      </div>
    </div>
  )
}
