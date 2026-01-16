#!/usr/bin/env bun

import { $ } from "bun"
import { Script } from "@anyon/script"
import { buildNotes, getLatestRelease } from "./changelog"

let notes: string[] = []

console.log("=== publishing ===\n")

if (!Script.preview) {
  const previous = await getLatestRelease()
  notes = await buildNotes(previous, "HEAD")
}

const pkgjsons = await Array.fromAsync(
  new Bun.Glob("**/package.json").scan({
    absolute: true,
  }),
).then((arr) => arr.filter((x) => !x.includes("node_modules") && !x.includes("dist")))

for (const file of pkgjsons) {
  let pkg = await Bun.file(file).text()
  pkg = pkg.replaceAll(/"version": "[^"]+"/g, `"version": "${Script.version}"`)
  console.log("updated:", file)
  await Bun.file(file).write(pkg)
}

await $`bun install`

console.log("\n=== building CLI (no npm publish) ===\n")
// npm publish disabled - Desktop app only
// await import(`../packages/opencode/script/publish.ts`)
// await import(`../packages/sdk/js/script/publish.ts`)
// await import(`../packages/plugin/script/publish.ts`)

// Build CLI binaries for Desktop sidecar
await $`bun run build`.cwd("./packages/opencode")

// Create archives for GitHub release
const distPath = "./packages/opencode/dist"
const distDirs = await Array.fromAsync(new Bun.Glob("anyon-*").scan({ cwd: distPath, onlyFiles: false }))
for (const name of distDirs) {
  if (name.includes("linux")) {
    await $`tar -czf ../../${name}.tar.gz *`.cwd(`${distPath}/${name}/bin`)
  } else {
    await $`zip -r ../../${name}.zip *`.cwd(`${distPath}/${name}/bin`)
  }
}

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

let output = `version=${Script.version}\n`

if (!Script.preview) {
  await $`git commit -am "release: v${Script.version}"`
  await $`git tag v${Script.version}`
  await $`git fetch origin`
  await $`git cherry-pick HEAD..origin/dev`.nothrow()
  await $`git push origin HEAD --tags --no-verify --force-with-lease`
  await new Promise((resolve) => setTimeout(resolve, 5_000))
  await $`gh release create v${Script.version} -d --title "v${Script.version}" --notes ${notes.join("\n") || "No notable changes"} ./packages/opencode/dist/*.zip ./packages/opencode/dist/*.tar.gz`
  const release = await $`gh release view v${Script.version} --json id,tagName`.json()
  output += `release=${release.id}\n`
  output += `tag=${release.tagName}\n`
}

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output)
}
