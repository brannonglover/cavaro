# Guest-to-account migration: lossless conflict resolution

Design document, now implemented. Schema lives in `db/index.js` `initDatabase`.

Scope: only the guest→existing-account path. Normal sign-in and sync for
non-migrating users must behave exactly as they do today.

---

## 1. What the inspection found

### Local SQLite (`db/index.js`)

`cigars` table, final column set after migrations:

```
id, brand, name, line, description, wrapper, binder, filler, length, image,
quantity, collection, is_favorite, favorite_notes, flavor_profile,
construction_quality, smoked_date, smoke_notes, flavor_changes,
strength_profile, date_added, humidor_id
```

Two facts that constrain the design:

- **No `UNIQUE` constraint on `(brand, name, length)`.** Duplicate local rows are
  possible today, so any resolution step must tolerate and collapse them rather
  than assume uniqueness.
- **No `updated_at` / `modified_at` column.** There is no local record of when a
  row last changed.

`humidors` and `cellared_items` *do* carry `created_at`/`updated_at`; `cigars`
does not. Local identity for sync purposes is the trimmed triple
`(brand, name, length)`.

### Server Postgres (`server/routes/userCigars.js`)

`user_cigars` columns:

```
user_id, brand, name, length, line, description, wrapper, binder, filler, image,
collection, is_favorite, quantity, smoked_date, smoke_notes, favorite_notes,
flavor_profile, strength_profile, construction_quality, flavor_changes,
date_added, humidor_name, updated_at
```

- `PUT /api/user/cigars` is a **transactional full-snapshot replace**:
  `DELETE FROM user_cigars WHERE user_id = $1`, then `INSERT` every row in the
  payload. There is no per-row upsert endpoint.
- The payload is deduped by `brand::name::length`, **keeping the first
  occurrence** and silently dropping later ones.
- `quantity` is clamped to `>= 0`, defaulting to `1` when unparseable.
- `updated_at` is set to `NOW()` for every row on every replace, so it reflects
  the last sync, **not** the last user edit.
- Local `humidor_id` (integer FK) maps to server `humidor_name` (text), resolved
  back through `resolveHumidorId`, which falls back to humidor `1`.

### Current sync order (`lib/userCigarsSync.js`)

`hydrateUserData` runs `restoreAllUserDataOnLogin` then `pushAllUserData`:

1. **Restore** fetches server rows and `mergeServerCigarsIntoLocal` matches on
   the identity triple. On a match it `UPDATE`s the local row from server
   values — overwriting guest `quantity`, `is_favorite`, and every notes field.
2. **Push** sends the resulting local set as the new server snapshot.

Net effect today: for a cigar present on both sides, the guest's values are
destroyed in step 1 and the server's values are written back in step 2. Guest
rows that have no server counterpart survive. This is the loss this document
removes.

---

## 2. Is a durable conflict record required?

**Yes, and a staging snapshot as well.** Four independent reasons:

1. **No usable modification timestamps.** Local `cigars` has none, and server
   `updated_at` is rewritten on every snapshot replace. No automatic
   last-write-wins rule is derivable, so a human has to decide — which means
   the undecided state must be storable.
2. **The server API is snapshot-replace only.** The local DB must already hold
   the final resolved state before any push, so conflicts must be settled
   *before* pushing, and the push has to be withheld until then. That gap has to
   survive in storage.
3. **Requirement 8** (sign-out, restart, or connectivity loss must not discard
   unresolved guest data) rules out in-memory or React state. It must be on
   disk, in SQLite, in the same database as the data it describes.
4. **Requirement 7** (resumable and idempotent) requires knowing what the guest
   data looked like *before* any merge touched it. Once
   `mergeServerCigarsIntoLocal` has run, the pre-merge guest values are gone and
   a retry cannot reconstruct them. A snapshot taken before the first write is
   the only way to make retries safe.

Point 4 is the decisive one: without a pre-merge snapshot, a crash between
restore and resolution loses the guest values permanently, which no amount of
conflict bookkeeping afterwards can repair.

---

## 3. Proposed schema (two new local tables, no server change)

No Supabase/Postgres change is needed. The server keeps receiving a resolved
snapshot; all conflict state is local and transient-by-design.

