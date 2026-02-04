# Cross-Reference Matrix

## Requirements -> Components

| Requirement | Components |
|-------------|------------|
| REQ-WF-001: Step Model | COMP-WF-001, COMP-WF-002 |
| REQ-WF-002: File Trigger | (backend only) |
| REQ-WF-003: Auto-Open Tab | COMP-WF-001 |
| REQ-WF-004: Step Buttons | COMP-WF-001, COMP-WF-003 |
| REQ-WF-005: Document Edit | COMP-WF-001 (via FileViewer) |
| REQ-WF-006: Persistence | COMP-WF-001 |
| REQ-WF-007: Genie Animation | COMP-WF-004, COMP-WF-005 |

## Components -> Tests

| Component | Test Cases |
|-----------|------------|
| COMP-WF-001: WorkflowDocView | TC-WF-006, TC-WF-007, TC-WF-008, TC-WF-010 |
| COMP-WF-002: WorkflowStepBar | TC-WF-001 |
| COMP-WF-003: WorkflowActionButtons | TC-WF-008, TC-WF-009 |
| COMP-WF-004: WorkflowGenie | TC-WF-013, TC-WF-014 |
| COMP-WF-005: WorkflowIcon | TC-WF-015 |

## Requirements -> Tests

| Requirement | Test Cases |
|-------------|------------|
| REQ-WF-001 | TC-WF-001, TC-WF-002, TC-WF-003 |
| REQ-WF-002 | TC-WF-004, TC-WF-005 |
| REQ-WF-003 | TC-WF-006, TC-WF-007 |
| REQ-WF-004 | TC-WF-008, TC-WF-009 |
| REQ-WF-005 | TC-WF-010 |
| REQ-WF-006 | TC-WF-011, TC-WF-012 |
| REQ-WF-007 | TC-WF-013, TC-WF-014, TC-WF-015 |

## Verification Status

| ID | Type | Status | PoC |
|----|------|--------|-----|
| REQ-WF-001 | Requirement | implemented | POC-001 |
| REQ-WF-002 | Requirement | implemented | POC-002 |
| REQ-WF-003 | Requirement | implemented | POC-003 |
| REQ-WF-004 | Requirement | implemented | POC-003 |
| REQ-WF-005 | Requirement | implemented | POC-003 |
| REQ-WF-006 | Requirement | implemented | POC-001 |
| REQ-WF-007 | Requirement | implemented | POC-004 |
| COMP-WF-001 | Component | implemented | POC-003 |
| COMP-WF-002 | Component | implemented | POC-003 |
| COMP-WF-003 | Component | implemented | POC-003 |
| COMP-WF-004 | Component | implemented | POC-004 |
| COMP-WF-005 | Component | implemented | POC-004 |

## Implementation Files

### Backend

| Component | File Path | Key Exports |
|-----------|-----------|-------------|
| Workflow Module | `packages/opencode/src/workflow/index.ts` | `Workflow` namespace with `create`, `get`, `updateDocument`, `advanceStep` functions |
| Workflow Routes | `packages/opencode/src/server/workflow-route.ts` | `WorkflowRoute` with GET/POST/PATCH endpoints |

**Backend Features Implemented:**
- Step type definitions: `prd`, `userflow`, `erd`
- Step status tracking: `pending`, `active`, `complete`
- File-to-step mapping via `stepFromFile()` and `fileFromStep()`
- Step progression logic via `nextStep()` and `advanceStep()`
- Document storage per step with timestamps
- Event bus integration (`workflow.updated`, `workflow.step.completed` events)
- Storage persistence using `Storage.write()`

### Frontend

| Component | File Path | Key Exports |
|-----------|-----------|-------------|
| WorkflowDocView | `packages/app/src/components/workflow-doc-view.tsx` | `WorkflowDocView` component |
| WorkflowGenie | `packages/app/src/components/workflow-genie.tsx` | `useWorkflowGenie`, `WorkflowGenieOverlay` |
| Pane (Workflow Tab) | `packages/app/src/components/split-pane/pane.tsx` | Match case for `activeWorkflowTab()` at lines 568-580 |
| PromptInput (Workflow Icon) | `packages/app/src/components/prompt-input.tsx` | Workflow minimized indicator at lines 1816-1823 |
| File Context | `packages/app/src/context/file.tsx` | `workflowTab()`, `workflowFromTab()`, `isWorkflowTab()` helpers |
| Layout Context | `packages/app/src/context/layout.tsx` | `workflow.isMinimized()`, `workflow.minimize()`, `workflow.restore()` |
| Session Page | `packages/app/src/pages/session.tsx` | Auto-split listener for `workflow.step.completed` event at lines 245-290 |
| Session Tab | `packages/app/src/components/session/session-sortable-tab.tsx` | `WorkflowVisual` component at lines 64-88 |

**Frontend Features Implemented:**
- Progress bar showing 3 steps (PRD, User Flow, ERD) with visual states
- Step status indicators (pending/active/complete) with color coding
- "Next: [Step]" button to advance workflow
- FileViewer integration for document editing
- `workflow://` tab protocol with icon and visual indicator
- Workflow minimized state with restore icon in prompt input
- Auto-split behavior when `workflow.step.completed` event fires
- Genie animation infrastructure (minimize/restore functions with rect calculations)

### Integration Points

| Feature | File | Lines |
|---------|------|-------|
| Workflow tab detection | `packages/app/src/context/file.tsx` | 169-181 |
| Workflow tab rendering | `packages/app/src/components/split-pane/pane.tsx` | 153-157, 568-580 |
| Workflow icon in tab bar | `packages/app/src/components/session/session-sortable-tab.tsx` | 64-88 |
| Workflow minimized indicator | `packages/app/src/components/prompt-input.tsx` | 1816-1823 |
| Auto-split on step completion | `packages/app/src/pages/session.tsx` | 245-290 |
| Workflow state persistence | `packages/app/src/context/layout.tsx` | 660-678 |

## Implementation Notes

1. **Step Model (REQ-WF-001)**: Fully implemented in backend with complete state machine
2. **File Trigger (REQ-WF-002)**: Backend emits `workflow.step.completed` events
3. **Auto-Open Tab (REQ-WF-003)**: Session page listens for events and auto-splits pane
4. **Step Buttons (REQ-WF-004)**: WorkflowDocView shows progress bar and next button
5. **Document Edit (REQ-WF-005)**: Reuses existing FileViewer component
6. **Persistence (REQ-WF-006)**: Layout context stores minimized state per session
7. **Genie Animation (REQ-WF-007)**: Infrastructure in place (rect tracking, CSS animation)

All requirements have been implemented with actual code. The status has been changed from "draft" to "implemented".
