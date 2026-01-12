import { Vcs } from "../project/vcs"
import { Instance } from "../project/instance"
import { $ } from "bun"
import { Collab } from "."
import { CollabRevert } from "./revert"
import { CollabConflict } from "./conflict"

export namespace CollabStatus {
  export async function get(): Promise<Collab.Status> {
    const branch = (await Vcs.branch()) ?? "unknown"
    const isDirty = await checkDirty()
    const hasUnpushed = await checkUnpushed()
    const isOnline = await checkOnline()

    // Check for detached HEAD and browse state
    const isDetached = branch === "HEAD"
    const browseState = await CollabRevert.getBrowseState()
    const originalBranch = browseState?.originalBranch

    // Check for conflicts
    const hasConflicts = await CollabConflict.hasConflicts()
    const conflictCount = hasConflicts ? (await CollabConflict.getConflictedFiles()).length : 0

    return {
      branch,
      isDirty,
      hasUnpushed,
      isOnline,
      isDetached,
      originalBranch,
      hasConflicts,
      conflictCount,
    }
  }

  async function checkDirty(): Promise<boolean> {
    const result = await $`git status --porcelain`.quiet().nothrow().cwd(Instance.worktree)
    return result.text().trim().length > 0
  }

  async function checkUnpushed(): Promise<boolean> {
    // First check if upstream exists
    const upstreamCheck = await $`git rev-parse --abbrev-ref @{u}`.quiet().nothrow().cwd(Instance.worktree)

    // No upstream configured - treat as "nothing to push"
    if (upstreamCheck.exitCode !== 0) return false

    const result = await $`git log @{u}.. --oneline`.quiet().nothrow().cwd(Instance.worktree)
    return result.text().trim().length > 0
  }

  async function checkOnline(): Promise<boolean> {
    // First check if origin exists
    const originCheck = await $`git remote get-url origin`.quiet().nothrow().cwd(Instance.worktree)

    if (originCheck.exitCode !== 0) return false

    const result = await $`git ls-remote --exit-code origin HEAD`.quiet().nothrow().cwd(Instance.worktree)
    return result.exitCode === 0
  }
}