```sql
-- One row per migration attempt into one account.
CREATE TABLE IF NOT EXISTS migration_runs (
  migration_id   TEXT PRIMARY KEY,   -- uuid, generated at capture time
  user_id        TEXT NOT NULL,      -- Supabase user being migrated INTO
  phase          TEXT NOT NULL,      -- see state machine below
  guest_snapshot TEXT NOT NULL,      -- JSON array of guest cigars, pre-merge
  started_at     TEXT NOT NULL,
  completed_at   TEXT,
  last_error     TEXT
);
CREATE INDEX IF NOT EXISTS idx_migration_runs_user ON migration_runs(user_id, phase);

-- One row per conflicting FIELD of one conflicting cigar.
CREATE TABLE IF NOT EXISTS migration_conflicts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_id  TEXT NOT NULL,
  brand         TEXT NOT NULL,
  name          TEXT NOT NULL,
  length        TEXT NOT NULL,
  field         TEXT NOT NULL,       -- 'quantity' | 'smoke_notes' | ...
  guest_value   TEXT,                -- JSON-encoded scalar
  server_value  TEXT,                -- JSON-encoded scalar
  resolution    TEXT,                -- NULL until resolved; see below
  resolved_value TEXT,               -- JSON-encoded, used by 'manual'/'both'
  created_at    TEXT NOT NULL,
  resolved_at   TEXT,
  UNIQUE(migration_id, brand, name, length, field),
  FOREIGN KEY (migration_id) REFERENCES migration_runs(migration_id)
);
CREATE INDEX IF NOT EXISTS idx_migration_conflicts_run
  ON migration_conflicts(migration_id, resolution);
```

Conflicts are **field-level**, not row-level. That is what lets requirement 3
(auto-merge the unambiguous) coexist with requirements 4 and 5 (ask about the
rest) on the same cigar: a cigar can have its `is_favorite` merged
automatically while its `quantity` waits for the user.

`UNIQUE(migration_id, brand, name, length, field)` is what makes restaging
idempotent — re-running detection `INSERT OR IGNORE`s and cannot duplicate a
conflict or clobber an existing resolution.

Both tables are created with `CREATE TABLE IF NOT EXISTS` inside the existing
`initDatabase` transaction in `db/index.js`, following the established pattern.
Nothing is altered on existing tables.

---

## 4. State machine

```
         capture guest snapshot
                 │
                 ▼
         ┌───────────────┐   no conflicts    ┌────────────┐
         │    staged     │──────────────────▶│  applying  │
         └───────────────┘                   └────────────┘
                 │ conflicts found                 │
                 ▼                                 │ push + confirm
    ┌──────────────────────┐   all resolved         │
    │ awaiting_resolution  │───────────────────────▶│
    └──────────────────────┘                        ▼
                 ▲                            ┌───────────┐
                 └── user resolves partially  │ completed │
                     (stays here)             └───────────┘
```

- `cavaro_migration_pending` is set at **capture**, before any write, and
  cleared only on `completed` — which requires zero unresolved conflicts *and* a
  successful push *and* `confirmCloudHasLocalCigars` passing (requirement 6).
- `wipeLocalUserData` remains gated on that flag, so sign-out at any phase
  keeps guest rows and the staged snapshot (requirement 8).
- On app start, a run in `staged`, `awaiting_resolution`, or `applying` for the
  currently signed-in user is resumed; `applying` simply re-runs apply, which is
  idempotent (requirement 7).
- A run whose `user_id` differs from the signed-in user is left untouched — it
  is neither applied nor deleted, which is what makes account switching safe
  (requirement 9).

---

## 5. Field classification

### Auto-merged — unambiguous and non-destructive (requirement 3)

| Field | Rule | Why it is safe |
|---|---|---|
| any field | one side empty/null, other set | take the set one — nothing is discarded |
| any field | both sides equal | no conflict exists |
| `is_favorite` | logical OR | "unfavorited" is not representable, so OR cannot erase an intent |
| `date_added` | earlier of the two | the cigar demonstrably entered the collection by then |
| `description`, `wrapper`, `binder`, `filler`, `image`, `line` | prefer server, else guest | catalog metadata, not user-authored content |

