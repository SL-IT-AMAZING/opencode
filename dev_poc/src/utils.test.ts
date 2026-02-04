import { describe, it, expect, beforeEach } from "vitest"
import {
  generateId,
  resetIdCounter,
  isLeaf,
  isSplit,
  countLeaves,
  findPane,
  findParent,
  splitPane,
  removePane,
  updateRatio,
  moveTab,
  validateTree,
  migrateFromTabs,
  collectPaneIds,
  updateLeaf,
} from "./utils"
import type { PaneLeaf, PaneNode, PaneSplit } from "./types"

// Helper: create a simple leaf
function leaf(id: string, tabs: string[] = [], active?: string): PaneLeaf {
  return { type: "leaf", id, tabs, active }
}

// Helper: create a split
function split(id: string, left: PaneNode, right: PaneNode, ratio = 0.5): PaneSplit {
  return { type: "split", id, direction: "horizontal", ratio, children: [left, right] }
}

describe("generateId / resetIdCounter", () => {
  beforeEach(() => resetIdCounter())

  it("generates sequential IDs", () => {
    expect(generateId()).toBe("pane-1")
    expect(generateId()).toBe("pane-2")
    expect(generateId()).toBe("pane-3")
  })

  it("resets counter", () => {
    generateId()
    generateId()
    resetIdCounter()
    expect(generateId()).toBe("pane-1")
  })
})

describe("isLeaf / isSplit", () => {
  it("identifies leaf nodes", () => {
    const l = leaf("a")
    expect(isLeaf(l)).toBe(true)
    expect(isSplit(l)).toBe(false)
  })

  it("identifies split nodes", () => {
    const s = split("s", leaf("a"), leaf("b"))
    expect(isLeaf(s)).toBe(false)
    expect(isSplit(s)).toBe(true)
  })
})

describe("countLeaves", () => {
  it("returns 1 for a single leaf", () => {
    expect(countLeaves(leaf("a"))).toBe(1)
  })

  it("returns 2 for a simple split", () => {
    expect(countLeaves(split("s", leaf("a"), leaf("b")))).toBe(2)
  })

  it("returns 3 for nested split", () => {
    const tree = split("s1", split("s2", leaf("a"), leaf("b")), leaf("c"))
    expect(countLeaves(tree)).toBe(3)
  })
})

describe("findPane", () => {
  it("finds a leaf in a single-node tree", () => {
    const l = leaf("a", ["tab1"])
    expect(findPane(l, "a")).toBe(l)
  })

  it("returns undefined for non-existent ID in leaf", () => {
    expect(findPane(leaf("a"), "b")).toBeUndefined()
  })

  it("finds leaves in a split tree", () => {
    const a = leaf("a")
    const b = leaf("b")
    const tree = split("s", a, b)
    expect(findPane(tree, "a")).toBe(a)
    expect(findPane(tree, "b")).toBe(b)
  })

  it("finds leaves in nested splits", () => {
    const c = leaf("c")
    const tree = split("s1", split("s2", leaf("a"), leaf("b")), c)
    expect(findPane(tree, "c")).toBe(c)
  })

  it("returns undefined for non-existent ID in split tree", () => {
    const tree = split("s", leaf("a"), leaf("b"))
    expect(findPane(tree, "z")).toBeUndefined()
  })
})

describe("findParent", () => {
  it("returns undefined for root leaf", () => {
    expect(findParent(leaf("a"), "a")).toBeUndefined()
  })

  it("finds parent of direct children", () => {
    const s = split("s", leaf("a"), leaf("b"))
    expect(findParent(s, "a")).toBe(s)
    expect(findParent(s, "b")).toBe(s)
  })

  it("finds parent in nested tree", () => {
    const inner = split("s2", leaf("a"), leaf("b"))
    const tree = split("s1", inner, leaf("c"))
    expect(findParent(tree, "a")).toBe(inner)
    expect(findParent(tree, "b")).toBe(inner)
    expect(findParent(tree, "s2")).toBe(tree)
  })

  it("returns undefined for non-existent ID", () => {
    const tree = split("s", leaf("a"), leaf("b"))
    expect(findParent(tree, "z")).toBeUndefined()
  })

  it("returns undefined for leaf node search", () => {
    expect(findParent(leaf("a"), "b")).toBeUndefined()
  })
})

