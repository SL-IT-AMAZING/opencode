# PRD: Embedded Browser Preview for OpenCode IDE

## Introduction

Implement an embedded web browser/preview feature that opens HTML files or localhost URLs in a new tab inside the IDE, similar to VS Code's Live Preview extension. This allows developers to preview their web content without leaving the IDE.

**Platform**: Desktop-only (Tauri app)

---

## Goals

- Enable users to preview HTML files directly within the IDE as a tab
- Support localhost URLs (e.g., `http://localhost:3000`) for dev server previews
- Provide live reload when HTML/CSS/JS files change
- Maintain seamless tab switching between sessions, files, and previews

---

## User Stories

### US-001: Add Preview Tab Helpers to File Context
**Description:** As a developer, I want preview tab encoding/decoding functions so that the tab system can recognize and handle preview tabs.

**File:** `packages/app/src/context/file.tsx`

**Acceptance Criteria:**
- [x] Add `previewTab(input: string)` function that returns `preview://url:<url>` for http URLs or `preview://file:<path>` for file paths
- [x] Add `previewFromTab(tabValue: string)` function that parses preview tabs and returns `{ type: "url" | "file", value: string }` or `null`
- [x] Add `isPreviewTab(tabValue: string)` function that returns boolean
- [x] Export all three functions from the file context
- [x] Typecheck passes

---

### US-002: Update Tab Filtering for Preview Tabs
**Description:** As a user, I want preview tabs to appear in the tab bar so that I can switch between previews and other tabs.

**File:** `packages/app/src/pages/session.tsx`

**Acceptance Criteria:**
- [x] Update `allTabs` filter (~line 787) to include tabs starting with `preview://`
- [x] Add `activePreviewTab` memo that returns parsed preview info when active tab is a preview
- [x] Typecheck passes

---

### US-003: Fix Content Gating with Switch
**Description:** As a user, I want only one content type (preview, file, or session) to render at a time so that views don't overlap.

**File:** `packages/app/src/pages/session.tsx`

**Acceptance Criteria:**
- [ ] Replace existing Show blocks (~line 1162-1170) with a Switch/Match structure
- [ ] First Match: render PreviewPane when `activePreviewTab()` is truthy
- [ ] Second Match: render FileViewer when `activeFileTab()` is truthy
- [ ] Third Match: render existing session/context content
- [ ] Import PreviewPane component
- [ ] Typecheck passes

---

### US-004: Update SortableTab for Preview Rendering
**Description:** As a user, I want preview tabs to show a globe icon and meaningful label so that I can identify them in the tab bar.

**File:** `packages/app/src/components/session/session-sortable-tab.tsx`

**Acceptance Criteria:**
- [ ] Add `preview` memo using `file.previewFromTab(props.tab)`
- [ ] When tab is a preview: show globe icon (use existing Icon component)
- [ ] For URL previews: display hostname as label
- [ ] For file previews: display filename as label
- [ ] Fallback to existing FileVisual for non-preview tabs
- [ ] Typecheck passes

---

### US-005: Create Preview Toolbar Component
**Description:** As a user, I want a toolbar above the preview with URL display, refresh, and external open buttons.

**File:** `packages/app/src/components/preview/preview-toolbar.tsx` (create)

**Acceptance Criteria:**
- [ ] Create new file at `packages/app/src/components/preview/preview-toolbar.tsx`
- [ ] Component accepts `url: string` and `onRefresh: () => void` props
- [ ] Render readonly input showing current URL
- [ ] Render refresh button that calls `onRefresh`
- [ ] Render "open external" button that uses `platform.shell?.open(url)`
- [ ] Style with dark theme matching IDE (bg-[#252526], border-[#3c3c3c])
- [ ] Typecheck passes

---

### US-006: Create Preview Pane Component
**Description:** As a user, I want an iframe-based preview pane that loads URLs and auto-refreshes on file changes.

**File:** `packages/app/src/components/preview/preview-pane.tsx` (create)

**Acceptance Criteria:**
- [ ] Create new file at `packages/app/src/components/preview/preview-pane.tsx`
- [ ] Component accepts `preview: { type: "url" | "file", value: string }` prop
- [ ] For URL type: use value directly as iframe src
- [ ] For file type: construct URL as `${server.url}/preview/${path}`
- [ ] Use `useServer()` from `@/context/server` for dynamic port
- [ ] Use `useSDK()` from `@/context/sdk` for event listening
- [ ] Listen to `file.watcher.updated` events and trigger reload for HTML/CSS/JS changes
- [ ] Include PreviewToolbar component
- [ ] Render iframe with sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
- [ ] Typecheck passes

---

### US-007: Add Static File Preview Route to Server
**Description:** As a developer, I want the server to serve static files with proper MIME types so that HTML previews load correctly with relative assets.

**File:** `packages/opencode/src/server/server.ts`

**Acceptance Criteria:**
- [ ] Add new route `.get("/preview/*", ...)` after the `/file/status` endpoint
- [ ] Extract relative path from URL and decode it
- [ ] Validate path is within workspace (security check using `path.resolve`)
- [ ] Return 403 for paths outside workspace
- [ ] Return 404 for non-existent files
- [ ] Set correct Content-Type header based on file extension (.html, .css, .js, .png, .jpg, .svg, etc.)
- [ ] Set CORS header `Access-Control-Allow-Origin: *`
- [ ] Stream file content using `Bun.file().stream()`
- [ ] Typecheck passes

---

### US-008: Add Preview Entry Point in File Tree
**Description:** As a user, I want to click a preview icon on HTML files to open them in the preview pane.

**File:** `packages/app/src/components/file-tree.tsx`

**Acceptance Criteria:**
- [ ] Add `isHtmlFile(path)` helper function checking for `.html` or `.htm` extension
- [ ] Add `openPreview(filePath)` handler that creates preview tab and opens it
- [ ] Show preview icon button (eye icon) next to HTML files
- [ ] Clicking icon opens preview tab for that file
- [ ] Typecheck passes
- [ ] Verify changes work in browser: HTML files show preview icon, clicking opens preview tab

---

## Non-Goals

- **External URL support**: Only localhost and workspace files, not arbitrary external websites
- **DevTools integration**: No built-in browser developer tools
- **Web-hosted builds**: Feature is desktop-only due to mixed-content restrictions
- **Navigation within preview**: No back/forward buttons or URL input editing
- **Multiple preview tabs**: Single preview tab at a time is sufficient for v1

---

## Technical Considerations

- **Port Resolution**: Always use `useServer().url` - never hardcode ports
- **Event Pattern**: `sdk.event.listen((e) => { if (e.details.type === "file.watcher.updated") ... })`
- **Tab Parsing**: `preview://type:value` format with dedicated parser
- **CORS**: Set `Access-Control-Allow-Origin: *` on preview routes
- **Security**: Validate paths don't escape workspace via `path.resolve()` check
- **Path-based routing**: `/preview/<path>` allows relative assets to resolve naturally
