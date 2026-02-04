import type { PaneLeaf, PaneNode, PaneSplit, SplitLayout } from "./types"

let counter = 0

/** Generate a unique pane ID */
export function generateId(): string {
  return `pane-${++counter}`
}

/** Reset the ID counter (for testing) */
export function resetIdCounter(): void {
  counter = 0
}

/** Check if a node is a leaf */
export function isLeaf(node: PaneNode): node is PaneLeaf {
  return node.type === "leaf"
}

/** Check if a node is a split */
export function isSplit(node: PaneNode): node is PaneSplit {
  return node.type === "split"
}

/** Count the total number of leaf panes in the tree */
export function countLeaves(node: PaneNode): number {
  if (isLeaf(node)) return 1
  return countLeaves(node.children[0]) + countLeaves(node.children[1])
}

/** Find a leaf pane by ID. Returns undefined if not found. */
export function findPane(root: PaneNode, id: string): PaneLeaf | undefined {
  if (isLeaf(root)) {
    return root.id === id ? root : undefined
  }
  return findPane(root.children[0], id) ?? findPane(root.children[1], id)
}

/** Find the parent split node of a given node ID. Returns undefined for root. */
export function findParent(root: PaneNode, id: string): PaneSplit | undefined {
  if (isLeaf(root)) return undefined
  if (root.children[0].id === id || root.children[1].id === id) return root
  return findParent(root.children[0], id) ?? findParent(root.children[1], id)
}

/**
 * Split a leaf pane into a split node with two children.
 * The original pane keeps most tabs, and tabToMove goes to the new pane.
 * Returns a new tree (immutable).
 */
export function splitPane(
  root: PaneNode,
  paneId: string,
  tabToMove?: string,
): PaneNode {
  if (isLeaf(root)) {
    if (root.id !== paneId) return root

    const newPaneId = generateId()
    const leftTabs = tabToMove ? root.tabs.filter((t) => t !== tabToMove) : [...root.tabs]
    const rightTabs = tabToMove ? [tabToMove] : []
    const leftActive = tabToMove && root.active === tabToMove
      ? leftTabs[0]
      : root.active
    const rightActive = tabToMove ?? undefined

    return {
      type: "split",
      id: generateId(),
      direction: "horizontal",
      ratio: 0.5,
      children: [
        { type: "leaf", id: root.id, tabs: leftTabs, active: leftActive },
        { type: "leaf", id: newPaneId, tabs: rightTabs, active: rightActive },
      ],
    }
  }

  return {
    ...root,
    children: [
      splitPane(root.children[0], paneId, tabToMove),
      splitPane(root.children[1], paneId, tabToMove),
    ],
  }
}

/**
 * Remove a pane from the tree. The parent split is replaced by the surviving sibling.
 * Returns a new tree (immutable). Returns undefined if the root itself is removed.
 */
export function removePane(root: PaneNode, paneId: string): PaneNode | undefined {
  if (isLeaf(root)) {
    return root.id === paneId ? undefined : root
  }

  // Check if either direct child is the target
  if (root.children[0].id === paneId) return root.children[1]
  if (root.children[1].id === paneId) return root.children[0]

  // Recurse into children - these will never return undefined because
  // direct child matches are caught above, and removePane on a split
  // always returns a PaneNode (the surviving sibling or modified subtree)
  const left = removePane(root.children[0], paneId)!
  const right = removePane(root.children[1], paneId)!

  // If nothing changed, return as-is
  if (left === root.children[0] && right === root.children[1]) return root

  return {
    ...root,
    children: [left, right],
  }
}

/** Update the ratio of a split node by ID. Returns a new tree (immutable). */
export function updateRatio(root: PaneNode, splitId: string, ratio: number): PaneNode {
  const clamped = Math.min(0.9, Math.max(0.1, ratio))

  if (isLeaf(root)) return root

  if (root.id === splitId) {
    return { ...root, ratio: clamped }
  }

  const left = updateRatio(root.children[0], splitId, ratio)
  const right = updateRatio(root.children[1], splitId, ratio)

  if (left === root.children[0] && right === root.children[1]) return root

  return { ...root, children: [left, right] }
}

/** Move a tab from one pane to another. Returns a new tree (immutable). */
export function moveTab(
  root: PaneNode,
  fromPaneId: string,
  toPaneId: string,
  tab: string,
): PaneNode {
  if (fromPaneId === toPaneId) return root

  const from = findPane(root, fromPaneId)
  const to = findPane(root, toPaneId)
  if (!from || !to) return root
  if (!from.tabs.includes(tab)) return root

  // Remove tab from source
  let result = updateLeaf(root, fromPaneId, (leaf) => {
    const tabs = leaf.tabs.filter((t) => t !== tab)
    const active = leaf.active === tab ? tabs[0] : leaf.active
    return { ...leaf, tabs, active }
  })

  // Add tab to destination
  result = updateLeaf(result, toPaneId, (leaf) => ({
    ...leaf,
    tabs: [...leaf.tabs, tab],
    active: tab,
  }))

  // Auto-collapse empty pane
  const updatedFrom = findPane(result, fromPaneId)
  if (updatedFrom && updatedFrom.tabs.length === 0) {
    const collapsed = removePane(result, fromPaneId)
    if (collapsed) return collapsed
  }

  return result
}

/** Update a specific leaf node by ID using a transform function */
export function updateLeaf(
  root: PaneNode,
  paneId: string,
  transform: (leaf: PaneLeaf) => PaneLeaf,
): PaneNode {
  if (isLeaf(root)) {
    return root.id === paneId ? transform(root) : root
  }

  const left = updateLeaf(root.children[0], paneId, transform)
  const right = updateLeaf(root.children[1], paneId, transform)

  if (left === root.children[0] && right === root.children[1]) return root

  return { ...root, children: [left, right] }
}

/** Validate a tree structure. Returns true if valid. */
export function validateTree(node: PaneNode): boolean {
  if (isLeaf(node)) {
    return typeof node.id === "string" && Array.isArray(node.tabs)
  }

  if (node.children.length !== 2) return false
  if (node.ratio < 0 || node.ratio > 1) return false

  return validateTree(node.children[0]) && validateTree(node.children[1])
}

/** Convert legacy SessionTabs format to a single-leaf SplitLayout */
export function migrateFromTabs(tabs: { all: string[]; active?: string }): SplitLayout {
  return {
    root: {
      type: "leaf",
      id: "pane-0",
      tabs: [...tabs.all],
      active: tabs.active,
    },
  }
}

/** Collect all leaf pane IDs */
export function collectPaneIds(node: PaneNode): string[] {
  if (isLeaf(node)) return [node.id]
  return [...collectPaneIds(node.children[0]), ...collectPaneIds(node.children[1])]
}
