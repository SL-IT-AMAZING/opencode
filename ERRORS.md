# Error Documentation

This file documents errors encountered during development.

## Pre-existing Type Errors (unrelated to multi-session tabs feature)

### 1. params.dir undefined error

**File**: `packages/app/src/pages/session.tsx:163`
**Error**: `Argument of type 'string | undefined' is not assignable to parameter of type 'string'`

```tsx
const sessions = createMemo(() => layout.sessions(params.dir))
```

`params.dir` can be `undefined` but `layout.sessions()` expects a `string`.

### 2. Tooltip content prop error

**File**: `packages/app/src/pages/session.tsx:962`
**Error**: `Property 'content' does not exist on type 'IntrinsicAttributes & TooltipProps'`

```tsx
<Tooltip content="New session">
```

The `Tooltip` component may use a different prop name (e.g., `value` instead of `content`).

---

## Fixed Issues

### Multi-session tabs - Messages sent to wrong session

**Date**: 2025-01-07
**Files Modified**:

- `packages/app/src/pages/session.tsx`
- `packages/app/src/components/prompt-input.tsx`
- `packages/app/src/context/layout.tsx`

**Root Cause**: PromptInput used `params.id` (URL) to determine which session to send messages to, instead of the active session tab.

**Fix**: Added `activeSessionId` prop to PromptInput, updated `info`, `status`, and `isNewSession` checks to use the active tab's session ID.

### Tab Compression Issue - ATTEMPT 2 (ACTUAL FIX)

**Date**: 2025-01-07
**Files Modified**:

- `packages/app/src/components/session/session-sortable-tab.tsx`

**Symptom**: Tabs STILL overflow instead of compressing even after overflow-x fix.

**Expected**: All tabs should compress when space runs out, bounded by sidebar (left) and right panel (file explorer/terminal).

**Actual Root Cause**: The sortable wrapper divs (`<div use:sortable>`) didn't have `flex-shrink`, so even though `[data-slot="tabs-trigger-wrapper"]` has `flex-shrink: 1`, the outer wrapper wouldn't shrink.

**Fix**: Added `flex-shrink min-w-0` classes to sortable wrapper divs in both `SortableSessionTab` and `SortableTab` components.

---

### Tab Compression Issue - ATTEMPT 1 (PARTIAL)

**Date**: 2025-01-07
**Files Modified**:

- `packages/ui/src/components/tabs.css`
- `packages/app/src/pages/session.tsx`

**Symptom**: Tabs scrolled horizontally instead of compressing to fit visible screen like Chrome tabs.

**Expected**: All tabs should be visible on screen by compressing, using sidebar and right panel as boundaries.

**Root Cause**: `overflow-x: auto` in tabs.css (line 15) allowed scrolling instead of forcing compression.

**Fix Applied**:

- Changed `overflow-x: auto` to `overflow-x: clip` in tabs.css
- Added `overflow-hidden` class to Tabs.List in session.tsx

**Result**: Prevented scrolling but tabs still overflowed/got clipped instead of compressing.
