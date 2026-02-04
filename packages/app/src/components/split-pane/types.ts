/** A leaf pane with its own tab bar and content */
export type PaneLeaf = {
  type: "leaf"
  id: string
  tabs: string[]
  active?: string
}

/** A split node divides space between two children */
export type PaneSplit = {
  type: "split"
  id: string
  direction: "horizontal"
  ratio: number
  children: [PaneNode, PaneNode]
}

/** A node in the pane tree */
export type PaneNode = PaneLeaf | PaneSplit

/** Root-level split layout state */
export type SplitLayout = {
  root: PaneNode
  focusedPane?: string
}
