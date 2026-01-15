import { $ } from "bun"
import { Instance } from "../project/instance"
import type { Collab } from "."

export namespace CollabHistory {
  export async function list(limit = 20, offset = 0): Promise<Collab.CommitInfo[]> {
    // Defensive: validate inputs
    const safeLimit = Math.max(1, Math.min(limit, 100))
    const safeOffset = Math.max(0, offset)

    // Check if git repo exists first
    const gitCheck = await $`git rev-parse --git-dir`.quiet().nothrow().cwd(Instance.worktree)

    if (gitCheck.exitCode !== 0) return [] // Not a git repo

    // Use %x00 (null byte) as delimiter to handle messages with | character
    const format = "%H%x00%s%x00%an%x00%ae%x00%at"
    const result = await $`git log --format=${format} -n ${safeLimit} --skip=${safeOffset}`
      .quiet()
      .nothrow()
      .cwd(Instance.worktree)
      .text()

    if (!result.trim()) return [] // Empty repo or no commits

    return result
      .trim()
      .split("\n")
      .map((line) => {
        const parts = line.split("\0")
        const [hash, message, authorName, authorEmail, timestamp] = parts
        return {
          hash: hash || "",
          message: message || "(no message)",
          author: {
            name: authorName || "Unknown",
            email: authorEmail || "",
          },
          timestamp: parseInt(timestamp) * 1000 || Date.now(),
        }
      })
      .filter((c) => c.hash) // Filter out malformed entries
  }

  export async function getFiles(hash: string): Promise<string[]> {
    // Validate hash format (basic check)
    if (!hash || !/^[a-f0-9]{7,40}$/i.test(hash)) return []

    // Use --root flag to handle initial commit (no parent)
    const result = await $`git diff-tree --root --no-commit-id --name-only -r ${hash}`
      .quiet()
      .nothrow()
      .cwd(Instance.worktree)
      .text()

    if (!result.trim()) return []
    return result.trim().split("\n").filter(Boolean)
  }
}
