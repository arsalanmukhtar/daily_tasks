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
 *   - Each submission carries a Firebase ID token (JWT) from a signed-in Google user.
 *   - We verify the token by calling Google's identitytoolkit accounts:lookup endpoint.
 *     A valid response proves the token was issued by *this* Firebase project (the API
 *     key scopes the call) and is unexpired.
 *   - We then check the verified email against ALLOWLIST. The submitter's display name
 *     is taken from the allowlist, never trusted from the client payload.
 */

// =====================================================
// CONFIG — fill these in.
// =====================================================
const FIREBASE_API_KEY    = 'AIzaSyA1exz20sN1WqLQdNkP986JX5wHuICYolg';
const FIREBASE_PROJECT_ID = 'devteam-daily-tasks';

// Must mirror the ALLOWLIST in app.js. Emails MUST be lowercase here.
const ALLOWLIST = {
  'developer.ndma@gmail.com':     'Muhammad Arsalan Mukhtar',
  'as2040704@gmail.com':          'Abdul Sattar Sheikh',
  'mustafa.haider2011@gmail.com': 'Syed Mustafa Haider',
  'shehzadalikhan586@gmail.com':  'Shehzad Ali',
  'seemalnaeem100@gmail.com':     'Seemal Naeem',
  'muddasir.ndma25@gmail.com':    'Muddasir Shah',
  'ahad.khan.work01@gmail.com':   'Muhammad Ahad Khan',
  'zainabali27feb2024@gmail.com': 'Zainab Ali',
  'ttalha063@gmail.com':          'Talha Rizwan',
  'zeeshannasir2001@gmail.com':   'Zeeshan Nasir',
  'usamabinumar199@gmail.com':    'Usama bin Umar',
  'osamakhan32156@gmail.com':     'Muhammad Osama Khan'
};

const SHEET_NAME = 'Weekly Submissions';

const VALID_DESIGNATIONS = [
  'Intern',
  'Assistant Manager - I',
  'Assistant Manager - II',
  'Assistant Manager - III',
  'Deputy Manager - I'
];

// Column 11 stores the raw Quill Delta JSON so we can round-trip into the
// editor losslessly when a user reloads their own submission for editing.
const HEADERS = [
  'Timestamp',
  'Email',
  'Name',
  'Designation',
  'Domain',
  'Week',
  'Week Range',
  'Daily Tasks',
  'Assigned By',
  'Report To',
  'Task Delta JSON'
];

// =====================================================

function doPost(e) {
  debugLog_('1. doPost invoked',
    'parameter keys=' + (e && e.parameter ? Object.keys(e.parameter).join(',') : 'none') +
    ' / postData=' + (e && e.postData ? 'present' : 'absent'));
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
    const displayName = ALLOWLIST[email];
    if (!displayName) {
      debugLog_('6a. ABORT: email not in allowlist', email + ' / allowed=' + Object.keys(ALLOWLIST).join(','));
      return jsonResponse_({ status: 'error', message: 'Email ' + email + ' is not authorized.' });
    }
    debugLog_('6. allowlist hit', email + ' → ' + displayName);

    const designation = body.designation;
    if (VALID_DESIGNATIONS.indexOf(designation) === -1) {
      debugLog_('7a. ABORT: invalid designation', String(designation));
      return jsonResponse_({ status: 'error', message: 'Invalid designation: ' + designation });
    }
    debugLog_('7. designation ok', designation);

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
      'Muhammad Arsalan Mukhtar',
      'Muhammad Arsalan Mukhtar',
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
    console.log('NULL — getActiveSpreadsheet() returned null. The script is not bound to a spreadsheet.');
    return;
  }
  console.log('Bound spreadsheet NAME: ' + ss.getName());
  console.log('Bound spreadsheet ID:   ' + ss.getId());
  console.log('Bound spreadsheet URL:  ' + ss.getUrl());
  console.log('Tabs in this sheet:     ' + ss.getSheets().map(function(s){return s.getName();}).join(', '));
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
    // best-effort logger — swallow failures so they don't mask the real error
  }
}

const BACKEND_VERSION = 'v7-task-rows';

function doGet(e) {
  if (e && e.parameter) {
    if (e.parameter.action === 'list') {
      return listSubmissions_(e);
    }
    // If a payload arrives as a GET parameter, treat it as a submission
    // (some browsers downgrade POST→GET on Apps Script's 302 redirect).
    if (e.parameter.payload) {
      debugLog_('doGet with payload (forwarding to submission)', 'len=' + e.parameter.payload.length);
      return processSubmission_(e);
    }
  }
  debugLog_('doGet invoked (no payload)', 'parameter=' + JSON.stringify(e && e.parameter || {}));
  return jsonResponse_({
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
    const values    = dataRange.getValues();
    const richVals  = dataRange.getRichTextValues();
    const submissions = [];
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      if (String(r[1] || '').toLowerCase() !== email) continue;

      // Column K stores either:
      //   - { format: 'rows-v1', rows: [...] }   (new, table editor)
      //   - { ops: [...] }                       (legacy, Quill Delta)
      // Fall back to reconstructing a Delta from the visible rich-text cell
      // for very old rows where column K didn't exist yet.
      let taskRows = null;
      let taskDelta = null;
      const cellJson = r[10];
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
 * Layout is day-grouped — all rows for Monday under "Monday — date", etc. —
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
    const header = dayLong[day] + (date ? ' — ' + date : '');
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
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
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
    try { builder.setTextStyle(r.start, r.end, r.style); } catch (e) {}
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
  if (attrs.color) { try { b.setForegroundColor(attrs.color); any = true; } catch (e) {} }
  return any ? b.build() : null;
}

function headerStyle_(level) {
  const sizes = { 1: 18, 2: 15, 3: 13 };
  return SpreadsheetApp.newTextStyle().setBold(true).setFontSize(sizes[level] || 13).build();
}

/**
 * Inverse of deltaToRichText_ — best-effort reconstruction of a Quill Delta
 * from a Sheets RichTextValue. Used for legacy rows submitted before column K
 * (Task Delta JSON) existed.
 *
 * Lossy by design:
 *  - bold/italic/underline/strike/color → preserved per run
 *  - font-size {18,15,13} → header level {1,2,3} on the following newline
 *  - list bullet/number prefixes baked into the text stay as plain text
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
      try { if (style.isBold && style.isBold()) attrs.bold = true; } catch (_e) {}
      try { if (style.isItalic && style.isItalic()) attrs.italic = true; } catch (_e) {}
      try { if (style.isUnderline && style.isUnderline()) attrs.underline = true; } catch (_e) {}
      try { if (style.isStrikethrough && style.isStrikethrough()) attrs.strike = true; } catch (_e) {}
      try {
        const fg = style.getForegroundColor && style.getForegroundColor();
        if (fg && fg !== '#000000' && fg !== '#000') attrs.color = fg;
      } catch (_e) {}

      let header = null;
      try {
        const size = style.getFontSize && style.getFontSize();
        if (size === 18) header = 1;
        else if (size === 15) header = 2;
        else if (size === 13) header = 3;
      } catch (_e) {}

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
