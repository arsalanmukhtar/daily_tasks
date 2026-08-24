// =====================================================
// CONFIG - fill in these three blocks before deploying.
// =====================================================

// 1. Firebase Web config - from Firebase console → Project settings → "Your apps" (Web)
const FIREBASE_CONFIG = {
  apiKey:     'AIzaSyA1exz20sN1WqLQdNkP986JX5wHuICYolg',
  authDomain: 'devteam-daily-tasks.firebaseapp.com',
  projectId:  'devteam-daily-tasks'
};

// 2. Deployed Apps Script web app URL (ends in /exec)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz6njgCzwRK1i1aXzW9dmlZzlYfexxx72snoSB46L20u4ecitTTTYrLUnrHY_T_rkUmDQ/exec';

// 3. Allowlist - email → { name, designation, reportedTo }. Emails must be
//    lowercase. The SAME map must be pasted into apps-script/Code.gs (the
//    server is the enforcer; this copy drives the UX). All fields are fixed
//    per user - not editable in the UI; the server uses this map's values.
const ALLOWLIST = {
  'developer.ndma@gmail.com':     { name: 'Muhammad Arsalan Mukhtar', designation: 'Deputy Manager - I',     reportedTo: 'Junaid Aziz Khan' },
  'as2040704@gmail.com':          { name: 'Abdul Sattar Sheikh',      designation: 'Assistant Manager - II', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'mustafa.haider2011@gmail.com': { name: 'Syed Mustafa Haider',      designation: 'Assistant Manager - III',  reportedTo: 'Muhammad Arsalan Mukhtar' },
  'shehzadalikhan586@gmail.com':  { name: 'Shehzad Ali',              designation: 'Assistant Manager - I',  reportedTo: 'Kashif Iqbal' },
  'seemalnaeem100@gmail.com':     { name: 'Seemal Naeem',             designation: 'Assistant Manager - I',  reportedTo: 'Muhammad Arsalan Mukhtar' },
  'muddasir.ndma25@gmail.com':    { name: 'Muddasir Shah',            designation: 'Assistant Manager - I',  reportedTo: 'Imtiaz Nabi' },
  'ahad.khan.work01@gmail.com':   { name: 'Muhammad Ahad Khan',       designation: 'Assistant Manager - I',  reportedTo: 'Muhammad Arsalan Mukhtar' },
  'zainabali27feb2004@gmail.com': { name: 'Zainab Ali',               designation: 'Assistant Manager - I',  reportedTo: 'Muhammad Arsalan Mukhtar' },
  'ttalha063@gmail.com':          { name: 'Talha Rizwan',             designation: 'Assistant Manager - I',  reportedTo: 'Muhammad Arsalan Mukhtar' },
  'zeeshannasir2001@gmail.com':   { name: 'Zeeshan Nasir',            designation: 'Assistant Manager - I',  reportedTo: 'Muhammad Arsalan Mukhtar' },
  'ibrahimabdullahh84@gmail.com': { name: 'Ibrahim Abdullah',         designation: 'Assistant Manager - I',  reportedTo: 'Imtiaz Nabi' },
  'usamabinumar199@gmail.com':    { name: 'Usama bin Umar',           designation: 'Intern',                 reportedTo: 'Muhammad Arsalan Mukhtar' },
  'osamakhan32156@gmail.com':     { name: 'Muhammad Osama Khan',      designation: 'Intern',                 reportedTo: 'Muhammad Arsalan Mukhtar' },
  'muqeetahmad155@gmail.com':     { name: 'Muqeet Ahmad',             designation: 'Assistant Manager - I',  reportedTo: 'Imtiaz Nabi' }
};

// The account owner - the only user who sees the "Export weekly summary"
// action. Must be lowercase and present in ALLOWLIST. The server enforces
// this independently in apps-script/Code.gs (OWNER_EMAIL there).
const OWNER_EMAIL = 'developer.ndma@gmail.com';

// =====================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
setPersistence(auth, browserLocalPersistence);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ---------- DOM refs ----------
const loadingState     = document.getElementById('loadingState');
const authGate         = document.getElementById('authGate');
const authError        = document.getElementById('authError');
const signInBtn        = document.getElementById('signInBtn');
const signOutBtn       = document.getElementById('signOutBtn');
const userChip         = document.getElementById('userChip');
const userPhoto        = document.getElementById('userPhoto');
const userName         = document.getElementById('userName');
const userEmail        = document.getElementById('userEmail');
const form             = document.getElementById('taskForm');
const submitBtn        = document.getElementById('submitBtn');
const resetBtn         = document.getElementById('resetBtn');
const statusEl         = document.getElementById('status');
const statusSpinner    = document.getElementById('statusSpinner');
const statusTick       = document.getElementById('statusTick');
const statusText       = document.getElementById('statusText');
const weekInput        = document.getElementById('weekInput');
const weekSummary      = document.getElementById('weekSummary');
const lastWeekBtn      = document.getElementById('lastWeekBtn');
const thisWeekBtn      = document.getElementById('thisWeekBtn');
const clearWeekBtn     = document.getElementById('clearWeekBtn');
const submittingAsName  = document.getElementById('submittingAsName');
const submittingAsEmail = document.getElementById('submittingAsEmail');
const designationDisplay = document.getElementById('designationDisplay');
const reportedToDisplay  = document.getElementById('reportedToDisplay');
const weekDaysList     = document.getElementById('weekDaysList');
const taskTable        = document.getElementById('taskTable');
const taskTbody        = document.getElementById('taskTbody');
const taskToolbar      = document.getElementById('taskToolbar');
const addRowBtn        = document.getElementById('addRowBtn');
const viewSubmissionsBtn = document.getElementById('viewSubmissionsBtn');
const submissionsBackdrop = document.getElementById('submissionsBackdrop');
const submissionsDrawer  = document.getElementById('submissionsDrawer');
const closeDrawerBtn     = document.getElementById('closeDrawerBtn');
const submissionsList    = document.getElementById('submissionsList');
const exportSummaryBtn   = document.getElementById('exportSummaryBtn');
const exportBackdrop     = document.getElementById('exportBackdrop');
const exportModal        = document.getElementById('exportModal');
const exportCloseBtn     = document.getElementById('exportCloseBtn');
const exportCancelBtn    = document.getElementById('exportCancelBtn');
const exportRunBtn       = document.getElementById('exportRunBtn');
const exportRunLabel     = document.getElementById('exportRunLabel');
const exportWeekTrigger  = document.getElementById('exportWeekTrigger');
const exportWeekLabel    = document.getElementById('exportWeekLabel');
const exportWeekPanel    = document.getElementById('exportWeekPanel');
const exportStatus       = document.getElementById('exportStatus');

const analyticsBtn        = document.getElementById('analyticsBtn');
const analyticsBackdrop   = document.getElementById('analyticsBackdrop');
const analyticsPanel      = document.getElementById('analyticsPanel');
const analyticsCloseBtn   = document.getElementById('analyticsCloseBtn');
const analyticsRangeBar   = document.getElementById('analyticsRangeBar');
const analyticsCustomTrigger = document.getElementById('analyticsCustomTrigger');
const analyticsCustomLabel   = document.getElementById('analyticsCustomLabel');
const analyticsCustomPanel   = document.getElementById('analyticsCustomPanel');
const analyticsCustomTabs    = document.getElementById('analyticsCustomTabs');
const analyticsCustomList    = document.getElementById('analyticsCustomList');
const analyticsRefreshBtn = document.getElementById('analyticsRefreshBtn');
const analyticsExportTrigger = document.getElementById('analyticsExportTrigger');
const analyticsExportBtnIcon    = document.getElementById('analyticsExportBtnIcon');
const analyticsExportBtnLabel   = document.getElementById('analyticsExportBtnLabel');
const analyticsExportBtnChevron = document.getElementById('analyticsExportBtnChevron');
const analyticsExportPanel   = document.getElementById('analyticsExportPanel');
const analyticsExportSearch  = document.getElementById('analyticsExportSearch');
const analyticsExportList    = document.getElementById('analyticsExportList');
const analyticsExportStatus  = document.getElementById('analyticsExportStatus');
const analyticsStatus     = document.getElementById('analyticsStatus');
const analyticsContent    = document.getElementById('analyticsContent');
const analyticsKpis       = document.getElementById('analyticsKpis');
const analyticsHighlights = document.getElementById('analyticsHighlights');
const analyticsHeatmap    = document.getElementById('analyticsHeatmap');
const devDetailBackdrop   = document.getElementById('devDetailBackdrop');
const devDetailPanel      = document.getElementById('devDetailPanel');
const devDetailName       = document.getElementById('devDetailName');
const devDetailMeta       = document.getElementById('devDetailMeta');
const devDetailCloseBtn   = document.getElementById('devDetailCloseBtn');
const devDetailBody       = document.getElementById('devDetailBody');

// ---------- Task table editor ----------
// Replaces the previous single Quill editor. Each cell is contenteditable;
// formatting (bold/italic/underline/strike, bullet/ordered lists) is applied
// to the focused cell via document.execCommand from the shared toolbar.
const TASK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TASK_DAY_LONG = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };
const TASK_FORMAT_VERSION = 'rows-v1';

let activeCell = null;

// Weekday column keys (Mon..Fri) that fall after today for the selected week.
// Cells in these columns are locked - you can't log time for a day that hasn't
// happened yet. Kept in sync by applyFutureDayLocks().
let futureDays = new Set();

// The signed-in user's submissions, cached so the form can auto-load a week's
// saved content when the week changes (no network round-trip per change).
let submissionsCache = null;

function createTaskRow(rowData) {
  const tr = document.createElement('tr');
  tr.className = 'task-row';
  TASK_DAYS.forEach((day) => {
    const td = document.createElement('td');
    td.className = 'task-cell';
    const cell = document.createElement('div');
    cell.className = 'cell-editor';
    cell.dataset.day = day;
    cell.spellcheck = true;
    // Lock columns whose day is still in the future for the selected week.
    const locked = futureDays.has(day);
    cell.contentEditable = locked ? 'false' : 'true';
    cell.classList.toggle('cell-locked', locked);
    cell.dataset.placeholder = locked ? 'Upcoming' : (day + ' tasks…');
    if (rowData && rowData[day]) cell.innerHTML = rowData[day];
    cell.addEventListener('focus', () => { activeCell = cell; });
    td.appendChild(cell);
    tr.appendChild(td);
  });
  const actionTd = document.createElement('td');
  actionTd.className = 'row-action-cell';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-row-btn';
  removeBtn.title = 'Remove row';
  removeBtn.setAttribute('aria-label', 'Remove row');
  removeBtn.textContent = '×';
  removeBtn.addEventListener('mousedown', (e) => e.preventDefault());
  removeBtn.addEventListener('click', () => removeTaskRow(tr));
  actionTd.appendChild(removeBtn);
  tr.appendChild(actionTd);
  return tr;
}

function addTaskRow(rowData) {
  const tr = createTaskRow(rowData);
  taskTbody.appendChild(tr);
  return tr;
}

function removeTaskRow(tr) {
  // Keep at least one row in the table; if it's the only one, just clear it.
  if (taskTbody.children.length <= 1) {
    tr.querySelectorAll('.cell-editor').forEach((c) => { c.innerHTML = ''; });
    return;
  }
  if (activeCell && tr.contains(activeCell)) activeCell = null;
  tr.remove();
}

function clearTaskTable() {
  taskTbody.innerHTML = '';
  addTaskRow();
}

function isTaskTableEmpty() {
  const cells = taskTbody.querySelectorAll('.cell-editor');
  for (const c of cells) {
    if ((c.textContent || '').trim().length) return false;
  }
  return true;
}

function serializeTaskTable() {
  const rows = [];
  Array.from(taskTbody.children).forEach((tr) => {
    const row = {};
    let hasContent = false;
    tr.querySelectorAll('.cell-editor').forEach((cell) => {
      const html = (cell.innerHTML || '').trim();
      const normalised = html === '<br>' ? '' : html;
      row[cell.dataset.day] = normalised;
      if (normalised && (cell.textContent || '').trim()) hasContent = true;
    });
    if (hasContent) rows.push(row);
  });
  return rows;
}

function loadTaskRows(rows) {
  taskTbody.innerHTML = '';
  if (!rows || !rows.length) { addTaskRow(); return; }
  rows.forEach((rowData) => addTaskRow(rowData));
}

// Legacy: a Quill Delta (single flat doc with "Day - date" headers) gets
// flattened to plain text, sliced at the day-header pattern, and packed into
// a single row of the new table. Rich formatting is lost - once the user
// resubmits, the row stores in the new format and round-trips cleanly.
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

function escapeHtmlPreservingBreaks(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// Toolbar: mousedown preventDefault keeps the cell focused so execCommand
// has a valid Selection to operate on.
Array.from(taskToolbar.querySelectorAll('[data-cmd]')).forEach((btn) => {
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => {
    if (!activeCell) return;
    activeCell.focus();
    try { document.execCommand(btn.dataset.cmd, false, null); } catch (_e) {}
    // Wait one frame so the DOM (and the selection's ancestry) reflects the
    // execCommand change before we read state from it.
    requestAnimationFrame(refreshToolbarState);
  });
});

function refreshToolbarState() {
  // Inline marks: queryCommandState is reliable for these.
  const inline = ['bold', 'italic', 'underline', 'strikethrough'];
  inline.forEach((cmd) => {
    const btn = taskToolbar.querySelector('[data-cmd="' + cmd + '"]');
    if (!btn) return;
    let on = false;
    try { on = document.queryCommandState(cmd); } catch (_e) {}
    btn.classList.toggle('active', !!on);
  });
  // List state: queryCommandState('insertUnorderedList') is unreliable
  // (returns false even when the caret is inside a <ul>). Walk the selection's
  // ancestry instead.
  const ulBtn = taskToolbar.querySelector('[data-cmd="insertUnorderedList"]');
  const olBtn = taskToolbar.querySelector('[data-cmd="insertOrderedList"]');
  if (ulBtn) ulBtn.classList.toggle('active', selectionIsInside_('UL'));
  if (olBtn) olBtn.classList.toggle('active', selectionIsInside_('OL'));
}

function selectionIsInside_(tagName) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  let node = sel.getRangeAt(0).startContainer;
  // startContainer is usually a text node; .closest() only exists on Elements.
  if (node && node.nodeType === 3) node = node.parentNode;
  if (!node || node.nodeType !== 1) return false;
  return !!node.closest(tagName);
}

document.addEventListener('selectionchange', () => {
  if (activeCell && document.activeElement === activeCell) refreshToolbarState();
});

// ---------- Markdown-style list autoformat ----------
// Typing "1. " at the start of a line turns it into a numbered list; "- " or
// "* " turns it into a bullet list (like Docs / Notion). The triggering space
// is swallowed. Delegated on the tbody so it covers every row, current or new.
function isAtCellLineStart(node) {
  for (let n = node.previousSibling; n; n = n.previousSibling) {
    if (n.nodeName === 'BR') return true;                 // a line break before us
    if ((n.textContent || '').length > 0) return false;   // real content before us
  }
  return true;                                            // nothing before - line start
}

function handleListAutoformat(e) {
  if (e.inputType !== 'insertText' || e.data !== ' ') return;
  const cell = e.target;
  if (!cell || !cell.classList || !cell.classList.contains('cell-editor')) return;

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed || range.startContainer.nodeType !== Node.TEXT_NODE) return;

  const node = range.startContainer;
  const before = node.data.slice(0, range.startOffset);
  let cmd = null;
  if (/^1\.$/.test(before)) cmd = 'insertOrderedList';
  else if (/^[-*]$/.test(before)) cmd = 'insertUnorderedList';
  if (!cmd) return;

  // Only at the very start of a line, and not when already inside a list.
  if (!isAtCellLineStart(node)) return;
  for (let p = node.parentNode; p && p !== cell; p = p.parentNode) {
    if (p.nodeName === 'LI' || p.nodeName === 'OL' || p.nodeName === 'UL') return;
  }

  e.preventDefault();
  // Select the marker, delete it, then convert the now-empty line to a list.
  const markerRange = document.createRange();
  markerRange.setStart(node, 0);
  markerRange.setEnd(node, range.startOffset);
  sel.removeAllRanges();
  sel.addRange(markerRange);
  try {
    document.execCommand('delete', false, null);
    document.execCommand(cmd, false, null);
  } catch (_e) {}
  requestAnimationFrame(refreshToolbarState);
}

taskTbody.addEventListener('beforeinput', handleListAutoformat);

addRowBtn.addEventListener('click', () => {
  const tr = addTaskRow();
  const firstCell = tr.querySelector('.cell-editor');
  if (firstCell) firstCell.focus();
});

// Color buttons (text colour + highlight): each opens a small swatch popup
// anchored under the trigger. Click a swatch → apply via execCommand and
// update the button's bar to remember the last-used colour.
// 12 muted swatches per palette (4 cols × 3 rows). Deep / desaturated for
// text, soft pastels for highlight - keeps the look editorial, never neon.
const FORE_COLORS = [
  '#000000', // Black
  '#1f2937', // Charcoal
  '#475569', // Slate
  '#44403c', // Stone
  '#78350f', // Brown
  '#991b1b', // Burgundy
  '#b45309', // Dark amber
  '#166534', // Forest
  '#115e59', // Teal
  '#1e3a8a', // Navy
  '#5b21b6', // Royal purple
  '#831843'  // Maroon
];
const HILITE_COLORS = [
  '#fef9c3', // Pale yellow
  '#fef3c7', // Cream
  '#ffedd5', // Peach
  '#fecdd3', // Soft pink
  '#fce7f3', // Light pink
  '#f3e8ff', // Lavender
  '#e0e7ff', // Periwinkle
  '#dbeafe', // Sky
  '#cffafe', // Cyan
  '#d1fae5', // Mint
  '#ecfccb', // Sage
  '#f5f5f4'  // Stone
];