describe("splitPane", () => {
  beforeEach(() => resetIdCounter())

  it("splits a single leaf into a split node", () => {
    const result = splitPane(leaf("a", ["t1", "t2"], "t1"), "a")
    expect(isSplit(result)).toBe(true)
    const s = result as PaneSplit
    expect(s.ratio).toBe(0.5)
    expect(s.direction).toBe("horizontal")
    // Left child keeps all tabs
    expect(isLeaf(s.children[0])).toBe(true)
    const left = s.children[0] as PaneLeaf
    expect(left.id).toBe("a")
    expect(left.tabs).toEqual(["t1", "t2"])
    expect(left.active).toBe("t1")
    // Right child is empty
    const right = s.children[1] as PaneLeaf
    expect(right.tabs).toEqual([])
  })

  it("moves a specific tab to the new pane", () => {
    const result = splitPane(leaf("a", ["t1", "t2", "t3"], "t2"), "a", "t2")
    const s = result as PaneSplit
    const left = s.children[0] as PaneLeaf
    const right = s.children[1] as PaneLeaf
    expect(left.tabs).toEqual(["t1", "t3"])
    expect(left.active).toBe("t1") // t2 was active, now falls back to first tab
    expect(right.tabs).toEqual(["t2"])
    expect(right.active).toBe("t2")
  })

  it("handles splitting when active tab is not moved", () => {
    const result = splitPane(leaf("a", ["t1", "t2"], "t1"), "a", "t2")
    const s = result as PaneSplit
    const left = s.children[0] as PaneLeaf
    expect(left.active).toBe("t1") // unchanged
  })

  it("returns unchanged tree if paneId not found", () => {
    const original = leaf("a", ["t1"])
    const result = splitPane(original, "nonexistent")
    expect(result).toBe(original)
  })

  it("splits a leaf inside a split tree", () => {
    const tree = split("s", leaf("a", ["t1"]), leaf("b", ["t2"]))
    resetIdCounter()
    const result = splitPane(tree, "b")
    expect(isSplit(result)).toBe(true)
    // Right child should now be a split
    const outer = result as PaneSplit
    expect(isSplit(outer.children[1])).toBe(true)
    // Left child should be unchanged
    expect(outer.children[0]).toBe(tree.children[0])
  })

  it("returns unchanged subtrees when pane not in branch", () => {
    const a = leaf("a", ["t1"])
    const b = leaf("b", ["t2"])
    const tree = split("s", a, b)
    resetIdCounter()
    const result = splitPane(tree, "b") as PaneSplit
    // Left branch should be referentially identical (not modified)
    expect(result.children[0]).toBe(a)
  })
})

describe("removePane", () => {
  it("returns undefined when removing the only leaf", () => {
    expect(removePane(leaf("a"), "a")).toBeUndefined()
  })

  it("returns unchanged leaf when ID doesnt match", () => {
    const l = leaf("a")
    expect(removePane(l, "b")).toBe(l)
  })

  it("collapses split when left child removed", () => {
    const b = leaf("b")
    const tree = split("s", leaf("a"), b)
    expect(removePane(tree, "a")).toBe(b)
  })

  it("collapses split when right child removed", () => {
    const a = leaf("a")
    const tree = split("s", a, leaf("b"))
    expect(removePane(tree, "b")).toBe(a)
  })

  it("handles nested removal", () => {
    const c = leaf("c")
    const inner = split("s2", leaf("a"), leaf("b"))
    const tree = split("s1", inner, c)

    // Remove "a" -> inner collapses to "b", outer becomes split(s1, b, c)
    const result = removePane(tree, "a")
    expect(isSplit(result!)).toBe(true)
    const s = result as PaneSplit
    expect(isLeaf(s.children[0])).toBe(true)
    expect((s.children[0] as PaneLeaf).id).toBe("b")
    expect(s.children[1]).toBe(c)
  })

  it("returns unchanged tree when ID not found in split", () => {
    const tree = split("s", leaf("a"), leaf("b"))
    const result = removePane(tree, "z")
    expect(result).toBe(tree)
  })

  it("handles deeply nested removal", () => {
    const d = leaf("d")
    const innerRight = split("s3", leaf("c"), d)
    const innerLeft = split("s2", leaf("a"), leaf("b"))
    const tree = split("s1", innerLeft, innerRight)

    const result = removePane(tree, "c")
    expect(result).toBeDefined()
    const outer = result as PaneSplit
    // Right child should collapse to just "d"
    expect(isLeaf(outer.children[1])).toBe(true)
    expect((outer.children[1] as PaneLeaf).id).toBe("d")
    // Left child should be unchanged
    expect(outer.children[0]).toBe(innerLeft)
  })
})

