# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
bun install

# Run OpenCode in dev mode (runs against packages/opencode by default)
bun dev
bun dev <directory>    # Run against a specific directory
bun dev .              # Run against repo root

# Type checking
bun turbo typecheck    # All packages
bun run --cwd packages/opencode typecheck  # Single package

# Run tests (from packages/opencode)
bun run --cwd packages/opencode test

# Build standalone executable
./packages/opencode/script/build.ts --single

# Run the web app for UI development
bun run --cwd packages/app dev

# Run the desktop app (requires Tauri prerequisites)
bun run --cwd packages/desktop dev

# Regenerate SDK after API changes
./script/generate.ts
```

## Architecture

OpenCode is a monorepo using Bun workspaces with a client/server architecture.

### Core Packages

- **packages/opencode**: Core business logic & HTTP server. Contains:
  - `src/server/` - Hono-based HTTP server with SSE for real-time events
  - `src/cli/cmd/tui/` - Terminal UI built with SolidJS + opentui
  - `src/agent/` - AI agent implementation
  - `src/tool/` - Tool definitions (bash, file operations, etc.)
  - `src/session/` - Conversation session management
  - `src/provider/` - LLM provider integrations (Anthropic, OpenAI, etc.)
  - `src/lsp/` - Language Server Protocol integration
  - `src/mcp/` - Model Context Protocol support
  - `src/bus/` - Event bus for internal pub/sub

- **packages/app**: Shared web UI components (SolidJS + Tailwind)
  - `src/context/` - State management (file, session, layout contexts)
  - `src/components/` - Reusable UI components
  - `src/pages/` - Page components

- **packages/desktop**: Native desktop app (Tauri wrapper around packages/app)

- **packages/sdk**: TypeScript SDK for the OpenCode API
  - Generated from OpenAPI spec via `./script/generate.ts`

- **packages/plugin**: Plugin SDK (`@opencode-ai/plugin`)

### Event Flow

The server uses an Event Bus pattern:
1. Backend publishes events via `Bus.publish()`
2. Events stream to clients via SSE (`/event` endpoint)
3. Frontend subscribes via `sdk.event.listen()`

### Key Patterns

- State uses Solid.js stores with `createStore` and `produce` for immutable updates
- Files are watched via `@parcel/watcher` with events published through the bus
- LSP integration provides code intelligence for supported languages

## Style Guide

- Avoid `else` statements - use early returns
- Avoid `try/catch` - prefer `.catch()` on promises
- Avoid `let` - use `const` and immutable patterns
- Avoid `any` type - use precise types
- Prefer single-word variable names when descriptive
- Keep logic in single functions unless reuse is needed
- Use Bun APIs like `Bun.file()` when appropriate
- No semicolons (Prettier configured with `semi: false`)
