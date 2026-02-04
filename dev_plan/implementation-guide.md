# Implementation Guide

## Prerequisites

- Read `requirements.md`, `component-specs.md`, and `poc-results.md` first
- The PoC code in `../dev_poc/src/` contains working, tested implementations for types.ts, utils.ts, and split-container.tsx

## Style Rules (from CLAUDE.md)

- No semicolons
- No `else` - use early returns
- No `try/catch` - use `.catch()`
- No `let` - use `const` and immutable patterns
- No `any` - use precise types
- Prefer single-word variable names when descriptive

## Phase 1: Foundation (no UI changes)

### Step 1: Create types.ts
**Path**: `packages/app/src/components/split-pane/types.ts`
**Source**: Copy directly from `dev_poc/src/types.ts`

### Step 2: Create utils.ts
**Path**: `packages/app/src/components/split-pane/utils.ts`
**Source**: Copy from `dev_poc/src/utils.ts`
**Important**: All 60 tests pass with 100% coverage. This code is verified.

### Step 3: Modify layout.tsx
**Path**: `packages/app/src/context/layout.tsx`

Changes:
1. Import types from split-pane
2. Change `"layout.v7"` to `"layout.v8"`
3. Add to store: `splitLayout: {} as Record<string, SplitLayout>`
4. Add `split(sessionKey)` method (see component-specs.md COMP-006)
5. Add migration in existing `tabs(sessionKey)` - if `splitLayout[key]` doesn't exist but `sessionTabs[key]` does, auto-create a single-leaf SplitLayout

**Backward compat**: The existing `tabs()` method must continue to work. It should delegate to the focused pane's tabs in the split layout. If no split layout exists, it works exactly as before.

### Step 4: Create index.ts
**Path**: `packages/app/src/components/split-pane/index.ts`
```ts
export * from "./types"
export * from "./utils"
export { SplitContainer } from "./split-container"
export { Pane } from "./pane"
export { PaneTabBar } from "./pane-tab-bar"
```

**Checkpoint**: Run `bun turbo typecheck` - must pass with zero errors.

---

## Phase 2: Extract Pane (highest risk)

### Step 5: Create pane-tab-bar.tsx
**Path**: `packages/app/src/components/split-pane/pane-tab-bar.tsx`

Extract the tab bar JSX from `session.tsx` lines 1156-1267. This includes:
- SortableProvider wrapping tab list
- For loop rendering SortableTab and SortableSessionTab
- Context tab (conditional)
- New session button
- **ADD**: Split button (next to new session button)

The component receives its tab list and callbacks as props (see component-specs.md COMP-005).

**Important**: Do NOT include DragDropProvider here - that goes in SplitContainer.

### Step 6: Create pane.tsx
**Path**: `packages/app/src/components/split-pane/pane.tsx`

This is the critical extraction. Move from `session.tsx`:

**State that moves in**:
- All memos derived from `activeSessionId`: messages, visibleUserMessages, diffs, status, info, activeMessage
- Tab-derived memos: allTabs, openedTabs, contextOpen, contextActive, hasFileTabs, activeFileTab, activePreviewTab
- Display memos: reviewTab, mobileReview, showTabs, activeTab
- Local store: expanded, messageId, mobileTab, activeDraggable, newSessionWorktree
- Auto-scroll instance
- Scroll spy handler
- openedPreviewUrls Set

**Effects that move in**:
- Tab normalization (session.tsx L310-326)
- File load on tab change (L302-308)
- Active tab auto-set (L984-989)
- Scroll restore (L1074-1088) - BUT use pane-local state instead of window.location.hash
- Message tracking (L553-576)
- Localhost URL detection (L263-300)
- sync.session.sync() call (L528-531) - each pane syncs its own session

**Functions that move in**:
- normalizeTab, normalizeTabs, openTab, closeTab
- navigateMessageByOffset, scrollToMessage, setActiveMessage
- getActiveMessageId, scheduleScrollSpy
- handleAskAboutSelection, closeFileViewer, switchToSession
- anchor, setScrollRef, updateHash (but hash updates only for focused pane)

**JSX that moves in**:
- Content area (L1270-1416): Switch between preview/file/context/session/new-session
- Tab bar (via PaneTabBar component)

**Contexts accessed inside Pane** (via useContext or props):
- useSync() - for messages, diffs, session data
- useFile() - for tab normalization, file loading
- useSDK() - for session creation
- useLayout() - for tabs API (via split layout)
- usePrompt() - for handleAskAboutSelection
- usePermission() - for permission state
- useCodeComponent() - for code rendering

**CRITICAL**: The Pane component must call `props.onActiveSessionChange(sessionId)` whenever its `activeSessionId` changes. The parent uses this to update `focusedActiveSessionId` for command targeting.

### Step 7: Test single-pane regression
**STOP HERE AND TEST**: Run the app with `bun run --cwd packages/app dev`

Verify:
- [ ] App loads without errors
- [ ] Single pane behavior is identical to before
- [ ] All tabs work (session, file, preview, context)
- [ ] Messages render correctly
- [ ] Scroll works
- [ ] Prompt input works
- [ ] Right panel works
- [ ] Mobile view works
- [ ] Console: zero errors/warnings

