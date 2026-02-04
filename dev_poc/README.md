# dev_poc - Proof of Concept Tests

Proof-of-concept test suites for OpenCode modules.

## Setup

```bash
cd dev_poc && bun install
```

## Run Tests

```bash
bun run test
```

## Watch Mode

```bash
bun run test:watch
```

## Coverage

```bash
bun run test:coverage
```

Coverage thresholds are set to 100% per file for lines, statements, branches, and functions.

## Structure

```
src/
  types.ts                    # PaneLeaf, PaneSplit, PaneNode, SplitLayout types
  utils.ts                    # Pure tree manipulation functions (100% covered)
  utils.test.ts               # 60 tests for tree utils
  split-container.tsx          # SolidJS recursive split pane renderer
  split-container.test.tsx     # 10 tests for rendering behavior
  cross-pane-dnd.test.tsx      # 5 tests for multi-SortableProvider DnD

tests/
  workflow.test.ts             # Workflow module unit tests (TC-WF-001 through TC-WF-005)
```

## Workflow Test Cases

Test case definitions are maintained in [`../dev_plan/tests/test-cases.md`](../dev_plan/tests/test-cases.md).

Implemented test cases:

| ID | Description |
|----|-------------|
| TC-WF-001 | Workflow creation returns correct initial state |
| TC-WF-002 | Step advancement moves from prd to userflow |
| TC-WF-003 | Step advancement at last step returns unchanged |
| TC-WF-004 | File-to-step mapping for known files |
| TC-WF-005 | Unknown file mapping returns undefined |

## Split-Pane PoC Results

| PoC | Status | Tests | Coverage |
|-----|--------|-------|----------|
| POC-001: Binary tree utils | VERIFIED | 60/60 | 100% all metrics |
| POC-002: Split pane rendering | VERIFIED | 10/10 | Rendering works |
| POC-003: Cross-pane DnD | VERIFIED | 5/5 | Provider structure works |
