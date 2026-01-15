import { BusEvent } from "../bus/bus-event"
import z from "zod"

export namespace Collab {
  // Phase 1: Core schemas
  export const Status = z
    .object({
      branch: z.string(),
      isDirty: z.boolean(),
      hasUnpushed: z.boolean(),
      isOnline: z.boolean(),
      isDetached: z.boolean().optional(),
      originalBranch: z.string().optional(),
      hasConflicts: z.boolean().optional(),
      conflictCount: z.number().optional(),
    })
    .meta({ ref: "CollabStatus" })
  export type Status = z.infer<typeof Status>

  export const SaveResult = z
    .object({
      commitHash: z.string(),
      message: z.string(),
      pushed: z.boolean(),
      skipped: z.boolean(),
      pushError: z.enum(["remote_ahead", "auth_failed", "network", "other"]).optional(),
    })
    .meta({ ref: "CollabSaveResult" })
  export type SaveResult = z.infer<typeof SaveResult>

  export const SyncResult = z
    .object({
      success: z.boolean(),
      changes: z.number(),
      conflicts: z.boolean(),
      blocked: z.boolean().optional(),
      blockedFiles: z.array(z.string()).optional(),
    })
    .meta({ ref: "CollabSyncResult" })
  export type SyncResult = z.infer<typeof SyncResult>

  // Phase 2: Timeline schemas
  export const Author = z
    .object({
      name: z.string(),
      email: z.string(),
    })
    .meta({ ref: "CollabAuthor" })
  export type Author = z.infer<typeof Author>

  export const CommitInfo = z
    .object({
      hash: z.string(),
      message: z.string(),
      author: Author,
      timestamp: z.number(),
      files: z.array(z.string()).optional(),
    })
    .meta({ ref: "CollabCommitInfo" })
  export type CommitInfo = z.infer<typeof CommitInfo>

  // Phase 3: Revert schemas
  export const BrowseResult = z
    .object({
      success: z.boolean(),
      originalBranch: z.string(),
      isDetached: z.boolean(),
    })
    .meta({ ref: "CollabBrowseResult" })
  export type BrowseResult = z.infer<typeof BrowseResult>

  export const FreshResult = z
    .object({
      success: z.boolean(),
      newBranch: z.string(),
      fromCommit: z.string(),
    })
    .meta({ ref: "CollabFreshResult" })
  export type FreshResult = z.infer<typeof FreshResult>

  export const ReplaceResult = z
    .object({
      success: z.boolean(),
      lostCommits: z.number(),
      pushed: z.boolean(),
    })
    .meta({ ref: "CollabReplaceResult" })
  export type ReplaceResult = z.infer<typeof ReplaceResult>

  // Phase 4: Team schemas
  export const TeamMember = z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      github: z.string().optional(),
      avatar: z.string().optional(),
      firstCommit: z.number().optional(),
      lastCommit: z.number().optional(),
      commitCount: z.number().optional(),
    })
    .meta({ ref: "CollabTeamMember" })
  export type TeamMember = z.infer<typeof TeamMember>

  export const TeamData = z
    .object({
      members: z.array(TeamMember),
      lastUpdated: z.number(),
      source: z.enum(["git", "github", "manual"]),
      currentUserEmail: z.string().optional(),
    })
    .meta({ ref: "CollabTeamData" })
  export type TeamData = z.infer<typeof TeamData>

  // Phase 5: Conflict schemas
  export const ConflictSection = z
    .object({
      startLine: z.number(),
      endLine: z.number(),
      ours: z.string(),
      theirs: z.string(),
      base: z.string().optional(),
    })
    .meta({ ref: "CollabConflictSection" })
  export type ConflictSection = z.infer<typeof ConflictSection>

  export const ConflictFile = z
    .object({
      path: z.string(),
      conflicts: z.array(ConflictSection),
    })
    .meta({ ref: "CollabConflictFile" })
  export type ConflictFile = z.infer<typeof ConflictFile>

  // Events
  export const Event = {
    StatusChanged: BusEvent.define("collab.status.changed", Status),
    SaveStarted: BusEvent.define("collab.save.started", z.object({})),
    SaveCompleted: BusEvent.define(
      "collab.save.completed",
      z.object({
        commitHash: z.string(),
        message: z.string(),
        pushed: z.boolean(),
        skipped: z.boolean(),
        pushError: z.enum(["remote_ahead", "auth_failed", "network", "other"]).optional(),
      }),
    ),
    SaveFailed: BusEvent.define(
      "collab.save.failed",
      z.object({
        error: z.string(),
        offline: z.boolean(),
      }),
    ),
    SyncCompleted: BusEvent.define("collab.sync.completed", SyncResult),
    TeamUpdated: BusEvent.define("collab.team.updated", z.object({ members: z.number() })),
    ConflictDetected: BusEvent.define("collab.conflict.detected", z.object({ files: z.array(z.string()) })),
    ConflictResolved: BusEvent.define("collab.conflict.resolved", z.object({ file: z.string() })),
    MergeBlocked: BusEvent.define(
      "collab.merge.blocked",
      z.object({
        reason: z.enum(["uncommitted_changes", "untracked_files"]),
        files: z.array(z.string()),
      }),
    ),
    GitChanged: BusEvent.define("collab.git.changed", z.object({})),
  }
}
