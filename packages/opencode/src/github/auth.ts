import path from "path"
import { Global } from "../global"
import { Log } from "../util/log"
import fs from "fs/promises"
import z from "zod"

const log = Log.create({ service: "github.auth" })

// GitHub OAuth App credentials
// These should be set via environment variables or fetched from a config server
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "Ov23liEaf4E1crqXHc8l"
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "bad6da9af89f199c5598d0a15760d11931f313cd"

export const GITHUB_OAUTH_CALLBACK_PORT = 19876
export const GITHUB_OAUTH_CALLBACK_PATH = "/github/oauth/callback"
export const GITHUB_OAUTH_REDIRECT_URI = `http://127.0.0.1:${GITHUB_OAUTH_CALLBACK_PORT}${GITHUB_OAUTH_CALLBACK_PATH}`

// GitHub OAuth scopes for repo creation
const GITHUB_SCOPES = ["repo", "user:email"]

export namespace GitHubAuth {
  // Schema for stored GitHub auth
  export const Info = z.object({
    type: z.literal("github-oauth"),
    accessToken: z.string(),
    tokenType: z.string(),
    scope: z.string(),
    // User info
    username: z.string().optional(),
    email: z.string().optional(),
  })
  export type Info = z.infer<typeof Info>

  const filepath = path.join(Global.Path.data, "github-auth.json")

  // Pending auth state for CSRF protection
  let pendingState: string | null = null
  let pendingResolve: ((code: string) => void) | null = null
  let pendingReject: ((error: Error) => void) | null = null
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Generate the GitHub OAuth authorization URL
   */
  export function getAuthorizationUrl(): { url: string; state: string } {
    const state = crypto.randomUUID()
    pendingState = state

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: GITHUB_OAUTH_REDIRECT_URI,
      scope: GITHUB_SCOPES.join(" "),
      state,
    })

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`
    log.info("generated authorization url", { state })
    return { url, state }
  }

  /**
   * Exchange authorization code for access token
   */
  export async function exchangeCode(code: string): Promise<Info> {
    log.info("exchanging code for token", {
      clientId: GITHUB_CLIENT_ID.slice(0, 8) + "...",
      redirectUri: GITHUB_OAUTH_REDIRECT_URI,
    })

    let response: Response
    try {
      response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_OAUTH_REDIRECT_URI,
        }),
      })
    } catch (err) {
      log.error("fetch to GitHub failed", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
      throw new Error(`GitHub API 연결 실패: ${err instanceof Error ? err.message : "Unknown error"}`)
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      log.error("GitHub API error response", { status: response.status, body: text })
      throw new Error(`GitHub API 오류: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      log.error("GitHub OAuth error", { error: data.error, description: data.error_description })
      throw new Error(data.error_description || data.error)
    }

    const info: Info = {
      type: "github-oauth",
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
    }

    // Fetch user info
    const userInfo = await fetchUserInfo(info.accessToken)
    info.username = userInfo.login
    info.email = userInfo.email ?? undefined

    // Save the token
    await save(info)

    log.info("token exchange successful", { username: info.username })
    return info
  }

  /**
   * Fetch authenticated user info from GitHub
   */
  async function fetchUserInfo(token: string): Promise<{ login: string; email: string | null }> {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`)
    }

    const data = await response.json()
    return { login: data.login, email: data.email }
  }

  /**
   * Get stored GitHub auth info
   */
  export async function get(): Promise<Info | null> {
    const file = Bun.file(filepath)
    const exists = await file.exists()
    if (!exists) return null

    const data = await file.json().catch(() => null)
    const parsed = Info.safeParse(data)
    if (!parsed.success) return null

    return parsed.data
  }

  /**
   * Save GitHub auth info
   */
  export async function save(info: Info): Promise<void> {
    const file = Bun.file(filepath)
    await Bun.write(file, JSON.stringify(info, null, 2))
    await fs.chmod(filepath, 0o600)
    log.info("saved github auth")
  }

  /**
   * Remove stored GitHub auth
   */
  export async function remove(): Promise<void> {
    const file = Bun.file(filepath)
    const exists = await file.exists()
    if (exists) {
      await fs.unlink(filepath)
      log.info("removed github auth")
    }
  }

  /**
   * Check if user is authenticated
   */
  export async function isAuthenticated(): Promise<boolean> {
    const info = await get()
    if (!info) return false

    // Verify token is still valid
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${info.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }).catch(() => null)

    return response?.ok ?? false
  }

  /**
   * Get access token if authenticated
   */
  export async function getToken(): Promise<string | null> {
    const info = await get()
    return info?.accessToken ?? null
  }

  /**
   * Validate state parameter from callback
   */
  export function validateState(state: string): boolean {
    return state === pendingState
  }

  /**
   * Clear pending state
   */
  export function clearPendingState(): void {
    pendingState = null
    if (pendingTimeout) {
      clearTimeout(pendingTimeout)
      pendingTimeout = null
    }
    pendingResolve = null
    pendingReject = null
  }

  /**
   * Wait for OAuth callback
   */
  export function waitForCallback(state: string): Promise<string> {
    return new Promise((resolve, reject) => {
      pendingState = state
      pendingResolve = resolve
      pendingReject = reject

      // 5 minute timeout
      pendingTimeout = setTimeout(
        () => {
          clearPendingState()
          reject(new Error("OAuth callback timeout"))
        },
        5 * 60 * 1000,
      )
    })
  }

  /**
   * Resolve pending callback with code
   */
  export function resolveCallback(code: string): void {
    if (pendingResolve) {
      pendingResolve(code)
      clearPendingState()
    }
  }

  /**
   * Reject pending callback with error
   */
  export function rejectCallback(error: Error): void {
    if (pendingReject) {
      pendingReject(error)
      clearPendingState()
    }
  }
}
