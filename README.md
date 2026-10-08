# Solar Inspect — Offline-First Solar Farm Inspection App

A production-oriented, **offline-first** field inspection app for solar farm
technicians, built with **Expo (SDK 57) + React Native 0.86 + strict TypeScript**.

Technicians inspect solar panels, inverters, transformers, combiner boxes and
other site equipment with **no internet connection**. Every mutation is written
to SQLite first, snapshot into a durable sync queue, and uploaded automatically
to the backend (mocked for now) when connectivity returns — with exponential
backoff, retry, and crash-safe recovery.

The UI is a solar-themed field-service design: animated sun/hills/panel
backdrop art, springy press interactions on every card and button, staggered
list entrances, animated progress bars, and persistent offline/sync indicators
— built entirely with React Native core `Animated` (no extra native modules).

---

## Setup & Run

### Prerequisites

- Node.js 20+ and npm
- An Android emulator / device, an iOS simulator, or
  [Expo Go](https://expo.dev/go) on a physical device

### Install & start

```bash
npm install
cp .env.example .env   # optional — defaults run the mock API
npx expo start         # press i (iOS) / a (Android), or scan the QR code
```

Two ways to run on Android:

| Method | Command | Notes |
|---|---|---|
| Expo Go | `npx expo start` → press `a` | fastest; all native modules used are in Expo Go |
| Dev build | `npx expo run:android` | compiles the native `android/` project, installs `com.solarfield.inspections`, starts Metro (first build ~10–15 min) |

### Quality checks

| Command | Purpose |
|---|---|
| `npm run typecheck` | strict TypeScript (`tsc --noEmit`, incl. `noUncheckedIndexedAccess`) |
| `npm run lint` | ESLint (`eslint-config-expo`, flat config) |
| `npx expo export --platform ios` | verifies a production Metro bundle |

### Environment (`.env`, see `.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000/api` | real backend base URL (used when mock is off) |
| `EXPO_PUBLIC_USE_MOCK_API` | `true` | `false` switches to the HTTP client |
| `EXPO_PUBLIC_MOCK_FAILURE_RATE` | `0.2` | mock failure probability (0–1) |

### First launch

The app seeds three demo solar farms on first run (deterministic data):

- **Solar Farm Alpha** — 10,112 assets (10,000 panels) to exercise list performance
- **Solar Farm Beta** — 2,445 assets
- **Solar Farm Gamma** — 625 assets

…plus sample inspections, one of which is pre-loaded into the sync queue so
automatic synchronization is visible the moment the app opens online.

### Core user flow

Dashboard → select site → create inspection (multi-select equipment) →
checklist per asset (condition, damage, wiring, cleanliness, thermal reading,
notes) → photo evidence (offline camera) → complete inspection (GPS + notes)
→ everything saved to SQLite instantly → auto-synced when online →
live sync status on the Sync tab.

---

## Architecture

```
app/                          Expo Router routes
  _layout.tsx                 Root stack; boot (DB + queue recovery + sync) before mount
  (tabs)/                     Bottom tabs: Dashboard, Sites, Inspections, Sync
  sites/[siteId].tsx          Equipment browser (paginated, searchable, filterable)
  inspections/create.tsx      Multi-step creation (site → inspector → equipment)
  inspections/[inspectionId].tsx   Checklist + progress + completion (GPS)
  equipment/[equipmentId].tsx Checklist form / equipment profile + photos
  camera.tsx                  Full-screen camera (offline capture)
src/
  components/                 Presentational, reusable, memoized; SafeScreen,
                              SolarBackdrop, PressableCard, cards, badges, states
  constants/                  theme.ts (design tokens), domain.ts (options + labels)
  database/                   db.ts (connection), migrations.ts, seed.ts
  repositories/               ALL SQL lives here — store-free, screen-free
  services/
    api/                      ApiClient interface + mock server + HTTP client
    sync/                     SyncService (queue drain, backoff, retry)
    photo/                    compress → persist to documents → queue
    location/                 best-effort GPS (never blocks)
    connectivity.ts           expo-network listener → auto sync
    bootstrap.ts              DB open/migrate/seed → queue recovery → first sync
  stores/                     Zustand: syncStore, uiStore, inspectionStore
  types/                      Domain, API payload, sync types
  utils/                      uuid, format, debounce, useAnimatedValue
```

**Separation of concerns.** Screens only talk to repositories. Repositories
know nothing about React or stores. The SyncService is a plain singleton the
UI observes through `syncStore`. Business data lives exclusively in SQLite;
Zustand holds only session/UI state.

### Data model (SQLite, WAL mode)

`sites`, `equipment`, `inspections`, `inspection_items`, `photos`,
`sync_queue` — created by versioned, append-only migrations recorded in a
`schema_migrations` table, with indexes on every list query
(`equipment(siteId, name)`, `equipment(siteId, type)`, …). Every primary key
is a client-generated UUID, so **every mutation is an idempotent upsert**.

### Sync design

- Every mutation writes to SQLite **first**, then enqueues a JSON payload
  snapshot in `sync_queue` — coalesced per entity, so editing one checklist
  item ten times yields exactly one queue entry.
- `SyncService` drains the queue in order, in batches of 25, one entry at a
  time. A failing entry never blocks the rest of the queue.
- Failures increment `attempts`, store `lastError`, and back off
  exponentially (15 s → 2 min cap). After 5 attempts an entry parks as
  `failed` and is retried manually from the Sync tab ("Retry failed").
- Success deletes the queue entry and marks the entity `synced` — an entry
  uploads exactly once; upsert semantics make replays safe anyway.
- Triggers: app start (if online), connectivity restored (expo-network
  listener), and manual "Sync now". Entries caught mid-flight by an app kill
  are reset to `pending` on boot — **restarts are safe**.
- Swapping in a real backend = implementing `ApiClient` (an HTTP client with
  the same contract is already included) and setting
  `EXPO_PUBLIC_USE_MOCK_API=false`. The mock simulates 250–850 ms latency and
  a configurable failure rate so backoff/retry is exercised during normal use.

### Performance notes

- **FlashList v2** for all long lists; equipment is queried with
  `LIMIT 50 OFFSET n` pagination (`onEndReached`), prefix-match
  `LIKE 'term%'` so the `(siteId, name)` index is used across 10k+ rows,
  and a 300 ms debounced search.
- **Memoized rows** (`EquipmentCard`, `InspectionCard`, `ChecklistItem`) with
  **stable `useCallback` press handlers** so `React.memo` actually works;
  press feedback lives inside each row, not in new closures per render.
- **Multi-select without re-render storms**: the create screen's
  `SelectableEquipmentRow` subscribes per-row to
  `selectedEquipmentIds.includes(id)` — toggling a checkbox re-renders two
  rows, not the list.
- **Frozen navigation**: `enableFreeze(true)` + `freezeOnBlur` on the stack
  and tabs, `lazy` tabs — hidden screens never re-render.
- **Throttled sync UI**: the queue counter store updates every 5 processed
  entries instead of every entry (no app-wide badge re-render storm).
- **Animations are native-driver** (`useNativeDriver: true`) transforms and
  opacity only; progress-bar width is the single JS-driven exception.
  Staggered entrance animations run only for the first page of rows so
  recycled rows during fast scroll don't flicker.

### UI system

- `SafeScreen` applies safe-area insets on every screen (edge-to-edge safe on
  Android); `SolarBackdrop` renders the animated sun/rays/hills/panels art.
- `PressableCard` gives every card/row/button a spring press-scale and
  optional staggered entrance; `AppButton` and the FAB share the same feel.
- Status is always visible: `StatusBadge` (condition / inspection / sync),
  animated `ProgressBar`, `OfflineBanner` (slide-in), `SyncStatus` card with
  pulsing dot while syncing and ONLINE / OFFLINE / SYNCING / SYNC COMPLETE /
  SYNC ERROR states.

---

## Decisions & Trade-offs

- **SQLite over AsyncStorage** — required for 10k+ records, indexed queries,
  transactions and a crash-safe queue. AsyncStorage is not used anywhere.
- **Snapshot payloads in the queue** — the payload is captured at enqueue
  time. Simple and predictable ("queue = what to upload"); the trade-off is
  that a newer edit coalesces over a stale snapshot by design (entries are
  keyed per entity, attempts reset).
- **Mock failure rate is random per request (~20%)** — retries and backoff
  get exercised during normal use. Set `EXPO_PUBLIC_MOCK_FAILURE_RATE=0` for
  a deterministic demo.
- **Prefix search (`LIKE 'term%'`) instead of substring** — keeps the
  `(siteId, name)` index usable at 10k scale. Substring search would need
  SQLite FTS5 (a natural next step).
- **expo-camera `CameraView` screen** instead of a deprecated imperative
  launch API — full permission UX control, works fully offline; photos are
  resized/compressed with ImageManipulator before moving out of cache into
  the app documents directory. Photo binaries are not uploaded by the mock
  (metadata is; the returned CDN URL is synthetic).
- **GPS/camera permissions never block an inspection** — denial degrades
  gracefully (inspection saves without coordinates; photos are optional).
- **No new native modules for theming/animations** — the solar backdrop art
  and all interactions are pure React Native `Animated`, so the UI hot
  reloads in an existing dev build and stays on the "avoid unnecessary
  dependencies" brief. The trade-off: hand-rolled art instead of SVG/Lottie
  richness.
- **Zustand kept minimal** — only sync status, create-flow selection and
  cross-screen signals (photo capture counter). Filters/search are component
  state, which avoids global store churn on big lists.
- **Last-write-wins conflict resolution** via `updatedAt`, with an
  `inspections.version` field as an optimistic-locking hint for the backend.

## What I Skipped

- **Automated tests** — no framework was configured in the repo; repositories
  and the SyncService are structured to be unit-testable next.
- **Pull-based replication** — downloading backend changes into SQLite
  (multi-technician sync). The schema and `ApiClient` make it easy to add.
- **Binary photo upload** — the mock returns a synthetic URL; a real backend
  needs multipart/signed-URL upload before metadata sync.
- **Auth/session handling** — inspector identity is a name field today.
- **Conflict-resolution UI** — silent last-write-wins for now.
- **Substring/FUZZY search** — prefix search only (see trade-off above).

## What I'd Do Next

1. **Unit tests** for `SyncService` and repositories (in-memory SQLite) and
   Maestro e2e flows (offline create → toggle airplane → auto-sync).
2. **Pull-sync / multi-user reconciliation** — incremental fetch by
   `updatedAt` cursor plus a real conflict policy.
3. **FTS5 search** for substring matching on equipment names/serials.
4. **Real photo uploads** — resumable/signed-URL upload tasks, background
   uploads, and cache eviction for uploaded binaries.
5. **Auth + per-technician inspection assignment**, persisted inspector
   profile, and push notifications for sync failures.
6. **Performance instrumentation** — list scroll FPS in CI, SQLite
   `EXPLAIN QUERY PLAN` checks, and a perf toggle for animations on low-end
   devices (`InteractionManager`/reduced-motion support).
