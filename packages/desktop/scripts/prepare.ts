#!/usr/bin/env bun
import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar } from "./utils"

const sidecarConfig = getCurrentSidecar()

const dir = "src-tauri/target/opencode-binaries"

// Artifact already downloaded by actions/download-artifact in workflow
await $`mkdir -p ${dir}`
// await $`gh run download ${Bun.env.GITHUB_RUN_ID} -n anyon-cli`.cwd(dir)

await copyBinaryToSidecarFolder(
  `${dir}/${sidecarConfig.ocBinary}/bin/anyon${process.platform === "win32" ? ".exe" : ""}`,
)
