import { createSignal, Show, onMount, onCleanup, ParentProps } from "solid-js"
import { Portal } from "solid-js/web"
import { Button } from "@anyon/ui/button"
import { Icon } from "@anyon/ui/icon"
import { usePrompt } from "@/context/prompt"

export function TextSelectionPopup(props: ParentProps) {
  const prompt = usePrompt()
  const [selection, setSelection] = createSignal<{
    text: string
    top: number
    left: number
  } | null>(null)

  const handleMouseUp = () => {
    requestAnimationFrame(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setSelection(null)
        return
      }

      const selectedText = sel.toString().trim()
      if (!selectedText || selectedText.length < 3) {
        setSelection(null)
        return
      }

      // Exclude selections in editable areas (prompt input, textareas, inputs)
      const anchorNode = sel.anchorNode
      if (anchorNode) {
        const element = anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement
        if (element) {
          const isInEditableArea =
            element.closest('[data-component="prompt-input"]') ||
            element.closest('[contenteditable="true"]') ||
            element.closest("textarea") ||
            element.closest("input")
          if (isInEditableArea) {
            setSelection(null)
            return
          }
        }
      }

      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      setSelection({
        text: selectedText,
        top: rect.top,
        left: rect.right + 8,
      })
    })
  }

  const handleMouseDown = (event: MouseEvent) => {
    const popup = document.querySelector('[data-component="text-selection-popup"]')
    if (popup && popup.contains(event.target as Node)) return
    setSelection(null)
  }

  const handleAddToContext = () => {
    const sel = selection()
    if (!sel) return

    prompt.context.add({
      type: "snippet",
      text: sel.text,
    })

    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }

  onMount(() => {
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("mousedown", handleMouseDown)
  })

  onCleanup(() => {
    document.removeEventListener("mouseup", handleMouseUp)
    document.removeEventListener("mousedown", handleMouseDown)
  })

  return (
    <>
      {props.children}
      <Show when={selection()}>
        {(sel) => (
          <Portal>
            <div
              data-component="text-selection-popup"
              style={{
                position: "fixed",
                top: `${sel().top}px`,
                left: `${sel().left}px`,
                "z-index": "9999",
              }}
              class="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-surface-elevated border border-border-base shadow-lg"
            >
              <Button size="small" onClick={handleAddToContext}>
                <Icon name="plus-small" size="small" />
                <span class="text-12-regular">Add to Context</span>
              </Button>
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
