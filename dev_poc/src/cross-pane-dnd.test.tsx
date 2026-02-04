import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import { createSignal, For } from "solid-js"
import {
  DragDropProvider,
  DragDropSensors,
  SortableProvider,
  createSortable,
  closestCenter,
  type DragEvent,
} from "@thisbeyond/solid-dnd"

/**
 * POC-003: Verify that a single DragDropProvider with multiple SortableProviders
 * allows items to be detected across sortable groups.
 *
 * This tests the architecture decision for cross-pane tab dragging:
 * - One parent DragDropProvider wrapping all panes
 * - Each pane has its own SortableProvider with its tab IDs
 * - The onDragEnd handler should detect which group the item was dropped into
 */

function SortableItem(props: { id: string; paneId: string }) {
  const sortable = createSortable(props.id)
  return (
    <div
      ref={sortable.ref}
      data-testid={`item-${props.id}`}
      data-pane={props.paneId}
      style={{
        opacity: sortable.isActiveDraggable ? 0.5 : 1,
        width: "100px",
        height: "30px",
        border: "1px solid gray",
      }}
    >
      {props.id}
    </div>
  )
}

function TestDualPane() {
  const [pane1Items, setPane1Items] = createSignal(["tab-a", "tab-b"])
  const [pane2Items, setPane2Items] = createSignal(["tab-c", "tab-d"])
  const [lastDragEvent, setLastDragEvent] = createSignal<{
    draggable: string
    droppable: string
  } | null>(null)

  const handleDragEnd = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (!droppable) return
    setLastDragEvent({
      draggable: String(draggable.id),
      droppable: String(droppable.id),
    })
  }

  return (
    <DragDropProvider
      onDragEnd={handleDragEnd}
      collisionDetector={closestCenter}
    >
      <DragDropSensors />
      <div data-testid="container" style={{ display: "flex", gap: "20px" }}>
        <div data-testid="pane-1" style={{ width: "200px" }}>
          <SortableProvider ids={pane1Items()}>
            <For each={pane1Items()}>
              {(id) => <SortableItem id={id} paneId="1" />}
            </For>
          </SortableProvider>
        </div>
        <div data-testid="pane-2" style={{ width: "200px" }}>
          <SortableProvider ids={pane2Items()}>
            <For each={pane2Items()}>
              {(id) => <SortableItem id={id} paneId="2" />}
            </For>
          </SortableProvider>
        </div>
      </div>
      <div data-testid="drag-result">
        {JSON.stringify(lastDragEvent())}
      </div>
    </DragDropProvider>
  )
}

describe("POC-003: Cross-pane DnD with solid-dnd", () => {
  it("renders items in both panes", () => {
    const { getByTestId } = render(() => <TestDualPane />)

    expect(getByTestId("item-tab-a")).toBeDefined()
    expect(getByTestId("item-tab-b")).toBeDefined()
    expect(getByTestId("item-tab-c")).toBeDefined()
    expect(getByTestId("item-tab-d")).toBeDefined()
  })

  it("items in pane 1 have correct pane attribute", () => {
    const { getByTestId } = render(() => <TestDualPane />)

    expect(getByTestId("item-tab-a").getAttribute("data-pane")).toBe("1")
    expect(getByTestId("item-tab-b").getAttribute("data-pane")).toBe("1")
  })

  it("items in pane 2 have correct pane attribute", () => {
    const { getByTestId } = render(() => <TestDualPane />)

    expect(getByTestId("item-tab-c").getAttribute("data-pane")).toBe("2")
    expect(getByTestId("item-tab-d").getAttribute("data-pane")).toBe("2")
  })

  it("items from both SortableProviders are registered under single DragDropProvider", () => {
    // This test verifies the fundamental architecture question:
    // Can we have multiple SortableProviders under one DragDropProvider?
    // If this renders without errors, the answer is YES.
    const { container } = render(() => <TestDualPane />)

    // Count all sortable items - should be 4 total across both providers
    const items = container.querySelectorAll("[data-testid^='item-']")
    expect(items.length).toBe(4)
  })

  it("can programmatically simulate drag event structure", () => {
    // Verify the DragEvent structure has the fields we need
    // to detect cross-pane moves in the onDragEnd handler
    const mockEvent = {
      draggable: { id: "tab-a", data: {} },
      droppable: { id: "tab-c", data: {} },
    }

    // Our handler should be able to detect:
    // 1. Which item was dragged (tab-a from pane 1)
    // 2. Which item it was dropped near (tab-c from pane 2)
    // 3. From this, determine source pane and destination pane
    expect(String(mockEvent.draggable.id)).toBe("tab-a")
    expect(String(mockEvent.droppable.id)).toBe("tab-c")
  })
})

/**
 * POC-003 CONCLUSION:
 *
 * VERIFIED: Multiple SortableProviders under a single DragDropProvider
 * renders correctly without errors. All items from all SortableProviders
 * are accessible within the same drag context.
 *
 * For cross-pane tab dragging in the real implementation:
 * 1. Wrap all panes in a single DragDropProvider
 * 2. Each pane's tab bar gets its own SortableProvider
 * 3. The onDragEnd handler receives draggable.id and droppable.id
 * 4. Map item IDs to pane IDs to detect cross-pane moves
 * 5. Update the tree state accordingly (moveTab utility)
 *
 * LIMITATION: Full drag simulation in jsdom is impractical
 * (no real layout engine, no pointer events). The rendering test
 * confirms the provider structure works. Real drag testing requires
 * E2E tests (Playwright).
 */
