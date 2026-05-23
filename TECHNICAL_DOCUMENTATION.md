# FFXIV Mitigation Planner – Final Technical Documentation

**Next.js + Bun + Firestore + Radix/ShadCN + Tailwind**

## 1. Project Overview

A modern, interactive raid planning tool for Final Fantasy XIV, built around a vertical timeline that supports:

- Mitigation planning
- Offensive cooldown planning
- Mistake analysis
- Plan comparison
- FFLogs integration
- Shareable view/edit links
- Optional real‑time collaboration
- Encounter presets
- Auto‑planning

The app is designed to be usable without authentication, with optional cloud features.

## 2. Tech Stack

### Frontend

- Next.js 14+ (App Router)
- Bun
- TailwindCSS
- Radix UI (primitives)
- ShadCN/UI (pre‑styled components)
- Zustand (global state)
- TanStack Query (async data)
- React Window / Virtualized (timeline performance)
- Immer (optional)

### Backend

- Firebase Firestore (plans, versions, collaboration)
- Firebase Storage (optional)
- Next.js API Routes (FFLogs import, auto‑planning, comparison)

### External APIs

- FFLogs API v2 (GraphQL)
- XIVAPI (ability metadata)
- Raidplan.io (link integration)

### Deployment

- Vercel

## 3. Application Structure

### 3.1 Homepage (/)

**Features:**

- FFLogs URL input
- "Import encounter" button
- Recently viewed plans (localStorage)
- Create new empty plan
- Optional: quick links to saved plans

### 3.2 Plan Page (/plan/[id])

This is the core of the app.

#### Vertical Timeline Layout

**Columns:**

- Timestamp (sticky)
- Boss Ability Name (sticky)
- Common Mistakes
- Damage Taken
- Mitigation Calculations
- Player Columns
  - Ability sub‑columns (checkboxes)
  - Mistake sub‑columns (death, vuln, damage down)

#### Core Features

- Checkbox‑based ability assignment
- Cooldown logic (forward + backward)
- Mitigation stacking
- Effective damage calculation
- Mistake overlays (per player + common)
- Hide/show events
- Hide autos
- Editable damage type
- Editable phases (dividers, names, collapse)
- Event details panel
- Undo/redo
- Autosave
- Real‑time collaboration (enabled for edit links)
- View vs Edit mode (based on link type)

#### Link Behavior

- Edit link → full editing rights + real‑time collaboration
- View link → read‑only + comparison mode + user‑level preferences
- Links are created once when the plan is saved for the first time.

### 3.3 Ability Library (/library)

**Features:**

- List of abilities per job
- Toggle abilities on/off (affects timeline columns)
- Ability metadata editing (optional)
- No job presets stored — jobs come from FFLogs or user selection

### 3.4 Encounter Library (/encounters)

**Features:**

- List of saved encounters
- Search by:
  - Encounter name
  - Boss name
  - Ability name
  - Raid tier
- Grouping by raid tier
- Quick navigation to plans
- Encounter presets stored in Firestore

#### Admin UI (minimal)

- No authentication required
- Admin mode enabled via:
  - Local flag
  - Environment variable
  - Hidden route
- Allows:
  - Adding encounter presets
  - Editing preset metadata

### 3.5 Plan Comparison (/plan/[id]/compare)

**Features:**

- Input FFLogs URL
- Import actual execution
- Overlay actual usage on planned timeline
- Drift detection
- Missed cooldowns
- Early/late usage
- Missed buff windows
- Per‑player summary
- Per‑event summary
- Single log comparison only

### 3.6 Mistake Overview (/plan/[id]/mistakes)

*(Future but planned)*

**Features:**

- Timeline of deaths
- Timeline of vuln stacks
- Timeline of damage downs
- Per‑player mistake summary
- Per‑event mistake summary
- "Most dangerous events" ranking

### 3.7 Raidplan.io Integration

**Features:**

- Store a raidplan.io link in plan metadata
- Show link in plan header
- Optional embed (if allowed)
- Optional rich preview

## 4. Data Model (High‑Level)

### Plan

```typescript
id: string
title: string
encounterId: string | null
raidplanLink: string | null
timeline: TimelineRow[]
players: Player[]
phases: PhaseDivider[]
settings: PlanSettings
versionHistory: VersionEvent[]
createdAt: timestamp
updatedAt: timestamp
editLinkId: string
viewLinkId: string
```

