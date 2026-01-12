import { $ } from "bun"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { Collab } from "."
import { CollabConflict } from "./conflict"

export namespace CollabSync {
  export async function execute(): Promise<Collab.SyncResult> {
    // Check if origin exists
    const originCheck = await $`git remote get-url origin`.quiet().nothrow().cwd(Instance.worktree)

    if (originCheck.exitCode !== 0) {
      const result: Collab.SyncResult = { success: false, changes: 0, conflicts: false }
      await Bus.publish(Collab.Event.SyncCompleted, result)
      return result
    }

    // Fetch from remote
    const fetchResult = await $`git fetch origin`.quiet().nothrow().cwd(Instance.worktree)

    if (fetchResult.exitCode !== 0) {
      const result: Collab.SyncResult = { success: false, changes: 0, conflicts: false }
      await Bus.publish(Collab.Event.SyncCompleted, result)
      return result
    }

    // Check if upstream exists
    const upstreamCheck = await $`git rev-parse --abbrev-ref @{u}`.quiet().nothrow().cwd(Instance.worktree)

    if (upstreamCheck.exitCode !== 0) {
      // No upstream - nothing to merge
      const result: Collab.SyncResult = { success: true, changes: 0, conflicts: false }
      await Bus.publish(Collab.Event.SyncCompleted, result)
      return result
    }

    // Get count of incoming commits
    const incomingCount = await $`git rev-list HEAD..@{u} --count`
      .quiet()
      .nothrow()
      .cwd(Instance.worktree)
      .text()
      .then((x) => parseInt(x.trim()) || 0)

    if (incomingCount === 0) {
      const result: Collab.SyncResult = { success: true, changes: 0, conflicts: false }
      await Bus.publish(Collab.Event.SyncCompleted, result)
      return result
    }

    // Try to merge
    const mergeResult = await $`git merge @{u} --no-edit`.quiet().nothrow().cwd(Instance.worktree)

    const hasConflicts = mergeResult.exitCode !== 0

    // Emit ConflictDetected event when conflicts occur
    if (hasConflicts) {
      const conflictedFiles = await CollabConflict.getConflictedFiles()
      await Bus.publish(Collab.Event.ConflictDetected, { files: conflictedFiles })
    }

    // Publish status update
    const branch = await $`git rev-parse --abbrev-ref HEAD`
      .quiet()
      .cwd(Instance.worktree)
      .text()
      .then((x) => x.trim())

    await Bus.publish(Collab.Event.StatusChanged, {
      branch,
      isDirty: hasConflicts,
      hasUnpushed: false,
      isOnline: true,
      hasConflicts,
    })

    const result: Collab.SyncResult = {
      success: !hasConflicts,
      changes: incomingCount,
      conflicts: hasConflicts,
    }

    // Emit SyncCompleted event for frontend toast
    await Bus.publish(Collab.Event.SyncCompleted, result)

    return result
  }
}
