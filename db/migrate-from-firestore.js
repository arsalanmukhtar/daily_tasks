// One-time script: copies every Firestore collection (allowlist,
// submissions, leaveRequests, uninformedLeaves, pushTokens) into the
// Postgres schema in db/schema.sql. Run locally, never deployed anywhere -
// same idiom as tools/seed-allowlist.js and tools/import-from-sheets.js.
//
// Safe to re-run against the same target database: every table is upserted
// by its natural key (see the ON CONFLICT clause in each migrate*()
// function below), so running it twice overwrites rows, never duplicates
// them. Firestore's own auto-IDs (leaveRequests, uninformedLeaves) aren't
// valid Postgres UUIDs, so those two get a deterministic UUID v5 derived
// from the Firestore doc ID instead of a random one - the same Firestore
// doc always maps to the same Postgres row on every run.
//
// Setup: same service-account.json steps as tools/README.md - save the key
// as db/service-account.json (git-ignored), then from inside db/:
//   npm install
//   cp .env.example .env   # fill in DB_* - point at a throwaway database
//                           # first to rehearse, then the real target
//   node migrate-from-firestore.js
//
// Known limitation: leaveRequests.attachments keeps its original Google
// Drive URLs as-is - the old attachment files themselves aren't copied to
// the VM's disk, only the record pointing at them (new uploads after the
// web cutover go straight to disk - see server/src/routes/attachments.js).
// Moving the old Drive files is a manual follow-up, not part of this script.

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const crypto = require('node:crypto');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { Pool } = require('pg');

const serviceAccount = require('./service-account.json');
// firebase-admin@14's CommonJS export moved cert() to the top level
// (admin.cert, not admin.credential.cert like older versions/tools/'s
// scripts, which still pin firebase-admin@13) and dropped admin.firestore()
// in favor of the modular getFirestore() from firebase-admin/firestore.
admin.initializeApp({ credential: admin.cert(serviceAccount) });
const fsDb = getFirestore();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'daily_tasks',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// Fixed, arbitrary namespace for RFC 4122 UUID v5 - only needs to stay the
// same across runs, its actual value carries no meaning.
const UUID_NAMESPACE = Buffer.from('6f8b1a2c3d4e5f60a1b2c3d4e5f6a1b2', 'hex');
function firestoreIdToUuid(firestoreId) {
  const hash = crypto
    .createHash('sha1')
    .update(Buffer.concat([UUID_NAMESPACE, Buffer.from(firestoreId, 'utf8')]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}
function toIsoDate(value) {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : null;
}

async function migrateUsers() {
  const snap = await fsDb.collection('allowlist').get();
  let n = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    await pool.query(
      `INSERT INTO users (email, name, designation, reported_to, domain, is_owner, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name, designation = EXCLUDED.designation, reported_to = EXCLUDED.reported_to,
         domain = EXCLUDED.domain, is_owner = EXCLUDED.is_owner, active = EXCLUDED.active`,
      [
        doc.id.toLowerCase(),
        d.name || '',
        d.designation || '',
        d.reportedTo || '',
        d.domain || 'GIS Developer',
        d.isOwner === true,
        d.active !== false
      ]
    );
    n++;
  }
  console.log(`users: ${n} migrated`);
}

async function migrateSubmissions() {
  const snap = await fsDb.collection('submissions').get();
  let n = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.email || !d.weekLabel) {
      console.warn(`  skipping submissions/${doc.id} - missing email/weekLabel`);
      continue;
    }
    await pool.query(
      `INSERT INTO submissions (email, name, designation, reported_to, domain, week_label, week_range, task_format, task_rows, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (email, week_label) DO UPDATE SET
         name = EXCLUDED.name, designation = EXCLUDED.designation, reported_to = EXCLUDED.reported_to,
         domain = EXCLUDED.domain, week_range = EXCLUDED.week_range, task_format = EXCLUDED.task_format,
         task_rows = EXCLUDED.task_rows, updated_at = EXCLUDED.updated_at`,
      [
        d.email.toLowerCase(),
        d.name || '',
        d.designation || '',
        d.reportedTo || '',
        d.domain || '',
        d.weekLabel,
        d.weekRange || '',
        d.taskFormat || 'rows-v1',
        JSON.stringify(d.taskRows || []),
        toDate(d.createdAt) || new Date(),
        toDate(d.updatedAt) || new Date()
      ]
    );
    n++;
  }
  console.log(`submissions: ${n} migrated`);
}