### TimelineRow

```typescript
timestamp: number
bossAbility: string
damageEvent?: DamageEvent
playerMistakes: Record<playerId, PlayerMistakeState>
hidden: boolean
sourceName?: string       // ability source name from FFLogs
mechanicType?: MechanicType
```

### MechanicType

```typescript
type MechanicType = "enrage" | "tankbuster" | "party" | "single" | "unknown"
```

### DamageEvent

```typescript
rawDamage: number
allDamages: number[]      // all observed damage values (e.g. across multiple targets)
type: "physical" | "magical" | "unique"
overriddenType?: boolean
```

### PlayerMistakeState

```typescript
dead: boolean
deathTimestamp?: number
damageDown: boolean
damageDownDuration?: number
damageDownTimestamp?: number
weakness: boolean           // replaces vulnerabilityStacks — tracks weakness debuff
weaknessDuration?: number
weaknessTimestamp?: number
brinkOfDeath: boolean       // separate from weakness; distinct debuff tier
brinkOfDeathDuration?: number
brinkOfDeathTimestamp?: number
deadGray?: boolean          // row is grayed because player is dead at this point
```

### MitigationAssignment

```typescript
playerId: string
abilityId: string
timestamp: number
```

### Player

```typescript
id: string
job: string
abilities: Ability[]
mistakeColumnsEnabled: boolean
```

### Ability

Defined in `types/player.ts` but the timeline reads from `JobAbilityRecord` (Firestore data) directly.

```typescript
id: string
name: string
cooldown: number
duration: number
mitigationPercent: number
type: "physical" | "magical" | "all"
target: "self" | "party" | "tank"
enabled: boolean
```

### JobAbilityRecord (Firestore — `job_abilities` collection)

See `DATABASE_STRUCTURE.md` for the full schema. Key difference from `Ability`: mitigation is split into
`mitigationPhysical` and `mitigationMagical` (separate percentages) rather than a single `mitigationPercent`.

### PhaseDivider

```typescript
timestamp: number
name: string
collapsed: boolean
```

## 5. API Integration Architecture

### FFLogs Import

- Parse URL
- Fetch fight metadata
- Fetch events (damage, casts, buffs, deaths, debuffs)
- Normalize timestamps
- Map to timeline rows
- Optional: skip mistakes

### XIVAPI

- Fetch ability metadata
- Fetch icons
- Cache results

### Raidplan.io

- Store link
- Optional: fetch metadata for preview

## 6. Automatic Planning Engine

### Defensive Auto‑Planning

- Identify heavy damage events
- Apply mitigation to reach target threshold
- Respect cooldowns
- Respect durations
- Respect damage type
- Suggest invulns if needed
- Overwrites existing plan (with warning prompt)

### Offensive Auto‑Planning

- Place raid buffs on cooldown
- Place personal buffs on cooldown
- Avoid downtime
- Adjust for deaths
- Align with party windows
- Overwrites existing plan (with warning prompt)

### Hybrid Mode

- Combine both
- Resolve conflicts

## 7. Plan Comparison Engine

- Import FFLogs execution
- Align timestamps
- Compare planned vs actual usage
- Detect drift
- Detect missing cooldowns
- Detect early/late usage
- Detect missed buff windows
- Generate summary report
- Single log comparison only

## 8. Saving, Sharing, Collaboration

### LocalStorage

- Preferences
- Hidden events
- Ability visibility
- Recently viewed plans

### Firestore

- Plan storage
- Real‑time updates
- Version history
- Collaboration metadata
- Encounter presets
- Plan grouping (raid tier folders)

### Sharing

- Edit link → full editing rights + real‑time collaboration
- View link → read‑only + comparison mode + user‑level preferences
- Duplicate plan
- Export JSON
- Export text summary
- PNG export (future)

## 9. UI System

### Radix UI

- Dialogs
- Popovers
- Tabs
- Collapsibles
- Tooltips

### ShadCN/UI

- Buttons
- Inputs
- Selects
- Modals
- Tabs
- Cards

### TailwindCSS

- Light/dark theme
- Layout
- Table styling
