# Frontend Optimization Plan

**Status**: Draft
**Risk Profile**: Conservative (one extraction per step, typecheck after each)
**Constraint**: Zero behavior changes. Zero new features. Pure structural refactoring.
**Verification**: `bun turbo typecheck` after every step.

---

## Phase 1: Extract Inline Sub-Components from God Components

**Goal**: Break `pages/layout.tsx` (1,112 lines) and `pages/session.tsx` (1,044 lines) into smaller, focused files by extracting inline component definitions.

**Risk**: Low. Moving JSX into separate files with the same props. No logic changes.

**SolidJS Gotcha**: Components in SolidJS are just functions. No hooks rules to worry about. Context (`useX()`) calls must remain inside the component tree where the provider is mounted — all these components are rendered inside the provider pyramid, so context access remains valid after extraction.

### Step 1.1: Create `components/sidebar/` directory

```
mkdir packages/app/src/components/sidebar/
```

### Step 1.2: Extract `ProjectAvatar` from `pages/layout.tsx`

- **Source**: `pages/layout.tsx` lines 544-586 (the `ProjectAvatar` const)
- **Target**: `components/sidebar/project-avatar.tsx`
- **Exports**: `ProjectAvatar` (named export)
- **Dependencies**: `useNotification` (context), `getAvatarColors` (from `context/layout`), `Avatar` (from `@anyon/ui`), `Icon` (from `@anyon/ui`), `getFilename` (from `@anyon/util`), `LocalProject` type (from `context/layout`)
- **Props interface**: Already inline — extract as-is: `{ project: LocalProject; class?: string; expandable?: boolean; notify?: boolean }`
- **In `pages/layout.tsx`**: Replace inline definition with `import { ProjectAvatar } from "@/components/sidebar/project-avatar"`

### Step 1.3: Extract `ProjectVisual` from `pages/layout.tsx`

- **Source**: `pages/layout.tsx` lines 588-619
- **Target**: `components/sidebar/project-visual.tsx`
- **Exports**: `ProjectVisual` (named export)
- **Dependencies**: `useLayout` (context), `useParams` (router), `Button` / `Avatar` (UI), `ProjectAvatar` (from step 1.2), `base64Decode`, `LocalProject` type
- **Needs from parent**: `navigateToProject` function — pass as prop
- **Props**: `{ project: LocalProject; navigateToProject: (dir: string) => void }`
- **In `pages/layout.tsx`**: Replace with import, pass `navigateToProject` as prop

### Step 1.4: Extract `SessionItem` from `pages/layout.tsx`

- **Source**: `pages/layout.tsx` lines 621-721
- **Target**: `components/sidebar/session-item.tsx`
- **Exports**: `SessionItem` (named export)
- **Dependencies**: `useNotification`, `useGlobalSync`, `useDialog`, `A` (router), `Tooltip`, `TooltipKeybind`, `IconButton`, `Switch`, `Match`, `Spinner`, `DiffChanges`, `DateTime` (luxon), `Session` type, `LocalProject` type
- **Needs from parent**: `archiveSession` function, `command` (for keybind) — pass as props
- **Props**: `{ session: Session; slug: string; project: LocalProject; mobile?: boolean; onArchive: (session: Session) => void; archiveKeybind?: string }`

### Step 1.5: Extract `SortableProject` from `pages/layout.tsx`

- **Source**: `pages/layout.tsx` lines 723-862
- **Target**: `components/sidebar/sortable-project.tsx`
- **Exports**: `SortableProject` (named export)
- **Dependencies**: `useLayout`, `useGlobalSync`, `useDialog`, `useCommand`, `useNotification`, `createSortable`, `Collapsible`, `Button`, `DropdownMenu`, `IconButton`, `TooltipKeybind`, `A`, `ProjectAvatar` (step 1.2), `ProjectVisual` (step 1.3), `SessionItem` (step 1.4), `DialogEditProject`, `LocalProject` type, `Session` type
- **Needs from parent**: `navigateToProject`, `closeProject`, `sortSessions` — pass as props
- **Props**: `{ project: LocalProject; mobile?: boolean; navigateToProject: (dir: string) => void; closeProject: (dir: string) => void; sortSessions: (a: Session, b: Session) => number }`
- **Note**: This is the largest extraction (~140 lines). The component uses `useGlobalSync().child()` internally which is fine since it's still within the provider tree.

### Step 1.6: Extract `SidebarContent` from `pages/layout.tsx`

