# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

OpenCode is an open source AI coding agent. It's a monorepo using:
- **Package manager**: Bun (v1.3+) - use `bun install` to setup
- **Monorepo tool**: Turbo for task orchestration
- **Language**: TypeScript (5.8.2)
- **Default branch**: `dev` (not main!)
- **Frontend**: SolidJS for TUI and web UI

Setup and development:
```bash
bun install
bun dev                    # Start OpenCode in packages/opencode
bun dev <directory>        # Run OpenCode in specific directory
bun run typecheck          # Type check all packages
```

## Project Structure

The monorepo contains several key packages:

| Package | Purpose |
|---------|---------|
| `packages/opencode` | Core business logic, CLI, server, and TUI (entry point) |
| `packages/app` | Web UI components in SolidJS |
| `packages/desktop` | Native desktop app wrapper using Tauri |
| `packages/console` | Dashboard/console components (core, app, mail, function, resource) |
| `packages/ui` | Shared UI component library |
| `packages/sdk/js` | JavaScript SDK for OpenCode |
| `packages/web` | Web-related components |
| `packages/plugin` | Source for @opencode-ai/plugin |

## Architecture Overview

OpenCode follows a client/server architecture:

- **Entry point**: `packages/opencode/src/index.ts` - CLI with yargs command routing
- **Core server**: `packages/opencode/src/server/` - HTTP server with agent logic
- **TUI**: `packages/opencode/src/cli/cmd/tui/` - Terminal UI in SolidJS using opentui
- **Agents**: `packages/opencode/src/agent/` - Agent implementations (build, plan, general)
- **Features by directory**:
  - `cli/cmd/` - CLI commands (run, serve, auth, models, etc.)
  - `lsp/` - Language server protocol integration
  - `mcp/` - Model Context Protocol integration
  - `plugin/` - Plugin system
  - `provider/` - AI provider integrations
  - `file/`, `shell/`, `pty/` - File, shell, and pseudo-terminal management
  - `config/`, `storage/`, `project/` - Configuration and state management

## Common Development Tasks

### Working on the TUI (Terminal Interface)
```bash
bun dev                # Start dev mode
# The TUI is in packages/opencode/src/cli/cmd/tui/, written in SolidJS
# Changes hot reload in dev mode
```

### Working on the Web UI
```bash
bun run --cwd packages/app dev    # Start web UI dev server
# Runs at http://localhost:5173 (or port shown in output)
```

### Working on the Desktop App
```bash
bun run --cwd packages/desktop dev
# Requires Tauri dependencies - see https://v2.tauri.app/start/prerequisites/
```

### Testing
```bash
cd packages/opencode
bun test              # Run tests
bun test --watch      # Watch mode
# Tests fail at root level (intentional) - run from packages/opencode only
```

### Type Checking
```bash
bun run typecheck          # Check all packages
cd packages/<package> && bun run typecheck  # Check specific package
```

### Building
```bash
cd packages/opencode && bun run build           # Build OpenCode
./packages/opencode/script/build.ts --single    # Build standalone executable
# Built binary in packages/opencode/dist/opencode-<platform>/bin/opencode
```

## Important Considerations

### After API Changes
If you modify the server API (`packages/opencode/src/server/server.ts`), regenerate the SDK:
```bash
./script/generate.ts   # Regenerates SDK and related files
```

### Regenerating JavaScript SDK
```bash
./packages/sdk/js/script/build.ts
```

### Debugging
The most reliable way to debug:
```bash
bun run --inspect=ws://localhost:6499/ dev
# Then attach your debugger to that URL
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed debugging setup with VSCode.

### Code Style Guide
Key principles from STYLE_GUIDE.md:

- Keep logic in a single function unless there's clear reuse
- Avoid unnecessary destructuring
- Avoid `else` statements
- Use `.catch()` instead of `try/catch` when possible
- Use precise types, avoid `any`
- Stick to immutable patterns (`const`, not `let`)
- Use single-word variable names where descriptive
- Leverage Bun APIs (e.g., `Bun.file()`)

### Development with Bun
- Use `bun run` with script files (not `bun`, which runs TypeScript directly)
- Example: `bun run --cwd packages/opencode --conditions=browser src/index.ts`
- Bun debugging uses WebSocket debugging URLs (`ws://localhost:port/`)

## Contribution Guidelines

Before submitting PRs, note:

- UI or core product features require design review from core team
- Look for issues with labels: `help wanted`, `good first issue`, `bug`, `perf`
- Keep PRs small and focused
- Link relevant issues in the PR description
- Check that new functionality doesn't already exist elsewhere

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full details.

## Key Technologies & Patterns

**Frontend Patterns:**
- SolidJS for reactive components (TUI and web UI)
- opentui for TUI components
- Tailwind CSS for styling
- Vite for web app bundling
- Kobalte for accessible components

**Backend Patterns:**
- Hono for HTTP server
- AI SDK (Vercel AI) for model integration
- Model Context Protocol (MCP) for extensibility
- Language Server Protocol (LSP) for IDE integration
- Tree-sitter for code parsing

**Development Patterns:**
- Bun for package management and runtime
- Turbo for monorepo task orchestration
- Prettier for code formatting (semi: false, printWidth: 120)
- Husky for git hooks

## Where to Find Things

| What | Where |
|------|-------|
| CLI commands | `packages/opencode/src/cli/cmd/` |
| TUI components | `packages/opencode/src/cli/cmd/tui/` |
| Server logic | `packages/opencode/src/server/` |
| Agent implementations | `packages/opencode/src/agent/` |
| Web UI | `packages/app/src/` |
| Shared utilities | `packages/util/` |
| Configuration | `packages/opencode/src/config/` |
| LSP support | `packages/opencode/src/lsp/` |
| MCP support | `packages/opencode/src/mcp/` |

## Performance Tips

- Use Turbo's caching: `bun turbo build --force` to skip cache
- For single package work: `cd packages/<name> && bun <script>` is faster than root-level commands
- Turbo runs tasks in parallel when possible (but respects `dependsOn` in turbo.json)
- Check `turbo.json` to understand task dependencies

## Documentation

- Installation & overview: [README.md](./README.md)
- Contribution process: [CONTRIBUTING.md](./CONTRIBUTING.md)  
- Agent architecture: [AGENTS.md](./AGENTS.md)
- Style guide: [STYLE_GUIDE.md](./STYLE_GUIDE.md)
- Official docs: https://opencode.ai/docs
