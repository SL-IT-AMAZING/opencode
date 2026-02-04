# COMP-WF-001: WorkflowDocView

**Status**: draft
**PoC**: POC-003

## Purpose
Wraps the existing FileViewer with workflow-specific chrome: step progress bar (top), document viewer (middle), action buttons (bottom).

## Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| path | string | yes | File path to the workflow document (.md) |
| workflow | WorkflowInfo \| undefined | no | Current workflow state |
| onAdvanceStep | () => void | no | Called when user clicks next step button |
| onAskAboutSelection | (selection) => void | no | Forwarded to FileViewer |

## States
| State | Condition | Visual |
|-------|-----------|--------|
| No workflow | `workflow` is undefined | Shows FileViewer only, no step bar or buttons |
| Active step | Current step matches document | Step highlighted in bar, "Next" button visible |
| Last step | Current step is "erd" | "Complete Workflow" button instead of "Next" |
| Complete | All steps complete | All steps show checkmarks |

## Constraints
- MUST reuse existing FileViewer for document rendering
- MUST NOT add its own markdown parser
- Step bar MUST be fixed height (not scroll with document)
- Action buttons MUST be fixed at bottom

## Edge Cases
- Workflow undefined: render FileViewer only
- File not found: FileViewer handles error state
- Rapid step advances: debounce onAdvanceStep

## Accessibility
- Step bar uses aria-current="step" for active step
- Action buttons are focusable and keyboard-accessible
- Step progress announces changes via aria-live

## Cross-References
- Requirements: REQ-WF-003, REQ-WF-004, REQ-WF-005
- Tests: TC-WF-006, TC-WF-007, TC-WF-008, TC-WF-010
- Stories: STORY-WF-001
