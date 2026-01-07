#!/usr/bin/env bun
import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar } from "./utils"

const sidecarConfig = getCurrentSidecar()

const dir = "src-tauri/target/anyon-binaries"

// Artifact already downloaded by actions/download-artifact in workflow
await $`mkdir -p ${dir}`

await copyBinaryToSidecarFolder(
  `${dir}/${sidecarConfig.ocBinary}/bin/anyon${process.platform === "win32" ? ".exe" : ""}`,
)
