import { Octokit } from "@octokit/rest"
import { GitHubAuth } from "./auth"
import { Log } from "../util/log"

const log = Log.create({ service: "github.repo" })

export interface CreateRepoOptions {
  name: string
  description?: string
  private?: boolean
  autoInit?: boolean
}

export interface RepoInfo {
  id: number
  name: string
  fullName: string
  htmlUrl: string
  cloneUrl: string
  sshUrl: string
  private: boolean
  defaultBranch: string
}

export namespace GitHubRepo {
  /**
   * Create a new GitHub repository for the authenticated user
   */
  export async function create(options: CreateRepoOptions): Promise<RepoInfo> {
    const token = await GitHubAuth.getToken()
    if (!token) {
      throw new Error("Not authenticated with GitHub")
    }

    const octokit = new Octokit({ auth: token })

    log.info("creating repository", { name: options.name, private: options.private })

    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private ?? true,
      auto_init: options.autoInit ?? false,
    })

    const repoInfo: RepoInfo = {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      htmlUrl: data.html_url,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      private: data.private,
      defaultBranch: data.default_branch,
    }

    log.info("repository created", { fullName: repoInfo.fullName, htmlUrl: repoInfo.htmlUrl })

    return repoInfo
  }

  /**
   * Check if a repository name is available
   */
  export async function checkNameAvailable(name: string): Promise<boolean> {
    const token = await GitHubAuth.getToken()
    if (!token) {
      throw new Error("Not authenticated with GitHub")
    }

    const authInfo = await GitHubAuth.get()
    if (!authInfo?.username) {
      throw new Error("Username not available")
    }

    const octokit = new Octokit({ auth: token })

    try {
      await octokit.rest.repos.get({
        owner: authInfo.username,
        repo: name,
      })
      // If we get here, repo exists
      return false
    } catch (error: unknown) {
      if (error instanceof Error && "status" in error && (error as { status: number }).status === 404) {
        // 404 means repo doesn't exist, name is available
        return true
      }
      throw error
    }
  }

  /**
   * List repositories for the authenticated user
   */
  export async function list(options?: { sort?: "created" | "updated" | "pushed" | "full_name"; perPage?: number }): Promise<RepoInfo[]> {
    const token = await GitHubAuth.getToken()
    if (!token) {
      throw new Error("Not authenticated with GitHub")
    }

    const octokit = new Octokit({ auth: token })

    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: options?.sort ?? "updated",
      per_page: options?.perPage ?? 30,
    })

    return data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      private: repo.private,
      defaultBranch: repo.default_branch,
    }))
  }
}
