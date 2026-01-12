import { $ } from "bun"
import * as fs from "fs/promises"
import * as path from "path"
import { createHash } from "crypto"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import { Collab } from "."

export namespace CollabTeam {
  const TEAM_FILE = ".opencode/team.json"

  export interface TeamMember {
    id: string
    name: string
    email: string
    github?: string
    avatar?: string
    firstCommit?: number
    lastCommit?: number
    commitCount?: number
  }

  export interface TeamData {
    members: TeamMember[]
    lastUpdated: number
    source: "git" | "github" | "manual"
    currentUserEmail?: string
  }

  // Get the current git user's email
  export async function getCurrentUserEmail(): Promise<string | undefined> {
    const result = await $`git config user.email`.quiet().nothrow().cwd(Instance.worktree).text()
    return result.trim() || undefined
  }

  // Get Gravatar URL from email
  function getGravatarUrl(email: string): string {
    const hash = createHash("md5").update(email.toLowerCase().trim()).digest("hex")
    return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=64`
  }

  // Try to fetch GitHub avatar by searching for user by email
  async function fetchGitHubAvatar(email: string): Promise<string | undefined> {
    try {
      const response = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(email)}+in:email`, {
        headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "opencode" },
      })
      if (!response.ok) return undefined
      const data = (await response.json()) as { items?: { avatar_url?: string }[] }
      if (data.items?.[0]?.avatar_url) {
        return data.items[0].avatar_url
      }
    } catch {
      // Fall through to undefined
    }
    return undefined
  }

  // Get avatar for a team member (GitHub first, then Gravatar fallback)
  async function getAvatarForMember(email: string): Promise<string> {
    const githubAvatar = await fetchGitHubAvatar(email)
    if (githubAvatar) return githubAvatar
    // Fallback to Gravatar with identicon
    return getGravatarUrl(email)
  }

  // Detect team members from git history
  export async function detectFromGit(): Promise<TeamMember[]> {
    console.log("[CollabTeam.detectFromGit] worktree:", Instance.worktree)
    // Don't try to detect from git at root filesystem
    if (Instance.worktree === "/" || Instance.worktree === "") {
      console.log("[CollabTeam.detectFromGit] EARLY EXIT - root or empty worktree")
      return []
    }

    // Check if git repo exists first
    const gitCheck = await $`git rev-parse --git-dir`.quiet().nothrow().cwd(Instance.worktree)
    console.log("[CollabTeam.detectFromGit] git check exitCode:", gitCheck.exitCode)
    if (gitCheck.exitCode !== 0) {
      console.log("[CollabTeam.detectFromGit] EARLY EXIT - not a git repo")
      return []
    }

    // Use %x00 (null byte) as delimiter to avoid shell pipe interpretation
    // The | character in template literals gets interpreted as a shell pipe
    const format = "%ae%x00%an"
    const result = await $`git log --format=${format} --all`.quiet().nothrow().cwd(Instance.worktree).text()
    console.log(
      "[CollabTeam.detectFromGit] git log result length:",
      result.length,
      "first 100 chars:",
      result.slice(0, 100),
    )

    if (!result.trim()) {
      console.log("[CollabTeam.detectFromGit] EARLY EXIT - empty git log result")
      return []
    }

    const authorMap = new Map<string, TeamMember>()

    for (const line of result.trim().split("\n")) {
      const [email, name] = line.split("\0")
      if (!email || !name) continue

      const existing = authorMap.get(email)
      if (!existing) {
        authorMap.set(email, {
          id: email,
          name,
          email,
          commitCount: 1,
        })
      } else {
        existing.commitCount = (existing.commitCount ?? 0) + 1
      }
    }

    // Get first/last commit timestamps for each author
    for (const [email, member] of authorMap) {
      const first = await $`git log --author=${email} --reverse --format=%at -1`
        .quiet()
        .nothrow()
        .cwd(Instance.worktree)
        .text()
      const last = await $`git log --author=${email} --format=%at -1`.quiet().nothrow().cwd(Instance.worktree).text()

      member.firstCommit = parseInt(first.trim()) * 1000 || undefined
      member.lastCommit = parseInt(last.trim()) * 1000 || undefined
    }

    const members = Array.from(authorMap.values()).sort((a, b) => (b.commitCount ?? 0) - (a.commitCount ?? 0))
    console.log("[CollabTeam.detectFromGit] Final members count:", members.length)
    return members
  }

  // Load team from .opencode/team.json
  export async function load(): Promise<TeamData | undefined> {
    const teamPath = path.join(Instance.worktree, TEAM_FILE)
    const exists = await fs
      .access(teamPath)
      .then(() => true)
      .catch(() => false)
    if (!exists) return undefined

    const content = await fs.readFile(teamPath, "utf-8")
    return JSON.parse(content) as TeamData
  }

  // Save team to .opencode/team.json
  export async function save(data: TeamData): Promise<void> {
    // Don't save to root filesystem or non-project directories
    if (Instance.worktree === "/" || Instance.worktree === "") {
      return
    }

    const teamPath = path.join(Instance.worktree, TEAM_FILE)
    const dir = path.dirname(teamPath)

    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(teamPath, JSON.stringify(data, null, 2))
    await Bus.publish(Collab.Event.TeamUpdated, { members: data.members.length })
  }

  // Get team (from file or auto-detect)
  export async function get(): Promise<TeamData> {
    try {
      console.log("[CollabTeam.get] Starting, worktree:", Instance.worktree)
      const existing = await load()
      console.log("[CollabTeam.get] Existing from file:", existing ? `yes (${existing.members.length} members)` : "no")
      const currentUserEmail = await getCurrentUserEmail()
      console.log("[CollabTeam.get] currentUserEmail:", currentUserEmail)

      if (existing) {
        return { ...existing, currentUserEmail }
      }

      const members = await detectFromGit()
      console.log("[CollabTeam.get] detectFromGit returned:", members.length, "members")
      const data: TeamData = {
        members,
        lastUpdated: Date.now(),
        source: "git",
        currentUserEmail,
      }

      return data
    } catch (error) {
      console.error("[CollabTeam.get] ERROR:", error)
      throw error
    }
  }

  // Update single member
  export async function updateMember(email: string, updates: Partial<TeamMember>): Promise<boolean> {
    const data = await get()
    const member = data.members.find((m) => m.email === email)
    if (!member) return false

    Object.assign(member, updates)
    data.lastUpdated = Date.now()
    await save(data)
    return true
  }

  // Refresh from git (re-detect)
  export async function refresh(): Promise<TeamData> {
    try {
      console.log("[CollabTeam.refresh] Starting, worktree:", Instance.worktree)
    } catch (e) {
      console.error("[CollabTeam.refresh] Failed to get worktree:", e)
    }
    const members = await detectFromGit()
    const existing = await load()
    const currentUserEmail = await getCurrentUserEmail()

    // Merge: keep manual edits (github, avatar) from existing
    if (existing) {
      for (const member of members) {
        const prev = existing.members.find((m) => m.email === member.email)
        if (prev) {
          member.github = prev.github
          member.avatar = prev.avatar
        }
      }
    }

    // Fetch avatars for members that don't have one
    await Promise.all(
      members.map(async (member) => {
        if (!member.avatar) {
          member.avatar = await getAvatarForMember(member.email)
        }
      }),
    )

    const data: TeamData = {
      members,
      lastUpdated: Date.now(),
      source: "git",
      currentUserEmail,
    }

    await save(data)
    return data
  }
}
