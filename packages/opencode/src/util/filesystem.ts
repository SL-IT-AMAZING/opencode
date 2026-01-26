import { realpathSync } from "fs"
import { exists } from "fs/promises"
import { dirname, join, relative } from "path"

export namespace Filesystem {
  // Windows-only path normalization cache (avoids repeated filesystem calls)
  const WIN32_PATH_CACHE_MAX = 1000
  const WIN32_PATH_CACHE_TTL_MS = 30_000 // 30 seconds
  const pathCache = new Map<string, { normalized: string; timestamp: number }>()

  function prunePathCache() {
    if (pathCache.size <= WIN32_PATH_CACHE_MAX) return
    const now = Date.now()
    // Remove expired entries first
    for (const [key, value] of pathCache) {
      if (now - value.timestamp > WIN32_PATH_CACHE_TTL_MS) {
        pathCache.delete(key)
      }
    }
    // If still too large, remove oldest entries
    if (pathCache.size > WIN32_PATH_CACHE_MAX) {
      const entries = Array.from(pathCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)
      const toRemove = entries.slice(0, pathCache.size - WIN32_PATH_CACHE_MAX + 100)
      for (const [key] of toRemove) {
        pathCache.delete(key)
      }
    }
  }

  /**
   * On Windows, normalize a path to its canonical casing using the filesystem.
   * This is needed because Windows paths are case-insensitive but LSP servers
   * may return paths with different casing than what we send them.
   * Uses a cache to avoid repeated filesystem calls.
   */
  export function normalizePath(p: string): string {
    if (process.platform !== "win32") return p

    // Check cache first
    const cached = pathCache.get(p)
    const now = Date.now()
    if (cached && now - cached.timestamp < WIN32_PATH_CACHE_TTL_MS) {
      return cached.normalized
    }

    try {
      const normalized = realpathSync.native(p)
      pathCache.set(p, { normalized, timestamp: now })
      prunePathCache()
      return normalized
    } catch {
      return p
    }
  }

  /** Clear the path normalization cache (useful for testing) */
  export function clearPathCache() {
    pathCache.clear()
  }
  export function overlaps(a: string, b: string) {
    const relA = relative(a, b)
    const relB = relative(b, a)
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..")
  }

  export function contains(parent: string, child: string) {
    return !relative(parent, child).startsWith("..")
  }

  export async function findUp(target: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      const search = join(current, target)
      if (await exists(search).catch(() => false)) result.push(search)
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  export async function* up(options: { targets: string[]; start: string; stop?: string }) {
    const { targets, start, stop } = options
    let current = start
    while (true) {
      for (const target of targets) {
        const search = join(current, target)
        if (await exists(search).catch(() => false)) yield search
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      try {
        const glob = new Bun.Glob(pattern)
        for await (const match of glob.scan({
          cwd: current,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
          dot: true,
        })) {
          result.push(match)
        }
      } catch {
        // Skip invalid glob patterns
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }
}
