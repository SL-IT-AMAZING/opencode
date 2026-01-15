import { Hono } from "hono"
import { SELECTOR_SCRIPT } from "./selector-script"

/**
 * Check if a URL path looks like a JavaScript file (for Vite special routes)
 */
const isJavaScriptUrl = (urlPath: string): boolean => {
  return (
    urlPath.startsWith("/@") || // /@vite/, /@react-refresh, /@fs/, etc.
    urlPath.includes("/node_modules/.vite/") ||
    urlPath.includes("/node_modules/") ||
    urlPath.endsWith(".js") ||
    urlPath.endsWith(".jsx") ||
    urlPath.endsWith(".ts") ||
    urlPath.endsWith(".tsx") ||
    urlPath.endsWith(".mjs") ||
    urlPath.endsWith(".mts")
  )
}

/**
 * Check if content looks like JavaScript (fallback detection)
 */
const looksLikeJavaScript = (content: string): boolean => {
  const trimmed = content.trimStart()
  return (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("import{") ||
    trimmed.startsWith("import.") ||
    trimmed.startsWith("export ") ||
    trimmed.startsWith("export{") ||
    trimmed.startsWith("const ") ||
    trimmed.startsWith("let ") ||
    trimmed.startsWith("var ") ||
    trimmed.startsWith("function ") ||
    trimmed.startsWith("function(") ||
    trimmed.startsWith("class ") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("(function") ||
    trimmed.startsWith("!function")
  )
}

