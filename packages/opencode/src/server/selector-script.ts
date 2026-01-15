/**
 * Selector script that gets injected into preview iframes to enable
 * hover-to-select functionality for component selection.
 *
 * This script:
 * - Shows purple border on hover
 * - Captures click with element data (tagName, id, className, innerHTML, cssSelector)
 * - Sends postMessage to parent with `anyon-component-selected` event
 * - Supports Ctrl+Shift+C (Cmd+Shift+C on Mac) keyboard shortcut
 * - Handles activate/deactivate messages from parent
 */

export const SELECTOR_SCRIPT = `
(function() {
  'use strict';

  function init() {
    console.log('[SelectorScript] Script loaded and initializing...');

    if (!document.body) {
      console.error('[SelectorScript] document.body is null, cannot initialize');
      return;
    }

    var isActive = false;
    var hoverOverlay = null;
    var selectedOverlays = new Map();
    var currentHoveredElement = null;

    var OVERLAY_COLOR = '#7f22fe';
    var OVERLAY_BORDER = '2px solid ' + OVERLAY_COLOR;

    function createOverlay() {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:' + OVERLAY_BORDER + ';background:rgba(127,34,254,0.1);box-sizing:border-box;';
      return overlay;
    }

    function positionOverlay(overlay, element) {
      var rect = element.getBoundingClientRect();
      overlay.style.top = rect.top + 'px';
      overlay.style.left = rect.left + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
    }

    function getCssSelector(element) {
      if (element.id) {
        return '#' + CSS.escape(element.id);
      }

      var parts = [];
      var current = element;

      while (current && current !== document.body && current !== document.documentElement) {
        var selector = current.tagName.toLowerCase();

        if (current.id) {
          selector = '#' + CSS.escape(current.id);
          parts.unshift(selector);
          break;
        }

        if (current.className && typeof current.className === 'string') {
          var classes = current.className.trim().split(/\\s+/).filter(function(c) { return c; });
          if (classes.length > 0) {
            selector += '.' + classes.map(function(c) { return CSS.escape(c); }).join('.');
          }
        }

        var parent = current.parentElement;
        if (parent) {
          var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === current.tagName; });
          if (siblings.length > 1) {
            var index = siblings.indexOf(current) + 1;
            selector += ':nth-of-type(' + index + ')';
          }
        }

        parts.unshift(selector);
        current = parent;
      }

      return parts.join(' > ');
    }

    function getElementData(element) {
      return {
        tagName: element.tagName.toLowerCase(),
        id: element.id || undefined,
        className: element.className && typeof element.className === 'string' ? element.className : undefined,
        html: element.outerHTML.slice(0, 1000),
        cssSelector: getCssSelector(element),
        textContent: (element.textContent || '').slice(0, 200).trim()
      };
    }

    function isOverlayElement(element) {
      return element === hoverOverlay || selectedOverlays.has(element);
    }

    function handleMouseMove(e) {
      if (!isActive) return;

      var target = e.target;
      console.log('[SelectorScript] mousemove on:', target.tagName, target.className);

      if (isOverlayElement(target)) return;

      if (target === currentHoveredElement) return;
      currentHoveredElement = target;

      if (!hoverOverlay) {
        hoverOverlay = createOverlay();
        document.body.appendChild(hoverOverlay);
        console.log('[SelectorScript] Created hover overlay');
      }

      positionOverlay(hoverOverlay, target);
      console.log('[SelectorScript] Positioned overlay at:', hoverOverlay.style.top, hoverOverlay.style.left, hoverOverlay.style.width, hoverOverlay.style.height);
    }

    function handleMouseLeave() {
      if (hoverOverlay) {
        hoverOverlay.remove();
        hoverOverlay = null;
      }
      currentHoveredElement = null;
    }

    function handleClick(e) {
      if (!isActive) return;

      var target = e.target;
      if (isOverlayElement(target)) return;

      e.preventDefault();
      e.stopPropagation();

      var data = getElementData(target);

      window.parent.postMessage({
        type: 'anyon-component-selected',
        data: data
      }, '*');

      // Show selected overlay
      var overlay = createOverlay();
      overlay.style.background = 'rgba(127,34,254,0.2)';
      positionOverlay(overlay, target);
      document.body.appendChild(overlay);
      selectedOverlays.set(overlay, target);

      // Remove hover overlay
      if (hoverOverlay) {
        hoverOverlay.remove();
        hoverOverlay = null;
      }
    }

    function handleKeyDown(e) {
      // Ctrl+Shift+C or Cmd+Shift+C to toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
          return;
        }
        e.preventDefault();
        toggleSelector();
      }

      // Escape to deactivate
      if (e.key === 'Escape' && isActive) {
        deactivate();
      }
    }

    function activate() {
      console.log('[SelectorScript] activate() called, isActive:', isActive);
      if (isActive) return;
      isActive = true;

      // Force crosshair cursor on all elements using a style tag
      var cursorStyle = document.createElement('style');
      cursorStyle.id = 'opencode-cursor-style';
      cursorStyle.textContent = '* { cursor: crosshair !important; }';
      document.head.appendChild(cursorStyle);

      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('mouseleave', handleMouseLeave, true);
      document.addEventListener('click', handleClick, true);
      console.log('[SelectorScript] Selector ACTIVATED - cursor should be crosshair');
    }

    function deactivate() {
      console.log('[SelectorScript] deactivate() called, isActive:', isActive);
      if (!isActive) return;
      isActive = false;

      // Remove cursor style
      var cursorStyle = document.getElementById('opencode-cursor-style');
      if (cursorStyle) cursorStyle.remove();

      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      document.removeEventListener('click', handleClick, true);

      if (hoverOverlay) {
        hoverOverlay.remove();
        hoverOverlay = null;
      }
      currentHoveredElement = null;
      console.log('[SelectorScript] Selector DEACTIVATED');
    }

    function clearOverlays() {
      selectedOverlays.forEach(function(_, overlay) { overlay.remove(); });
      selectedOverlays.clear();
    }

    function toggleSelector() {
      if (isActive) {
        deactivate();
        window.parent.postMessage({ type: 'anyon-component-selector-deactivated' }, '*');
      } else {
        activate();
        window.parent.postMessage({ type: 'anyon-component-selector-activated' }, '*');
      }
    }

    function handleMessage(e) {
      if (!e.data || typeof e.data !== 'object') return;
      console.log('[SelectorScript] Message received:', e.data.type);

      switch (e.data.type) {
        case 'activate-anyon-component-selector':
          console.log('[SelectorScript] Activating selector...');
          activate();
          break;
        case 'deactivate-anyon-component-selector':
          console.log('[SelectorScript] Deactivating selector...');
          deactivate();
          break;
        case 'clear-anyon-component-overlays':
          clearOverlays();
          break;
        case 'highlight-anyon-element':
          var selector = e.data.cssSelector;
          if (selector) {
            try {
              var element = document.querySelector(selector);
              if (element) {
                var overlay = createOverlay();
                overlay.style.background = 'rgba(127,34,254,0.2)';
                positionOverlay(overlay, element);
                document.body.appendChild(overlay);
                selectedOverlays.set(overlay, element);
                console.log('[SelectorScript] Highlighted element by selector:', selector);
              }
            } catch (err) {
              console.log('[SelectorScript] Invalid selector:', selector);
            }
          }
          break;
      }
    }

    // Update overlay positions on scroll/resize
    function updateOverlayPositions() {
      if (hoverOverlay && currentHoveredElement) {
        positionOverlay(hoverOverlay, currentHoveredElement);
      }
      selectedOverlays.forEach(function(element, overlay) {
        positionOverlay(overlay, element);
      });
    }

    // Initialize event listeners
    window.addEventListener('message', handleMessage);
    window.addEventListener('scroll', updateOverlayPositions, true);
    window.addEventListener('resize', updateOverlayPositions);
    document.addEventListener('keydown', handleKeyDown);

    // Notify parent that selector is ready
    console.log('[SelectorScript] Sending ready message to parent');
    window.parent.postMessage({ type: 'anyon-component-selector-ready' }, '*');
  }

  // Wait for DOM to be ready before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`
