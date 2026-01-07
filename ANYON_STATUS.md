# ANYON 프로젝트 현황 및 다음 단계

> OpenCode를 ANYON으로 리브랜딩하여 독립 서비스로 배포하기 위한 작업 현황

---

## 1. 프로젝트 개요

| 항목 | 값 |
|------|-----|
| 원본 프로젝트 | OpenCode (github.com/opencode-ai/opencode) |
| 새 이름 | ANYON |
| CLI 명령어 | `anyon` |
| 패키지 네임스페이스 | `@anyon/*` |
| 앱 식별자 | `ai.anyon.desktop` |
| 도메인 | `anyon.cc` |
| GitHub 저장소 | `github.com/SL-IT-AMAZING/opencode` |

---

## 2. 완료된 작업

### Part 1: 리브랜딩 ✅

| 작업 | 파일 | 상태 |
|------|------|------|
| 패키지명 변경 | package.json (전체) | ✅ |
| Rust/Tauri 설정 | Cargo.toml, lib.rs, cli.rs, main.rs | ✅ |
| VS Code Extension | extension.ts, package.json | ✅ |
| Install Script | install | ✅ |
| Nix Build Scripts | bundle.ts, bun-build.ts | ✅ |
| 환경 변수 | OPENCODE_* → ANYON_* | ✅ |
| 로고/아이콘 | icons/dev, icons/prod, favicon | ✅ |

### Part 2: 서비스 독립화 ✅

| 작업 | 설명 | 상태 |
|------|------|------|
| ZEN 모델 제거 | opencode provider, 자동선택, 특별 처리 전부 삭제 | ✅ |
| 세션 공유 | opencode.ai fallback 제거, ANYON_API 환경변수 방식 | ✅ |
| GitHub URL | anomalyco/opencode → SL-IT-AMAZING/opencode (43개 파일) | ✅ |
| 도메인 변경 | opencode.ai → anyon.cc (120+ 파일) | ✅ |

---

## 3. 변경된 주요 파일 목록

### Rust/Tauri
```
packages/desktop/src-tauri/Cargo.toml      # name = "anyon-desktop"
packages/desktop/src-tauri/src/cli.rs      # CLI_BINARY_NAME = "anyon"
packages/desktop/src-tauri/src/lib.rs      # ANYON_* 환경변수, sidecar
packages/desktop/src-tauri/src/main.rs     # anyon_lib::run()
```

### 핵심 코드
```
packages/opencode/src/provider/provider.ts   # ZEN provider 삭제, X-Title: anyon
packages/opencode/src/share/share.ts         # ANYON_API 환경변수만 사용
packages/opencode/src/session/llm.ts         # opencode 헤더 제거
packages/opencode/src/acp/agent.ts           # opencode 자동선택 제거
packages/opencode/src/tool/registry.ts       # opencode 체크 제거
packages/opencode/src/provider/transform.ts  # opencode 특별 처리 제거
```

### UI/TUI
```
packages/opencode/src/cli/cmd/tui/component/dialog-provider.tsx  # ZEN UI 제거
packages/opencode/src/cli/cmd/tui/component/dialog-model.tsx     # Free 표시 제거
packages/opencode/src/cli/cmd/tui/component/tips.ts              # ZEN 팁 제거
packages/opencode/src/cli/cmd/tui/app.tsx                        # ZEN 추천 제거
```

---

## 4. 현재 상태

### 빌드 테스트
```bash
bun run typecheck  # ✅ 12개 패키지 성공
```

### 독립 운영 준비
- ✅ 원본 opencode.ai 서버 의존성 제거됨
- ✅ 모든 URL이 anyon.cc로 변경됨
- ✅ 세션 공유는 ANYON_API 환경변수로 선택적 활성화

---

## 5. 남은 작업

### 5.1 데스크톱 앱 빌드 및 테스트

```bash
# 개발 모드 실행
cd packages/desktop
bun run dev

# 프로덕션 빌드
bun run build
```

**확인 사항:**
- [ ] 앱이 정상 실행되는가
- [ ] `anyon` CLI 명령어가 동작하는가
- [ ] Provider 연결이 정상 동작하는가 (Anthropic, OpenAI 등)
- [ ] 세션 생성/저장이 정상 동작하는가

### 5.2 GitHub Releases 설정

자동 업데이터가 동작하려면 GitHub Releases에 빌드 결과물 업로드 필요:

```
SL-IT-AMAZING/opencode/releases
├── anyon-darwin-arm64.zip
├── anyon-darwin-x64.zip
├── anyon-linux-arm64.tar.gz
├── anyon-linux-x64.tar.gz
├── anyon-windows-x64.zip
└── latest.json  # Tauri 자동 업데이터용
```

