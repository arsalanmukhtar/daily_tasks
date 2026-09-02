// One-time script: imports the existing "Weekly Submissions" and
// "Leave Requests" tabs from the Google Sheet into Firestore's `submissions`
// and `leaveRequests` collections. Run once locally (`node
// import-from-sheets.js` from inside tools/), never deployed anywhere.
// Safe to re-run - deterministic doc IDs mean it overwrites, not duplicates.
//
// Requires:
//   - tools/service-account.json (see tools/README.md)
//   - The Sheet shared with that service account's client_email (Viewer is
//     enough; Editor also works)
//   - The Sheets API enabled for this Google Cloud project
//
// Usage: node import-from-sheets.js <spreadsheetId>

const admin = require('firebase-admin');
const { google } = require('googleapis');
const serviceAccount = require('./service-account.json');

const SPREADSHEET_ID = process.argv[2];
if (!SPREADSHEET_ID) {
  console.error('Usage: node import-from-sheets.js <spreadsheetId>');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const auth = new google.auth.JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});
const sheets = google.sheets({ version: 'v4', auth });

// ---------- ported from app.js's deltaToTaskRows() (legacy Quill Delta) ----------

function escapeHtmlPreservingBreaks(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function deltaToTaskRows(delta) {
  if (!delta || !delta.ops) return null;
  let plain = '';
  for (const op of delta.ops) {
    if (typeof op.insert === 'string') plain += op.insert;
  }
  const dayPattern = /(Monday|Tuesday|Wednesday|Thursday|Friday)\s*[—-]\s*\d{4}-\d{2}-\d{2}/g;
  const matches = [];
  let m;
  while ((m = dayPattern.exec(plain)) !== null) matches.push(m);
  if (!matches.length) {
    return [{ Mon: escapeHtmlPreservingBreaks(plain.trim()) }];
  }
  const dayMap = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };
  const row = {};
  for (let i = 0; i < matches.length; i++) {
    const hit = matches[i];
    const dayKey = dayMap[hit[1]];
    const start = hit.index + hit[0].length;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : plain.length;
    const content = plain.slice(start, end).trim();
    if (content) row[dayKey] = escapeHtmlPreservingBreaks(content);
  }
  return [row];
}

function sanitizeWeekLabel(weekLabel) {
  return String(weekLabel || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseSheetDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function driveFileIdFromUrl(url) {
  const m = /\/d\/([a-zA-Z0-9_-]+)/.exec(String(url || ''));
  return m ? m[1] : null;
}

async function getRows(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING'
  });
  return res.data.values || [];
}

// Firestore batches cap at 500 writes - chunk and commit sequentially.
async function commitInChunks(writes) {
  const CHUNK = 450;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + CHUNK)) {
      batch.set(w.ref, w.data);
    }
    await batch.commit();
    console.log(`  committed ${Math.min(i + CHUNK, writes.length)}/${writes.length}`);
  }
}

async function importSubmissions() {
  console.log('Reading "Weekly Submissions"...');
  const rows = await getRows('Weekly Submissions!A2:J');
  console.log(`  ${rows.length} rows found`);

  const writes = [];
  const warnings = [];

  rows.forEach((r, i) => {
    const [timestamp, email, name, designation, domain, weekLabel, weekRange, , reportedTo, taskJson] = r;
    if (!email || !weekLabel) { warnings.push(`row ${i + 2}: missing email/weekLabel, skipped`); return; }

    let taskRows = null;
    let legacyNote = null;
    if (taskJson) {
      let parsed = null;
      try { parsed = JSON.parse(taskJson); } catch (_e) { /* fall through */ }
      if (parsed && parsed.format === 'rows-v1' && Array.isArray(parsed.rows)) {
        taskRows = parsed.rows;
      } else if (parsed && Array.isArray(parsed.ops)) {
        taskRows = deltaToTaskRows(parsed);
        legacyNote = 'converted from legacy Quill Delta';
      }
    }
    if (!taskRows) {
      // No usable JSON at all - oldest rows, no per-day structure recoverable
      // here. Fall back to the plain-text "Daily Tasks" display column in a
      // single Monday cell so the row isn't lost, and flag it for review.
      const displayText = r[7] || '';
      taskRows = displayText ? [{ Mon: escapeHtmlPreservingBreaks(displayText) }] : [];
      warnings.push(`row ${i + 2} (${email}, ${weekLabel}): no parseable Task Delta JSON - imported as plain text fallback, please review`);
    } else if (legacyNote) {
      warnings.push(`row ${i + 2} (${email}, ${weekLabel}): ${legacyNote}`);
    }

    const emailLower = String(email).toLowerCase();
    const ts = parseSheetDate(timestamp);
    const docId = `${emailLower}_${sanitizeWeekLabel(weekLabel)}`;
    writes.push({
      ref: db.collection('submissions').doc(docId),
      data: {
        email: emailLower,
        name: name || '',
        designation: designation || '',
        reportedTo: reportedTo || '',
        domain: domain || 'GIS Developer',
        weekLabel,
        weekRange: weekRange || '',
        taskFormat: 'rows-v1',
        taskRows,
        createdAt: ts ? admin.firestore.Timestamp.fromDate(ts) : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: ts ? admin.firestore.Timestamp.fromDate(ts) : admin.firestore.FieldValue.serverTimestamp()
      }
    });
  });

  console.log(`Writing ${writes.length} submission docs...`);
  await commitInChunks(writes);
  return warnings;
}

async function importLeaveRequests() {
  console.log('Reading "Leave Requests"...');
  const rows = await getRows('Leave Requests!A2:M');
  console.log(`  ${rows.length} rows found`);

  const writes = [];
  const warnings = [];

  rows.forEach((r, i) => {
    const [requestId, timestamp, email, name, weekLabel, type, reasonHtml, status,
      resolvedAt, resolvedBy, attachmentName, attachmentUrl, dismissed] = r;
    if (!requestId || !email) { warnings.push(`leave row ${i + 2}: missing requestId/email, skipped`); return; }

    const requestedAt = parseSheetDate(timestamp);
    const resolvedAtDate = parseSheetDate(resolvedAt);

    writes.push({
      ref: db.collection('leaveRequests').doc(requestId),
      data: {
        email: String(email).toLowerCase(),
        name: name || '',
        weekLabel: weekLabel || '',
        type: type === 'full' ? 'full' : 'short',
        reasonHtml: reasonHtml || '',
        status: status || 'requested',
        requestedAt: requestedAt ? admin.firestore.Timestamp.fromDate(requestedAt) : admin.firestore.FieldValue.serverTimestamp(),
        resolvedAt: resolvedAtDate ? admin.firestore.Timestamp.fromDate(resolvedAtDate) : null,
        resolvedBy: resolvedBy || null,
        attachmentName: attachmentName || null,
        attachmentUrl: attachmentUrl || null,
        attachmentFileId: driveFileIdFromUrl(attachmentUrl),
        dismissed: String(dismissed).toUpperCase() === 'TRUE'
      }
    });
  });

  console.log(`Writing ${writes.length} leave request docs...`);
  await commitInChunks(writes);
  return warnings;
}

async function main() {
  const allWarnings = [];
  allWarnings.push(...(await importSubmissions()));
  allWarnings.push(...(await importLeaveRequests()));

  console.log('\nDone.');
  if (allWarnings.length) {
    console.log(`\n${allWarnings.length} row(s) worth a manual look:`);
    allWarnings.forEach((w) => console.log('  - ' + w));
  } else {
    console.log('No warnings.');
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
