import { Show, createMemo } from "solid-js"
import { DateTime } from "luxon"
import { useSync } from "@/context/sync"
import { Icon } from "@anyon/ui/icon"
import { getDirectory, getFilename } from "@anyon/util/path"
import { Select } from "@anyon/ui/select"

const MAIN_WORKTREE = "main"
const CREATE_WORKTREE = "create"

interface NewSessionViewProps {
  worktree: string
  onWorktreeChange: (value: string) => void
}

export function NewSessionView(props: NewSessionViewProps) {
  const sync = useSync()

  const sandboxes = createMemo(() => sync.project?.sandboxes ?? [])
  const options = createMemo(() => [MAIN_WORKTREE, ...sandboxes(), CREATE_WORKTREE])
  const current = createMemo(() => {
    const selection = props.worktree
    if (options().includes(selection)) return selection
    return MAIN_WORKTREE
  })
  const projectRoot = createMemo(() => sync.project?.worktree ?? sync.data.path.directory)
  const isWorktree = createMemo(() => {
    const project = sync.project
    if (!project) return false
    return sync.data.path.directory !== project.worktree
  })

  const label = (value: string) => {
    if (value === MAIN_WORKTREE) {
      if (isWorktree()) return "Main branch"
      const branch = sync.data.vcs?.branch
      if (branch) return `Main branch (${branch})`
      return "Main branch"
    }

    if (value === CREATE_WORKTREE) return "Create new worktree"

    return getFilename(value)
  }

  return (
    <div
      class="size-full flex flex-col justify-center items-center gap-8 flex-[1_0_0] self-stretch max-w-200 mx-auto px-6"
      style={{ "padding-bottom": "calc(var(--prompt-height, 11.25rem) + 32px)" }}
    >
      {/* Main heading area */}
      <div class="flex flex-col items-center gap-4 text-center">
        <Icon name="brain" class="size-10 text-text-weak" />
        <h1 class="text-36-medium md:text-48-medium text-text-strong">What would you like to build?</h1>
      </div>

      {/* Project info - secondary */}
      <div class="flex flex-col items-center gap-3 text-text-weak">
        <div class="flex items-center gap-3">
          <Icon name="folder" size="small" />
          <div class="text-14-regular">
            {getDirectory(projectRoot())}
            <span class="text-text-strong">{getFilename(projectRoot())}</span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <Icon name="branch" size="small" />
          <Select
            options={options()}
            current={current()}
            value={(x) => x}
            label={label}
            onSelect={(value) => {
              props.onWorktreeChange(value ?? MAIN_WORKTREE)
            }}
            size="normal"
            variant="ghost"
            class="text-12-medium"
          />
        </div>
        <Show when={sync.project}>
          {(project) => (
            <div class="flex items-center gap-3">
              <Icon name="pencil-line" size="small" />
              <div class="text-12-medium">
                Last modified&nbsp;
                <span class="text-text-strong">
                  {DateTime.fromMillis(project().time.updated ?? project().time.created).toRelative()}
                </span>
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