const colorPalette = document.createElement('div');
colorPalette.className = 'tb-color-palette';
const defaultSwatch = document.createElement('button');
defaultSwatch.type = 'button';
defaultSwatch.className = 'default-swatch';
const colorSwatches = document.createElement('div');
colorSwatches.className = 'swatches';
colorPalette.appendChild(defaultSwatch);
colorPalette.appendChild(colorSwatches);
document.body.appendChild(colorPalette);

let activeColorBtn = null;

// Default button: black for text, transparent for highlight. Mousedown
// preventDefault keeps the cell focused so execCommand has a selection.
defaultSwatch.addEventListener('mousedown', (e) => e.preventDefault());
defaultSwatch.addEventListener('click', () => {
  if (!activeColorBtn) return;
  const action = activeColorBtn.dataset.colorAction;
  const isHilite = action === 'hiliteColor';
  applyColor(action, isHilite ? 'transparent' : '#000000');
  const bar = activeColorBtn.querySelector('.tb-color-bar');
  if (bar) bar.style.backgroundColor = isHilite ? '#ffffff' : '#000000';
  closeColorPalette();
});

function openColorPalette(btn) {
  activeColorBtn = btn;
  const action = btn.dataset.colorAction;
  const isHilite = action === 'hiliteColor';
  const colors = isHilite ? HILITE_COLORS : FORE_COLORS;

  // The default-swatch button is its own 24×24 visual (no inner markup):
  // solid black for text default, diagonal-slash for highlight default.
  defaultSwatch.innerHTML = '';
  defaultSwatch.classList.toggle('transparent-style', isHilite);
  defaultSwatch.title = isHilite ? 'Remove highlight' : 'Default (black)';

  colorSwatches.innerHTML = '';
  colors.forEach((c) => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'swatch';
    sw.style.backgroundColor = c;
    sw.title = c;
    sw.addEventListener('mousedown', (e) => e.preventDefault());
    sw.addEventListener('click', () => {
      applyColor(action, c);
      const bar = activeColorBtn && activeColorBtn.querySelector('.tb-color-bar');
      if (bar) bar.style.backgroundColor = c;
      closeColorPalette();
    });
    colorSwatches.appendChild(sw);
  });
  const rect = btn.getBoundingClientRect();
  colorPalette.style.left = rect.left + 'px';
  colorPalette.style.top  = (rect.bottom + 4) + 'px';
  colorPalette.classList.add('open');
}

function closeColorPalette() {
  colorPalette.classList.remove('open');
  activeColorBtn = null;
}

function applyColor(action, color) {
  if (!activeCell) return;
  activeCell.focus();
  try {
    if (action === 'hiliteColor') {
      // Firefox uses hiliteColor; Chrome/Edge accept it too but historically
      // implemented backColor - try one, fall back to the other.
      const ok = document.execCommand('hiliteColor', false, color);
      if (!ok) document.execCommand('backColor', false, color);
    } else {
      document.execCommand('foreColor', false, color);
    }
  } catch (_e) {}
}

taskToolbar.querySelectorAll('[data-color-action]').forEach((btn) => {
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (colorPalette.classList.contains('open') && activeColorBtn === btn) {
      closeColorPalette();
    } else {
      openColorPalette(btn);
    }
  });
});

document.addEventListener('click', (e) => {
  if (!colorPalette.contains(e.target) && !e.target.closest('[data-color-action]')) {
    closeColorPalette();
  }
});
window.addEventListener('scroll', closeColorPalette, true);
window.addEventListener('resize', closeColorPalette);

// Seed with a single empty row on startup.
addTaskRow();

// ---------- ISO week math ----------
function isoWeekToMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  return target;
}
function fmtISO(d) { return d.toISOString().slice(0, 10); }
function fmtLong(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }

// "18 May 2026" - a single date with month and year spelled out.
function fmtFull(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
// "May 2026"
function fmtMonthYear(d) {
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// A Mon–Fri week range that always carries its month(s) + year, so every week
// reads as a true calendar date. Handles ranges that straddle a month or year:
//   same month  → "18–22 May 2026"
//   cross-month → "27 Apr – 1 May 2026"
//   cross-year  → "29 Dec 2025 – 2 Jan 2026"
function fmtWeekRange(start, end) {
  const dayMon = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return fmtFull(start) + ' – ' + fmtFull(end);
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return dayMon(start) + ' – ' + dayMon(end) + ' ' + end.getUTCFullYear();
  }
  return start.getUTCDate() + '–' + end.getUTCDate() + ' ' + fmtMonthYear(end);
}

// Renders a stored "YYYY-MM-DD to YYYY-MM-DD" range in the readable form above.
function prettyWeekRange(rangeStr) {
  const m = /(\d{4})-(\d{2})-(\d{2})\s+to\s+(\d{4})-(\d{2})-(\d{2})/.exec(String(rangeStr || ''));
  if (!m) return String(rangeStr || '');
  return fmtWeekRange(
    new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])),
    new Date(Date.UTC(+m[4], +m[5] - 1, +m[6]))
  );
}

function weekdaysFor(weekStr) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekStr || '');
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  const monday = isoWeekToMonday(year, week);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    days.push({ name: DAY_NAMES[i], date: d });
  }
  return { year, week, days };
}

function dateToIsoWeekString(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
function getCurrentIsoWeekString() {
  const now = new Date();
  return dateToIsoWeekString(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}
function getPreviousIsoWeekString() {
  const now = new Date();
  return dateToIsoWeekString(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 7)));
}

function refreshWeekSummary() {
  const info = weekdaysFor(weekInput.value);
  if (!info) {
    weekSummary.textContent = '';
    updateWeekTriggerLabel(null);
    renderWeekDaysList(null);
    updateColumnHeaderDates(null);
    applyFutureDayLocks(null);
    return null;
  }
  weekSummary.textContent =
    `Week ${info.week}, ${info.year}  ·  ${fmtWeekRange(info.days[0].date, info.days[4].date)}`;
  updateWeekTriggerLabel(info);
  renderWeekDaysList(info);
  updateColumnHeaderDates(info);
  applyFutureDayLocks(info);
  return info;
}

// True when `date` (a UTC calendar date) is the user's current local day.
function isTodayDate(date) {
  const now = new Date();
  return date.getUTCFullYear() === now.getFullYear() &&
         date.getUTCMonth()    === now.getMonth() &&
         date.getUTCDate()     === now.getDate();
}

// True when `date` (a UTC calendar date) falls after the user's current local
// day - i.e. a day that hasn't happened yet.
function isFutureDate(date) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const d = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return d > today;
}

// Locks the weekday columns that fall after today for the selected week, so
// users can't log time for days that haven't happened yet. Past weeks and
// already-elapsed days stay editable. Re-applied whenever the week changes.
function applyFutureDayLocks(info) {
  futureDays = new Set();
  if (info) {
    info.days.forEach((d, i) => {
      if (isFutureDate(d.date)) futureDays.add(TASK_DAYS[i]);
    });
  }
  taskTbody.querySelectorAll('.cell-editor').forEach((cell) => {
    const day = cell.dataset.day;
    const locked = futureDays.has(day);
    cell.contentEditable = locked ? 'false' : 'true';
    cell.classList.toggle('cell-locked', locked);
    cell.dataset.placeholder = locked ? 'Upcoming' : (day + ' tasks…');
    if (locked && activeCell === cell) activeCell = null;
  });
  taskTable.querySelectorAll('thead th[data-day]').forEach((th) => {
    th.classList.toggle('is-future', futureDays.has(th.dataset.day));
  });
}

function renderWeekDaysList(info) {
  if (!weekDaysList) return;
  if (!info) {
    weekDaysList.innerHTML = '<div class="text-xs text-slate-400 italic">Pick a week to see the days.</div>';
    return;
  }
  weekDaysList.innerHTML = '';
  info.days.forEach((d) => {
    const isToday = isTodayDate(d.date);
    const row = document.createElement('div');
    row.className = 'weekday-row flex items-center justify-between gap-3 text-sm' +
      (isToday ? ' is-today' : '') +
      (isFutureDate(d.date) ? ' is-future' : '');
    const longDate = d.date.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
    });
    if (isToday) {
      row.innerHTML =
        '<span class="font-bold text-orange-800 flex items-center gap-2">' + d.name +
          '<span class="weekday-today-tag">Today</span></span>' +
        '<span class="tabular-nums font-semibold text-orange-700">' + longDate + '</span>';
    } else {
      row.innerHTML =
        '<span class="font-semibold text-slate-700">' + d.name + '</span>' +
        '<span class="text-slate-500 tabular-nums">' + longDate + '</span>';
    }
    weekDaysList.appendChild(row);
  });
}

// ---------- Custom week picker (themed calendar) ----------
// The native <input type="week"> picker can't be styled and handles a
// future-week cap inconsistently across browsers. This calendar matches the
// app theme, selects whole ISO weeks (Mon–Sun), and hard-disables every week
// after the current one - you can't log time for a week that hasn't started.
const weekTrigger      = document.getElementById('weekTrigger');
const weekTriggerLabel = document.getElementById('weekTriggerLabel');

const WEEK_DAY_HEADS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_CHEVRON_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M15 18l-6-6 6-6"/></svg>';
const CAL_CHEVRON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M9 18l6-6-6-6"/></svg>';

// Monday (UTC midnight) of the ISO week containing `date`.
function mondayOfWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay() || 7;            // 1 = Mon … 7 = Sun
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d;
}

// Monday of the *current* week - the latest week a user may select.
function currentWeekMonday() {
  const now = new Date();
  return mondayOfWeek(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

const calPopup = document.createElement('div');
calPopup.className = 'week-cal-popup';
calPopup.setAttribute('role', 'dialog');
calPopup.setAttribute('aria-label', 'Choose a week');
document.body.appendChild(calPopup);

let calViewYear  = 0;
let calViewMonth = 0;   // 0-indexed
let calOpen      = false;

function updateWeekTriggerLabel(info) {
  if (info) {
    weekTriggerLabel.textContent = `Week ${info.week} · ${fmtMonthYear(info.days[0].date)}`;
    weekTriggerLabel.classList.remove('placeholder');
  } else {
    weekTriggerLabel.textContent = 'Select a week';
    weekTriggerLabel.classList.add('placeholder');
  }
}

function renderCalendar() {
  const todayMonday   = currentWeekMonday();
  const todayMondayMs = todayMonday.getTime();
  const todayKey      = dateToIsoWeekString(todayMonday);
  const selectedKey   = weekInput.value || '';
  const now           = new Date();
  const realDayKey    = now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate();

  // The next-month arrow is disabled once the view reaches the real month - 
  // there are no selectable weeks beyond it.
  const nextDisabled =
    calViewYear > now.getFullYear() ||
    (calViewYear === now.getFullYear() && calViewMonth >= now.getMonth());

  const firstOfMonth = new Date(Date.UTC(calViewYear, calViewMonth, 1));
  const lastOfMonth  = new Date(Date.UTC(calViewYear, calViewMonth + 1, 0));
  let rowMonday      = mondayOfWeek(firstOfMonth);
  const lastRowMs    = mondayOfWeek(lastOfMonth).getTime();

  let rowsHtml = '';
  while (rowMonday.getTime() <= lastRowMs) {
    const weekKey  = dateToIsoWeekString(rowMonday);
    const weekNum  = weekKey.slice(6);
    const isFuture = rowMonday.getTime() > todayMondayMs;
    const isSel    = weekKey === selectedKey;
    const isCur    = weekKey === todayKey;

    let cells = '<span class="week-cal-cell week-cal-wk">' + weekNum + '</span>';
    for (let i = 0; i < 7; i++) {
      const day = new Date(rowMonday);
      day.setUTCDate(rowMonday.getUTCDate() + i);
      const dayNum = day.getUTCDate();
      const isToday =
        day.getUTCFullYear() + '-' + day.getUTCMonth() + '-' + day.getUTCDate() === realDayKey;
      let cls = 'week-cal-cell';
      if (day.getUTCMonth() !== calViewMonth) cls += ' is-other-month';
      // Today gets a filled chip so it stands out from the other days in its week.
      const inner = isToday ? '<span class="cal-today-chip">' + dayNum + '</span>' : dayNum;
      cells += '<span class="' + cls + '">' + inner + '</span>';
    }

    let rowCls = 'week-cal-row';
    if (isFuture) rowCls += ' is-disabled';
    if (isSel)    rowCls += ' is-selected';
    if (isCur)    rowCls += ' is-current';
    rowsHtml +=
      '<div class="' + rowCls + '" data-week-key="' + weekKey + '" role="button" ' +
      'aria-disabled="' + isFuture + '" tabindex="' + (isFuture ? '-1' : '0') + '" ' +
      'title="ISO week ' + parseInt(weekNum, 10) + '">' + cells + '</div>';

    rowMonday = new Date(rowMonday);
    rowMonday.setUTCDate(rowMonday.getUTCDate() + 7);
  }

  calPopup.innerHTML =
    '<div class="week-cal-head">' +
      '<button type="button" class="week-cal-nav week-cal-prev" aria-label="Previous month">' + CAL_CHEVRON_L + '</button>' +
      '<div class="week-cal-title">' + MONTH_NAMES[calViewMonth] + ' ' + calViewYear + '</div>' +
      '<button type="button" class="week-cal-nav week-cal-next" aria-label="Next month"' +
        (nextDisabled ? ' disabled' : '') + '>' + CAL_CHEVRON_R + '</button>' +
    '</div>' +
    '<div class="week-cal-grid-head"><span>Wk</span>' +
      WEEK_DAY_HEADS.map(function (d) { return '<span>' + d + '</span>'; }).join('') +
    '</div>' +
    '<div class="week-cal-body">' + rowsHtml + '</div>' +
    '<div class="week-cal-foot">' +
      '<button type="button" class="week-cal-clear">Clear</button>' +
      '<button type="button" class="week-cal-link week-cal-thisweek">Go to this week</button>' +
    '</div>';
}

function positionCalendar() {
  const r = weekTrigger.getBoundingClientRect();
  const w = calPopup.offsetWidth  || 304;
  const h = calPopup.offsetHeight || 320;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) {
    const above = r.top - h - 6;
    top = above >= 8 ? above : Math.max(8, window.innerHeight - h - 8);
  }
  calPopup.style.left = left + 'px';
  calPopup.style.top  = top + 'px';
}

function openCalendar() {
  const info   = weekdaysFor(weekInput.value);
  const anchor = info ? isoWeekToMonday(info.year, info.week) : currentWeekMonday();
  calViewYear  = anchor.getUTCFullYear();
  calViewMonth = anchor.getUTCMonth();
  renderCalendar();
  calPopup.classList.add('open');
  positionCalendar();
  weekTrigger.classList.add('is-open');
  weekTrigger.setAttribute('aria-expanded', 'true');
  calOpen = true;
}

function closeCalendar() {
  calPopup.classList.remove('open');
  weekTrigger.classList.remove('is-open');
  weekTrigger.setAttribute('aria-expanded', 'false');
  calOpen = false;
}

function shiftCalMonth(delta) {
  calViewMonth += delta;
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear -= 1; }
  if (calViewMonth > 11) { calViewMonth = 0;  calViewYear += 1; }
  renderCalendar();
  positionCalendar();
}

function pickWeekFromCalendar(weekKey) {
  weekInput.value = weekKey;
  refreshWeekSummary();
  syncTableToSelectedWeek();
  closeCalendar();
  weekTrigger.focus();
}

weekTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  if (calOpen) closeCalendar();
  else openCalendar();
});

// All clicks inside the popup are handled here; stopPropagation keeps the
// document-level outside-click handler from firing (a month re-render detaches
// the clicked node, which would otherwise read as an "outside" click).
calPopup.addEventListener('click', (e) => {
  e.stopPropagation();
  if (e.target.closest('.week-cal-prev')) { shiftCalMonth(-1); return; }
  const next = e.target.closest('.week-cal-next');
  if (next) { if (!next.disabled) shiftCalMonth(1); return; }
  if (e.target.closest('.week-cal-clear')) {
    weekInput.value = '';
    refreshWeekSummary();
    syncTableToSelectedWeek();
    closeCalendar();
    return;
  }
  if (e.target.closest('.week-cal-thisweek')) {
    pickWeekFromCalendar(getCurrentIsoWeekString());
    return;
  }
  const row = e.target.closest('.week-cal-row');
  if (row && row.getAttribute('aria-disabled') !== 'true') {
    pickWeekFromCalendar(row.dataset.weekKey);
  }
});

// Enter / Space selects the focused (non-future) week row.
calPopup.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const row = e.target.closest('.week-cal-row');
  if (row && row.getAttribute('aria-disabled') !== 'true') {
    e.preventDefault();
    pickWeekFromCalendar(row.dataset.weekKey);
  }
});

document.addEventListener('click', (e) => {
  if (calOpen && !calPopup.contains(e.target) && !weekTrigger.contains(e.target)) {
    closeCalendar();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && calOpen) { closeCalendar(); weekTrigger.focus(); }
});
window.addEventListener('scroll', () => { if (calOpen) closeCalendar(); }, true);
window.addEventListener('resize', () => { if (calOpen) closeCalendar(); });

function updateColumnHeaderDates(info) {
  const dayIndex = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 };
  taskTable.querySelectorAll('thead th[data-day]').forEach((th) => {
    const dateEl = th.querySelector('.tb-date');
    if (!dateEl) return;
    if (info) {
      const d = info.days[dayIndex[th.dataset.day]].date;
      dateEl.textContent = d.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
      });
      th.classList.toggle('is-today', isTodayDate(d));
    } else {
      dateEl.textContent = '-';
      th.classList.remove('is-today');
    }
  });
}

// Quick-pick buttons - set the week value directly, then refresh. "Last week"
// and "This week" can never yield a future week; "Clear" empties the field.
lastWeekBtn.addEventListener('click', () => {
  weekInput.value = getPreviousIsoWeekString();
  refreshWeekSummary();
  syncTableToSelectedWeek();
});