async function migrateLeaveRequests() {
  const snap = await fsDb.collection('leaveRequests').get();
  let n = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const customDates = Array.isArray(d.customDates) ? d.customDates.map(toIsoDate).filter(Boolean) : [];
    await pool.query(
      `INSERT INTO leave_requests
         (id, email, name, week_label, type, start_date, end_date, custom_dates, reason_html, status,
          requested_at, resolved_at, resolved_by, attachments, half_day_period, short_leave_time,
          check_out_time, check_in_time, decision_note, withdrawn_at, dismissed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (id) DO UPDATE SET
         email=EXCLUDED.email, name=EXCLUDED.name, week_label=EXCLUDED.week_label, type=EXCLUDED.type,
         start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, custom_dates=EXCLUDED.custom_dates,
         reason_html=EXCLUDED.reason_html, status=EXCLUDED.status, requested_at=EXCLUDED.requested_at,
         resolved_at=EXCLUDED.resolved_at, resolved_by=EXCLUDED.resolved_by, attachments=EXCLUDED.attachments,
         half_day_period=EXCLUDED.half_day_period, short_leave_time=EXCLUDED.short_leave_time,
         check_out_time=EXCLUDED.check_out_time, check_in_time=EXCLUDED.check_in_time,
         decision_note=EXCLUDED.decision_note, withdrawn_at=EXCLUDED.withdrawn_at, dismissed=EXCLUDED.dismissed`,
      [
        firestoreIdToUuid(doc.id),
        (d.email || '').toLowerCase(),
        d.name || '',
        d.weekLabel || '',
        d.type || 'casualShort',
        toIsoDate(d.startDate),
        toIsoDate(d.endDate),
        JSON.stringify(customDates),
        d.reasonHtml === '<br>' ? '' : d.reasonHtml || '',
        d.status || 'requested',
        toDate(d.requestedAt) || new Date(),
        toDate(d.resolvedAt),
        d.resolvedBy || '',
        JSON.stringify(d.attachments || []),
        d.halfDayPeriod || '',
        d.shortLeaveTime || '',
        d.checkOutTime || '',
        d.checkInTime || '',
        d.decisionNote || '',
        toDate(d.withdrawnAt),
        d.dismissed === true
      ]
    );
    n++;
  }
  console.log(`leaveRequests: ${n} migrated`);
}

async function migrateUninformedLeaves() {
  const snap = await fsDb.collection('uninformedLeaves').get();
  let n = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    await pool.query(
      `INSERT INTO uninformed_leaves
         (id, email, name, date, reason_html, reported_by, reported_at, status, explanation_html, explained_at,
          rejection_note, rejection_note_at, resolved_at, resolved_by, resolution_html, linked_request_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         email=EXCLUDED.email, name=EXCLUDED.name, date=EXCLUDED.date, reason_html=EXCLUDED.reason_html,
         reported_by=EXCLUDED.reported_by, reported_at=EXCLUDED.reported_at, status=EXCLUDED.status,
         explanation_html=EXCLUDED.explanation_html, explained_at=EXCLUDED.explained_at,
         rejection_note=EXCLUDED.rejection_note, rejection_note_at=EXCLUDED.rejection_note_at,
         resolved_at=EXCLUDED.resolved_at, resolved_by=EXCLUDED.resolved_by,
         resolution_html=EXCLUDED.resolution_html, linked_request_id=EXCLUDED.linked_request_id`,
      [
        firestoreIdToUuid(doc.id),
        (d.email || '').toLowerCase(),
        d.name || '',
        toIsoDate(d.date),
        d.reasonHtml || '',
        d.reportedBy || '',
        toDate(d.reportedAt) || new Date(),
        d.status || 'reported',
        d.explanationHtml || '',
        toDate(d.explainedAt),
        d.rejectionNote || '',
        toDate(d.rejectionNoteAt),
        toDate(d.resolvedAt),
        d.resolvedBy || '',
        d.resolutionHtml || '',
        // Same firestoreIdToUuid() function, so this always lands on the
        // exact row migrateLeaveRequests() just wrote for that doc, with no
        // need to track a separate ID map between the two functions.
        d.linkedRequestId ? firestoreIdToUuid(d.linkedRequestId) : null
      ]
    );
    n++;
  }
  console.log(`uninformedLeaves: ${n} migrated`);
}

async function migratePushTokens() {
  const snap = await fsDb.collection('pushTokens').get();
  let n = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.email) {
      console.warn(`  skipping pushTokens/${doc.id} - missing email`);
      continue;
    }
    await pool.query(
      `INSERT INTO push_tokens (token, email, platform, registered_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (token) DO UPDATE SET
         email = EXCLUDED.email, platform = EXCLUDED.platform, registered_at = EXCLUDED.registered_at`,
      [doc.id, d.email.toLowerCase(), d.platform === 'ios' ? 'ios' : 'android', toDate(d.registeredAt) || new Date()]
    );
    n++;
  }
  console.log(`pushTokens: ${n} migrated`);
}

async function main() {
  console.log(`Migrating Firestore -> Postgres (${process.env.DB_NAME || 'daily_tasks'} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432})`);
  // users first - submissions/leaveRequests/uninformedLeaves all
  // FK-reference users.email. leaveRequests before uninformedLeaves so the
  // latter's linked_request_id FK always finds its target already written.
  await migrateUsers();
  await migrateSubmissions();
  await migrateLeaveRequests();
  await migrateUninformedLeaves();
  await migratePushTokens();
  await pool.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
