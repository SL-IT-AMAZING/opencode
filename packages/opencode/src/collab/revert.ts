import { $ } from "bun"
import * as fs from "fs/promises"
import * as path from "path"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { Collab } from "."

// Browse state file location (in .opencode directory)
const BROWSE_STATE_FILE = ".opencode/.browse-state.json"

interface BrowseState {
  originalBranch: string
  stashRef: string | null
  timestamp: number
}

export namespace CollabRevert {
  export type RevertAction = "browse" | "fresh" | "replace"

  export interface BrowseResult {
    success: boolean
    originalBranch: string
    isDetached: boolean
  }

  export interface FreshResult {
    success: boolean
    newBranch: string
    fromCommit: string
  }

  export interface ReplaceResult {
    success: boolean
    lostCommits: number
    pushed: boolean
  }

  // Validate commit hash format
  function validateHash(hash: string): boolean {
    return /^[a-f0-9]{7,40}$/i.test(hash)
  }

  // Get current branch (or HEAD if detached)
  async function getCurrentBranch(): Promise<string> {
    const result = await $`git rev-parse --abbrev-ref HEAD`.quiet().nothrow().cwd(Instance.worktree).text()
    return result.trim() || "HEAD"
  }

  // Check if currently in detached HEAD state
  async function isDetachedHead(): Promise<boolean> {
    const branch = await getCurrentBranch()
    return branch === "HEAD"
  }

