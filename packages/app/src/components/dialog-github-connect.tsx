import { useDialog } from "@anyon/ui/context/dialog"
import { Dialog } from "@anyon/ui/dialog"
import { Button } from "@anyon/ui/button"
import { TextField } from "@anyon/ui/text-field"
import { Icon } from "@anyon/ui/icon"
import { createSignal, createResource, Show, onMount } from "solid-js"
import { useSDK } from "@/context/sdk"
import { usePlatform } from "@/context/platform"

interface DialogGitHubConnectProps {
  /** Called when repo is created successfully */
  onConnect: (repoUrl: string) => void
  /** Called when user skips */
  onSkip: () => void
}

interface AuthStatus {
  authenticated: boolean
  username?: string
  email?: string
}

interface RepoInfo {
  id: number
  name: string
  fullName: string
  htmlUrl: string
  cloneUrl: string
  sshUrl: string
  private: boolean
  defaultBranch: string
}

export function DialogGitHubConnect(props: DialogGitHubConnectProps) {
  const dialog = useDialog()
  const sdk = useSDK()
  const platform = usePlatform()

  const [repoName, setRepoName] = createSignal("")
  const [isPrivate, setIsPrivate] = createSignal(true)
  const [isCreating, setIsCreating] = createSignal(false)
  const [error, setError] = createSignal("")

  // Check auth status on mount
  const [authStatus, { refetch: refetchAuth }] = createResource<AuthStatus>(async () => {
    const res = await fetch(`${sdk.url}/github/auth/status`)
    return res.json()
  })

  // Start OAuth flow
  const handleLogin = async () => {
    const res = await fetch(`${sdk.url}/github/auth/start`)
    const { url } = await res.json()

    // Open GitHub OAuth in system browser (works in both web and Tauri)
    platform.openLink(url)

    // Poll for auth completion
    const pollInterval = setInterval(async () => {
      const status = await fetch(`${sdk.url}/github/auth/status`).then((r) => r.json())
      if (status.authenticated) {
        clearInterval(pollInterval)
        refetchAuth()
      }
    }, 1000)

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000)
  }

  // Create repository
  const handleCreate = async () => {
    const name = repoName().trim()
    if (!name) return

    setIsCreating(true)
    setError("")

    try {
      const res = await fetch(`${sdk.url}/github/repo/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          private: isPrivate(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create repository")
      }

      const repo: RepoInfo = await res.json()
      props.onConnect(repo.cloneUrl)
      dialog.close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsCreating(false)
    }
  }

  const handleSkip = () => {
    props.onSkip()
    dialog.close()
  }

  return (
    <Dialog title="GitHub에 연결">
      <div class="flex flex-col gap-6 px-2.5 pb-3">
        <Show
          when={authStatus()?.authenticated}
          fallback={
            // Not authenticated - show login prompt
            <>
              <div class="flex flex-col items-center gap-4 py-4">
                <Icon name="github" size="large" class="text-text-subtle" />
                <div class="text-center">
                  <p class="text-14-regular text-text-base">GitHub 계정으로 로그인하면</p>
                  <p class="text-14-regular text-text-base">저장소를 자동으로 생성할 수 있습니다.</p>
                </div>
              </div>
              <div class="flex justify-center gap-3">
                <Button variant="ghost" size="large" onClick={handleSkip}>
                  건너뛰기
                </Button>
                <Button variant="primary" size="large" onClick={handleLogin}>
                  <Icon name="github" class="mr-2" />
                  GitHub로 로그인
                </Button>
              </div>
            </>
          }
        >
          {/* Authenticated - show repo creation form */}
          <div class="flex items-center gap-2 text-13-regular text-text-subtle">
            <Icon name="check" class="text-green-500" />
            <span>@{authStatus()?.username} 로그인됨</span>
          </div>

          <TextField
            label="Repository 이름"
            placeholder="my-awesome-project"
            value={repoName()}
            onInput={(e: InputEvent & { currentTarget: HTMLInputElement }) => setRepoName(e.currentTarget.value)}
            onKeyDown={(e: KeyboardEvent) => e.key === "Enter" && handleCreate()}
            autofocus
          />

          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                checked={!isPrivate()}
                onChange={() => setIsPrivate(false)}
                class="accent-primary"
              />
              <span class="text-14-regular text-text-base">Public</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                checked={isPrivate()}
                onChange={() => setIsPrivate(true)}
                class="accent-primary"
              />
              <span class="text-14-regular text-text-base">Private</span>
            </label>
          </div>

          <Show when={error()}>
            <p class="text-13-regular text-red-500">{error()}</p>
          </Show>

          <div class="flex justify-end gap-2">
            <Button variant="ghost" size="large" onClick={handleSkip}>
              건너뛰기
            </Button>
            <Button variant="primary" size="large" onClick={handleCreate} disabled={!repoName().trim() || isCreating()}>
              {isCreating() ? "생성 중..." : "생성"}
            </Button>
          </div>
        </Show>
      </div>
    </Dialog>
  )
}
