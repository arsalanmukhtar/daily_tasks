/**
 * Tech EW – Weekly Time Sheet backend (Firebase-authenticated).
 *
 * Setup:
 *   1. Open the Google Sheet that the original Google Form writes to
 *   2. Extensions → Apps Script
 *   3. Replace Code.gs with this file
 *   4. Fill the CONFIG block below (Firebase API key + project ID + allowlist)
 *   5. Deploy → New deployment → Type: Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *   6. Copy the /exec URL into app.js
 *
 * Security model:
 * - Each submission carries a Firebase ID token (JWT) from a signed-in Google user.
 * - We verify the token by calling Google's identitytoolkit accounts:lookup endpoint.
 *     A valid response proves the token was issued by *this* Firebase project (the API
 *     key scopes the call) and is unexpired.
 * - We then check the verified email against ALLOWLIST. The submitter's display name
 *     is taken from the allowlist, never trusted from the client payload.
 */

// =====================================================
// CONFIG - fill these in.
// =====================================================

// Bump this on EVERY redeploy. doGet() echoes it back, so opening the /exec
// URL and checking the "version" field confirms the new code actually went live.
const BACKEND_VERSION = 'v22-debug-sheet';

const FIREBASE_API_KEY = 'AIzaSyA1exz20sN1WqLQdNkP986JX5wHuICYolg';
const FIREBASE_PROJECT_ID = 'devteam-daily-tasks';

// ---- Push notifications (leave-request approvals) ----
// The manager approves/rejects leave requests from a small installable PWA
// (manager.html) rather than a chat bot - Telegram is banned in the user's
// region, Discord's bot API is Cloudflare-blocked from Apps Script's shared
// IP pool (403 "internal network error", code 40333), and Google Chat apps
// require a paid Workspace account. FCM push credentials live in Script
// Properties (Project Settings -> Script Properties -> FCM_SERVICE_ACCOUNT_JSON),
// never in source, so they never end up committed to a file - see
// getFcmAccessToken_ below.

