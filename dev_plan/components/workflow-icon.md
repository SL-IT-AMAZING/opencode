# COMP-WF-005: Workflow Prompt Bar Icon

**Status**: draft
**PoC**: POC-004

## Purpose
Small icon in the prompt input bar (left of attach button) that appears when the workflow tab is minimized. Clicking it restores the tab.

## Location
In `prompt-input.tsx`, right action area (line ~1814), left of the file attach button.

## Props (via context)
| Prop | Source | Description |
|------|--------|-------------|
| workflowExists | workflow state | Whether a workflow is active for this session |
| isMinimized | layout context | Whether the workflow tab is currently minimized |
| currentStep | workflow state | Current step for badge display |
| onRestore | callback | Triggers restore animation + opens tab |

## Visibility
Only visible when: `workflowExists && isMinimized`

## Visual
- Ghost button, size-6, with workflow icon (size-4.5)
- Small colored dot/badge indicating current step
- Tooltip: "Open Workflow (Step: PRD)"

## Constraints
- MUST use existing Button/Icon/Tooltip components
- MUST match existing icon button styling in prompt bar
- Badge updates reactively when step changes

## Cross-References
- Requirements: REQ-WF-007
- Tests: TC-WF-015
- Modified file: `prompt-input.tsx`
