#!/usr/bin/env bun

import { Script } from "@anyon/script"
import { $ } from "bun"

if (!Script.preview) {
  await $`gh release edit v${Script.version} --draft=false`
}

await $`bun install`

await $`gh release download --pattern "anyon-linux-*64.tar.gz" --pattern "anyon-darwin-*64.zip" -D dist`

// AUR and Homebrew publishing disabled for now
// await import(`../packages/opencode/script/publish-registries.ts`)
