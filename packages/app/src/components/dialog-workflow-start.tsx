import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import { Icon } from "@anyon/ui/icon"

interface DialogWorkflowStartProps {
  onStartWorkflow: () => void
  onSkip: () => void
}

export function DialogWorkflowStart(props: DialogWorkflowStartProps) {
  const dialog = useDialog()

  const handleSkip = () => {
    props.onSkip()
    dialog.close()
  }

  const handleStart = () => {
    props.onStartWorkflow()
    dialog.close()
  }

  return (
    <Dialog
      centered
      title={<span class="block text-center">How would you like to start?</span>}
      action={<></>}
      preventClose
    >
      <div class="flex flex-col gap-6 px-2.5 pb-3">
        <div class="grid grid-cols-2 gap-3">
          <button
            class="flex flex-col items-center gap-3 p-5 rounded-lg border border-border-base hover:bg-surface-raised-base transition-colors cursor-pointer"
            onClick={handleSkip}
          >
            <Icon name="brain" size="large" class="text-text-subtle" />
            <div class="text-center">
              <div class="text-14-medium text-text-base">Start from Scratch</div>
              <div class="text-13-regular text-text-subtle">Jump straight into coding</div>
            </div>
          </button>
          <button
            class="flex flex-col items-center gap-3 p-5 rounded-lg border border-border-base hover:bg-surface-raised-base transition-colors cursor-pointer"
            onClick={handleStart}
          >
            <Icon name="checklist" size="large" class="text-text-subtle" />
            <div class="text-center">
              <div class="text-14-medium text-text-base">Guided Workflow</div>
              <div class="text-13-regular text-text-subtle">PRD → User Flow → ERD</div>
            </div>
          </button>
        </div>
      </div>
    </Dialog>
  )
}
