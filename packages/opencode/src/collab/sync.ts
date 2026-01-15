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

    if (mergeResult.exitCode !== 0) {
      // Check if merge was blocked (not a conflict)
      const output = mergeResult.stderr.toString()
      const localChangesBlocked = output.includes("Your local changes to the following files would be overwritten")
      const untrackedBlocked = output.includes("untracked working tree files would be overwritten")

      if (localChangesBlocked || untrackedBlocked) {
        const blockedFiles = parseBlockedFiles(output)
        const reason = untrackedBlocked ? "untracked_files" : "uncommitted_changes"

        await Bus.publish(Collab.Event.MergeBlocked, { reason, files: blockedFiles })

        const branch = await $`git rev-parse --abbrev-ref HEAD`
          .quiet()
          .cwd(Instance.worktree)
          .text()
          .then((x) => x.trim())

        await Bus.publish(Collab.Event.StatusChanged, {
          branch,
          isDirty: true,
          hasUnpushed: false,
          isOnline: true,
          hasConflicts: false,
        })

        const result: Collab.SyncResult = {
          success: false,
          changes: incomingCount,
          conflicts: false,
          blocked: true,
          blockedFiles,
        }

        await Bus.publish(Collab.Event.SyncCompleted, result)
        return result
      }

      // Actual merge conflict
      const conflictedFiles = await CollabConflict.getConflictedFiles()
      await Bus.publish(Collab.Event.ConflictDetected, { files: conflictedFiles })
    }

    const hasConflicts = mergeResult.exitCode !== 0

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

  export async function executeWithStash(): Promise<Collab.SyncResult> {
    // Check if there are uncommitted changes to stash
    const statusCheck = await $`git status --porcelain`.quiet().nothrow().cwd(Instance.worktree).text()
    const hasChanges = statusCheck.trim().length > 0

    let stashCreated = false

    if (hasChanges) {
      // Get stash count before
      const beforeCount = await $`git stash list`
        .quiet()
        .nothrow()
        .cwd(Instance.worktree)
        .text()
        .then((x) => x.trim().split("\n").filter(Boolean).length)

      // Create stash
      await $`git stash push --include-untracked -m "opencode-auto-stash"`.quiet().nothrow().cwd(Instance.worktree)

      // Verify stash was created
      const afterCount = await $`git stash list`
        .quiet()
        .nothrow()
        .cwd(Instance.worktree)
        .text()
        .then((x) => x.trim().split("\n").filter(Boolean).length)

      stashCreated = afterCount > beforeCount
    }

    // Execute sync
    const result = await execute()

    // Pop stash ONLY if we created one
    if (stashCreated) {
      await $`git stash pop`.quiet().nothrow().cwd(Instance.worktree)
    }

    return result
  }

  function parseBlockedFiles(output: string): string[] {
    const lines = output.split("\n")
    const files: string[] = []
    let inFileList = false

    for (const line of lines) {
      if (line.includes("would be overwritten by merge")) {
        inFileList = true
        continue
      }
      if (inFileList) {
        const trimmed = line.trim()
        if (trimmed === "" || trimmed.startsWith("Please") || trimmed === "Aborting") {
          break
        }
        if (trimmed) {
          files.push(trimmed)
        }
      }
    }
    return files
  }
}
