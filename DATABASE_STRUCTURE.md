# Firestore Database Structure

This document describes all Firestore collections. Update it when collections or schemas change.

---

## `plans`

Plan documents. Created when a user saves a plan for the first time.

**Document ID:** `{editLinkId}` (UUID, used as the edit link)

**Querying by view link:** `where("viewLinkId", "==", viewLinkId)` — used by `getPlanByViewLink()` in `lib/plan-service.ts` to load a plan from `/plan/view/[id]`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Same as document ID |
| `title` | `string` | Plan title |
| `encounterId` | `string \| null` | Reference to an encounter preset |
| `encounterType` | `EncounterType \| null` | `"Ultimate" \| "Savage" \| "Criterion" \| "Other"` |
| `encounterTier` | `string \| null` | Raid tier label (e.g. `"AAC Light-heavyweight M"`) |
| `raidplanLink` | `string \| null` | External raidplan.io URL |
| `timeline` | `TimelineRow[]` | Ordered list of boss ability rows |
| `players` | `Player[]` | Players with their assigned abilities |
| `phases` | `PhaseDivider[]` | Phase divider rows |
| `assignments` | `MitigationAssignment[] \| undefined` | Explicit mitigation assignments (optional) |
| `createdAt` | `number` | Unix ms |
| `updatedAt` | `number` | Unix ms |
| `editLinkId` | `string` | UUID for edit access |
| `viewLinkId` | `string` | UUID for read-only access |

---

## `encounters`

Encounter presets, editable via admin panel. Grouped by raid tier.

**Document ID:** Auto-generated

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Boss / encounter name |
| `type` | `EncounterType` | `"Ultimate" \| "Savage" \| "Criterion" \| "Other"` |
| `tier` | `string` | Raid tier (e.g. `"AAC Light-heavyweight M"`) |
| `patch` | `string` | Game patch version |
| `timeline` | `TimelineRow[]` | Preset timeline for this encounter |
| `phases` | `PhaseDivider[]` | Phase dividers for this encounter |
| `createdAt` | `number` | Unix ms |
| `updatedAt` | `number` | Unix ms |

---

## `job_abilities`

Job ability/cooldown data populated via the admin panel (`/admin`) using XIVAPI.

**Document ID:**
- Job-specific ability: `{JOB}_{xivapiId}` — e.g. `PLD_7546`
- Role action (shared across a role): `ROLE_{xivapiId}` — e.g. `ROLE_7618`

Role actions are stored once with a `jobs` array covering all applicable jobs.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Same as document ID |
| `xivapiId` | `number` | XIVAPI Action row ID |
| `jobs` | `JobAbbreviation[]` | Jobs that have this ability (1 for job-specific, many for role) |
| `name` | `string` | Ability display name |
| `iconPath` | `string` | Full icon URL from XIVAPI CDN |
| `cooldown` | `number` | Recast time in seconds |
| `duration` | `number` | Buff duration in seconds (0 = no lasting buff) |
| `mitigationPhysical` | `number` | % damage reduction vs physical (0–100) |
| `mitigationMagical` | `number` | % damage reduction vs magical (0–100) |
| `target` | `"self" \| "party" \| "single"` | Who receives the buff |
| `abilityType` | `"mitigation" \| "utility" \| "buff" \| "interrupt"` | Category for UI filtering |
| `isRoleAction` | `boolean` | True if shared across a role |
| `enabled` | `boolean` | Default visibility in the planner |
| `createdAt` | `number` | Unix ms |
| `updatedAt` | `number` | Unix ms |

**Querying by job:** `where("jobs", "array-contains", job)`

---

# Realtime Database (collaboration presence)

Ephemeral live-cursor data for the plan editor lives in **Firebase Realtime Database**
(not Firestore), because cursor updates are high-frequency and RTDB is billed by
bandwidth with built-in `onDisconnect` cleanup. Edit views only.

Requires env var `NEXT_PUBLIC_FIREBASE_DATABASE_URL`. Managed by `lib/collab/presence.ts`.

## `presence/{editLinkId}/{sessionId}`

One node per open editor tab. Auto-removed on disconnect; stale nodes (>30s) are
ignored client-side.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Per-tab UUID (the node key) |
| `name` | `string` | Anonymous display name (e.g. `"Anonymous Otter"`) |
| `color` | `string` | Hex cursor color |
| `hoverTimestamp` | `number \| null` | Timeline row the user is hovering |
| `hoverJob` | `JobAbbreviation \| null` | Job column the user is hovering |
| `updatedAt` | `number` | Unix ms (staleness / liveness) |

Durable timeline edits still sync through Firestore `plans/{editLinkId}` via
`onSnapshot` + granular `arrayUnion`/`arrayRemove` writes (`lib/collab/plan-sync.ts`).
