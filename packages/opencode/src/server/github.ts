import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { GitHubAuth, GITHUB_OAUTH_CALLBACK_PATH } from "../github/auth"
import { GitHubRepo } from "../github/repo"
import { Log } from "../util/log"

const log = Log.create({ service: "server.github" })

const HTML_SUCCESS = `<!DOCTYPE html>
<html>
<head>
  <title>OpenCode - GitHub 연결 완료</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #4ade80; margin-bottom: 1rem; }
    p { color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>GitHub 연결 완료!</h1>
    <p>이 창을 닫고 앱으로 돌아가세요.</p>
  </div>
  <script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>`

const HTML_ERROR = (error: string) => `<!DOCTYPE html>
<html>
<head>
  <title>OpenCode - GitHub 연결 실패</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #f87171; margin-bottom: 1rem; }
    p { color: #aaa; }
    .error { color: #fca5a5; font-family: monospace; margin-top: 1rem; padding: 1rem; background: rgba(248,113,113,0.1); border-radius: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>GitHub 연결 실패</h1>
    <p>인증 중 오류가 발생했습니다.</p>
    <div class="error">${error}</div>
  </div>
</body>
</html>`

export const GitHubRoute = new Hono()
  // Start OAuth flow - returns authorization URL
  .get(
    "/auth/start",
    describeRoute({
      summary: "Start GitHub OAuth",
      description: "Get the GitHub OAuth authorization URL to start the authentication flow.",
      operationId: "github.auth.start",
      responses: {
        200: {
          description: "Authorization URL",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  url: z.string().describe("GitHub authorization URL to open in browser"),
                  state: z.string().describe("State parameter for CSRF protection"),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const { url, state } = GitHubAuth.getAuthorizationUrl()
      log.info("oauth start", { state })
      return c.json({ url, state })
    },
  )

  // OAuth callback - browser redirects here after GitHub auth
  .get(
    "/oauth/callback",
    async (c) => {
      const code = c.req.query("code")
      const state = c.req.query("state")
      const error = c.req.query("error")
      const errorDescription = c.req.query("error_description")

      log.info("oauth callback", { hasCode: !!code, state, error })

      if (error) {
        const errorMsg = errorDescription || error
        GitHubAuth.rejectCallback(new Error(errorMsg))
        return c.html(HTML_ERROR(errorMsg))
      }

      if (!code) {
        return c.html(HTML_ERROR("No authorization code provided"), 400)
      }

      if (!state || !GitHubAuth.validateState(state)) {
        return c.html(HTML_ERROR("Invalid state parameter - potential CSRF attack"), 400)
      }

      try {
        // Exchange code for token
        await GitHubAuth.exchangeCode(code)
        GitHubAuth.resolveCallback(code)
        return c.html(HTML_SUCCESS)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        GitHubAuth.rejectCallback(new Error(errorMsg))
        return c.html(HTML_ERROR(errorMsg))
      }
    },
  )

  // Check auth status
  .get(
    "/auth/status",
    describeRoute({
      summary: "Check GitHub auth status",
      description: "Check if the user is authenticated with GitHub.",
      operationId: "github.auth.status",
      responses: {
        200: {
          description: "Authentication status",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  authenticated: z.boolean(),
                  username: z.string().optional(),
                  email: z.string().optional(),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const info = await GitHubAuth.get()
      if (!info) {
        return c.json({ authenticated: false })
      }

      // Verify token is still valid
      const isValid = await GitHubAuth.isAuthenticated()
      if (!isValid) {
        await GitHubAuth.remove()
        return c.json({ authenticated: false })
      }

      return c.json({
        authenticated: true,
        username: info.username,
        email: info.email,
      })
    },
  )

  // Logout - remove stored token
  .post(
    "/auth/logout",
    describeRoute({
      summary: "Logout from GitHub",
      description: "Remove the stored GitHub OAuth token.",
      operationId: "github.auth.logout",
      responses: {
        200: {
          description: "Logout successful",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
      },
    }),
    async (c) => {
      await GitHubAuth.remove()
      return c.json({ success: true })
    },
  )

  // Create repository
  .post(
    "/repo/create",
    describeRoute({
      summary: "Create GitHub repository",
      description: "Create a new GitHub repository for the authenticated user.",
      operationId: "github.repo.create",
      responses: {
        200: {
          description: "Repository created",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  id: z.number(),
                  name: z.string(),
                  fullName: z.string(),
                  htmlUrl: z.string(),
                  cloneUrl: z.string(),
                  sshUrl: z.string(),
                  private: z.boolean(),
                  defaultBranch: z.string(),
                }),
              ),
            },
          },
        },
        401: {
          description: "Not authenticated",
        },
        422: {
          description: "Repository name already exists",
        },
      },
    }),
    validator(
      "json",
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        private: z.boolean().optional().default(true),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json")

      const isAuth = await GitHubAuth.isAuthenticated()
      if (!isAuth) {
        return c.json({ error: "Not authenticated with GitHub" }, 401)
      }

      const repo = await GitHubRepo.create({
        name: body.name,
        description: body.description,
        private: body.private,
      })

      return c.json(repo)
    },
  )

  // Check if repo name is available
  .get(
    "/repo/check-name",
    describeRoute({
      summary: "Check repository name availability",
      description: "Check if a repository name is available for the authenticated user.",
      operationId: "github.repo.checkName",
      responses: {
        200: {
          description: "Name availability",
          content: {
            "application/json": {
              schema: resolver(z.object({ available: z.boolean() })),
            },
          },
        },
      },
    }),
    validator("query", z.object({ name: z.string() })),
    async (c) => {
      const { name } = c.req.valid("query")

      const isAuth = await GitHubAuth.isAuthenticated()
      if (!isAuth) {
        return c.json({ error: "Not authenticated with GitHub" }, 401)
      }

      const available = await GitHubRepo.checkNameAvailable(name)
      return c.json({ available })
    },
  )
