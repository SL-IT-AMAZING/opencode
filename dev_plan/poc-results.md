# PoC Results

All PoC code is in `../dev_poc/src/`.

Run: `cd dev_poc && bun run test:coverage`

---

## POC-001: Binary Tree Utils
**Status**: VERIFIED
**Risk level**: medium
**Files**: `dev_poc/src/types.ts`, `dev_poc/src/utils.ts`, `dev_poc/src/utils.test.ts`

### Goal
Verify that a binary tree model can represent split pane layouts and all operations (split, remove, resize, move) work correctly with immutable updates.

### Hypothesis
"A binary tree of PaneLeaf/PaneSplit nodes can model all split-screen states, and pure functions can manipulate it immutably with structural sharing."

### Results
- **60 tests**: ALL PASS
- **Coverage**: 100% statements, 100% branches, 100% functions, 100% lines
- **Structural sharing**: Verified - unchanged subtrees return same object references
- **Edge cases tested**: Non-existent pane IDs, single leaf removal, auto-collapse on empty pane, ratio clamping, nested splits

### Key Finding
Lines 106-107 in initial removePane implementation were dead code (unreachable branches). Removed and replaced with non-null assertions. This validates the importance of 100% branch coverage - it exposed unnecessary complexity.

### Alternatives Considered

| Alternative | Pros | Cons | Adopted? |
|-------------|------|------|----------|
| Binary tree (chosen) | Natural recursion, VS Code model, easy serialize | Slightly complex for 2-pane case | YES |
| Flat array of panes | Simpler data structure | Hard to represent nested splits, no natural parent-child | NO |
| Grid layout | More flexible (rows + cols) | Over-engineered for our max-3-pane case | NO |

---

## POC-002: SolidJS Split Pane Rendering
**Status**: VERIFIED
**Risk level**: medium
**Files**: `dev_poc/src/split-container.tsx`, `dev_poc/src/split-container.test.tsx`

### Goal
Verify that SolidJS can recursively render a pane tree with resize handles and focus tracking.

### Hypothesis
"A recursive SolidJS component can render PaneNode trees, with each leaf getting its own content area and resize handles between splits."

### Results
- **10 tests**: ALL PASS
- Single leaf rendering: works
- Split rendering (2 panes): works
- Nested split rendering (3 panes): works
- Focus tracking: works (data-focused attribute)
- Resize handle mouse interaction: works (mousedown + mousemove + mouseup)

### Key Finding
The real implementation should use the existing `ResizeHandle` from `packages/ui/src/components/resize-handle.tsx` instead of custom mouse handling. The PoC validated the rendering pattern; the production code reuses existing infrastructure.

### Note on Coverage
TSX files have JSX prop accessor functions that v8 coverage counts as branches. These are SolidJS compilation artifacts. For `.tsx` files, coverage is verified through behavioral tests rather than strict per-file 100%.

---

## POC-003: Cross-Pane DnD with solid-dnd
**Status**: VERIFIED
**Risk level**: high
**Files**: `dev_poc/src/cross-pane-dnd.test.tsx`

### Goal
Verify that `@thisbeyond/solid-dnd` v0.7.5 supports multiple `SortableProvider` instances under a single `DragDropProvider`, enabling cross-pane tab dragging.

### Hypothesis
"A single DragDropProvider wrapping multiple SortableProviders allows items from different providers to exist in the same drag context."

### Results
- **5 tests**: ALL PASS
- Multiple SortableProviders under one DragDropProvider: **RENDERS WITHOUT ERRORS**
- All items from all providers are registered and accessible
- Drag event structure has `draggable.id` and `droppable.id` for cross-pane detection

### Limitation
Full drag simulation (pointer down, move, drop) requires real layout engine. jsdom doesn't support `getBoundingClientRect` or pointer events realistically. Cross-pane drag must be tested with Playwright E2E tests.

### Implementation Strategy
```
DragDropProvider (single, wraps all panes)
├── DragDropSensors
├── SplitView (recursive rendering)
│   ├── Pane 1
│   │   └── SortableProvider (pane 1 tab IDs)
│   ├── ResizeHandle
│   └── Pane 2
│       └── SortableProvider (pane 2 tab IDs)
└── DragOverlay (shared)
```

In `onDragEnd`:
1. Get `draggable.id` (the tab being dragged)
2. Get `droppable.id` (the tab it was dropped near)
3. Look up which pane each belongs to
4. If different panes: call `moveTab()` utility
5. If same pane: reorder within pane

---

## Unverified Items (draft status)

| Item | Why unverified | Plan to verify |
|------|---------------|----------------|
| Pane extraction from session.tsx | Requires full app context, too large for isolated PoC | Phase 2: extract and test in single-pane mode, verify no regression |
| Focus tracking with prompt | Requires PromptInput integration | Test during Phase 3 integration |
| Command handler rewiring | Requires useCommand context | Test during Phase 3 integration |
| Auto-split trigger | Requires preview tab infrastructure | Test during Phase 4 polish |
| Layout persistence migration | Requires persisted() utility context | Test during Phase 3 |
| Mobile exclusion | Requires isDesktop() media query | Test during Phase 3 |
