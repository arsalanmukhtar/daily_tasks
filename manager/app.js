// =====================================================
// CONFIG - identical values/conventions to ../app.js. Same origin, same
// auth-token localStorage key (a manager signed in here is also signed in
// on the developer app in the same browser, and vice versa - one session).
// =====================================================
const API_BASE = 'http://182.188.28.163:4500/api';
const WS_BASE = 'ws://182.188.28.163:4500/ws';
const AUTH_TOKEN_KEY = 'daily_tasks_authToken';

function getStoredAuthToken_() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || null; } catch (_e) { return null; }
}
function setStoredAuthToken_(token) {
  try { localStorage.setItem(AUTH_TOKEN_KEY, token); } catch (_e) {}
}
function clearStoredAuthToken_() {
  try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch (_e) {}
}

async function apiRequest_(method, path, body) {
  const headers = {};
  const token = getStoredAuthToken_();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  let fetchBody;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: fetchBody });
  } catch (_e) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new Error((data && data.error) || ('Request failed (' + res.status + ').'));
  return data;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- Rich-text sanitizing/normalizing (ported from app.js, kept in
// sync - stored reason/explanation/resolution/rejection HTML is injected
// raw via innerHTML, so this is both the XSS guard and the fix for legacy
// plain-text "- item"/"1. item" lines that never went through a real
// insertUnorderedList/insertOrderedList and so have no actual <ul>/<li> for
// .rich-text's list CSS to hang-indent). ----------
const RICH_TEXT_ALLOWED_TAGS_ = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'P', 'DIV', 'A']);
function sanitizeRichTextInto_(sourceNode, targetParent) {
  sourceNode.childNodes.forEach(function (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      targetParent.appendChild(document.createTextNode(node.textContent));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'BR') { targetParent.appendChild(document.createElement('br')); return; }
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
    if (RICH_TEXT_ALLOWED_TAGS_.has(node.tagName)) {
      const clean = document.createElement(node.tagName);
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') || '';
        if (/^(https?:|mailto:)/i.test(href.trim())) {
          clean.setAttribute('href', href.trim());
          clean.setAttribute('target', '_blank');
          clean.setAttribute('rel', 'noopener noreferrer');
        }
      }
      sanitizeRichTextInto_(node, clean);
      targetParent.appendChild(clean);
    } else {
      sanitizeRichTextInto_(node, targetParent);
    }
  });
}
function parseInertHtml_(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html || '');
  return tpl.content;
}
const BULLET_MARKER_RE_ = /^[•\-\*]\s+/;
const NUMBERED_MARKER_RE_ = /^\d+[.)]\s+/;
function splitNewlinesIntoBr_(root) {
  Array.from(root.childNodes).forEach(function (node) {
    if (node.nodeType !== Node.TEXT_NODE || node.textContent.indexOf('\n') === -1) return;
    const parts = node.textContent.split('\n');
    parts.forEach(function (part, i) {
      if (i > 0) root.insertBefore(document.createElement('br'), node);
      if (part) root.insertBefore(document.createTextNode(part), node);
    });
    root.removeChild(node);
  });
}
function computeLines_(container) {
  const lines = [];
  let contentNodes = [];
  let allNodes = [];
  function flush() {
    if (contentNodes.length || allNodes.length) lines.push({ contentNodes: contentNodes, allNodes: allNodes });
    contentNodes = [];
    allNodes = [];
  }
  Array.from(container.childNodes).forEach(function (node) {
    const tag = node.nodeType === Node.ELEMENT_NODE ? node.tagName : null;
    if (tag === 'DIV' || tag === 'P') {
      flush();
      lines.push({ contentNodes: Array.from(node.childNodes), allNodes: [node] });
      return;
    }
    if (tag === 'BR') {
      allNodes.push(node);
      flush();
      return;
    }
    contentNodes.push(node);
    allNodes.push(node);
  });
  flush();
  return lines;
}
function leadingMarkerMatch_(line, markerRe) {
  const first = line.contentNodes[0];
  if (!first || first.nodeType !== Node.TEXT_NODE) return null;
  return first.textContent.match(markerRe);
}
function groupMarkerLinesIntoList_(container, markerRe, listTag) {
  const lines = computeLines_(container);
  let i = 0;
  while (i < lines.length) {
    const match = leadingMarkerMatch_(lines[i], markerRe);
    if (!match) { i++; continue; }
    const run = [{ line: lines[i], marker: match }];
    let j = i + 1;
    while (j < lines.length) {
      const m = leadingMarkerMatch_(lines[j], markerRe);
      if (!m) break;
      run.push({ line: lines[j], marker: m });
      j++;
    }

    const list = document.createElement(listTag);
    container.insertBefore(list, run[0].line.allNodes[0]);

    run.forEach(function (r) {
      const li = document.createElement('li');
      const first = r.line.contentNodes[0];
      first.textContent = first.textContent.slice(r.marker[0].length);
      r.line.contentNodes.forEach(function (n) { li.appendChild(n); });
      list.appendChild(li);
      r.line.allNodes.forEach(function (n) { if (n.parentNode === container) container.removeChild(n); });
    });
    i = j;
  }
}
function normalizeStoredListMarkers_(container) {
  splitNewlinesIntoBr_(container);
  groupMarkerLinesIntoList_(container, BULLET_MARKER_RE_, 'ul');
  groupMarkerLinesIntoList_(container, NUMBERED_MARKER_RE_, 'ol');
}
// Stored reason/explanation/resolution/rejection HTML -> a clean string safe to inject.
function sanitizeStoredRichTextHtml_(html) {
  const clean = document.createElement('div');
  sanitizeRichTextInto_(parseInertHtml_(html), clean);
  normalizeStoredListMarkers_(clean);
  return clean.innerHTML;
}

// ---------- DOM refs ----------
const loadingState = document.getElementById('loadingState');
const authGate = document.getElementById('authGate');
const authError = document.getElementById('authError');
const authGateSignInState = document.getElementById('authGateSignInState');
const authGateForgotState = document.getElementById('authGateForgotState');
const authGateCheckEmailState = document.getElementById('authGateCheckEmailState');
const authGateResetState = document.getElementById('authGateResetState');
const signInForm = document.getElementById('signInForm');
const signInEmail = document.getElementById('signInEmail');
const signInPassword = document.getElementById('signInPassword');
const signInSubmitBtn = document.getElementById('signInSubmitBtn');
const forgotForm = document.getElementById('forgotForm');
const forgotEmail = document.getElementById('forgotEmail');
const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
const resetForm = document.getElementById('resetForm');
const resetNewPassword = document.getElementById('resetNewPassword');
const resetNewPasswordConfirm = document.getElementById('resetNewPasswordConfirm');
const resetSubmitBtn = document.getElementById('resetSubmitBtn');
const authShowForgotBtn = document.getElementById('authShowForgotBtn');
const authShowSignInFromForgotBtn = document.getElementById('authShowSignInFromForgotBtn');
const authCheckEmailAddress = document.getElementById('authCheckEmailAddress');
const authUseAnotherEmailBtn = document.getElementById('authUseAnotherEmailBtn');

const appShell = document.getElementById('appShell');
const mgrHeaderSubtitle = document.getElementById('mgrHeaderSubtitle');
const mgrSignOutBtn = document.getElementById('mgrSignOutBtn');
const mgrTabbar = document.getElementById('mgrTabbar');
const toastContainer = document.getElementById('toastContainer');

const mgrGlobalSearch = document.getElementById('mgrGlobalSearch');

const mgrRequestsPanel = document.getElementById('mgrRequestsPanel');
const mgrRequestsLoading = document.getElementById('mgrRequestsLoading');
const mgrRequestsEmpty = document.getElementById('mgrRequestsEmpty');
const mgrRequestsBody = document.getElementById('mgrRequestsBody');
const mgrRequestsPendingEmpty = document.getElementById('mgrRequestsPendingEmpty');
const mgrRequestsPendingList = document.getElementById('mgrRequestsPendingList');
const mgrRequestsDecidedEmpty = document.getElementById('mgrRequestsDecidedEmpty');
const mgrRequestsDecidedList = document.getElementById('mgrRequestsDecidedList');
const mgrRequestsCount = document.getElementById('mgrRequestsCount');
const mgrTabRequestsBadge = document.getElementById('mgrTabRequestsBadge');
const mgrReqStatusFilter = document.getElementById('mgrReqStatusFilter');
const mgrReqTypeFilter = document.getElementById('mgrReqTypeFilter');
const mgrReqDeveloperFilter = document.getElementById('mgrReqDeveloperFilter');

const PANELS_ = {
  requests: document.getElementById('mgrRequestsPanel'),
  archived: document.getElementById('mgrArchivedPanel'),
  summary: document.getElementById('mgrSummaryPanel'),
  report: document.getElementById('mgrReportPanel'),
  team: document.getElementById('mgrTeamPanel')
};

const mgrDetailModal = document.getElementById('mgrDetailModal');
const mgrDetailBackdrop = document.getElementById('mgrDetailBackdrop');
const mgrDetailCloseBtn = document.getElementById('mgrDetailCloseBtn');
const mgrDetailName = document.getElementById('mgrDetailName');
const mgrDetailMeta = document.getElementById('mgrDetailMeta');
const mgrDetailChips = document.getElementById('mgrDetailChips');
const mgrDetailReason = document.getElementById('mgrDetailReason');
const mgrDetailAttachWrap = document.getElementById('mgrDetailAttachWrap');
const mgrDetailAttachList = document.getElementById('mgrDetailAttachList');
const mgrDetailReplacementWrap = document.getElementById('mgrDetailReplacementWrap');
const mgrDetailReplacementText = document.getElementById('mgrDetailReplacementText');
const mgrDetailAwaitingDocsNotice = document.getElementById('mgrDetailAwaitingDocsNotice');
const mgrDetailDecisionNoteWrap = document.getElementById('mgrDetailDecisionNoteWrap');
const mgrDetailDecisionNoteText = document.getElementById('mgrDetailDecisionNoteText');
const mgrDetailFooter = document.getElementById('mgrDetailFooter');
const mgrRejectBtn = document.getElementById('mgrRejectBtn');
const mgrApproveBtn = document.getElementById('mgrApproveBtn');
const mgrDecideRejectExtra = document.getElementById('mgrDecideRejectExtra');
const mgrDecideNote = document.getElementById('mgrDecideNote');
const mgrDecideAllowReschedule = document.getElementById('mgrDecideAllowReschedule');
const mgrDecideConfirmFooter = document.getElementById('mgrDecideConfirmFooter');
const mgrDecideCancelBtn = document.getElementById('mgrDecideCancelBtn');
const mgrDecideConfirmBtn = document.getElementById('mgrDecideConfirmBtn');

const mgrLeaveCalModal = document.getElementById('mgrLeaveCalModal');
const mgrLeaveCalBackdrop = document.getElementById('mgrLeaveCalBackdrop');
const mgrLeaveCalCloseBtn = document.getElementById('mgrLeaveCalCloseBtn');
const mgrLeaveCalTitle = document.getElementById('mgrLeaveCalTitle');
const mgrLeaveCalSubtitle = document.getElementById('mgrLeaveCalSubtitle');
const mgrLeaveCalPrevBtn = document.getElementById('mgrLeaveCalPrevBtn');
const mgrLeaveCalNextBtn = document.getElementById('mgrLeaveCalNextBtn');
const mgrLeaveCalMonthYearLabel = document.getElementById('mgrLeaveCalMonthYearLabel');
const mgrLeaveCalGrid = document.getElementById('mgrLeaveCalGrid');

// ---------- Toast ----------
function showToast_(message, tone) {
  const el = document.createElement('div');
  el.className = 'toast' + (tone ? ' is-' + tone : '');
  el.setAttribute('role', tone === 'error' || tone === 'warning' ? 'alert' : 'status');
  el.innerHTML = '<span>' + escapeHtml(message) + '</span>';
  toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 350);
  }, 5000);
}
function showErrorToast_(message) { showToast_(message, 'error'); }

// ---------- Password show/hide toggles (shared markup pattern) ----------
document.querySelectorAll('.pw-toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.pw-field').querySelector('input');
    const isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    btn.querySelector('.pw-eye-icon').classList.toggle('hidden', isPw);
    btn.querySelector('.pw-eye-off-icon').classList.toggle('hidden', !isPw);
  });
});

