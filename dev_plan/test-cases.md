# Test Cases

## TC-001: Single Pane Default (REQ-F001)
**Status**: verified (POC-001)
- **Given**: App loads with no split state
- **When**: Session page renders
- **Then**: Single pane with all tabs, identical to current behavior
- **Automated**: YES (unit test for migrateFromTabs)

## TC-002: Split Pane via Button (REQ-F002)
**Status**: draft
- **Given**: Single pane with 2+ tabs
- **When**: User clicks split button in tab bar
- **Then**: Pane splits horizontally, active tab moves to new right pane
- **Automated**: YES (integration test)

## TC-003: Split Pane via Keyboard (REQ-F002)
**Status**: draft
- **Given**: Single pane focused
- **When**: User presses Mod+\
- **Then**: Same as TC-002
- **Automated**: YES (E2E test)

## TC-004: Resize Panes (REQ-F003)
**Status**: verified (POC-002)
- **Given**: Two panes side by side
- **When**: User drags resize handle
- **Then**: Panes resize proportionally, clamped to 300px min
- **Automated**: YES (component test for mouse events)

## TC-005: Collapse Pane on Empty (REQ-F004)
**Status**: verified (POC-001)
- **Given**: Split with 2 panes, right pane has 1 tab
- **When**: User closes the last tab in right pane
- **Then**: Right pane collapses, left pane fills the space with animation
- **Automated**: YES (unit test for removePane + CSS transition test)

## TC-006: Tab Drag Between Panes (REQ-F005)
**Status**: verified (POC-003 - structure only)
- **Given**: Two panes with tabs
- **When**: User drags a tab from pane 1 to pane 2
- **Then**: Tab moves to pane 2, pane 1 collapses if empty
- **Automated**: PARTIAL (provider test verified, full drag needs E2E)

## TC-007: Focus Tracking (REQ-F006)
**Status**: draft
- **Given**: Two panes, pane 1 focused
- **When**: User clicks inside pane 2
- **Then**: Pane 2 becomes focused, prompt targets pane 2's session
- **Automated**: YES (integration test)

## TC-008: Auto-Split for Documents (REQ-F007)
**Status**: draft
- **Given**: Single pane, user working with AI
- **When**: AI generates PRD/ERD and preview tab opens
- **Then**: Screen auto-splits with chat left, preview right
- **Automated**: YES (integration test)

## TC-009: Persist Layout (REQ-F008)
**Status**: draft
- **Given**: User has split panes
- **When**: Page is refreshed
- **Then**: Split state restored from localStorage
- **Automated**: YES (unit test for validateTree + integration)

## TC-010: Mobile Exclusion (REQ-F009)
**Status**: draft
- **Given**: User on mobile device (viewport < 768px)
- **When**: Session page renders
- **Then**: No split button visible, single pane only
- **Automated**: YES (component test with media query mock)

## TC-011: Max Panes (REQ-F002)
**Status**: verified (POC-001)
- **Given**: Already 3 panes open
- **When**: User tries to split again
- **Then**: Split button disabled, split action rejected
- **Automated**: YES (unit test for countLeaves)

## TC-012: Commands Target Focused Pane (REQ-F006)
**Status**: draft
- **Given**: Two panes with different sessions
- **When**: User triggers undo/redo/compact command
- **Then**: Command applies to focused pane's session, not the other
- **Automated**: YES (integration test)

## TC-013: Agent/Model Sync (REQ-NF003)
**Status**: draft
- **Given**: Two panes with different sessions using different models
- **When**: User switches focus between panes
- **Then**: Agent/model selector reflects the focused pane's session
- **Automated**: YES (integration test)