// Must mirror the ALLOWLIST in app.js. Emails MUST be lowercase here.
// Each entry is { name, designation, reportedTo } - the server treats all
// three as fixed for that user. `reportedTo` is the manager this user reports
// to; it is written to BOTH the "Assigned By" and "Report To" sheet columns
// and shown on the form. The server uses this map as the source of truth.
const ALLOWLIST = {
  'developer.ndma@gmail.com': { name: 'Muhammad Arsalan Mukhtar', designation: 'Deputy Manager - I', reportedTo: 'Junaid Aziz Khan' },
  'as2040704@gmail.com': { name: 'Abdul Sattar Sheikh', designation: 'Assistant Manager - II', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'mustafa.haider2011@gmail.com': { name: 'Syed Mustafa Haider', designation: 'Assistant Manager - III', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'shehzadalikhan586@gmail.com': { name: 'Shehzad Ali', designation: 'Assistant Manager - I', reportedTo: 'Kashif Iqbal' },
  'seemalnaeem100@gmail.com': { name: 'Seemal Naeem', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'muddasir.ndma25@gmail.com': { name: 'Muddasir Shah', designation: 'Assistant Manager - I', reportedTo: 'Imtiaz Nabi' },
  'ahad.khan.work01@gmail.com': { name: 'Muhammad Ahad Khan', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'zainabali27feb2004@gmail.com': { name: 'Zainab Ali', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'ttalha063@gmail.com': { name: 'Talha Rizwan', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'zeeshannasir2001@gmail.com': { name: 'Zeeshan Nasir', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'ibrahimabdullahh84@gmail.com': { name: 'Ibrahim Abdullah', designation: 'Assistant Manager - I', reportedTo: 'Imtiaz Nabi' },
  'usamabinumar199@gmail.com': { name: 'Usama bin Umar', designation: 'Intern', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'osamakhan32156@gmail.com': { name: 'Muhammad Osama Khan', designation: 'Intern', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'muqeetahmad155@gmail.com': { name: 'Muqeet Ahmad', designation: 'Assistant Manager - I', reportedTo: 'Imtiaz Nabi' }
};

// The account owner - the only user allowed to export the team-wide weekly
// summary. Must be lowercase and present in ALLOWLIST.
const OWNER_EMAIL = 'developer.ndma@gmail.com';

const SHEET_NAME = 'Weekly Submissions';

// The last column stores the raw Quill Delta JSON so we can round-trip into
// the editor losslessly when a user reloads their own submission for editing.
const HEADERS = [
  'Timestamp',
  'Email',
  'Name',
  'Designation',
  'Domain',
  'Week',
  'Week Range',
  'Daily Tasks',
  'Report To',
  'Task Delta JSON'
];

const LEAVE_SHEET_NAME = 'Leave Requests';
const LEAVE_FULL_COOLDOWN_DAYS = 7;
const LEAVE_HEADERS = [
  'Request ID',
  'Timestamp',
  'Email',
  'Name',
  'Week Label',
  'Type',
  'Reason HTML',
  'Status',
  'Resolved At',
  'Resolved By',
  'Attachment Name',
  'Attachment URL',
  'Dismissed'
];

const PUSH_TOKEN_SHEET_NAME = 'Push Tokens';
const PUSH_TOKEN_HEADERS = ['Email', 'Token', 'Platform', 'Registered At'];

// =====================================================

function doPost(e) {
  debugLog_('1. doPost invoked',
    'parameter keys=' + (e && e.parameter ? Object.keys(e.parameter).join(',') : 'none') +
    ' / postData=' + (e && e.postData ? 'present' : 'absent'));

  const bodyString = (e && e.parameter && e.parameter.payload) ||
    (e && e.postData && e.postData.contents) || null;
  if (bodyString) {
    let action = null;
    try { action = JSON.parse(bodyString).action; } catch (_e) { /* not JSON with an action - a normal submission */ }
    if (action === 'applyLeave') return applyLeave_(bodyString);
    if (action === 'dismissLeave') return dismissLeave_(bodyString);
    if (action === 'registerPushToken') return registerPushToken_(bodyString);
    if (action === 'decideLeave') return decideLeave_(bodyString);
  }
  return processSubmission_(e);
}

function processSubmission_(e) {
  try {
    // Accept both form-encoded (hidden-iframe form POST) and raw text/plain.
    let bodyString = null;
    if (e && e.parameter && e.parameter.payload) {
      bodyString = e.parameter.payload;
      debugLog_('2. body via', 'e.parameter.payload (len ' + bodyString.length + ')');
    } else if (e && e.postData && e.postData.contents) {
      bodyString = e.postData.contents;
      debugLog_('2. body via', 'e.postData.contents (len ' + bodyString.length + ')');
    }

    if (!bodyString) {
      debugLog_('2a. ABORT: no body anywhere', 'parameter=' + JSON.stringify(e && e.parameter || {}) + ' / postData=' + String(e && e.postData));
      return jsonResponse_({ status: 'error', message: 'No POST body received.' });
    }
    debugLog_('2b. body preview', bodyString.substring(0, 300));

    const body = JSON.parse(bodyString);
    debugLog_('3. parsed keys', Object.keys(body).join(','));

    if (!body.idToken) {
      debugLog_('4a. ABORT: missing idToken', '');
      return jsonResponse_({ status: 'error', message: 'Missing auth token.' });
    }
    debugLog_('4. idToken first 40 chars', body.idToken.substring(0, 40));

    let verified;
    try {
      verified = verifyIdToken_(body.idToken);
    } catch (err) {
      debugLog_('5a. ABORT: token verify failed', err.message);
      return jsonResponse_({ status: 'error', message: 'Unauthorized: ' + err.message });
    }
    debugLog_('5. verified email', verified.email);

    const email = (verified.email || '').toLowerCase();
    const entry = ALLOWLIST[email];
    if (!entry) {
      debugLog_('6a. ABORT: email not in allowlist', email + ' / allowed=' + Object.keys(ALLOWLIST).join(','));
      return jsonResponse_({ status: 'error', message: 'Email ' + email + ' is not authorized.' });
    }
    const displayName = entry.name;
    const designation = entry.designation;
    const reportedTo = entry.reportedTo || '';
    debugLog_('6. allowlist hit', email + ' → ' + displayName + ' (' + designation + ') reportedTo=' + (reportedTo || '(unset)'));

    const sheet = getOrCreateSheet_();
    ensureExtendedHeaders_(sheet);
    debugLog_('8. target sheet', sheet.getName() + ' in workbook: ' + sheet.getParent().getName() + ' (id ' + sheet.getParent().getId() + ')');

    const weekLabel = body.weekLabel || '';
    const weekRange = body.weekRange || '';

    // New format (rows-v1): client sends `taskRows` as an array of
    // {Mon, Tue, Wed, Thu, Fri} where each value is the cell's HTML.
    // Legacy clients still send `taskDelta` (Quill Delta); we keep storing
    // those untouched so they round-trip cleanly.
    const hasRows = Array.isArray(body.taskRows);
    let taskJson, sheetCellWriter;
    if (hasRows) {
      taskJson = JSON.stringify({ format: 'rows-v1', rows: body.taskRows });
      sheetCellWriter = function (cellRange) {
        cellRange.setValue(rowsToSheetText_(body.taskRows, weekRange))
          .setWrap(true).setVerticalAlignment('top');
      };
    } else {
      taskJson = JSON.stringify(body.taskDelta || { ops: [] });
      const richText = deltaToRichText_(body.taskDelta);
      sheetCellWriter = function (cellRange) {
        cellRange.setRichTextValue(richText).setWrap(true).setVerticalAlignment('top');
      };
    }

    const rowValues = [
      new Date(),
      email,
      displayName,
      designation,
      'GIS Developer',
      weekLabel,
      weekRange,
      '',
      reportedTo,   // Report To
      taskJson
    ];

    // Upsert by (email, weekLabel): one submission per user per ISO week.
    const targetRow = findRowByEmailAndWeek_(sheet, email, weekLabel);
    let row;
    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
      row = targetRow;
      debugLog_('9. upsert: overwrite', 'row ' + row + ' for ' + email + ' / ' + weekLabel);
    } else {
      sheet.appendRow(rowValues);
      row = sheet.getLastRow();
      debugLog_('9. upsert: append', 'row ' + row + ' for ' + email + ' / ' + weekLabel);
    }

    sheetCellWriter(sheet.getRange(row, 8));

    debugLog_('10. SUCCESS', 'row ' + row + ' (' + (targetRow > 0 ? 'overwrite' : 'append') + ')');
    return jsonResponse_({ status: 'ok', row: row, mode: targetRow > 0 ? 'overwrite' : 'append' });
  } catch (err) {
    debugLog_('99. FATAL', String(err && err.stack || err));
    return jsonResponse_({ status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Run this manually from the Apps Script editor:
 *   1. In the function dropdown at the top, select `testBinding`
 *   2. Click ▶ Run
 *   3. View → Execution log
 * It prints which spreadsheet the script is actually bound to.
 */
function testBinding() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    console.log('NULL - getActiveSpreadsheet() returned null. The script is not bound to a spreadsheet.');
    return;
  }
  console.log('Bound spreadsheet NAME: ' + ss.getName());
  console.log('Bound spreadsheet ID:   ' + ss.getId());
  console.log('Bound spreadsheet URL:  ' + ss.getUrl());
  console.log('Tabs in this sheet:     ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
}

/**
 * Writes a row to a `_Debug` tab in the bound spreadsheet so we can see
 * exactly which path doPost took, without needing the cloud-logs UI.
 */
function debugLog_(label, data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    let sheet = ss.getSheetByName('_Debug');
    if (!sheet) {
      sheet = ss.insertSheet('_Debug');
      sheet.getRange(1, 1, 1, 3).setValues([['Timestamp', 'Step', 'Data']])
        .setFontWeight('bold').setBackground('#fef3c7');
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(1, 180);
      sheet.setColumnWidth(2, 220);
      sheet.setColumnWidth(3, 600);
    }
    sheet.appendRow([new Date(), label, typeof data === 'string' ? data : JSON.stringify(data)]);
  } catch (e) {
    // best-effort logger - swallow failures so they don't mask the real error
  }
}

function doGet(e) {
  if (e && e.parameter) {
    if (e.parameter.action === 'list') {
      return listSubmissions_(e);
    }
    if (e.parameter.action === 'export') {
      return exportWeek_(e);
    }
    if (e.parameter.action === 'analytics') {
      return analyticsData_(e);
    }
    if (e.parameter.action === 'leaveStatus') {
      return leaveStatus_(e);
    }
    if (e.parameter.action === 'leaveAnalytics') {
      return leaveAnalytics_(e);
    }
    if (e.parameter.action === 'listLeaveRequests') {
      return listLeaveRequests_(e);
    }
    // If a payload arrives as a GET parameter, treat it as a submission
    // (some browsers downgrade POST→GET on Apps Script's 302 redirect).
    if (e.parameter.payload) {
      let action = null;
      try { action = JSON.parse(e.parameter.payload).action; } catch (_e) { /* not JSON with an action */ }
      if (action === 'applyLeave') return applyLeave_(e.parameter.payload);
      if (action === 'dismissLeave') return dismissLeave_(e.parameter.payload);
      if (action === 'registerPushToken') return registerPushToken_(e.parameter.payload);
      if (action === 'decideLeave') return decideLeave_(e.parameter.payload);
      debugLog_('doGet with payload (forwarding to submission)', 'len=' + e.parameter.payload.length);
      return processSubmission_(e);
    }
  }
  debugLog_('doGet invoked (no payload)', 'parameter=' + JSON.stringify(e && e.parameter || {}));
  // jsonOrJsonp_ (not jsonResponse_): a JSONP caller (list/export/analytics)
  // that sends an `action` this deployment doesn't recognise yet - e.g. it
  // hasn't been redeployed since a new endpoint was added - must still get a
  // JS-wrapped response. A bare JSON body loaded via <script src> gets
  // silently blocked by the browser's Cross-Origin Read Blocking, which
  // surfaces to the caller as a generic "could not reach the endpoint" error
  // instead of a readable one.
  return jsonOrJsonp_(e, {
    status: 'ok',
    message: 'Tech EW endpoint live',
    version: BACKEND_VERSION
  });
}

/**
 * Returns the calling user's submissions (rows where Email column matches the
 * verified token's email). Used by the "My Submissions" drawer to let users
 * reload their own past entries for editing.
 *
 * GET ?action=list&idToken=...
 */
function listSubmissions_(e) {
  try {
    const idToken = e && e.parameter && e.parameter.idToken;
    if (!idToken) return jsonOrJsonp_(e, { status: 'error', message: 'Missing auth token.' });

    let verified;
    try {
      verified = verifyIdToken_(idToken);
    } catch (err) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    if (!ALLOWLIST[email]) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Email ' + email + ' is not authorized.' });
    }

    const sheet = getOrCreateSheet_();
    ensureExtendedHeaders_(sheet);
    const last = sheet.getLastRow();
    if (last < 2) return jsonOrJsonp_(e, { status: 'ok', submissions: [] });

    const dataRange = sheet.getRange(2, 1, last - 1, HEADERS.length);
    const values = dataRange.getValues();
    const richVals = dataRange.getRichTextValues();
    const submissions = [];
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      if (String(r[1] || '').toLowerCase() !== email) continue;

      // The Task Delta JSON column stores either:
      // - { format: 'rows-v1', rows: [...] }   (new, table editor)
      // - { ops: [...] }                       (legacy, Quill Delta)
      // Fall back to reconstructing a Delta from the visible rich-text cell
      // for very old rows where that column didn't exist yet.
      let taskRows = null;
      let taskDelta = null;
      const cellJson = r[9];
      if (cellJson) {
        try {
          const parsed = JSON.parse(cellJson);
          if (parsed && parsed.format === 'rows-v1' && Array.isArray(parsed.rows)) {
            taskRows = parsed.rows;
          } else if (parsed && parsed.ops) {
            taskDelta = parsed;
          }
        } catch (_e) { /* fall through to richtext fallback */ }
      }
      if (!taskRows && !taskDelta) {
        taskDelta = richTextValueToDelta_(richVals[i][7]);
      }

      submissions.push({
        rowIndex: i + 2,
        timestamp: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ''),
        weekLabel: r[5] || '',
        weekRange: r[6] || '',
        designation: r[3] || '',
        taskRows: taskRows,
        taskDelta: taskDelta,
        taskPlain: String(r[7] || '')
      });
    }
    // Most recent submissions first.
    submissions.sort(function (a, b) { return String(b.timestamp).localeCompare(String(a.timestamp)); });

    return jsonOrJsonp_(e, { status: 'ok', submissions: submissions });
  } catch (err) {
    return jsonOrJsonp_(e, { status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Owner-only: returns every developer's submission for a single week. Powers
 * the "Export weekly summary" button, which builds a multi-sheet Excel
 * workbook (one worksheet per developer) on the client.
 *
 * GET ?action=export&week=Week%2021%2C%202026&idToken=...&callback=...
 */
function exportWeek_(e) {
  try {
    const idToken = e && e.parameter && e.parameter.idToken;
    if (!idToken) return jsonOrJsonp_(e, { status: 'error', message: 'Missing auth token.' });

    let verified;
    try {
      verified = verifyIdToken_(idToken);
    } catch (err) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    if (email !== OWNER_EMAIL) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Only the account owner can export the weekly summary.' });
    }

    const week = e && e.parameter && e.parameter.week;
    if (!week) return jsonOrJsonp_(e, { status: 'error', message: 'Missing week.' });

    const sheet = getOrCreateSheet_();
    ensureExtendedHeaders_(sheet);
    const last = sheet.getLastRow();
    const submissions = [];
    if (last >= 2) {
      const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (String(r[5] || '') !== week) continue;

        // Prefer the structured rows-v1 payload so the client can rebuild a
        // per-day grid; legacy delta-only rows fall back to plain text.
        let taskRows = null;
        const cellJson = r[9];
        if (cellJson) {
          try {
            const parsed = JSON.parse(cellJson);
            if (parsed && parsed.format === 'rows-v1' && Array.isArray(parsed.rows)) {
              taskRows = parsed.rows;
            }
          } catch (_e) { /* ignore - fall back to plain text */ }
        }

        submissions.push({
          email: String(r[1] || '').toLowerCase(),
          name: r[2] || '',
          designation: r[3] || '',
          weekLabel: r[5] || '',
          weekRange: r[6] || '',
          reportedTo: r[8] || '',
          taskPlain: String(r[7] || ''),
          taskRows: taskRows
        });
      }
    }

    return jsonOrJsonp_(e, { status: 'ok', week: week, submissions: submissions });
  } catch (err) {
    return jsonOrJsonp_(e, { status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Owner-only: returns every developer's submissions across every week,
 * aggregated into per-day item/char counts (not raw HTML) so the client can
 * build the Analytics dashboard without re-parsing task content. Also
 * returns the full ALLOWLIST roster (even developers with zero submissions)
 * so the client can compute missed-week/consistency metrics against the
 * whole team, not just people who happened to submit.
 *
 * "Item count" = number of <li> bullets in a day's cell content (or 1 if
 * there's plain text but no list). This is an activity/volume proxy, not a
 * quality measure - the sheet has no hours/effort field to draw from.
 *
 * GET ?action=analytics&idToken=...&callback=...
 */
function analyticsData_(e) {
  try {
    const idToken = e && e.parameter && e.parameter.idToken;
    if (!idToken) return jsonOrJsonp_(e, { status: 'error', message: 'Missing auth token.' });

    let verified;
    try {
      verified = verifyIdToken_(idToken);
    } catch (err) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    if (email !== OWNER_EMAIL) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Only the account owner can view analytics.' });
    }

    const sheet = getOrCreateSheet_();
    ensureExtendedHeaders_(sheet);
    const last = sheet.getLastRow();
    const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const submissions = [];

    if (last >= 2) {
      const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const subEmail = String(r[1] || '').toLowerCase();
        const allowEntry = ALLOWLIST[subEmail];
        if (!allowEntry) continue; // orphaned row from a removed team member

        let taskRows = null;
        const cellJson = r[9];
        if (cellJson) {
          try {
            const parsed = JSON.parse(cellJson);
            if (parsed && parsed.format === 'rows-v1' && Array.isArray(parsed.rows)) {
              taskRows = parsed.rows;
            }
          } catch (_e) { /* fall through to legacy handling below */ }
        }

        const dayItemCounts = {};
        const dayCharCounts = {};
        let totalItems = 0;
        let daysWithContent = 0;

        if (taskRows) {
          dayKeys.forEach(function (d) {
            let items = 0, chars = 0;
            taskRows.forEach(function (row) {
              const html = row && row[d];
              if (!html) return;
              items += countDayItems_(html);
              chars += stripHtml_(html).trim().length;
            });
            dayItemCounts[d] = items;
            dayCharCounts[d] = chars;
            totalItems += items;
            if (items > 0) daysWithContent++;
          });
        } else {
          // Legacy delta-only row (pre rows-v1): no per-day split is
          // recoverable, so count it as one undated item if it has content.
          dayKeys.forEach(function (d) { dayItemCounts[d] = 0; dayCharCounts[d] = 0; });
          const plain = String(r[7] || '').trim();
          if (plain) { totalItems = 1; daysWithContent = 1; }
        }

        submissions.push({
          email: subEmail,
          name: r[2] || allowEntry.name,
          designation: r[3] || allowEntry.designation,
          weekLabel: r[5] || '',
          weekRange: r[6] || '',
          timestamp: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ''),
          dayItemCounts: dayItemCounts,
          dayCharCounts: dayCharCounts,
          totalItems: totalItems,
          daysWithContent: daysWithContent
        });
      }
    }

    const roster = Object.keys(ALLOWLIST).map(function (em) {
      return { email: em, name: ALLOWLIST[em].name, designation: ALLOWLIST[em].designation };
    });

    return jsonOrJsonp_(e, { status: 'ok', roster: roster, submissions: submissions });
  } catch (err) {
    return jsonOrJsonp_(e, { status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Counts "bullets" in a day cell's HTML: number of <li> tags, or 1 if there's
 * plain content with no list markup, or 0 if empty. Mirrors the item-count
 * semantics analyticsData_ needs; deliberately simpler than stripHtml_ since
 * it only needs a count, not the rendered text.
 */
function countDayItems_(html) {
  if (!html) return 0;
  const liCount = (String(html).match(/<li[^>]*>/gi) || []).length;
  if (liCount > 0) return liCount;
  return stripHtml_(html).trim() ? 1 : 0;
}

// =====================================================
// Leave requests (approved via manager.html)
// =====================================================

function getOrCreateLeaveSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LEAVE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LEAVE_SHEET_NAME);
    sheet.getRange(1, 1, 1, LEAVE_HEADERS.length).setValues([LEAVE_HEADERS])
      .setFontWeight('bold')
      .setBackground('#eef2ff')
      .setFontColor('#1e293b');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(7, 400); // Reason HTML
  }
  return sheet;
}

/**
 * Saves a leave request to the Leave Requests sheet, uploads any attachment
 * to Drive, and pushes a notification to the manager's registered devices.
 * The manager approves/rejects from manager.html, which calls decideLeave_
 * directly - there's no polling involved.
 *
 * A failed Drive upload or push send does NOT fail the request - the row is
 * saved either way, so nothing is lost if push isn't set up yet or a send
 * briefly fails.
 *
 * POST body: { action: 'applyLeave', idToken, weekLabel, type, reasonHtml,
 *              attachmentName?, attachmentMimeType?, attachmentBase64? }
 */
function applyLeave_(bodyString) {
  try {
    const body = JSON.parse(bodyString);
    if (!body.idToken) return jsonResponse_({ status: 'error', message: 'Missing auth token.' });

    let verified;
    try {
      verified = verifyIdToken_(body.idToken);
    } catch (err) {
      return jsonResponse_({ status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    const entry = ALLOWLIST[email];
    if (!entry) return jsonResponse_({ status: 'error', message: 'Email ' + email + ' is not authorized.' });

    const weekLabel = String(body.weekLabel || '');
    if (!weekLabel) return jsonResponse_({ status: 'error', message: 'Missing week.' });
    const type = body.type === 'full' ? 'full' : 'short';
    const reasonHtml = String(body.reasonHtml || '');
    const reasonPlain = stripHtml_(reasonHtml) || '(no reason provided)';

    let attachmentUrl = '';
    if (body.attachmentBase64 && body.attachmentName) {
      try {
        attachmentUrl = saveLeaveAttachment_(body.attachmentName, body.attachmentMimeType, body.attachmentBase64);
      } catch (err) {
        debugLog_('applyLeave_: attachment save failed', String(err && err.message || err));
      }
    }

    const sheet = getOrCreateLeaveSheet_();
    const requestId = Utilities.getUuid();
    sheet.appendRow([
      requestId,
      new Date(),
      email,
      entry.name,
      weekLabel,
      type,
      reasonHtml,
      'requested',
      '',   // Resolved At
      '',   // Resolved By
      body.attachmentName || '',
      attachmentUrl,
      false // Dismissed
    ]);

    try {
      const typeLabel = type === 'full' ? 'Full Leave' : 'Short Leave';
      sendPushToOwner_('New leave request', entry.name + ' - ' + typeLabel + ' for ' + weekLabel, { requestId: requestId });
    } catch (err) {
      debugLog_('applyLeave_: push send failed', String(err && err.message || err));
    }

    return jsonResponse_({ status: 'ok', requestId: requestId });
  } catch (err) {
    return jsonResponse_({ status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Lets a user clear an Approved/Rejected request off their own button once
 * they've seen it (the portal's "Ok" link) - marks Dismissed instead of
 * deleting the row, so the record stays in the sheet for history.
 *
 * POST body: { action: 'dismissLeave', idToken, requestId }
 */
function dismissLeave_(bodyString) {
  try {
    const body = JSON.parse(bodyString);
    if (!body.idToken) return jsonResponse_({ status: 'error', message: 'Missing auth token.' });

    let verified;
    try {
      verified = verifyIdToken_(body.idToken);
    } catch (err) {
      return jsonResponse_({ status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();

    const sheet = getOrCreateLeaveSheet_();
    const row = findLeaveRequestRow_(sheet, body.requestId);
    if (row < 0) return jsonResponse_({ status: 'error', message: 'Request not found.' });
    const rowEmail = String(sheet.getRange(row, 3).getValue() || '').toLowerCase();
    if (rowEmail !== email) return jsonResponse_({ status: 'error', message: 'Not your request.' });

    sheet.getRange(row, 13).setValue(true);
    return jsonResponse_({ status: 'ok' });
  } catch (err) {
    return jsonResponse_({ status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Returns every leave request the calling user has ever submitted (their
 * own rows only, excluding dismissed ones), plus a full-leave cooldown
 * computed from their most recent Full Leave request. The client picks out
 * "this week's" record from the list and reuses the same list, with its own
 * date-range filter, to drive the per-user leave-metrics chart.
 *
 * GET ?action=leaveStatus&idToken=...&callback=...
 */
function leaveStatus_(e) {
  try {
    const idToken = e && e.parameter && e.parameter.idToken;
    if (!idToken) return jsonOrJsonp_(e, { status: 'error', message: 'Missing auth token.' });

    let verified;
    try {
      verified = verifyIdToken_(idToken);
    } catch (err) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    if (!ALLOWLIST[email]) return jsonOrJsonp_(e, { status: 'error', message: 'Email ' + email + ' is not authorized.' });

    const sheet = getOrCreateLeaveSheet_();
    const last = sheet.getLastRow();
    const records = [];
    let lastFullAt = null;

    if (last >= 2) {
      const values = sheet.getRange(2, 1, last - 1, LEAVE_HEADERS.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        if (String(r[2] || '').toLowerCase() !== email) continue;
        const ts = r[1] instanceof Date ? r[1] : new Date(r[1]);
        if (r[5] === 'full' && (!lastFullAt || ts > lastFullAt)) lastFullAt = ts;
        if (r[12] === true) continue; // dismissed - hide from the client entirely
        const resolvedAt = r[8] instanceof Date ? r[8] : (r[8] ? new Date(r[8]) : null);
        records.push({
          requestId: r[0],
          requestedAt: (ts instanceof Date && !isNaN(ts.getTime())) ? ts.toISOString() : String(r[1] || ''),
          weekLabel: r[4] || '',
          type: r[5] || 'short',
          reasonHtml: r[6] || '',
          status: r[7] || 'requested',
          resolvedAt: (resolvedAt && !isNaN(resolvedAt.getTime())) ? resolvedAt.toISOString() : '',
          resolvedBy: r[9] || '',
          attachmentName: r[10] || '',
          attachmentUrl: r[11] || ''
        });
      }
    }
    records.reverse(); // newest first

    const cooldownUntil = lastFullAt ? new Date(lastFullAt.getTime() + LEAVE_FULL_COOLDOWN_DAYS * 86400000) : null;
    return jsonOrJsonp_(e, {
      status: 'ok',
      records: records,
      fullLeaveCooldownUntil: cooldownUntil ? cooldownUntil.toISOString() : null
    });
  } catch (err) {
    return jsonOrJsonp_(e, { status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Owner-only: aggregate leave-request counts across the whole team, for the
 * Analytics panel's "Leave activity" KPIs.
 *
 * GET ?action=leaveAnalytics&idToken=...&callback=...
 */
function leaveAnalytics_(e) {
  try {
    const idToken = e && e.parameter && e.parameter.idToken;
    if (!idToken) return jsonOrJsonp_(e, { status: 'error', message: 'Missing auth token.' });

    let verified;
    try {
      verified = verifyIdToken_(idToken);
    } catch (err) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    if (email !== OWNER_EMAIL) return jsonOrJsonp_(e, { status: 'error', message: 'Only the account owner can view leave analytics.' });

    const sheet = getOrCreateLeaveSheet_();
    const last = sheet.getLastRow();
    const counts = { shortTaken: 0, fullTaken: 0, approved: 0, rejected: 0 };
    if (last >= 2) {
      const values = sheet.getRange(2, 1, last - 1, LEAVE_HEADERS.length).getValues();
      values.forEach(function (r) {
        if (r[5] === 'short') counts.shortTaken++;
        else if (r[5] === 'full') counts.fullTaken++;
        if (r[7] === 'approved') counts.approved++;
        else if (r[7] === 'rejected') counts.rejected++;
      });
    }
    return jsonOrJsonp_(e, { status: 'ok', counts: counts });
  } catch (err) {
    return jsonOrJsonp_(e, { status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Returns 1-based sheet row index of the leave request with this Request ID,
 * or -1 if none exists.
 */
function findLeaveRequestRow_(sheet, requestId) {
  const last = sheet.getLastRow();
  if (last < 2 || !requestId) return -1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(requestId)) return i + 2;
  }
  return -1;
}

// ---------- Leave attachments (Drive) ----------

const LEAVE_ATTACHMENT_FOLDER_NAME = 'Tech EW Leave Attachments';

function getOrCreateAttachmentFolder_() {
  const folders = DriveApp.getFoldersByName(LEAVE_ATTACHMENT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(LEAVE_ATTACHMENT_FOLDER_NAME);
}

/**
 * Saves a base64-encoded attachment to Drive and returns a shareable view
 * URL. Anyone with the link can view it - acceptable for this small
 * internal tool, matching the low-friction sharing already used elsewhere.
 */
function saveLeaveAttachment_(name, mimeType, base64) {
  const folder = getOrCreateAttachmentFolder_();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || 'application/octet-stream', name);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

// ---------- Push tokens ----------

function getOrCreatePushTokenSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PUSH_TOKEN_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PUSH_TOKEN_SHEET_NAME);
    sheet.getRange(1, 1, 1, PUSH_TOKEN_HEADERS.length).setValues([PUSH_TOKEN_HEADERS])
      .setFontWeight('bold')
      .setBackground('#eef2ff')
      .setFontColor('#1e293b');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Owner-only: upserts an FCM registration token for one of the manager's
 * devices (they may have a phone and a desktop registered at once).
 *
 * POST body: { action: 'registerPushToken', idToken, token, platform }
 */
function registerPushToken_(bodyString) {
  try {
    const body = JSON.parse(bodyString);
    if (!body.idToken) return jsonResponse_({ status: 'error', message: 'Missing auth token.' });
    if (!body.token) return jsonResponse_({ status: 'error', message: 'Missing push token.' });

    let verified;
    try {
      verified = verifyIdToken_(body.idToken);
    } catch (err) {
      return jsonResponse_({ status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    if (email !== OWNER_EMAIL) return jsonResponse_({ status: 'error', message: 'Only the account owner can register for push notifications.' });

    const sheet = getOrCreatePushTokenSheet_();
    const last = sheet.getLastRow();
    if (last >= 2) {
      const tokens = sheet.getRange(2, 2, last - 1, 1).getValues();
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i][0] === body.token) {
          sheet.getRange(i + 2, 4).setValue(new Date()); // already registered - just refresh the timestamp
          return jsonResponse_({ status: 'ok' });
        }
      }
    }
    sheet.appendRow([email, body.token, body.platform || '', new Date()]);
    return jsonResponse_({ status: 'ok' });
  } catch (err) {
    return jsonResponse_({ status: 'error', message: String(err && err.message || err) });
  }
}

// ---------- Manager approval endpoints ----------

/**
 * Owner-only: returns the most recent leave requests (newest first) with
 * everything the manager app needs to render a card, decide on it, or
 * aggregate it into the Summary tab's stats.
 *
 * GET ?action=listLeaveRequests&idToken=...&limit=500&callback=...
 * `limit` is optional (default 50, capped at 1000) - the Requests tab uses
 * the default, the Summary tab asks for a much larger window for its trends.
 */
function listLeaveRequests_(e) {
  try {
    const idToken = e && e.parameter && e.parameter.idToken;
    if (!idToken) return jsonOrJsonp_(e, { status: 'error', message: 'Missing auth token.' });

    let verified;
    try {
      verified = verifyIdToken_(idToken);
    } catch (err) {
      return jsonOrJsonp_(e, { status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    if (email !== OWNER_EMAIL) return jsonOrJsonp_(e, { status: 'error', message: 'Only the account owner can view leave requests.' });

    const sheet = getOrCreateLeaveSheet_();
    const last = sheet.getLastRow();
    const records = [];
    if (last >= 2) {
      const values = sheet.getRange(2, 1, last - 1, LEAVE_HEADERS.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const ts = r[1] instanceof Date ? r[1] : new Date(r[1]);
        const resolvedAt = r[8] instanceof Date ? r[8] : (r[8] ? new Date(r[8]) : null);
        records.push({
          requestId: r[0],
          requestedAt: (ts instanceof Date && !isNaN(ts.getTime())) ? ts.toISOString() : String(r[1] || ''),
          email: r[2] || '',
          name: r[3] || '',
          weekLabel: r[4] || '',
          type: r[5] || 'short',
          reasonHtml: r[6] || '',
          status: r[7] || 'requested',
          resolvedAt: (resolvedAt && !isNaN(resolvedAt.getTime())) ? resolvedAt.toISOString() : '',
          resolvedBy: r[9] || '',
          attachmentName: r[10] || '',
          attachmentUrl: r[11] || ''
        });
      }
    }
    records.reverse(); // newest first
    let limit = parseInt(e && e.parameter && e.parameter.limit, 10);
    if (!limit || limit < 1) limit = 50;
    if (limit > 1000) limit = 1000;
    return jsonOrJsonp_(e, { status: 'ok', records: records.slice(0, limit) });
  } catch (err) {
    return jsonOrJsonp_(e, { status: 'error', message: String(err && err.message || err) });
  }
}

/**
 * Owner-only: approves or rejects a leave request (called from
 * manager.html's Approve/Reject buttons).
 *
 * POST body: { action: 'decideLeave', idToken, requestId, decision }
 * where decision is 'approved' or 'rejected'.
 */
function decideLeave_(bodyString) {
  try {
    const body = JSON.parse(bodyString);
    if (!body.idToken) return jsonResponse_({ status: 'error', message: 'Missing auth token.' });
    const decision = body.decision === 'rejected' ? 'rejected' : (body.decision === 'approved' ? 'approved' : null);
    if (!decision) return jsonResponse_({ status: 'error', message: 'Invalid decision.' });

    let verified;
    try {
      verified = verifyIdToken_(body.idToken);
    } catch (err) {
      return jsonResponse_({ status: 'error', message: 'Unauthorized: ' + err.message });
    }
    const email = (verified.email || '').toLowerCase();
    if (email !== OWNER_EMAIL) return jsonResponse_({ status: 'error', message: 'Only the account owner can decide leave requests.' });

    const sheet = getOrCreateLeaveSheet_();
    const row = findLeaveRequestRow_(sheet, body.requestId);
    if (row < 0) return jsonResponse_({ status: 'error', message: 'Request not found.' });
    if (String(sheet.getRange(row, 8).getValue()) !== 'requested') {
      return jsonResponse_({ status: 'error', message: 'This request has already been resolved.' });
    }

    sheet.getRange(row, 8, 1, 2).setValues([[decision, new Date()]]); // Status, Resolved At
    sheet.getRange(row, 10).setValue(verified.name || email); // Resolved By
    return jsonResponse_({ status: 'ok' });
  } catch (err) {
    return jsonResponse_({ status: 'error', message: String(err && err.message || err) });
  }
}

// ---------- Push notifications (FCM) ----------

/**
 * Exchanges the FCM service-account credentials (Script Properties ->
 * FCM_SERVICE_ACCOUNT_JSON, the full JSON file downloaded from Firebase
 * Console -> Project Settings -> Service Accounts) for a short-lived OAuth2
 * access token, by hand-signing a JWT - Apps Script has no Firebase Admin
 * SDK, so this is the standard way to call a Google Cloud REST API (FCM v1)
 * from a service account inside Apps Script.
 */
function getFcmAccessToken_() {
  const json = PropertiesService.getScriptProperties().getProperty('FCM_SERVICE_ACCOUNT_JSON');
  if (!json) throw new Error('FCM_SERVICE_ACCOUNT_JSON script property is not set.');
  const creds = JSON.parse(json);

  const now = Math.floor(new Date().getTime() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const base64url = function (obj) {
    return Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
  };
  const toSign = base64url(header) + '.' + base64url(claimSet);
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, creds.private_key);
  const jwt = toSign + '.' + Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    muteHttpExceptions: true,
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('FCM token exchange failed: ' + resp.getContentText());
  }
  return JSON.parse(resp.getContentText()).access_token;
}

/**
 * Sends a push notification to every device the manager has registered.
 * Best-effort: never throws - a missing/broken FCM setup should never break
 * saving the underlying leave request. Auto-prunes any token FCM reports as
 * unregistered/invalid so the Push Tokens sheet doesn't accumulate dead rows.
 */
function sendPushToOwner_(title, body, data) {
  const sheet = getOrCreatePushTokenSheet_();
  const last = sheet.getLastRow();
  if (last < 2) {
    debugLog_('sendPushToOwner_: no registered push tokens yet', '');
    return;
  }

  let accessToken;
  try {
    accessToken = getFcmAccessToken_();
  } catch (err) {
    debugLog_('sendPushToOwner_: could not get FCM access token', String(err && err.message || err));
    return;
  }

  const dataStr = {};
  Object.keys(data || {}).forEach(function (k) { dataStr[k] = String(data[k]); });

  const rows = sheet.getRange(2, 1, last - 1, PUSH_TOKEN_HEADERS.length).getValues();
  const url = 'https://fcm.googleapis.com/v1/projects/' + FIREBASE_PROJECT_ID + '/messages:send';
  // Bottom-up, so deleting a stale token's row doesn't shift the index of
  // rows still to be processed.
  for (let i = rows.length - 1; i >= 0; i--) {
    const token = rows[i][1];
    if (!token) continue;
    const resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        message: {
          token: token,
          notification: { title: title, body: body },
          webpush: { fcm_options: { link: 'manager.html' } },
          data: dataStr
        }
      })
    });
    const code = resp.getResponseCode();
    if (code >= 200 && code < 300) continue;
    const text = resp.getContentText();
    debugLog_('sendPushToOwner_: send failed for a token', code + ': ' + text);
    if (text.indexOf('UNREGISTERED') >= 0 || text.indexOf('INVALID_ARGUMENT') >= 0) {
      sheet.deleteRow(i + 2);
    }
  }
}

/**
 * Returns 1-based sheet row index of the existing submission for
 * (email, weekLabel), or -1 if none exists.
 */
function findRowByEmailAndWeek_(sheet, email, weekLabel) {
  const last = sheet.getLastRow();
  if (last < 2 || !weekLabel) return -1;
  const values = sheet.getRange(2, 1, last - 1, 6).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][1] || '').toLowerCase() === email &&
      String(values[i][5] || '') === weekLabel) {
      return i + 2;
    }
  }
  return -1;
}

/**
 * If HEADERS has more columns than the existing sheet, append the missing
 * headers in place. Keeps older deployments compatible with newer columns.
 */
function ensureExtendedHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol >= HEADERS.length) return;
  for (let c = lastCol + 1; c <= HEADERS.length; c++) {
    sheet.getRange(1, c)
      .setValue(HEADERS[c - 1])
      .setFontWeight('bold')
      .setBackground('#eef2ff')
      .setFontColor('#1e293b');
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Apps Script `/exec` responses are served from googleusercontent.com after a
 * 302 and don't reliably carry Access-Control-Allow-Origin, so cross-origin
 * `fetch` reads fail. JSONP sidesteps this: the browser loads our response as
 * a <script>, which has no CORS check. We invoke the named callback with the
 * payload. The callback regex prevents arbitrary JS injection from the URL.
 */
function jsonOrJsonp_(e, obj) {
  const callback = e && e.parameter && e.parameter.callback;
  if (callback && /^[a-zA-Z_$][a-zA-Z0-9_$]{0,63}$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse_(obj);
}

/**
 * Verifies a Firebase ID token by calling identitytoolkit accounts:lookup.
 * The API key scopes the call to our Firebase project, so a token issued by
 * a different project (or no project) will fail the lookup.
 *
 * Returns { email, emailVerified, uid, name } on success; throws on failure.
 */
function verifyIdToken_(idToken) {
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_API_KEY);
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code !== 200) {
    throw new Error('Token lookup HTTP ' + code + ': ' + text);
  }
  const data = JSON.parse(text);
  const user = data.users && data.users[0];
  if (!user) throw new Error('Token did not resolve to a user.');
  if (!user.emailVerified) throw new Error('Email is not verified.');
  if (!user.email) throw new Error('No email on token.');
  return {
    email: user.email,
    emailVerified: !!user.emailVerified,
    uid: user.localId,
    name: user.displayName || ''
  };
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#eef2ff')
      .setFontColor('#1e293b');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(8, 500);
  }
  return sheet;
}

// ---------- Task rows (new format) → Sheets cell text ----------

/**
 * Render a `rows-v1` payload as readable text for column 8 (Daily Tasks).
 * Layout is day-grouped - all rows for Monday under "Monday - date", etc. - 
 * so the sheet view reads naturally. The full HTML is preserved separately
 * in column K for the editor round-trip.
 */
function rowsToSheetText_(rows, weekRange) {
  if (!rows || !rows.length) return '';
  const dayLong = {
    Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday'
  };
  const dayDates = parseWeekRangeDates_(weekRange);
  const sections = [];
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(function (day) {
    const entries = [];
    for (let i = 0; i < rows.length; i++) {
      const html = rows[i][day];
      if (!html) continue;
      const text = stripHtml_(html).trim();
      if (text) entries.push(text);
    }
    if (!entries.length) return;
    const date = dayDates[day] || '';
    const header = dayLong[day] + (date ? ' - ' + date : '');
    const body = entries.map(function (e) {
      return '  ' + e.replace(/\n/g, '\n  ');
    }).join('\n');
    sections.push(header + '\n' + body);
  });
  return sections.join('\n\n');
}

function parseWeekRangeDates_(weekRange) {
  const m = /(\d{4}-\d{2}-\d{2})\s+to\s+\d{4}-\d{2}-\d{2}/.exec(String(weekRange || ''));
  if (!m) return {};
  const start = new Date(m[1] + 'T00:00:00Z');
  if (isNaN(start.getTime())) return {};
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const out = {};
  for (let i = 0; i < 5; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out[days[i]] = d.toISOString().slice(0, 10);
  }
  return out;
}

function stripHtml_(html) {
  if (!html) return '';
  let s = String(html);

  // Number <li> inside <ol> blocks before the generic <li>→bullet pass.
  // Placeholder uses non-printable sentinels so it can't collide with real text.
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function (_m, inner) {
    let n = 0;
    return inner.replace(/<li[^>]*>/gi, function () {
      n += 1;
      return 'OL' + n + '';
    });
  });

  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/OL(\d+)/g, function (_m, n) { return n + '. '; })
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- Quill Delta → Sheets RichTextValue ----------

function deltaToRichText_(delta) {
  if (!delta || !delta.ops) {
    return SpreadsheetApp.newRichTextValue().setText('').build();
  }

  const lines = [];
  let segs = [];

  for (const op of delta.ops) {
    if (typeof op.insert !== 'string') continue;
    const attrs = op.attributes || {};
    const text = op.insert;

    if (text === '\n') {
      lines.push({ segments: segs, lineAttrs: attrs });
      segs = [];
      continue;
    }
    const parts = text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].length) segs.push({ text: parts[i], attrs });
      if (i < parts.length - 1) { lines.push({ segments: segs, lineAttrs: {} }); segs = []; }
    }
  }
  if (segs.length) lines.push({ segments: segs, lineAttrs: {} });

  let plain = '';
  const ranges = [];
  let orderedCounter = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineAttrs = line.lineAttrs || {};

    let prefix = '';
    if (lineAttrs.list === 'bullet') { prefix = '• '; orderedCounter = 0; }
    else if (lineAttrs.list === 'ordered') { orderedCounter += 1; prefix = orderedCounter + '. '; }
    else { orderedCounter = 0; }

    const lineStart = plain.length;
    plain += prefix;

    for (const seg of line.segments) {
      const segStart = plain.length;
      plain += seg.text;
      const segEnd = plain.length;
      const style = attrsToStyle_(seg.attrs);
      if (style && segEnd > segStart) ranges.push({ start: segStart, end: segEnd, style });
    }

    if (lineAttrs.header && plain.length > lineStart) {
      ranges.push({ start: lineStart, end: plain.length, style: headerStyle_(lineAttrs.header) });
    }

    if (li < lines.length - 1) plain += '\n';
  }

  const builder = SpreadsheetApp.newRichTextValue().setText(plain || '');
  for (const r of ranges) {
    try { builder.setTextStyle(r.start, r.end, r.style); } catch (e) { }
  }
  return builder.build();
}

function attrsToStyle_(attrs) {
  if (!attrs) return null;
  const b = SpreadsheetApp.newTextStyle();
  let any = false;
  if (attrs.bold) { b.setBold(true); any = true; }
  if (attrs.italic) { b.setItalic(true); any = true; }
  if (attrs.underline) { b.setUnderline(true); any = true; }
  if (attrs.strike) { b.setStrikethrough(true); any = true; }
  if (attrs.color) { try { b.setForegroundColor(attrs.color); any = true; } catch (e) { } }
  return any ? b.build() : null;
}

function headerStyle_(level) {
  const sizes = { 1: 18, 2: 15, 3: 13 };
  return SpreadsheetApp.newTextStyle().setBold(true).setFontSize(sizes[level] || 13).build();
}

/**
 * Inverse of deltaToRichText_ - best-effort reconstruction of a Quill Delta
 * from a Sheets RichTextValue. Used for legacy rows submitted before column K
 * (Task Delta JSON) existed.
 *
 * Lossy by design:
 * - bold/italic/underline/strike/color → preserved per run
 * - font-size {18,15,13} → header level {1,2,3} on the following newline
 * - list bullet/number prefixes baked into the text stay as plain text
 *    (no way to detect them reliably without re-parsing line prefixes)
 *
 * Returns null on empty input or any unexpected failure (so the caller can
 * decide whether to render plain text instead).
 */
function richTextValueToDelta_(rtv) {
  try {
    if (!rtv) return null;
    const text = rtv.getText() || '';
    if (!text) return null;

    const runs = rtv.getRuns();
    const ops = [];
    for (let ri = 0; ri < runs.length; ri++) {
      const run = runs[ri];
      const runText = run.getText() || '';
      if (!runText) continue;
      const style = run.getTextStyle();
      const attrs = {};
      try { if (style.isBold && style.isBold()) attrs.bold = true; } catch (_e) { }
      try { if (style.isItalic && style.isItalic()) attrs.italic = true; } catch (_e) { }
      try { if (style.isUnderline && style.isUnderline()) attrs.underline = true; } catch (_e) { }
      try { if (style.isStrikethrough && style.isStrikethrough()) attrs.strike = true; } catch (_e) { }
      try {
        const fg = style.getForegroundColor && style.getForegroundColor();
        if (fg && fg !== '#000000' && fg !== '#000') attrs.color = fg;
      } catch (_e) { }

      let header = null;
      try {
        const size = style.getFontSize && style.getFontSize();
        if (size === 18) header = 1;
        else if (size === 15) header = 2;
        else if (size === 13) header = 3;
      } catch (_e) { }

      // Newlines carry line attributes (header) in Quill; split this run on
      // '\n' and emit segments + newlines separately so the header attaches
      // to the right place.
      const parts = runText.split('\n');
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        if (seg.length) {
          if (Object.keys(attrs).length > 0) {
            ops.push({ insert: seg, attributes: Object.assign({}, attrs) });
          } else {
            ops.push({ insert: seg });
          }
        }
        if (i < parts.length - 1) {
          if (header) ops.push({ insert: '\n', attributes: { header: header } });
          else ops.push({ insert: '\n' });
        }
      }
    }

    // Quill docs must end with a newline.
    const last = ops[ops.length - 1];
    const lastText = last ? String(last.insert || '') : '';
    if (!lastText.endsWith('\n')) ops.push({ insert: '\n' });

    return { ops: ops };
  } catch (_err) {
    return null;
  }
}
