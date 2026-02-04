import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Storage before importing the workflow module
vi.mock("@/storage/storage", () => ({
  Storage: {
    write: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock Bus before importing the workflow module
vi.mock("@/bus", () => ({
  Bus: {
    publish: vi.fn(),
    subscribe: vi.fn(),
  },
}))

// Mock BusEvent used by Event definitions
vi.mock("@/bus/bus-event", () => ({
  BusEvent: {
    define: vi.fn(
      (name: string, _schema: unknown) =>
        ({ name }) as { name: string },
    ),
  },
}))

// Mock FileWatcher
vi.mock("@/file/watcher", () => ({
  FileWatcher: {
    Event: {
      Updated: { name: "file.watcher.updated" },
    },
  },
}))

// Mock Log to avoid Bun dependency
vi.mock("@/util/log", () => ({
  Log: {
    create: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      time: vi.fn(() => ({ stop: vi.fn() })),
    }),
  },
}))

import { Workflow } from "@/workflow/index"
import { Storage } from "@/storage/storage"

const mockStorage = Storage as {
  write: ReturnType<typeof vi.fn>
  read: ReturnType<typeof vi.fn>
}

describe("Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Pure helper functions ──────────────────────────────────────────

  describe("stepFromFile", () => {
    it("TC-WF-004: returns step type for known filename", () => {
      const result = Workflow.stepFromFile("prd.md")
      expect(result).toBe("prd")
    })

    it("TC-WF-004: maps userflow.md correctly", () => {
      expect(Workflow.stepFromFile("userflow.md")).toBe("userflow")
    })

    it("TC-WF-004: maps erd.md correctly", () => {
      expect(Workflow.stepFromFile("erd.md")).toBe("erd")
    })

    it("TC-WF-005: returns undefined for unknown filename", () => {
      const result = Workflow.stepFromFile("notes.md")
      expect(result).toBeUndefined()
    })

    // Regex pattern tests for agent-generated filenames
    it("matches prd-myapp.md", () => {
      expect(Workflow.stepFromFile("prd-myapp.md")).toBe("prd")
    })

    it("matches userflow-todo-app.md", () => {
      expect(Workflow.stepFromFile("userflow-todo-app.md")).toBe("userflow")
    })

    it("matches erd-v2.md", () => {
      expect(Workflow.stepFromFile("erd-v2.md")).toBe("erd")
    })

    it("handles full path by extracting basename", () => {
      expect(Workflow.stepFromFile(".sisyphus/plans/prd-test.md")).toBe("prd")
    })

    it("does not match partial names like prd-extra.txt", () => {
      expect(Workflow.stepFromFile("prd-extra.txt")).toBeUndefined()
    })

    it("does not match prefix-only like prdx.md", () => {
      expect(Workflow.stepFromFile("prdx.md")).toBeUndefined()
    })
  })

  describe("fileFromStep", () => {
    it("returns prd.md for prd step", () => {
      expect(Workflow.fileFromStep("prd")).toBe("prd.md")
    })

    it("returns userflow.md for userflow step", () => {
      expect(Workflow.fileFromStep("userflow")).toBe("userflow.md")
    })

    it("returns erd.md for erd step", () => {
      expect(Workflow.fileFromStep("erd")).toBe("erd.md")
    })
  })

  describe("nextStep", () => {
    it("returns userflow after prd", () => {
      expect(Workflow.nextStep("prd")).toBe("userflow")
    })

    it("returns erd after userflow", () => {
      expect(Workflow.nextStep("userflow")).toBe("erd")
    })

    it("returns undefined after erd (last step)", () => {
      expect(Workflow.nextStep("erd")).toBeUndefined()
    })
  })

  // ── CRUD functions (require Storage mock) ──────────────────────────

  describe("create", () => {
    it("TC-WF-001: returns correct initial state", async () => {
      const result = await Workflow.create("session-1", "Build a todo app")

      expect(result.sessionID).toBe("session-1")
      expect(result.currentStep).toBe("prd")
      expect(result.idea).toBe("Build a todo app")

      expect(result.steps.prd.status).toBe("active")
      expect(result.steps.prd.type).toBe("prd")

      expect(result.steps.userflow.status).toBe("pending")
      expect(result.steps.userflow.type).toBe("userflow")

      expect(result.steps.erd.status).toBe("pending")
      expect(result.steps.erd.type).toBe("erd")

      expect(result.time.created).toBeTypeOf("number")
      expect(result.time.updated).toBe(result.time.created)

      expect(mockStorage.write).toHaveBeenCalledOnce()
    })
  })

  describe("advanceStep", () => {
    it("TC-WF-002: advances from prd to userflow", async () => {
      const now = Date.now()
      const existing: Workflow.Info = {
        sessionID: "session-2",
        currentStep: "prd",
        steps: {
          prd: { type: "prd", status: "active", updatedAt: now },
          userflow: { type: "userflow", status: "pending" },
          erd: { type: "erd", status: "pending" },
        },
        idea: "Test idea",
        time: { created: now, updated: now },
      }

      mockStorage.read.mockResolvedValueOnce(existing)

      const result = await Workflow.advanceStep("session-2")

      expect(result).toBeDefined()
      expect(result!.currentStep).toBe("userflow")
      expect(result!.steps.prd.status).toBe("complete")
      expect(result!.steps.userflow.status).toBe("active")
      expect(result!.steps.erd.status).toBe("pending")

      expect(mockStorage.write).toHaveBeenCalledOnce()
    })

    it("TC-WF-003: returns unchanged at last step (erd)", async () => {
      const now = Date.now()
      const existing: Workflow.Info = {
        sessionID: "session-3",
        currentStep: "erd",
        steps: {
          prd: { type: "prd", status: "complete", updatedAt: now },
          userflow: { type: "userflow", status: "complete", updatedAt: now },
          erd: { type: "erd", status: "active", updatedAt: now },
        },
        idea: "Test idea",
        time: { created: now, updated: now },
      }

      mockStorage.read.mockResolvedValueOnce(existing)

      const result = await Workflow.advanceStep("session-3")

      expect(result).toBeDefined()
      expect(result!.currentStep).toBe("erd")
      expect(result!.steps.erd.status).toBe("active")

      // Storage.write should NOT be called since no advancement happened
      expect(mockStorage.write).not.toHaveBeenCalled()
    })
  })
})