The catalog-metadata row is the one judgement call: these fields come from the
shared cigar catalog rather than the user, so a difference is a catalog version
difference, not a user disagreement. They are never user-entered text.

### User-resolved — conflicts preserved until decided

| Field | Conflict when | Options offered |
|---|---|---|
| `quantity` | both set and differ | guest / existing / **manual total** (req. 4) |
| `smoke_notes` | both non-empty and differ | guest / existing / **keep both** (req. 5) |
| `favorite_notes` | both non-empty and differ | guest / existing / keep both |
| `flavor_profile` | both non-empty and differ | guest / existing / keep both |
| `strength_profile` | both non-empty and differ | guest / existing / keep both |
| `construction_quality` | both non-empty and differ | guest / existing / keep both |
| `flavor_changes` | both non-empty and differ | guest / existing / keep both |
| `smoked_date` | both set and differ | guest / existing |
| `collection` | both set and differ | guest / existing |
| `humidor_name` | both set and differ | guest / existing |

Per requirement 1, `quantity` never auto-sums and never takes a max. Until the
user chooses, **neither value is written** — both sit in
`migration_conflicts`, and the local row keeps its guest value so nothing is
destroyed while waiting.

`keep both` for text fields concatenates with a labelled separator so the
content is reviewable rather than silently fused:

```
<guest text>

— merged from your existing account —
<server text>
```

### Deliberately out of scope

`cellared_items` and `smoke_journal_entries` are append-mostly and keyed by
`cigar_id`, not by the identity triple. They are merged by the existing logic
unchanged. Conflict resolution covers `cigars` only, which is where the
destructive overwrite lives.

---

## 6. Revised migration sequence

```
1. capture      snapshot guest cigars → migration_runs, set pending flag
2. fetch        GET server cigars (read-only; nothing written yet)
3. detect       diff snapshot × server → auto-merge set + conflict rows
4. stage        write conflicts; phase = staged | awaiting_resolution
5. resolve      user answers (may span launches, may be interrupted)
6. apply        write resolved values into local cigars, collapsing duplicates
7. push         PUT full local snapshot
8. confirm      re-fetch, verify every local cigar present
9. complete     phase = completed, clear pending flag, drop conflict rows
```

Steps 2–4 perform **no writes to `cigars`**, which is the change that makes the
whole thing recoverable: until the user has resolved, the local DB still holds
exactly the guest's data.

Idempotency per step: 3–4 are `INSERT OR IGNORE` keyed by the unique index; 6
recomputes from snapshot + resolutions and is a pure function of them, so
re-running produces the same rows; 7 is already a full replace; 8 is read-only.

---

## 7. Decisions (settled)

1. **Resolution UI** — a blocking screen shown after sign-in, with a
   **"Decide later"** escape that drops to a persistent banner over the normal
   app. Both states exist, so both are tested: `awaiting_resolution` with
   `deferred = 0` renders the blocking screen, `deferred = 1` renders the
   banner. Deferring never clears `cavaro_migration_pending`, so guest data
   stays protected either way.
2. **Catalog metadata** (`description`, `wrapper`, `binder`, `filler`, `image`,
   `line`) — auto-merged, preferring the server value, falling back to the guest
   value when the server's is empty. These are catalog-derived, never
   user-typed, so a difference is a catalog version difference.
3. **`collection`** — a user-resolved conflict. `cavaro` / `likes` / `dislikes`
   is explicit user intent, and auto-preferring the inventory could silently
   return a cigar the user deliberately disliked to their humidor.

`migration_runs` therefore carries one extra column beyond §3:

```sql
deferred INTEGER NOT NULL DEFAULT 0   -- 1 once the user chose "Decide later"
```

---

## 8. Account switching

The pending flag means "this device holds rows no server has confirmed". It is
not per-user, so a deferred migration followed by a sign-out and a *different*
sign-in would otherwise let the normal full-replace push write one person's
guest collection into another's account. `hydrateUserData` therefore routes any
sign-in with the flag set through the staged path, restaging against whichever
account signed in. Users who never migrated have no flag and keep the original
path exactly.

