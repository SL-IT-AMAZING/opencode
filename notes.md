# Notes: ANYON 프로젝트 커스터마이징

## 브랜딩 요소 (확정)

| 항목 | 값 |
|------|-----|
| 앱 이름 | ANYON |
| CLI 명령어 | `anyon` (소문자) |
| 패키지 네임스페이스 | `@anyon` |
| 앱 식별자 | `ai.anyon.desktop` |
| 로고 | 나선형 흰색 디자인 (Group 11.svg) |

---

## Part 1: 리브랜딩 완료 내역

### 패키지명 변경
| 이전 | 이후 |
|------|------|
| `opencode` | `anyon` |
| `@opencode-ai/*` | `@anyon/*` |

### Rust/Tauri 파일 (완료 ✅)
1. `Cargo.toml`: name = "anyon-desktop", lib name = "anyon_lib"
2. `cli.rs`: CLI_INSTALL_DIR=".anyon/bin", CLI_BINARY_NAME="anyon"
3. `lib.rs`: sidecar "anyon-cli", ANYON_* 환경 변수, window.__ANYON__
4. `main.rs`: anyon_lib::run(), ANYON_ALLOW_WAYLAND

### VS Code Extension (완료 ✅)
- package.json: name="anyon", commands="anyon.*"
- extension.ts: TERMINAL_NAME="anyon", ANYON_CALLER, anyon CLI 명령

### Install Script (완료 ✅)
- APP=anyon, INSTALL_DIR=~/.anyon/bin
- ASCII 로고 ANYON으로 변경

### Nix Build Scripts (완료 ✅)
- nix/bundle.ts: ANYON_VERSION, ANYON_CHANNEL
- nix/scripts/bun-build.ts: anyon-assets.manifest, anyon 바이너리

### 빌드 테스트 결과
```
bun run typecheck: 12개 패키지 성공
- @anyon/app, @anyon/console-app, @anyon/console-core
- @anyon/console-function, @anyon/desktop, @anyon/enterprise
- @anyon/plugin, @anyon/sdk, @anyon/slack
- @anyon/ui, @anyon/util, anyon
```

---

## Part 2: 서비스 독립화 기술 노트

### 원본 opencode 서비스 구조

```
opencode 프로젝트가 제공하는 클라우드 서비스:

1. ZEN 게이트웨이 (AI 모델 프록시)
   - providerID: "opencode"
   - 모델: gpt-5-nano, big-pickle, claude-*, glm-4.6, kimi-k2 등
   - "무료 모델" 기능의 핵심
   - infra/console.ts의 ZEN_MODELS 시크릿으로 관리

2. 세션 공유 API
   - 엔드포인트: api.anyon.cc
   - /share_create, /share_sync, /share_delete
   - packages/opencode/src/share/share.ts

3. OAuth 인증
   - 엔드포인트: auth.anyon.cc
   - GitHub, Google OAuth
   - infra/console.ts에 정의

4. 웹 콘솔 (anyon.cc)
   - packages/console/app
   - 계정 관리, 구독, 결제 (Stripe)
   - PlanetScale DB
```

### ZEN 모델 관련 코드 위치

```
packages/opencode/src/provider/provider.ts
- line 370: zenmux provider 정의
- line 1051: opencode provider 우선순위 처리
- line 1065-1069: opencode provider 자동 선택

packages/opencode/src/cli/cmd/tui/component/dialog-provider.tsx
- line 198-204: ZEN 안내 UI ("OpenCode Zen gives you access...")

packages/opencode/src/cli/cmd/tui/component/dialog-model.tsx
- line 14: opencode provider 필터링
- line 60-61, 91-92, 133-134: opencode 모델 "Free" 표시

packages/opencode/src/cli/cmd/tui/component/tips.ts
- line 96: ZEN 팁 메시지

packages/opencode/src/cli/cmd/tui/app.tsx
- line 534: openrouter 경고 + ZEN 추천

packages/opencode/src/acp/agent.ts
- line 1020-1045: opencode provider 자동 선택 로직

packages/opencode/src/tool/registry.ts
- line 123: opencode provider 체크 (Exa 도구)

packages/opencode/src/provider/transform.ts
- line 452: opencode 모델 특별 처리 (kimi, glm)
- line 483: opencode 모델 프롬프트 캐시

packages/opencode/src/session/llm.ts
- line 164-169: opencode provider HTTP 헤더
```

### 세션 공유 구조

```typescript
// packages/opencode/src/share/share.ts

export const URL =
  process.env["ANYON_API"] ??
  (Installation.isPreview() || Installation.isLocal()
    ? "https://api.dev.anyon.cc"
    : "https://api.anyon.cc")

// 엔드포인트:
// POST /share_create { sessionID } → { url, secret }
// POST /share_sync { sessionID, secret, key, content }
// POST /share_delete { sessionID, secret }
```

### OAuth 인증 구조

```typescript
// infra/console.ts

const GITHUB_CLIENT_ID_CONSOLE = new sst.Secret("GITHUB_CLIENT_ID_CONSOLE")
const GITHUB_CLIENT_SECRET_CONSOLE = new sst.Secret("GITHUB_CLIENT_SECRET_CONSOLE")
const GOOGLE_CLIENT_ID = new sst.Secret("GOOGLE_CLIENT_ID")

export const auth = new sst.cloudflare.Worker("AuthApi", {
  domain: `auth.${domain}`,  // auth.anyon.cc
  handler: "packages/console/function/src/auth.ts",
  // ...
})
```

---

## GitHub URL 현황

### 이미 변경됨
- `install`: github.com/SL-IT-AMAZING/opencode

### 아직 변경 안 됨 (SL-IT-AMAZING/opencode)
- tauri.prod.conf.json (자동 업데이터 - 중요!)
- packages/extensions/zed/extension.toml
- packages/console/app/src/routes/download/
- packages/console/app/src/config.ts
- packages/opencode/src/cli/cmd/tui/app.tsx (이슈 URL)
- packages/opencode/src/session/prompt/*.txt
- README.md, CONTRIBUTING.md
- sdks/vscode/README.md, package.json
- nix/opencode.nix
- 기타 다수

---

## 결정 필요 사항

1. **ZEN 모델 제거 방식**
   - 전체 삭제 vs 코드만 비활성화

2. **세션 공유 서버**
   - 자체 구현 vs 기능 제거

3. **OAuth 서버**
   - 자체 구현 vs 다른 인증 방식

4. **GitHub repo URL**
   - 실제 repo 이름 확정 필요
   - SL-IT-AMAZING/opencode? yourorg/anyon?

---

## 환경 변수 매핑

| 이전 | 이후 | 용도 |
|------|------|------|
| OPENCODE_VERSION | ANYON_VERSION | 버전 |
| OPENCODE_CHANNEL | ANYON_CHANNEL | 릴리스 채널 |
| OPENCODE_API | ANYON_API | Share API URL |
| OPENCODE_CLIENT | ANYON_CLIENT | 클라이언트 식별 |
| OPENCODE_CALLER | ANYON_CALLER | 호출자 (vscode 등) |
| OPENCODE_BIN_PATH | ANYON_BIN_PATH | 바이너리 경로 |

---

## 로고 파일 위치

```
packages/ui/src/assets/favicon/
packages/desktop/src-tauri/icons/dev/
packages/desktop/src-tauri/icons/prod/
sdks/vscode/images/
```
