import { Hono } from "hono"
import path from "node:path"

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

  // Set CORS and Content-Type headers
  c.header("Access-Control-Allow-Origin", "*")
  c.header("Content-Type", contentType)

  // Stream the file content
  return c.body(file.stream())
})
