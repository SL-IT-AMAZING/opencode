import { For, Show } from "solid-js"
import { SortableProvider } from "@thisbeyond/solid-dnd"
import { IconButton } from "@anyon/ui/icon-button"
import { Icon } from "@anyon/ui/icon"
import { Tooltip } from "@anyon/ui/tooltip"
import { Tabs } from "@anyon/ui/tabs"
import {
  SortableTab,
  SortableSessionTab,
} from "@/components/session"

export interface PaneTabBarProps {
  tabs: string[]
  active?: string
  onTabClick: (tab: string) => void
  onTabClose: (tab: string) => void
  onNewSession: () => void
  onSplit?: () => void
  canSplit?: boolean
  showContextTab?: boolean
  onContextClose?: () => void
  rightPanelOpened: boolean
  getSessionTitle: (sessionId: string) => string
}

export function PaneTabBar(props: PaneTabBarProps) {
  return (
    <Show when={props.tabs.length > 0}>
      <Tabs value={props.active ?? "session"} onChange={props.onTabClick} class="shrink-0 !h-auto">
        <Tabs.List
          classList={{
            "h-12 shrink-0 bg-background-base overflow-hidden": true,
            "pr-10": !props.rightPanelOpened,
          }}
        >
          <SortableProvider ids={props.tabs}>
            <For each={props.tabs}>
              {(tab) => (
                <Show
                  when={tab.startsWith("session-")}
                  fallback={
                    <SortableTab
                      tab={tab}
                      onTabClose={props.onTabClose}
                      onTabClick={props.onTabClick}
                    />
                  }
                >
                  <SortableSessionTab
                    sessionId={tab.replace("session-", "")}
                    title={props.getSessionTitle(tab.replace("session-", ""))}
                    onClose={(id) => props.onTabClose(`session-${id}`)}
                    onClick={(id) => props.onTabClick(`session-${id}`)}
                  />
                </Show>
              )}
            </For>
          </SortableProvider>

          {/* Context tab */}
          <Show when={props.showContextTab}>
            <div class="h-full flex-shrink min-w-0">
              <div class="relative h-full">
                <Tabs.Trigger
                  value="context"
                  closeButton={
                    <IconButton
                      icon="close"
                      variant="ghost"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation()
                        props.onContextClose?.()
                      }}
                    />
                  }
                >
                  <Icon name="brain" />
                  <span class="ml-1">Context</span>
                </Tabs.Trigger>
              </div>
            </div>
          </Show>

          {/* Split button */}
          <Show when={props.canSplit}>
            <Tooltip value="Split pane">
              <IconButton
                icon="layout-right"
                variant="ghost"
                class="ml-1 shrink-0"
                onClick={() => props.onSplit?.()}
              />
            </Tooltip>
          </Show>

          {/* New session button */}
          <Tooltip value="New session">
            <IconButton
              icon="plus"
              variant="ghost"
              class="ml-1 shrink-0"
              onClick={props.onNewSession}
            />
          </Tooltip>
        </Tabs.List>
      </Tabs>
    </Show>
  )
}
