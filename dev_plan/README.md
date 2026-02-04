# Split-Screen Tab System - Development Plan

## Quick Start (for implementing AI)

This folder contains everything needed to implement a split-screen tab system in the OpenCode web app (`packages/app`). Read documents in this order:

1. `requirements.md` - What to build
2. `component-specs.md` - How each component works
3. `test-cases.md` - What to test
4. `poc-results.md` - What's been verified (with working code in `../dev_poc/`)
5. `implementation-guide.md` - Step-by-step implementation instructions

## Architecture Overview

```
packages/app/src/
├── components/split-pane/       # NEW - Split pane system
│   ├── types.ts                 # PaneLeaf, PaneSplit, PaneNode types
│   ├── utils.ts                 # Pure tree manipulation (proven in PoC)
│   ├── split-container.tsx      # Recursive renderer (proven in PoC)
│   ├── pane.tsx                 # Single pane: tab bar + content
│   ├── pane-tab-bar.tsx         # Chrome-style tab bar per pane
│   └── index.ts                 # Barrel exports
├── context/layout.tsx           # MODIFY - Add splitLayout store
└── pages/session.tsx            # MODIFY - Use SplitContainer
```

## Tech Stack

- SolidJS + SolidJS Store
- Tailwind CSS v4
- @thisbeyond/solid-dnd v0.7.5
- Existing ResizeHandle component (packages/ui)
- Existing Tabs component (packages/ui)