**Do not proceed to Phase 3 until this passes.**

---

## Phase 3: Wire Up Splitting

### Step 8: Create split-container.tsx
**Path**: `packages/app/src/components/split-pane/split-container.tsx`

Based on `dev_poc/src/split-container.tsx` but with these changes:
- Use existing `ResizeHandle` from `packages/ui` instead of custom mouse handling
- Wrap in single `DragDropProvider` with `DragDropSensors` and `DragOverlay`
- Use `createResizeObserver` from `@solid-primitives/resize-observer` for width

### Step 9: Refactor session.tsx
Replace the session panel div (L1127-1416) with `<SplitContainer>`.

**Parent keeps**:
- Command registrations (L584-813) - rewire `activeSessionId` references to `focusedActiveSessionId`
- `local.agent.set()` / `local.model.set()` effect (L464-474) - only fire from focused pane
- Global keyboard handler (L815-832)
- Prompt input (L1418-1454) - `activeSessionId` prop becomes `focusedActiveSessionId`
- Right panel (L1467-1718) - completely unchanged
- Git init dialog (L385-441)
- Terminal effects (L533-551)

**New parent state**:
```ts
const splitLayout = createMemo(() => layout.split(sessionKey()))
const [focusedSessionId, setFocusedSessionId] = createSignal<string | undefined>()
const focusedActiveSessionId = createMemo(() => focusedSessionId() ?? params.id)
```

### Step 10: Enable split button and keyboard shortcut
- Split button in PaneTabBar calls `props.onSplit()`
- Register `Mod+\` in command context to toggle split on focused pane

**Checkpoint**: Test split/unsplit functionality.

---

## Phase 4: Polish

### Step 11: Cross-pane tab drag
In SplitContainer's `onDragEnd`:
1. Determine which pane the draggable came from
2. Determine which pane the droppable belongs to
3. If different panes: call `moveTab()` utility
4. If same pane: reorder within pane (existing sort logic)

### Step 12: Auto-split triggers
In pane.tsx, when a preview tab opens (localhost URL detection effect):
1. Check if currently single-pane
2. If yes, call `onSplit(previewTab)` to auto-split with preview in new pane

### Step 13: Animations
Add CSS transitions:
- `.split-pane-enter`: `transition-[width] 200ms ease-out`
- `.split-pane-exit`: surviving pane transitions to 100%
- Use `overflow: hidden` during animation

### Step 14: Focus indicators
Add visual feedback:
- Focused pane: `border-color: var(--border-strong-base)`
- Unfocused pane: `border-color: var(--border-weak-base)` (or transparent)

---

## Verification Checklist

### Type Safety
- [ ] `bun turbo typecheck` passes with zero errors

### Functional
- [ ] Single pane: identical to current behavior (regression test)
- [ ] Split button splits pane
- [ ] Mod+\ toggles split
- [ ] Resize handle works
- [ ] Close last tab collapses pane
- [ ] Prompt targets focused pane's session
- [ ] Commands (undo/redo/compact) target focused pane's session
- [ ] Tab drag between panes works
- [ ] Auto-split on PRD/ERD preview
- [ ] Mobile: no split UI
- [ ] Refresh: layout persisted

### Performance
- [ ] Single-pane: no extra DOM overhead
- [ ] Split: smooth animations, no jank

### Console
- [ ] Zero errors
- [ ] Zero warnings

---

## Critical File Paths

| File | Action | Lines affected |
|------|--------|---------------|
| `packages/app/src/components/split-pane/types.ts` | CREATE | ~25 lines |
| `packages/app/src/components/split-pane/utils.ts` | CREATE | ~210 lines (from PoC) |
| `packages/app/src/components/split-pane/split-container.tsx` | CREATE | ~130 lines |
| `packages/app/src/components/split-pane/pane.tsx` | CREATE | ~600 lines (extracted from session.tsx) |
| `packages/app/src/components/split-pane/pane-tab-bar.tsx` | CREATE | ~120 lines (extracted from session.tsx) |
| `packages/app/src/components/split-pane/index.ts` | CREATE | ~6 lines |
| `packages/app/src/context/layout.tsx` | MODIFY | +80 lines (split API, migration) |
| `packages/app/src/pages/session.tsx` | MODIFY | -600 lines moved to pane.tsx, +50 lines for SplitContainer integration |

## Existing Code to Reuse

| What | Path | How |
|------|------|-----|
| ResizeHandle | `packages/ui/src/components/resize-handle.tsx` | Between split panes |
| Tabs | `packages/ui/src/components/tabs.tsx` | Per-pane tab bar |
| SortableTab, SortableSessionTab | `packages/app/src/components/session/` | Tab rendering in PaneTabBar |
| persisted() | `packages/app/src/utils/persist.ts` | Layout persistence |
| createAutoScroll | `packages/ui/src/hooks/` | Per-pane scroll management |
| ConstrainDragYAxis | `packages/app/src/utils/solid-dnd.tsx` | Tab drag constraint |
