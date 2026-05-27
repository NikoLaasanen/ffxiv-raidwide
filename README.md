# FFXIV Raidwide

An interactive raid mitigation planner for Final Fantasy XIV. Build cooldown plans on a vertical boss-ability timeline, import fights from FFLogs, and share plans with your static via edit/view links.

## Features

- **Vertical timeline** — boss abilities mapped to a scrollable timeline with per-player mitigation assignments
- **Cooldown tracking** — automatic cooldown conflict detection and damage/mitigation calculations
- **FFLogs import** — pull encounter data directly from a log URL to populate the timeline
- **Plan comparison** — overlay actual FFLogs execution against your planned mitigation
- **Mistake analysis** — death, vulnerability, and damage-down timeline per player
- **Plan sharing** — unique edit and view-only links, with optional real-time collaboration
- **Encounter presets** — pre-built timelines for current raid tiers

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS v4, Radix UI, ShadCN/UI |
| State | Zustand, TanStack Query |
| Database | Firebase Firestore |
| External APIs | FFLogs GraphQL v2, XIVAPI |

## Routes

| Route | Purpose |
|---|---|
| `/` | Homepage: FFLogs URL import, recently viewed plans, create new plan |
| `/plan/new` | Create a new empty plan |
| `/plan/[id]` | Core plan editor: timeline, mitigation assignment, cooldown logic |
| `/plan/view/[id]` | Read-only shared view of a plan (via `viewLinkId`) |
| `/plan/[id]/compare` | Overlay FFLogs execution on planned timeline |
| `/plan/[id]/mistakes` | Death/vuln/damage-down timeline and per-player summary |
| `/my-plans` | All plans saved by the user (localStorage) |
| `/library` | Ability library: toggle abilities per job |
| `/encounters` | Encounter presets browser, grouped by raid tier |
| `/admin` | Admin panel: manage job abilities and encounter presets |

## Getting Started

```bash
bun install
bun run dev
```

## Commands

```bash
bun run dev        # Start dev server (Turbopack)
bun run build      # Production build
bun run start      # Start production server
bun run lint       # Run ESLint
bun run lint:fix   # Run ESLint with auto-fix
```

## Environment Variables

Create a `.env.local` file at the project root:

```env
# Firebase (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-side)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# FFLogs API
FFLOGS_CLIENT_ID=
FFLOGS_CLIENT_SECRET=
```

## Docs

- [Technical Documentation](TECHNICAL_DOCUMENTATION.md) — architecture, data shapes, API design
- [Database Structure](DATABASE_STRUCTURE.md) — Firestore collection schemas