// ---------- Auth state machine ----------
let currentManager = null; // { email, name, isOwner }

function showLoading() {
  loadingState.classList.remove('hidden');
  authGate.classList.add('hidden');
  appShell.classList.add('hidden');
  mgrTabbar.classList.add('hidden');
  document.body.classList.remove('is-authed');
}
const AUTH_GATE_STATES_ = {
  signIn: authGateSignInState, forgot: authGateForgotState,
  checkEmail: authGateCheckEmailState, reset: authGateResetState
};
function setAuthGateState_(state) {
  Object.keys(AUTH_GATE_STATES_).forEach((key) => {
    AUTH_GATE_STATES_[key].classList.toggle('hidden', key !== state);
  });
}
function showAuthGate(errMsg, state) {
  loadingState.classList.add('hidden');
  authGate.classList.remove('hidden');
  appShell.classList.add('hidden');
  mgrTabbar.classList.add('hidden');
  setAuthGateState_(state || 'signIn');
  authError.classList.add('hidden');
  authError.textContent = '';
  document.body.classList.remove('is-authed');
  if (errMsg) showErrorToast_(errMsg);
}
function showForm(user) {
  loadingState.classList.add('hidden');
  authGate.classList.add('hidden');
  appShell.classList.remove('hidden');
  mgrTabbar.classList.remove('hidden');
  document.body.classList.add('is-authed');
  mgrHeaderSubtitle.textContent = user.name + ' · ' + user.email;
  fetchRequests_();
  connectRealtime_();
}

signInForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signInSubmitBtn.disabled = true;
  try {
    const result = await apiRequest_('POST', '/auth/login', {
      email: signInEmail.value.trim(), password: signInPassword.value
    });
    setStoredAuthToken_(result.token);
    await restoreSession_();
  } catch (err) {
    showErrorToast_(err.message);
  } finally {
    signInSubmitBtn.disabled = false;
  }
});

authShowForgotBtn.addEventListener('click', () => setAuthGateState_('forgot'));
authShowSignInFromForgotBtn.addEventListener('click', () => setAuthGateState_('signIn'));
authUseAnotherEmailBtn.addEventListener('click', () => setAuthGateState_('forgot'));

forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  forgotSubmitBtn.disabled = true;
  try {
    await apiRequest_('POST', '/auth/forgot-password', { email: forgotEmail.value.trim(), platform: 'web' });
    authCheckEmailAddress.textContent = forgotEmail.value.trim();
    setAuthGateState_('checkEmail');
  } catch (err) {
    showErrorToast_(err.message);
  } finally {
    forgotSubmitBtn.disabled = false;
  }
});

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (resetNewPassword.value !== resetNewPasswordConfirm.value) {
    showErrorToast_('Passwords do not match.');
    return;
  }
  resetSubmitBtn.disabled = true;
  try {
    const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('reset');
    await apiRequest_('POST', '/auth/reset-password', { token, password: resetNewPassword.value });
    history.replaceState(null, '', location.pathname);
    showToast_('Password updated - sign in with your new password.', 'success');
    setAuthGateState_('signIn');
  } catch (err) {
    showErrorToast_(err.message);
  } finally {
    resetSubmitBtn.disabled = false;
  }
});

function performSignOut_() {
  stopRealtime_();
  clearStoredAuthToken_();
  currentManager = null;
  showAuthGate();
}
mgrSignOutBtn.addEventListener('click', performSignOut_);

// Every account is provisioned manager-first-or-not by the server's own
// is_owner flag - this app refuses anyone it isn't true for right at
// session-restore, same spot the developer web app re-checks `active`.
async function restoreSession_() {
  const token = getStoredAuthToken_();
  if (!token) { showAuthGate(); return; }
  showLoading();
  try {
    const me = await apiRequest_('GET', '/auth/me');
    if (!me.isOwner) {
      clearStoredAuthToken_();
      showAuthGate('This is the manager console - sign in with a manager account.');
      return;
    }
    currentManager = me;
    showForm(me);
  } catch (err) {
    clearStoredAuthToken_();
    showAuthGate(err.message);
  }
}

// Password-reset deep link: the web app's own convention is `#reset=<token>`
// (see server/src/auth.js's platform:'web' branch) - same hash this app's
// own forgot-password flow above requests via platform:'web'.
(function handleResetHash_() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.get('reset')) {
    loadingState.classList.add('hidden');
    authGate.classList.remove('hidden');
    setAuthGateState_('reset');
  }
})();

// ---------- Realtime ----------
let realtimeSocket_ = null;
let realtimeReconnectTimer_ = null;
function connectRealtime_() {
  const token = getStoredAuthToken_();
  if (!token) return;
  if (realtimeReconnectTimer_) { clearTimeout(realtimeReconnectTimer_); realtimeReconnectTimer_ = null; }
  if (realtimeSocket_) { realtimeSocket_.onclose = null; realtimeSocket_.close(); }
  const ws = new WebSocket(WS_BASE + '?token=' + encodeURIComponent(token));
  realtimeSocket_ = ws;
  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch (_e) { return; }
    if (msg.resource === 'leaveRequests') {
      if (mgrActiveTab_ === 'requests') fetchRequests_().catch(() => {});
      else if (mgrActiveTab_ === 'archived') fetchArchived_().catch(() => {});
      else if (mgrActiveTab_ === 'summary') fetchSummary_().catch(() => {});
      else allRequestsCache_ = []; // stale - refetched next time a tab that needs it opens
    } else if (msg.resource === 'uninformedLeaves' || msg.resource === 'lateArrivalNotices') {
      if (mgrActiveTab_ === 'report') fetchReportTab_().catch(() => {});
    } else if (msg.resource === 'users') {
      if (mgrActiveTab_ === 'team' && teamActiveSub_ === 'directory') fetchTeamDirectory_().catch(() => {});
      else usersCache_ = [];
    } else if (msg.resource === 'attendance') {
      if (mgrActiveTab_ === 'team' && teamActiveSub_ === 'attendance') fetchAttendanceRoster_().catch(() => {});
      else if (mgrActiveTab_ === 'team' && teamActiveSub_ === 'stats') fetchStats_().catch(() => {});
    }
  };
  ws.onclose = () => {
    if (realtimeSocket_ !== ws) return;
    realtimeSocket_ = null;
    realtimeReconnectTimer_ = setTimeout(connectRealtime_, 5000);
  };
  ws.onerror = () => ws.close();
}
function stopRealtime_() {
  if (realtimeReconnectTimer_) { clearTimeout(realtimeReconnectTimer_); realtimeReconnectTimer_ = null; }
  if (realtimeSocket_) { realtimeSocket_.onclose = null; realtimeSocket_.close(); realtimeSocket_ = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && getStoredAuthToken_() &&
      (!realtimeSocket_ || realtimeSocket_.readyState === WebSocket.CLOSED)) {
    connectRealtime_();
  }
});

mgrGlobalSearch.addEventListener('input', () => {
  globalSearchQuery_ = mgrGlobalSearch.value.trim().toLowerCase();
  rerenderActiveTab_();
});

// ---------- Tab switching ----------
let mgrActiveTab_ = 'requests';
let teamActiveSub_ = 'directory';
function setMgrTab_(tab) {
  mgrActiveTab_ = tab;
  Object.keys(PANELS_).forEach((key) => PANELS_[key].classList.toggle('hidden', key !== tab));
  mgrTabbar.querySelectorAll('.mgr-tab-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mtab === tab);
  });
  if (tab === 'requests') fetchRequests_();
  else if (tab === 'archived') fetchArchived_();
  else if (tab === 'summary') fetchSummary_();
  else if (tab === 'report') fetchReportTab_();
  else if (tab === 'team') {
    if (teamActiveSub_ === 'directory') fetchTeamDirectory_();
    else if (teamActiveSub_ === 'attendance') fetchAttendanceRoster_();
    else fetchStats_();
  }
}
mgrTabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.mgr-tab-btn');
  if (!btn) return;
  setMgrTab_(btn.dataset.mtab);
});

// ---------- Requests tab ----------
const LEAVE_TYPE_LABELS_ = {
  foreignTrip: 'Foreign Trip', umrah: 'Umrah', medical: 'Medical',
  casualShort: 'Short Leave', casualFull: 'Full Leave', casualOutPass: 'Out Pass',
  emergency: 'Emergency', pending_documentation: 'Emergency'
};
function leaveTypeLabel_(type) { return LEAVE_TYPE_LABELS_[type] || type; }

function fmtDate_(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
// DD-MM-YYYY HH:MM, no timezone string - for real timestamps (not date-only
// values like fmtDate_ handles).
function fmtDateTime_(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Matches the calendar glyph the native app shows next to a leave request's
// date range (see app.js's #upcomingLeaveBtn icon for the same paths).
const CALENDAR_ICON_SVG_ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
function dateRangeLabel_(rec) {
  if (Array.isArray(rec.customDates) && rec.customDates.length > 1) {
    return rec.customDates.length + ' selected dates';
  }
  if (rec.startDate === rec.endDate || !rec.endDate) return fmtDate_(rec.startDate);
  return fmtDate_(rec.startDate) + ' – ' + fmtDate_(rec.endDate);
}
function dateRangePillHtml_(rec) {
  return `<span class="mgr-pill lv-meta">` +
    `<span class="cal-pill-icon" data-cal-rec="${escapeHtml(rec.requestId)}" role="button" tabindex="0" aria-label="View leave dates on a calendar">${CALENDAR_ICON_SVG_}</span>` +
    `<span class="cal-pill-text">${escapeHtml(dateRangeLabel_(rec))}</span>` +
  `</span>`;
}

// ---------- Leave dates calendar popup (the date pill's calendar icon) ----------
// Navigation-only month grid highlighting a request's actual leave days -
// mirrors the developer app's #leaveCalendarModal exactly, just fed by
// whichever request card's icon was clicked instead of one fixed upcoming
// leave.
const CAL_MONTHS_ = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let mgrCalRecord_ = null;
let mgrCalViewYear_ = new Date().getFullYear();
let mgrCalViewMonth_ = new Date().getMonth();

function mgrCalRenderGrid_() {
  mgrLeaveCalMonthYearLabel.textContent = CAL_MONTHS_[mgrCalViewMonth_] + ' ' + mgrCalViewYear_;
  const days = mgrCalRecord_ ? leaveDays_(mgrCalRecord_.startDate, mgrCalRecord_.endDate, mgrCalRecord_.customDates) : [];
  const highlightSet = new Set(days);
  const isCustom = Array.isArray(mgrCalRecord_ && mgrCalRecord_.customDates) && mgrCalRecord_.customDates.length > 1;
  const todayKey = isoDate_(new Date());
  const lead = new Date(mgrCalViewYear_, mgrCalViewMonth_, 1).getDay();

  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(mgrCalViewYear_, mgrCalViewMonth_, 1 - lead + i);
    const dKey = isoDate_(d);
    const isHighlighted = highlightSet.has(dKey);

    let links = '';
    if (!isCustom && isHighlighted) {
      const prev = new Date(d); prev.setDate(d.getDate() - 1);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const col = d.getDay();
      if (highlightSet.has(isoDate_(prev)) && col !== 0) links += '<span class="cal2-link l"></span>';
      if (highlightSet.has(isoDate_(next)) && col !== 6) links += '<span class="cal2-link r"></span>';
    }

    const classes = ['cal2-day'];
    if (d.getMonth() !== mgrCalViewMonth_) classes.push('is-adjacent');
    if (d.getDay() === 0 || d.getDay() === 6) classes.push('is-weekend');
    if (dKey === todayKey) classes.push('is-today');
    if (isHighlighted) classes.push('is-edge');

    html += '<div class="cal2-cell">' + links +
      '<button type="button" class="' + classes.join(' ') + '" disabled tabindex="-1">' + d.getDate() + '</button></div>';
  }
  mgrLeaveCalGrid.innerHTML = html;
}
function openMgrLeaveCal_(rec) {
  const days = leaveDays_(rec.startDate, rec.endDate, rec.customDates);
  const first = days.length ? days[0] : rec.startDate;
  if (!first) return;
  mgrCalRecord_ = rec;
  const firstDate = new Date(first + 'T00:00:00Z');
  mgrCalViewYear_ = firstDate.getFullYear();
  mgrCalViewMonth_ = firstDate.getMonth();
  mgrLeaveCalTitle.textContent = rec.name;
  mgrLeaveCalSubtitle.textContent = leaveTypeLabel_(rec.type) + ' · ' + dateRangeLabel_(rec);
  mgrCalRenderGrid_();
  mgrLeaveCalModal.classList.remove('hidden');
}
function closeMgrLeaveCal_() {
  mgrLeaveCalModal.classList.add('hidden');
  mgrCalRecord_ = null;
}
mgrLeaveCalCloseBtn.addEventListener('click', closeMgrLeaveCal_);
mgrLeaveCalBackdrop.addEventListener('click', closeMgrLeaveCal_);
mgrLeaveCalPrevBtn.addEventListener('click', () => {
  mgrCalViewMonth_--;
  if (mgrCalViewMonth_ < 0) { mgrCalViewMonth_ = 11; mgrCalViewYear_--; }
  mgrCalRenderGrid_();
});
mgrLeaveCalNextBtn.addEventListener('click', () => {
  mgrCalViewMonth_++;
  if (mgrCalViewMonth_ > 11) { mgrCalViewMonth_ = 0; mgrCalViewYear_++; }
  mgrCalRenderGrid_();
});
// Handles a calendar-icon click inside any request card list; returns true
// (and opens the popup) if the click was on the icon, so callers can skip
// their own "open the detail sheet" handling for the same click.
function handleCalPillIconClick_(e, recordsCache) {
  const icon = e.target.closest('[data-cal-rec]');
  if (!icon) return false;
  const rec = recordsCache.find((r) => r.requestId === icon.dataset.calRec);
  if (rec) openMgrLeaveCal_(rec);
  return true;
}
// The icon is keyboard-focusable (role="button" tabindex="0"); Enter/Space
// should activate it same as a click, same as any real button would.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const icon = e.target.closest && e.target.closest('[data-cal-rec]');
  if (!icon) return;
  e.preventDefault();
  const rec = allRequestsCache_.find((r) => r.requestId === icon.dataset.calRec);
  if (rec) openMgrLeaveCal_(rec);
});
function timeAgo_(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + 'h ago';
  return Math.round(hours / 24) + 'd ago';
}

