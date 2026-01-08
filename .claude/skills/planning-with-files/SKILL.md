---
name: planning-with-files
description: Transforms workflow to use Manus-style persistent markdown files for planning, progress tracking, and knowledge storage. Use when starting complex tasks, multi-step projects, research tasks, or when the user mentions planning, organizing work, tracking progress, or wants structured output.
---

# Planning with Files

Work like Manus: Use persistent markdown files as your "working memory on disk."

## File Location

Create all planning files in a dedicated `.planning/` folder at the project root:

```
project-root/.planning/
├── task_plan.md      # Progress tracking
├── notes.md          # Research findings
└── [deliverable].md  # Final output
```

## Quick Start

Before ANY complex task:

1. **Create `.planning/` folder** in the project root (if not exists)
2. **Create `task_plan.md`** in `.planning/`
3. **Define phases** with checkboxes
4. **Update after each phase** - mark [x] and change status
5. **Read before deciding** - refresh goals in attention window

## The 3-File Pattern

For every non-trivial task, create THREE files in `.planning/`:

| File                         | Purpose                     | When to Update   |
| ---------------------------- | --------------------------- | ---------------- |
| `.planning/task_plan.md`     | Track phases and progress   | After each phase |
| `.planning/notes.md`         | Store findings and research | During research  |
| `.planning/[deliverable].md` | Final output                | At completion    |

## Core Workflow

```
Loop 1: Create .planning/task_plan.md with goal and phases
Loop 2: Research → save to .planning/notes.md → update task_plan.md
Loop 3: Read notes.md → create deliverable → update task_plan.md
Loop 4: Deliver final output
```

### The Loop in Detail

**Before each major action:**

```bash
Read .planning/task_plan.md  # Refresh goals in attention window
```

**After each phase:**

```bash
Edit .planning/task_plan.md  # Mark [x], update status
```

**When storing information:**

```bash
Write .planning/notes.md     # Don't stuff context, store in file
```

## task_plan.md Template

Create `.planning/task_plan.md` FIRST for any complex task:

```markdown
# Task Plan: [Brief Description]

## Goal

[One sentence describing the end state]

## Phases

- [ ] Phase 1: Plan and setup
- [ ] Phase 2: Research/gather information
- [ ] Phase 3: Execute/build
- [ ] Phase 4: Review and deliver

## Key Questions

1. [Question to answer]
2. [Question to answer]

## Decisions Made

- [Decision]: [Rationale]

## Errors Encountered

- [Error]: [Resolution]

## Status

**Currently in Phase X** - [What I'm doing now]
```

## notes.md Template

Create `.planning/notes.md` for research and findings:

```markdown
# Notes: [Topic]

## Sources

### Source 1: [Name]

- URL: [link]
- Key points:
  - [Finding]
  - [Finding]

## Synthesized Findings

### [Category]

- [Finding]
- [Finding]
```

## Critical Rules

### 1. ALWAYS Create Plan First

Never start a complex task without `.planning/task_plan.md`. This is non-negotiable.

### 2. Read Before Decide

Before any major decision, read the plan file. This keeps goals in your attention window.

### 3. Update After Act

After completing any phase, immediately update the plan file:

- Mark completed phases with [x]
- Update the Status section
- Log any errors encountered

### 4. Store, Don't Stuff

Large outputs go to files, not context. Keep only paths in working memory.

### 5. Log All Errors

Every error goes in the "Errors Encountered" section. This builds knowledge for future tasks.

## When to Use This Pattern

**Use 3-file pattern for:**

- Multi-step tasks (3+ steps)
- Research tasks
- Building/creating something
- Tasks spanning multiple tool calls
- Anything requiring organization

**Skip for:**

- Simple questions
- Single-file edits
- Quick lookups

## Anti-Patterns to Avoid

| Don't                         | Do Instead                           |
| ----------------------------- | ------------------------------------ |
| Use TodoWrite for persistence | Create `.planning/task_plan.md` file |
| State goals once and forget   | Re-read plan before each decision    |
| Hide errors and retry         | Log errors to plan file              |
| Stuff everything in context   | Store large content in `.planning/`  |
| Start executing immediately   | Create `.planning/` folder FIRST     |

## Advanced Patterns

See [reference.md](reference.md) for:

- Attention manipulation techniques
- Error recovery patterns
- Context optimization from Manus

See [examples.md](examples.md) for:

- Real task examples
- Complex workflow patterns
