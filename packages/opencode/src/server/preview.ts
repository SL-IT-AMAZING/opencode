import { Hono } from "hono"
import path from "node:path"
import { SELECTOR_SCRIPT } from "./selector-script"

// MIME type mapping based on file extension
const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
}

export const PreviewRoute = new Hono().get("/*", async (c) => {
  // Get workspace directory from request header/query (same pattern as main middleware)
  const workspaceRoot = c.req.query("directory") || c.req.header("x-opencode-directory") || process.cwd()

  // Extract relative path from URL and decode it
  // Note: c.req.path returns the FULL path including mount prefix (/preview)
  // so we need to strip the /preview prefix first
  const relativePath = decodeURIComponent(c.req.path.replace(/^\/preview\/?/, ""))

  // Resolve the absolute path
  const absolutePath = path.resolve(workspaceRoot, relativePath)

  // Security check: ensure path is within workspace (normalize both paths for comparison)
  const normalizedWorkspace = path.normalize(workspaceRoot)
  const normalizedAbsolute = path.normalize(absolutePath)
  if (!normalizedAbsolute.startsWith(normalizedWorkspace)) {
    return c.json({ error: "Access denied" }, 403)
  }

  // Check if file exists
  const file = Bun.file(absolutePath)
  const exists = await file.exists()
  if (!exists) {
    return c.json({ error: "File not found", path: relativePath }, 404)
  }

  // Get content type based on extension
  const ext = path.extname(absolutePath).toLowerCase()
  const contentType = mimeTypes[ext] || "application/octet-stream"

  // Set CORS header
  c.header("Access-Control-Allow-Origin", "*")

  // For HTML files, inject selector script
  if (ext === ".html" || ext === ".htm") {
    let html = await file.text()
    // Inject selector script before </head> or at start of <body>
    if (html.includes("</head>")) {
      html = html.replace("</head>", `<script>${SELECTOR_SCRIPT}</script></head>`)
    } else if (html.includes("<body")) {
      html = html.replace(/<body([^>]*)>/, `<body$1><script>${SELECTOR_SCRIPT}</script>`)
    } else {
      // Fallback: prepend script
      html = `<script>${SELECTOR_SCRIPT}</script>` + html
    }
    c.header("Content-Type", "text/html; charset=utf-8")
    return c.html(html)
  }

  // For other files, stream the content
  c.header("Content-Type", contentType)
  return c.body(file.stream())
})
