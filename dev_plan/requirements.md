# Requirements

## REQ-WF-001: Workflow Step Model

**Status**: draft
**Priority**: high
**PoC**: POC-001

The system must support a multi-step workflow with ordered steps: PRD -> User Flow -> ERD.

### Acceptance Criteria
- Each step has a type (`prd`, `userflow`, `erd`), status (`pending`, `active`, `complete`), and optional document content
- Workflow state is persisted per-session via Storage
- Steps progress linearly: only one step can be `active` at a time
- Advancing sets current step to `complete` and next step to `active`
- Bus events are published on workflow state changes

### Cross-References
- Components: COMP-WF-001, COMP-WF-002
- Tests: TC-WF-001, TC-WF-002, TC-WF-003
- Backend: `packages/opencode/src/workflow/index.ts`

---

## REQ-WF-002: File-Write Trigger

**Status**: draft
**Priority**: high
**PoC**: POC-002

When a `.md` file is written to the project's `dev_plan/` directory, the system detects it and maps it to a workflow step.

### Acceptance Criteria
- File watcher detects new/changed `.md` files in `dev_plan/`
- Filename mapping: `prd.md` -> prd, `userflow.md` -> userflow, `erd.md` -> erd
- Detection triggers `workflow.step.completed` Bus event
- Event includes session ID, step type, and file path
- Works with existing @parcel/watcher infrastructure

### Cross-References
- Components: none (backend only)
- Tests: TC-WF-004, TC-WF-005
- Backend: `packages/opencode/src/file/watcher.ts`, `packages/opencode/src/workflow/index.ts`

---

## REQ-WF-003: Auto-Open Workflow Tab + Split Pane

**Status**: draft
**Priority**: high
**PoC**: POC-003

When a workflow document is detected, it auto-opens as a `workflow://` tab in a new split pane alongside the chat.

### Acceptance Criteria
- `workflow://` is a new tab prefix (like `file://` and `preview://`)
- On file-write trigger, the pane auto-splits if not already split
- Workflow tab opens in the new pane with the document loaded
- If workflow tab already exists, it switches to the updated document
- Tab renders `WorkflowDocView` component (not plain `FileViewer`)

### Cross-References
- Components: COMP-WF-001
- Tests: TC-WF-006, TC-WF-007
- Frontend: `pane.tsx`, `file.tsx`, `session.tsx`

---

## REQ-WF-004: Step Progression Buttons

**Status**: draft
**Priority**: medium
**PoC**: POC-003

Action buttons appear in the workflow tab for advancing to the next step.

### Acceptance Criteria
- Buttons are contextual per step:
  - After PRD: "Next: User Flow"
  - After User Flow: "Next: ERD"
  - After ERD: "Complete Workflow"
- Clicking a button calls the workflow advance API
- The button sends a prompt to the active session for the next step
- Step indicator shows "Step X of 3"

### Cross-References
- Components: COMP-WF-003
- Tests: TC-WF-008, TC-WF-009
- Backend: `POST /session/:sessionID/workflow/advance`

---

## REQ-WF-005: In-Place Document Editing

**Status**: draft
**Priority**: medium
**PoC**: POC-003

Users can edit the generated document directly in the workflow tab.

### Acceptance Criteria
- FileViewer handles markdown rendering and editing (already exists)
- Edits are saved to the file on disk
- Changes persist across page reloads
- User can toggle between preview and edit mode

### Cross-References
- Components: COMP-WF-001
- Tests: TC-WF-010
- Frontend: `FileViewer` component (reused)

---

## REQ-WF-006: Workflow State Persistence

**Status**: draft
**Priority**: high
**PoC**: POC-001

Workflow state must persist across page reloads and server restarts.

### Acceptance Criteria
- Workflow state stored via `Storage.write(["workflow", sessionID], info)`
- State includes: current step, all step statuses, documents, timestamps
- Minimized state stored in layout context (persisted to localStorage)
- On reload: workflow tab restores if it was open, icon shows if minimized

### Cross-References
- Components: COMP-WF-001
- Tests: TC-WF-011, TC-WF-012
- Backend: `Storage` module

---

## REQ-WF-007: Minimize/Restore Genie Animation

**Status**: draft
**Priority**: medium
**PoC**: POC-004

Closing the workflow tab triggers a macOS-style genie effect that shrinks the pane into a small icon in the prompt input bar.

### Acceptance Criteria
- Closing a `workflow://` tab triggers genie animation instead of immediate close
- Animation: pane content shrinks (scale + translate) toward icon position (~300ms)
- On complete: pane closes, icon appears in prompt bar
- Clicking icon triggers reverse animation: icon expands into split pane
- Icon only visible when workflow exists AND tab is minimized
- Icon shows badge indicating current step (PRD/Flow/ERD)
- Minimized state persisted in layout context

### Cross-References
- Components: COMP-WF-004, COMP-WF-005
- Tests: TC-WF-013, TC-WF-014, TC-WF-015
- Frontend: `workflow-genie.tsx`, `prompt-input.tsx`, `layout.tsx`