A run is scoped by `user_id` and is never applied to another account. When one
account's migration reaches `completed`, runs still active for other accounts
move to `superseded` and their conflict rows are dropped — those rows are
derived from a snapshot that has since been committed elsewhere, so they are
never the only copy, and leaving them would strand that user on the blocking
screen with questions about data that has moved on.

## 9. Tests

`node scripts/verify-migration-conflicts.js` — 45 assertions over overlapping
quantities, conflicting notes, auto-merge rules, interrupted resolution,
retries/idempotency, duplicate collapse, account switching, and
guest-only/server-only rows.

`node scripts/verify-migration-logic.js` — 18 assertions over the identity
triple and post-push cloud confirmation.

Both run in plain node. The SQLite writes in `lib/guestMigration.js` and the
Supabase round trip still require a device build.

---

## 10. Migration safety audit (pre-release)

Three areas audited against the code and schemas. Findings and corrections
below; `scripts/verify-migration-db.js` and `scripts/verify-migration-sync.js`
are the executable evidence.

### Area 1 — account switching · BLOCKER · fixed

`hydrateUserData` routed any sign-in carrying `cavaro_migration_pending`
through `runGuestMigration`, and `beginMigration` only looked for an active run
belonging to **that** user. A run staged for account A was therefore invisible
when B signed in, so B got a brand-new run with a **freshly captured** snapshot
and the migration silently changed destination.

Repro: guest adds cigars → sign in as A → conflicts staged → "Decide later" →
sign out → sign in as B → guest collection migrates into B, no prompt.

Fix: `getForeignActiveRun` + `MIGRATION_ACCOUNT_MISMATCH`. `beginMigration`
refuses, `runGuestMigration` returns `needs_account_confirmation`, and nothing
is written, pushed or wiped. `confirmAccountChange` is the only way to redirect
and reuses the **stored** snapshot rather than re-reading local rows. Nothing
calls it automatically — wiring the confirmation prompt is outstanding UI work.

### Area 2 — concurrent cloud updates · NOT a blocker · design only

`PUT /api/user/cigars` is an unconditional full replace with no revision,
version or ETag parameter and no 409 path. A snapshot read at T0 and pushed at
T1 destroys anything another device wrote in between. Reproduced over real HTTP.

Exposure is narrow in practice: `applyMigration` re-fetches immediately before
applying, and the push follows within seconds, so the window is the gap between
that fetch and the push — not the hours a deferred migration can span. It needs
two devices writing concurrently. Impact is high (silent deletion) but
likelihood is low, so it is scheduled rather than blocking.

Proposed fix, **not implemented and not deployed** (needs a Postgres change and
a server release):

1. `user_snapshot_revision (user_id, revision)`, bumped in the same transaction
   as every snapshot replace.
2. `GET` returns `{ cigars, revision }`.
3. `PUT` requires `baseRevision`; on mismatch return `409 { currentRevision }`
   and write nothing.
4. Client retries: refetch, `restageMigration`, push at the new revision.

`restageMigration` is implemented client-side now. It keeps an answer only when
both sides are unchanged; if the server value moved, the resolution is cleared
and re-asked, because the user's choice referred to a value that no longer
exists. Conflicts absent from the fresh plan are dropped, new ones inserted
unresolved.

### Area 3 — SQLite duplicate collapse · BLOCKER · fixed

Writes were already in one transaction (`withSerializedTransaction` →
`db.withTransactionAsync`), and rollback works. The defect was foreign keys:
`db/index.js` never issues `PRAGMA foreign_keys`, so SQLite's default (OFF)
ships, and `DELETE FROM cigars WHERE … AND id != ?` silently orphaned
`cellared_items`, `smoke_journal_entries` and `smoke_history` rows pointing at
the deleted duplicate. Under `PRAGMA foreign_keys = ON` the same delete fails
outright, so the schema's declared FKs were never load-bearing.

Fix: select the duplicate ids, repoint all three child tables at the surviving
row, then delete per row — all inside the existing transaction. Verified with FK
enforcement both off and on, including rollback and three repeated applications.

### Bonus finding — resolution clobbering · BLOCKER · fixed

