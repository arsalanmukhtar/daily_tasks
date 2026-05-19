// =====================================================
// CONFIG — fill in these three blocks before deploying.
// =====================================================

// 1. Firebase Web config — from Firebase console → Project settings → "Your apps" (Web)
const FIREBASE_CONFIG = {
  apiKey:     'AIzaSyA1exz20sN1WqLQdNkP986JX5wHuICYolg',
  authDomain: 'devteam-daily-tasks.firebaseapp.com',
  projectId:  'devteam-daily-tasks'
};

// 2. Deployed Apps Script web app URL (ends in /exec)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz6njgCzwRK1i1aXzW9dmlZzlYfexxx72snoSB46L20u4ecitTTTYrLUnrHY_T_rkUmDQ/exec';

// 3. Allowlist — email → display name. Emails must be lowercase.
//    The SAME map must be pasted into apps-script/Code.gs.
//    Server enforces this; the client copy is just for UX.
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
  'usamabinumar199@gmail.com': 'Usama bin Umar'
};

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
const weekInput        = document.getElementById('weekInput');
const weekSummary      = document.getElementById('weekSummary');
const lastWeekBtn      = document.getElementById('lastWeekBtn');
const thisWeekBtn      = document.getElementById('thisWeekBtn');
const clearWeekBtn     = document.getElementById('clearWeekBtn');
const submittingAsName = document.getElementById('submittingAsName');
const submittingAsEmail= document.getElementById('submittingAsEmail');
const viewSubmissionsBtn = document.getElementById('viewSubmissionsBtn');
const submissionsBackdrop = document.getElementById('submissionsBackdrop');
const submissionsDrawer  = document.getElementById('submissionsDrawer');
const closeDrawerBtn     = document.getElementById('closeDrawerBtn');
const submissionsList    = document.getElementById('submissionsList');

// ---------- Quill editor ----------
const quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'clean']
    ]
  },
  placeholder: 'Pick a week to auto-insert day headers, then write tasks under each day…'
});

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
  if (!info) { weekSummary.textContent = ''; return null; }
  weekSummary.textContent =
    `Week ${info.week}, ${info.year}  ·  ${fmtLong(info.days[0].date)} – ${fmtLong(info.days[4].date)}, ${info.year}`;
  return info;
}

function isEditorEmpty() { return quill.getText().trim().length === 0; }

// Pristine = editor was last filled by us (auto-seed or empty), not by user typing.
// Lets us safely re-seed when the week changes without clobbering user tasks.
let editorIsPristine = true;

quill.on('text-change', (_delta, _oldDelta, source) => {
  if (source === 'user') editorIsPristine = false;
});

function seedEditor(days) {
  const ops = [];
  days.forEach((d, i) => {
    ops.push({ insert: `${d.name} — ${fmtISO(d.date)}`, attributes: { bold: true } });
    ops.push({ insert: '\n', attributes: { header: 3 } });
    ops.push({ insert: '\n' });
    if (i < days.length - 1) ops.push({ insert: '\n' });
  });
  quill.setContents(ops);
  editorIsPristine = true;
}

function clearEditor() {
  quill.setContents([]);
  editorIsPristine = true;
}

function handleWeekChange() {
  const info = refreshWeekSummary();
  if (info) {
    if (editorIsPristine) seedEditor(info.days);
  } else {
    if (editorIsPristine) clearEditor();
  }
}

// Listen on both events so Chrome's native picker "Clear" / "This week" buttons
// reliably fire our handler regardless of which event the browser emits.
weekInput.addEventListener('change', handleWeekChange);
weekInput.addEventListener('input', handleWeekChange);

// Custom buttons — bypass the native picker's "Clear" / "This week" controls
// (unreliable in some Chrome builds) AND bypass the pristine-state guard.
// These are explicit user actions, so they always act on the editor.
lastWeekBtn.addEventListener('click', () => {
  weekInput.value = getPreviousIsoWeekString();
  const info = refreshWeekSummary();
  if (info) seedEditor(info.days);
});

thisWeekBtn.addEventListener('click', () => {
  weekInput.value = getCurrentIsoWeekString();
  const info = refreshWeekSummary();
  if (info) seedEditor(info.days);
});

clearWeekBtn.addEventListener('click', () => {
  weekInput.value = '';
  refreshWeekSummary();
  clearEditor();
});

// ---------- Auth state machine ----------
function showLoading()  {
  loadingState.classList.remove('hidden'); authGate.classList.add('hidden'); form.classList.add('hidden');
  userChip.classList.add('hidden'); userChip.classList.remove('flex');
  submissionsDrawer.classList.remove('open'); submissionsBackdrop.classList.remove('open');
}
function showAuthGate(errMsg) {
  loadingState.classList.add('hidden');
  authGate.classList.remove('hidden');
  form.classList.add('hidden');
  userChip.classList.add('hidden');
  userChip.classList.remove('flex');
  submissionsDrawer.classList.remove('open'); submissionsBackdrop.classList.remove('open');
  if (errMsg) { authError.textContent = errMsg; authError.classList.remove('hidden'); }
  else { authError.classList.add('hidden'); authError.textContent = ''; }
}
function showForm(user, displayName) {
  loadingState.classList.add('hidden');
  authGate.classList.add('hidden');
  form.classList.remove('hidden');
  userChip.classList.remove('hidden');
  userChip.classList.add('flex');

  const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22white%22%3E%3Cpath d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E';
  userPhoto.onerror = () => { userPhoto.onerror = null; userPhoto.src = FALLBACK_AVATAR; };
  userPhoto.src     = user.photoURL || FALLBACK_AVATAR;
  userName.textContent  = displayName;
  userEmail.textContent = user.email;

  submittingAsName.textContent  = displayName;
  submittingAsEmail.textContent = user.email;

  // Seed week if empty
  if (!weekInput.value) weekInput.value = getCurrentIsoWeekString();
  const info = refreshWeekSummary();
  if (info && isEditorEmpty()) seedEditor(info.days);
}

