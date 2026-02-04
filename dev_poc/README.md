# Split-Screen PoC (dev_poc)

Proof-of-concept tests for the OpenCode split-screen tab system.

## Setup

```bash
cd dev_poc
bun install
```

## Run Tests

```bash
# Run all tests
bun run test

# Run with coverage (100% threshold enforced for .ts files)
bun run test:coverage

# Watch mode
bun run test:watch

# Type check
bun run typecheck
```

## Structure

```
src/
├── types.ts                    # PaneLeaf, PaneSplit, PaneNode, SplitLayout types
├── utils.ts                    # Pure tree manipulation functions (100% covered)
├── utils.test.ts               # 60 tests for tree utils
├── split-container.tsx          # SolidJS recursive split pane renderer
├── split-container.test.tsx     # 10 tests for rendering behavior
└── cross-pane-dnd.test.tsx      # 5 tests for multi-SortableProvider DnD
```

## PoC Results Summary

| PoC | Status | Tests | Coverage |
|-----|--------|-------|----------|
| POC-001: Binary tree utils | VERIFIED | 60/60 | 100% all metrics |
| POC-002: Split pane rendering | VERIFIED | 10/10 | Rendering works |
| POC-003: Cross-pane DnD | VERIFIED | 5/5 | Provider structure works |

## Key Findings

1. **Binary tree model works** - All tree operations (split, remove, move, resize) are immutable and tested
2. **SolidJS recursive rendering works** - SplitContainer component renders nested panes correctly
3. **solid-dnd multi-provider works** - Multiple SortableProviders under one DragDropProvider renders without errors
4. **Full drag simulation needs E2E** - jsdom doesn't support real pointer/layout events; Playwright needed for drag testing