- **Source**: `pages/layout.tsx` lines 877-1033
- **Target**: `components/sidebar/sidebar-content.tsx`
- **Exports**: `SidebarContent` (named export)
- **Dependencies**: `useLayout`, `useCommand`, `useDialog`, `useProviders`, `DragDropProvider`, `DragDropSensors`, `DragOverlay`, `SortableProvider`, `closestCenter`, `SortableProject` (step 1.5), `Button`, `Tooltip`, `Icon`, `Mark`, `FullLogo`, `A`, `ResizeHandle`, `ConstrainDragXAxis`, `DialogSelectProvider`, `DialogSelectServer`, `DialogSettings`
- **Needs from parent**: `chooseProject`, `connectProvider`, `handleDragStart/Over/End`, `scrollContainerRef` — pass as props
- **This is the big one**. ~156 lines of JSX. Consider whether to pass callbacks or move some logic into the component.

### Step 1.7: Extract `SessionReviewTab` from `pages/session.tsx`

- **Source**: `pages/session.tsx` lines 46-133
- **Target**: `components/session-review-tab.tsx`
- **Exports**: `SessionReviewTab` (named export)
- **Dependencies**: `SessionReview` (from `@anyon/ui`), `createEffect`, `on`, `onCleanup`
- **Already self-contained** — has its own props interface (`SessionReviewTabProps`). Simplest extraction.

### Step 1.8: Extract right panel rendering from `pages/session.tsx`

- **Source**: `pages/session.tsx` lines 787-1039 (the `{/* Right panel */}` section)
- **Target**: `components/right-panel.tsx`
- **Exports**: `RightPanel` (named export)
- **Dependencies**: `useLayout`, `useCommand`, `useTerminal`, `useDialog`, `Tabs`, `ResizeHandle`, `FileExplorerPanel`, `CollabTimeline`, `CollabTeam`, `QuickActionBar`, `Terminal`, `SortableTerminalTab`, `DragDropProvider`, etc.
- **Props**: `{ activeSessionId: string | undefined; openTab: (value: string) => void; splitLayout: ReturnType<...>; isDesktop: () => boolean }`
- **Note**: This is ~250 lines of JSX. The terminal DnD handlers should move with it.

**After Phase 1**: `pages/layout.tsx` drops from ~1,112 to ~500 lines. `pages/session.tsx` drops from ~1,044 to ~700 lines.

---

## Phase 2: Split God Context (`context/layout.tsx`)

**Goal**: Break the 733-line layout context into focused, single-responsibility contexts.

**Risk**: Medium. Changing the context shape means updating every consumer. Must be done carefully.

**SolidJS Gotcha**: `createSimpleContext` (from `@anyon/ui/context`) bundles context creation. Each new context needs its own `createSimpleContext` call. The persisted store is shared — splitting means each sub-context either gets its own persisted key or they share a store with scoped access.

**Strategy**: Keep the persisted store as-is (single `layout.v8` key) but expose it through focused contexts that each read/write their own slice. This avoids data migration.

### Step 2.1: Extract `context/panel-state.tsx` — Panel State Context

- **What moves**: `sidebar`, `rightPanel`, `mobileSidebar`, `fileExplorer`, `review`, `session` (width), `terminal` (global fallback)
- **Lines**: ~160 lines of boilerplate open/close/toggle/resize methods
- **These are all pure UI state** — no business logic, no dependencies on SDK/sync
- **Approach**: Create a `PanelStateProvider` that reads/writes the panel-related keys from the persisted store
- **Consumers**: `pages/layout.tsx`, `pages/session.tsx`, any component checking `layout.sidebar.opened()` etc.
- **Update import**: `useLayout().sidebar` becomes `usePanelState().sidebar` (or keep as `useLayout()` re-exporting)

### Step 2.2: Extract `context/split-layout.tsx` — Split Pane Context

- **What moves**: The `split()` method and all its sub-methods (lines 363-511, ~148 lines)
- **Dependencies**: Split pane utilities from `components/split-pane/utils`
- **These are isolated** — `split()` only reads/writes `store.splitLayout`
- **Consumers**: `pages/session.tsx`

### Step 2.3: Extract `context/session-tabs.tsx` — Session Tabs Context

- **What moves**: `tabs()`, `sessions()`, `view()`, `closeSessionTab()` methods (lines 512-730, ~218 lines)
- **Dependencies**: Only the store
- **Consumers**: `pages/session.tsx`, `components/prompt-input.tsx`

### Step 2.4: Keep `context/layout.tsx` as the slim orchestrator

