# COMP-WF-003: WorkflowActionButtons

**Status**: draft
**PoC**: POC-003

## Purpose
Contextual action buttons at the bottom of WorkflowDocView for step progression.

## Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| currentStep | StepType | yes | Currently active step |
| currentStepIndex | number | yes | 0-based index |
| totalSteps | number | yes | Total number of steps |
| onAdvanceStep | () => void | no | Called on button click |

## Button Labels
| Step | Button Label |
|------|-------------|
| prd (complete) | "Next: User Flow" |
| userflow (complete) | "Next: ERD" |
| erd (complete) | "Complete Workflow" |

## Constraints
- Inline within WorkflowDocView
- Primary variant button with arrow-right icon
- Shows "Step X of N" counter on left

## Cross-References
- Requirements: REQ-WF-004
- Tests: TC-WF-008, TC-WF-009
- Parent: COMP-WF-001
