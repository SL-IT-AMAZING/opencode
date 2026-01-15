import { $ } from "bun"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { Collab } from "."

export namespace CollabSave {
  export async function execute(message?: string): Promise<Collab.SaveResult> {
    await Bus.publish(Collab.Event.SaveStarted, {})

    // Check if there are changes to commit
    const statusCheck = await $`git status --porcelain`.quiet().nothrow().cwd(Instance.worktree)

    const hasChanges = statusCheck.text().trim().length > 0

    if (!hasChanges) {
      // Nothing to commit - return current HEAD
      const hash = await $`git rev-parse HEAD`
        .quiet()
        .cwd(Instance.worktree)
        .text()
        .then((x) => x.trim())

      const result: Collab.SaveResult = { commitHash: hash, message: "", pushed: false, skipped: true }
      await Bus.publish(Collab.Event.SaveCompleted, result)
      return result
    }

    // git add .
    await $`git add .`.cwd(Instance.worktree)

    // commit (message 없으면 기본 메시지)
    const commitMessage = message ?? `Save at ${new Date().toISOString()}`
    const commitResult = await $`git commit -m ${commitMessage}`.quiet().nothrow().cwd(Instance.worktree)

    // Handle "nothing to commit" edge case (all changes were in .gitignore)
    if (commitResult.exitCode !== 0) {
      const hash = await $`git rev-parse HEAD`
        .quiet()
        .cwd(Instance.worktree)
        .text()
        .then((x) => x.trim())
      const result: Collab.SaveResult = { commitHash: hash, message: "", pushed: false, skipped: true }
      await Bus.publish(Collab.Event.SaveCompleted, result)
      return result
    }

    // get commit hash
    const hash = await $`git rev-parse HEAD`
      .quiet()
      .cwd(Instance.worktree)
      .text()
      .then((x) => x.trim())

    // Check if upstream exists before pushing
    const upstreamCheck = await $`git rev-parse --abbrev-ref @{u}`.quiet().nothrow().cwd(Instance.worktree)

    let pushed = false
    let pushError: "remote_ahead" | "auth_failed" | "network" | "other" | undefined

    if (upstreamCheck.exitCode === 0) {
      // Has upstream - try to push
      const pushResult = await $`git push`.quiet().nothrow().cwd(Instance.worktree)
      pushed = pushResult.exitCode === 0

      if (!pushed) {
        const stderr = pushResult.stderr.toString()
        // Detect "remote ahead" patterns:
        // - "[rejected]" with "(fetch first)" or "(non-fast-forward)"
        // - "Updates were rejected because the remote contains work"
        if (
          stderr.includes("fetch first") ||
          stderr.includes("non-fast-forward") ||
          stderr.includes("remote contains work")
        ) {
          pushError = "remote_ahead"
        } else if (stderr.includes("Authentication") || stderr.includes("Permission denied")) {
          pushError = "auth_failed"
        } else if (stderr.includes("Could not resolve host") || stderr.includes("Connection refused")) {
          pushError = "network"
        } else {
          pushError = "other"
        }
      }
    }

    const result: Collab.SaveResult = { commitHash: hash, message: commitMessage, pushed, skipped: false, pushError }
    await Bus.publish(Collab.Event.SaveCompleted, result)
    return result
  }
}
