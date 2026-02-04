import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@solidjs/testing-library"
import { SplitContainer } from "./split-container"
import type { PaneLeaf, PaneNode, PaneSplit } from "./types"

function leaf(id: string, tabs: string[] = [], active?: string): PaneLeaf {
  return { type: "leaf", id, tabs, active }
}

function split(id: string, left: PaneNode, right: PaneNode, ratio = 0.5): PaneSplit {
  return { type: "split", id, direction: "horizontal", ratio, children: [left, right] }
}

describe("SplitContainer", () => {
  const defaultRenderPane = (pane: PaneLeaf, isFocused: boolean, onFocus: () => void) => (
    <div
      data-testid={`pane-${pane.id}`}
      data-focused={isFocused}
      onClick={onFocus}
    >
      Pane {pane.id}: {pane.tabs.join(", ")}
    </div>
  )

  it("renders a single leaf pane", () => {
    const { getByTestId } = render(() => (
      <SplitContainer
        root={leaf("a", ["tab1", "tab2"], "tab1")}
        renderPane={defaultRenderPane}
      />
    ))

    const pane = getByTestId("pane-a")
    expect(pane).toBeDefined()
    expect(pane.textContent).toContain("Pane a: tab1, tab2")
  })

  it("marks focused pane correctly", () => {
    const { getByTestId } = render(() => (
      <SplitContainer
        root={leaf("a", ["tab1"])}
        focusedPane="a"
        renderPane={defaultRenderPane}
      />
    ))

    expect(getByTestId("pane-a").getAttribute("data-focused")).toBe("true")
  })

  it("marks unfocused pane correctly", () => {
    const { getByTestId } = render(() => (
      <SplitContainer
        root={leaf("a", ["tab1"])}
        focusedPane="other"
        renderPane={defaultRenderPane}
      />
    ))

    expect(getByTestId("pane-a").getAttribute("data-focused")).toBe("false")
  })

  it("calls onFocusPane when pane is clicked", () => {
    const onFocus = vi.fn()
    const { getByTestId } = render(() => (
      <SplitContainer
        root={leaf("a", ["tab1"])}
        onFocusPane={onFocus}
        renderPane={defaultRenderPane}
      />
    ))

    fireEvent.click(getByTestId("pane-a"))
    expect(onFocus).toHaveBeenCalledWith("a")
  })

  it("renders two panes with resize handle for a split", () => {
    const tree = split("s1", leaf("a", ["tab1"]), leaf("b", ["tab2"]))

    const { getByTestId } = render(() => (
      <SplitContainer
        root={tree}
        renderPane={defaultRenderPane}
      />
    ))

    expect(getByTestId("pane-a")).toBeDefined()
    expect(getByTestId("pane-b")).toBeDefined()
    expect(getByTestId("resize-handle")).toBeDefined()
    expect(getByTestId("split-left")).toBeDefined()
    expect(getByTestId("split-right")).toBeDefined()
  })

  it("calls onFocusPane for correct pane in split", () => {
    const onFocus = vi.fn()
    const tree = split("s1", leaf("a", ["tab1"]), leaf("b", ["tab2"]))

    const { getByTestId } = render(() => (
      <SplitContainer
        root={tree}
        onFocusPane={onFocus}
        renderPane={defaultRenderPane}
      />
    ))

    fireEvent.click(getByTestId("pane-b"))
    expect(onFocus).toHaveBeenCalledWith("b")
  })

  it("resize handle triggers mousedown handling", () => {
    const onRatioChange = vi.fn()
    const tree = split("s1", leaf("a", ["tab1"]), leaf("b", ["tab2"]), 0.5)

    const { getByTestId } = render(() => (
      <SplitContainer
        root={tree}
        onRatioChange={onRatioChange}
        renderPane={defaultRenderPane}
      />
    ))

    const handle = getByTestId("resize-handle")

    // Simulate mousedown
    fireEvent.mouseDown(handle, { clientX: 400 })

    // Simulate mousemove (globally, since handler attaches to document)
    fireEvent.mouseMove(document, { clientX: 500 })

    // Should have called onRatioChange
    expect(onRatioChange).toHaveBeenCalled()
    const [splitId, ratio] = onRatioChange.mock.calls[0]
    expect(splitId).toBe("s1")
    expect(typeof ratio).toBe("number")

    // Simulate mouseup to cleanup
    fireEvent.mouseUp(document)

    // Verify userSelect is restored
    expect(document.body.style.userSelect).toBe("")
  })

  it("clamps ratio during resize", () => {
    const onRatioChange = vi.fn()
    const tree = split("s1", leaf("a", ["tab1"]), leaf("b", ["tab2"]), 0.5)

    const { getByTestId } = render(() => (
      <SplitContainer
        root={tree}
        onRatioChange={onRatioChange}
        renderPane={defaultRenderPane}
      />
    ))

    const handle = getByTestId("resize-handle")

    // Start drag
    fireEvent.mouseDown(handle, { clientX: 400 })

    // Move way to the left (should clamp to 0.1)
    fireEvent.mouseMove(document, { clientX: -1000 })

    expect(onRatioChange).toHaveBeenCalled()
    const [, ratio] = onRatioChange.mock.calls[0]
    expect(ratio).toBeGreaterThanOrEqual(0.1)
    expect(ratio).toBeLessThanOrEqual(0.9)

    fireEvent.mouseUp(document)
  })

  it("renders nested splits (3 panes)", () => {
    const onFocus = vi.fn()
    const onRatioChange = vi.fn()
    const tree = split("s1",
      split("s2", leaf("a", ["tab1"]), leaf("b", ["tab2"]), 0.5),
      leaf("c", ["tab3"]),
      0.6,
    )

    const { getByTestId, getAllByTestId } = render(() => (
      <SplitContainer
        root={tree}
        focusedPane="b"
        onFocusPane={onFocus}
        onRatioChange={onRatioChange}
        renderPane={defaultRenderPane}
      />
    ))

    // All 3 panes should render
    expect(getByTestId("pane-a")).toBeDefined()
    expect(getByTestId("pane-b")).toBeDefined()
    expect(getByTestId("pane-c")).toBeDefined()

    // Pane b should be focused
    expect(getByTestId("pane-b").getAttribute("data-focused")).toBe("true")
    expect(getByTestId("pane-a").getAttribute("data-focused")).toBe("false")

    // Should have 2 resize handles
    expect(getAllByTestId("resize-handle").length).toBe(2)

    // Click pane a - should trigger onFocusPane
    fireEvent.click(getByTestId("pane-a"))
    expect(onFocus).toHaveBeenCalledWith("a")

    // Drag the inner resize handle
    const handles = getAllByTestId("resize-handle")
    // The inner handle (for s2) should be the first one in DOM order
    fireEvent.mouseDown(handles[0], { clientX: 200 })
    fireEvent.mouseMove(document, { clientX: 250 })
    expect(onRatioChange).toHaveBeenCalled()
    fireEvent.mouseUp(document)
  })

  it("has split-view with correct split-id data attribute", () => {
    const tree = split("s1", leaf("a", ["tab1"]), leaf("b", ["tab2"]))

    const { getByTestId } = render(() => (
      <SplitContainer
        root={tree}
        renderPane={defaultRenderPane}
      />
    ))

    expect(getByTestId("split-view").getAttribute("data-split-id")).toBe("s1")
  })
})
