import { UserMessage } from "@anyon/sdk/v2"
import { ComponentProps, For, Match, Show, splitProps, Switch } from "solid-js"
import { DiffChanges } from "./diff-changes"
import { HoverCard } from "@kobalte/core/hover-card"

export function MessageNav(
  props: ComponentProps<"ul"> & {
    messages: UserMessage[]
    current?: UserMessage
    size: "normal" | "compact"
    onMessageSelect: (message: UserMessage) => void
  },
) {
  const [local, others] = splitProps(props, ["messages", "current", "size", "onMessageSelect"])

  const content = () => (
    <ul role="list" data-component="message-nav" data-size={local.size} {...others}>
      <For each={local.messages}>
        {(message) => {
          const handleClick = () => local.onMessageSelect(message)

          return (
            <li data-slot="message-nav-item">
              <Switch>
                <Match when={local.size === "compact"}>
                  <button data-slot="message-nav-tick-button" data-active={message.id === local.current?.id || undefined} onClick={handleClick}>
                    <div data-slot="message-nav-tick-line" />
                  </button>
                </Match>
                <Match when={local.size === "normal"}>
                  <button data-slot="message-nav-message-button" onClick={handleClick}>
                    <DiffChanges changes={message.summary?.diffs ?? []} variant="bars" />
                    <div
                      data-slot="message-nav-title-preview"
                      data-active={message.id === local.current?.id || undefined}
                    >
                      <Show when={message.summary?.title} fallback="New message">
                        {message.summary?.title}
                      </Show>
                    </div>
                  </button>
                </Match>
              </Switch>
            </li>
          )
        }}
      </For>
    </ul>
  )

  return (
    <Switch>
      <Match when={local.size === "compact"}>
        <HoverCard openDelay={0} closeDelay={300} placement="right-start" gutter={-40} shift={-10} overlap>
          <HoverCard.Trigger as="div">{content()}</HoverCard.Trigger>
          <HoverCard.Portal>
            <HoverCard.Content data-slot="message-nav-tooltip" class="pointer-events-auto">
              <div data-slot="message-nav-tooltip-content">
                <MessageNav {...props} size="normal" class="" />
              </div>
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard>
      </Match>
      <Match when={local.size === "normal"}>{content()}</Match>
    </Switch>
  )
}