thisWeekBtn.addEventListener('click', () => {
  weekInput.value = getCurrentIsoWeekString();
  refreshWeekSummary();
  syncTableToSelectedWeek();
});

clearWeekBtn.addEventListener('click', () => {
  weekInput.value = '';
  refreshWeekSummary();
  syncTableToSelectedWeek();
});

// ---------- Auth state machine ----------
function showLoading()  {
  loadingState.classList.remove('hidden'); authGate.classList.add('hidden'); form.classList.add('hidden');
  userChip.classList.add('hidden'); userChip.classList.remove('flex');
  exportSummaryBtn.classList.add('hidden'); exportSummaryBtn.classList.remove('flex');
  analyticsBtn.classList.add('hidden'); analyticsBtn.classList.remove('flex');
  closeExportModal();
  closeAnalyticsPanel();
  submissionsDrawer.classList.remove('open'); submissionsBackdrop.classList.remove('open');
}
function showAuthGate(errMsg) {
  loadingState.classList.add('hidden');
  authGate.classList.remove('hidden');
  form.classList.add('hidden');
  userChip.classList.add('hidden');
  userChip.classList.remove('flex');
  exportSummaryBtn.classList.add('hidden'); exportSummaryBtn.classList.remove('flex');
  analyticsBtn.classList.add('hidden'); analyticsBtn.classList.remove('flex');
  closeExportModal();
  closeAnalyticsPanel();
  submissionsDrawer.classList.remove('open'); submissionsBackdrop.classList.remove('open');
  if (errMsg) { authError.textContent = errMsg; authError.classList.remove('hidden'); }
  else { authError.classList.add('hidden'); authError.textContent = ''; }
}
function showForm(user, displayName, designation, reportedTo) {
  loadingState.classList.add('hidden');
  authGate.classList.add('hidden');
  form.classList.remove('hidden');
  userChip.classList.remove('hidden');
  userChip.classList.add('flex');

  // Owner-only: reveal the weekly-summary export button in the header.
  const isOwner = (user.email || '').toLowerCase() === OWNER_EMAIL;
  exportSummaryBtn.classList.toggle('hidden', !isOwner);
  exportSummaryBtn.classList.toggle('flex', isOwner);
  analyticsBtn.classList.toggle('hidden', !isOwner);
  analyticsBtn.classList.toggle('flex', isOwner);

  const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22white%22%3E%3Cpath d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E';
  userPhoto.onerror = () => { userPhoto.onerror = null; userPhoto.src = FALLBACK_AVATAR; };
  userPhoto.src     = user.photoURL || FALLBACK_AVATAR;
  userName.textContent  = displayName;
  userEmail.textContent = user.email;

  submittingAsName.textContent   = displayName;
  submittingAsEmail.textContent  = user.email;
  if (designationDisplay) designationDisplay.textContent = designation || '';
  if (reportedToDisplay) reportedToDisplay.textContent = reportedTo || '-';

  // Default to the current ISO week if nothing's selected yet. We don't
  // touch the task table - the user controls its content.
  if (!weekInput.value) weekInput.value = getCurrentIsoWeekString();
  refreshWeekSummary();
}

// ---------- Idle session timeout (security) ----------
// A signed-in session is force-signed-out after 8 hours with no real user
// input. Firebase ID tokens auto-refresh, so without this an unattended (but
// unlocked) device would stay signed in indefinitely. The last-activity time
// is mirrored to localStorage so the limit also survives a tab close/reopen - 
// a Firebase-persisted session restored past the deadline is signed out before
// the form is ever shown.
const INACTIVITY_LIMIT_MS = 8 * 60 * 60 * 1000; // 8 hours
const LAST_ACTIVITY_KEY   = 'techew_lastActivityTs';
const ACTIVITY_EVENTS     = ['mousedown', 'keydown', 'wheel', 'touchstart'];

let lastActivityTs   = 0;
let lastStorageWrite = 0;
let inactivityTimer  = null;

function readStoredActivity() {
  try {
    const raw = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch (_e) { return 0; }
}
function writeStoredActivity(ts) {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(ts)); } catch (_e) {}
}
function clearStoredActivity() {
  try { localStorage.removeItem(LAST_ACTIVITY_KEY); } catch (_e) {}
}

// Newest activity across this tab and any other open tab (localStorage is
// shared), so staying active in one tab keeps the others alive.
function effectiveLastActivity() {
  return Math.max(lastActivityTs, readStoredActivity());
}

// True when a restored session has been idle past the limit.
function isSessionIdleExpired() {
  const stored = readStoredActivity();
  return stored > 0 && (Date.now() - stored) > INACTIVITY_LIMIT_MS;
}

function recordActivity() {
  const now = Date.now();
  lastActivityTs = now;
  // These events fire rapidly - throttle the localStorage write to once a minute.
  if (now - lastStorageWrite > 60000) {
    lastStorageWrite = now;
    writeStoredActivity(now);
  }
  scheduleIdleCheck();
}

function scheduleIdleCheck() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  const remaining = effectiveLastActivity() + INACTIVITY_LIMIT_MS - Date.now();
  inactivityTimer = setTimeout(onIdleCheck, Math.max(remaining, 0));
}

function onIdleCheck() {
  // setTimeout can fire late (device sleep) or stale relative to activity in
  // another tab - re-check the real elapsed time before signing out.
  const remaining = effectiveLastActivity() + INACTIVITY_LIMIT_MS - Date.now();
  if (remaining > 0) { scheduleIdleCheck(); return; }
  stopInactivityTracking();
  signOut(auth).finally(() => {
    showAuthGate('Signed out after 8 hours of inactivity. Please sign in again.');
  });
}

function startInactivityTracking() {
  stopInactivityTracking();      // idempotent - drop any prior listeners/timer
  lastStorageWrite = 0;          // force the first write through the throttle
  recordActivity();              // stamp "now" and arm the timer
  ACTIVITY_EVENTS.forEach((evt) =>
    window.addEventListener(evt, recordActivity, { passive: true }));
}

function stopInactivityTracking() {
  if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
  ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, recordActivity));
}

let currentUserContext = null; // { user, displayName }

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentUserContext = null;
    stopInactivityTracking();
    clearStoredActivity();
    showAuthGate();
    return;
  }
  const email = (user.email || '').toLowerCase();
  const entry = ALLOWLIST[email];
  if (!entry) {
    stopInactivityTracking();
    signOut(auth).finally(() => {
      showAuthGate(`The account ${user.email} isn't authorized. Contact your manager.`);
    });
    return;
  }
  // Security: a session restored from persistence that has been idle beyond
  // the 8-hour limit is signed out before the form is ever shown.
  if (isSessionIdleExpired()) {
    stopInactivityTracking();
    clearStoredActivity();
    signOut(auth).finally(() => {
      showAuthGate('Signed out after 8 hours of inactivity. Please sign in again.');
    });
    return;
  }
  submissionsCache = null;
  currentUserContext = {
    user,
    displayName: entry.name,
    designation: entry.designation,
    reportedTo: entry.reportedTo || ''
  };
  showForm(user, entry.name, entry.designation, entry.reportedTo);
  startInactivityTracking();
  // Pre-load this user's submissions, then reflect the current week's saved
  // content in the table - but only if they haven't already started typing.
  fetchUserSubmissions_()
    .then(function () { if (isTaskTableEmpty()) syncTableToSelectedWeek(); })
    .catch(function () { /* offline - the form still works */ });
});

signInBtn.addEventListener('click', async () => {
  authError.classList.add('hidden');
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    showAuthGate('Sign-in failed: ' + (err.message || err.code || err));
  }
});

signOutBtn.addEventListener('click', () => signOut(auth));

// ---------- Form actions ----------
// `kind` is one of: 'submitting' | 'ok' | 'error' | 'info'.
// 'submitting' shows the dark-pill loader, no text.
// 'ok'         shows the green tick (fades over 5s) + optional message.
// 'error'      shows the message in red, no icon.
// 'info'       clears icons + message; used to reset between states.
let statusClearTimer = null;
function setStatus(kind, msg) {
  // Cancel any pending fade so the latest call always wins.
  if (statusClearTimer) { clearTimeout(statusClearTimer); statusClearTimer = null; }

  // Reset icons before applying the new state.
  statusSpinner.classList.add('hidden');
  statusTick.classList.add('hidden');
  statusTick.classList.remove('status-tick-fade');
  statusText.textContent = msg || '';

  // Errors get the red left-bar callout; other kinds are plain status text.
  if (kind === 'error') {
    statusText.className = 'error-callout';
    // Force a reflow so the fade restarts when errors fire back-to-back.
    void statusText.offsetWidth;
    statusText.classList.add('error-callout-fade');
    statusClearTimer = setTimeout(() => {
      statusText.textContent = '';
      statusText.className = 'text-sm text-slate-500';
    }, 5000);
  } else if (kind === 'ok') {
    statusText.className = 'text-sm text-orange-600 font-semibold';
  } else {
    statusText.className = 'text-sm text-slate-500';
  }

  if (kind === 'submitting') {
    statusSpinner.classList.remove('hidden');
    statusText.textContent = '';
  } else if (kind === 'ok') {
    statusTick.classList.remove('hidden');
    // Force a reflow so the keyframe animation restarts when ok fires repeatedly.
    void statusTick.offsetWidth;
    statusTick.classList.add('status-tick-fade');
    statusClearTimer = setTimeout(() => {
      statusTick.classList.add('hidden');
      statusTick.classList.remove('status-tick-fade');
      statusText.textContent = '';
    }, 5000);
  }
}

// ---------- Edit mode (resubmitting an existing week) ----------
// Entered when a past submission is loaded from the "My Submissions" drawer.
// A banner explains the overwrite; a Cancel button backs out of it.
const editBanner      = document.getElementById('editBanner');
const editBannerTitle = document.getElementById('editBannerTitle');
const cancelEditBtn   = document.getElementById('cancelEditBtn');

function enterEditMode(weekLabel, weekRange) {
  const range = prettyWeekRange(weekRange);
  editBannerTitle.textContent = 'Editing ' + weekLabel + (range ? ' · ' + range : '');
  editBanner.classList.remove('hidden');
  cancelEditBtn.classList.remove('hidden');
}
function exitEditMode() {
  editBanner.classList.add('hidden');
  cancelEditBtn.classList.add('hidden');
}

// Return the form to a clean slate for the current week.
function resetFormToFresh() {
  weekInput.value = getCurrentIsoWeekString();
  refreshWeekSummary();
  clearTaskTable();
  setStatus('info', '');
}

resetBtn.addEventListener('click', () => {
  if (!confirm('Clear the form?')) return;
  exitEditMode();
  resetFormToFresh();
});