// ---------- Shared: pills, avatars, chip rows ----------
// Exact-Flutter status/type/duration colors - see styles.css's "Leave
// status / type / duration / attendance colors" block for the token
// values, ported by hand from mobile_app/lib/core/theme/app_colors.dart.
function pill_(label, cls, isStatus) {
  return `<span class="mgr-pill ${cls}${isStatus ? ' is-status' : ''}">${escapeHtml(label)}</span>`;
}
function statusPillHtml_(status) {
  if (status === 'approved') return pill_('Approved', 'lv-approved', true);
  if (status === 'rejected') return pill_('Rejected', 'lv-rejected', true);
  if (status === 'withdrawn') return pill_('Withdrawn', 'lv-withdrawn', true);
  if (status === 'dismissed') return pill_('Dismissed', 'lv-withdrawn', true);
  if (status === 'pending_documentation') return pill_('Awaiting Docs', 'lv-requested', true);
  return pill_('Requested', 'lv-requested', true);
}
// Mirrors AppColors.forType()/forDuration(): non-casual types get one chip
// in their own family color; the three casual variants get a shared
// "Casual" chip plus a second chip naming the specific duration.
function leaveTypeChipsHtml_(type) {
  if (type === 'foreignTrip') return pill_('Foreign Trip', 'lv-type-foreign');
  if (type === 'umrah') return pill_('Umrah', 'lv-type-umrah');
  if (type === 'medical') return pill_('Medical', 'lv-type-medical');
  if (type === 'uninformedAbsence') return pill_('Uninformed Absence', 'lv-requested');
  if (type === 'casualShort') return pill_('Casual', 'lv-type-casual') + pill_('Short Leave', 'lv-dur-short');
  if (type === 'casualOutPass') return pill_('Casual', 'lv-type-casual') + pill_('Out Pass', 'lv-dur-outpass');
  if (type === 'casualFull') return pill_('Casual', 'lv-type-casual') + pill_('Full Leave', 'lv-dur-full');
  return pill_(leaveTypeLabel_(type), 'lv-type-casual'); // emergency/pending_documentation
}
// Mirrors AppColors.forLeaveTypeBar() - deliberately NOT the same grouping
// as leaveTypeChipsHtml_ above (that shares one "Casual" color across all
// three variants for request-card chips; each needs its own distinct color
// here since they're separate rows in the same chart).
function leaveTypeBarColorVar_(type) {
  if (type === 'casualFull') return '--lv-dur-full';
  if (type === 'casualShort') return '--lv-dur-short';
  if (type === 'casualOutPass') return '--lv-dur-outpass';
  if (type === 'medical') return '--lv-type-medical';
  if (type === 'foreignTrip') return '--lv-type-foreign';
  if (type === 'umrah') return '--lv-type-umrah';
  if (type === 'uninformedAbsence') return '--lv-requested';
  return '--lv-meta';
}

// Deterministic-per-email colored initials circle - see .mgr-avatar in
// styles.css for why this can't be a byte-identical hue to the Flutter
// app's Avatar.dart, only the same visual character.
function initialsFor_(name, email) {
  const trimmed = (name || '').trim();
  if (!trimmed) return email ? email[0].toUpperCase() : '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0] ? parts[0][0] : '';
  const last = parts.length > 1 && parts[parts.length - 1] ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
function avatarHtml_(name, email, size) {
  size = size || 36;
  const key = (email || name || '').toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  const hue = Math.abs(hash * 137.508) % 360;
  const fontSize = Math.round(size * 0.38);
  return `<span class="mgr-avatar" style="width:${size}px;height:${size}px;font-size:${fontSize}px;background:hsl(${hue.toFixed(1)},55%,55%)">${escapeHtml(initialsFor_(name, email))}</span>`;
}

let allRequestsCache_ = []; // every leave_requests row (owner-wide) - shared by Requests/Archived/Summary/Team

// Every individual calendar day a request covers - mirrors expandLeaveDays()
// in server/src/routes/leaveReplacements.js exactly (kept in sync by hand,
// same as the mobile app's own copy of this logic).
function leaveDays_(startDate, endDate, customDates) {
  if (Array.isArray(customDates) && customDates.length > 1) return customDates;
  if (!startDate) return [];
  const days = [];
  const cur = new Date(startDate + 'T00:00:00Z');
  const end = new Date((endDate || startDate) + 'T00:00:00Z');
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}
function isApprovedLeaveOnDate_(rec, dateStr) {
  return rec.status === 'approved' && leaveDays_(rec.startDate, rec.endDate, rec.customDates).includes(dateStr);
}

// True once a decided request no longer needs to sit in "Requests" for
// reference - mirrors the mobile app's archive-date rule exactly: a
// withdrawn/dismissed request archives immediately; an approved/rejected
// leave request archives the day after its last day passes; a resolved
// uninformed-absence conversion archives once local noon passes (same day
// if resolved before noon, next day otherwise).
function isArchived_(rec) {
  if (rec.status === 'withdrawn' || rec.status === 'dismissed') return true;
  if (rec.status !== 'approved' && rec.status !== 'rejected') return false;
  if (rec.type === 'uninformedAbsence') {
    if (!rec.resolvedAt) return true;
    const resolved = new Date(rec.resolvedAt);
    const noon = new Date(resolved.getFullYear(), resolved.getMonth(), resolved.getDate(), 12, 0, 0, 0);
    const archiveAt = resolved.getTime() < noon.getTime()
      ? noon
      : new Date(noon.getFullYear(), noon.getMonth(), noon.getDate() + 1, 12, 0, 0, 0);
    return Date.now() >= archiveAt.getTime();
  }
  const days = leaveDays_(rec.startDate, rec.endDate, rec.customDates);
  const lastDay = days.length ? days[days.length - 1] : (rec.endDate || rec.startDate);
  if (!lastDay) return true;
  const archiveDate = new Date(lastDay + 'T00:00:00');
  archiveDate.setDate(archiveDate.getDate() + 1);
  return Date.now() >= archiveDate.getTime();
}

// Shared toggle behavior for every .mgr-chip group (status filters, the
// Team Directory/Attendance/Stats switcher, period-unit pickers).
function wireChipGroup_(container, datasetKey, onSelect) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.mgr-chip');
    if (!btn || !container.contains(btn)) return;
    container.querySelectorAll('.mgr-chip').forEach((b) => b.classList.toggle('is-active', b === btn));
    onSelect(btn.dataset[datasetKey]);
  });
}

