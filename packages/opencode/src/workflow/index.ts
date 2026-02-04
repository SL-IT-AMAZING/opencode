import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import z from "zod"
import { Storage } from "../storage/storage"
import path from "path"
import { Log } from "../util/log"

export namespace Workflow {
  const log = Log.create({ service: "workflow" })

  export const StepType = z.enum(["prd", "userflow", "erd"])
  export type StepType = z.infer<typeof StepType>

  export const Step = z
    .object({
      type: StepType,
      status: z.enum(["pending", "active", "complete"]),
      document: z.string().optional(),
      updatedAt: z.number().optional(),
    })
    .meta({ ref: "Workflow.Step" })
  export type Step = z.infer<typeof Step>

  export const Info = z
    .object({
      sessionID: z.string(),
      currentStep: StepType,
      steps: z.record(StepType, Step),
      idea: z.string(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
    })
    .meta({ ref: "Workflow" })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Updated: BusEvent.define(
      "workflow.updated",
      z.object({
        sessionID: z.string(),
        info: Info,
      }),
    ),
    StepCompleted: BusEvent.define(
      "workflow.step.completed",
      z.object({
        sessionID: z.string(),
        step: StepType,
        filePath: z.string(),
      }),
    ),
  }

  const STEP_ORDER: StepType[] = ["prd", "userflow", "erd"]

  const STEP_PATTERNS: Array<{ pattern: RegExp; step: StepType }> = [
    { pattern: /^prd(-.*)?\.md$/, step: "prd" },
    { pattern: /^userflow(-.*)?\.md$/, step: "userflow" },
    { pattern: /^erd(-.*)?\.md$/, step: "erd" },
  ]

  // In-memory registry of active workflows for file watcher bridge
  const activeWorkflows = new Map<string, Info>()

  export function stepFromFile(filename: string): StepType | undefined {
    const basename = path.basename(filename)
    const match = STEP_PATTERNS.find((p) => p.pattern.test(basename))
    return match?.step
  }

  export function fileFromStep(step: StepType): string {
    return `${step}.md`
  }

  export function nextStep(current: StepType): StepType | undefined {
    const index = STEP_ORDER.indexOf(current)
    if (index === -1 || index >= STEP_ORDER.length - 1) return undefined
    return STEP_ORDER[index + 1]
  }

  export async function create(sessionID: string, idea: string): Promise<Info> {
    const now = Date.now()
    const info: Info = {
      sessionID,
      currentStep: "prd",
      steps: {
        prd: { type: "prd", status: "active", updatedAt: now },
        userflow: { type: "userflow", status: "pending" },
        erd: { type: "erd", status: "pending" },
      },
      idea,
      time: { created: now, updated: now },
    }
    await Storage.write(["workflow", sessionID], info)
    activeWorkflows.set(sessionID, info)
    Bus.publish(Event.Updated, { sessionID, info })
    return info
  }

  export async function get(sessionID: string): Promise<Info | undefined> {
    return Storage.read<Info>(["workflow", sessionID]).catch(() => undefined)
  }

  export async function updateDocument(sessionID: string, step: StepType, document: string): Promise<Info | undefined> {
    const info = await get(sessionID)
    if (!info) return undefined
    const now = Date.now()
    info.steps[step] = {
      ...info.steps[step],
      type: step,
      status: "complete",
      document,
      updatedAt: now,
    }
    info.time.updated = now
    await Storage.write(["workflow", sessionID], info)
    activeWorkflows.set(sessionID, info)
    Bus.publish(Event.Updated, { sessionID, info })
    return info
  }

  export async function advanceStep(sessionID: string): Promise<Info | undefined> {
    const info = await get(sessionID)
    if (!info) return undefined
    const next = nextStep(info.currentStep)
    if (!next) return info
    const now = Date.now()
    info.steps[info.currentStep] = {
      ...info.steps[info.currentStep],
      type: info.currentStep,
      status: "complete",
      updatedAt: now,
    }
    info.currentStep = next
    info.steps[next] = {
      ...info.steps[next],
      type: next,
      status: "active",
      updatedAt: now,
    }
    info.time.updated = now
    await Storage.write(["workflow", sessionID], info)
    activeWorkflows.set(sessionID, info)
    Bus.publish(Event.Updated, { sessionID, info })
    return info
  }

  export function initBridge() {
    GlobalBus.on("event", async (event) => {
      if (event.payload.type !== "file.watcher.updated") return
      const file = event.payload.properties.file as string
      if (!file.includes(".sisyphus/plans/")) return

      const basename = path.basename(file)
      const step = stepFromFile(basename)
      if (!step) return

      // Find active workflow with matching current step
      for (const [sessionID, workflow] of activeWorkflows) {
        if (workflow.currentStep !== step) continue
        if (workflow.steps[step]?.status !== "active") continue

        const content = await Bun.file(file).text()
        // Update in-memory state
        const now = Date.now()
        workflow.steps[step] = {
          ...workflow.steps[step],
          type: step,
          status: "complete",
          document: content,
          updatedAt: now,
        }
        workflow.time.updated = now
        activeWorkflows.set(sessionID, workflow)

        // Publish via GlobalBus directly (no Instance context needed)
        GlobalBus.emit("event", {
          directory: event.directory,
          payload: {
            type: Event.Updated.type,
            properties: { sessionID, info: workflow },
          },
        })
        GlobalBus.emit("event", {
          directory: event.directory,
          payload: {
            type: Event.StepCompleted.type,
            properties: { sessionID, step, filePath: file },
          },
        })
        log.info("bridge: updated workflow from file", { sessionID, step, file: basename })
        break
      }
    })
    log.info("file watcher bridge initialized")
  }
}