let currentUserContext = null; // { user, displayName }

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentUserContext = null;
    showAuthGate();
    return;
  }
  const email = (user.email || '').toLowerCase();
  const displayName = ALLOWLIST[email];
  if (!displayName) {
    signOut(auth).finally(() => {
      showAuthGate(`The account ${user.email} isn't authorized. Contact your manager.`);
    });
    return;
  }
  currentUserContext = { user, displayName };
  showForm(user, displayName);
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
function setStatus(kind, msg) {
  const colors = {
    info: 'text-slate-500',
    ok: 'text-emerald-600 font-semibold',
    error: 'text-rose-600 font-medium'
  };
  statusEl.className = 'mt-2 text-sm min-h-[1.25rem] ' + (colors[kind] || '');
  statusEl.textContent = msg;
}

resetBtn.addEventListener('click', () => {
  if (!confirm('Clear the form?')) return;
  weekInput.value = getCurrentIsoWeekString();
  const info = refreshWeekSummary();
  if (info) seedEditor(info.days);
  setStatus('info', '');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('info', '');

  if (!currentUserContext) return setStatus('error', 'Please sign in again.');
  const info = weekdaysFor(weekInput.value);
  if (!info) return setStatus('error', 'Please pick a valid week.');
  if (isEditorEmpty()) return setStatus('error', 'Please enter your tasks.');

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
    designation: form.designation.value,
    taskDelta: quill.getContents()
  };

  submitBtn.disabled = true;
  setStatus('info', 'Submitting…');

  try {
    // URLSearchParams body → fetch sends Content-Type:
    // application/x-www-form-urlencoded which is a "simple" CORS request
    // (no preflight) AND Apps Script auto-parses it into e.parameter.
    // fetch follows 302 redirects while preserving the POST method+body —
    // unlike HTML form submission which downgrades POST→GET on 302.
    const formBody = new URLSearchParams();
    formBody.append('payload', JSON.stringify(payload));

    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: formBody,
      redirect: 'follow'
    });
    setStatus('ok', 'Submitted.');
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
  if (!iso) return '—';
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
    '<div class="text-center py-10 text-slate-500 text-sm">Loading…</div>';
  fetchSubmissions();
}

function closeSubmissionsDrawer() {
  submissionsDrawer.classList.remove('open');
  submissionsBackdrop.classList.remove('open');
}

async function fetchSubmissions() {
  try {
    const idToken = await currentUserContext.user.getIdToken(false);
    // GET avoids the POST-preflight problem; Apps Script returns JSON with
    // permissive CORS for GET /exec, so we can actually read the response.
    const url = APPS_SCRIPT_URL +
      '?action=list&idToken=' + encodeURIComponent(idToken);
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Failed to load submissions.');
    renderSubmissions(data.submissions || []);
  } catch (err) {
    submissionsList.innerHTML =
      '<div class="text-center py-10 text-rose-600 text-sm font-medium">' +
      escapeHtml(err.message || 'Failed to load submissions.') +
      '</div>';
  }
}

function renderSubmissions(subs) {
  if (!subs.length) {
    submissionsList.innerHTML =
      '<div class="text-center py-10 text-slate-500 text-sm">No submissions yet.<br><span class="text-xs text-slate-400">Submitted weeks will appear here.</span></div>';
    return;
  }
  submissionsList.innerHTML = '';
  for (const s of subs) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className =
      'group w-full text-left bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl p-3.5 transition shadow-sm hover:shadow';
    card.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(s.weekLabel)}</div>
          <div class="text-xs text-slate-500 mt-0.5 truncate">${escapeHtml(s.weekRange)}</div>
        </div>
        <span class="text-xs text-emerald-700 font-semibold opacity-0 group-hover:opacity-100 transition shrink-0">Edit →</span>
      </div>
      <div class="text-[11px] text-slate-400 mt-2">Last submitted ${escapeHtml(formatTimestamp(s.timestamp))}</div>
    `;
    card.addEventListener('click', () => loadSubmissionIntoForm(s));
    submissionsList.appendChild(card);
  }
}

function loadSubmissionIntoForm(s) {
  const isoWeek = weekLabelToIsoInput(s.weekLabel);
  if (isoWeek) weekInput.value = isoWeek;
  refreshWeekSummary();

  if (s.designation) {
    const opt = Array.from(form.designation.options).find(o => o.value === s.designation);
    if (opt) form.designation.value = s.designation;
  }

  if (s.taskDelta && s.taskDelta.ops) {
    quill.setContents(s.taskDelta);
  } else if (s.taskPlain) {
    quill.setText(s.taskPlain);
  }
  // Loaded content is the user's own past work — guard it from week-change re-seeds.
  editorIsPristine = false;

  setStatus('info', `Loaded ${s.weekLabel} — clicking Submit will overwrite this entry with a fresh timestamp.`);
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

// Initial UI state
showLoading();
