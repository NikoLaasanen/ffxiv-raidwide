# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

We're building the app described in @TECHNICAL_DOCUMENTATION.md. Read that file for general architectual task or to double-check the exact database structure, tech stack or application architecture.
When you need specific database structure information, first look @DATABASE_STRUCTURE.md for specifics.

When working with any third-party libraries or something similar, you MUST look up the official documentation to ensure you are working with up-to-date information. 
Use the DocsExplorer subagent for efficient documentation lookup.

Keep your replies extremely concise and focus on conveying the key information. No unnecessary fluff, no long code snippets.

@AGENTS.md

## Commands

This project uses **Bun** as the package manager and runtime.

```bash
bun run dev        # Start dev server (Turbopack, outputs to .next/dev)
bun run build      # Production build (Turbopack)
bun run start      # Start production server
bun run lint       # Run ESLint
bun run lint:fix   # Run ESLint with auto-fix
```

No test runner is configured yet.

## Next.js 16 Breaking Changes

This project uses **Next.js 16**, which has significant breaking changes from 15:

- **Async Request APIs**: `cookies()`, `headers()`, `draftMode()`, route `params`, and page `searchParams` are now fully async — always `await` them. Synchronous access was removed.
- **`middleware` → `proxy`**: The middleware file is now `proxy.ts` / `proxy.js` with a named export `proxy`. The `edge` runtime is not supported in `proxy` — use `nodejs` only.
- **Linting**: `next lint` is removed. Use `npm run lint` (ESLint CLI directly). `next build` no longer runs the linter.
- **Runtime config removed**: `serverRuntimeConfig` and `publicRuntimeConfig` are gone. Use `process.env` and `NEXT_PUBLIC_` prefixes instead.
- **`revalidateTag` signature changed**: Now requires a second `cacheLife` argument (e.g., `revalidateTag('posts', 'max')`). Use `updateTag` for read-your-writes semantics in Server Actions.
- **`cacheLife`/`cacheTag`**: No longer need `unstable_` prefix.
- **PPR**: `experimental_ppr` segment config removed. Use top-level `cacheComponents: true` in `next.config.ts`.
- **Turbopack**: Default for both `next dev` and `next build`. To opt out: `next build --webpack`.
- **Parallel routes**: All `@slot/default.js` files are now required; builds fail without them.
- **`next/legacy/image`**: Deprecated — use `next/image`.
- **`images.domains`**: Deprecated — use `images.remotePatterns`.

## Architecture

The app is an **FFXIV Mitigation Planner** — an interactive raid planning tool for Final Fantasy XIV built around a vertical timeline. The tech stack described in `TECHNICAL_DOCUMENTATION.md`:

- **Next.js 16** App Router, **TypeScript**, **Tailwind CSS v4**
- **Zustand** — global client state
- **TanStack Query** — async/server data fetching
- **Radix UI** + **ShadCN/UI** — component primitives
- **React Window** — virtualized timeline performance
- **Firebase Firestore** — plan storage, real-time collaboration, encounter presets
- **FFLogs API v2 (GraphQL)** — fight import
- **XIVAPI** — ability metadata and icons

### Planned Routes

| Route | Purpose |
|---|---|
| `/` | Homepage: FFLogs URL import, recently viewed plans, create new plan |
| `/plan/[id]` | Core plan editor: vertical timeline, mitigation assignment, cooldown logic |
| `/library` | Ability library: toggle abilities per job |
| `/encounters` | Encounter presets browser, grouped by raid tier |

### Import Alias

`@/*` maps to the repo root (e.g., `@/app/...`, `@/components/...`).

### Key Data Shapes

Plans are stored in Firestore with `editLinkId` / `viewLinkId` for access control. A `TimelineRow` holds a timestamp, boss ability name, damage event info, and per-player mistake state. `MitigationAssignment` links a player + ability to a timestamp. See `TECHNICAL_DOCUMENTATION.md` §4 for full type definitions.

### API Routes

Next.js API routes (under `app/api/`) handle FFLogs import, XIVAPI proxying, and auto-planning. These run as server-side Route Handlers using `export async function GET/POST(request: Request)`.
