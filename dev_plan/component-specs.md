# Component Specifications

## COMP-001: types.ts
**Status**: verified (POC-001)
**Path**: `packages/app/src/components/split-pane/types.ts`

### Purpose
Type definitions for the split pane tree structure.

### Types
```ts
type PaneLeaf = { type: "leaf"; id: string; tabs: string[]; active?: string }
type PaneSplit = { type: "split"; id: string; direction: "horizontal"; ratio: number; children: [PaneNode, PaneNode] }
type PaneNode = PaneLeaf | PaneSplit
type SplitLayout = { root: PaneNode; focusedPane?: string }
```

### Constraints
- `ratio` must be 0.1-0.9
- `children` must be exactly 2 elements
- `tabs` are string identifiers matching existing tab format ("session-{id}", "file://{path}", "preview://{url}", "context", "review")

---

## COMP-002: utils.ts
**Status**: verified (POC-001) - 60 tests, 100% coverage
**Path**: `packages/app/src/components/split-pane/utils.ts`
**PoC**: `dev_poc/src/utils.ts`

### Purpose
Pure, immutable tree manipulation functions. No SolidJS dependencies.

### Functions

| Function | Input | Output | Notes |
|----------|-------|--------|-------|
| `generateId()` | - | `string` | Sequential "pane-N" IDs |
| `isLeaf(node)` | PaneNode | boolean (type guard) | |
| `isSplit(node)` | PaneNode | boolean (type guard) | |
| `countLeaves(node)` | PaneNode | number | For max-pane check |
| `findPane(root, id)` | PaneNode, string | PaneLeaf \| undefined | |
| `findParent(root, id)` | PaneNode, string | PaneSplit \| undefined | |
| `splitPane(root, paneId, tabToMove?)` | PaneNode, string, string? | PaneNode | Immutable - returns new tree |
| `removePane(root, paneId)` | PaneNode, string | PaneNode \| undefined | undefined if root removed |
| `updateRatio(root, splitId, ratio)` | PaneNode, string, number | PaneNode | Clamps 0.1-0.9 |
| `moveTab(root, from, to, tab)` | PaneNode, string, string, string | PaneNode | Auto-collapses empty pane |
| `updateLeaf(root, paneId, transform)` | PaneNode, string, fn | PaneNode | |
| `validateTree(node)` | PaneNode | boolean | For persisted state validation |
| `migrateFromTabs(tabs)` | { all: string[]; active?: string } | SplitLayout | Legacy migration |
| `collectPaneIds(node)` | PaneNode | string[] | |

### Constraints
- All tree operations are immutable (return new objects)
- Structural sharing where possible (unchanged subtrees return same references)
- No SolidJS imports

### Edge Cases
- splitPane on non-existent paneId: returns unchanged tree
- removePane on single leaf: returns undefined
- moveTab same pane: returns unchanged tree
- moveTab non-existent tab: returns unchanged tree
- moveTab causing empty source: auto-collapses

---

## COMP-003: SplitContainer
**Status**: verified (POC-002) - 10 tests
**Path**: `packages/app/src/components/split-pane/split-container.tsx`
**PoC**: `dev_poc/src/split-container.tsx`

### Purpose
Recursive renderer for the pane tree. Wraps everything in a single DragDropProvider.

### Props
```ts
interface SplitContainerProps {
  root: PaneNode
  focusedPane?: string
  onFocusPane?: (id: string) => void
  onRatioChange?: (splitId: string, ratio: number) => void
  onSplit?: (paneId: string, tabToMove?: string) => void
  canSplit?: boolean
  isDesktop: boolean
  sessionKey: string
  onActiveSessionChange?: (paneId: string, sessionId: string | undefined) => void
}
```

### States
- Leaf node: renders `<Pane>` component
- Split node: renders two recursive `<SplitContainer>` children with ResizeHandle between

