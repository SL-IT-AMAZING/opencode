# COMP-WF-004: WorkflowGenie

**Status**: draft
**PoC**: POC-004

## Purpose
CSS animation component for the macOS-style genie/shrink effect when minimizing/restoring the workflow tab.

## Hook: useWorkflowGenie()
Returns:
| Field | Type | Description |
|-------|------|-------------|
| animating | Accessor<boolean> | Whether animation is in progress |
| mode | Accessor<"minimize" \| "restore"> | Current animation direction |
| sourceRect | Accessor<GenieRect> | Start position |
| targetRect | Accessor<GenieRect> | End position |
| minimize | (from, to, onComplete) => void | Trigger minimize animation |
| restore | (from, to, onComplete) => void | Trigger restore animation |

## Component: WorkflowGenieOverlay
Renders a fixed overlay with the animated element during transitions.

## Animation
- Duration: 300ms ease-in-out
- CSS keyframes: left, top, width, height, opacity
- Uses CSS custom properties for dynamic values
- Minimize: full size -> icon size, opacity 1 -> 0.3
- Restore: icon size -> full size, opacity 0.3 -> 1

## Constraints
- MUST use CSS animations (not JS-driven frame-by-frame)
- Overlay is pointer-events: none
- z-index: 9999 (above everything)
- Animation cleanup on component unmount

## Cross-References
- Requirements: REQ-WF-007
- Tests: TC-WF-013, TC-WF-014