// ---------- Shared period navigator (Year/Quarter/Month/Week + prev/next) ----------
// Used by Archived, Summary, and Stats - each keeps its own state object.
function makePeriodState_(unit) { return { unit: unit || 'week', anchor: new Date() }; }
function periodBounds_(state) {
  const d = new Date(state.anchor.getFullYear(), state.anchor.getMonth(), state.anchor.getDate());
  if (state.unit === 'all') return { start: null, end: null };
  if (state.unit === 'year') return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear(), 11, 31) };
  if (state.unit === 'quarter') {
    const q = Math.floor(d.getMonth() / 3);
    return { start: new Date(d.getFullYear(), q * 3, 1), end: new Date(d.getFullYear(), q * 3 + 3, 0) };
  }
  if (state.unit === 'month') return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) };
  const day = (d.getDay() + 6) % 7; // Monday-start week
  const start = new Date(d); start.setDate(d.getDate() - day);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { start, end };
}
function periodLabel_(state) {
  if (state.unit === 'all') return 'All time';
  const { start, end } = periodBounds_(state);
  if (state.unit === 'year') return String(start.getFullYear());
  if (state.unit === 'quarter') return 'Q' + (Math.floor(start.getMonth() / 3) + 1) + ' ' + start.getFullYear();
  if (state.unit === 'month') return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' +
    end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function shiftPeriod_(state, dir) {
  const d = new Date(state.anchor);
  if (state.unit === 'year') d.setFullYear(d.getFullYear() + dir);
  else if (state.unit === 'quarter') d.setMonth(d.getMonth() + 3 * dir);
  else if (state.unit === 'month') d.setMonth(d.getMonth() + dir);
  else d.setDate(d.getDate() + 7 * dir);
  state.anchor = d;
}
function inPeriod_(state, dateValue) {
  if (state.unit === 'all' || !dateValue) return true;
  const { start, end } = periodBounds_(state);
  const t = new Date(dateValue).getTime();
  const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
  return t >= start.getTime() && t <= endOfDay;
}
function wirePeriodNav_(chipsContainer, prevBtn, nextBtn, labelEl, state, onChange) {
  wireChipGroup_(chipsContainer, 'periodUnit', (unit) => { state.unit = unit; labelEl.textContent = periodLabel_(state); onChange(); });
  prevBtn.addEventListener('click', () => { shiftPeriod_(state, -1); labelEl.textContent = periodLabel_(state); onChange(); });
  nextBtn.addEventListener('click', () => { shiftPeriod_(state, 1); labelEl.textContent = periodLabel_(state); onChange(); });
  labelEl.textContent = periodLabel_(state);
}

function isoDate_(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// ---------- Shared filter-select population ----------
const LEAVE_TYPE_FILTER_OPTIONS_ = ['foreignTrip', 'umrah', 'medical', 'casualShort', 'casualFull', 'casualOutPass', 'emergency', 'uninformedAbsence'];
function populateTypeSelect_(selectEl) {
  selectEl.innerHTML = '<option value="">All types</option>' +
    LEAVE_TYPE_FILTER_OPTIONS_.map((t) => `<option value="${t}">${escapeHtml(leaveTypeLabel_(t))}</option>`).join('');
}
function populateDeveloperSelect_(selectEl, allLabel) {
  const current = selectEl.value;
  selectEl.innerHTML = '<option value="">' + escapeHtml(allLabel || 'All developers') + '</option>' +
    usersCache_.filter((u) => !u.isOwner).map((u) => `<option value="${escapeHtml(u.email)}">${escapeHtml(u.name)}</option>`).join('');
  if (current && usersCache_.some((u) => u.email === current)) selectEl.value = current;
}

// ---------- Global search ----------
// One persistent search bar (in the app shell, above every tab) filters
// whichever tab is currently active.
let globalSearchQuery_ = '';
function rerenderActiveTab_() {
  if (mgrActiveTab_ === 'requests') renderRequestsList_();
  else if (mgrActiveTab_ === 'archived') renderArchivedList_();
  else if (mgrActiveTab_ === 'report') renderReportTab_();
  else if (mgrActiveTab_ === 'team' && teamActiveSub_ === 'directory') renderTeamDirectory_();
}
function matchesSearch_(hayParts) {
  if (!globalSearchQuery_) return true;
  return hayParts.filter(Boolean).join(' ').toLowerCase().includes(globalSearchQuery_);
}

async function fetchAllRequests_() {
  allRequestsCache_ = await apiRequest_('GET', '/leave-requests');
  return allRequestsCache_;
}

let reqStatusFilter_ = '';
let reqTypeFilter_ = '';
let reqDeveloperFilter_ = '';

async function fetchRequests_() {
  mgrRequestsLoading.classList.remove('hidden');
  mgrRequestsEmpty.classList.add('hidden');
  mgrRequestsBody.classList.add('hidden');
  try {
    await Promise.all([fetchAllRequests_(), usersCache_.length ? Promise.resolve() : fetchUsers_()]);
    populateTypeSelect_(mgrReqTypeFilter);
    populateDeveloperSelect_(mgrReqDeveloperFilter);
    renderRequestsList_();
  } catch (err) {
    showErrorToast_('Could not load requests: ' + err.message);
  } finally {
    mgrRequestsLoading.classList.add('hidden');
  }
}

// Shared request-card layout for Requests and Archived - avatar, name/
// email, status pill, type/duration/date chips, a relative-time chip, an
// attachment-count indicator, the reason shown directly (not hidden behind
// a tap), and (once decided) an italic "Approved/Rejected by X" line.
// Mirrors RequestCard.kt/request_card.dart's structure.
function requestCardHtml_(rec) {
  const decidedBy = (rec.status === 'approved' || rec.status === 'rejected') && rec.resolvedBy
    ? `<div class="mt-2 text-xs text-slate-400 italic">${rec.status === 'approved' ? 'Approved' : 'Rejected'} by ${escapeHtml(rec.resolvedBy)}</div>`
    : '';
  const attachments = Array.isArray(rec.attachments) ? rec.attachments : [];
  const attachIndicator = attachments.length ? `<span class="mgr-attach-indicator">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>${attachments.length}
    </span>` : '';
  const reasonPreview = rec.reasonHtml && rec.reasonHtml.trim()
    ? `<div class="rich-text text-xs text-slate-600 mt-2">${sanitizeStoredRichTextHtml_(rec.reasonHtml)}</div>`
    : '';
  return `
    <button type="button" class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 hover:ring-orange-300 transition p-3.5" data-request-id="${escapeHtml(rec.requestId)}">
      <div class="flex items-start gap-3">
        ${avatarHtml_(rec.name, rec.email)}
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(rec.name)}</div>
              <div class="text-xs text-slate-500 truncate">${escapeHtml(rec.email)}</div>
            </div>
            <div class="shrink-0">${statusPillHtml_(rec.status)}</div>
          </div>
          <div class="flex flex-wrap gap-1.5 mt-2.5">
            ${leaveTypeChipsHtml_(rec.type)}
            ${dateRangePillHtml_(rec)}
          </div>
          <div class="flex flex-wrap items-center gap-2.5 mt-1.5">
            <span class="mgr-pill lv-applied">${escapeHtml(timeAgo_(rec.requestedAt))}</span>
            ${attachIndicator}
          </div>
          ${reasonPreview}
          ${decidedBy}
        </div>
      </div>
    </button>
  `;
}

function passesCommonFilters_(rec, statusFilter, typeFilter, developerFilter) {
  if (statusFilter && rec.status !== statusFilter) return false;
  if (typeFilter && rec.type !== typeFilter) return false;
  if (developerFilter && rec.email !== developerFilter) return false;
  return matchesSearch_([rec.name, rec.email, rec.reasonHtml]);
}

function renderRequestsList_() {
  // Requests tab = still-pending items, plus decided items that haven't
  // reached their archive date yet (see isArchived_) - so a just-decided
  // request stays visible for reference instead of vanishing immediately.
  const relevant = allRequestsCache_.filter((r) =>
    r.status === 'requested' || r.status === 'pending_documentation' ||
    ((r.status === 'approved' || r.status === 'rejected') && !isArchived_(r))
  );
  const filtered = relevant.filter((r) => passesCommonFilters_(r, reqStatusFilter_, reqTypeFilter_, reqDeveloperFilter_));

  const pending = filtered.filter((r) => r.status === 'requested' || r.status === 'pending_documentation')
    .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
  const decided = filtered.filter((r) => r.status === 'approved' || r.status === 'rejected')
    .sort((a, b) => new Date(b.resolvedAt || b.requestedAt) - new Date(a.resolvedAt || a.requestedAt));

  mgrRequestsCount.textContent = filtered.length ? filtered.length + (filtered.length === 1 ? ' request' : ' requests') : '';
  mgrTabRequestsBadge.classList.toggle('hidden', allRequestsCache_.filter((r) => r.status === 'requested').length === 0);

  const empty = filtered.length === 0;
  mgrRequestsEmpty.classList.toggle('hidden', !empty);
  mgrRequestsBody.classList.toggle('hidden', empty);
  if (empty) return;

  mgrRequestsPendingEmpty.classList.toggle('hidden', pending.length > 0);
  mgrRequestsPendingList.innerHTML = pending.map(requestCardHtml_).join('');
  mgrRequestsDecidedEmpty.classList.toggle('hidden', decided.length > 0);
  mgrRequestsDecidedList.innerHTML = decided.map(requestCardHtml_).join('');
}

mgrReqStatusFilter.addEventListener('change', () => { reqStatusFilter_ = mgrReqStatusFilter.value; renderRequestsList_(); });
mgrReqTypeFilter.addEventListener('change', () => { reqTypeFilter_ = mgrReqTypeFilter.value; renderRequestsList_(); });
mgrReqDeveloperFilter.addEventListener('change', () => { reqDeveloperFilter_ = mgrReqDeveloperFilter.value; renderRequestsList_(); });

mgrRequestsBody.addEventListener('click', (e) => {
  if (handleCalPillIconClick_(e, allRequestsCache_)) return;
  const btn = e.target.closest('[data-request-id]');
  if (!btn) return;
  const rec = allRequestsCache_.find((r) => r.requestId === btn.dataset.requestId);
  if (rec) openDetail_(rec, { readOnly: rec.status === 'approved' || rec.status === 'rejected' });
});

// ---------- Detail sheet + decide ----------
let currentDetailRecord_ = null;
let pendingDecision_ = null; // 'approved' | 'rejected'

function openDetail_(rec, opts) {
  opts = opts || {};
  currentDetailRecord_ = rec;
  pendingDecision_ = null;
  mgrDetailName.textContent = rec.name;
  mgrDetailMeta.textContent = 'Sent ' + timeAgo_(rec.requestedAt) + (rec.weekLabel ? ' · ' + rec.weekLabel : '');
  mgrDetailChips.innerHTML =
    leaveTypeChipsHtml_(rec.type) +
    dateRangePillHtml_(rec) +
    (rec.shortLeaveTime ? `<span class="mgr-pill lv-meta">${escapeHtml(rec.shortLeaveTime)}</span>` : '') +
    (rec.checkOutTime ? `<span class="mgr-pill lv-meta">${escapeHtml(rec.checkOutTime)} – ${escapeHtml(rec.checkInTime || '')}</span>` : '') +
    (opts.readOnly ? statusPillHtml_(rec.status) : '');
  mgrDetailReason.innerHTML = rec.reasonHtml && rec.reasonHtml.trim() ? sanitizeStoredRichTextHtml_(rec.reasonHtml) : '<i class="text-slate-400">No reason provided.</i>';

  const attachments = Array.isArray(rec.attachments) ? rec.attachments : [];
  mgrDetailAttachWrap.classList.toggle('hidden', attachments.length === 0);
  mgrDetailAttachList.classList.toggle('hidden', attachments.length === 0);
  mgrDetailAttachList.innerHTML = attachments.map((a) =>
    `<a class="file" href="${escapeHtml(a.url)}" target="_blank" rel="noopener"><div class="fname"><b>${escapeHtml(a.name || 'Attachment')}</b></div></a>`
  ).join('');

  mgrDetailReplacementWrap.classList.add('hidden'); // replacement lookup is a v2 follow-up, not wired yet

  const awaitingDocs = rec.status === 'pending_documentation';
  mgrDetailAwaitingDocsNotice.classList.toggle('hidden', !awaitingDocs);

  const showDecisionNote = !!(opts.readOnly && rec.decisionNote);
  mgrDetailDecisionNoteWrap.classList.toggle('hidden', !showDecisionNote);
  if (showDecisionNote) mgrDetailDecisionNoteText.textContent = rec.decisionNote;

  mgrDecideRejectExtra.classList.add('hidden');
  mgrDecideNote.value = '';
  mgrDecideAllowReschedule.checked = false;
  mgrDecideConfirmFooter.classList.add('hidden');

  const canDecide = rec.status === 'requested' && !opts.readOnly;
  mgrDetailFooter.classList.toggle('hidden', !canDecide);

  mgrDetailModal.classList.remove('hidden');
}
function closeDetail_() {
  mgrDetailModal.classList.add('hidden');
  currentDetailRecord_ = null;
}
mgrDetailCloseBtn.addEventListener('click', closeDetail_);
mgrDetailBackdrop.addEventListener('click', closeDetail_);
mgrDetailChips.addEventListener('click', (e) => { handleCalPillIconClick_(e, allRequestsCache_); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !mgrDetailModal.classList.contains('hidden')) closeDetail_();
});

mgrApproveBtn.addEventListener('click', () => {
  if (!confirm('Approve this leave request?')) return;
  submitDecision_('approved');
});
mgrRejectBtn.addEventListener('click', () => {
  pendingDecision_ = 'rejected';
  mgrDecideRejectExtra.classList.remove('hidden');
  mgrDetailFooter.classList.add('hidden');
  mgrDecideConfirmFooter.classList.remove('hidden');
});
mgrDecideCancelBtn.addEventListener('click', () => {
  pendingDecision_ = null;
  mgrDecideRejectExtra.classList.add('hidden');
  mgrDetailFooter.classList.remove('hidden');
  mgrDecideConfirmFooter.classList.add('hidden');
});
mgrDecideConfirmBtn.addEventListener('click', () => submitDecision_('rejected'));

async function submitDecision_(decision) {
  if (!currentDetailRecord_) return;
  const requestId = currentDetailRecord_.requestId;
  mgrApproveBtn.disabled = true;
  mgrDecideConfirmBtn.disabled = true;
  try {
    await apiRequest_('PATCH', '/leave-requests/' + encodeURIComponent(requestId) + '/decide', {
      decision,
      note: decision === 'rejected' ? mgrDecideNote.value.trim() : '',
      allowReschedule: decision === 'rejected' ? mgrDecideAllowReschedule.checked : false
    });
    showToast_(decision === 'approved' ? 'Request approved.' : 'Request rejected.', 'success');
    closeDetail_();
    fetchRequests_();
  } catch (err) {
    showErrorToast_(err.message);
  } finally {
    mgrApproveBtn.disabled = false;
    mgrDecideConfirmBtn.disabled = false;
  }
}

// ---------- Archived tab ----------
const mgrArchivedLoading = document.getElementById('mgrArchivedLoading');
const mgrArchivedEmpty = document.getElementById('mgrArchivedEmpty');
const mgrArchivedList = document.getElementById('mgrArchivedList');
const mgrArchivedCount = document.getElementById('mgrArchivedCount');
const mgrArcStatusFilter = document.getElementById('mgrArcStatusFilter');
const mgrArcTypeFilter = document.getElementById('mgrArcTypeFilter');
const mgrArcDeveloperFilter = document.getElementById('mgrArcDeveloperFilter');

let archivedPeriodState_ = makePeriodState_('week');
let arcStatusFilter_ = '';
let arcTypeFilter_ = '';
let arcDeveloperFilter_ = '';

async function fetchArchived_() {
  mgrArchivedLoading.classList.remove('hidden');
  mgrArchivedEmpty.classList.add('hidden');
  mgrArchivedList.innerHTML = '';
  try {
    await Promise.all([fetchAllRequests_(), usersCache_.length ? Promise.resolve() : fetchUsers_()]);
    populateTypeSelect_(mgrArcTypeFilter);
    populateDeveloperSelect_(mgrArcDeveloperFilter);
    renderArchivedList_();
  } catch (err) {
    showErrorToast_('Could not load archive: ' + err.message);
  } finally {
    mgrArchivedLoading.classList.add('hidden');
  }
}

function renderArchivedList_() {
  const filtered = allRequestsCache_
    .filter(isArchived_)
    .filter((r) => passesCommonFilters_(r, arcStatusFilter_, arcTypeFilter_, arcDeveloperFilter_))
    .filter((r) => inPeriod_(archivedPeriodState_, r.resolvedAt || r.requestedAt))
    .sort((a, b) => new Date(b.resolvedAt || b.requestedAt) - new Date(a.resolvedAt || a.requestedAt));

  mgrArchivedCount.textContent = filtered.length ? filtered.length + (filtered.length === 1 ? ' result' : ' results') : '';
  mgrArchivedEmpty.classList.toggle('hidden', filtered.length > 0);
  mgrArchivedList.innerHTML = filtered.map(requestCardHtml_).join('');
}

wirePeriodNav_(
  document.getElementById('mgrArchivedPeriodChips'),
  document.getElementById('mgrArchivedPeriodPrevBtn'),
  document.getElementById('mgrArchivedPeriodNextBtn'),
  document.getElementById('mgrArchivedPeriodLabel'),
  archivedPeriodState_, renderArchivedList_
);
mgrArcStatusFilter.addEventListener('change', () => { arcStatusFilter_ = mgrArcStatusFilter.value; renderArchivedList_(); });
mgrArcTypeFilter.addEventListener('change', () => { arcTypeFilter_ = mgrArcTypeFilter.value; renderArchivedList_(); });
mgrArcDeveloperFilter.addEventListener('change', () => { arcDeveloperFilter_ = mgrArcDeveloperFilter.value; renderArchivedList_(); });
mgrArchivedList.addEventListener('click', (e) => {
  if (handleCalPillIconClick_(e, allRequestsCache_)) return;
  const btn = e.target.closest('[data-request-id]');
  if (!btn) return;
  const rec = allRequestsCache_.find((r) => r.requestId === btn.dataset.requestId);
  if (rec) openDetail_(rec, { readOnly: true });
});

// ---------- Summary tab ----------
const mgrSummaryLoading = document.getElementById('mgrSummaryLoading');
const mgrSummaryBody = document.getElementById('mgrSummaryBody');
const mgrSummaryUpdated = document.getElementById('mgrSummaryUpdated');
const mgrSumKpiTotal = document.getElementById('mgrSumKpiTotal');
const mgrSumKpiApproved = document.getElementById('mgrSumKpiApproved');
const mgrSumKpiRejected = document.getElementById('mgrSumKpiRejected');
const mgrSumKpiPending = document.getElementById('mgrSumKpiPending');
const mgrSumKpiWithdrawn = document.getElementById('mgrSumKpiWithdrawn');
const mgrSumKpiUninformed = document.getElementById('mgrSumKpiUninformed');
const mgrSumByType = document.getElementById('mgrSumByType');
const mgrSumTrendCard = document.getElementById('mgrSumTrendCard');
const mgrSumTrendTitle = document.getElementById('mgrSumTrendTitle');
const mgrSumTrendModeToggle = document.getElementById('mgrSumTrendModeToggle');
const mgrSumTrend = document.getElementById('mgrSumTrend');
const mgrSumLeaderboard = document.getElementById('mgrSumLeaderboard');
const mgrSumDeveloperFilter = document.getElementById('mgrSumDeveloperFilter');

let summaryPeriodState_ = makePeriodState_('year');
let sumDeveloperFilter_ = '';
let summaryRequestsCache_ = [];
let summaryUninformedCache_ = [];
let sumTrendWeekMode_ = false; // only meaningful when summaryPeriodState_.unit === 'quarter'

async function fetchSummary_() {
  mgrSummaryLoading.classList.remove('hidden');
  mgrSummaryBody.classList.add('hidden');
  try {
    const [requests, uninformed] = await Promise.all([
      fetchAllRequests_(),
      apiRequest_('GET', '/uninformed-leaves'),
      usersCache_.length ? Promise.resolve() : fetchUsers_()
    ]);
    populateDeveloperSelect_(mgrSumDeveloperFilter);
    summaryRequestsCache_ = requests;
    summaryUninformedCache_ = uninformed;
    renderSummaryFiltered_();
    mgrSummaryUpdated.textContent = 'Updated just now';
  } catch (err) {
    showErrorToast_('Could not load summary: ' + err.message);
  } finally {
    mgrSummaryLoading.classList.add('hidden');
    mgrSummaryBody.classList.remove('hidden');
  }
}

function renderSummaryFiltered_() {
  const developerFiltered = summaryRequestsCache_.filter((r) => !sumDeveloperFilter_ || r.email === sumDeveloperFilter_);
  const requests = developerFiltered.filter((r) => inPeriod_(summaryPeriodState_, r.requestedAt));
  const uninformed = summaryUninformedCache_
    .filter((r) => inPeriod_(summaryPeriodState_, r.reportedAt))
    .filter((r) => !sumDeveloperFilter_ || r.email === sumDeveloperFilter_);
  renderSummary_(requests, uninformed, developerFiltered);
}

wirePeriodNav_(
  document.getElementById('mgrSummaryPeriodChips'),
  document.getElementById('mgrSummaryPeriodPrevBtn'),
  document.getElementById('mgrSummaryPeriodNextBtn'),
  document.getElementById('mgrSummaryPeriodLabel'),
  summaryPeriodState_, renderSummaryFiltered_
);
mgrSumDeveloperFilter.addEventListener('change', () => { sumDeveloperFilter_ = mgrSumDeveloperFilter.value; renderSummaryFiltered_(); });
mgrSumTrendModeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.mgr-chip');
  if (!btn) return;
  sumTrendWeekMode_ = btn.dataset.trendMode === 'week';
  renderSummaryFiltered_();
});

