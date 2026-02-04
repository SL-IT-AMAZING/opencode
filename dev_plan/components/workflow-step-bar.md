# COMP-WF-002: WorkflowStepBar

**Status**: draft
**PoC**: POC-003

## Purpose
Horizontal step indicator showing PRD -> User Flow -> ERD with the current step highlighted. Embedded within WorkflowDocView.

## Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| currentStep | StepType | yes | Currently active step |
| steps | Record<StepType, WorkflowStep> | yes | All step states |

## States
| State | Visual |
|-------|--------|
| pending | Gray text, numbered circle |
| active | Blue/info background, highlighted |
| complete | Green checkmark icon |

## Constraints
- Inline within WorkflowDocView, not a standalone component
- Fixed height, does not scroll
- Connector lines between steps

## Cross-References
- Requirements: REQ-WF-001
- Tests: TC-WF-001
- Parent: COMP-WF-001
