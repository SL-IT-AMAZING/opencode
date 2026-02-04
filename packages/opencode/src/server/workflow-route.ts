import { Hono } from "hono"
import { stream } from "hono/streaming"
import { describeRoute, validator, resolver } from "hono-openapi"
import { z } from "zod"
import { Workflow } from "../workflow"
import { SessionPrompt } from "../session/prompt"

const AGENT_MAP: Record<string, string> = {
  prd: "anyon-alpha",
  userflow: "anyon-beta",
  erd: "anyon-gamma",
}

export const WorkflowRoute = new Hono()
  .get(
    "/session/:sessionID/workflow",
    describeRoute({
      summary: "Get session workflow",
      description: "Retrieve the workflow state associated with a specific session.",
      operationId: "session.workflow",
      responses: {
        200: {
          description: "Workflow state",
          content: {
            "application/json": {
              schema: resolver(Workflow.Info.optional()),
            },
          },
        },
      },
    }),
    validator(
      "param",
      z.object({
        sessionID: z.string().meta({ description: "Session ID" }),
      }),
    ),
    async (c) => {
      const sessionID = c.req.valid("param").sessionID
      const workflow = await Workflow.get(sessionID)
      return c.json(workflow ?? null)
    },
  )
  .post(
    "/session/:sessionID/workflow",
    describeRoute({
      summary: "Create session workflow",
      description: "Initialize a guided workflow for a session.",
      operationId: "session.workflow.create",
      responses: {
        200: {
          description: "Created workflow",
          content: {
            "application/json": {
              schema: resolver(Workflow.Info),
            },
          },
        },
      },
    }),
    validator(
      "param",
      z.object({
        sessionID: z.string().meta({ description: "Session ID" }),
      }),
    ),
    validator(
      "json",
      z.object({
        idea: z.string().meta({ description: "The user's project idea" }),
      }),
    ),
    async (c) => {
      const sessionID = c.req.valid("param").sessionID
      const body = c.req.valid("json")
      const workflow = await Workflow.create(sessionID, body.idea)
      return c.json(workflow)
    },
  )
  .post(
    "/session/:sessionID/workflow/start",
    describeRoute({
      summary: "Start workflow with agent",
      description: "Create a workflow and start the first agent (anyon-alpha) for PRD generation.",
      operationId: "session.workflow.start",
      responses: {
        200: {
          description: "Created workflow with agent started",
          content: {
            "application/json": {
              schema: resolver(Workflow.Info),
            },
          },
        },
      },
    }),
    validator(
      "param",
      z.object({
        sessionID: z.string().meta({ description: "Session ID" }),
      }),
    ),
    validator(
      "json",
      z.object({
        idea: z.string().meta({ description: "The user's project idea" }),
      }),
    ),
    async (c) => {
      const sessionID = c.req.valid("param").sessionID
      const body = c.req.valid("json")
      const workflow = await Workflow.create(sessionID, body.idea)

      // Use stream to keep Instance context alive for the prompt
      c.header("Content-Type", "application/json")
      return stream(c, async (s) => {
        s.write(JSON.stringify(workflow))
        SessionPrompt.prompt({
          sessionID,
          agent: "anyon-alpha",
          parts: [{ type: "text", text: body.idea }],
        }).catch((e) => console.error("[workflow] start prompt FAILED:", e))
      })
    },
  )
  .post(
    "/session/:sessionID/workflow/advance",
    describeRoute({
      summary: "Advance workflow step",
      description: "Move the workflow to the next step and trigger the corresponding agent.",
      operationId: "session.workflow.advance",
      responses: {
        200: {
          description: "Updated workflow",
          content: {
            "application/json": {
              schema: resolver(Workflow.Info.optional()),
            },
          },
        },
      },
    }),
    validator(
      "param",
      z.object({
        sessionID: z.string().meta({ description: "Session ID" }),
      }),
    ),
    async (c) => {
      const sessionID = c.req.valid("param").sessionID
      const workflow = await Workflow.advanceStep(sessionID)
      if (!workflow) return c.json(null)

      const agent = AGENT_MAP[workflow.currentStep]
      if (!agent) return c.json(workflow)

      // Use stream to keep Instance context alive for the prompt
      c.header("Content-Type", "application/json")
      return stream(c, async (s) => {
        s.write(JSON.stringify(workflow))
        SessionPrompt.prompt({
          sessionID,
          agent,
          parts: [{ type: "text", text: `Continue workflow. Idea: ${workflow.idea}` }],
        }).catch((e) => console.error("[workflow] advance prompt FAILED:", e))
      })
    },
  )
  .patch(
    "/session/:sessionID/workflow/step/:step",
    describeRoute({
      summary: "Update workflow step",
      description: "Update the document content for a specific workflow step.",
      operationId: "session.workflow.step.update",
      responses: {
        200: {
          description: "Updated workflow",
          content: {
            "application/json": {
              schema: resolver(Workflow.Info.optional()),
            },
          },
        },
      },
    }),
    validator(
      "param",
      z.object({
        sessionID: z.string().meta({ description: "Session ID" }),
        step: Workflow.StepType.meta({ description: "Workflow step type" }),
      }),
    ),
    validator(
      "json",
      z.object({
        document: z.string().meta({ description: "Document content in markdown" }),
      }),
    ),
    async (c) => {
      const sessionID = c.req.valid("param").sessionID
      const step = c.req.valid("param").step
      const body = c.req.valid("json")
      const workflow = await Workflow.updateDocument(sessionID, step, body.document)
      return c.json(workflow ?? null)
    },
  )