describe("updateRatio", () => {
  it("updates ratio on matching split", () => {
    const tree = split("s", leaf("a"), leaf("b"), 0.5)
    const result = updateRatio(tree, "s", 0.7) as PaneSplit
    expect(result.ratio).toBe(0.7)
  })

  it("clamps ratio to min 0.1", () => {
    const tree = split("s", leaf("a"), leaf("b"))
    const result = updateRatio(tree, "s", 0.02) as PaneSplit
    expect(result.ratio).toBe(0.1)
  })

  it("clamps ratio to max 0.9", () => {
    const tree = split("s", leaf("a"), leaf("b"))
    const result = updateRatio(tree, "s", 0.99) as PaneSplit
    expect(result.ratio).toBe(0.9)
  })

  it("returns unchanged leaf when called on leaf", () => {
    const l = leaf("a")
    expect(updateRatio(l, "s", 0.5)).toBe(l)
  })

  it("returns unchanged tree when split ID not found", () => {
    const tree = split("s", leaf("a"), leaf("b"))
    expect(updateRatio(tree, "nonexistent", 0.7)).toBe(tree)
  })

  it("updates nested split ratio", () => {
    const inner = split("s2", leaf("a"), leaf("b"), 0.5)
    const tree = split("s1", inner, leaf("c"), 0.5)
    const result = updateRatio(tree, "s2", 0.3) as PaneSplit
    expect(result.ratio).toBe(0.5) // outer unchanged
    expect((result.children[0] as PaneSplit).ratio).toBe(0.3) // inner updated
    expect(result.children[1]).toBe(tree.children[1]) // right unchanged
  })
})

describe("moveTab", () => {
  beforeEach(() => resetIdCounter())

  it("moves tab from one pane to another", () => {
    const tree = split("s", leaf("a", ["t1", "t2"], "t1"), leaf("b", ["t3"], "t3"))
    const result = moveTab(tree, "a", "b", "t1")
    const s = result as PaneSplit
    const left = findPane(s, "a")!
    const right = findPane(s, "b")!
    expect(left.tabs).toEqual(["t2"])
    expect(right.tabs).toEqual(["t3", "t1"])
    expect(right.active).toBe("t1") // newly moved tab becomes active
  })

  it("auto-collapses empty pane after move", () => {
    const tree = split("s", leaf("a", ["t1"], "t1"), leaf("b", ["t2"], "t2"))
    const result = moveTab(tree, "a", "b", "t1")
    // Pane "a" is now empty, should collapse to just "b"
    expect(isLeaf(result)).toBe(true)
    expect((result as PaneLeaf).id).toBe("b")
    expect((result as PaneLeaf).tabs).toEqual(["t2", "t1"])
  })

  it("returns unchanged tree when from == to", () => {
    const tree = split("s", leaf("a", ["t1"]), leaf("b", ["t2"]))
    expect(moveTab(tree, "a", "a", "t1")).toBe(tree)
  })

  it("returns unchanged tree when source pane not found", () => {
    const tree = split("s", leaf("a", ["t1"]), leaf("b", ["t2"]))
    expect(moveTab(tree, "z", "b", "t1")).toBe(tree)
  })

  it("returns unchanged tree when dest pane not found", () => {
    const tree = split("s", leaf("a", ["t1"]), leaf("b", ["t2"]))
    expect(moveTab(tree, "a", "z", "t1")).toBe(tree)
  })

  it("returns unchanged tree when tab not in source", () => {
    const tree = split("s", leaf("a", ["t1"]), leaf("b", ["t2"]))
    expect(moveTab(tree, "a", "b", "nonexistent")).toBe(tree)
  })

  it("updates active in source when moved tab was active", () => {
    const tree = split("s", leaf("a", ["t1", "t2"], "t1"), leaf("b", ["t3"], "t3"))
    const result = moveTab(tree, "a", "b", "t1") as PaneSplit
    const left = findPane(result, "a")!
    expect(left.active).toBe("t2") // falls back to first remaining tab
  })

  it("handles move in nested tree where updateLeaf traverses unchanged subtree", () => {
    // Tree: split(s1, split(s2, leaf(a, [t1,t2]), leaf(b, [t3])), leaf(c, [t4]))
    // Move t1 from "a" to "b" - both are in the left subtree
    // The right subtree (leaf c) should be completely unchanged
    const tree = split("s1",
      split("s2", leaf("a", ["t1", "t2"], "t1"), leaf("b", ["t3"], "t3")),
      leaf("c", ["t4"], "t4"),
    )
    const result = moveTab(tree, "a", "b", "t1") as PaneSplit
    // Right child should be referentially identical (unchanged)
    expect(result.children[1]).toBe(tree.children[1])
    // Left child should be modified
    const inner = result.children[0] as PaneSplit
    expect(findPane(inner, "a")!.tabs).toEqual(["t2"])
    expect(findPane(inner, "b")!.tabs).toEqual(["t3", "t1"])
  })

  it("preserves active in source when moved tab was not active", () => {
    const tree = split("s", leaf("a", ["t1", "t2"], "t2"), leaf("b", ["t3"], "t3"))
    const result = moveTab(tree, "a", "b", "t1") as PaneSplit
    const left = findPane(result, "a")!
    expect(left.active).toBe("t2") // unchanged
  })
})

