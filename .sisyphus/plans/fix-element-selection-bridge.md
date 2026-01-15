# Fix Element Selection - Bridge Script Not Loading

## Problem

The element selection feature in the preview pane is completely broken:

- React Grab loads from CDN ✓
- Bridge script (`/preview/__opencode_bridge__.js`) returns 404 or doesn't execute ✗
- No `[OpenCode]` logs in iframe console
- Element selection and refresh don't work
- No visual feedback when clicking cursor button

## Root Cause: Relative Bridge Script URL

The injection uses a relative script URL:

```html
<script src="/preview/__opencode_bridge__.js"></script>
```

This fails because:

1. **For file previews**: The browser resolves `/preview/__opencode_bridge__.js` relative to the iframe's origin. This _should_ work, but if there's any issue with the route or CSP, the separate file doesn't load.

2. **For proxied localhost** (the real problem): The request goes to the **wrong server**. When previewing `http://localhost:3000`, the browser sends `/preview/__opencode_bridge__.js` to port 3000 (the dev server), not to OpenCode's server. The dev server returns 404.

## Solution: Inline the Bridge Script

Instead of loading the bridge as a separate file, inline it directly in the injected HTML.

This eliminates:

- Path resolution issues
- Extra network request
- CSP blocking external scripts from `/preview/`
- The proxy routing problem entirely

---

## Risk Analysis (from Metis)

### Key Risks Identified

| Risk                                     | Severity | Likelihood | Mitigation                                                    |
| ---------------------------------------- | -------- | ---------- | ------------------------------------------------------------- |
| **CSP HTTP Headers Block Inline Script** | Medium   | Medium     | Strip `Content-Security-Policy` response header in `proxy.ts` |
| **CDN Unavailable (unpkg)**              | High     | Low        | Consider version pinning for stability                        |
| **React Grab API Changes**               | Medium   | Low        | Pin to specific version                                       |

### Hidden Requirements Found

1. **CSP HTTP Headers**: The `stripCSP` function only removes `<meta>` CSP tags, NOT `Content-Security-Policy` HTTP headers. For proxied localhost apps with CSP headers, inline scripts would still be blocked.

2. **textContent forwarding**: The plan adds `textContent` to element data, but `preview-pane.tsx` doesn't forward it to `prompt.context.add()`. Need to update frontend.

3. **Ready acknowledgment**: Consider having bridge post `opencode:bridge-ready` so parent knows iframe is ready.

---

## Implementation

### File 1: `packages/opencode/src/server/preview.ts`

#### Changes:

1. **Replace `REACT_GRAB_INJECTION`** with inline script (merge `BRIDGE_JS` into it)
2. **Remove** the `BRIDGE_PATH` constant (line 4)
3. **Remove** the `BRIDGE_JS` constant (lines 12-64)
4. **Remove** the bridge file handler in `PreviewRoute` (lines 127-131)

#### New `REACT_GRAB_INJECTION`:

```typescript
export const REACT_GRAB_INJECTION = `
<script src="https://unpkg.com/react-grab/dist/index.global.js"></script>
<script>
(function() {
  if (window.__opencode_bridge_initialized__) return;
  window.__opencode_bridge_initialized__ = true;

  var DEBUG = false; // Set to true for debugging
  var attempts = 0;
  var maxAttempts = 50;

  function log() {
    if (DEBUG) console.log.apply(console, ['[OpenCode]'].concat(Array.prototype.slice.call(arguments)));
  }

  function setupBridge() {
    var api = window.ReactGrab.init();
    log('Bridge initialized');

    // Notify parent that bridge is ready
    window.parent.postMessage({ type: 'opencode:bridge-ready' }, '*');

    window.addEventListener('message', function(e) {
      if (e.source !== window.parent) return;
      if (e.data && e.data.type === 'opencode:element-mode') {
        if (e.data.enabled) {
          api.activate();
          log('Element mode activated');
        } else {
          api.deactivate();
          log('Element mode deactivated');
        }
      }
    });

    api.registerPlugin({
      name: 'opencode-bridge',
      hooks: {
        onElementSelect: function(element) {
          log('Element selected:', element.tagName);
          window.parent.postMessage({
            type: 'opencode:element-select',
            data: {
              tagName: element.tagName,
              className: element.className,
              id: element.id,
              textContent: element.textContent ? element.textContent.substring(0, 200).trim() : '',
              html: element.outerHTML ? element.outerHTML.substring(0, 1000) : ''
            }
          }, '*');
        }
      }
    });
  }

  function waitForReactGrab() {
    if (window.ReactGrab && window.ReactGrab.init) {
      setupBridge();
      return;
    }
    if (attempts >= maxAttempts) {
      console.warn('[OpenCode] react-grab failed to load after ' + maxAttempts + ' attempts');
      window.parent.postMessage({ type: 'opencode:bridge-error', error: 'react-grab-timeout' }, '*');
      return;
    }
    attempts++;
    setTimeout(waitForReactGrab, 100);
  }

  waitForReactGrab();
})();
</script>
`
```