/**
 * Proxy route for localhost URLs.
 * Fetches content from localhost dev servers and rewrites URLs to route
 * all sub-resources through the proxy. Injects the selector script
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
          Accept: "*/*",
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

      const contentType = response.headers.get("content-type") || ""

      // Use response.url for base (handles redirects)
      const finalUrl = response.url || targetUrl
      const baseUrl = new URL("./", finalUrl).href
      const urlPath = new URL(finalUrl).pathname

      // Helper to rewrite URLs to go through proxy
      const rewriteUrl = (originalUrl: string): string => {
        const trimmed = originalUrl.trim()

        // Skip special URLs
        if (/^(data:|blob:|#|javascript:|mailto:|tel:)/i.test(trimmed)) {
          return originalUrl
        }

        // Skip already-proxied URLs
        if (trimmed.includes("/proxy?url=")) {
          return originalUrl
        }

        try {
          // Handle protocol-relative URLs
          const urlToResolve = trimmed.startsWith("//")
            ? `${url.protocol}${trimmed}`
            : trimmed

          const absoluteUrl = new URL(urlToResolve, baseUrl).href

          // Only proxy localhost URLs
          if (
            /^https?:\/\/(localhost|127\.0\.0\.1|::1)(:|\/|$)/.test(absoluteUrl)
          ) {
            return `/proxy?url=${encodeURIComponent(absoluteUrl)}`
          }
        } catch {
          // Invalid URL, return as-is
        }
        return originalUrl
      }

      // Process HTML responses
      if (contentType.includes("text/html")) {
        let html = await response.text()

        // Rewrite src attributes (script, img, iframe, source, video, audio, embed)
        html = html.replace(
          /(<(?:script|img|iframe|source|video|audio|embed)[^>]*?\s)src\s*=\s*(["'])([^"']*)\2/gi,
          (_, prefix, quote, srcUrl) =>
            `${prefix}src=${quote}${rewriteUrl(srcUrl)}${quote}`,
        )

        // Rewrite href in stylesheet/preload link tags only
        html = html.replace(
          /(<link[^>]*?rel\s*=\s*["'](?:stylesheet|preload)["'][^>]*?\s)href\s*=\s*(["'])([^"']*)\2/gi,
          (_, prefix, quote, hrefUrl) =>
            `${prefix}href=${quote}${rewriteUrl(hrefUrl)}${quote}`,
        )
        html = html.replace(
          /(<link[^>]*?\s)href\s*=\s*(["'])([^"']*)\2([^>]*?rel\s*=\s*["'](?:stylesheet|preload)["'])/gi,
          (_, prefix, quote, hrefUrl, suffix) =>
            `${prefix}href=${quote}${rewriteUrl(hrefUrl)}${quote}${suffix}`,
        )

        // Rewrite poster attribute (video)
        html = html.replace(
          /(<video[^>]*?\s)poster\s*=\s*(["'])([^"']*)\2/gi,
          (_, prefix, quote, posterUrl) =>
            `${prefix}poster=${quote}${rewriteUrl(posterUrl)}${quote}`,
        )

        // Rewrite srcset attributes
        html = html.replace(
          /srcset\s*=\s*(["'])([^"']*)\1/gi,
          (_, quote, srcset) => {
            const rewritten = srcset
              .split(",")
              .map((entry: string) => {
                const parts = entry.trim().split(/\s+/)
                if (parts[0]) parts[0] = rewriteUrl(parts[0])
                return parts.join(" ")
              })
              .join(", ")
            return `srcset=${quote}${rewritten}${quote}`
          },
        )

        // Rewrite imports in inline scripts (for Vite's injected preamble)
        html = html.replace(
          /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
          (match, attrs, scriptContent) => {
            // Skip if it's an external script (has src attribute)
            if (/\bsrc\s*=/i.test(attrs)) {
              return match
            }

            // Skip empty scripts
            if (!scriptContent.trim()) {
              return match
            }

            // Rewrite import statements in inline script content
            // Match FULL import/export syntax to avoid matching strings like ["from","./path"]
            let rewritten = scriptContent

            // 1. Named/default imports: import x from "url", import { x } from "url"
            rewritten = rewritten.replace(
              /\b(import\s+[\w$_*{},\s]+\s+from\s*)(["'])([^"']+)\2/g,
              (_: string, prefix: string, quote: string, importUrl: string) =>
                `${prefix}${quote}${rewriteUrl(importUrl)}${quote}`,
            )

            // 2. Side-effect imports at line start: import "url"
            rewritten = rewritten.replace(
              /^(\s*import\s*)(["'])([^"']+)\2/gm,
              (_: string, prefix: string, quote: string, importUrl: string) =>
                `${prefix}${quote}${rewriteUrl(importUrl)}${quote}`,
            )

            // 3. Re-exports: export { x } from "url", export * from "url"
            rewritten = rewritten.replace(
              /\b(export\s+[\w$_*{},\s]+\s+from\s*)(["'])([^"']+)\2/g,
              (_: string, prefix: string, quote: string, importUrl: string) =>
                `${prefix}${quote}${rewriteUrl(importUrl)}${quote}`,
            )

            // 4. Dynamic imports: import("url")
            rewritten = rewritten.replace(
              /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g,
              (_: string, quote: string, importUrl: string) =>
                `import(${quote}${rewriteUrl(importUrl)}${quote})`,
            )

            return `<script${attrs}>${rewritten}</script>`
          },
        )

        // Inject selector script before </head>
        const scriptTag = `<script>${SELECTOR_SCRIPT}</script>`
        if (/<\/head>/i.test(html)) {
          html = html.replace(/<\/head>/i, `${scriptTag}</head>`)
        } else if (/<body[\s>]/i.test(html)) {
          html = html.replace(/(<body[^>]*>)/i, `$1${scriptTag}`)
        } else {
          html = `${scriptTag}${html}`
        }

        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }

      // Determine if this is JavaScript by content-type header, URL pattern, or content inspection
      const isJsByContentType =
        contentType.includes("javascript") ||
        contentType.includes("ecmascript")
      const isJsByUrl = isJavaScriptUrl(urlPath)

      // For text content that might be JS, we need to read it first
      if (
        isJsByContentType ||
        isJsByUrl ||
        contentType.includes("text/plain") ||
        contentType === ""
      ) {
        const text = await response.text()

        // Check if it's JavaScript (by header, URL, or content)
        if (isJsByContentType || isJsByUrl || looksLikeJavaScript(text)) {
          // Rewrite import statements
          let js = text

          // Rewrite import statements
          // Match FULL import/export syntax to avoid matching strings like ["from","./path"]

          // 1. Named/default imports: import x from "url", import { x } from "url"
          js = js.replace(
            /\b(import\s+[\w$_*{},\s]+\s+from\s*)(["'])([^"']+)\2/g,
            (_, prefix, quote, importUrl) =>
              `${prefix}${quote}${rewriteUrl(importUrl)}${quote}`,
          )

          // 2. Side-effect imports at line start: import "url"
          js = js.replace(
            /^(\s*import\s*)(["'])([^"']+)\2/gm,
            (_, prefix, quote, importUrl) =>
              `${prefix}${quote}${rewriteUrl(importUrl)}${quote}`,
          )

          // 3. Re-exports: export { x } from "url", export * from "url"
          js = js.replace(
            /\b(export\s+[\w$_*{},\s]+\s+from\s*)(["'])([^"']+)\2/g,
            (_, prefix, quote, importUrl) =>
              `${prefix}${quote}${rewriteUrl(importUrl)}${quote}`,
          )

          // 4. Dynamic imports: import("url")
          js = js.replace(
            /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g,
            (_, quote, importUrl) =>
              `import(${quote}${rewriteUrl(importUrl)}${quote})`,
          )

          // FORCE correct MIME type for JavaScript
          // Note: Must use Response directly because c.header() + c.text() doesn't work in Hono
          return new Response(js, {
            headers: {
              "Content-Type": "application/javascript; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          })
        }

        // Not JavaScript, return as text with original content type
        return new Response(text, {
          headers: {
            "Content-Type": contentType || "text/plain",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }

      // Process CSS - rewrite url() references
      if (contentType.includes("text/css")) {
        let css = await response.text()

        css = css.replace(
          /url\s*\(\s*(["']?)([^"')]+)\1\s*\)/gi,
          (_, quote, cssUrl) => `url(${quote}${rewriteUrl(cssUrl)}${quote})`,
        )

        return new Response(css, {
          headers: {
            "Content-Type": "text/css; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }

      // Pass through other content types (images, fonts, etc.)
      const arrayBuffer = await response.arrayBuffer()
      return new Response(arrayBuffer, {
        headers: {
          "Content-Type": contentType || "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      return c.json({ error: `Failed to fetch localhost URL: ${message}` }, 502)
    }
  } catch (outerErr) {
    const message =
      outerErr instanceof Error ? outerErr.message : "Unknown error"
    return c.json({ error: `Proxy error: ${message}` }, 500)
  }
})
