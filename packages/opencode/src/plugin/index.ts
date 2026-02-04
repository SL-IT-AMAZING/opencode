import type { Hooks, PluginInput, Plugin as PluginInstance } from "@anyon/plugin"
import { Config } from "../config/config"
import { Bus } from "../bus"
import { Log } from "../util/log"
import { createOpencodeClient } from "@anyon/sdk"
import { Server } from "../server/server"
import { BunProc } from "../bun"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { Session } from "../session"
import { NamedError } from "@anyon/util/error"
import { Global } from "../global"
import path from "path"

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  /**
   * Seed oh-my-opencode's provider-models cache from OpenCode's models.json
   * This must happen BEFORE plugins load to ensure model resolution works
   */
  async function seedOmoProviderModelsCache() {
    const omoCacheDir = path.join(Global.Path.cache, "..", "oh-my-opencode")
    const omoCache = path.join(omoCacheDir, "provider-models.json")
    const opencodeModels = path.join(Global.Path.cache, "models.json")

    // Check if oh-my-opencode cache already has models
    const existing = await Bun.file(omoCache).json().catch(() => null)
    if (existing?.models && Object.keys(existing.models).length > 0) {
      log.info("oh-my-opencode provider-models cache already populated", { count: Object.keys(existing.models).length })
      return
    }

    // Read OpenCode's models.json
    const modelsData = await Bun.file(opencodeModels).json().catch(() => null)
    if (!modelsData) {
      log.info("OpenCode models.json not found, skipping cache seed")
      return
    }

    // Build provider -> model[] map
    const models: Record<string, string[]> = {}
    for (const [providerId, provider] of Object.entries(modelsData)) {
      const providerObj = provider as { models?: Record<string, unknown> }
      if (providerObj?.models && typeof providerObj.models === "object") {
        models[providerId] = Object.keys(providerObj.models)
      }
    }

    // Get connected providers from existing cache if available
    const connectedCache = await Bun.file(path.join(omoCacheDir, "connected-providers.json")).json().catch(() => null)
    const connected = connectedCache?.connected ?? []

    // Ensure directory exists
    await Bun.$`mkdir -p ${omoCacheDir}`.quiet()

    // Write to oh-my-opencode cache
    await Bun.write(omoCache, JSON.stringify({ models, connected, updatedAt: new Date().toISOString() }, null, 2))
    log.info("seeded oh-my-opencode provider-models cache", { providers: Object.keys(models).length, totalModels: Object.values(models).flat().length })
  }

  const BUILTIN = ["opencode-copilot-auth@0.0.9", "opencode-anthropic-auth@0.0.9", "oh-my-opencode@github:SL-IT-AMAZING/oh-my-opencode-anyon"]

  const state = Instance.state(async () => {
    // Seed oh-my-opencode's provider-models cache BEFORE loading plugins
    // This ensures model resolution works during plugin initialization
    await seedOmoProviderModelsCache()

    const client = createOpencodeClient({
      baseUrl: "http://localhost:4096",
      // @ts-ignore - fetch type incompatibility
      fetch: async (...args) => Server.App().fetch(...args),
    })
    const config = await Config.get()
    const hooks = []
    const input: PluginInput = {
      client,
      project: Instance.project,
      worktree: Instance.worktree,
      directory: Instance.directory,
      serverUrl: Server.url(),
      $: Bun.$,
    }
    const plugins = [...(config.plugin ?? [])]
    if (!Flag.ANYON_DISABLE_DEFAULT_PLUGINS) {
      plugins.push(...BUILTIN)
    }
    for (let plugin of plugins) {
      log.info("loading plugin", { path: plugin })
      if (!plugin.startsWith("file://")) {
        let pkg: string
        let version: string
        let installSpec: string

        const githubMatch = plugin.match(/^(.+)@(github:.+)$/)
        if (githubMatch) {
          pkg = githubMatch[1]
          version = githubMatch[2]
          installSpec = githubMatch[2]
        } else {
          const lastAtIndex = plugin.lastIndexOf("@")
          pkg = lastAtIndex > 0 ? plugin.substring(0, lastAtIndex) : plugin
          version = lastAtIndex > 0 ? plugin.substring(lastAtIndex + 1) : "latest"
          installSpec = pkg + "@" + version
        }

        const builtin = BUILTIN.some((x) => x.startsWith(pkg + "@"))
        plugin = await BunProc.install(pkg, version, installSpec).catch((err) => {
          if (!builtin) throw err

          const message = err instanceof Error ? err.message : String(err)
          log.error("failed to install builtin plugin", {
            pkg,
            version,
            error: message,
          })
          Bus.publish(Session.Event.Error, {
            error: new NamedError.Unknown({
              message: `Failed to install built-in plugin ${pkg}@${version}: ${message}`,
            }).toObject(),
          })

          return ""
        })
        if (!plugin) continue
      }
      const mod = await import(plugin)
      const seen = new Set<PluginInstance>()
      for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
        if (seen.has(fn)) continue
        seen.add(fn)
        const init = await fn(input)
        hooks.push(init)
      }
    }

    return {
      hooks,
      input,
    }
  })

  export async function trigger<
    Name extends Exclude<keyof Required<Hooks>, "auth" | "event" | "tool">,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    if (!name) return output
    for (const hook of await state().then((x) => x.hooks)) {
      const fn = hook[name]
      if (!fn) continue
      // @ts-expect-error
      await fn(input, output)
    }
    return output
  }

  export async function list() {
    return state().then((x) => x.hooks)
  }

  export async function init() {
    const hooks = await state().then((x) => x.hooks)
    const config = await Config.get()
    log.info("Plugin.init: config.agent BEFORE hooks", { agents: Object.keys(config.agent ?? {}).slice(0, 10) })
    for (const hook of hooks) {
      // @ts-expect-error
      await hook.config?.(config)
    }
    const allAgents = Object.keys(config.agent ?? {})
    const anyonAgents = allAgents.filter(a => a.includes("anyon"))
    log.info("Plugin.init: config.agent AFTER hooks", {
      totalAgents: allAgents.length,
      anyonAgents,
      hasAnyon: !!config.agent?.["anyon-alpha"]
    })
    Bus.subscribeAll(async (input) => {
      const hooks = await state().then((x) => x.hooks)
      for (const hook of hooks) {
        hook["event"]?.({
          event: input,
        })
      }
    })
  }
}
