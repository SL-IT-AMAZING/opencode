# Task Plan: ANYON 프로젝트 커스터마이징

## Goal

OpenCode를 ANYON으로 리브랜딩하고, 자체 서비스로 독립 배포할 수 있도록 커스터마이징한다.

---

## Part 1: 리브랜딩 (완료 ✅)

### Phases

- [x] Phase 1: 패키지명/의존성 변경 ✅
- [x] Phase 2: 코드 내 opencode 참조 변경 ✅
- [x] Phase 3: Tauri 설정 파일 변경 ✅
- [x] Phase 4: 로고/아이콘 파일 교체 ✅
- [x] Phase 5: 환경 변수 변경 ✅
- [x] Phase 6: 빌드 스크립트 변경 ✅
- [x] Phase 8: 빌드 테스트 통과 ✅

### 수정된 파일 목록

**Rust/Tauri:**

- packages/desktop/src-tauri/Cargo.toml
- packages/desktop/src-tauri/src/cli.rs
- packages/desktop/src-tauri/src/lib.rs
- packages/desktop/src-tauri/src/main.rs

**VS Code Extension:**

- sdks/vscode/src/extension.ts

**Install Script:**

- install

**Nix Build Scripts:**

- nix/bundle.ts
- nix/scripts/bun-build.ts

---

## Part 2: 서비스 독립화 (진행 예정)

### 목표

원본 opencode.ai 서버 의존성을 제거하고, 자체 서비스(anyon.cc)로 독립 운영

### Phases

- [x] Phase 2-1: ZEN 모델 제거 ✅
- [x] Phase 2-2: 세션 공유 기능 - ANYON_API 환경 변수 방식으로 변경 ✅
- [ ] Phase 2-3: OAuth 인증 - 자체 Auth 서버 연결 (웹 콘솔용)
- [x] Phase 2-4: GitHub repo URL 정리 → SL-IT-AMAZING/opencode ✅
- [x] Phase 2-5: 도메인 변경 opencode.ai → anyon.cc ✅
- [ ] Phase 2-6: 최종 빌드 및 배포 테스트

---

## Phase 2-1: ZEN 모델 제거

### 개요

OpenCode ZEN은 원본 프로젝트가 제공하는 유료 AI 모델 프록시 서비스.
ANYON에서는 사용자가 직접 API 키를 설정하는 방식으로 변경.

### 삭제 대상

| 파일                                            | 내용                        |
| ----------------------------------------------- | --------------------------- |
| `src/provider/provider.ts`                      | opencode provider 정의      |
| `src/cli/cmd/tui/component/dialog-provider.tsx` | ZEN 안내 UI                 |
| `src/cli/cmd/tui/component/dialog-model.tsx`    | opencode 모델 특별 처리     |
| `src/cli/cmd/tui/component/tips.ts`             | ZEN 팁 메시지               |
| `src/cli/cmd/tui/app.tsx`                       | ZEN 추천 메시지             |
| `src/acp/agent.ts`                              | opencode provider 자동 선택 |
| `src/tool/registry.ts`                          | opencode provider 체크      |
| `src/provider/transform.ts`                     | opencode 모델 특별 처리     |
| `src/session/llm.ts`                            | opencode 헤더               |

### 상태

- [x] 코드 분석 완료 ✅
- [x] 삭제 작업 진행 ✅
- [x] 빌드 테스트 ✅

### 완료된 변경사항

1. `provider.ts`: zenmux provider 제거, opencode 자동선택 제거, X-Title 헤더 anyon으로 변경
2. `dialog-provider.tsx`: ZEN 안내 UI 제거
3. `dialog-model.tsx`: opencode 모델 필터링/정렬/"Free" 표시 제거
4. `tips.ts`: ZEN 팁 제거, docker 이미지 anyon으로 변경
5. `app.tsx`: openrouter 경고에서 ZEN 추천 제거
6. `acp/agent.ts`: opencode provider 자동선택 제거, model undefined 처리 추가
7. `tool/registry.ts`: opencode provider 체크 제거
8. `transform.ts`: opencode 모델 특별 처리 제거
9. `llm.ts`: opencode 전용 HTTP 헤더 제거

---

## Phase 2-2: 세션 공유 기능

### 현재 구조

```
packages/opencode/src/share/share.ts
- API URL: process.env["ANYON_API"] ?? "https://api.anyon.cc"
- 엔드포인트:
  - /share_create (세션 생성)
  - /share_sync (세션 동기화)
  - /share_delete (세션 삭제)
```

### 필요 작업

- [ ] 자체 Share API 서버 구현 (또는 기존 사용)
- [ ] ANYON_API 환경 변수로 자체 서버 연결
- [ ] 테스트

---

## Phase 2-3: OAuth 인증

### 현재 구조

```
infra/console.ts
- auth.anyon.cc에서 처리
- GitHub OAuth, Google OAuth
- Cloudflare Worker로 구현
```

### 필요 작업

- [ ] 자체 OAuth 서버 구현 (또는 기존 사용)
- [ ] GitHub/Google OAuth 앱 생성
- [ ] 클라이언트 코드에서 auth URL 변경
- [ ] 테스트

---

## Phase 2-4: GitHub repo URL 정리

### 현재 상태

- `install` 스크립트: `github.com/SL-IT-AMAZING/opencode` ✅
- 나머지: `github.com/SL-IT-AMAZING/opencode` (변경 필요)

### 변경 필요한 파일

- tauri.prod.conf.json (자동 업데이터)
- packages/extensions/zed/extension.toml
- packages/console/app/src/routes/download/
- README.md, CONTRIBUTING.md
- 기타 문서

### 결정 필요

- 실제 GitHub repo URL 확정 필요

---

## Status

**Part 1 완료, Part 2 완료, Phase B 완료 ✅**

마지막 빌드 테스트: 2026-01-07

- `bun run typecheck`: 12개 패키지 성공
- CLI 바이너리 빌드 성공 (`anyon-darwin-arm64`)
- 로컬 설치 테스트 통과

### 완료된 작업

- [x] ZEN 모델 관련 코드 전부 제거
- [x] GitHub URL → SL-IT-AMAZING/opencode 변경 (43개 파일)
- [x] share.ts: opencode.ai fallback 제거, ANYON_API 환경 변수 방식으로 변경
- [x] opencode.ai → anyon.cc 도메인 변경 (120+ 파일)
- [x] 바이너리 이름 opencode → anyon 변경

### Phase B: 첫 릴리스 빌드 (완료 ✅)

- [x] B-1: 버전 설정 확인 ✅
- [x] B-2: 프로덕션 빌드 ✅
- [x] B-3: 바이너리 확인 ✅
- [x] B-4: 로컬 설치 테스트 ✅

### 수정된 파일 (Phase B)

- `packages/opencode/script/build.ts`: outfile 및 user-agent를 `anyon`으로 변경
- `packages/opencode/script/publish.ts`: smoke test 및 docker 이미지 이름 변경
- `packages/opencode/script/publish-registries.ts`: AUR/Homebrew 패키지명 및 바이너리명 변경
- `packages/desktop/scripts/predev.ts`: 바이너리 경로 `bin/anyon`으로 변경
- `packages/desktop/scripts/prepare.ts`: 바이너리 경로 `bin/anyon`으로 변경
- `nix/desktop.nix`: pname, sidecar 경로, mainProgram 등 변경
- `nix/opencode.nix`: pname, 환경변수, 경로, mainProgram 등 변경
- `flake.nix`: desktop 빌더에 `anyon` 인자 전달

### 남은 작업

- OAuth 인증 설정 (웹 콘솔 배포 시)
- GitHub Release 생성 및 배포