Found while tracing area 2. `runGuestMigration` called
`restoreAllUserDataOnLogin` **after** `applyMigration`, and that calls
`mergeServerCigarsIntoLocal`, which `UPDATE`s matching local rows from server
values — overwriting every quantity and note the user had just chosen. The
feature was silently self-defeating; the pure-JS merge tests never exercised the
sequence, which is exactly why database and ordering tests were required.

Fix: `restoreHumidorsOnly` before apply (so `humidor_name` resolves), then
`restoreNonCigarUserData` after. The normal sign-in path still uses the full
`restoreAllUserDataOnLogin` and is unchanged.

---

## 11. Release work — Phases 1–3

### Phase 1 — account confirmation UI

`MIGRATION_ACCOUNT_MISMATCH` now reaches the user. `refreshMigrationState`
checks `getForeignActiveRun` whenever the signed-in account has no run of its
own and sets `accountConflict`; `App.js` renders
`pages/MigrationAccountConflict.js` ahead of the conflict screen, because at
that point there is no run for this user to resolve.

Two choices, both explicit:

- **Return to the original account** — signs out. `wipeLocalUserData` is skipped
  while `cavaro_migration_pending` is set, so the guest rows and the staged
  snapshot both survive.
- **Add them to this account instead** — `confirmMigrationAccountChange` →
  `confirmAccountChange`, which copies the **stored** snapshot forward rather
  than re-reading local rows, and retires the old run as `superseded` without
  deleting its row.

Nothing calls `confirmAccountChange` automatically.

### Phase 2 — restore-path audit

`restoreHumidorsOnly` and `restoreNonCigarUserData` were audited for indirect
cigar writes and stale foreign keys. Both are clean:

- `mergeServerHumidorsIntoLocal` touches only `humidors`.
- `mergeServerCellaredIntoLocal` and `mergeServerJournalIntoLocal` resolve
  `cigar_id` by identity triple **at write time**, so after a duplicate collapse
  they bind to the surviving row — no stale references. Both `continue` when no
  local cigar matches, so neither can create an orphan, and neither writes to
  `cigars`.

One pre-existing wart, not introduced here and low severity: `resolveHumidorId`
falls back to humidor id `1`, which may not exist if the user deleted it. The
`LEFT JOIN` in `LOCAL_CIGARS_QUERY` turns that into a null `humidor_name`, so it
degrades rather than breaking.

### Phase 3 — cloud concurrency protection

`user_collection_revision` (DDL in `server/scripts/add-collection-revision.sql`,
**not applied**). `GET /api/user/cigars` returns the revision in an
`X-Collection-Revision` header — deliberately not in the body, because every
existing caller reads that response as a bare array. `PUT` requires
`baseRevision`, locks the revision row, and on mismatch `ROLLBACK`s and returns
`409 { currentRevision }` having modified nothing; on success it bumps the
revision inside the same transaction.

Caller audit for the PUT endpoint:

| Caller | Status |
|---|---|
| `pushAllUserData` → cigars | now `pushCigarsAtRevision` (reads revision, then writes) |
| `pushUserCigars` | no live callers; rewired through the guard so reviving it is safe |
| humidors / cellared / journal pushes | untouched — only cigars carries a revision |

On 409 the migration path refetches, calls `restageMigration`, and retries once.
If the newer server values invalidated any answer, it returns to
`awaiting_resolution` instead of guessing.

**Rollout hazard:** builds already in the field send no `baseRevision` and would
get `428`. Deploy with `ALLOW_UNVERSIONED_SNAPSHOT_WRITES=1` during the
transition, then unset it once those builds are gone.

### Phase 2 — Expo SQLite end-to-end result

`lib/__devtests__/migrationE2E.js`, gated behind `EXPO_PUBLIC_RUN_MIGRATION_E2E=1`
(flag kept only in gitignored env files and removed after each run — the
harness calls `resetLocal()` and will wipe a local database). Runs inside a
Release simulator build so the real expo-sqlite driver, the real schema from
`initDatabase`, and the real write path all execute. `global.fetch` is stubbed
so `api/userCigars.js` and the revision handling are exercised for real.

