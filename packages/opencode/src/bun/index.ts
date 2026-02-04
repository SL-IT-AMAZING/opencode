import z from "zod"
import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import { NamedError } from "@anyon/util/error"
import { readableStreamToText } from "bun"
import { createRequire } from "module"
import { Lock } from "../util/lock"

export namespace BunProc {
  const log = Log.create({ service: "bun" })
  const req = createRequire(import.meta.url)

  // Cache for GitHub SHA checks to avoid repeated API calls in same session
  const gitHubShaCache = new Map<string, { sha: string; checkedAt: number }>()

  async function getGitHubLatestCommit(repoPath: string): Promise<string | null> {
    const cached = gitHubShaCache.get(repoPath)
    const now = Date.now()
    // Use cached value if less than 5 minutes old
    if (cached && now - cached.checkedAt < 5 * 60 * 1000) {
      return cached.sha
    }

    const [owner, repo] = repoPath.split("/")
    if (!owner || !repo) return null

    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
        headers: { Accept: "application/vnd.github.v3+json" },
      })
      if (!res.ok) return null
      const commits = (await res.json()) as Array<{ sha: string }>
      const sha = commits[0]?.sha?.substring(0, 7) ?? null
      if (sha) {
        gitHubShaCache.set(repoPath, { sha, checkedAt: now })
      }
      return sha
    } catch {
      return null
    }
  }

  export async function run(cmd: string[], options?: Bun.SpawnOptions.OptionsObject<any, any, any>) {
    log.info("running", {
      cmd: [which(), ...cmd],
      ...options,
    })
    const result = Bun.spawn([which(), ...cmd], {
      ...options,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        ...options?.env,
        BUN_BE_BUN: "1",
      },
    })
    const code = await result.exited
    const stdout = result.stdout
      ? typeof result.stdout === "number"
        ? result.stdout
        : await readableStreamToText(result.stdout)
      : undefined
    const stderr = result.stderr
      ? typeof result.stderr === "number"
        ? result.stderr
        : await readableStreamToText(result.stderr)
      : undefined
    log.info("done", {
      code,
      stdout,
      stderr,
    })
    if (code !== 0) {
      throw new Error(`Command failed with exit code ${result.exitCode}`)
    }
    return result
  }

  export function which() {
    return process.execPath
  }

  export const InstallFailedError = NamedError.create(
    "BunInstallFailedError",
    z.object({
      pkg: z.string(),
      version: z.string(),
    }),
  )

  export async function install(pkg: string, version = "latest", installSpec?: string) {
    // Use lock to ensure only one install at a time
    using _ = await Lock.write("bun-install")

    const mod = path.join(Global.Path.cache, "node_modules", pkg)
    const pkgjson = Bun.file(path.join(Global.Path.cache, "package.json"))
    const parsed = await pkgjson.json().catch(async () => {
      const result = { dependencies: {} }
      await Bun.write(pkgjson.name!, JSON.stringify(result, null, 2))
      return result
    })
    const dependencies = parsed.dependencies ?? {}
    if (!parsed.dependencies) parsed.dependencies = dependencies
    const modExists = await Bun.file(path.join(mod, "package.json")).exists()

    // For GitHub deps, check if remote has newer commits
    if (version.startsWith("github:")) {
      const repoPath = version.replace("github:", "")
      const cachedDep = dependencies[pkg]
      const cachedSha = typeof cachedDep === "object" ? cachedDep?.sha : undefined
      const latestSha = await getGitHubLatestCommit(repoPath)

      if (latestSha && cachedSha === latestSha && modExists) {
        log.info("github package up to date", { pkg, sha: cachedSha })
        return mod
      }
      log.info("github package needs update", { pkg, cachedSha, latestSha })
      // Continue to install...
    } else {
      // NPM packages: use existing version check
      if (dependencies[pkg] === version && modExists) return mod
    }

    const proxied = !!(
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.http_proxy ||
      process.env.https_proxy
    )

    // Flatten any object-valued dependencies to strings before running bun add
    // (bun's package.json parser only accepts string dependency specifiers)
    const savedObjects: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(dependencies)) {
      if (typeof v === "object" && v !== null) {
        savedObjects[k] = v
        dependencies[k] = (v as { version?: string }).version ?? "latest"
      }
    }
    await Bun.write(pkgjson.name!, JSON.stringify(parsed, null, 2))

    // Build command arguments
    const args = [
      "add",
      "--force",
      "--exact",
      // TODO: get rid of this case (see: https://github.com/oven-sh/bun/issues/19936)
      ...(proxied ? ["--no-cache"] : []),
      "--cwd",
      Global.Path.cache,
      installSpec ?? (pkg + "@" + version),
    ]

    // Let Bun handle registry resolution:
    // - If .npmrc files exist, Bun will use them automatically
    // - If no .npmrc files exist, Bun will default to https://registry.npmjs.org
    // - No need to pass --registry flag
    log.info("installing package using Bun's default registry resolution", {
      pkg,
      version,
    })

    await BunProc.run(args, {
      cwd: Global.Path.cache,
    }).catch(async (e) => {
      // Restore object deps before throwing
      for (const [k, v] of Object.entries(savedObjects)) {
        dependencies[k] = v
      }
      await Bun.write(pkgjson.name!, JSON.stringify(parsed, null, 2))
      throw new InstallFailedError(
        { pkg, version },
        {
          cause: e,
        },
      )
    })

    // For GitHub packages, build if dist/ is missing (source-only install)
    if (version.startsWith("github:")) {
      const distExists = await Bun.file(path.join(mod, "dist", "index.js")).exists()
      if (!distExists) {
        log.info("building github package (no dist/ found)", { pkg, mod })
        await BunProc.run(
          ["build", "src/index.ts", "--outdir", "dist", "--target", "bun", "--format", "esm", "--external", "@ast-grep/napi"],
          { cwd: mod },
        ).catch((e) => {
          log.error("failed to build github package", {
            pkg,
            error: e instanceof Error ? e.message : String(e),
          })
        })
      }
    }

    // Restore saved GitHub tracking objects for other packages
    for (const [k, v] of Object.entries(savedObjects)) {
      if (k !== pkg) dependencies[k] = v
    }

    // For GitHub packages, store the commit SHA for future version checks
    if (version.startsWith("github:")) {
      const repoPath = version.replace("github:", "")
      const sha = await getGitHubLatestCommit(repoPath)
      parsed.dependencies[pkg] = { version, sha }
      log.info("stored github package version", { pkg, version, sha })
    } else {
      // Resolve actual version from installed package when using "latest"
      // This ensures subsequent starts use the cached version until explicitly updated
      let resolvedVersion = version
      if (version === "latest") {
        const installedPkgJson = Bun.file(path.join(mod, "package.json"))
        const installedPkg = await installedPkgJson.json().catch(() => null)
        if (installedPkg?.version) {
          resolvedVersion = installedPkg.version
        }
      }
      parsed.dependencies[pkg] = resolvedVersion
    }

    await Bun.write(pkgjson.name!, JSON.stringify(parsed, null, 2))
    return mod
  }
}
