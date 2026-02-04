# Guided Development Workflow - Development Plan

## Purpose

This folder contains all specifications, requirements, component definitions, test cases, and cross-references for the **Guided Development Workflow** feature in OpenCode.

Another AI agent should be able to read this folder alone and implement the entire feature from scratch with zero errors.

## Folder Structure

```
dev_plan/
  README.md                    # This file - entry point
  requirements.md              # All requirements with IDs (REQ-WF-*)
  components/
    workflow-doc-view.md       # COMP-WF-001: WorkflowDocView
    workflow-step-bar.md       # COMP-WF-002: WorkflowStepBar
    workflow-action-buttons.md # COMP-WF-003: WorkflowActionButtons
    workflow-genie.md          # COMP-WF-004: WorkflowGenie animation
    workflow-icon.md           # COMP-WF-005: Workflow prompt bar icon
  tests/
    test-cases.md              # All test case definitions (TC-WF-*)
  cross-references.md          # Traceability matrix
```

## Feature Overview

A multi-step guided workflow inside OpenCode sessions:

1. **PRD** - AI asks clarifying questions, generates a Product Requirements Document
2. **User Flow** - AI generates 5+ user flow scenarios from the PRD
3. **ERD** - AI generates entity relationships from PRD + User Flows

### How It Works

1. User starts a session and begins describing their idea
2. AI agent (plugin, added later) guides the user through PRD creation
3. When AI writes `dev_plan/prd.md`, the file watcher triggers
4. The workflow document auto-opens as a `workflow://` tab in a split pane
5. Step bar shows progress (PRD -> User Flow -> ERD)
6. User can edit the document in-place (FileViewer with markdown support)
7. Action buttons at bottom allow advancing to next step
8. Closing the tab triggers a genie animation, shrinking to an icon in the prompt bar
9. Clicking the icon restores the tab with reverse animation

### Tech Stack

- **Backend**: Hono server, Bus events, Storage persistence
- **Frontend**: SolidJS, Tailwind CSS, existing split-pane system
- **File Watching**: @parcel/watcher (existing in project)
- **State**: SolidJS createStore + produce pattern

### Key Integration Points

| System | File | What Changes |
|--------|------|-------------|
| Workflow state | `packages/opencode/src/workflow/index.ts` | NEW module |
| Server routes | `packages/opencode/src/server/server.ts` | Add workflow endpoints |
| Tab system | `packages/app/src/components/split-pane/pane.tsx` | Add `workflow://` Match case |
| File context | `packages/app/src/context/file.tsx` | Add `workflowTab/workflowFromTab` |
| Layout state | `packages/app/src/context/layout.tsx` | Add `workflowMinimized` state |
| Prompt input | `packages/app/src/components/prompt-input.tsx` | Add workflow icon |
| Workflow UI | `packages/app/src/components/workflow-doc-view.tsx` | NEW component |
| Genie effect | `packages/app/src/components/workflow-genie.tsx` | NEW component |

### Style Guide

- No semicolons
- No `else` - use early returns
- No `try/catch` - use `.catch()`
- No `let` - use `const`
- No `any` type
- Prefer single-word variable names