To reproduce: add the flag to `.env`, build Release for the simulator, launch,
then read `<app data container>/Documents/migration-e2e.json`.

**70 passed, 0 failed** across guest signup, returning-account login, conflict
resolution followed by restoration, duplicate collapse with all three child
tables, transaction rollback, interrupted migration and restart, revision
conflict rebuild, and account switching with confirmation.

**It caught a release blocker the node suites could not.** `runGuestMigration`
gated on `run.phase === PHASE.AWAITING || unresolved > 0`. `beginMigration`
returns the existing run, and a run staged as `awaiting_resolution` keeps that
phase after the user answers the last conflict — so a fully resolved migration
returned early and never applied, pushed or completed. Ten assertions failed
from that one cause. The gate now tests outstanding answers only. Pure-JS and
node:sqlite tests could not surface this: it lives in the orchestration between
the pure planner and the database layer, not in either one.

---

## 12. Collection revision rollout

### Verification evidence

`scripts/verify-revision-postgres.js` — **48/48** against real PostgreSQL 16.15
(Docker) driving the real `server/routes/userCigars.js` through the real `pg`
driver, with the schema created by the actual migration file.

- **Atomicity (both paths).** Revision-aware writes create the row at 1 and
  advance by exactly one. **Legacy unversioned writes bump it too**, in the same
  transaction. A rejected write leaves revision and rows untouched — the
  `DELETE` never runs.
- **Concurrency.** Two simultaneous writes at the same base revision: exactly
  one 200, one 409, revision +1, no torn snapshot. Ten simultaneous writers:
  exactly one succeeds, nine get 409, revision +1, 2 rows not 11. The
  `INSERT … ON CONFLICT DO UPDATE … RETURNING` takes a row lock, so the losers
  re-read the committed revision and fail their precondition.
- **Header.** `X-Collection-Revision` is returned for empty collections (`0`)
  and populated ones, with `Access-Control-Expose-Headers` set.
- **Compatibility.** Legacy and revision-aware clients interleave correctly; a
  modern client reads the revision a legacy write produced and writes on top.

### Pre-flight — confirm the target database

Run before anything else. Read-only, and it proves the connection string points
at Cavaro's production data rather than staging or a stale URL:

```bash
psql "$DATABASE_URL" -c "SELECT current_database(), current_user, inet_server_addr() AS host, (SELECT COUNT(*) FROM user_cigars) AS existing_cigars, (SELECT COUNT(DISTINCT user_id) FROM user_cigars) AS users;"
```

Expect the production database name and a cigar/user count matching what
`scripts/check-guest-users.js` reports from PostHog. If `user_cigars` does not
exist, the URL is wrong — stop.

The migration is **safe to rerun**: every statement is `IF NOT EXISTS` or
`ON CONFLICT DO NOTHING`. Verified by applying it twice mid-suite and asserting
that an advanced revision, the observation start, and telemetry rows all
survive unchanged.

### Deployment order

Each step is independently safe to stop at.

```bash
# 1. Set the ops token and the compatibility flag BEFORE the new server starts.
#    Railway persists service variables across deploys; setting them triggers
#    a redeploy of the CURRENT (pre-revision) build, which is harmless.
railway variables --set ALLOW_UNVERSIONED_SNAPSHOT_WRITES=1 --set OPS_API_TOKEN="$(openssl rand -hex 32)"

# 2. Confirm both are present on the service before deploying
railway variables | grep -E "ALLOW_UNVERSIONED_SNAPSHOT_WRITES|OPS_API_TOKEN"

# 3. Apply the migration
psql "$DATABASE_URL" -f server/scripts/add-collection-revision.sql

# 4. Deploy. Railway is wired to the GitHub repo with root directory `server`
#    (see server/RAILWAY.md), so the deploy trigger is a push to main — NOT
#    `railway up`. Only server/** affects the API; client changes in the same
#    commit are inert until an EAS build ships them.
git push origin main

# 5. Confirm the flag survived the deploy — this is the step that matters most
railway variables | grep ALLOW_UNVERSIONED_SNAPSHOT_WRITES

# 6. Confirm the header is live
curl -sD- -o/dev/null -H "Authorization: Bearer $TOKEN" \
  https://cavaro-production-9755.up.railway.app/api/user/cigars | grep -i x-collection-revision

# 7. Confirm telemetry is recording (administrator-only)
curl -s -H "X-Ops-Token: $OPS_API_TOKEN" \
  https://cavaro-production-9755.up.railway.app/api/user/cigars/revision-stats
```

