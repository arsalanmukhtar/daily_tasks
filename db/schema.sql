-- daily_tasks Postgres schema - replaces the Firestore collections
-- documented in PROJECT.md / firestore.rules. Field names are snake_case
-- translations of the same Firestore fields, so the migration script
-- (migrate-from-firestore.js) and every client's data layer map 1:1.
--
-- Run once, on a fresh database:
--   psql -U daily_tasks_app -d daily_tasks -h localhost -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- users (was Firestore's `allowlist`) ----------
-- The single source of truth for who can sign in and what they're allowed
-- to do - same fields/semantics as allowlist/{email} today.
CREATE TABLE users (
    email          TEXT PRIMARY KEY,           -- always stored lowercase
    name           TEXT NOT NULL DEFAULT '',
    designation    TEXT NOT NULL DEFAULT '',
    reported_to    TEXT NOT NULL DEFAULT '',
    domain         TEXT NOT NULL DEFAULT 'GIS Developer',
    is_owner       BOOLEAN NOT NULL DEFAULT FALSE,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    password_hash  TEXT,                       -- bcrypt hash; NULL until the user registers/resets
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- magic_links ----------
-- Short-lived, single-use password-reset tokens - see server/src/auth.js.
-- A row is consumed (used_at set) the first time it's redeemed; expired/used
-- rows are rejected. Table name kept from the old magic-link sign-in era -
-- it's now exclusively the "forgot password" / initial-password-set flow.
CREATE TABLE magic_links (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_magic_links_token ON magic_links (token);

-- ---------- submissions (weekly task grid) ----------
-- Mirrors app.js's submitWeek_() payload exactly (app.js:3472-3484).
-- Upserted by (email, week_label), same as the old Firestore doc-ID scheme.
CREATE TABLE submissions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email        TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name         TEXT NOT NULL DEFAULT '',
    designation  TEXT NOT NULL DEFAULT '',
    reported_to  TEXT NOT NULL DEFAULT '',
    domain       TEXT NOT NULL DEFAULT '',
    week_label   TEXT NOT NULL,
    week_range   TEXT NOT NULL DEFAULT '',
    task_format  TEXT NOT NULL DEFAULT 'rows-v1',
    task_rows    JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (email, week_label)
);
CREATE INDEX idx_submissions_email ON submissions (email);

-- ---------- leave_requests ----------
-- Mirrors android-app's data/LeaveRequest.kt field-for-field (see
-- PROJECT.md) - the canonical cross-client shape.
CREATE TABLE leave_requests (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email            TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name             TEXT NOT NULL DEFAULT '',
    week_label       TEXT NOT NULL DEFAULT '',
    type             TEXT NOT NULL DEFAULT 'casualShort',
    start_date       DATE,
    end_date         DATE,
    custom_dates     JSONB NOT NULL DEFAULT '[]',   -- array of ISO date strings
    reason_html      TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'requested', -- requested|approved|rejected|withdrawn
    requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at      TIMESTAMPTZ,
    resolved_by      TEXT NOT NULL DEFAULT '',
    attachments      JSONB NOT NULL DEFAULT '[]',   -- [{name,url,fileId}]
    half_day_period  TEXT NOT NULL DEFAULT '',      -- 'AM' | 'PM', casualShort only
    short_leave_time TEXT NOT NULL DEFAULT '',
    check_out_time   TEXT NOT NULL DEFAULT '',      -- casualOutPass only
    check_in_time    TEXT NOT NULL DEFAULT '',
    decision_note    TEXT NOT NULL DEFAULT '',      -- plain text, never HTML - see PROJECT.md
    withdrawn_at     TIMESTAMPTZ,
    dismissed        BOOLEAN NOT NULL DEFAULT FALSE,
    allow_reschedule BOOLEAN NOT NULL DEFAULT FALSE, -- manager granted this on a rejection; lets the
                                                      -- requester pick new dates on this same row
                                                      -- instead of filing a brand new request
    rescheduled      BOOLEAN NOT NULL DEFAULT FALSE,  -- one-shot: true once the reschedule has been used
    docs_due_at      TIMESTAMPTZ                       -- type='emergency' only, while status is
                                                      -- 'pending_documentation' - see below
);
CREATE INDEX idx_leave_requests_email ON leave_requests (email);
CREATE INDEX idx_leave_requests_status ON leave_requests (status);
-- type also takes 'emergency' (alongside the existing casual*/uninformedAbsence
-- values) and status also takes 'pending_documentation' (a state before
-- 'requested', while an emergency leave is waiting on its reason/attachment -
-- see server/src/routes/leaveRequests.js's /:id/submit-docs route). Neither
-- column has a CHECK constraint, so no DDL is needed for these new values.

-- ---------- uninformed_leaves ----------
-- Mirrors android-app's data/UninformedLeave.kt field-for-field.
CREATE TABLE uninformed_leaves (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email              TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name               TEXT NOT NULL DEFAULT '',
    date               DATE,
    reason_html        TEXT NOT NULL DEFAULT '',
    reported_by        TEXT NOT NULL DEFAULT '',
    reported_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    status             TEXT NOT NULL DEFAULT 'reported', -- reported|explained|resolved
    explanation_html   TEXT NOT NULL DEFAULT '',
    explained_at       TIMESTAMPTZ,
    rejection_note     TEXT NOT NULL DEFAULT '',
    rejection_note_at  TIMESTAMPTZ,
    resolved_at        TIMESTAMPTZ,
    resolved_by        TEXT NOT NULL DEFAULT '',
    resolution_html    TEXT NOT NULL DEFAULT '',
    linked_request_id  UUID REFERENCES leave_requests(id)
);
CREATE INDEX idx_uninformed_leaves_email ON uninformed_leaves (email);
CREATE INDEX idx_uninformed_leaves_status ON uninformed_leaves (status);

-- ---------- push_tokens ----------
CREATE TABLE push_tokens (
    token          TEXT PRIMARY KEY,
    email          TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    platform       TEXT NOT NULL DEFAULT 'android', -- android | ios
    registered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_tokens_email ON push_tokens (email);

-- ---------- attendance ----------
-- Manager-marked daily attendance: present/absent/late only. There is no
-- 'on_leave' value here on purpose - a day covered by an approved
-- leave_requests row (including the leave_requests row every resolved
-- uninformed_leaves report is converted into - see uninformedLeaves.js's
-- /:id/accept route) is derived as "On Leave" at read time by every client,
-- never written here. That keeps exactly one source of truth for "this
-- person was away" - a stored on_leave row could go stale the moment the
-- underlying leave is later withdrawn or edited, with nothing to keep it in
-- sync. A manual mark always wins over a derived On Leave day (covers
-- corrections). Absence of a row for a given (email, date) means "not
-- marked yet", not "absent" - summary stats exclude unmarked days from
-- their percentage math rather than silently treating them as absences.
CREATE TABLE attendance (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    date          DATE NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'night_duty', 'on_duty')),
    note          TEXT NOT NULL DEFAULT '',
    arrival_time  TIME,                            -- only set when status='late'
    batch_id      UUID,                             -- shared by every row created from one On Duty range-mark
    marked_by     TEXT NOT NULL DEFAULT '',
    marked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (email, date)
);
CREATE INDEX idx_attendance_email ON attendance (email);
CREATE INDEX idx_attendance_date ON attendance (date);
CREATE INDEX idx_attendance_batch ON attendance (batch_id);

-- ---------- leave_replacements ----------
-- Optional cover-person on a leave request. "Occupied until free": a person
-- can be the pending/accepted replacement for at most one leave request at a
-- time, enforced by the partial unique index below rather than a date-range
-- overlap check - simpler, and matches "stays occupied until free" literally.
-- A row frees up (no longer counts as occupying anyone) once it's
-- rejected/cancelled, or once its parent leave_requests row is
-- withdrawn/rejected or its last leave day has passed - all computed at
-- query time by joining to leave_requests, same "derive, don't store"
-- philosophy as attendance's On Leave status. No accepted/rejected row is
-- ever deleted - it's just no longer "active".
CREATE TABLE leave_replacements (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leave_request_id   UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    replacement_email  TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    status             TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected|cancelled
    requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at       TIMESTAMPTZ
);
CREATE INDEX idx_leave_replacements_request ON leave_replacements (leave_request_id);
CREATE INDEX idx_leave_replacements_email ON leave_replacements (replacement_email);
CREATE UNIQUE INDEX idx_leave_replacements_one_active
  ON leave_replacements (replacement_email) WHERE status IN ('pending', 'accepted');

-- ---------- late_arrival_notices ----------
-- Self-service: a developer tells their manager ahead of time (or same-day)
-- that they'll be late, with a reason and optional attachments. Purely
-- informational today - no accept/reject workflow, just submitted/acknowledged.
CREATE TABLE late_arrival_notices (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email                  TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name                   TEXT NOT NULL DEFAULT '',
    date                   DATE NOT NULL,
    expected_arrival_time  TIME,
    reason_html            TEXT NOT NULL DEFAULT '',
    attachments            JSONB NOT NULL DEFAULT '[]', -- [{name,url,fileId}]
    status                 TEXT NOT NULL DEFAULT 'submitted', -- submitted|acknowledged
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at        TIMESTAMPTZ,
    acknowledged_by        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_late_notices_email ON late_arrival_notices (email);

-- ============================================================
-- Migration for an ALREADY-existing database (attendance v2 + leave-request
-- workflow expansion, added after the Team feature above). This repo has no
-- migrations tool - hand-run this block once against every database created
-- before this feature existed (this session's local dev DB, and separately,
-- by hand, the production VM's DB):
--   psql -U daily_tasks_app -d daily_tasks -h localhost
-- Do NOT run this block against a brand new database created via
-- `psql -f db/schema.sql` - the CREATE TABLE statements above already
-- reflect this end-state, so it would just error on things that already
-- exist.
-- ============================================================
-- ALTER TABLE attendance DROP CONSTRAINT attendance_status_check;
-- ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
--   CHECK (status IN ('present','absent','late','night_duty','on_duty'));
-- ALTER TABLE attendance ADD COLUMN arrival_time TIME;
-- ALTER TABLE attendance ADD COLUMN batch_id UUID;
-- CREATE INDEX idx_attendance_batch ON attendance (batch_id);
--
-- ALTER TABLE leave_requests ADD COLUMN allow_reschedule BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE leave_requests ADD COLUMN rescheduled BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE leave_requests ADD COLUMN docs_due_at TIMESTAMPTZ;
--
-- CREATE TABLE leave_replacements (
--     id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     leave_request_id   UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
--     replacement_email  TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
--     status             TEXT NOT NULL DEFAULT 'pending',
--     requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
--     responded_at       TIMESTAMPTZ
-- );
-- CREATE INDEX idx_leave_replacements_request ON leave_replacements (leave_request_id);
-- CREATE INDEX idx_leave_replacements_email ON leave_replacements (replacement_email);
-- CREATE UNIQUE INDEX idx_leave_replacements_one_active
--   ON leave_replacements (replacement_email) WHERE status IN ('pending', 'accepted');
--
-- CREATE TABLE late_arrival_notices (
--     id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     email                  TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
--     name                   TEXT NOT NULL DEFAULT '',
--     date                   DATE NOT NULL,
--     expected_arrival_time  TIME,
--     reason_html            TEXT NOT NULL DEFAULT '',
--     attachments            JSONB NOT NULL DEFAULT '[]',
--     status                 TEXT NOT NULL DEFAULT 'submitted',
--     created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
--     acknowledged_at        TIMESTAMPTZ,
--     acknowledged_by        TEXT NOT NULL DEFAULT ''
-- );
-- CREATE INDEX idx_late_notices_email ON late_arrival_notices (email);
