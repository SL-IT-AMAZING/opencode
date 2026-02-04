# Test Cases

## TC-WF-001: Workflow creation

**Given**: No workflow exists for session
**When**: `Workflow.create(sessionID, "Build a todo app")` is called
**Then**: Workflow is created with `currentStep: "prd"`, prd step `active`, others `pending`
**Automatable**: Yes (unit test)
**Cross-References**: REQ-WF-001, COMP-WF-002

---

## TC-WF-002: Step advancement

**Given**: Workflow exists with `currentStep: "prd"`, prd step `active`
**When**: `Workflow.advanceStep(sessionID)` is called
**Then**: prd becomes `complete`, userflow becomes `active`, `currentStep` is `"userflow"`
**Automatable**: Yes (unit test)
**Cross-References**: REQ-WF-001

---

## TC-WF-003: Step advancement at last step

**Given**: Workflow with `currentStep: "erd"`
**When**: `Workflow.advanceStep(sessionID)` is called
**Then**: Returns info unchanged (no next step), erd remains active
**Automatable**: Yes (unit test)
**Cross-References**: REQ-WF-001

---

## TC-WF-004: File-to-step mapping

**Given**: File watcher detects `prd.md` written to `dev_plan/`
**When**: `Workflow.stepFromFile("prd.md")` is called
**Then**: Returns `"prd"`
**Automatable**: Yes (unit test)
**Cross-References**: REQ-WF-002

---

## TC-WF-005: Unknown file mapping

**Given**: File watcher detects `notes.md` written to `dev_plan/`
**When**: `Workflow.stepFromFile("notes.md")` is called
**Then**: Returns `undefined`
**Automatable**: Yes (unit test)
**Cross-References**: REQ-WF-002

---

## TC-WF-006: Workflow tab auto-open

**Given**: Session is active, no split pane
**When**: `workflow.step.completed` event fires with `step: "prd"` and `filePath: "dev_plan/prd.md"`
**Then**: Pane splits, new pane opens `workflow://dev_plan/prd.md` tab
**Automatable**: Yes (component test)
**Cross-References**: REQ-WF-003, COMP-WF-001

---

## TC-WF-007: Workflow tab with existing split

**Given**: Session pane already split with file tab
**When**: `workflow.step.completed` event fires
**Then**: Workflow tab opens in existing split pane (no double split)
**Automatable**: Yes (component test)
**Cross-References**: REQ-WF-003

---

## TC-WF-008: Next step button visibility

**Given**: WorkflowDocView rendered with `currentStep: "prd"`
**When**: Component renders
**Then**: "Next: User Flow" button visible, "Step 1 of 3" shown
**Automatable**: Yes (component test)
**Cross-References**: REQ-WF-004, COMP-WF-003

---

## TC-WF-009: Last step button label

**Given**: WorkflowDocView rendered with `currentStep: "erd"`
**When**: Component renders
**Then**: "Complete Workflow" button shown instead of "Next"
**Automatable**: Yes (component test)
**Cross-References**: REQ-WF-004, COMP-WF-003

---

## TC-WF-010: Document editing

**Given**: WorkflowDocView with loaded prd.md
**When**: User toggles edit mode and modifies content
**Then**: FileViewer saves changes to disk
**Automatable**: Yes (integration test)
**Cross-References**: REQ-WF-005, COMP-WF-001

---

## TC-WF-011: State persistence - server

**Given**: Workflow created with some steps complete
**When**: Server restarts
**Then**: `Workflow.get(sessionID)` returns same state
**Automatable**: Yes (integration test)
**Cross-References**: REQ-WF-006

---

## TC-WF-012: State persistence - frontend

**Given**: Workflow tab open, page reloads
**When**: App mounts
**Then**: Workflow tab restored in correct pane position
**Automatable**: Yes (integration test)
**Cross-References**: REQ-WF-006

---

## TC-WF-013: Genie minimize animation

**Given**: Workflow tab open in split pane
**When**: User closes the workflow tab
**Then**: Pane content shrinks toward prompt bar icon (~300ms), then pane closes and icon appears
**Automatable**: Partially (visual verification needed)
**Cross-References**: REQ-WF-007, COMP-WF-004

---

## TC-WF-014: Genie restore animation

**Given**: Workflow tab minimized, icon visible in prompt bar
**When**: User clicks the workflow icon
**Then**: Icon expands into split pane (~300ms), workflow tab appears
**Automatable**: Partially (visual verification needed)
**Cross-References**: REQ-WF-007, COMP-WF-004

---

## TC-WF-015: Workflow icon visibility

**Given**: Workflow exists for session, tab is minimized
**When**: Prompt input renders
**Then**: Workflow icon visible left of attach button with step badge
**Automatable**: Yes (component test)
**Cross-References**: REQ-WF-007, COMP-WF-005
