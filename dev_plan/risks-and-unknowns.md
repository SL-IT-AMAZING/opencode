# Risks and Unknowns

## Verified (via PoC)

| Item | PoC | Result |
|------|-----|--------|
| Binary tree state model | POC-001 | 60 tests, 100% coverage |
| Immutable tree operations | POC-001 | Structural sharing verified |
| SolidJS recursive rendering | POC-002 | 10 tests, renders correctly |
| Resize handle interaction | POC-002 | Mouse events work |
| solid-dnd multi-provider | POC-003 | Multiple SortableProviders under one DragDropProvider works |

## Unverified (draft)

### RISK-001: Session.tsx Extraction (HIGH)
**What**: ~600 lines with 30+ memos and 15+ effects need to move from session.tsx into pane.tsx
**Why risky**: Deeply coupled state, many cross-references, context dependencies
**Mitigation**: Phase 2 single-pane regression test. If it breaks, the extraction was wrong.
**Verification plan**: After extraction, run app in dev mode and verify all current functionality works identically.

### RISK-002: Command Handler Rewiring (HIGH)
**What**: 15+ commands in session.tsx (L584-813) reference single `activeSessionId()`
**Why risky**: Missing one = wrong session targeted by command
**Mitigation**: Replace all references with `focusedActiveSessionId`. Search-and-replace, then manual review.
**Verification plan**: Test each command (undo, redo, compact, steps toggle, permissions, etc.) with two panes and different sessions.

### RISK-003: Agent/Model Race Condition (MEDIUM)
**What**: `local.agent.set()` / `local.model.set()` (L464-474) globally mutates from session state
**Why risky**: Two panes with different sessions = race condition on which agent/model is "current"
**Mitigation**: Only fire this effect from the focused pane's `onActiveSessionChange` callback.
**Verification plan**: Open two panes with different models, switch focus, verify model selector updates correctly.

### RISK-004: sync.session.sync() (MEDIUM)
**What**: Currently called once for one session (L528-531)
**Why risky**: Second pane's session wouldn't sync
**Mitigation**: Each pane calls `sync.session.sync()` in its own effect for its own `activeSessionId`
**Verification plan**: Open two panes with different sessions, verify both receive real-time updates.

### RISK-005: Full Drag Testing (MEDIUM)
**What**: Cross-pane tab drag verified structurally but not end-to-end
**Why risky**: jsdom doesn't support real pointer events/layout
**Mitigation**: Manual testing in dev mode + Playwright E2E test
**Verification plan**: Drag a tab from pane 1 to pane 2 in the running app.

### RISK-006: Layout Persistence Migration (LOW)
**What**: Bumping "layout.v7" to "layout.v8" may lose user's layout preferences
**Why risky**: persisted() utility behavior on version change unclear
**Mitigation**: persisted() likely starts fresh on version change (which is the safe behavior). Verify by reading persist.ts.
**Verification plan**: Run app, check localStorage, verify old data doesn't corrupt new format.

### RISK-007: window.location.hash (LOW)
**What**: Currently used for message linking (scroll to #message-{id})
**Why risky**: Global state, only one pane can own it
**Mitigation**: Only focused pane reads/writes hash. Non-focused panes ignore hash.
**Verification plan**: Open two panes, scroll in each, verify URL hash only reflects focused pane.