Step 1 **must** precede step 4. Deploying with the flag unset makes every
in-field build receive `428` and stop syncing. Railway variables are scoped to
service + environment and persist across deploys, so the only ways to lose
the flag mid-rollout are deploying to a different environment, recreating the
service, or deleting the variable — step 5 catches all three.

Ship the client build after step 4. Old builds keep working on the legacy path;
new builds send `baseRevision` and get the protection.

### Rollback

**Rolling the server back is safe for both client generations — verified.** A
pre-revision server returns no `X-Collection-Revision`, the new client maps the
missing header to `null`, and `saveUserCigars` then omits `baseRevision`
entirely, producing exactly the legacy request shape the old build accepts. The
old server also ignores an unexpected `baseRevision` field, so neither
direction breaks.

```bash
# Server misbehaving — roll back. With GitHub-triggered deploys, use Railway's
# dashboard (Deployments → previous deployment → Redeploy), or revert the
# commit and push. The tables are additive and unused by the previous server
# version, so leave them in place.
git revert --no-edit <deploy-commit> && git push origin main

# Guarded writes rejecting legitimate traffic — reopen the legacy path without
# a redeploy of the application code:
railway variables --set ALLOW_UNVERSIONED_SNAPSHOT_WRITES=1
```

Do **not** drop `user_collection_revision` as part of a rollback. The old server
never reads it, so it is inert; dropping it only creates work when rolling
forward again, and loses every recorded revision.

One consequence to be aware of, not a fault: while a pre-revision server is
running, writes do not advance the revision, so the stored value goes stale
relative to the data. That is harmless because clients re-read the revision
immediately before each write — the exposure window is a single round trip, the
same as it is normally.

### Conditions for disabling legacy writes

The gate is `safeToDisableLegacyWrites` in the stats response, which is true
only when **both** hold:

1. `observedDays >= 7` — the observation window has actually been covered.
   Seeded by the migration, so it survives restarts and deploys.
2. `last7Days.writes === 0` — nothing legacy seen in that window.

This is deliberately false while the window is still filling, even at zero
writes: "no unversioned writes since this process started" is not evidence of
"no legacy clients in the last seven days". Counts live in
`unversioned_snapshot_writes` (per user, per day), so they survive restarts and
aggregate correctly across instances.

Also confirm the revision-aware client build has been live long enough to cover
the App Store update tail — two to four weeks is typical — using the
`app_version` breakdown in PostHog.

```bash
# When safeToDisableLegacyWrites is true:
railway variables --unset ALLOW_UNVERSIONED_SNAPSHOT_WRITES
```

Turning it off while writes are still arriving breaks sync for those users
(`428`) and their local changes stop reaching the server. It is a reversible
env-var change, not a deploy.

### Telemetry access

`GET /api/user/cigars/revision-stats` requires `X-Ops-Token` matching
`OPS_API_TOKEN`, compared with `crypto.timingSafeEqual`. It does **not** go
through `resolveUserId` — an ordinary authenticated user gets `404`, as does a
wrong token. With `OPS_API_TOKEN` unset the endpoint fails closed (`404`), so a
missing variable can never silently expose it.

### Test-harness containment

- `EXPO_PUBLIC_RUN_MIGRATION_E2E` is absent from `eas.json` (`development`,
  `preview`, `production` env blocks), `app.config.js`, `.env`, and
  `.env.development`. It lives only in gitignored files during a run.
- Production module graph: **zero** `__devtests__` modules out of 1173. The
  guarded branch is dead-code eliminated, and `metro.config.js` additionally
  aliases the harness to an inert stub whenever the flag is unset.
- The harness re-checks the flag itself and throws, so an errant import cannot
  reach `resetLocal()`.
- With the flag set, `migrationE2E.js` returns to the graph — the verification
  stays reproducible.