### 5.3 DNS 설정 (anyon.cc)

웹사이트/API 배포 시 필요한 서브도메인:

| 서브도메인 | 용도 | 코드 위치 |
|-----------|------|----------|
| `anyon.cc` | 메인 웹사이트 | packages/web/ |
| `api.anyon.cc` | Share API, 토큰 교환 | packages/console/app/ |
| `auth.anyon.cc` | OAuth 인증 | packages/console/function/ |
| `app.anyon.cc` | 웹 콘솔 | packages/console/app/ |
| `docs.anyon.cc` | 문서 | packages/docs/ |

### 5.4 OAuth 설정 (웹 콘솔용)

웹 콘솔을 배포하려면 OAuth 앱 생성 필요:

**GitHub OAuth:**
1. GitHub Developer Settings → OAuth Apps → New
2. Authorization callback URL: `https://auth.anyon.cc/callback`
3. Client ID/Secret을 환경변수로 설정

**Google OAuth:**
1. Google Cloud Console → Credentials → Create OAuth client ID
2. Authorized redirect URIs: `https://auth.anyon.cc/callback`
3. Client ID/Secret을 환경변수로 설정

### 5.5 인프라 시크릿 설정

`infra/console.ts`에서 사용하는 시크릿:

```bash
# SST 시크릿 설정
sst secret set GITHUB_CLIENT_ID_CONSOLE "your-github-client-id"
sst secret set GITHUB_CLIENT_SECRET_CONSOLE "your-github-client-secret"
sst secret set GOOGLE_CLIENT_ID "your-google-client-id"
sst secret set GOOGLE_CLIENT_SECRET "your-google-client-secret"
sst secret set STRIPE_SECRET_KEY "your-stripe-key"  # 결제 기능용
```

---

## 6. 환경 변수 정리

### 클라이언트 (데스크톱 앱)

| 변수 | 용도 | 예시 |
|------|------|------|
| `ANYON_API` | 세션 공유 API URL | `https://api.anyon.cc` |
| `ANYON_VERSION` | 앱 버전 | `1.0.0` |
| `ANYON_CHANNEL` | 릴리스 채널 | `stable`, `preview` |

### 서버 (웹 콘솔)

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | PlanetScale DB 연결 |
| `GITHUB_CLIENT_ID_CONSOLE` | GitHub OAuth |
| `GITHUB_CLIENT_SECRET_CONSOLE` | GitHub OAuth |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `STRIPE_SECRET_KEY` | Stripe 결제 |

---

## 7. 배포 옵션

### Option A: 데스크톱 앱만 배포 (최소 구성)

필요한 것:
- GitHub Releases에 빌드 결과물 업로드
- (선택) 설치 스크립트 호스팅

```bash
# 사용자 설치 방법
curl -fsSL https://anyon.cc/install | bash
# 또는
curl -fsSL https://raw.githubusercontent.com/SL-IT-AMAZING/opencode/main/install | bash
```

### Option B: 전체 서비스 배포

필요한 것:
- DNS 설정 (anyon.cc 및 서브도메인)
- Cloudflare Workers (API, Auth)
- Vercel/Cloudflare Pages (웹사이트, 문서)
- PlanetScale (데이터베이스)
- Stripe (결제, 선택)
- GitHub/Google OAuth 앱

---

## 8. 즉시 테스트 가능한 것

```bash
# 1. 타입 체크
bun run typecheck

# 2. 테스트 실행
bun run test

# 3. 데스크톱 앱 개발 모드
cd packages/desktop && bun run dev

# 4. CLI 직접 실행
cd packages/opencode && bun run dev
```

---

## 9. 체크리스트

### 배포 전 필수
- [ ] 데스크톱 앱 빌드 테스트
- [ ] CLI 기능 테스트
- [ ] Provider 연결 테스트

### 웹 서비스 배포 시
- [ ] DNS 설정
- [ ] OAuth 앱 생성
- [ ] 인프라 시크릿 설정
- [ ] DB 마이그레이션

### 릴리스 시
- [ ] GitHub Releases 생성
- [ ] 버전 태그 생성
- [ ] 변경 로그 작성

---

## 10. 참고 링크

- GitHub 저장소: https://github.com/SL-IT-AMAZING/opencode
- 원본 프로젝트: https://github.com/opencode-ai/opencode

---

## 11. 실행 계획 (Action Plan)

### Phase A: 로컬 테스트 (즉시 가능)

```
예상 소요: 1-2시간
```