cancelEditBtn.addEventListener('click', () => {
  if (!confirm('Discard your changes and stop editing this submission?')) return;
  exitEditMode();
  resetFormToFresh();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('info', '');

  if (!currentUserContext) return setStatus('error', 'Please sign in again.');
  const info = weekdaysFor(weekInput.value);
  if (!info) return setStatus('error', 'Please pick a valid week.');
  // Guard: never submit for a week that hasn't started yet (the calendar
  // disables future weeks, but this backstops any other code path).
  if (isoWeekToMonday(info.year, info.week).getTime() > currentWeekMonday().getTime()) {
    return setStatus('error', 'You can only submit for the current or a past week.');
  }
  if (isTaskTableEmpty()) return setStatus('error', 'Please enter your tasks.');

  if (APPS_SCRIPT_URL === 'PASTE_YOUR_DEPLOYED_URL_HERE') {
    return setStatus('error', 'APPS_SCRIPT_URL is not configured in app.js.');
  }

  let idToken;
  try {
    idToken = await currentUserContext.user.getIdToken(/* forceRefresh */ false);
  } catch (err) {
    return setStatus('error', 'Could not get auth token: ' + err.message);
  }

  const payload = {
    idToken,
    weekLabel: `Week ${info.week}, ${info.year}`,
    weekRange: `${fmtISO(info.days[0].date)} to ${fmtISO(info.days[4].date)}`,
    // Designation is server-enforced from ALLOWLIST - included here only as
    // a hint; the server ignores it and uses its own value.
    designation: currentUserContext.designation,
    taskFormat: TASK_FORMAT_VERSION,
    taskRows: serializeTaskTable()
  };

  submitBtn.disabled = true;
  setStatus('submitting');

  try {
    // URLSearchParams body → fetch sends Content-Type:
    // application/x-www-form-urlencoded which is a "simple" CORS request
    // (no preflight) AND Apps Script auto-parses it into e.parameter.
    // fetch follows 302 redirects while preserving the POST method+body - 
    // unlike HTML form submission which downgrades POST→GET on 302.
    const formBody = new URLSearchParams();
    formBody.append('payload', JSON.stringify(payload));

    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: formBody,
      redirect: 'follow'
    });
    setStatus('ok', '');
    exitEditMode();
    // Refresh the cache so a later week-switch reflects this submission.
    fetchUserSubmissions_().catch(function () {});
  } catch (err) {
    setStatus('error', 'Submit failed: ' + err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- My Submissions drawer ----------
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatTimestamp(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function weekLabelToIsoInput(weekLabel) {
  const m = /^Week\s+(\d+),\s*(\d+)/.exec(String(weekLabel || ''));
  if (!m) return '';
  const week = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${m[2]}-W${week}`;
}

function openSubmissionsDrawer() {
  if (!currentUserContext) return;
  submissionsDrawer.classList.add('open');
  submissionsBackdrop.classList.add('open');
  submissionsList.innerHTML =
    '<div class="flex flex-col items-center justify-center py-16 gap-3">' +
      '<span class="loader"></span>' +
      '<span class="text-xs text-slate-500">Loading your submissions…</span>' +
    '</div>';
  fetchSubmissions();
}

function closeSubmissionsDrawer() {
  submissionsDrawer.classList.remove('open');
  submissionsBackdrop.classList.remove('open');
}

/**
 * JSONP fetch - Apps Script `/exec` GET responses lack a reliable
 * Access-Control-Allow-Origin header (they 302 to googleusercontent.com),
 * so cross-origin `fetch` reads fail. Loading the response via <script>
 * tag bypasses CORS entirely; the server wraps the payload in `callback(...)`
 * which calls our locally-registered global.
 */
function jsonpFetch(url, params, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const cbName = '__jsonp_cb_' + Math.random().toString(36).slice(2) + '_' + Date.now();
    const script = document.createElement('script');
    let settled = false;

    function cleanup() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { delete window[cbName]; } catch (_e) { window[cbName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    const timer = setTimeout(function () {
      cleanup();
      reject(new Error('Request timed out.'));
    }, timeoutMs || 30000);

    window[cbName] = function (data) {
      cleanup();
      resolve(data);
    };

    const qs = new URLSearchParams(Object.assign({}, params, { callback: cbName }));
    script.src = url + '?' + qs.toString();
    script.onerror = function () {
      cleanup();
      reject(new Error('Could not reach the submissions endpoint.'));
    };
    document.head.appendChild(script);
  });
}

// Fetches the signed-in user's submissions and refreshes the cache. Throws on
// failure so callers can surface it however they need.
async function fetchUserSubmissions_() {
  const idToken = await currentUserContext.user.getIdToken(false);
  const data = await jsonpFetch(APPS_SCRIPT_URL, { action: 'list', idToken: idToken });
  if (!data || data.status !== 'ok') {
    throw new Error((data && data.message) || 'Failed to load submissions.');
  }
  submissionsCache = data.submissions || [];
  return submissionsCache;
}

async function fetchSubmissions() {
  try {
    await fetchUserSubmissions_();
    renderSubmissions(submissionsCache || []);
  } catch (err) {
    submissionsList.innerHTML =
      '<div class="error-callout">' +
      escapeHtml(err.message || 'Failed to load submissions.') +
      '</div>';
  }
}

function buildPreviewSnippet(plainText) {
  if (!plainText) return '';
  // Strip the auto-seeded day headers so the preview surfaces real content.
  const cleaned = String(plainText)
    .replace(/(Monday|Tuesday|Wednesday|Thursday|Friday)\s*[—-]\s*\d{4}-\d{2}-\d{2}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= 160) return cleaned;
  return cleaned.substring(0, 160).trim() + '…';
}

// Strip a task cell's HTML down to readable plain text for the drawer
// preview. Mirrors the server's stripHtml_: <ol> items are numbered,
// <ul> items get bullets, block tags become line breaks.
function cellToText(html) {
  if (!html) return '';
  let s = String(html).replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function (_m, inner) {
    let n = 0;
    return inner.replace(/<li[^>]*>/gi, function () { n += 1; return '' + n + ''; });
  });
  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n');
  const tmp = document.createElement('div');
  tmp.innerHTML = s;
  const text = (tmp.textContent || '').replace(/(\d+)/g, function (_m, n) { return n + '. '; });
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// Group a submission's task rows into a per-day breakdown table for the
// "My Submissions" card. Days with no content show a muted dash. Returns
// null when there are no rows at all (caller falls back to the flat
// snippet) - e.g. very old delta-only rows with nothing parseable.
function buildDayBreakdown(s) {
  let rows = Array.isArray(s.taskRows) && s.taskRows.length ? s.taskRows : null;
  if (!rows && s.taskDelta && s.taskDelta.ops) {
    const derived = deltaToTaskRows(s.taskDelta);
    if (derived && derived.length) rows = derived;
  }
  if (!rows) return null;

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  let anyContent = false;
  let body = '';
  for (const day of DAYS) {
    const parts = [];
    for (const r of rows) {
      const t = cellToText(r && r[day]);
      if (t) parts.push(t);
    }
    const text = parts.join('\n');
    if (text) {
      anyContent = true;
      body +=
        '<div class="flex gap-2.5 px-2.5 py-1.5">' +
          '<span class="shrink-0 w-9 text-[10px] font-bold uppercase tracking-wide text-orange-600 pt-px">' + day + '</span>' +
          '<div class="min-w-0 text-xs text-slate-600 leading-snug whitespace-pre-line line-clamp-3">' + escapeHtml(text) + '</div>' +
        '</div>';
    } else {
      body +=
        '<div class="flex gap-2.5 px-2.5 py-1.5">' +
          '<span class="shrink-0 w-9 text-[10px] font-bold uppercase tracking-wide text-slate-300 pt-px">' + day + '</span>' +
          '<span class="text-xs text-slate-300 italic">&mdash;</span>' +
        '</div>';
    }
  }
  if (!anyContent) return null;
  return '<div class="mt-2 mb-2 rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">' + body + '</div>';
}

function renderSubmissions(subs) {
  if (!subs.length) {
    submissionsList.innerHTML =
      '<div class="text-center py-10 text-slate-500 text-sm">No submissions yet.<br><span class="text-xs text-slate-400">Submitted weeks will appear here.</span></div>';
    return;
  }
  submissionsList.innerHTML = '';
  for (const s of subs) {
    const card = document.createElement('div');
    card.className =
      'group bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-xl p-4 transition shadow-sm hover:shadow';

    const ts = formatTimestamp(s.timestamp);
    const designation = s.designation || '';

    // Prefer the per-day breakdown table. Fall back to the flat snippet only
    // for legacy rows with no parseable per-day structure.
    const breakdown = buildDayBreakdown(s);
    let previewBlock;
    if (breakdown) {
      previewBlock = breakdown;
    } else {
      const preview = buildPreviewSnippet(s.taskPlain);
      previewBlock = preview
        ? '<div class="text-xs text-slate-600 mb-2 leading-relaxed line-clamp-3">' + escapeHtml(preview) + '</div>'
        : '<div class="text-xs text-slate-400 italic mb-2">(no content)</div>';
    }

    // The card itself only hovers; the pencil button is the sole edit trigger.
    card.innerHTML =
      '<div class="flex items-start justify-between gap-3 mb-2">' +
        '<div class="min-w-0 flex-1">' +
          '<div class="font-semibold text-slate-800 text-sm truncate">' + escapeHtml(s.weekLabel) + '</div>' +
          '<div class="text-xs text-slate-500 mt-0.5 truncate">' + escapeHtml(prettyWeekRange(s.weekRange)) + '</div>' +
        '</div>' +
        '<button type="button" class="edit-week-btn shrink-0 w-8 h-8 rounded-lg bg-orange-100 text-orange-700 inline-flex items-center justify-center hover:bg-orange-200 hover:text-orange-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 transition" ' +
          'title="Edit this submission" aria-label="Edit ' + escapeHtml(s.weekLabel) + '">' +
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>' +
            '<path d="m15 5 4 4"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      previewBlock +
      '<div class="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">' +
        '<span class="font-medium">' + escapeHtml(designation) + '</span>' +
        (designation ? '<span aria-hidden="true">·</span>' : '') +
        '<span>Last submitted ' + escapeHtml(ts) + '</span>' +
      '</div>';
    card.querySelector('.edit-week-btn').addEventListener('click', () => loadSubmissionIntoForm(s));
    submissionsList.appendChild(card);
  }
}

// Loads a submission's saved rows into the task table and shows the edit
// banner. The week must already be selected + refreshed before this runs, so
// the future-day locks apply to the freshly-created cells.
function applySubmissionToTable(s) {
  // Prefer the new rows format. Fall back to deriving rows from a legacy
  // Quill Delta (day-header split). Last resort: dump plain text into Monday.
  if (Array.isArray(s.taskRows) && s.taskRows.length) {
    loadTaskRows(s.taskRows);
  } else if (s.taskDelta && s.taskDelta.ops) {
    const rows = deltaToTaskRows(s.taskDelta);
    loadTaskRows(rows && rows.length ? rows : [{ Mon: escapeHtmlPreservingBreaks(s.taskPlain || '') }]);
  } else if (s.taskPlain) {
    loadTaskRows([{ Mon: escapeHtmlPreservingBreaks(s.taskPlain) }]);
  } else {
    clearTaskTable();
  }
  enterEditMode(s.weekLabel, s.weekRange);
}

// Makes the task table reflect the currently-selected week: loads that week's
// saved submission if one exists, otherwise resets to a fresh empty table.
// Runs on every explicit week change.
async function syncTableToSelectedWeek() {
  const info = weekdaysFor(weekInput.value);
  if (!info) {                          // week cleared
    clearTaskTable();
    exitEditMode();
    setStatus('info', '');
    return;
  }
  if (submissionsCache === null && currentUserContext) {
    try { await fetchUserSubmissions_(); } catch (_e) { /* offline - treat as none */ }
  }
  const weekLabel = 'Week ' + info.week + ', ' + info.year;
  const existing = (submissionsCache || []).find(function (s) { return s.weekLabel === weekLabel; });
  if (existing) {
    applySubmissionToTable(existing);
  } else {
    clearTaskTable();
    exitEditMode();
  }
  setStatus('info', '');
}

function loadSubmissionIntoForm(s) {
  const isoWeek = weekLabelToIsoInput(s.weekLabel);
  if (isoWeek) weekInput.value = isoWeek;
  refreshWeekSummary();
  applySubmissionToTable(s);
  setStatus('info', '');
  closeSubmissionsDrawer();
}

viewSubmissionsBtn.addEventListener('click', openSubmissionsDrawer);
closeDrawerBtn.addEventListener('click', closeSubmissionsDrawer);
submissionsBackdrop.addEventListener('click', closeSubmissionsDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && submissionsDrawer.classList.contains('open')) {
    closeSubmissionsDrawer();
  }
});


// ========================================================================
// Export weekly summary (owner only)
// Builds a multi-sheet .xlsx - one worksheet per developer, five day columns
// - from every developer's submissions for one chosen week.
// ========================================================================
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ---- Custom week dropdown (replaces the un-styleable native <select>) ----
let exportWeekValue = '';

function makeWeekOption(isoStr, text) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ew-option';
  btn.setAttribute('role', 'option');
  btn.dataset.value = isoStr;
  btn.innerHTML =
    '<svg class="ew-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 6 9 17l-5-5"/></svg>' +
    '<span>' + escapeHtml(text) + '</span>';
  btn.addEventListener('click', function () { selectExportWeek(isoStr, text); });
  return btn;
}

// Fill the dropdown with the 20 most recent weeks, newest first.
function populateExportWeeks() {
  exportWeekPanel.innerHTML = '';
  const monday = currentWeekMonday();
  let firstValue = '', firstText = '';
  for (let i = 0; i < 20; i++) {
    const m = new Date(monday);
    m.setUTCDate(monday.getUTCDate() - i * 7);
    const isoStr = dateToIsoWeekString(m);
    const info = weekdaysFor(isoStr);
    if (!info) continue;
    const text =
      'Week ' + info.week + ', ' + info.year + '  ·  ' +
      fmtWeekRange(info.days[0].date, info.days[4].date);
    if (!firstValue) { firstValue = isoStr; firstText = text; }
    exportWeekPanel.appendChild(makeWeekOption(isoStr, text));
  }
  // Default to the current (most recent) week.
  if (firstValue) selectExportWeek(firstValue, firstText);
}

function selectExportWeek(isoStr, text) {
  exportWeekValue = isoStr;
  exportWeekLabel.textContent = text;
  exportWeekPanel.querySelectorAll('.ew-option').forEach(function (opt) {
    const on = opt.dataset.value === isoStr;
    opt.classList.toggle('is-selected', on);
    opt.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  closeExportWeekPanel();
}

// The panel is position:fixed at <body> level - position it under the trigger,
// flipping above when there isn't room below.
function positionExportWeekPanel() {
  const r = exportWeekTrigger.getBoundingClientRect();
  exportWeekPanel.style.left  = r.left + 'px';
  exportWeekPanel.style.width = r.width + 'px';
  const panelH = Math.min(exportWeekPanel.scrollHeight, 256);
  const roomBelow = window.innerHeight - r.bottom;
  if (roomBelow < panelH + 14 && r.top > roomBelow) {
    exportWeekPanel.style.top = Math.max(8, r.top - panelH - 6) + 'px';
  } else {
    exportWeekPanel.style.top = (r.bottom + 6) + 'px';
  }
}

function openExportWeekPanel() {
  exportWeekPanel.classList.add('open');
  exportWeekTrigger.classList.add('is-open');
  exportWeekTrigger.setAttribute('aria-expanded', 'true');
  positionExportWeekPanel();
  const sel = exportWeekPanel.querySelector('.ew-option.is-selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function closeExportWeekPanel() {
  exportWeekPanel.classList.remove('open');
  exportWeekTrigger.classList.remove('is-open');
  exportWeekTrigger.setAttribute('aria-expanded', 'false');
}

function setExportStatus(kind, msg) {
  if (!msg) { exportStatus.className = 'hidden'; exportStatus.textContent = ''; return; }
  if (kind === 'loading') {
    // Centred text above a full-width progress bar. Build the structure once
    // so repeated step updates don't restart the bar's animation.
    if (!exportStatus.classList.contains('ew-status-loading')) {
      exportStatus.className = 'ew-status-loading';
      exportStatus.innerHTML =
        '<span class="ew-status-text"></span>' +
        '<div class="ew-progress">' +
        '<span></span><span></span><span></span><span></span><span></span><span></span>' +
        '</div>';
    }
    exportStatus.querySelector('.ew-status-text').textContent = msg;
    return;
  }
  exportStatus.textContent = msg;
  if (kind === 'error')   exportStatus.className = 'error-callout';
  else if (kind === 'ok') exportStatus.className = 'text-xs text-orange-600 font-semibold';
  else                    exportStatus.className = 'text-xs text-slate-500';
}

function openExportModal() {
  if (!currentUserContext ||
      (currentUserContext.user.email || '').toLowerCase() !== OWNER_EMAIL) return;
  populateExportWeeks();
  setExportStatus('', '');
  exportRunBtn.disabled = false;
  exportRunLabel.textContent = 'Export';
  exportBackdrop.classList.remove('hidden');
  exportModal.classList.remove('hidden');
  exportModal.classList.add('flex');
}

function closeExportModal() {
  closeExportWeekPanel();
  exportBackdrop.classList.add('hidden');
  exportModal.classList.remove('flex');
  exportModal.classList.add('hidden');
}

// ExcelJS is ~900 KB - load it lazily, only when the owner actually exports.
let exceljsPromise = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (exceljsPromise) return exceljsPromise;
  exceljsPromise = new Promise(function (resolve, reject) {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
    sc.onload = function () {
      if (window.ExcelJS) resolve(window.ExcelJS);
      else reject(new Error('Excel library failed to initialise.'));
    };
    sc.onerror = function () {
      exceljsPromise = null;
      reject(new Error('Could not load the Excel library (check your connection).'));
    };
    document.head.appendChild(sc);
  });
  return exceljsPromise;
}

// Builds the workbook Blob: one worksheet per ALLOWLIST developer, with a
// title block and a five-column day grid. Non-submitters get a marked sheet.
async function buildExportWorkbook(ExcelJSlib, info, weekLabel, submissions) {
  const wb = new ExcelJSlib.Workbook();
  wb.creator = 'Tech EW Weekly Time Sheet';
  wb.created = new Date();

  const byEmail = {};
  for (const s of (submissions || [])) byEmail[(s.email || '').toLowerCase()] = s;

  const weekRange = fmtWeekRange(info.days[0].date, info.days[4].date);
  const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const border = {
    top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right:  { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };
  const usedNames = {};

  Object.keys(ALLOWLIST).forEach(function (email) {
    const entry = ALLOWLIST[email];
    const sub   = byEmail[email.toLowerCase()];

    // Excel worksheet names: ≤31 chars, no \ / ? * [ ] :, and must be unique.
    let base = String(entry.name || email).replace(/[\\\/\?\*\[\]:]/g, ' ').trim().slice(0, 31);
    if (!base) base = 'Developer';
    let name = base, n = 2;
    while (usedNames[name.toLowerCase()]) { name = base.slice(0, 27) + ' (' + n + ')'; n++; }
    usedNames[name.toLowerCase()] = true;

    const ws = wb.addWorksheet(name);
    ws.columns = [{ width: 32 }, { width: 32 }, { width: 32 }, { width: 32 }, { width: 32 }];
    ws.views = [{ state: 'frozen', ySplit: 5 }];

    ws.mergeCells('A1:E1');
    const c1 = ws.getCell('A1');
    c1.value = entry.name || email;
    c1.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    ws.getRow(1).height = 22;

    ws.mergeCells('A2:E2');
    const c2 = ws.getCell('A2');
    c2.value = (entry.designation || '') + '      Reports to: ' + (entry.reportedTo || '-');
    c2.font = { size: 10, color: { argb: 'FF64748B' } };

    ws.mergeCells('A3:E3');
    const c3 = ws.getCell('A3');
    c3.value = weekLabel + '      ' + weekRange;
    c3.font = { size: 10, color: { argb: 'FF64748B' } };

    // Day header row (row 5).
    const headerRow = ws.getRow(5);
    info.days.forEach(function (d, i) {
      const cell = headerRow.getCell(i + 1);
      cell.value = d.name + '\n' + fmtFull(d.date);
      cell.font = { bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = border;
    });
    headerRow.height = 30;

    if (!sub) {
      ws.mergeCells('A6:E6');
      const c = ws.getCell('A6');
      c.value = 'No submission recorded for this week.';
      c.font = { italic: true, color: { argb: 'FF94A3B8' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(6).height = 26;
      return;
    }

    const rows = (Array.isArray(sub.taskRows) && sub.taskRows.length) ? sub.taskRows : null;
    if (rows) {
      rows.forEach(function (r, ri) {
        const row = ws.getRow(6 + ri);
        dayKeys.forEach(function (k, ci) {
          const cell = row.getCell(ci + 1);
          cell.value = cellToText(r && r[k]);
          cell.font = { size: 10, color: { argb: 'FF334155' } };
          cell.alignment = { vertical: 'top', wrapText: true };
          cell.border = border;
        });
      });
    } else {
      // Legacy delta-only row - no per-day split; drop the plain text in.
      ws.mergeCells('A6:E6');
      const c = ws.getCell('A6');
      c.value = sub.taskPlain || '(no task content)';
      c.font = { size: 10, color: { argb: 'FF334155' } };
      c.alignment = { vertical: 'top', wrapText: true };
      c.border = border;
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: XLSX_MIME });
}

// Writes the workbook. `fileHandle` is a showSaveFilePicker handle grabbed
// earlier during the click gesture; when null, falls back to a plain download.
async function saveExportBlob(blob, fileName, fileHandle) {
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return 'saved';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  return 'downloaded';
}

async function runExport() {
  if (!currentUserContext) return;
  const info = weekdaysFor(exportWeekValue);
  if (!info) { setExportStatus('error', 'Please choose a valid week.'); return; }

  const weekLabel = 'Week ' + info.week + ', ' + info.year;
  // Filename is stamped with the chosen week's Friday.
  const fileName = 'developers-weekly-report-Friday-' + fmtISO(info.days[4].date) + '.xlsx';

  // Open the save-location picker FIRST, before any await - showSaveFilePicker
  // requires the click's transient user activation, which the async work
  // (library load, network fetch) below would otherwise consume.
  let fileHandle = null;
  if (window.showSaveFilePicker) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'Excel workbook', accept: { [XLSX_MIME]: ['.xlsx'] } }]
      });
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        setExportStatus('info', 'Export cancelled - no file was saved.');
      } else {
        setExportStatus('error', (err && err.message) ? err.message : 'Could not open the save dialog.');
      }
      return;
    }
  }

  exportRunBtn.disabled = true;
  exportRunLabel.textContent = 'Exporting…';
  setExportStatus('loading', 'Loading the Excel library…');

  try {
    const ExcelJSlib = await loadExcelJS();
    setExportStatus('loading', 'Fetching submissions…');
    const idToken = await currentUserContext.user.getIdToken(false);
    const data = await jsonpFetch(APPS_SCRIPT_URL,
      { action: 'export', week: weekLabel, idToken: idToken }, 45000);
    if (!data || data.status !== 'ok') {
      throw new Error((data && data.message) || 'Export request failed.');
    }
    setExportStatus('loading', 'Building the workbook…');
    const blob = await buildExportWorkbook(ExcelJSlib, info, weekLabel, data.submissions);
    const result = await saveExportBlob(blob, fileName, fileHandle);
    setExportStatus('ok', (result === 'saved' ? 'Saved ' : 'Downloaded ') + fileName);
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
      setExportStatus('info', 'Export cancelled - no file was saved.');
    } else {
      setExportStatus('error', (err && err.message) ? err.message : 'Export failed.');
    }
  } finally {
    exportRunBtn.disabled = false;
    exportRunLabel.textContent = 'Export';
  }
}

exportSummaryBtn.addEventListener('click', openExportModal);
exportCloseBtn.addEventListener('click', closeExportModal);
exportCancelBtn.addEventListener('click', closeExportModal);
exportBackdrop.addEventListener('click', closeExportModal);
exportModal.addEventListener('click', function (e) {
  if (e.target === exportModal) closeExportModal();
});
exportRunBtn.addEventListener('click', runExport);

exportWeekTrigger.addEventListener('click', function (e) {
  e.stopPropagation();
  if (exportWeekPanel.classList.contains('open')) closeExportWeekPanel();
  else openExportWeekPanel();
});
document.addEventListener('click', function (e) {
  if (exportWeekPanel.classList.contains('open') &&
      !exportWeekPanel.contains(e.target) && !exportWeekTrigger.contains(e.target)) {
    closeExportWeekPanel();
  }
});
window.addEventListener('resize', closeExportWeekPanel);
// Close when the page or an ancestor scrolls (the trigger moves away) - but
// NOT when the user scrolls within the panel's own option list.
window.addEventListener('scroll', function (e) {
  if (exportWeekPanel.classList.contains('open') && e.target !== exportWeekPanel) {
    closeExportWeekPanel();
  }
}, true);

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  // Escape closes the dropdown first, then (next press) the modal.
  if (exportWeekPanel.classList.contains('open')) { closeExportWeekPanel(); return; }
  if (!exportModal.classList.contains('hidden')) closeExportModal();
});


// ========================================================================
// Analytics & User Performance (owner only)
// Everything here is derived from existing submission data - item counts,
// day coverage, submission consistency. There's no hours/quality field
// anywhere in the sheet, so this is deliberately labelled "Activity," not
// "Performance": it's a volume/consistency proxy, not a quality judgement.
// ========================================================================

const AN_DEV_COLORS = [
  '#ea580c', '#0891b2', '#7c3aed', '#15803d', '#be123c',
  '#0284c7', '#a16207', '#4338ca', '#0d9488', '#c2410c',
  '#65a30d', '#9333ea', '#0369a1', '#166534', '#b45309'
];

let analyticsCache = null;      // { roster, submissions } from the analytics endpoint
// { mode: 'preset', key: '8w'|'3m'|'6m'|'1y'|'all' }
//   | { mode: 'week', weekLabel: 'Week 32, 2026' }
//   | { mode: 'month', year, month }   (month is 1-12)
//   | { mode: 'year', year }
let analyticsFilter = { mode: 'preset', key: '8w' };
let analyticsCustomTab = 'week';
let analyticsCharts = {};       // key -> live Chart.js instance, destroyed before re-render

// ---- Lazy-load Chart.js (only when the owner actually opens the panel) ----
let chartjsPromise = null;
function loadChartJS() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartjsPromise) return chartjsPromise;
  chartjsPromise = new Promise(function (resolve, reject) {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
    sc.onload = function () {
      if (window.Chart) resolve(window.Chart);
      else reject(new Error('Chart library failed to initialise.'));
    };
    sc.onerror = function () {
      chartjsPromise = null;
      reject(new Error('Could not load the chart library (check your connection).'));
    };
    document.head.appendChild(sc);
  });
  return chartjsPromise;
}

// ---- Lazy-load chartjs-plugin-datalabels (only for the PDF's charts - kept
// as a per-chart `plugins: [DataLabels]` local registration rather than a
// global Chart.register(), so it never affects the live in-app dashboard
// charts, which stay tooltip-only by design). ----
let datalabelsPromise = null;
function loadDataLabelsPlugin_() {
  if (window.ChartDataLabels) return Promise.resolve(window.ChartDataLabels);
  if (datalabelsPromise) return datalabelsPromise;
  datalabelsPromise = new Promise(function (resolve, reject) {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js';
    sc.onload = function () {
      if (window.ChartDataLabels) resolve(window.ChartDataLabels);
      else reject(new Error('Chart labels plugin failed to initialise.'));
    };
    sc.onerror = function () {
      datalabelsPromise = null;
      reject(new Error('Could not load the chart labels plugin (check your connection).'));
    };
    document.head.appendChild(sc);
  });
  return datalabelsPromise;
}

// ---- Lazy-load jsPDF + its autoTable plugin (only when a PDF is actually exported) ----
let jspdfPromise = null;
function loadJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) {
    return Promise.resolve(window.jspdf.jsPDF);
  }
  if (jspdfPromise) return jspdfPromise;
  jspdfPromise = new Promise(function (resolve, reject) {
    const s1 = document.createElement('script');
    s1.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    s1.onload = function () {
      const s2 = document.createElement('script');
      s2.src = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js';
      s2.onload = function () {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('PDF library failed to initialise.'));
      };
      s2.onerror = function () {
        jspdfPromise = null;
        reject(new Error('Could not load the PDF table plugin (check your connection).'));
      };
      document.head.appendChild(s2);
    };
    s1.onerror = function () {
      jspdfPromise = null;
      reject(new Error('Could not load the PDF library (check your connection).'));
    };
    document.head.appendChild(s1);
  });
  return jspdfPromise;
}

async function fetchAnalyticsData_() {
  const idToken = await currentUserContext.user.getIdToken(false);
  const data = await jsonpFetch(APPS_SCRIPT_URL, { action: 'analytics', idToken: idToken }, 45000);
  if (!data || data.status !== 'ok') {
    throw new Error((data && data.message) || 'Failed to load analytics.');
  }
  analyticsCache = { roster: data.roster || [], submissions: data.submissions || [] };
  return analyticsCache;
}

function colorForEmail_(email, roster) {
  const idx = roster.findIndex(function (r) { return r.email === email; });
  return AN_DEV_COLORS[(idx >= 0 ? idx : 0) % AN_DEV_COLORS.length];
}

// Every displayed "avg tasks/week"-style figure rounds to a whole number
// (nearest, i.e. ceiling when the fraction is >= .5, floor otherwise) - a
// decimal like "3.8 items/week" isn't meaningful to a non-technical reader.
// Charts keep the unrounded value for bar-length accuracy; only what's
// printed as text goes through this.
function fmtAvg_(n) {
  return String(Math.round(n));
}

function shortWeekLabel_(w) {
  const m = /^Week\s+(\d+)/.exec((w && w.label) || '');
  return m ? 'W' + m[1] : ((w && w.label) || '');
}

function heatColor_(v, maxVal) {
  if (v <= 0) return '#fee2e2'; // submitted, but zero items logged - pale red flag
  const t = Math.min(1, v / maxVal);
  const r1 = 255, g1 = 237, b1 = 213; // orange-100
  const r2 = 194, g2 = 65,  b2 = 12;  // orange-700
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function colorForRank_(i, total) {
  if (i === 0) return '#ea580c';                 // top - accent orange
  if (total > 1 && i === total - 1) return '#94a3b8'; // last - muted slate, not alarm red
  return '#fdba74';                               // mid pack - soft orange
}

// Returns { startMs, endMs } for the given filter - either bound may be null
// (unbounded). endMs is exclusive. Presets are open-ended on the upper end
// (there's never future-dated data); week/month/year filters are a closed
// window covering exactly that period.
function analyticsFilterBounds_(filter) {
  const now = new Date();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter.mode === 'week') {
    const iso = weekLabelToIsoInput(filter.weekLabel);
    const info = iso ? weekdaysFor(iso) : null;
    if (!info) return { startMs: null, endMs: null };
    const startMs = info.days[0].date.getTime();
    return { startMs: startMs, endMs: startMs + 7 * 86400000 };
  }
  if (filter.mode === 'month') {
    return { startMs: Date.UTC(filter.year, filter.month - 1, 1), endMs: Date.UTC(filter.year, filter.month, 1) };
  }
  if (filter.mode === 'year') {
    return { startMs: Date.UTC(filter.year, 0, 1), endMs: Date.UTC(filter.year + 1, 0, 1) };
  }
  // preset
  if (filter.key === '8w') return { startMs: todayMs - 8 * 7 * 86400000, endMs: null };
  if (filter.key === '3m') return { startMs: Date.UTC(now.getFullYear(), now.getMonth() - 3, now.getDate()), endMs: null };
  if (filter.key === '6m') return { startMs: Date.UTC(now.getFullYear(), now.getMonth() - 6, now.getDate()), endMs: null };
  if (filter.key === '1y') return { startMs: Date.UTC(now.getFullYear(), 0, 1), endMs: null };
  return { startMs: null, endMs: null }; // 'all'
}

// Display label for the custom-filter trigger button; null for presets
// (those show their own pill's text, the trigger just says "Custom").
function analyticsFilterLabel_(filter) {
  if (filter.mode === 'week') return filter.weekLabel;
  if (filter.mode === 'month') return MONTH_NAMES[filter.month - 1].slice(0, 3) + ' ' + filter.year;
  if (filter.mode === 'year') return String(filter.year);
  return null;
}

// Distinct weeks/months/years actually present in the fetched data, newest
// first - powers the custom-filter dropdown's option lists.
function analyticsAvailableWeeks_() {
  const map = {};
  (analyticsCache ? analyticsCache.submissions : []).forEach(function (s) {
    const iso = weekLabelToIsoInput(s.weekLabel);
    const info = iso ? weekdaysFor(iso) : null;
    if (!info || map[s.weekLabel]) return;
    map[s.weekLabel] = { weekLabel: s.weekLabel, mondayMs: info.days[0].date.getTime(), info: info };
  });
  return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.mondayMs - a.mondayMs; });
}
function analyticsAvailableMonths_() {
  const map = {};
  analyticsAvailableWeeks_().forEach(function (w) {
    const d = w.info.days[0].date;
    const key = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1);
    if (!map[key]) map[key] = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, sortMs: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) };
  });
  return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.sortMs - a.sortMs; });
}
function analyticsAvailableYears_() {
  const set = {};
  analyticsAvailableWeeks_().forEach(function (w) { set[w.info.days[0].date.getUTCFullYear()] = true; });
  return Object.keys(set).map(Number).sort(function (a, b) { return b - a; });
}

/**
 * Builds the aggregated view-model for the currently-selected filter: the
 * chronological list of weeks present, per-developer/per-week item totals,
 * team-wide weekly totals, day-of-week totals, and a leaderboard. Everything
 * downstream (KPIs, highlights, every chart, the heatmap) reads from this.
 */
function buildAnalyticsModel_(filter) {
  const cache = analyticsCache;
  const roster = cache.roster;
  const bounds = analyticsFilterBounds_(filter);

  const enriched = [];
  cache.submissions.forEach(function (s) {
    const iso = weekLabelToIsoInput(s.weekLabel);
    const info = iso ? weekdaysFor(iso) : null;
    if (!info) return;
    const mondayMs = info.days[0].date.getTime();
    if (bounds.startMs !== null && mondayMs < bounds.startMs) return;
    if (bounds.endMs !== null && mondayMs >= bounds.endMs) return;
    enriched.push({ sub: s, mondayMs: mondayMs });
  });

  const weekMap = {};
  enriched.forEach(function (r) {
    const key = r.sub.weekLabel;
    if (!weekMap[key]) weekMap[key] = { key: key, label: key, mondayMs: r.mondayMs };
  });
  const weeks = Object.keys(weekMap).map(function (k) { return weekMap[k]; })
    .sort(function (a, b) { return a.mondayMs - b.mondayMs; });

  const perDevWeekly = {};                             // email -> { weekKey -> items }
  const teamWeekly = {};                                // weekKey -> items
  const dowTotals = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };

  enriched.forEach(function (r) {
    const s = r.sub;
    if (!perDevWeekly[s.email]) perDevWeekly[s.email] = {};
    perDevWeekly[s.email][s.weekLabel] = (perDevWeekly[s.email][s.weekLabel] || 0) + s.totalItems;
    teamWeekly[s.weekLabel] = (teamWeekly[s.weekLabel] || 0) + s.totalItems;
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(function (d) {
      dowTotals[d] += (s.dayItemCounts && s.dayItemCounts[d]) || 0;
    });
  });

  const weekCount = weeks.length || 1;
  const leaderboard = roster.map(function (dev) {
    const byWeek = perDevWeekly[dev.email] || {};
    const total = Object.keys(byWeek).reduce(function (sum, k) { return sum + byWeek[k]; }, 0);
    const submittedWeeks = weeks.filter(function (w) { return byWeek.hasOwnProperty(w.key); }).length;
    return {
      email: dev.email, name: dev.name, designation: dev.designation,
      total: total, avgPerWeek: total / weekCount,
      submittedWeeks: submittedWeeks, missedWeeks: weeks.length - submittedWeeks
    };
  }).sort(function (a, b) { return b.avgPerWeek - a.avgPerWeek; });

  return { weeks: weeks, perDevWeekly: perDevWeekly, teamWeekly: teamWeekly, dowTotals: dowTotals, leaderboard: leaderboard, roster: roster };
}

function computeTeamTrendPct_(model) {
  const weeks = model.weeks;
  if (weeks.length < 4) return null;
  const mid = Math.floor(weeks.length / 2);
  const avg = function (arr) {
    return arr.reduce(function (s, w) { return s + (model.teamWeekly[w.key] || 0); }, 0) / arr.length;
  };
  const a = avg(weeks.slice(0, mid)), b = avg(weeks.slice(mid));
  if (a <= 0) return null;
  return (b - a) / a;
}

function computeHighlights_(model) {
  const highlights = [];
  const weeks = model.weeks;
  if (!weeks.length) return highlights;

  let peak = null;
  weeks.forEach(function (w) {
    const v = model.teamWeekly[w.key] || 0;
    if (!peak || v > peak.v) peak = { w: w, v: v };
  });
  if (peak && peak.v > 0) {
    highlights.push({ tone: 'peak', text: 'Team activity peaked in <strong>' + escapeHtml(peak.w.label) +
      '</strong> with ' + peak.v + ' task' + (peak.v === 1 ? '' : 's') + ' logged.' });
  }

  const top = model.leaderboard[0];
  if (top && top.total > 0) {
    highlights.push({ tone: 'good', text: '<strong>' + escapeHtml(top.name) +
      '</strong> logged the most activity this period - about ' + fmtAvg_(top.avgPerWeek) + ' tasks/week on average.' });
  }

  const lastWeek = weeks[weeks.length - 1];
  const missedNames = model.roster.filter(function (dev) {
    const byWeek = model.perDevWeekly[dev.email] || {};
    return !byWeek.hasOwnProperty(lastWeek.key);
  }).map(function (d) { return d.name; });
  if (missedNames.length) {
    highlights.push({
      tone: 'warn',
      text: missedNames.length + ' developer' + (missedNames.length === 1 ? '' : 's') +
        ' missed <strong>' + escapeHtml(lastWeek.label) + '</strong>',
      chips: missedNames
    });
  }

  if (weeks.length >= 4) {
    const mid = Math.floor(weeks.length / 2);
    const firstHalf = weeks.slice(0, mid).map(function (w) { return w.key; });
    const secondHalf = weeks.slice(mid).map(function (w) { return w.key; });
    let biggestDrop = null;
    model.roster.forEach(function (dev) {
      const byWeek = model.perDevWeekly[dev.email] || {};
      const avg = function (keys) {
        return keys.reduce(function (s, k) { return s + (byWeek[k] || 0); }, 0) / keys.length;
      };
      const a = avg(firstHalf), b = avg(secondHalf);
      if (a >= 2 && b < a) {
        const dropPct = (a - b) / a;
        if (dropPct >= 0.3 && (!biggestDrop || dropPct > biggestDrop.dropPct)) {
          biggestDrop = { name: dev.name, dropPct: dropPct };
        }
      }
    });
    if (biggestDrop) {
      highlights.push({
        tone: 'warn',
        text: '<strong>' + escapeHtml(biggestDrop.name) + "'s</strong> logged activity dropped " +
          Math.round(biggestDrop.dropPct * 100) + '% in the second half of this period.'
      });
    }
  }

  return highlights;
}

function animateCountUps_() {
  analyticsKpis.querySelectorAll('[data-countup]').forEach(function (el) {
    const raw = el.getAttribute('data-countup');
    const target = Number(raw);
    if (raw === '' || !Number.isFinite(target)) return;
    const start = performance.now();
    const duration = 650;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toString();
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function renderKpis_(model) {
  const weeks = model.weeks;
  const weekCount = weeks.length || 1;
  const activeLeaders = model.leaderboard.filter(function (d) { return d.total > 0; });
  const teamTotal = weeks.reduce(function (s, w) { return s + (model.teamWeekly[w.key] || 0); }, 0);
  const avgPerWeek = teamTotal / weekCount;
  const top = model.leaderboard[0];
  // "Least active" is the bottom of the whole roster (not just active
  // devs) - someone with zero activity this period is exactly the point.
  const bottom = model.leaderboard.length ? model.leaderboard[model.leaderboard.length - 1] : null;
  const missedCount = model.leaderboard.filter(function (d) { return d.missedWeeks > 0; }).length;
  const trendPct = computeTeamTrendPct_(model);

  const cards = [
    {
      label: 'Active developers', value: activeLeaders.length + ' / ' + model.roster.length,
      title: 'Developers who logged at least one task this period, out of the whole team.'
    },
    {
      label: 'Tasks logged this period', value: teamTotal, countup: teamTotal,
      sub: trendPct === null ? '' : (trendPct >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(trendPct * 100)) + '% vs earlier half',
      subClass: trendPct === null ? '' : (trendPct >= 0 ? 'is-up' : 'is-down'),
      title: 'Total number of task bullets the whole team logged in this period.' +
        (trendPct === null ? '' : ' The badge compares the second half of this period to the first half.')
    },
    {
      label: 'Avg tasks / week', value: fmtAvg_(avgPerWeek),
      title: 'On a typical week in this period, the team together logged about ' + fmtAvg_(avgPerWeek) +
        ' task bullets in total (team total ÷ number of weeks).'
    },
    {
      label: 'Most active', value: top && top.total > 0 ? top.name : '-',
      title: top && top.total > 0
        ? top.name + ' logged the most tasks this period (about ' + fmtAvg_(top.avgPerWeek) + ' per week on average).'
        : 'No tasks logged by anyone yet this period.'
    },
    {
      label: 'Least active', value: bottom && bottom.total > 0 ? bottom.name : (bottom ? bottom.name : '-'),
      title: bottom
        ? (bottom.total > 0
            ? bottom.name + ' logged the fewest tasks this period (about ' + fmtAvg_(bottom.avgPerWeek) + ' per week on average).'
            : bottom.name + ' logged no tasks at all this period.')
        : 'No data yet.'
    },
    {
      label: 'Missed a week', value: missedCount + (missedCount === 1 ? ' developer' : ' developers'),
      sub: missedCount ? '' : 'Full coverage', subClass: missedCount ? 'is-down' : 'is-up',
      title: 'Number of developers who skipped submitting for at least one week in this period.'
    }
  ];

  analyticsKpis.innerHTML = cards.map(function (c) {
    return '<div class="an-kpi" title="' + escapeHtml(c.title || '') + '">' +
      '<div class="an-kpi-label">' + escapeHtml(c.label) + '</div>' +
      '<div class="an-kpi-value"' + (c.countup !== undefined ? ' data-countup="' + c.countup + '"' : '') + '>' +
        escapeHtml(String(c.countup !== undefined ? 0 : c.value)) +
      '</div>' +
      (c.sub ? '<div class="an-kpi-sub ' + (c.subClass || '') + '">' + escapeHtml(c.sub) + '</div>' : '') +
      '</div>';
  }).join('');
  animateCountUps_();
}

function renderHighlights_(model) {
  const highlights = computeHighlights_(model);
  if (!highlights.length) {
    analyticsHighlights.innerHTML = '<div class="an-highlight">Not enough data in this range to compute highlights yet.</div>';
    return;
  }
  analyticsHighlights.innerHTML = highlights.map(function (h) {
    if (h.chips && h.chips.length) {
      const chipsHtml = h.chips.map(function (n) { return '<span class="an-chip" title="' + escapeHtml(n) + '">' + escapeHtml(n) + '</span>'; }).join('');
      return '<div class="an-highlight" data-tone="' + h.tone + '"><div class="an-highlight-body"><span class="an-highlight-title">' + h.text + '</span><div class="an-chip-row">' + chipsHtml + '</div></div></div>';
    }
    return '<div class="an-highlight" data-tone="' + h.tone + '"><span>' + h.text + '</span></div>';
  }).join('');
}

function destroyChart_(key) {
  if (analyticsCharts[key]) { analyticsCharts[key].destroy(); analyticsCharts[key] = null; }
}

function renderTeamTrendChart_(model, Chart) {
  const canvas = document.getElementById('teamTrendChart');
  destroyChart_('teamTrend');
  analyticsCharts.teamTrend = new Chart(canvas, {
    type: 'line',
    data: {
      labels: model.weeks.map(shortWeekLabel_),
      datasets: [{
        label: 'Tasks logged',
        data: model.weeks.map(function (w) { return model.teamWeekly[w.key] || 0; }),
        borderColor: '#ea580c', backgroundColor: 'rgba(234, 88, 12, 0.12)',
        fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: '#ea580c'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: function (items) { return model.weeks[items[0].dataIndex].label; } } }
      },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderDevTrendChart_(model, Chart) {
  const canvas = document.getElementById('devTrendChart');
  destroyChart_('devTrend');
  const datasets = model.roster.map(function (dev, i) {
    const byWeek = model.perDevWeekly[dev.email] || {};
    const color = AN_DEV_COLORS[i % AN_DEV_COLORS.length];
    return {
      label: dev.name,
      data: model.weeks.map(function (w) { return byWeek.hasOwnProperty(w.key) ? byWeek[w.key] : null; }),
      borderColor: color, backgroundColor: color, spanGaps: false,
      tension: 0.3, pointRadius: 2.5, pointHoverRadius: 5, borderWidth: 2
    };
  });
  analyticsCharts.devTrend = new Chart(canvas, {
    type: 'line',
    data: { labels: model.weeks.map(shortWeekLabel_), datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 750, easing: 'easeOutQuart' },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 10.5 }, usePointStyle: true } },
        tooltip: { callbacks: { title: function (items) { return model.weeks[items[0].dataIndex].label; } } }
      },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderLeaderboardChart_(model, Chart) {
  const canvas = document.getElementById('leaderboardChart');
  const wrap = canvas.parentElement;
  wrap.style.height = Math.max(240, model.leaderboard.length * 30) + 'px';
  destroyChart_('leaderboard');
  const sorted = model.leaderboard;
  analyticsCharts.leaderboard = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(function (d) { return d.name; }),
      datasets: [{
        data: sorted.map(function (d) { return Number(d.avgPerWeek.toFixed(2)); }),
        backgroundColor: sorted.map(function (d, i) { return colorForRank_(i, sorted.length); }),
        borderRadius: 6, maxBarThickness: 22
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      // Bars keep 2-decimal precision (so close averages still look visually
      // distinct) - only the printed tick labels and tooltip round to a
      // whole number, matching every other displayed figure in this panel.
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (ctx) { return fmtAvg_(ctx.parsed.x) + ' tasks/week'; } } }
      },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      onHover: function (evt, elements) {
        evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      onClick: function (evt, elements) {
        if (!elements.length) return;
        openDevDetail_(sorted[elements[0].index].email);
      }
    }
  });
}

function renderDowChart_(model, Chart) {
  const canvas = document.getElementById('dowChart');
  destroyChart_('dow');
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  analyticsCharts.dow = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: order.map(function (d) { return TASK_DAY_LONG[d]; }),
      datasets: [{ data: order.map(function (d) { return model.dowTotals[d] || 0; }), backgroundColor: '#fb923c', borderRadius: 8, maxBarThickness: 46 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderHeatmap_(model) {
  const weeks = model.weeks;
  const devs = model.leaderboard;
  if (!weeks.length || !devs.length) {
    analyticsHeatmap.innerHTML = '<div class="text-xs text-slate-400 italic py-4">No data in this range.</div>';
    return;
  }
  let maxVal = 0;
  devs.forEach(function (d) {
    const byWeek = model.perDevWeekly[d.email] || {};
    weeks.forEach(function (w) { maxVal = Math.max(maxVal, byWeek[w.key] || 0); });
  });
  maxVal = Math.max(1, maxVal);

  let html = '<div class="an-heatmap-grid" style="grid-template-columns: 11.5rem repeat(' + weeks.length + ', 22px);">';
  html += '<div></div>';
  weeks.forEach(function (w) { html += '<div class="an-heatmap-col-label">' + escapeHtml(shortWeekLabel_(w)) + '</div>'; });
  devs.forEach(function (dev) {
    html += '<div class="an-heatmap-row-label" title="' + escapeHtml(dev.name) + '">' + escapeHtml(dev.name) + '</div>';
    const byWeek = model.perDevWeekly[dev.email] || {};
    weeks.forEach(function (w) {
      const submitted = byWeek.hasOwnProperty(w.key);
      const v = byWeek[w.key] || 0;
      const bg = submitted ? heatColor_(v, maxVal) : '#f1f5f9';
      const title = dev.name + ' - ' + w.label + ': ' + (submitted ? v + ' task' + (v === 1 ? '' : 's') + ' logged' : 'no submission');
      html += '<div class="an-heatmap-cell" style="background:' + bg + ';" title="' + escapeHtml(title) + '" data-email="' + escapeHtml(dev.email) + '"></div>';
    });
  });
  html += '</div>';
  analyticsHeatmap.innerHTML = html;
  analyticsHeatmap.querySelectorAll('.an-heatmap-cell').forEach(function (cell) {
    cell.addEventListener('click', function () { openDevDetail_(cell.dataset.email); });
  });
}

async function renderAnalytics_() {
  const model = buildAnalyticsModel_(analyticsFilter);
  renderKpis_(model);
  renderHighlights_(model);
  renderHeatmap_(model);
  try {
    const Chart = await loadChartJS();
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    renderTeamTrendChart_(model, Chart);
    renderDevTrendChart_(model, Chart);
    renderLeaderboardChart_(model, Chart);
    renderDowChart_(model, Chart);
  } catch (err) {
    setAnalyticsStatus_('error', err.message || 'Could not load the chart library.');
  }
}

function setAnalyticsStatus_(kind, msg) {
  if (kind === 'loading') {
    // Same dual-ring spinner block used by the "My Submissions" drawer.
    analyticsStatus.className = '';
    analyticsStatus.innerHTML =
      '<div class="flex flex-col items-center justify-center py-16 gap-3">' +
        '<span class="loader"></span>' +
        '<span class="text-xs text-slate-500">' + escapeHtml(msg || 'Loading…') + '</span>' +
      '</div>';
    return;
  }
  if (!msg) { analyticsStatus.className = 'hidden'; analyticsStatus.innerHTML = ''; return; }
  analyticsStatus.className = kind === 'error' ? 'error-callout mb-4' : 'text-sm text-slate-500 mb-4';
  analyticsStatus.textContent = msg;
}

// Reflects `analyticsFilter` in the UI: highlights the matching preset pill,
// or (for a week/month/year filter) highlights the Custom trigger instead
// and shows the chosen period as its label.
function updateAnalyticsFilterUI_() {
  const isPreset = analyticsFilter.mode === 'preset';
  analyticsRangeBar.querySelectorAll('.an-range-btn[data-range]').forEach(function (btn) {
    btn.classList.toggle('is-active', isPreset && btn.dataset.range === analyticsFilter.key);
  });
  analyticsCustomTrigger.classList.toggle('is-active', !isPreset);
  analyticsCustomLabel.textContent = isPreset ? 'Custom' : analyticsFilterLabel_(analyticsFilter);
}

function anCustomOption_(mode, value, text) {
  return '<button type="button" class="ew-option an-custom-option" data-mode="' + mode + '" data-value="' + escapeHtml(value) + '">' + escapeHtml(text) + '</button>';
}

// (Re)builds the option list inside the custom-filter dropdown for whichever
// tab (week/month/year) is currently active.
function renderCustomFilterList_() {
  if (!analyticsCache) { analyticsCustomList.innerHTML = ''; return; }
  let html = '';
  if (analyticsCustomTab === 'week') {
    const curInfo = weekdaysFor(getCurrentIsoWeekString());
    const prevInfo = weekdaysFor(getPreviousIsoWeekString());
    const curLabel = 'Week ' + curInfo.week + ', ' + curInfo.year;
    const prevLabel = 'Week ' + prevInfo.week + ', ' + prevInfo.year;
    html += anCustomOption_('week', curLabel, 'This week');
    html += anCustomOption_('week', prevLabel, 'Last week');
    const weeks = analyticsAvailableWeeks_();
    if (weeks.length) {
      html += '<div class="an-custom-divider"></div>';
      weeks.forEach(function (w) {
        html += anCustomOption_('week', w.weekLabel, w.weekLabel + ' · ' + fmtWeekRange(w.info.days[0].date, w.info.days[4].date));
      });
    }
  } else if (analyticsCustomTab === 'month') {
    const months = analyticsAvailableMonths_();
    html = months.length
      ? months.map(function (m) { return anCustomOption_('month', m.year + '-' + m.month, MONTH_NAMES[m.month - 1] + ' ' + m.year); }).join('')
      : '<div class="an-custom-empty">No months with data yet.</div>';
  } else if (analyticsCustomTab === 'year') {
    const years = analyticsAvailableYears_();
    html = years.length
      ? years.map(function (y) { return anCustomOption_('year', String(y), String(y)); }).join('')
      : '<div class="an-custom-empty">No years with data yet.</div>';
  }
  analyticsCustomList.innerHTML = html;
}

function positionAnalyticsCustomPanel_() {
  const r = analyticsCustomTrigger.getBoundingClientRect();
  const w = analyticsCustomPanel.offsetWidth || 272;
  analyticsCustomPanel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  analyticsCustomPanel.style.top = (r.bottom + 6) + 'px';
}
function openAnalyticsCustomPanel_() {
  if (!analyticsCache) return;
  renderCustomFilterList_();
  analyticsCustomPanel.classList.add('open');
  analyticsCustomTrigger.classList.add('is-open');
  analyticsCustomTrigger.setAttribute('aria-expanded', 'true');
  positionAnalyticsCustomPanel_();
}
function closeAnalyticsCustomPanel_() {
  analyticsCustomPanel.classList.remove('open');
  analyticsCustomTrigger.classList.remove('is-open');
  analyticsCustomTrigger.setAttribute('aria-expanded', 'false');
}

// ---- "Export report" developer picker (main Analytics panel) ----
// Ranked the same as the leaderboard for the currently-selected filter, so
// the list order matches what the owner is already looking at. `query`
// filters by name or designation, case-insensitive.
function renderExportDevList_(query) {
  if (!analyticsCache) { analyticsExportList.innerHTML = ''; return; }
  const model = buildAnalyticsModel_(analyticsFilter);
  const q = String(query || '').trim().toLowerCase();
  const matches = model.leaderboard.filter(function (d) {
    if (!q) return true;
    return d.name.toLowerCase().indexOf(q) !== -1 || (d.designation || '').toLowerCase().indexOf(q) !== -1;
  });

  if (!matches.length) {
    analyticsExportList.innerHTML = q
      ? '<div class="an-custom-empty-search">No developers match "' + escapeHtml(query) + '".</div>'
      : '<div class="an-custom-empty-search">No developers on the roster.</div>';
    return;
  }

  analyticsExportList.innerHTML = matches.map(function (d) {
    const rank = model.leaderboard.indexOf(d);
    return '<button type="button" class="ew-option an-custom-option an-export-option" data-email="' + escapeHtml(d.email) + '">' +
      '<span class="an-export-option-dot" style="background:' + colorForRank_(rank, model.leaderboard.length) + ';"></span>' +
      '<span class="an-export-option-text">' +
        '<span class="an-export-option-name">' + escapeHtml(d.name) + '</span>' +
        '<span class="an-custom-option-sub">' + escapeHtml(d.designation || '') + ' · avg ' + fmtAvg_(d.avgPerWeek) + '/week</span>' +
      '</span>' +
    '</button>';
  }).join('');
}
function positionAnalyticsExportPanel_() {
  const r = analyticsExportTrigger.getBoundingClientRect();
  const w = analyticsExportPanel.offsetWidth || 328;
  analyticsExportPanel.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
  analyticsExportPanel.style.top = (r.bottom + 6) + 'px';
}
function openAnalyticsExportPanel_() {
  if (!analyticsCache) return;
  analyticsExportSearch.value = '';
  renderExportDevList_('');
  analyticsExportPanel.classList.add('open');
  analyticsExportTrigger.classList.add('is-open');
  analyticsExportTrigger.setAttribute('aria-expanded', 'true');
  positionAnalyticsExportPanel_();
  analyticsExportSearch.focus();
}
function closeAnalyticsExportPanel_() {
  analyticsExportPanel.classList.remove('open');
  analyticsExportTrigger.classList.remove('is-open');
  analyticsExportTrigger.setAttribute('aria-expanded', 'false');
}

async function openAnalyticsPanel() {
  if (!currentUserContext || (currentUserContext.user.email || '').toLowerCase() !== OWNER_EMAIL) return;
  analyticsBackdrop.classList.remove('hidden');
  analyticsPanel.classList.remove('hidden');
  void analyticsPanel.offsetWidth; // force reflow so the opacity transition actually runs
  analyticsPanel.classList.add('open');
  updateAnalyticsFilterUI_();

  analyticsContent.classList.add('hidden');
  setAnalyticsStatus_('loading', 'Loading submissions…');

  try {
    if (!analyticsCache) await fetchAnalyticsData_();
    setAnalyticsStatus_('', '');
    analyticsContent.classList.remove('hidden');
    await renderAnalytics_();
  } catch (err) {
    setAnalyticsStatus_('error', err.message || 'Failed to load analytics.');
  }
}

function closeAnalyticsPanel() {
  analyticsPanel.classList.remove('open');
  closeDevDetail_();
  closeAnalyticsCustomPanel_();
  closeAnalyticsExportPanel_();
  setTimeout(function () {
    analyticsBackdrop.classList.add('hidden');
    analyticsPanel.classList.add('hidden');
  }, 200);
}

// ---- Developer drill-down drawer ----
function openDevDetail_(email) {
  if (!analyticsCache) return;
  const dev = analyticsCache.roster.find(function (d) { return d.email === email; });
  if (!dev) return;
  const model = buildAnalyticsModel_(analyticsFilter);
  const lb = model.leaderboard.find(function (d) { return d.email === email; });
  const byWeek = model.perDevWeekly[email] || {};

  devDetailName.textContent = dev.name;
  devDetailMeta.textContent = dev.designation;

  let best = null, worst = null;
  model.weeks.forEach(function (w) {
    if (!byWeek.hasOwnProperty(w.key)) return;
    const v = byWeek[w.key];
    if (!best || v > best.v) best = { w: w, v: v };
    if (!worst || v < worst.v) worst = { w: w, v: v };
  });
  const missedWeeks = model.weeks.filter(function (w) { return !byWeek.hasOwnProperty(w.key); });

  devDetailBody.innerHTML =
    '<button type="button" id="devDetailExportBtn" class="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold shadow-sm hover:bg-orange-700 active:bg-orange-800 disabled:opacity-60 disabled:cursor-not-allowed transition">' +
      '<span id="devDetailExportIcon" class="an-btn-icon-slot">' + exportIconSvg_('w-4 h-4') + '</span>' +
      '<span id="devDetailExportLabel">Export performance report (PDF)</span>' +
    '</button>' +
    '<div id="devDetailExportStatus" class="hidden"></div>' +
    '<div class="grid grid-cols-2 gap-2">' +
      '<div class="an-detail-stat" title="Total tasks logged ÷ number of weeks in this period."><span class="an-detail-stat-label">Avg tasks/week</span><span class="an-detail-stat-value">' + (lb ? fmtAvg_(lb.avgPerWeek) : '0') + '</span></div>' +
      '<div class="an-detail-stat"><span class="an-detail-stat-label">Total tasks logged</span><span class="an-detail-stat-value">' + (lb ? lb.total : 0) + '</span></div>' +
      '<div class="an-detail-stat"><span class="an-detail-stat-label">Weeks submitted</span><span class="an-detail-stat-value">' + (lb ? lb.submittedWeeks : 0) + ' / ' + model.weeks.length + '</span></div>' +
      '<div class="an-detail-stat"><span class="an-detail-stat-label">Weeks missed</span><span class="an-detail-stat-value">' + (lb ? lb.missedWeeks : 0) + '</span></div>' +
    '</div>' +
    (best ? '<div class="an-highlight" data-tone="good"><span>Best week: <strong>' + escapeHtml(best.w.label) + '</strong> - ' + best.v + ' task' + (best.v === 1 ? '' : 's') + ' logged.</span></div>' : '') +
    (worst && best && worst.v < best.v ? '<div class="an-highlight"><span>Lightest week: <strong>' + escapeHtml(worst.w.label) + '</strong> - ' + worst.v + ' task' + (worst.v === 1 ? '' : 's') + ' logged.</span></div>' : '') +
    (missedWeeks.length
      ? '<div class="an-highlight" data-tone="warn"><div class="an-highlight-body"><span class="an-highlight-title">Missed ' + missedWeeks.length + ' week' + (missedWeeks.length === 1 ? '' : 's') + '</span><div class="an-chip-row">' +
          missedWeeks.map(function (w) { return '<span class="an-chip" title="' + escapeHtml(w.label) + '">' + escapeHtml(shortWeekLabel_(w)) + '</span>'; }).join('') +
        '</div></div></div>'
      : '<div class="an-highlight" data-tone="good"><span>Submitted every week in this range.</span></div>') +
    '<div class="an-chart-wrap" style="height:200px;"><canvas id="devDetailChart"></canvas></div>';

  const exportBtn = document.getElementById('devDetailExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', function () { exportDevPerformancePdf_(email); });

  loadChartJS().then(function (Chart) {
    const canvas = document.getElementById('devDetailChart');
    if (!canvas) return;
    destroyChart_('devDetail');
    analyticsCharts.devDetail = new Chart(canvas, {
      type: 'line',
      data: {
        labels: model.weeks.map(shortWeekLabel_),
        datasets: [{
          data: model.weeks.map(function (w) { return byWeek.hasOwnProperty(w.key) ? byWeek[w.key] : null; }),
          borderColor: colorForEmail_(email, model.roster), backgroundColor: colorForEmail_(email, model.roster),
          spanGaps: false, tension: 0.3, pointRadius: 3, fill: false, borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: function (items) { return model.weeks[items[0].dataIndex].label; } } }
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }).catch(function () { /* chart lib failed - the stats above still render */ });

  devDetailBackdrop.classList.add('open');
  devDetailPanel.classList.add('open');
}

function closeDevDetail_() {
  devDetailBackdrop.classList.remove('open');
  devDetailPanel.classList.remove('open');
}

const ANALYTICS_PRESET_LABELS = {
  '8w': 'Last 8 weeks', '3m': 'Last 3 months', '6m': 'Last 6 months', '1y': 'This year', 'all': 'All time'
};

function slugify_(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'developer';
}

// Local YYYY-MM-DD for "today" - used in the exported filename per the
// naming convention (report content covers `analyticsFilter`'s period, but
// the filename date is always the export date, not the period).
function todayStamp_() {
  const d = new Date();
  const p2 = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

function exportIconSvg_(sizeClass) {
  return '<svg class="' + sizeClass + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>' +
  '</svg>';
}
function tickSvg_(sizeClass) {
  return '<svg class="' + sizeClass + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
}
const BTN_SPINNER_HTML = '<span class="btn-spinner"></span>';

function setDevDetailExportStatus_(kind, msg) {
  const el = document.getElementById('devDetailExportStatus');
  if (!el) return;
  if (!msg) { el.className = 'hidden'; el.textContent = ''; return; }
  el.className = kind === 'error' ? 'error-callout mt-2' : 'text-xs text-slate-500 mt-2 text-center';
  el.textContent = msg;
}

// Fetches ONE developer's raw submission (with the actual taskRows HTML, not
// just counts) for a specific week, by reusing the existing owner-only
// `action=export` endpoint that already powers "Export weekly summary" - no
// backend change needed. Returns null if they didn't submit that week (or
// the request fails).
async function fetchDevWeekSubmission_(email, weekLabel) {
  try {
    const idToken = await currentUserContext.user.getIdToken(false);
    const data = await jsonpFetch(APPS_SCRIPT_URL, { action: 'export', week: weekLabel, idToken: idToken }, 45000);
    if (!data || data.status !== 'ok') return null;
    return (data.submissions || []).find(function (s) { return (s.email || '').toLowerCase() === email; }) || null;
  } catch (_e) {
    return null;
  }
}

// Parses one day cell's HTML into structured lines - {marker, text, bold} -
// preserving <ul>/<ol> list structure (marker '•' or 'N.') and whether an
// entire line was wrapped in <b>/<strong>, so the PDF table can render real
// bullet points and bold lines instead of one flattened paragraph.
function parseCellLines_(html) {
  if (!html) return [];
  const container = document.createElement('div');
  container.innerHTML = html;
  const lines = [];
  function isWhollyBold(el) {
    if (!el || el.children.length !== 1) return false;
    const only = el.children[0];
    const tag = only.tagName.toLowerCase();
    if (tag !== 'b' && tag !== 'strong') return false;
    return (only.textContent || '').trim() === (el.textContent || '').trim();
  }
  function pushLine(marker, el, rawText) {
    const t = (el ? el.textContent : rawText || '').trim();
    if (!t) return;
    lines.push({ marker: marker, text: t, bold: el ? isWhollyBold(el) : false });
  }
  Array.from(container.childNodes).forEach(function (node) {
    if (node.nodeType === Node.TEXT_NODE) { pushLine(null, null, node.textContent); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'ul') {
      Array.from(node.children).forEach(function (li) { if (li.tagName.toLowerCase() === 'li') pushLine('•', li); });
    } else if (tag === 'ol') {
      let n = 0;
      Array.from(node.children).forEach(function (li) {
        if (li.tagName.toLowerCase() !== 'li') return;
        n++; pushLine(n + '.', li);
      });
    } else if (tag === 'br') {
      // no-op - bare text nodes either side already become separate lines
    } else if (tag === 'p' || tag === 'div' || /^h[1-6]$/.test(tag)) {
      pushLine(null, node);
    } else {
      pushLine(null, node);
    }
  });
  return lines;
}

// Splits a raw submission into { day, lines } entries (Monday..Friday),
// `lines` being the parseCellLines_ output for every task row on that day.
// Returns null if there's no submission at all for that week.
function weekDetailDays_(sub) {
  if (!sub) return null;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const rows = Array.isArray(sub.taskRows) && sub.taskRows.length ? sub.taskRows : null;
  if (rows) {
    return DAYS.map(function (d) {
      const lines = [];
      rows.forEach(function (r) { parseCellLines_(r && r[d]).forEach(function (l) { lines.push(l); }); });
      return { day: TASK_DAY_LONG[d], lines: lines };
    });
  }
  if (sub.taskPlain) return [{ day: null, lines: [{ marker: null, text: sub.taskPlain, bold: false }] }];
  return [];
}

function hexToRgba_(hex, alpha) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

// Renders a Chart.js config into a detached (off-screen, never visible)
// canvas and returns a PNG data URL. Independent of any on-screen chart, so
// it works whether the report is triggered from the drill-down drawer or
// directly from the main panel's "Export report" picker.
function offscreenChartImage_(Chart, config, wPx, hPx) {
  const canvas = document.createElement('canvas');
  canvas.width = wPx;
  canvas.height = hPx;
  canvas.style.position = 'fixed';
  canvas.style.left = '-99999px';
  canvas.style.top = '0';
  document.body.appendChild(canvas);
  config.options = Object.assign({ responsive: false, animation: false, devicePixelRatio: 2 }, config.options || {});
  const chart = new Chart(canvas, config);
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  chart.destroy();
  canvas.remove();
  return dataUrl;
}

// Sets the PDF's current font family (Inter once registered via
// registerPdfFonts_, else the doc falls back to Helvetica) at the given
// style ('normal' | 'bold' | 'italic').
function setPdfFont_(doc, style) {
  doc.setFont(doc.__reportFont || 'helvetica', style);
}

function arrayBufferToBase64_(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Fetches Inter (regular/bold/italic) as base64 TTFs, once - jsPDF only
// ships Helvetica/Times/Courier, so matching the app's own Inter typography
// in the PDF report requires embedding real font files.
let pdfReportFontsPromise = null;
function loadPdfReportFonts_() {
  if (!pdfReportFontsPromise) {
    const base = 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/';
    pdfReportFontsPromise = Promise.all([
      fetch(base + 'latin-400-normal.ttf').then(function (r) { return r.arrayBuffer(); }),
      fetch(base + 'latin-700-normal.ttf').then(function (r) { return r.arrayBuffer(); }),
      fetch(base + 'latin-400-italic.ttf').then(function (r) { return r.arrayBuffer(); })
    ]).then(function (bufs) {
      return { regular: arrayBufferToBase64_(bufs[0]), bold: arrayBufferToBase64_(bufs[1]), italic: arrayBufferToBase64_(bufs[2]) };
    });
  }
  return pdfReportFontsPromise;
}

// Registers Inter on this doc instance and returns its font-family name for
// use with setPdfFont_/autoTable. Falls back to 'helvetica' (and leaves the
// doc otherwise untouched) if the font files can't be fetched, so the
// report still generates offline.
async function registerPdfFonts_(doc) {
  try {
    const fonts = await loadPdfReportFonts_();
    doc.addFileToVFS('Inter-Regular.ttf', fonts.regular);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    doc.addFileToVFS('Inter-Bold.ttf', fonts.bold);
    doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
    doc.addFileToVFS('Inter-Italic.ttf', fonts.italic);
    doc.addFont('Inter-Italic.ttf', 'Inter', 'italic');
    return 'Inter';
  } catch (e) {
    return 'helvetica';
  }
}

// Loads assets/ndma_logo.webp once, decoded onto a canvas and re-encoded as
// PNG (jsPDF's addImage handles PNG reliably across versions; WEBP support
// is inconsistent), for the header band. Never rejects - resolves to null
// on any failure so the report still generates without a logo.
let pdfLogoPromise = null;
function loadPdfLogo_() {
  if (!pdfLogoPromise) {
    pdfLogoPromise = new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = 'assets/ndma_logo.webp';
    });
  }
  return pdfLogoPromise;
}

// Adds a fresh page with the thin continuation header (orange rule + dev
// name), returning the y to resume content at.
function startNewPage_(doc, marginX, devName) {
  doc.addPage();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 0, pageW, 1.2, 'F');
  setPdfFont_(doc, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('TECH EW  ·  PERFORMANCE REPORT  ·  ' + devName.toUpperCase(), marginX, 10);
  return 20;
}

function ensureSpace_(doc, y, neededMm, marginX, devName) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + neededMm <= pageH - 20) return y;
  return startNewPage_(doc, marginX, devName);
}

/**
 * Builds a single developer's performance report as a branded, multi-page
 * PDF: header band, identity + KPI boxes, highlights, full current + last
 * week task detail (actual logged text, as real tables - not just counts),
 * a full weekly breakdown table, and - at the end - three charts (weekly
 * trend, day-of-week distribution, submission consistency), each with value
 * labels drawn directly on the chart. Triggers the download and returns the
 * filename. Filename: {slugified-name}-performance-report-{today's date}.pdf
 * Throws on failure - callers own their own loading/error UI.
 */
async function buildDevPerformancePdf_(email) {
  const dev = ALLOWLIST[email] || {};
  const devName = dev.name || email;
  const accentColor = colorForEmail_(email, analyticsCache.roster);

  loadPdfReportFonts_().catch(function () {});
  const [jsPDFCtor, Chart, DataLabels, logo] = await Promise.all([loadJsPDF(), loadChartJS(), loadDataLabelsPlugin_(), loadPdfLogo_()]);

  const model = buildAnalyticsModel_(analyticsFilter);
  const lb = model.leaderboard.find(function (d) { return d.email === email; });
  const byWeek = model.perDevWeekly[email] || {};

  let best = null, worst = null;
  model.weeks.forEach(function (w) {
    if (!byWeek.hasOwnProperty(w.key)) return;
    const v = byWeek[w.key];
    if (!best || v > best.v) best = { w: w, v: v };
    if (!worst || v < worst.v) worst = { w: w, v: v };
  });
  const missedWeeks = model.weeks.filter(function (w) { return !byWeek.hasOwnProperty(w.key); });

  const periodLabel = analyticsFilter.mode === 'preset'
    ? (ANALYTICS_PRESET_LABELS[analyticsFilter.key] || 'Custom period')
    : analyticsFilterLabel_(analyticsFilter);
  const periodRange = model.weeks.length
    ? fmtWeekRange(new Date(model.weeks[0].mondayMs), new Date(model.weeks[model.weeks.length - 1].mondayMs + 4 * 86400000))
    : '';

  // Per-developer day-of-week totals, within the same filtered period.
  const devDowTotals = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
  const inRangeWeekKeys = {};
  model.weeks.forEach(function (w) { inRangeWeekKeys[w.key] = true; });
  analyticsCache.submissions.forEach(function (s) {
    if (s.email !== email || !inRangeWeekKeys[s.weekLabel]) return;
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(function (d) { devDowTotals[d] += (s.dayItemCounts && s.dayItemCounts[d]) || 0; });
  });

  // Last week's actual logged content - independent of whatever
  // analyticsFilter happens to be selected, since "last week" is always
  // relative to today.
  const prevInfo = weekdaysFor(getPreviousIsoWeekString());
  const prevLabel = 'Week ' + prevInfo.week + ', ' + prevInfo.year;
  const prevSub = await fetchDevWeekSubmission_(email, prevLabel);

  // ---- Charts, rendered off-screen so this works from any entry point ----
  // No team comparison (single series only), and every chart draws its own
  // values directly on the marks via chartjs-plugin-datalabels, registered
  // locally per-chart so it never touches the live in-app dashboard.
  const trendImg = offscreenChartImage_(Chart, {
    type: 'line',
    plugins: [DataLabels],
    data: {
      labels: model.weeks.map(shortWeekLabel_),
      datasets: [{
        label: devName, data: model.weeks.map(function (w) { return byWeek.hasOwnProperty(w.key) ? byWeek[w.key] : null; }),
        borderColor: accentColor, backgroundColor: hexToRgba_(accentColor, 0.16), fill: true,
        spanGaps: false, tension: 0.3, pointRadius: 4, pointBackgroundColor: accentColor, borderWidth: 2.5
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        datalabels: {
          display: function (ctx) { return ctx.dataset.data[ctx.dataIndex] !== null; },
          align: 'top', anchor: 'end', offset: 8,
          color: '#1e293b', font: { size: 24, weight: 'bold' },
          formatter: function (v) { return v; }
        }
      },
      layout: { padding: { top: 60 } },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: best ? Math.ceil(best.v * 1.3) + 2 : undefined,
          ticks: { precision: 0, font: { size: 22, weight: 'bold' } }
        },
        x: { ticks: { font: { size: 22, weight: 'bold' } } }
      }
    }
  }, 1500, 620);

  const dowImg = offscreenChartImage_(Chart, {
    type: 'bar',
    plugins: [DataLabels],
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      datasets: [{ data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(function (d) { return devDowTotals[d] || 0; }), backgroundColor: accentColor, borderRadius: 6 }]
    },
    options: {
      plugins: {
        legend: { display: false },
        datalabels: {
          display: function (ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; },
          anchor: 'end', align: 'start', color: '#ffffff', font: { size: 24, weight: 'bold' },
          formatter: function (v) { return v; }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, font: { size: 21, weight: 'bold' } } },
        x: { ticks: { font: { size: 22, weight: 'bold' } } }
      }
    }
  }, 900, 620);

  const consistencyImg = offscreenChartImage_(Chart, {
    type: 'doughnut',
    plugins: [DataLabels],
    data: {
      labels: ['Submitted', 'Missed'],
      datasets: [{ data: [lb ? lb.submittedWeeks : 0, lb ? lb.missedWeeks : 0], backgroundColor: [accentColor, '#e2e8f0'], borderWidth: 0 }]
    },
    options: {
      cutout: '60%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, font: { size: 22, weight: 'bold' }, usePointStyle: true } },
        datalabels: {
          display: function (ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; },
          color: function (ctx) { return ctx.dataIndex === 0 ? '#ffffff' : '#475569'; },
          font: { size: 24, weight: 'bold' },
          formatter: function (v) { return v; }
        }
      }
    }
  }, 620, 620);

  // ---- Assemble the PDF ----
  const doc = new jsPDFCtor({ unit: 'mm', format: 'a4' });
  doc.__reportFont = await registerPdfFonts_(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  const headerH = 34;
  let y;

  // ---- Header band ----
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, headerH, 'F');
  doc.setFillColor(234, 88, 12);
  doc.rect(0, headerH, pageW, 1.4, 'F');
  doc.setTextColor(255, 255, 255);
  setPdfFont_(doc, 'bold');
  doc.setFontSize(10);
  doc.text('TECH EW  ·  WEEKLY TIME SHEET', marginX, 11);
  doc.setFontSize(18);
  doc.text('Performance Report', marginX, 21);
  setPdfFont_(doc, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text('An activity and consistency summary derived from logged submissions - not a quality score.', marginX, 28);

  // Logo, right-aligned and constrained to the header band's height with a
  // clear gap on every side (top/bottom/right - left is already clear of
  // the header text above).
  if (logo && logo.w && logo.h) {
    const vGap = 6;
    const rGap = marginX;
    const maxLogoH = headerH - vGap * 2;
    const maxLogoW = contentW * 0.32;
    let logoH = maxLogoH;
    let logoW = logoH * (logo.w / logo.h);
    if (logoW > maxLogoW) { logoW = maxLogoW; logoH = logoW * (logo.h / logo.w); }
    const logoX = pageW - rGap - logoW;
    const logoY = vGap + (maxLogoH - logoH) / 2;
    doc.addImage(logo.dataUrl, 'PNG', logoX, logoY, logoW, logoH);
  }

  y = 44;

  // ---- Developer identity ----
  doc.setTextColor(15, 23, 42);
  setPdfFont_(doc, 'bold');
  doc.setFontSize(16);
  doc.text(devName, marginX, y);
  y += 6.5;
  setPdfFont_(doc, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const metaLine = (dev.designation || '') + (dev.reportedTo ? '   ·   Reports to ' + dev.reportedTo : '');
  if (metaLine.trim()) { doc.text(metaLine, marginX, y); y += 5.5; }
  doc.setTextColor(51, 65, 85);
  doc.text('Period: ' + periodLabel + (periodRange ? '   ·   ' + periodRange : ''), marginX, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Generated ' + new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }), marginX, y);
  y += 8;

  // ---- KPI boxes ----
  const kpiData = [
    { label: 'AVG TASKS / WEEK', value: fmtAvg_(lb ? lb.avgPerWeek : 0) },
    { label: 'TOTAL TASKS LOGGED', value: String(lb ? lb.total : 0) },
    { label: 'WEEKS SUBMITTED', value: (lb ? lb.submittedWeeks : 0) + ' / ' + model.weeks.length },
    { label: 'WEEKS MISSED', value: String(lb ? lb.missedWeeks : 0) }
  ];
  const boxGap = 4, boxH = 19;
  const boxW = (contentW - boxGap * 3) / 4;
  kpiData.forEach(function (k, i) {
    const bx = marginX + i * (boxW + boxGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'FD');
    setPdfFont_(doc, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(k.value, bx + boxW / 2, y + 9, { align: 'center' });
    setPdfFont_(doc, 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(71, 85, 105);
    doc.text(k.label, bx + boxW / 2, y + 15.5, { align: 'center' });
  });
  y += boxH + 9;

  // ---- Highlights: single row, up to 3 tone-coloured columns (mirrors the
  // in-app panel's peak/good/warn highlight-card colours). ----
  const highlightItems = [];
  if (best) highlightItems.push({ tone: 'good', text: 'Best week: ' + best.w.label + ' - ' + best.v + ' task' + (best.v === 1 ? '' : 's') + ' logged.' });
  if (worst && best && worst.v < best.v) highlightItems.push({ tone: 'peak', text: 'Lightest week: ' + worst.w.label + ' - ' + worst.v + ' task' + (worst.v === 1 ? '' : 's') + ' logged.' });
  highlightItems.push(missedWeeks.length
    ? { tone: 'warn', text: 'Missed ' + missedWeeks.length + ' week' + (missedWeeks.length === 1 ? '' : 's') + ': ' + missedWeeks.map(function (w) { return w.label; }).join(', ') + '.' }
    : { tone: 'good', text: 'Submitted every week in this period.' });

  const HL_TONES = {
    good: { border: [21, 128, 61], bg: [240, 253, 244], text: [22, 101, 52] },
    peak: { border: [234, 88, 12], bg: [255, 247, 237], text: [154, 52, 18] },
    warn: { border: [220, 38, 38], bg: [254, 242, 242], text: [153, 27, 27] }
  };

  y = ensureSpace_(doc, y, 30, marginX, devName);
  setPdfFont_(doc, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Highlights', marginX, y);
  y += 5;

  const hlGap = 4;
  const hlBoxW = (contentW - hlGap * (highlightItems.length - 1)) / highlightItems.length;
  setPdfFont_(doc, 'normal');
  doc.setFontSize(8.5);
  const hlWrapped = highlightItems.map(function (h) { return doc.splitTextToSize(h.text, hlBoxW - 8); });
  const hlLineH = 4.1;
  const hlBoxH = Math.max(16, Math.max.apply(null, hlWrapped.map(function (w) { return w.length; })) * hlLineH + 8);
  y = ensureSpace_(doc, y, hlBoxH + 4, marginX, devName);

  highlightItems.forEach(function (h, i) {
    const tone = HL_TONES[h.tone] || HL_TONES.good;
    const bx = marginX + i * (hlBoxW + hlGap);
    doc.setFillColor(tone.bg[0], tone.bg[1], tone.bg[2]);
    doc.roundedRect(bx, y, hlBoxW, hlBoxH, 2, 2, 'F');
    doc.setFillColor(tone.border[0], tone.border[1], tone.border[2]);
    doc.rect(bx, y, 1.4, hlBoxH, 'F');
    setPdfFont_(doc, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(tone.text[0], tone.text[1], tone.text[2]);
    doc.text(hlWrapped[i], bx + 5, y + 6);
  });
  y += hlBoxH + 9;

  // ---- Last week: full logged detail, as a real table - one row per
  // bullet/task line (with a bullet or number marker), the Day column
  // row-spanned across that day's items, so wrapped lines and multiple
  // tasks per day read exactly like the app's own bulleted task list. ----
  y = ensureSpace_(doc, y, 20, marginX, devName);
  setPdfFont_(doc, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('Last week - full detail  ·  ' + prevLabel, marginX, y);
  y += 3;

  const lastWeekDays = weekDetailDays_(prevSub);
  if (!lastWeekDays || !lastWeekDays.length) {
    y += 3;
    setPdfFont_(doc, 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    y = ensureSpace_(doc, y, 6, marginX, devName);
    doc.text('No submission on record for this week.', marginX, y);
    y += 9;
  } else {
    const lastWeekBody = [];
    lastWeekDays.forEach(function (d) {
      const dayLabel = d.day || prevLabel;
      if (!d.lines.length) {
        lastWeekBody.push([
          { content: dayLabel, styles: { fontStyle: 'bold', textColor: [194, 65, 12] } },
          { content: '(no content logged)', styles: { fontStyle: 'italic', textColor: [148, 163, 184] } }
        ]);
        return;
      }
      d.lines.forEach(function (line, i) {
        const row = [];
        if (i === 0) {
          row.push({ content: dayLabel, rowSpan: d.lines.length, styles: { fontStyle: 'bold', textColor: [194, 65, 12], valign: 'top' } });
        }
        const text = (line.marker ? line.marker + '  ' : '') + line.text;
        row.push({ content: text, styles: line.bold ? { fontStyle: 'bold' } : {} });
        lastWeekBody.push(row);
      });
    });

    doc.autoTable({
      startY: y + 2,
      margin: { left: marginX, right: marginX, bottom: 16 },
      head: [['Day', 'Tasks logged']],
      body: lastWeekBody,
      styles: { font: (doc.__reportFont || 'helvetica'), fontSize: 8.5, cellPadding: 3, textColor: [51, 65, 85], valign: 'top' },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 26 } }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ---- Full weekly breakdown table ----
  y = ensureSpace_(doc, y, 20, marginX, devName);
  const rows = model.weeks.map(function (w) {
    const has = byWeek.hasOwnProperty(w.key);
    const friday = new Date(w.mondayMs + 4 * 86400000);
    return [w.label, fmtWeekRange(new Date(w.mondayMs), friday), has ? String(byWeek[w.key]) : '-', has ? 'Submitted' : 'Missed'];
  });

  setPdfFont_(doc, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Full weekly breakdown', marginX, y);
  y += 3;

  doc.autoTable({
    startY: y,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [['Week', 'Date range', 'Tasks logged', 'Status']],
    body: rows,
    styles: { font: (doc.__reportFont || 'helvetica'), fontSize: 8.5, cellPadding: 2.3, textColor: [51, 65, 85] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' } },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.textColor = data.cell.raw === 'Missed' ? [185, 28, 28] : [21, 128, 61];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });
  y = doc.lastAutoTable.finalY + 8;

  // ---- Visual summary (charts, at the end of the report) ----
  // Always starts on its own page, so the charts read as a clearly
  // segregated section rather than trailing on after the tables.
  y = startNewPage_(doc, marginX, devName);
  y += 8;
  setPdfFont_(doc, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text('Visual summary', marginX, y);
  y += 14;

  setPdfFont_(doc, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  y = ensureSpace_(doc, y, 70, marginX, devName);
  doc.text('Weekly trend', marginX, y);
  y += 4.5;
  const trendH = contentW * (620 / 1500);
  doc.addImage(trendImg, 'PNG', marginX, y, contentW, trendH);
  y += trendH + 9;

  y = ensureSpace_(doc, y, 62, marginX, devName);
  const halfW = (contentW - 6) / 2;
  setPdfFont_(doc, 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Day-of-week distribution', marginX, y);
  doc.text('Submission consistency', marginX + halfW + 6, y);
  y += 4.5;
  const dowH = halfW * (620 / 900);
  const donutH = halfW * (620 / 620);
  doc.addImage(dowImg, 'PNG', marginX, y, halfW, dowH);
  doc.addImage(consistencyImg, 'PNG', marginX + halfW + 6, y, halfW, donutH);
  y += Math.max(dowH, donutH) + 9;

  // Footer, stamped after everything so the final page count is known.
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    setPdfFont_(doc, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Tech EW  ·  Internal use only', marginX, doc.internal.pageSize.getHeight() - 8);
    doc.text('Page ' + i + ' of ' + totalPages, pageW - marginX, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  const fileName = slugify_(devName) + '-performance-report-' + todayStamp_() + '.pdf';
  doc.save(fileName);
  return fileName;
}

// Drives the drill-down drawer's export button through
// idle -> loading (spinner replaces the icon) -> success (green bg + tick,
// auto-reverts after 3s) or back to idle on error (error text goes to the
// status line below, since it may be longer than the button can show).
function setDrawerExportBtnState_(state) {
  const btn = document.getElementById('devDetailExportBtn');
  const icon = document.getElementById('devDetailExportIcon');
  const label = document.getElementById('devDetailExportLabel');
  if (!btn || !icon || !label) return;
  btn.classList.remove('bg-orange-600', 'hover:bg-orange-700', 'active:bg-orange-800', 'bg-green-600');
  if (state === 'loading') {
    btn.disabled = true;
    btn.classList.add('bg-orange-600');
    icon.innerHTML = BTN_SPINNER_HTML;
    label.textContent = 'Building PDF…';
  } else if (state === 'success') {
    btn.disabled = false;
    btn.classList.add('bg-green-600');
    icon.innerHTML = tickSvg_('w-4 h-4');
    label.textContent = 'Downloaded';
    setTimeout(function () {
      // Only revert if this exact button is still the one on screen (the
      // drawer may have been closed/reopened for someone else by then).
      if (document.getElementById('devDetailExportBtn') === btn) setDrawerExportBtnState_('idle');
    }, 3000);
  } else {
    btn.disabled = false;
    btn.classList.add('bg-orange-600', 'hover:bg-orange-700', 'active:bg-orange-800');
    icon.innerHTML = exportIconSvg_('w-4 h-4');
    label.textContent = 'Export performance report (PDF)';
  }
}

async function exportDevPerformancePdf_(email) {
  if (!analyticsCache) return;
  setDrawerExportBtnState_('loading');
  setDevDetailExportStatus_('', '');
  try {
    await buildDevPerformancePdf_(email);
    setDrawerExportBtnState_('success');
  } catch (err) {
    setDrawerExportBtnState_('idle');
    setDevDetailExportStatus_('error', (err && err.message) ? err.message : 'Could not build the PDF.');
  }
}

// Same idle/loading/success lifecycle for the main panel's "Export report"
// trigger (an-range-btn pill, not a solid button - the chevron hides while
// busy and the label text swaps in place of a separate status line).
let analyticsExportRevertTimer = null;
function setMainExportBtnState_(state) {
  if (analyticsExportRevertTimer) { clearTimeout(analyticsExportRevertTimer); analyticsExportRevertTimer = null; }
  analyticsExportTrigger.classList.remove('is-btn-success');
  if (state === 'loading') {
    analyticsExportTrigger.disabled = true;
    analyticsExportBtnChevron.style.display = 'none';
    analyticsExportBtnIcon.innerHTML = BTN_SPINNER_HTML;
    analyticsExportBtnLabel.textContent = 'Building PDF…';
  } else if (state === 'success') {
    analyticsExportTrigger.disabled = false;
    analyticsExportTrigger.classList.add('is-btn-success');
    analyticsExportBtnIcon.innerHTML = tickSvg_('w-3.5 h-3.5');
    analyticsExportBtnLabel.textContent = 'Downloaded';
    analyticsExportRevertTimer = setTimeout(function () { setMainExportBtnState_('idle'); }, 3000);
  } else {
    analyticsExportTrigger.disabled = false;
    analyticsExportBtnChevron.style.display = '';
    analyticsExportBtnIcon.innerHTML = exportIconSvg_('w-3.5 h-3.5');
    analyticsExportBtnLabel.textContent = 'Export report';
  }
}

// Main-panel version: same PDF, triggered directly from the "Export report"
// dropdown on the Analytics panel itself, without drilling into a developer
// first.
async function exportDevPerformancePdfFromPanel_(email) {
  if (!analyticsCache) return;
  setMainExportBtnState_('loading');
  setAnalyticsExportStatus_('', '');
  try {
    await buildDevPerformancePdf_(email);
    setMainExportBtnState_('success');
  } catch (err) {
    setMainExportBtnState_('idle');
    setAnalyticsExportStatus_('error', (err && err.message) ? err.message : 'Could not build the PDF.');
  }
}

function setAnalyticsExportStatus_(kind, msg) {
  if (!msg) { analyticsExportStatus.className = 'hidden'; analyticsExportStatus.textContent = ''; return; }
  analyticsExportStatus.className = kind === 'error' ? 'error-callout mt-2' : 'text-xs text-slate-500 mt-2';
  analyticsExportStatus.textContent = msg;
}

analyticsBtn.addEventListener('click', openAnalyticsPanel);
analyticsCloseBtn.addEventListener('click', closeAnalyticsPanel);
analyticsBackdrop.addEventListener('click', closeAnalyticsPanel);
analyticsRangeBar.addEventListener('click', function (e) {
  const btn = e.target.closest('.an-range-btn[data-range]');
  if (!btn || !analyticsCache) return;
  analyticsFilter = { mode: 'preset', key: btn.dataset.range };
  closeAnalyticsCustomPanel_();
  updateAnalyticsFilterUI_();
  renderAnalytics_();
});
analyticsCustomTrigger.addEventListener('click', function (e) {
  e.stopPropagation();
  if (analyticsCustomPanel.classList.contains('open')) closeAnalyticsCustomPanel_();
  else openAnalyticsCustomPanel_();
});
analyticsCustomTabs.addEventListener('click', function (e) {
  const tab = e.target.closest('.an-tab-btn');
  if (!tab) return;
  analyticsCustomTab = tab.dataset.tab;
  analyticsCustomTabs.querySelectorAll('.an-tab-btn').forEach(function (b) {
    b.classList.toggle('is-active', b === tab);
  });
  renderCustomFilterList_();
});
analyticsCustomList.addEventListener('click', function (e) {
  const opt = e.target.closest('.an-custom-option');
  if (!opt) return;
  const mode = opt.dataset.mode, value = opt.dataset.value;
  if (mode === 'week') {
    analyticsFilter = { mode: 'week', weekLabel: value };
  } else if (mode === 'month') {
    const parts = value.split('-');
    analyticsFilter = { mode: 'month', year: +parts[0], month: +parts[1] };
  } else if (mode === 'year') {
    analyticsFilter = { mode: 'year', year: +value };
  } else {
    return;
  }
  closeAnalyticsCustomPanel_();
  updateAnalyticsFilterUI_();
  renderAnalytics_();
});
document.addEventListener('click', function (e) {
  if (analyticsCustomPanel.classList.contains('open') &&
      !analyticsCustomPanel.contains(e.target) && !analyticsCustomTrigger.contains(e.target)) {
    closeAnalyticsCustomPanel_();
  }
});
window.addEventListener('resize', closeAnalyticsCustomPanel_);
window.addEventListener('scroll', function (e) {
  // The scrollable element is analyticsCustomList (a child of the panel),
  // not the panel itself, so this must check "inside the panel", not
  // "is the panel" - otherwise wheel-scrolling the list closes it instantly.
  if (analyticsCustomPanel.classList.contains('open') && !analyticsCustomPanel.contains(e.target)) {
    closeAnalyticsCustomPanel_();
  }
}, true);
analyticsExportTrigger.addEventListener('click', function (e) {
  e.stopPropagation();
  if (analyticsExportPanel.classList.contains('open')) closeAnalyticsExportPanel_();
  else openAnalyticsExportPanel_();
});
analyticsExportList.addEventListener('click', function (e) {
  const opt = e.target.closest('.an-custom-option');
  if (!opt) return;
  const email = opt.dataset.email;
  closeAnalyticsExportPanel_();
  exportDevPerformancePdfFromPanel_(email);
});
analyticsExportSearch.addEventListener('input', function () {
  renderExportDevList_(analyticsExportSearch.value);
});
analyticsExportSearch.addEventListener('keydown', function (e) {
  e.stopPropagation(); // don't let Escape-in-the-box bubble to the panel-wide close handler
  if (e.key === 'Escape') { analyticsExportSearch.value = ''; renderExportDevList_(''); }
});
document.addEventListener('click', function (e) {
  if (analyticsExportPanel.classList.contains('open') &&
      !analyticsExportPanel.contains(e.target) && !analyticsExportTrigger.contains(e.target)) {
    closeAnalyticsExportPanel_();
  }
});
window.addEventListener('resize', closeAnalyticsExportPanel_);
window.addEventListener('scroll', function (e) {
  if (analyticsExportPanel.classList.contains('open') && !analyticsExportPanel.contains(e.target)) {
    closeAnalyticsExportPanel_();
  }
}, true);
analyticsRefreshBtn.addEventListener('click', async function () {
  analyticsCache = null;
  analyticsContent.classList.add('hidden');
  setAnalyticsStatus_('loading', 'Refreshing…');
  try {
    await fetchAnalyticsData_();
    setAnalyticsStatus_('', '');
    analyticsContent.classList.remove('hidden');
    await renderAnalytics_();
  } catch (err) {
    setAnalyticsStatus_('error', err.message || 'Failed to refresh analytics.');
  }
});
devDetailCloseBtn.addEventListener('click', closeDevDetail_);
devDetailBackdrop.addEventListener('click', closeDevDetail_);
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (analyticsCustomPanel.classList.contains('open')) { closeAnalyticsCustomPanel_(); return; }
  if (analyticsExportPanel.classList.contains('open')) { closeAnalyticsExportPanel_(); return; }
  if (devDetailPanel.classList.contains('open')) { closeDevDetail_(); return; }
  if (!analyticsPanel.classList.contains('hidden')) closeAnalyticsPanel();
});

// Initial UI state
showLoading();
