-- Server-managed revision for the user_cigars full-replace snapshot, plus
-- durable telemetry for legacy (unversioned) writes.
--
-- NOT APPLIED. Run only with approval, and only together with (or after) a
-- client build that sends baseRevision — see the rollout runbook in
-- docs/GUEST_MIGRATION_CONFLICTS.md §12.
--
-- Safe to rerun: every statement is IF NOT EXISTS / ON CONFLICT DO NOTHING, so
-- re-applying preserves existing revisions and the original observation start.
--
--   psql "$DATABASE_URL" -f server/scripts/add-collection-revision.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Snapshot revision
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_collection_revision (
  user_id    TEXT PRIMARY KEY,
  revision   BIGINT      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing users start at revision 0, which is also what a client that has
-- never read a revision will send, so the first guarded write succeeds.
-- DO NOTHING means a rerun never resets a revision that has already advanced.
INSERT INTO user_collection_revision (user_id, revision)
SELECT DISTINCT user_id, 0 FROM user_cigars
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Legacy-write telemetry
--
-- Durable and per-day, because "no unversioned writes since this process
-- started" says nothing about the last seven days. Disabling the compatibility
-- flag needs a real observation window, which needs rows that survive restarts
-- and span instances.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS unversioned_snapshot_writes (
  user_id      TEXT        NOT NULL,
  day          DATE        NOT NULL,
  writes       BIGINT      NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_unversioned_writes_day
  ON unversioned_snapshot_writes (day);

-- Single-row marker for when observation began. Without it, an empty
-- unversioned_snapshot_writes table is ambiguous: it could mean "no legacy
-- clients" or "telemetry deployed an hour ago". ON CONFLICT DO NOTHING keeps
-- the original timestamp across reruns.
CREATE TABLE IF NOT EXISTS unversioned_write_observation (
  id         SMALLINT    PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unversioned_write_observation_single_row CHECK (id = 1)
);

INSERT INTO unversioned_write_observation (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMIT;
