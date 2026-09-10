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
    dismissed        BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_leave_requests_email ON leave_requests (email);
CREATE INDEX idx_leave_requests_status ON leave_requests (status);

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