const TREND_MONTH_LABELS_ = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
// A request's "trend date" is its leave start date (falling back to when it
// was requested) - mirrors the native app's _groupDate(), so a request
// applied in one month for leave starting in another lands in the month the
// leave actually happens.
function trendGroupDate_(r) { return new Date(r.startDate || r.requestedAt); }
function renderTrendBars_(labels, counts) {
  const maxVal = Math.max(1, ...counts);
  mgrSumTrend.innerHTML = labels.map((label, i) => `
    <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
      <div class="text-[10px] font-semibold text-slate-500">${counts[i]}</div>
      <div class="w-full bg-orange-500 rounded-t-md" style="height:${Math.max(4, Math.round((counts[i] / maxVal) * 88))}px"></div>
      <div class="text-[9px] text-slate-400">${escapeHtml(label)}</div>
    </div>
  `).join('');
}
// Trend chart follows the active period pill exactly like the native app:
// Year -> 12 months of that year; Quarter -> its 3 months, or (via the
// Month/Week toggle) its ~13 weeks; Month/Week -> hidden (too little range
// for a trend to mean anything).
function renderSummaryTrend_(allRequests) {
  const unit = summaryPeriodState_.unit;
  const showTrend = unit === 'year' || unit === 'quarter';
  mgrSumTrendCard.classList.toggle('hidden', !showTrend);
  mgrSumTrendModeToggle.classList.toggle('hidden', unit !== 'quarter');
  if (!showTrend) return;
  if (unit !== 'quarter') sumTrendWeekMode_ = false;
  mgrSumTrendModeToggle.querySelectorAll('.mgr-chip').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.trendMode === (sumTrendWeekMode_ ? 'week' : 'month'));
  });

  const { start } = periodBounds_(summaryPeriodState_);

  if (unit === 'quarter' && sumTrendWeekMode_) {
    mgrSumTrendTitle.textContent = 'Weekly trend';
    const labels = [];
    const counts = [];
    for (let i = 0; i < 13; i++) {
      const wStart = new Date(start); wStart.setDate(start.getDate() + i * 7);
      const wEnd = new Date(wStart); wEnd.setDate(wStart.getDate() + 6); wEnd.setHours(23, 59, 59, 999);
      counts.push(allRequests.filter((r) => { const d = trendGroupDate_(r); return d >= wStart && d <= wEnd; }).length);
      labels.push('W' + (i + 1));
    }
    renderTrendBars_(labels, counts);
    return;
  }

  mgrSumTrendTitle.textContent = 'Monthly trend';
  const year = start.getFullYear();
  const monthsInScope = unit === 'quarter'
    ? [0, 1, 2].map((i) => start.getMonth() + i)
    : Array.from({ length: 12 }, (_, i) => i);
  const counts = monthsInScope.map((m) => allRequests.filter((r) => {
    const d = trendGroupDate_(r);
    return d.getFullYear() === year && d.getMonth() === m;
  }).length);
  renderTrendBars_(monthsInScope.map((m) => TREND_MONTH_LABELS_[m]), counts);
}

