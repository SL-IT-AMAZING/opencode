import { Hono } from "hono"
import { SELECTOR_SCRIPT } from "./selector-script"

/**
 * Proxy route for localhost URLs.
 * Fetches content from localhost dev servers and injects the selector script
 * into HTML responses to enable component selection.
 *
 * Usage: /proxy?url=http://localhost:3000/path
 */
export const ProxyRoute = new Hono().get("/", async (c) => {
  try {
    const targetUrl = c.req.query("url")

  if (!targetUrl) {
    return c.json({ error: "url parameter required" }, 400)
  }

  // Validate it's a localhost URL
  let url: URL
  try {
    url = new URL(targetUrl)
  } catch {
    return c.json({ error: "Invalid URL" }, 400)
  }

  if (!url.hostname.match(/^(localhost|127\.0\.0\.1|::1)$/)) {
    return c.json({ error: "Only localhost URLs allowed" }, 403)
  }

  try {
    // Fetch the remote content
    const response = await fetch(targetUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "OpenCode-Preview/1.0",
      },
    })

    if (!response.ok) {
      return c.json(
        {
          error: `Failed to fetch: ${response.status} ${response.statusText}`,
        },
        response.status as 400,
      )
    }

    const contentType = response.headers.get("content-type") || "text/plain"

    // Set CORS header
    c.header("Access-Control-Allow-Origin", "*")

    // For HTML responses, inject selector script
    if (contentType.includes("text/html")) {
      let html = await response.text()

      // Inject selector script before </head> or at start of <body> (case-insensitive)
      if (/<\/head>/i.test(html)) {
        html = html.replace(/<\/head>/i, `<script>${SELECTOR_SCRIPT}</script></head>`)
      } else if (/<body[\s>]/i.test(html)) {
        html = html.replace(/(<body[^>]*>)/i, `$1<script>${SELECTOR_SCRIPT}</script>`)
      } else {
        // Fallback: prepend script
        html = `<script>${SELECTOR_SCRIPT}</script>` + html
      }

      c.header("Content-Type", "text/html; charset=utf-8")
      return c.html(html)
    }

    // For non-HTML, pass through as-is
    c.header("Content-Type", contentType)

    // Handle different response body types
    const arrayBuffer = await response.arrayBuffer()
    return c.body(arrayBuffer)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return c.json({ error: `Failed to fetch localhost URL: ${message}` }, 502)
  }
  } catch (outerErr) {
    const message = outerErr instanceof Error ? outerErr.message : "Unknown error"
    return c.json({ error: `Proxy error: ${message}` }, 500)
  }
})