describe("validateTree", () => {
  it("validates a simple leaf", () => {
    expect(validateTree(leaf("a", ["t1"]))).toBe(true)
  })

  it("validates a split", () => {
    expect(validateTree(split("s", leaf("a"), leaf("b")))).toBe(true)
  })

  it("validates nested splits", () => {
    const tree = split("s1", split("s2", leaf("a"), leaf("b")), leaf("c"))
    expect(validateTree(tree)).toBe(true)
  })

  it("rejects split with invalid ratio (negative)", () => {
    const bad: PaneSplit = { type: "split", id: "s", direction: "horizontal", ratio: -0.5, children: [leaf("a"), leaf("b")] }
    expect(validateTree(bad)).toBe(false)
  })

  it("rejects split with invalid ratio (> 1)", () => {
    const bad: PaneSplit = { type: "split", id: "s", direction: "horizontal", ratio: 1.5, children: [leaf("a"), leaf("b")] }
    expect(validateTree(bad)).toBe(false)
  })

  it("rejects split with wrong children count", () => {
    const bad = { type: "split" as const, id: "s", direction: "horizontal" as const, ratio: 0.5, children: [leaf("a")] as unknown as [PaneNode, PaneNode] }
    expect(validateTree(bad)).toBe(false)
  })
})

describe("migrateFromTabs", () => {
  it("converts empty tabs", () => {
    const result = migrateFromTabs({ all: [] })
    expect(result.root.type).toBe("leaf")
    expect((result.root as PaneLeaf).tabs).toEqual([])
    expect((result.root as PaneLeaf).id).toBe("pane-0")
  })

  it("converts tabs with active", () => {
    const result = migrateFromTabs({ all: ["session-1", "file://a.ts"], active: "session-1" })
    const root = result.root as PaneLeaf
    expect(root.tabs).toEqual(["session-1", "file://a.ts"])
    expect(root.active).toBe("session-1")
  })

  it("does not mutate input", () => {
    const input = { all: ["t1", "t2"], active: "t1" }
    const original = [...input.all]
    migrateFromTabs(input)
    expect(input.all).toEqual(original)
  })
})

describe("updateLeaf", () => {
  it("returns unchanged tree when pane not found in split", () => {
    const tree = split("s", leaf("a", ["t1"]), leaf("b", ["t2"]))
    const result = updateLeaf(tree, "nonexistent", (l) => ({ ...l, active: "changed" }))
    expect(result).toBe(tree)
  })

  it("transforms matching leaf", () => {
    const l = leaf("a", ["t1", "t2"], "t1")
    const result = updateLeaf(l, "a", (node) => ({ ...node, active: "t2" }))
    expect((result as PaneLeaf).active).toBe("t2")
  })

  it("returns unchanged leaf when ID doesnt match", () => {
    const l = leaf("a", ["t1"])
    expect(updateLeaf(l, "b", (node) => ({ ...node, active: "changed" }))).toBe(l)
  })
})

describe("collectPaneIds", () => {
  it("collects single leaf ID", () => {
    expect(collectPaneIds(leaf("a"))).toEqual(["a"])
  })

  it("collects IDs from split", () => {
    expect(collectPaneIds(split("s", leaf("a"), leaf("b")))).toEqual(["a", "b"])
  })

  it("collects IDs from nested tree", () => {
    const tree = split("s1", split("s2", leaf("a"), leaf("b")), leaf("c"))
    expect(collectPaneIds(tree)).toEqual(["a", "b", "c"])
  })
})