function renderSummary_(requests, uninformed, allForTrend) {
  const total = requests.length;
  const approved = requests.filter((r) => r.status === 'approved').length;
  const rejected = requests.filter((r) => r.status === 'rejected').length;
  const pending = requests.filter((r) => r.status === 'requested' || r.status === 'pending_documentation').length;
  const withdrawn = requests.filter((r) => r.status === 'withdrawn').length;

  mgrSumKpiTotal.textContent = total;
  mgrSumKpiApproved.textContent = approved;
  mgrSumKpiRejected.textContent = rejected;
  mgrSumKpiPending.textContent = pending;
  mgrSumKpiWithdrawn.textContent = withdrawn;
  mgrSumKpiUninformed.textContent = uninformed.length;

  // By leave type - uninformedAbsence is sourced from the reports list
  // itself (every report ever filed), not the converted leave_requests rows,
  // matching the one deliberate exception the original Kotlin app made here.
  const typeCounts = {};
  requests.filter((r) => r.type !== 'uninformedAbsence').forEach((r) => {
    typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
  });
  if (uninformed.length) typeCounts.uninformedAbsence = uninformed.length;
  const maxType = Math.max(1, ...Object.values(typeCounts));
  const typeEntries = Object.entries(typeCounts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  mgrSumByType.innerHTML = typeEntries.length ? typeEntries.map(([type, count]) => `
      <div>
        <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>${escapeHtml(leaveTypeLabel_(type))}</span>
          <span class="font-semibold">${count}</span>
        </div>
        <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full" style="width:${Math.round((count / maxType) * 100)}%;background:var(${leaveTypeBarColorVar_(type)})"></div>
        </div>
      </div>
    `).join('') : '<div class="text-sm text-slate-400 text-center py-4">No data yet.</div>';

  renderSummaryTrend_(allForTrend || requests);

  // Leaderboard - within the currently selected period/developer filter
  const byEmail = {};
  requests.forEach((r) => {
    if (!byEmail[r.email]) byEmail[r.email] = { name: r.name, email: r.email, count: 0 };
    byEmail[r.email].count++;
  });
  const top = Object.values(byEmail).sort((a, b) => b.count - a.count).slice(0, 5);
  mgrSumLeaderboard.innerHTML = top.length ? top.map((p, i) => `
        <div class="flex items-center justify-between text-sm">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center shrink-0">${i + 1}</span>
            ${avatarHtml_(p.name, p.email, 28)}
            <span class="truncate text-slate-700">${escapeHtml(p.name)}</span>
          </div>
          <span class="font-semibold text-slate-800">${p.count}</span>
        </div>
      `).join('') : '<div class="text-sm text-slate-400 text-center py-4">No requests in this period.</div>';
}

// ---------- Report tab ----------
const mgrReportLoading = document.getElementById('mgrReportLoading');
const mgrReportBody = document.getElementById('mgrReportBody');
const mgrReportDecisionEmpty = document.getElementById('mgrReportDecisionEmpty');
const mgrReportDecisionList = document.getElementById('mgrReportDecisionList');
const mgrReportOpenEmpty = document.getElementById('mgrReportOpenEmpty');
const mgrReportOpenList = document.getElementById('mgrReportOpenList');
const mgrReportResolvedEmpty = document.getElementById('mgrReportResolvedEmpty');
const mgrReportResolvedList = document.getElementById('mgrReportResolvedList');
const mgrLateNoticeEmpty = document.getElementById('mgrLateNoticeEmpty');
const mgrLateNoticeList = document.getElementById('mgrLateNoticeList');
const mgrNewReportBtn = document.getElementById('mgrNewReportBtn');
const mgrNewReportModal = document.getElementById('mgrNewReportModal');
const mgrNewReportBackdrop = document.getElementById('mgrNewReportBackdrop');
const mgrNewReportCloseBtn = document.getElementById('mgrNewReportCloseBtn');
const mgrNewReportForm = document.getElementById('mgrNewReportForm');
const mgrNewReportEmail = document.getElementById('mgrNewReportEmail');
const mgrNewReportDate = document.getElementById('mgrNewReportDate');
const mgrNewReportReason = document.getElementById('mgrNewReportReason');
const mgrNewReportSubmitBtn = document.getElementById('mgrNewReportSubmitBtn');
const mgrReportDecideModal = document.getElementById('mgrReportDecideModal');
const mgrReportDecideBackdrop = document.getElementById('mgrReportDecideBackdrop');
const mgrReportDecideCloseBtn = document.getElementById('mgrReportDecideCloseBtn');
const mgrReportDecideName = document.getElementById('mgrReportDecideName');
const mgrReportDecideMeta = document.getElementById('mgrReportDecideMeta');
const mgrReportDecideReason = document.getElementById('mgrReportDecideReason');
const mgrReportDecideExplanation = document.getElementById('mgrReportDecideExplanation');
const mgrReportDecideNote = document.getElementById('mgrReportDecideNote');
const mgrReportDecideRejectBtn = document.getElementById('mgrReportDecideRejectBtn');
const mgrReportDecideAcceptBtn = document.getElementById('mgrReportDecideAcceptBtn');
const mgrReportDeveloperFilter = document.getElementById('mgrReportDeveloperFilter');
let reportDeveloperFilter_ = '';

let usersCache_ = [];
async function fetchUsers_() {
  usersCache_ = await apiRequest_('GET', '/users');
  return usersCache_;
}

let uninformedCache_ = [];
let lateNoticesCache_ = [];

async function fetchReportTab_() {
  mgrReportLoading.classList.remove('hidden');
  mgrReportBody.classList.add('hidden');
  try {
    const [uninformed, notices] = await Promise.all([
      apiRequest_('GET', '/uninformed-leaves'),
      apiRequest_('GET', '/late-arrival-notices'),
      usersCache_.length ? Promise.resolve() : fetchUsers_()
    ]);
    populateDeveloperSelect_(mgrReportDeveloperFilter);
    uninformedCache_ = uninformed;
    lateNoticesCache_ = notices;
    renderReportTab_();
  } catch (err) {
    showErrorToast_('Could not load reports: ' + err.message);
  } finally {
    mgrReportLoading.classList.add('hidden');
    mgrReportBody.classList.remove('hidden');
  }
}

function reportCard_(r, kind) {
  const badge = kind === 'decision'
    ? pill_('Explained', 'lv-requested', true)
    : kind === 'open' ? pill_('Awaiting Explanation', 'lv-withdrawn', true) : pill_('Resolved', 'lv-approved', true);
  const rawBodyHtml = kind === 'decision' ? r.explanationHtml : kind === 'open' ? r.reasonHtml : r.resolutionHtml;
  const bodyHtml = rawBodyHtml && rawBodyHtml.trim() ? sanitizeStoredRichTextHtml_(rawBodyHtml) : rawBodyHtml;
  const isDecision = kind === 'decision';
  const resolvedLine = kind === 'resolved' && r.resolvedAt
    ? `<div class="text-xs text-slate-400 mt-0.5">Resolved ${escapeHtml(fmtDateTime_(r.resolvedAt))}</div>`
    : '';
  return `
    <${isDecision ? 'button type="button"' : 'div'} ${isDecision ? `data-report-id="${escapeHtml(r.reportId)}"` : ''} class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 ${isDecision ? 'hover:ring-orange-300 transition' : ''} p-3.5 block">
      <div class="flex items-start gap-3">
        ${avatarHtml_(r.name, r.email)}
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(r.name)}</div>
              <div class="text-xs text-slate-500">${escapeHtml(fmtDate_(r.date))}</div>
              ${resolvedLine}
            </div>
            <div class="shrink-0">${badge}</div>
          </div>
          ${bodyHtml && bodyHtml.trim() ? `<div class="rich-text text-xs text-slate-600 mt-2">${bodyHtml}</div>` : ''}
        </div>
      </div>
    </${isDecision ? 'button' : 'div'}>
  `;
}

function lateNoticeCard_(n) {
  const ack = n.status === 'acknowledged';
  return `
    <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 p-3.5">
      <div class="flex items-start gap-3">
        ${avatarHtml_(n.name, n.email)}
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(n.name)}</div>
              <div class="text-xs text-slate-500">${escapeHtml(fmtDate_(n.date))}${n.expectedArrivalTime ? ' · ETA ' + escapeHtml(n.expectedArrivalTime) : ''}</div>
            </div>
            ${ack ? pill_('Acknowledged', 'lv-approved', true) : `<button type="button" data-ack-notice-id="${escapeHtml(n.id)}" class="text-xs font-semibold text-orange-700 hover:text-orange-800 shrink-0">Acknowledge</button>`}
          </div>
          ${n.reasonHtml && n.reasonHtml.trim() ? `<div class="rich-text text-xs text-slate-600 mt-2">${sanitizeStoredRichTextHtml_(n.reasonHtml)}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

function passesDeveloperFilter_(r) { return !reportDeveloperFilter_ || r.email === reportDeveloperFilter_; }

function renderReportTab_() {
  const decision = uninformedCache_.filter((r) => r.status === 'explained' && passesDeveloperFilter_(r)).sort((a, b) => new Date(a.explainedAt) - new Date(b.explainedAt));
  const open = uninformedCache_.filter((r) => r.status === 'reported' && passesDeveloperFilter_(r)).sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
  const resolved = uninformedCache_.filter((r) => r.status === 'resolved' && passesDeveloperFilter_(r)).sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));

  mgrReportDecisionEmpty.classList.toggle('hidden', decision.length > 0);
  mgrReportDecisionList.innerHTML = decision.map((r) => reportCard_(r, 'decision')).join('');
  mgrReportOpenEmpty.classList.toggle('hidden', open.length > 0);
  mgrReportOpenList.innerHTML = open.map((r) => reportCard_(r, 'open')).join('');
  mgrReportResolvedEmpty.classList.toggle('hidden', resolved.length > 0);
  mgrReportResolvedList.innerHTML = resolved.map((r) => reportCard_(r, 'resolved')).join('');

  const notices = lateNoticesCache_.filter(passesDeveloperFilter_).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  mgrLateNoticeEmpty.classList.toggle('hidden', notices.length > 0);
  mgrLateNoticeList.innerHTML = notices.map(lateNoticeCard_).join('');
}
mgrReportDeveloperFilter.addEventListener('change', () => { reportDeveloperFilter_ = mgrReportDeveloperFilter.value; renderReportTab_(); });

mgrReportBody.addEventListener('click', (e) => {
  const ackBtn = e.target.closest('[data-ack-notice-id]');
  if (ackBtn) { acknowledgeLateNotice_(ackBtn.dataset.ackNoticeId); return; }
  const reportBtn = e.target.closest('[data-report-id]');
  if (reportBtn) {
    const rec = uninformedCache_.find((r) => r.reportId === reportBtn.dataset.reportId);
    if (rec) openReportDecide_(rec);
  }
});

async function acknowledgeLateNotice_(id) {
  try {
    await apiRequest_('PATCH', '/late-arrival-notices/' + encodeURIComponent(id) + '/acknowledge');
    showToast_('Notice acknowledged.', 'success');
    fetchReportTab_();
  } catch (err) {
    showErrorToast_(err.message);
  }
}

let currentReportRecord_ = null;

function openReportDecide_(rec) {
  currentReportRecord_ = rec;
  mgrReportDecideName.textContent = rec.name;
  mgrReportDecideMeta.textContent = fmtDate_(rec.date);
  mgrReportDecideReason.innerHTML = rec.reasonHtml && rec.reasonHtml.trim() ? sanitizeStoredRichTextHtml_(rec.reasonHtml) : '<i class="text-slate-400">No reason given.</i>';
  mgrReportDecideExplanation.innerHTML = rec.explanationHtml && rec.explanationHtml.trim() ? sanitizeStoredRichTextHtml_(rec.explanationHtml) : '<i class="text-slate-400">No explanation given.</i>';
  mgrReportDecideNote.value = '';
  mgrReportDecideModal.classList.remove('hidden');
}
function closeReportDecide_() {
  mgrReportDecideModal.classList.add('hidden');
  currentReportRecord_ = null;
}
mgrReportDecideCloseBtn.addEventListener('click', closeReportDecide_);
mgrReportDecideBackdrop.addEventListener('click', closeReportDecide_);

async function submitReportDecision_(kind) {
  if (!currentReportRecord_) return;
  mgrReportDecideAcceptBtn.disabled = true;
  mgrReportDecideRejectBtn.disabled = true;
  const note = escapeHtml(mgrReportDecideNote.value.trim());
  try {
    if (kind === 'accept') {
      await apiRequest_('PATCH', '/uninformed-leaves/' + encodeURIComponent(currentReportRecord_.reportId) + '/accept', { resolutionHtml: note });
      showToast_('Report resolved - converted into an approved leave.', 'success');
    } else {
      await apiRequest_('PATCH', '/uninformed-leaves/' + encodeURIComponent(currentReportRecord_.reportId) + '/reject', { rejectionNote: note });
      showToast_('Sent back to the requester for another explanation.', 'success');
    }
    closeReportDecide_();
    fetchReportTab_();
  } catch (err) {
    showErrorToast_(err.message);
  } finally {
    mgrReportDecideAcceptBtn.disabled = false;
    mgrReportDecideRejectBtn.disabled = false;
  }
}
mgrReportDecideAcceptBtn.addEventListener('click', () => submitReportDecision_('accept'));
mgrReportDecideRejectBtn.addEventListener('click', () => submitReportDecision_('reject'));

mgrNewReportBtn.addEventListener('click', openNewReportModal_);
mgrNewReportCloseBtn.addEventListener('click', closeNewReportModal_);
mgrNewReportBackdrop.addEventListener('click', closeNewReportModal_);

async function openNewReportModal_() {
  mgrNewReportForm.reset();
  mgrNewReportDate.value = new Date().toISOString().slice(0, 10);
  try {
    if (!usersCache_.length) await fetchUsers_();
    const devs = usersCache_.filter((u) => u.active && !u.isOwner);
    mgrNewReportEmail.innerHTML = devs.map((u) => `<option value="${escapeHtml(u.email)}">${escapeHtml(u.name)}</option>`).join('');
  } catch (err) {
    showErrorToast_('Could not load team list: ' + err.message);
  }
  mgrNewReportModal.classList.remove('hidden');
}
function closeNewReportModal_() { mgrNewReportModal.classList.add('hidden'); }

mgrNewReportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = mgrNewReportEmail.value;
  const user = usersCache_.find((u) => u.email === email);
  mgrNewReportSubmitBtn.disabled = true;
  try {
    await apiRequest_('POST', '/uninformed-leaves', {
      email,
      name: user ? user.name : '',
      date: mgrNewReportDate.value,
      reasonHtml: '<p>' + escapeHtml(mgrNewReportReason.value.trim()) + '</p>'
    });
    showToast_('Report filed.', 'success');
    closeNewReportModal_();
    fetchReportTab_();
  } catch (err) {
    showErrorToast_(err.message);
  } finally {
    mgrNewReportSubmitBtn.disabled = false;
  }
});

