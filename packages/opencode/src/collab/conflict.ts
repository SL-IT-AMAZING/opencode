import { $ } from "bun"
import * as fs from "fs/promises"
import * as path from "path"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { Collab } from "."

export namespace CollabConflict {
  export interface ConflictFile {
    path: string
    conflicts: ConflictSection[]
  }

  export interface ConflictSection {
    startLine: number
    endLine: number
    ours: string
    theirs: string
    base?: string
  }

  export type Resolution = "ours" | "theirs" | "custom"

  // Validate file path to prevent path traversal attacks
  function validateFilePath(filePath: string): boolean {
    if (filePath.startsWith("/") || filePath.startsWith("\\")) return false
    if (filePath.includes("..")) return false
    if (filePath.includes("\0")) return false
    const fullPath = path.join(Instance.worktree, filePath)
    const resolved = path.resolve(fullPath)
    return resolved.startsWith(Instance.worktree + path.sep)
  }

  // Check if there are unresolved conflicts
  export async function hasConflicts(): Promise<boolean> {
    const result = await $`git ls-files -u`.quiet().nothrow().cwd(Instance.worktree).text()
    return result.trim().length > 0
  }

  // Get list of conflicted files
  export async function getConflictedFiles(): Promise<string[]> {
    const result = await $`git diff --name-only --diff-filter=U`.quiet().nothrow().cwd(Instance.worktree).text()

    if (!result.trim()) return []
    return result.trim().split("\n").filter(Boolean)
  }

  // Parse conflict markers from a file
  export async function parseFile(filePath: string): Promise<ConflictFile> {
    const fullPath = path.join(Instance.worktree, filePath)
    const content = await fs.readFile(fullPath, "utf-8")

    const conflicts: ConflictSection[] = []
    const lines = content.split("\n")

    let i = 0
    while (i < lines.length) {
      if (lines[i].startsWith("<<<<<<<")) {
        const startLine = i + 1

        const oursLines: string[] = []
        i++
        while (i < lines.length && !lines[i].startsWith("=======")) {
          oursLines.push(lines[i])
          i++
        }

        i++

        const theirsLines: string[] = []
        while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
          theirsLines.push(lines[i])
          i++
        }

        const endLine = i + 1

        conflicts.push({
          startLine,
          endLine,
          ours: oursLines.join("\n"),
          theirs: theirsLines.join("\n"),
        })
      }
      i++
    }

    return { path: filePath, conflicts }
  }

  // Get all conflicts with parsed content
  export async function getAll(): Promise<ConflictFile[]> {
    const files = await getConflictedFiles()
    return Promise.all(files.map(parseFile))
  }

  // Resolve a single file
  export async function resolveFile(
    filePath: string,
    resolution: Resolution,
    customContent?: string,
  ): Promise<boolean> {
    if (!validateFilePath(filePath)) {
      return false
    }

    const fullPath = path.join(Instance.worktree, filePath)

    if (resolution === "ours") {
      await $`git checkout --ours ${filePath}`.cwd(Instance.worktree)
    } else if (resolution === "theirs") {
      await $`git checkout --theirs ${filePath}`.cwd(Instance.worktree)
    } else if (resolution === "custom" && customContent !== undefined) {
      await fs.writeFile(fullPath, customContent)
    }

    const result = await $`git add ${filePath}`.nothrow().cwd(Instance.worktree)
    return result.exitCode === 0
  }

  // Abort merge
  export async function abortMerge(): Promise<boolean> {
    const result = await $`git merge --abort`.nothrow().cwd(Instance.worktree)
    await Bus.publish(Collab.Event.StatusChanged, await getStatus())
    return result.exitCode === 0
  }

  // Continue merge (after all conflicts resolved)
  export async function continueMerge(): Promise<boolean> {
    const hasMore = await hasConflicts()
    if (hasMore) return false

    const result = await $`git commit --no-edit`.nothrow().cwd(Instance.worktree)
    await Bus.publish(Collab.Event.StatusChanged, await getStatus())
    return result.exitCode === 0
  }

  // Helper
  async function getStatus(): Promise<Collab.Status> {
    const { CollabStatus } = await import("./status")
    return CollabStatus.get()
  }
}