- **What remains**: `projects` (list/open/close/expand/collapse/move), `ready`, `workflow`, and the enrichment/colorization logic (~200 lines)
- **Re-export convenience**: `useLayout()` can re-export sub-contexts for backward compatibility, OR update consumers directly

**Decision Point**: Re-exporting maintains backward compatibility but adds a layer. Direct imports are cleaner but require updating every consumer. **Recommendation**: Direct imports — it's more honest and the search-replace is mechanical.

---

## Phase 3: Break Up `pages/session.tsx` Further

**Goal**: After Phase 1 (right panel extracted) and Phase 2 (contexts split), the remaining session.tsx should be ~450 lines. Further split command registration and side-effect logic.

**Risk**: Low-Medium. Moving effects and command registrations.

### Step 3.1: Extract `hooks/use-session-commands.ts`

- **Source**: `pages/session.tsx` lines 437-672 (the `command.register()` call)
- **Target**: `hooks/use-session-commands.ts`
- **Exports**: `useSessionCommands(opts: { ... })` — a hook that registers commands
- **Props needed**: `activeSessionId`, `splitLayout`, `isDesktop`, `terminal`, `dialog`, `local`, `sync`, `sdk`, `prompt`, `permission`, `layout`, `navigate`, `params`
- **Note**: This is 235 lines of pure command definitions. A clean extraction.

### Step 3.2: Extract git-init dialog logic into `hooks/use-git-init.ts`

- **Source**: `pages/session.tsx` lines 329-415 (git init auto-dialog)
- **Target**: `hooks/use-git-init.ts`
- **Exports**: `useGitInit(opts: { directory, server, sdk, terminal, dialog })`
- **Self-contained** — reads localStorage, checks project status, shows dialog
- **~87 lines**

### Step 3.3: Extract workflow event handling into `hooks/use-workflow-events.ts`

- **Source**: `pages/session.tsx` lines 244-290
- **Target**: `hooks/use-workflow-events.ts`
- **Exports**: `useWorkflowEvents(opts: { sdk, splitLayout, focusedActiveSessionId, file, isDesktop })`
- **~47 lines**

**After Phase 3**: `pages/session.tsx` drops to ~300 lines — route setup, memo declarations, and JSX rendering.

---

## Phase 4: Break Up `components/prompt-input.tsx`

**Goal**: Decompose the 1,972-line monster into focused sub-components.

**Risk**: Medium. This is a complex, interactive component with internal state. Extractions must preserve the internal store and signal sharing.

**Approach**: Read the full file to identify logical sections, then extract them. Based on initial scan:

### Step 4.1: Full analysis of prompt-input.tsx structure

- Read the entire file end-to-end
- Map out: store shape, all internal functions, JSX sections
- Identify natural boundaries for extraction
- **Output**: Updated plan with specific extraction targets

### Step 4.2 (tentative): Extract slash command logic

- The slash command popover, matching, and execution
- `SlashCommand` interface, `PLACEHOLDERS` array, popover rendering
- Target: `components/prompt/slash-commands.tsx`

### Step 4.3 (tentative): Extract file attachment handling

- Image/file upload, drag-and-drop, attachment rendering
- Target: `components/prompt/attachments.tsx`

### Step 4.4 (tentative): Extract model/agent selector UI

- Model picker, agent selector, variant cycling
- Target: `components/prompt/model-selector.tsx`

### Step 4.5 (tentative): Extract the editor/contenteditable core

- The actual text input, cursor management, paste handling
- Target: `components/prompt/editor.tsx`

**Note**: Steps 4.2-4.5 are tentative. Step 4.1 must happen first to identify the real boundaries. The 1,972 lines may have different logical seams than expected.

---

## Phase 5: Provider Pyramid Flattening

**Goal**: Make `app.tsx` less of a 15-deep pyramid without changing behavior.

**Risk**: Low. Pure cosmetic restructuring of provider nesting.

### Step 5.1: Combine `DiffComponentProvider` + `CodeComponentProvider`

- **Source**: `app.tsx` lines 90-91, plus `@anyon/ui/context/diff.tsx` (10 lines) and `@anyon/ui/context/code.tsx` (10 lines)
- **Target**: Create `@anyon/ui/context/renderers.tsx` that provides both Diff and Code components in a single provider
- **Or simpler**: Just create a `RenderProviders` wrapper component in app.tsx that combines them
- **Saves**: 2 nesting levels

### Step 5.2: Group global providers into `GlobalProviders` component