// ---------- Team tab: Directory ----------
const mgrTeamDirectoryList = document.getElementById('mgrTeamDirectoryList');
const mgrTeamDirectorySub = document.getElementById('mgrTeamDirectorySub');
const mgrTeamAttendanceSub = document.getElementById('mgrTeamAttendanceSub');
const mgrTeamStatsSub = document.getElementById('mgrTeamStatsSub');
const TEAM_SUBS_ = { directory: mgrTeamDirectorySub, attendance: mgrTeamAttendanceSub, stats: mgrTeamStatsSub };

wireChipGroup_(document.getElementById('mgrTeamSubTabs'), 'teamSub', (val) => {
  teamActiveSub_ = val;
  Object.keys(TEAM_SUBS_).forEach((key) => TEAM_SUBS_[key].classList.toggle('hidden', key !== val));
  if (val === 'directory') fetchTeamDirectory_();
  else if (val === 'attendance') fetchAttendanceRoster_();
  else fetchStats_();
});

async function fetchTeamDirectory_() {
  mgrTeamDirectoryList.innerHTML = '<div class="flex flex-col items-center justify-center py-12 gap-3"><span class="loader"></span></div>';
  try {
    await fetchUsers_();
    renderTeamDirectory_();
  } catch (err) {
    showErrorToast_('Could not load team: ' + err.message);
  }
}
function renderTeamDirectory_() {
  const filtered = usersCache_.filter((u) => matchesSearch_([u.name, u.email, u.designation]));
  if (!filtered.length) {
    mgrTeamDirectoryList.innerHTML = '<div class="text-center py-12 text-sm text-slate-400">No matches.</div>';
    return;
  }
  mgrTeamDirectoryList.innerHTML = filtered.map((u) => `
    <button type="button" class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 hover:ring-orange-300 transition p-3.5" data-user-email="${escapeHtml(u.email)}">
      <div class="flex items-start gap-3">
        ${avatarHtml_(u.name, u.email)}
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(u.name)}${!u.active ? ' <span class="text-[10px] text-slate-400 font-normal">(inactive)</span>' : ''}</div>
              <div class="text-xs text-slate-500 truncate">${escapeHtml(u.email)}</div>
            </div>
            ${u.isOwner ? '<span class="mgr-pill lv-withdrawn is-status shrink-0">Manager</span>' : ''}
          </div>
          ${u.designation ? `<div class="text-xs text-slate-500 mt-0.5 truncate">${escapeHtml(u.designation)}</div>` : ''}
        </div>
      </div>
    </button>
  `).join('');
}
mgrTeamDirectoryList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-user-email]');
  if (!btn) return;
  const user = usersCache_.find((u) => u.email === btn.dataset.userEmail);
  if (user) openUserDetail_(user);
});

// ---------- Team tab: user detail/edit sheet ----------
const mgrUserDetailModal = document.getElementById('mgrUserDetailModal');
const mgrUserDetailBackdrop = document.getElementById('mgrUserDetailBackdrop');
const mgrUserDetailCloseBtn = document.getElementById('mgrUserDetailCloseBtn');
const mgrUserDetailName = document.getElementById('mgrUserDetailName');
const mgrUserDetailEmail = document.getElementById('mgrUserDetailEmail');
const mgrUserViewMode = document.getElementById('mgrUserViewMode');
const mgrUserViewDesignation = document.getElementById('mgrUserViewDesignation');
const mgrUserViewReportedTo = document.getElementById('mgrUserViewReportedTo');
const mgrUserViewDomain = document.getElementById('mgrUserViewDomain');
const mgrUserViewIsOwner = document.getElementById('mgrUserViewIsOwner');
const mgrUserViewActive = document.getElementById('mgrUserViewActive');
const mgrUserEditToggleBtn = document.getElementById('mgrUserEditToggleBtn');
const mgrUserEditMode = document.getElementById('mgrUserEditMode');
const mgrUserEditName = document.getElementById('mgrUserEditName');
const mgrUserEditDesignation = document.getElementById('mgrUserEditDesignation');
const mgrUserEditReportedTo = document.getElementById('mgrUserEditReportedTo');
const mgrUserEditDomain = document.getElementById('mgrUserEditDomain');
const mgrUserEditIsOwner = document.getElementById('mgrUserEditIsOwner');
const mgrUserEditActive = document.getElementById('mgrUserEditActive');
const mgrUserEditSelfNote = document.getElementById('mgrUserEditSelfNote');
const mgrUserEditCancelBtn = document.getElementById('mgrUserEditCancelBtn');
const mgrUserEditSaveBtn = document.getElementById('mgrUserEditSaveBtn');

let currentUserRecord_ = null;

function openUserDetail_(user) {
  currentUserRecord_ = user;
  mgrUserDetailName.textContent = user.name;
  mgrUserDetailEmail.textContent = user.email;
  mgrUserViewDesignation.textContent = user.designation || '—';
  mgrUserViewReportedTo.textContent = user.reportedTo || '—';
  mgrUserViewDomain.textContent = user.domain || '—';
  mgrUserViewIsOwner.textContent = user.isOwner ? 'Yes' : 'No';
  mgrUserViewActive.textContent = user.active ? 'Yes' : 'No';
  mgrUserViewMode.classList.remove('hidden');
  mgrUserEditMode.classList.add('hidden');
  mgrUserDetailModal.classList.remove('hidden');
}
function closeUserDetail_() {
  mgrUserDetailModal.classList.add('hidden');
  currentUserRecord_ = null;
}
mgrUserDetailCloseBtn.addEventListener('click', closeUserDetail_);
mgrUserDetailBackdrop.addEventListener('click', closeUserDetail_);

mgrUserEditToggleBtn.addEventListener('click', () => {
  if (!currentUserRecord_) return;
  const isSelf = currentUserRecord_.email === currentManager.email;
  mgrUserEditName.value = currentUserRecord_.name || '';
  mgrUserEditDesignation.value = currentUserRecord_.designation || '';
  mgrUserEditReportedTo.value = currentUserRecord_.reportedTo || '';
  mgrUserEditDomain.value = currentUserRecord_.domain || '';
  mgrUserEditIsOwner.checked = !!currentUserRecord_.isOwner;
  mgrUserEditActive.checked = !!currentUserRecord_.active;
  mgrUserEditIsOwner.disabled = isSelf;
  mgrUserEditActive.disabled = isSelf;
  mgrUserEditSelfNote.classList.toggle('hidden', !isSelf);
  mgrUserViewMode.classList.add('hidden');
  mgrUserEditMode.classList.remove('hidden');
});
mgrUserEditCancelBtn.addEventListener('click', () => {
  mgrUserEditMode.classList.add('hidden');
  mgrUserViewMode.classList.remove('hidden');
});
mgrUserEditSaveBtn.addEventListener('click', async () => {
  if (!currentUserRecord_) return;
  mgrUserEditSaveBtn.disabled = true;
  try {
    const body = {
      name: mgrUserEditName.value.trim(),
      designation: mgrUserEditDesignation.value.trim(),
      reportedTo: mgrUserEditReportedTo.value.trim(),
      domain: mgrUserEditDomain.value.trim(),
      isOwner: mgrUserEditIsOwner.disabled ? currentUserRecord_.isOwner : mgrUserEditIsOwner.checked,
      active: mgrUserEditActive.disabled ? currentUserRecord_.active : mgrUserEditActive.checked
    };
    const updated = await apiRequest_('PATCH', '/users/' + encodeURIComponent(currentUserRecord_.email), body);
    const idx = usersCache_.findIndex((u) => u.email === updated.email);
    if (idx !== -1) usersCache_[idx] = updated;
    if (currentManager && currentManager.email === updated.email) currentManager = { ...currentManager, ...updated };
    showToast_('Profile updated.', 'success');
    closeUserDetail_();
    renderTeamDirectory_();
  } catch (err) {
    showErrorToast_(err.message);
  } finally {
    mgrUserEditSaveBtn.disabled = false;
  }
});

// ---------- Team tab: Attendance ----------
const mgrAttPrevDayBtn = document.getElementById('mgrAttPrevDayBtn');
const mgrAttDateInput = document.getElementById('mgrAttDateInput');
const mgrAttNextDayBtn = document.getElementById('mgrAttNextDayBtn');
const mgrAttLoading = document.getElementById('mgrAttLoading');
const mgrAttList = document.getElementById('mgrAttList');
const mgrAttMarkModal = document.getElementById('mgrAttMarkModal');
const mgrAttMarkBackdrop = document.getElementById('mgrAttMarkBackdrop');
const mgrAttMarkCloseBtn = document.getElementById('mgrAttMarkCloseBtn');
const mgrAttMarkName = document.getElementById('mgrAttMarkName');
const mgrAttMarkDate = document.getElementById('mgrAttMarkDate');
const mgrAttOnLeaveNotice = document.getElementById('mgrAttOnLeaveNotice');
const mgrAttMarkForm = document.getElementById('mgrAttMarkForm');
const mgrAttArrivalTimeWrap = document.getElementById('mgrAttArrivalTimeWrap');
const mgrAttArrivalTime = document.getElementById('mgrAttArrivalTime');
const mgrAttOnDutyRangeWrap = document.getElementById('mgrAttOnDutyRangeWrap');
const mgrAttOnDutyStart = document.getElementById('mgrAttOnDutyStart');
const mgrAttOnDutyEnd = document.getElementById('mgrAttOnDutyEnd');
const mgrAttNote = document.getElementById('mgrAttNote');
const mgrAttMarkSaveBtn = document.getElementById('mgrAttMarkSaveBtn');

let attSelectedDate_ = new Date().toISOString().slice(0, 10);
let attRecordsCache_ = [];

const ATT_STATUS_LABELS_ = {
  present: 'Present', absent: 'Absent', late: 'Late', night_duty: 'Night Duty',
  on_duty: 'On Duty', on_leave: 'On Leave', unmarked: 'Unmarked'
};
// Exact-Flutter attendance colors - see team_providers.dart's
// AttendanceStatus.foreground/background getters.
const ATT_STATUS_PILL_CLASS_ = {
  present: 'att-present', late: 'att-late', absent: 'att-absent', night_duty: 'att-nightduty',
  on_duty: 'att-onduty', on_leave: 'att-onleave', unmarked: 'att-unmarked'
};
function attStatusTag_(status) {
  return pill_(ATT_STATUS_LABELS_[status] || status, ATT_STATUS_PILL_CLASS_[status] || 'att-unmarked', true);
}
// Manual mark always wins over a derived On Leave day - mirrors the mobile
// app's resolveAttendanceStatus() precedence exactly.
function resolveAttendanceStatus_(email, dateStr) {
  const manual = attRecordsCache_.find((a) => a.email === email);
  if (manual) return { status: manual.status, note: manual.note, arrivalTime: manual.arrivalTime };
  if (allRequestsCache_.some((r) => r.email === email && isApprovedLeaveOnDate_(r, dateStr))) return { status: 'on_leave' };
  return { status: 'unmarked' };
}

async function fetchAttendanceRoster_() {
  mgrAttLoading.classList.remove('hidden');
  mgrAttList.classList.add('hidden');
  mgrAttDateInput.value = attSelectedDate_;
  try {
    const [attendance] = await Promise.all([
      apiRequest_('GET', '/attendance?start=' + attSelectedDate_ + '&end=' + attSelectedDate_),
      usersCache_.length ? Promise.resolve() : fetchUsers_(),
      allRequestsCache_.length ? Promise.resolve() : fetchAllRequests_()
    ]);
    attRecordsCache_ = attendance;
    renderAttendanceRoster_();
  } catch (err) {
    showErrorToast_('Could not load attendance: ' + err.message);
  } finally {
    mgrAttLoading.classList.add('hidden');
    mgrAttList.classList.remove('hidden');
  }
}
function renderAttendanceRoster_() {
  const roster = usersCache_.filter((u) => u.active && !u.isOwner);
  mgrAttList.innerHTML = roster.length ? roster.map((u) => {
    const st = resolveAttendanceStatus_(u.email, attSelectedDate_);
    return `
      <button type="button" class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 hover:ring-orange-300 transition p-3.5" data-att-email="${escapeHtml(u.email)}">
        <div class="flex items-center gap-3">
          ${avatarHtml_(u.name, u.email)}
          <div class="min-w-0 flex-1 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(u.name)}</div>
              <div class="text-xs text-slate-500 truncate">${escapeHtml(u.email)}</div>
            </div>
            <div class="shrink-0">${attStatusTag_(st.status)}</div>
          </div>
        </div>
      </button>
    `;
  }).join('') : '<div class="text-center py-12 text-sm text-slate-400">No team members yet.</div>';
}
mgrAttDateInput.addEventListener('change', () => { attSelectedDate_ = mgrAttDateInput.value; fetchAttendanceRoster_(); });
function shiftAttDate_(deltaDays) {
  const d = new Date(attSelectedDate_ + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  attSelectedDate_ = d.toISOString().slice(0, 10);
  fetchAttendanceRoster_();
}
mgrAttPrevDayBtn.addEventListener('click', () => shiftAttDate_(-1));
mgrAttNextDayBtn.addEventListener('click', () => shiftAttDate_(1));
mgrAttList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-att-email]');
  if (!btn) return;
  const user = usersCache_.find((u) => u.email === btn.dataset.attEmail);
  if (user) openAttMark_(user);
});