### Constraints
- Must use single DragDropProvider at top level (for cross-pane tab dragging)
- Each pane gets its own SortableProvider
- Uses existing ResizeHandle from packages/ui (not custom)
- Use createResizeObserver for width tracking

### Accessibility
- Resize handle: keyboard accessible (arrow keys to resize)
- Pane focus: click or keyboard tab navigation

---

## COMP-004: Pane
**Status**: draft
**Path**: `packages/app/src/components/split-pane/pane.tsx`

### Purpose
Renders a single pane leaf: tab bar + content. Extracted from session.tsx.

### Props
```ts
interface PaneProps {
  leaf: PaneLeaf
  isFocused: boolean
  onFocus: () => void
  onActiveSessionChange: (sessionId: string | undefined) => void
  onSplit: (tabToMove?: string) => void
  canSplit: boolean
  isDesktop: boolean
  sessionKey: string
}
```

### Internal State (moved from session.tsx)
- `activeSessionId` memo - derived from pane's active tab
- `messages`, `visibleUserMessages`, `diffs`, `status`, `info` - all derived from activeSessionId
- `autoScroll` instance - per-pane scroll management
- `store.expanded` - per-message expansion state
- `store.messageId` - current scroll-spied message
- Tab normalization effects
- Scroll restore effects

### States
| State | Condition | Rendering |
|-------|-----------|-----------|
| Session active | activeTab starts with "session-" | Message list + scroll |
| File active | activeTab starts with "file://" | FileViewer |
| Preview active | activeTab starts with "preview://" | PreviewPane |
| Context active | activeTab === "context" | SessionContextTab |
| No session | no activeSessionId & no file tabs | NewSessionView |

### Constraints
- Prompt input is NOT inside the pane (shared, stays in parent)
- Right panel is NOT inside the pane (stays in parent)
- Must call `onActiveSessionChange` when active session changes
- Must call `onFocus` when clicked

---

## COMP-005: PaneTabBar
**Status**: draft
**Path**: `packages/app/src/components/split-pane/pane-tab-bar.tsx`

### Purpose
Chrome-style tab bar for a single pane. Extracted from session.tsx tab bar.

### Props
```ts
interface PaneTabBarProps {
  tabs: string[]
  active?: string
  onTabClick: (tab: string) => void
  onTabClose: (tab: string) => void
  onTabMove: (tab: string, toIndex: number) => void
  onNewSession: () => void
  onSplit?: (tabToMove?: string) => void
  canSplit?: boolean
  showContextTab?: boolean
  onContextClose?: () => void
}
```

### Features
- Sortable tabs via SortableProvider (inside parent DragDropProvider)
- Split button icon (splits current pane)
- New session button (+)
- Context tab (conditional)
- Tab close buttons

---

## COMP-006: layout.tsx Additions
**Status**: draft
**Path**: `packages/app/src/context/layout.tsx`

### Changes
1. Bump `"layout.v7"` to `"layout.v8"`
2. Add `splitLayout: {} as Record<string, SplitLayout>` to store
3. Add `split(sessionKey)` method
4. Migration logic: convert `sessionTabs[key]` to single-leaf SplitLayout

### API
```ts
split(sessionKey: string) {
  return {
    root: Accessor<PaneNode>,
    focusedPane: Accessor<string | undefined>,
    setFocusedPane(id: string): void,
    splitPane(paneId: string, tabToMove?: string): void,
    unsplitPane(paneId: string): void,
    updateRatio(splitId: string, ratio: number): void,
    pane(paneId: string): {
      tabs: Accessor<string[]>,
      active: Accessor<string | undefined>,
      setActive(tab: string | undefined): void,
      open(tab: string): void,
      close(tab: string): void,
      move(tab: string, toIndex: number): void,
    }
  }
}
```

### Constraints
- Backward compatible: existing `tabs()` API delegates to focused pane
- Migration must handle undefined/null gracefully
- Persisted state validated with `validateTree()` on load