  // Save browse state to file (persists originalBranch + stashRef)
  async function saveBrowseState(state: BrowseState): Promise<void> {
    const statePath = path.join(Instance.worktree, BROWSE_STATE_FILE)
    const dir = path.dirname(statePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(statePath, JSON.stringify(state, null, 2))
  }

  // Load browse state from file
  async function loadBrowseState(): Promise<BrowseState | null> {
    const statePath = path.join(Instance.worktree, BROWSE_STATE_FILE)
    const exists = await fs
      .access(statePath)
      .then(() => true)
      .catch(() => false)
    if (!exists) return null
    const content = await fs.readFile(statePath, "utf-8")
    return JSON.parse(content) as BrowseState
  }

  // Clear browse state file
  async function clearBrowseState(): Promise<void> {
    const statePath = path.join(Instance.worktree, BROWSE_STATE_FILE)
    await fs.unlink(statePath).catch(() => {})
  }

  // Browse: Checkout specific commit in detached HEAD state
  export async function browse(commitHash: string): Promise<BrowseResult> {
    if (!validateHash(commitHash)) {
      return { success: false, originalBranch: "", isDetached: false }
    }

    // Don't allow browse if already detached
    if (await isDetachedHead()) {
      return { success: false, originalBranch: "", isDetached: true }
    }

    const originalBranch = await getCurrentBranch()

    // Check if there are uncommitted changes to stash
    const statusCheck = await $`git status --porcelain`.quiet().nothrow().cwd(Instance.worktree).text()
    const hasChanges = statusCheck.trim().length > 0

    // Create stash only if there are changes, and capture the ref
    let stashRef: string | null = null
    if (hasChanges) {
      // Get current stash list count before
      const beforeCount = await $`git stash list`
        .quiet()
        .nothrow()
        .cwd(Instance.worktree)
        .text()
        .then((x) => x.trim().split("\n").filter(Boolean).length)

      await $`git stash push --include-untracked -m "browse-mode-auto-stash"`.quiet().nothrow().cwd(Instance.worktree)

      // Verify stash was created
      const afterCount = await $`git stash list`
        .quiet()
        .nothrow()
        .cwd(Instance.worktree)
        .text()
        .then((x) => x.trim().split("\n").filter(Boolean).length)

      if (afterCount > beforeCount) {
        stashRef = "stash@{0}"
      }
    }

    const result = await $`git checkout ${commitHash}`.quiet().nothrow().cwd(Instance.worktree)

    if (result.exitCode !== 0) {
      // Restore stash on failure (only if we created one)
      if (stashRef) {
        await $`git stash pop`.quiet().nothrow().cwd(Instance.worktree)
      }
      return { success: false, originalBranch, isDetached: false }
    }

    // Persist browse state for later recovery
    await saveBrowseState({
      originalBranch,
      stashRef,
      timestamp: Date.now(),
    })

    await Bus.publish(Collab.Event.StatusChanged, await getStatus())
    return { success: true, originalBranch, isDetached: true }
  }

  // Exit browse mode: Return to original branch
  export async function exitBrowse(originalBranch: string): Promise<boolean> {
    // Load saved state to get stash ref
    const state = await loadBrowseState()

    const result = await $`git checkout ${originalBranch}`.quiet().nothrow().cwd(Instance.worktree)

    if (result.exitCode !== 0) {
      return false
    }

    // Pop stash only if we created one during browse
    if (state?.stashRef) {
      await $`git stash pop`.quiet().nothrow().cwd(Instance.worktree)
    }

    // Clear browse state
    await clearBrowseState()

    await Bus.publish(Collab.Event.StatusChanged, await getStatus())
    return true
  }

  // Get persisted browse state (for status.ts to read)
  export async function getBrowseState(): Promise<BrowseState | null> {
    return loadBrowseState()
  }

  // Start Fresh: Create new branch from specific commit
  export async function startFresh(commitHash: string, branchName: string): Promise<FreshResult> {
    if (!validateHash(commitHash)) {
      return { success: false, newBranch: "", fromCommit: commitHash }
    }

    // Validate branch name (no spaces, special chars)
    if (!/^[\w\-\/]+$/.test(branchName)) {
      return { success: false, newBranch: "", fromCommit: commitHash }
    }

    // Use git show-ref to check branch (avoids tag confusion)
    const branchCheck = await $`git show-ref --verify refs/heads/${branchName}`.quiet().nothrow().cwd(Instance.worktree)

    // Determine final branch name (don't mutate original)
    const finalBranchName = branchCheck.exitCode === 0 ? `${branchName}-${Date.now()}` : branchName

    const result = await $`git checkout -b ${finalBranchName} ${commitHash}`.quiet().nothrow().cwd(Instance.worktree)

    if (result.exitCode !== 0) {
      return { success: false, newBranch: "", fromCommit: commitHash }
    }

    // Clear any browse state if exiting browse via fresh
    await clearBrowseState()

    await Bus.publish(Collab.Event.StatusChanged, await getStatus())
    return { success: true, newBranch: finalBranchName, fromCommit: commitHash }
  }

  // Replace Main: Hard reset current branch (DANGEROUS!)
  export async function replaceMain(commitHash: string, forcePush: boolean = false): Promise<ReplaceResult> {
    if (!validateHash(commitHash)) {
      return { success: false, lostCommits: 0, pushed: false }
    }

    // Don't allow replace in detached HEAD state
    if (await isDetachedHead()) {
      await Bus.publish(Collab.Event.StatusChanged, await getStatus())
      return { success: false, lostCommits: 0, pushed: false }
    }

    // Count commits that will be lost
    const lostCount = await $`git rev-list ${commitHash}..HEAD --count`
      .quiet()
      .nothrow()
      .cwd(Instance.worktree)
      .text()
      .then((x) => parseInt(x.trim()) || 0)

    // Create a backup tag before destructive operation
    const backupTag = `backup-before-replace-${Date.now()}`
    await $`git tag ${backupTag} HEAD`.quiet().nothrow().cwd(Instance.worktree)

    // Perform hard reset
    const result = await $`git reset --hard ${commitHash}`.quiet().nothrow().cwd(Instance.worktree)

    if (result.exitCode !== 0) {
      // Remove backup tag on failure
      await $`git tag -d ${backupTag}`.quiet().nothrow().cwd(Instance.worktree)
      await Bus.publish(Collab.Event.StatusChanged, await getStatus())
      return { success: false, lostCommits: 0, pushed: false }
    }

    let pushed = false
    if (forcePush) {
      // Use --force-with-lease for safer force push
      const pushResult = await $`git push --force-with-lease`.quiet().nothrow().cwd(Instance.worktree)
      pushed = pushResult.exitCode === 0
    }

    await Bus.publish(Collab.Event.StatusChanged, await getStatus())
    return { success: true, lostCommits: lostCount, pushed }
  }

  // Helper: Get current status
  async function getStatus(): Promise<Collab.Status> {
    const { CollabStatus } = await import("./status")
    return CollabStatus.get()
  }
}
