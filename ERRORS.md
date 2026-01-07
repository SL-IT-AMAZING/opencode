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