- **Create**: `components/global-providers.tsx`
- **Combines**: `MetaProvider`, `ThemeProvider`, `ErrorBoundary`, `DialogProvider`, `LanguageProvider`, `LanguageCheck`, `MarkedProvider`, `DiffComponentProvider`, `CodeComponentProvider`
- **These are all app-wide**, order-independent (except ErrorBoundary should be high), and never conditionally rendered
- **In `app.tsx`**: Replace the 9-deep nesting with `<GlobalProviders>{children}</GlobalProviders>`

### Step 5.3: Group server-dependent providers into `ServerProviders` component

- **Create**: `components/server-providers.tsx`
- **Combines**: `ServerProvider`, `ServerKey`, `GlobalSDKProvider`, `GlobalSyncProvider`
- **These have a strict order** (SDK needs Server, Sync needs SDK)
- **In `app.tsx`**: Replace 4-deep nesting with `<ServerProviders>{children}</ServerProviders>`

### Step 5.4: Group router-level providers into `RouterProviders` component

- **Create**: `components/router-providers.tsx`
- **Combines**: `PermissionProvider`, `LayoutProvider` (or sub-contexts from Phase 2), `NotificationProvider`, `CommandProvider`
- **In `app.tsx`**: Use as the Router root component

**After Phase 5**: `app.tsx` reads as:

```tsx
<GlobalProviders>
  <ServerProviders>
    <Router root={RouterProviders}>
      <Route ... />
    </Router>
  </ServerProviders>
</GlobalProviders>
```

~3 levels deep instead of 18.

---

## Phase 6: Deduplication

**Goal**: Remove duplicated logic.

**Risk**: Low. Extract shared function, import from both places.

### Step 6.1: Extract `chooseProject` into `utils/choose-project.ts`

- **Duplicated in**: `pages/layout.tsx` (~lines 466-490) and `pages/home.tsx` (~lines 32-55)
- **Target**: `utils/choose-project.ts`
- **Exports**: `chooseProject(opts: { platform, server, dialog, onResult })`
- **Both callers**: Import and call with their specific `onResult` handler
- **~25 lines saved**, plus single source of truth

### Step 6.2: Audit for other duplications

- After Phases 1-5 are complete, scan for any remaining duplicated patterns
- Common candidates: navigation helpers, session sorting, base64 encode/decode wrappers

---

## Execution Order & Dependencies

```
Phase 1 (no deps)
  ├── 1.7 SessionReviewTab (independent, easiest)
  ├── 1.2 ProjectAvatar (independent)
  ├── 1.3 ProjectVisual (needs 1.2)
  ├── 1.4 SessionItem (independent)
  ├── 1.5 SortableProject (needs 1.2, 1.3, 1.4)
  ├── 1.6 SidebarContent (needs 1.5)
  └── 1.8 RightPanel (independent)

Phase 2 (after Phase 1)
  ├── 2.1 PanelState (independent)
  ├── 2.2 SplitLayout (independent)
  ├── 2.3 SessionTabs (independent)
  └── 2.4 Slim layout.tsx (needs 2.1-2.3)

Phase 3 (after Phase 1.8 + Phase 2)
  ├── 3.1 useSessionCommands (independent)
  ├── 3.2 useGitInit (independent)
  └── 3.3 useWorkflowEvents (independent)

Phase 4 (after Phase 3, independent of Phase 2)
  ├── 4.1 Analysis (must be first)
  └── 4.2-4.5 (depends on 4.1 findings)

Phase 5 (after Phase 2)
  ├── 5.1 Combine renderers (independent)
  ├── 5.2 GlobalProviders (needs 5.1)
  ├── 5.3 ServerProviders (independent)
  └── 5.4 RouterProviders (needs Phase 2)

Phase 6 (anytime after Phase 1)
  ├── 6.1 chooseProject (independent)
  └── 6.2 Audit (after all phases)
```

## Expected Outcome

| File                          | Before             | After                             |
| ----------------------------- | ------------------ | --------------------------------- |
| `app.tsx`                     | 143 lines, 18-deep | ~40 lines, 3-deep                 |
| `pages/layout.tsx`            | 1,112 lines        | ~300 lines                        |
| `pages/session.tsx`           | 1,044 lines        | ~300 lines                        |
| `context/layout.tsx`          | 733 lines          | ~200 lines                        |
| `components/prompt-input.tsx` | 1,972 lines        | ~500 lines (+ 3-4 sub-components) |
| **Total lines moved**         | —                  | ~3,500 lines redistributed        |
| **New files created**         | —                  | ~15-18 files                      |
| **Behavior changes**          | —                  | Zero                              |
