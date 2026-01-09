import { Hono } from "hono"
import { GitHubAuth } from "../github/auth"
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
  .get("/auth/start", async (c) => {
    try {
      const { url, state } = GitHubAuth.getAuthorizationUrl()
      log.info("oauth start", { state })
      return c.json({ url, state })
    } catch (err) {
      log.error("auth start error", { error: String(err) })
      return c.json({ error: String(err) }, 500)
    }
  })

  // OAuth callback - browser redirects here after GitHub auth
  .get("/oauth/callback", async (c) => {
    try {
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

      // Exchange code for token
      await GitHubAuth.exchangeCode(code)
      GitHubAuth.resolveCallback(code)
      return c.html(HTML_SUCCESS)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      log.error("oauth callback error", { error: errorMsg })
      GitHubAuth.rejectCallback(new Error(errorMsg))
      return c.html(HTML_ERROR(errorMsg))
    }
  })

  // Check auth status
  .get("/auth/status", async (c) => {
    try {
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
    } catch (err) {
      log.error("auth status error", { error: String(err) })
      return c.json({ authenticated: false, error: String(err) })
    }
  })

  // Logout - remove stored token
  .post("/auth/logout", async (c) => {
    try {
      await GitHubAuth.remove()
      return c.json({ success: true })
    } catch (err) {
      log.error("auth logout error", { error: String(err) })
      return c.json({ error: String(err) }, 500)
    }
  })

  // Create repository
  .post("/repo/create", async (c) => {
    try {
      const body = await c.req.json()

      const isAuth = await GitHubAuth.isAuthenticated()
      if (!isAuth) {
        return c.json({ error: "Not authenticated with GitHub" }, 401)
      }

      const repo = await GitHubRepo.create({
        name: body.name,
        description: body.description,
        private: body.private ?? true,
      })

      return c.json(repo)
    } catch (err) {
      log.error("repo create error", { error: String(err) })
      return c.json({ error: String(err) }, 500)
    }
  })

  // Check if repo name is available
  .get("/repo/check-name", async (c) => {
    try {
      const name = c.req.query("name")
      if (!name) {
        return c.json({ error: "Name parameter required" }, 400)
      }

      const isAuth = await GitHubAuth.isAuthenticated()
      if (!isAuth) {
        return c.json({ error: "Not authenticated with GitHub" }, 401)
      }

      const available = await GitHubRepo.checkNameAvailable(name)
      return c.json({ available })
    } catch (err) {
      log.error("check name error", { error: String(err) })
      return c.json({ error: String(err) }, 500)
    }
  })