let attMarkUser_ = null;
let attMarkSelectedStatus_ = null;

// Selecting an option highlights it in that status's own color (matching
// the pill it'll render as on the roster) rather than a generic orange -
// "unmark" borrows the rejected/red family as a destructive-action cue.
const ATT_OPT_ACTIVE_CLASS_ = {
  present: 'att-present', late: 'att-late', absent: 'att-absent',
  night_duty: 'att-nightduty', on_duty: 'att-onduty', unmark: 'att-rejected'
};
function selectAttOption_(status) {
  attMarkSelectedStatus_ = status;
  document.querySelectorAll('.mgr-att-opt').forEach((b) => {
    const active = b.dataset.attStatus === status;
    b.classList.toggle('is-active', active);
    Object.values(ATT_OPT_ACTIVE_CLASS_).forEach((c) => b.classList.remove(c));
    if (active) b.classList.add(ATT_OPT_ACTIVE_CLASS_[status]);
  });
  mgrAttArrivalTimeWrap.classList.toggle('hidden', status !== 'late');
  mgrAttOnDutyRangeWrap.classList.toggle('hidden', status !== 'on_duty');
  mgrAttMarkSaveBtn.disabled = false;
  mgrAttMarkSaveBtn.textContent = status === 'unmark' ? 'Remove mark' : 'Save';
}
document.querySelectorAll('.mgr-att-opt').forEach((btn) => btn.addEventListener('click', () => selectAttOption_(btn.dataset.attStatus)));

function openAttMark_(user) {
  attMarkUser_ = user;
  attMarkSelectedStatus_ = null;
  mgrAttMarkName.textContent = user.name;
  mgrAttMarkDate.textContent = fmtDate_(attSelectedDate_);
  const st = resolveAttendanceStatus_(user.email, attSelectedDate_);
  const onLeave = st.status === 'on_leave';
  mgrAttOnLeaveNotice.classList.toggle('hidden', !onLeave);
  mgrAttMarkForm.classList.toggle('hidden', onLeave);
  mgrAttArrivalTimeWrap.classList.add('hidden');
  mgrAttOnDutyRangeWrap.classList.add('hidden');
  mgrAttNote.value = st.note || '';
  mgrAttArrivalTime.value = st.arrivalTime || '';
  mgrAttOnDutyStart.value = attSelectedDate_;
  mgrAttOnDutyEnd.value = attSelectedDate_;
  document.querySelectorAll('.mgr-att-opt').forEach((b) => b.classList.remove('is-active', 'att-present', 'att-late', 'att-absent', 'att-nightduty', 'att-onduty', 'att-rejected'));
  mgrAttMarkSaveBtn.disabled = true;
  mgrAttMarkSaveBtn.textContent = 'Select a status';
  if (st.status !== 'unmarked' && st.status !== 'on_leave') selectAttOption_(st.status);
  mgrAttMarkModal.classList.remove('hidden');
}
function closeAttMark_() {
  mgrAttMarkModal.classList.add('hidden');
  attMarkUser_ = null;
}
mgrAttMarkCloseBtn.addEventListener('click', closeAttMark_);
mgrAttMarkBackdrop.addEventListener('click', closeAttMark_);

mgrAttMarkSaveBtn.addEventListener('click', async () => {
  if (!attMarkUser_ || !attMarkSelectedStatus_) return;
  mgrAttMarkSaveBtn.disabled = true;
  try {
    if (attMarkSelectedStatus_ === 'unmark') {
      await apiRequest_('DELETE', '/attendance/' + encodeURIComponent(attMarkUser_.email) + '/' + attSelectedDate_);
    } else if (attMarkSelectedStatus_ === 'on_duty' && mgrAttOnDutyStart.value !== mgrAttOnDutyEnd.value) {
      const result = await apiRequest_('PUT', '/attendance/' + encodeURIComponent(attMarkUser_.email) + '/range', {
        startDate: mgrAttOnDutyStart.value, endDate: mgrAttOnDutyEnd.value, status: 'on_duty', note: mgrAttNote.value.trim()
      });
      if (result.skipped && result.skipped.length) {
        showToast_(result.marked.length + ' marked, ' + result.skipped.length + ' already on leave.', 'warning');
      }
    } else {
      await apiRequest_('PUT', '/attendance/' + encodeURIComponent(attMarkUser_.email) + '/' + attSelectedDate_, {
        status: attMarkSelectedStatus_,
        note: mgrAttNote.value.trim(),
        arrivalTime: attMarkSelectedStatus_ === 'late' ? mgrAttArrivalTime.value : undefined
      });
    }
    showToast_('Attendance updated.', 'success');
    closeAttMark_();
    fetchAttendanceRoster_();
  } catch (err) {
    showErrorToast_(err.message);
  } finally {
    mgrAttMarkSaveBtn.disabled = false;
  }
});

// ---------- Team tab: Stats ----------
const mgrStatsLoading = document.getElementById('mgrStatsLoading');
const mgrStatsBody = document.getElementById('mgrStatsBody');
const mgrStatsKpiPresent = document.getElementById('mgrStatsKpiPresent');
const mgrStatsKpiLate = document.getElementById('mgrStatsKpiLate');
const mgrStatsKpiAbsent = document.getElementById('mgrStatsKpiAbsent');
const mgrStatsKpiNightDuty = document.getElementById('mgrStatsKpiNightDuty');
const mgrStatsKpiOnDuty = document.getElementById('mgrStatsKpiOnDuty');
const mgrStatsKpiOnLeave = document.getElementById('mgrStatsKpiOnLeave');
const mgrStatsBreakdown = document.getElementById('mgrStatsBreakdown');
const mgrStatsByPerson = document.getElementById('mgrStatsByPerson');

const mgrStatsDeveloperFilter = document.getElementById('mgrStatsDeveloperFilter');
let statsPeriodState_ = makePeriodState_('year');
let statsDeveloperFilter_ = '';

wirePeriodNav_(
  document.getElementById('mgrStatsPeriodChips'),
  document.getElementById('mgrStatsPeriodPrevBtn'),
  document.getElementById('mgrStatsPeriodNextBtn'),
  document.getElementById('mgrStatsPeriodLabel'),
  statsPeriodState_, fetchStats_
);
mgrStatsDeveloperFilter.addEventListener('change', () => { statsDeveloperFilter_ = mgrStatsDeveloperFilter.value; fetchStats_(); });

function eachDate_(startStr, endStr) {
  const days = [];
  const cur = new Date(startStr + 'T00:00:00Z');
  const end = new Date(endStr + 'T00:00:00Z');
  while (cur <= end) { days.push(cur.toISOString().slice(0, 10)); cur.setUTCDate(cur.getUTCDate() + 1); }
  return days;
}

async function fetchStats_() {
  mgrStatsLoading.classList.remove('hidden');
  mgrStatsBody.classList.add('hidden');
  try {
    if (!usersCache_.length) await fetchUsers_();
    populateDeveloperSelect_(mgrStatsDeveloperFilter, 'Whole team');
    const { start, end } = periodBounds_(statsPeriodState_);
    const startStr = isoDate_(start), endStr = isoDate_(end);
    const [attendance] = await Promise.all([
      apiRequest_('GET', '/attendance?start=' + startStr + '&end=' + endStr),
      allRequestsCache_.length ? Promise.resolve() : fetchAllRequests_()
    ]);
    renderStats_(attendance, startStr, endStr);
  } catch (err) {
    showErrorToast_('Could not load stats: ' + err.message);
  } finally {
    mgrStatsLoading.classList.add('hidden');
    mgrStatsBody.classList.remove('hidden');
  }
}
function renderStats_(attendance, start, end) {
  const roster = usersCache_.filter((u) => u.active && !u.isOwner && (!statsDeveloperFilter_ || u.email === statsDeveloperFilter_));
  const days = eachDate_(start, end);
  const counts = { present: 0, late: 0, absent: 0, night_duty: 0, on_duty: 0, on_leave: 0 };
  const perPerson = {};
  roster.forEach((u) => { perPerson[u.email] = { name: u.name, marked: 0, present: 0 }; });

  roster.forEach((u) => {
    days.forEach((day) => {
      const manual = attendance.find((a) => a.email === u.email && a.date === day);
      let status = null;
      if (manual) status = manual.status;
      else if (allRequestsCache_.some((r) => r.email === u.email && isApprovedLeaveOnDate_(r, day))) status = 'on_leave';
      if (!status) return; // unmarked - excluded from stats entirely
      counts[status] = (counts[status] || 0) + 1;
      if (status !== 'on_leave') {
        perPerson[u.email].marked++;
        if (status === 'present' || status === 'night_duty' || status === 'on_duty') perPerson[u.email].present++;
      }
    });
  });

  // Percentage base includes On Leave (only truly unmarked days are
  // excluded) - matches the Flutter Stats screen's 6-way breakdown, where
  // every marked-or-on-leave day accounts for exactly one slice.
  const totalAll = counts.present + counts.late + counts.absent + counts.night_duty + counts.on_duty + counts.on_leave;
  const pct = (n) => totalAll ? Math.round((n / totalAll) * 100) : 0;
  mgrStatsKpiPresent.textContent = pct(counts.present) + '%';
  mgrStatsKpiLate.textContent = pct(counts.late) + '%';
  mgrStatsKpiAbsent.textContent = pct(counts.absent) + '%';
  mgrStatsKpiNightDuty.textContent = pct(counts.night_duty) + '%';
  mgrStatsKpiOnDuty.textContent = pct(counts.on_duty) + '%';
  mgrStatsKpiOnLeave.textContent = pct(counts.on_leave) + '%';

  const BREAKDOWN_ROWS_ = [
    ['present', 'Present', '--lv-approved'], ['late', 'Late', '--lv-requested'], ['absent', 'Absent', '--lv-rejected'],
    ['night_duty', 'Night Duty', '--lv-type-foreign'], ['on_duty', 'On Duty', '--lv-type-umrah'], ['on_leave', 'On Leave', '--lv-meta']
  ];
  const maxCount = Math.max(1, ...BREAKDOWN_ROWS_.map(([key]) => counts[key]));
  mgrStatsBreakdown.innerHTML = BREAKDOWN_ROWS_.map(([key, label, colorVar]) => `
    <div>
      <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span>${label}</span>
        <span class="font-semibold">${counts[key]}</span>
      </div>
      <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div class="h-full rounded-full" style="width:${Math.round((counts[key] / maxCount) * 100)}%;background:var(${colorVar})"></div>
      </div>
    </div>
  `).join('');

  const rows = Object.values(perPerson).filter((p) => p.marked > 0).sort((a, b) => (b.present / b.marked) - (a.present / a.marked));
  mgrStatsByPerson.innerHTML = rows.length ? rows.map((p) => {
    const rate = Math.round((p.present / p.marked) * 100);
    return `
      <div>
        <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>${escapeHtml(p.name)}</span>
          <span class="font-semibold">${rate}%</span>
        </div>
        <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full bg-orange-500 rounded-full" style="width:${rate}%"></div>
        </div>
      </div>
    `;
  }).join('') : '<div class="text-sm text-slate-400 text-center py-4">No attendance marked yet for this period.</div>';
}

// PWA install support - see ../app.js for why this silently no-ops until
// the app is served over TLS.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/manager/sw.js', { scope: '/manager/' }).catch(function () {});
  });
}

// ---------- Boot ----------
restoreSession_();
