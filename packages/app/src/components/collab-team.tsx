import { For, Show, createResource, createSignal } from "solid-js"
import { Button } from "@anyon/ui/button"
import { showToast } from "@anyon/ui/toast"
import { useSDK } from "@/context/sdk"
import type { CollabTeamMember } from "@anyon/sdk/v2/client"

export function CollabTeam() {
  const sdk = useSDK()
  const [loading, setLoading] = createSignal(false)

  const [team, { refetch }] = createResource(async () => {
    const result = await sdk.client.collab.team({})
    return result.data
  })

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const result = await sdk.client.collab.teamRefresh({})
      if (result.data) {
        await refetch()
        showToast({ variant: "success", title: "Team refreshed" })
      } else {
        showToast({ variant: "error", title: "Refresh failed", description: "Could not refresh team data" })
      }
    } catch (error) {
      console.error("Team refresh error:", error)
      showToast({ variant: "error", title: "Refresh failed", description: "An error occurred" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="flex flex-col gap-2 p-2">
      <div class="flex justify-end items-center">
        <Button variant="ghost" size="small" onClick={handleRefresh} disabled={loading()}>
          {loading() ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Show when={team()} fallback={<div class="text-11-regular text-text-weak">Loading...</div>}>
        {(t) => (
          <div class="flex flex-col gap-1">
            <For each={t().members}>
              {(member) => <TeamMemberRow member={member} isCurrentUser={member.email === t().currentUserEmail} />}
            </For>
            <div class="text-11-regular text-text-weak mt-2">
              {t().source === "git" ? "Detected from git history" : "Manually configured"}
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}

function TeamMemberRow(props: { member: CollabTeamMember; isCurrentUser?: boolean }) {
  const initial = props.member.name.charAt(0).toUpperCase()

  return (
    <div class="flex items-center gap-2 p-2 rounded bg-surface-secondary">
      <Show
        when={props.member.avatar}
        fallback={
          <div class="w-6 h-6 rounded-full bg-surface-tertiary flex items-center justify-center text-11-medium">
            {initial}
          </div>
        }
      >
        <img src={props.member.avatar} alt={props.member.name} class="w-6 h-6 rounded-full" />
      </Show>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-12-regular text-text-base truncate">{props.member.name}</span>
          <Show when={props.isCurrentUser}>
            <span class="text-10-medium text-text-success bg-surface-success-subtle px-1.5 py-0.5 rounded">You</span>
          </Show>
        </div>
        <div class="text-11-regular text-text-weak truncate">{props.member.commitCount ?? 0} commits</div>
      </div>
    </div>
  )
}
