import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Collab } from "."
import { CollabStatus } from "./status"
import { CollabSave } from "./save"
import { CollabSync } from "./sync"
import { CollabHistory } from "./history"
import { CollabRevert } from "./revert"
import { CollabTeam } from "./team"
import { CollabConflict } from "./conflict"
import { Bus } from "../bus"

export const CollabRoute = new Hono()
  .get(
    "/status",
    describeRoute({
      summary: "Get collab status",
      description: "Get the current collaboration status including branch, dirty state, and online status.",
      operationId: "collab.status",
      responses: {
        200: {
          description: "Collaboration status",
          content: { "application/json": { schema: resolver(Collab.Status) } },
        },
      },
    }),
    async (c) => {
      const status = await CollabStatus.get()
      return c.json(status)
    },
  )
  .post(
    "/save",
    describeRoute({
      summary: "Save changes (add + commit + push)",
      description: "Stage all changes, create a commit, and push to remote if available.",
      operationId: "collab.save",
      responses: {
        200: {
          description: "Save result",
          content: { "application/json": { schema: resolver(Collab.SaveResult) } },
        },
      },
    }),
    validator("json", z.object({ message: z.string().optional() }).optional()),
    async (c) => {
      const body = c.req.valid("json")
      const result = await CollabSave.execute(body?.message)
      return c.json(result)
    },
  )
  .post(
    "/sync",
    describeRoute({
      summary: "Sync with remote (fetch + merge)",
      description: "Fetch changes from remote and merge them into the current branch.",
      operationId: "collab.sync",
      responses: {
        200: {
          description: "Sync result",
          content: { "application/json": { schema: resolver(Collab.SyncResult) } },
        },
      },
    }),
    async (c) => {
      const result = await CollabSync.execute()
      return c.json(result)
    },
  )
  .get(
    "/history",
    describeRoute({
      summary: "Get commit history",
      description: "Get paginated commit history for the current branch.",
      operationId: "collab.history",
      responses: {
        200: {
          description: "Commit history",
          content: { "application/json": { schema: resolver(z.array(Collab.CommitInfo)) } },
        },
      },
    }),
    validator(
      "query",
      z.object({
        limit: z.coerce.number().default(20),
        offset: z.coerce.number().default(0),
      }),
    ),
    async (c) => {
      const { limit, offset } = c.req.valid("query")
      const commits = await CollabHistory.list(limit, offset)
      return c.json(commits)
    },
  )
  .get(
    "/history/:hash/files",
    describeRoute({
      summary: "Get changed files for a commit",
      description: "Get the list of files changed in a specific commit.",
      operationId: "collab.historyFiles",
      responses: {
        200: {
          description: "Changed files",
          content: { "application/json": { schema: resolver(z.array(z.string())) } },
        },
      },
    }),
    async (c) => {
      const hash = c.req.param("hash")
      const files = await CollabHistory.getFiles(hash)
      return c.json(files)
    },
  )
  // Phase 3: Revert routes
  .post(
    "/revert/browse",
    describeRoute({
      summary: "Browse specific commit (detached HEAD)",
      description: "Enter read-only mode at a specific commit. Stashes any uncommitted changes.",
      operationId: "collab.revertBrowse",
      responses: {
        200: {
          description: "Browse result",
          content: { "application/json": { schema: resolver(Collab.BrowseResult) } },
        },
      },
    }),
    validator("json", z.object({ commitHash: z.string() })),
    async (c) => {
      const { commitHash } = c.req.valid("json")
      const result = await CollabRevert.browse(commitHash)
      return c.json(result)
    },
  )
  .post(
    "/revert/exit-browse",
    describeRoute({
      summary: "Exit browse mode",
      description: "Return to original branch and restore stashed changes.",
      operationId: "collab.revertExitBrowse",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("json", z.object({ originalBranch: z.string() })),
    async (c) => {
      const { originalBranch } = c.req.valid("json")
      const success = await CollabRevert.exitBrowse(originalBranch)
      return c.json({ success })
    },
  )
  .post(
    "/revert/fresh",
    describeRoute({
      summary: "Create new branch from commit",
      description: "Start fresh by creating a new branch at a specific commit.",
      operationId: "collab.revertFresh",
      responses: {
        200: {
          description: "Fresh result",
          content: { "application/json": { schema: resolver(Collab.FreshResult) } },
        },
      },
    }),
    validator(
      "json",
      z.object({
        commitHash: z.string(),
        branchName: z.string(),
      }),
    ),
    async (c) => {
      const { commitHash, branchName } = c.req.valid("json")
      const result = await CollabRevert.startFresh(commitHash, branchName)
      return c.json(result)
    },
  )
  .post(
    "/revert/replace",
    describeRoute({
      summary: "Hard reset to commit (DANGEROUS)",
      description: "Replace current branch with a specific commit. This is destructive!",
      operationId: "collab.revertReplace",
      responses: {
        200: {
          description: "Replace result",
          content: { "application/json": { schema: resolver(Collab.ReplaceResult) } },
        },
      },
    }),
    validator(
      "json",
      z.object({
        commitHash: z.string(),
        forcePush: z.boolean().default(false),
      }),
    ),
    async (c) => {
      const { commitHash, forcePush } = c.req.valid("json")
      const result = await CollabRevert.replaceMain(commitHash, forcePush)
      return c.json(result)
    },
  )
  // Phase 4: Team routes
  .get(
    "/team",
    describeRoute({
      summary: "Get team members",
      description: "Get team members detected from git history.",
      operationId: "collab.team",
      responses: {
        200: {
          description: "Team data",
          content: { "application/json": { schema: resolver(Collab.TeamData) } },
        },
      },
    }),
    async (c) => {
      const team = await CollabTeam.get()
      return c.json(team)
    },
  )
  .post(
    "/team/refresh",
    describeRoute({
      summary: "Refresh team from git",
      description: "Re-detect team members from git history.",
      operationId: "collab.teamRefresh",
      responses: {
        200: {
          description: "Refreshed team data",
          content: { "application/json": { schema: resolver(Collab.TeamData) } },
        },
      },
    }),
    async (c) => {
      const team = await CollabTeam.refresh()
      return c.json(team)
    },
  )
  .patch(
    "/team/:email",
    describeRoute({
      summary: "Update team member",
      description: "Update a specific team member's info.",
      operationId: "collab.teamUpdate",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator(
      "json",
      z.object({
        github: z.string().optional(),
        avatar: z.string().optional(),
      }),
    ),
    async (c) => {
      const email = c.req.param("email")
      const body = c.req.valid("json")
      const success = await CollabTeam.updateMember(email, body)
      return c.json({ success })
    },
  )
  // Phase 5: Conflict routes
  .get(
    "/conflicts",
    describeRoute({
      summary: "Get all conflicts",
      description: "Get list of conflicted files with parsed conflict sections.",
      operationId: "collab.conflicts",
      responses: {
        200: {
          description: "Conflict files",
          content: { "application/json": { schema: resolver(z.array(Collab.ConflictFile)) } },
        },
      },
    }),
    async (c) => {
      const conflicts = await CollabConflict.getAll()
      return c.json(conflicts)
    },
  )
  .post(
    "/conflicts/:file/resolve",
    describeRoute({
      summary: "Resolve a conflict",
      description: "Resolve a single file conflict.",
      operationId: "collab.conflictResolve",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator(
      "json",
      z.object({
        resolution: z.enum(["ours", "theirs", "custom"]),
        customContent: z.string().optional(),
      }),
    ),
    async (c) => {
      const file = decodeURIComponent(c.req.param("file"))
      const { resolution, customContent } = c.req.valid("json")
      const success = await CollabConflict.resolveFile(file, resolution, customContent)
      if (success) {
        await Bus.publish(Collab.Event.ConflictResolved, { file })
      }
      return c.json({ success })
    },
  )
  .post(
    "/conflicts/abort",
    describeRoute({
      summary: "Abort merge",
      description: "Abort the current merge and return to pre-merge state.",
      operationId: "collab.conflictAbort",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    async (c) => {
      const success = await CollabConflict.abortMerge()
      return c.json({ success })
    },
  )
  .post(
    "/conflicts/continue",
    describeRoute({
      summary: "Continue merge",
      description: "Finalize merge after all conflicts are resolved.",
      operationId: "collab.conflictContinue",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    async (c) => {
      const success = await CollabConflict.continueMerge()
      return c.json({ success })
    },
  )