### File 2: `packages/opencode/src/server/proxy.ts`

#### Changes:

Strip `Content-Security-Policy` HTTP headers from proxied responses in **both** the HTML path (lines 44-56) and the non-HTML passthrough path (lines 60-70). CSP headers on any response type can affect the iframe's security context.

**In HTML response block (after line 49, before setting content-type):**

```typescript
responseHeaders.delete("content-security-policy")
responseHeaders.delete("content-security-policy-report-only")
```

**In non-HTML passthrough block (after line 65, before setting CORS):**

```typescript
passthroughHeaders.delete("content-security-policy")
passthroughHeaders.delete("content-security-policy-report-only")
```

### File 3: `packages/app/src/components/preview/preview-pane.tsx`

#### Changes:

Add `textContent` to the context.add call (lines 106-112):

```typescript
prompt.context.add({
  type: "element",
  tagName: event.data.data.tagName,
  className: event.data.data.className,
  id: event.data.data.id,
  textContent: event.data.data.textContent, // ADD THIS
  html: event.data.data.html,
})
```

---

## Files to Modify

| File                                                   | Change                                              |
| ------------------------------------------------------ | --------------------------------------------------- |
| `packages/opencode/src/server/preview.ts`              | Inline bridge script, remove separate file handling |
| `packages/opencode/src/server/proxy.ts`                | Strip CSP HTTP headers from proxied responses       |
| `packages/app/src/components/preview/preview-pane.tsx` | Forward `textContent` to context                    |

---

## Enhancements Included

1. **Duplicate initialization guard**: `window.__opencode_bridge_initialized__` prevents double-init from HMR
2. **Conditional debug logging**: `DEBUG` flag (default false) controls logging
3. **`textContent`**: Added to element data for richer context (buttons, links, etc.)
4. **Ready acknowledgment**: Bridge posts `opencode:bridge-ready` when initialized
5. **Error reporting**: Bridge posts `opencode:bridge-error` if react-grab fails to load
6. **CSP header stripping**: Proxy removes CSP headers that would block inline scripts

---

## Verification

1. Restart dev server: `bun dev`
2. Preview an HTML file
3. Open DevTools Console (select iframe context)
4. Set `DEBUG = true` in bridge script if needed for debugging
5. Click cursor button → button turns blue
6. Hover elements → should highlight
7. Click element → element info appears in prompt context
8. Test with proxied localhost app that has CSP headers

---

## Rollback

If issues arise, revert to separate file approach by restoring the `BRIDGE_PATH`, `BRIDGE_JS` constants and the route handler.

---

## Future Considerations

1. **Version pin react-grab**: Consider `https://unpkg.com/react-grab@X.Y.Z/dist/index.global.js` for stability
2. **Vendor react-grab**: Bundle locally to eliminate CDN dependency
3. **UI feedback for errors**: Handle `opencode:bridge-error` to show user feedback
4. **Ready state handling**: The `opencode:bridge-ready` message is sent but not currently handled in the frontend. Could add a handler in `preview-pane.tsx` to track readiness state and disable the cursor button until the bridge is ready. This is a UX enhancement, not required for the core fix.