| 순서 | 작업 | 명령어 | 확인 사항 |
|------|------|--------|----------|
| A-1 | CLI 테스트 | `cd packages/opencode && bun run dev` | anyon 명령어 실행 |
| A-2 | Provider 연결 | CLI에서 `/connect` | Anthropic/OpenAI API 키 설정 |
| A-3 | 채팅 테스트 | 모델 선택 후 대화 | 응답 정상 수신 |
| A-4 | 데스크톱 앱 | `cd packages/desktop && bun run dev` | 앱 UI 정상 표시 |
| A-5 | 전체 테스트 | `bun run test` | 테스트 통과 |

**완료 기준:** CLI와 데스크톱 앱이 정상 동작

---

### Phase B: 첫 릴리스 빌드 (1일)

```
예상 소요: 반나절
의존성: Phase A 완료
```

| 순서 | 작업 | 설명 |
|------|------|------|
| B-1 | 버전 설정 | package.json에서 version 확인/수정 |
| B-2 | 프로덕션 빌드 | `bun run build` |
| B-3 | 바이너리 생성 | macOS, Linux, Windows용 빌드 |
| B-4 | 로컬 설치 테스트 | 빌드된 바이너리로 설치 테스트 |
| B-5 | GitHub Release 생성 | 태그 생성 및 바이너리 업로드 |

**산출물:**
```
releases/v1.0.0/
├── anyon-darwin-arm64.zip
├── anyon-darwin-x64.zip
├── anyon-linux-arm64.tar.gz
├── anyon-linux-x64.tar.gz
├── anyon-windows-x64.zip
└── latest.json
```

---

### Phase C: 설치 스크립트 배포 (선택)

```
예상 소요: 2-3시간
의존성: Phase B 완료
```

| 순서 | 작업 | 설명 |
|------|------|------|
| C-1 | install 스크립트 호스팅 | GitHub raw 또는 anyon.cc/install |
| C-2 | 설치 테스트 | `curl -fsSL [URL] \| bash` |
| C-3 | 자동 업데이터 테스트 | 앱 내 업데이트 확인 기능 |

**사용자 설치 방법 (완료 후):**
```bash
curl -fsSL https://anyon.cc/install | bash
# 또는
curl -fsSL https://raw.githubusercontent.com/SL-IT-AMAZING/opencode/main/install | bash
```

---

### Phase D: 웹 서비스 배포 (선택, 대규모)

```
예상 소요: 1-2일
의존성: Phase B 완료, DNS 설정
```

#### D-1: DNS 설정
```
anyon.cc          A/CNAME  → 호스팅 서버
api.anyon.cc      CNAME    → Cloudflare Workers
auth.anyon.cc     CNAME    → Cloudflare Workers
app.anyon.cc      CNAME    → Vercel/Cloudflare
docs.anyon.cc     CNAME    → Vercel
```

#### D-2: 데이터베이스 설정
```bash
# PlanetScale 또는 다른 MySQL 호환 DB
# infra/console.ts의 organization 변경 필요
```

#### D-3: OAuth 앱 생성
```
GitHub OAuth App:
  - Homepage: https://anyon.cc
  - Callback: https://auth.anyon.cc/callback

Google OAuth:
  - Authorized origins: https://anyon.cc
  - Redirect URI: https://auth.anyon.cc/callback
```

#### D-4: 인프라 배포
```bash
# SST로 배포 (infra/ 폴더)
bunx sst deploy --stage production
```

#### D-5: 시크릿 설정
```bash
sst secret set GITHUB_CLIENT_ID_CONSOLE "xxx"
sst secret set GITHUB_CLIENT_SECRET_CONSOLE "xxx"
sst secret set GOOGLE_CLIENT_ID "xxx"
sst secret set GOOGLE_CLIENT_SECRET "xxx"
```

---

### Phase E: 세션 공유 활성화 (선택)

```
예상 소요: 2-3시간
의존성: Phase D 완료 (api.anyon.cc 필요)
```

| 순서 | 작업 | 설명 |
|------|------|------|
| E-1 | Share API 배포 | packages/console/app의 share 엔드포인트 |
| E-2 | 클라이언트 설정 | `ANYON_API=https://api.anyon.cc` |
| E-3 | 공유 테스트 | 세션 공유 → URL 생성 → 열기 |

---

## 12. 권장 순서

### 최소 배포 (데스크톱 앱만)
```
Phase A → Phase B → Phase C
예상 소요: 1-2일
```

### 전체 배포 (웹 서비스 포함)
```
Phase A → Phase B → Phase C → Phase D → Phase E
예상 소요: 3-5일
```

---

## 13. 즉시 시작하기

```bash
# 1. 지금 바로 테스트
cd packages/opencode
bun run dev

# 2. 다른 터미널에서 데스크톱 앱
cd packages/desktop
bun run dev
```

---

*마지막 업데이트: 2026-01-07*
