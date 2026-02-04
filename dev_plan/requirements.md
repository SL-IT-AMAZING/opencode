# Requirements

## REQ-001: Split-Screen Tab System
**Status**: draft
**Priority**: HIGH

### Problem
The OpenCode web app has a single-pane session area. Users need to view documents (PRD, ERD, component previews) alongside the AI chat simultaneously.

### Solution
A general-purpose split-screen system where any tab can be split side-by-side, like VS Code editor groups.

---

## Functional Requirements

### REQ-F001: Single Pane Default
**Status**: verified (POC-001)
- Default state is a single pane with all tabs
- Zero UI overhead when not splitting
- Identical behavior to current app
- **PoC ref**: POC-001 (migrateFromTabs)

### REQ-F002: Split Pane
**Status**: verified (POC-001, POC-002)
- Click split button in tab bar to split the focused pane
- Active tab moves to the new right pane
- Keyboard shortcut: `Mod+\`
- Maximum 3 panes (2 splits deep)
- **PoC ref**: POC-001 (splitPane, countLeaves), POC-002 (SplitContainer rendering)

### REQ-F003: Resize Panes
**Status**: verified (POC-002)
- Drag resize handle between panes to adjust width ratio
- Minimum pane width: 300px
- Ratio clamped to 0.1-0.9
- **PoC ref**: POC-001 (updateRatio), POC-002 (resize handle interaction)

### REQ-F004: Close/Collapse Pane
**Status**: verified (POC-001)
- When last tab in a pane is closed, pane auto-collapses
- Parent split node replaced by surviving sibling
- Smooth animation (CSS transition)
- **PoC ref**: POC-001 (removePane, moveTab auto-collapse)

### REQ-F005: Tab Drag Between Panes
**Status**: verified (POC-003)
- Single DragDropProvider wraps all panes
- Each pane has its own SortableProvider
- Dragging tab to different pane moves it
- Source pane auto-collapses if empty after move
- **PoC ref**: POC-003 (multi-SortableProvider under single DragDropProvider)

### REQ-F006: Focus Tracking
**Status**: draft
- Click within a pane sets it as focused
- Focused pane determines which session receives prompt messages
- Visual indicator (border highlight) on focused pane
- Commands operate on focused pane's session

### REQ-F007: Auto-Split for Documents
**Status**: draft
- When opening PRD/ERD preview tab, auto-split with chat on left and preview on right
- Only triggers if currently single-pane
- User can manually unsplit afterward

### REQ-F008: Persist Layout
**Status**: draft
- Split state persisted to localStorage (via existing persisted() utility)
- Restored on page reload
- Invalid persisted state falls back to single pane
- **PoC ref**: POC-001 (validateTree)

### REQ-F009: Mobile Exclusion
**Status**: draft
- No splitting on mobile (isDesktop() guard)
- Split button hidden on mobile
- Falls back to single-pane behavior

---

## Non-Functional Requirements

### REQ-NF001: Animation
- Split: CSS transition-[width] 200ms ease-out
- Unsplit: surviving pane animates to 100%
- Resize drag: immediate (no animation)

### REQ-NF002: Performance
- Single-pane mode: zero additional DOM nodes or computation
- Split mode: minimal overhead (2-3 extra div wrappers per pane)

### REQ-NF003: Backward Compatibility
- Existing tabs() API in layout.tsx must continue working
- All existing keyboard shortcuts and commands must work
- Right panel (file explorer, terminal) unaffected

---

## Cross-References

| Requirement | Component | Test Cases | PoC |
|-------------|-----------|------------|-----|
| REQ-F001 | SplitContainer, layout.tsx | TC-001 | POC-001 |
| REQ-F002 | SplitContainer, pane-tab-bar, utils | TC-002, TC-003 | POC-001, POC-002 |
| REQ-F003 | SplitContainer (ResizeHandle) | TC-004 | POC-002 |
| REQ-F004 | utils (removePane), SplitContainer | TC-005 | POC-001 |
| REQ-F005 | SplitContainer (DragDropProvider) | TC-006 | POC-003 |
| REQ-F006 | pane.tsx, session.tsx | TC-007 | - |
| REQ-F007 | session.tsx | TC-008 | - |
| REQ-F008 | layout.tsx | TC-009 | POC-001 |
| REQ-F009 | session.tsx | TC-010 | - |
