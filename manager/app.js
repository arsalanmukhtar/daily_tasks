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

const mgrRequestsPanel = document.getElementById('mgrRequestsPanel');
const mgrRequestsLoading = document.getElementById('mgrRequestsLoading');
const mgrRequestsEmpty = document.getElementById('mgrRequestsEmpty');
const mgrRequestsList = document.getElementById('mgrRequestsList');
const mgrRequestsCount = document.getElementById('mgrRequestsCount');
const mgrTabRequestsBadge = document.getElementById('mgrTabRequestsBadge');

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
const mgrDetailError = document.getElementById('mgrDetailError');
const mgrDetailFooter = document.getElementById('mgrDetailFooter');
const mgrRejectBtn = document.getElementById('mgrRejectBtn');
const mgrApproveBtn = document.getElementById('mgrApproveBtn');
const mgrDecideRejectExtra = document.getElementById('mgrDecideRejectExtra');
const mgrDecideNote = document.getElementById('mgrDecideNote');
const mgrDecideAllowReschedule = document.getElementById('mgrDecideAllowReschedule');
const mgrDecideConfirmFooter = document.getElementById('mgrDecideConfirmFooter');
const mgrDecideCancelBtn = document.getElementById('mgrDecideCancelBtn');
const mgrDecideConfirmBtn = document.getElementById('mgrDecideConfirmBtn');

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
  if (errMsg) showErrorToast_(errMsg);
}
function showForm(user) {
  loadingState.classList.add('hidden');
  authGate.classList.add('hidden');
  appShell.classList.remove('hidden');
  mgrTabbar.classList.remove('hidden');
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
function dateRangeLabel_(rec) {
  if (Array.isArray(rec.customDates) && rec.customDates.length > 1) {
    return rec.customDates.length + ' selected dates';
  }
  if (rec.startDate === rec.endDate || !rec.endDate) return fmtDate_(rec.startDate);
  return fmtDate_(rec.startDate) + ' – ' + fmtDate_(rec.endDate);
}
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

let allRequestsCache_ = []; // every leave_requests row (owner-wide) - shared by Requests/Archived/Summary/Team
let requestsCache_ = [];    // status in (requested, pending_documentation) - the Requests tab only

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

// Shared toggle behavior for every .mgr-chip group (Archived's status
// filter, Team's Directory/Attendance/Stats switcher, Stats' period picker).
function wireChipGroup_(container, datasetKey, onSelect) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.mgr-chip');
    if (!btn || !container.contains(btn)) return;
    container.querySelectorAll('.mgr-chip').forEach((b) => b.classList.toggle('is-active', b === btn));
    onSelect(btn.dataset[datasetKey]);
  });
}

async function fetchAllRequests_() {
  allRequestsCache_ = await apiRequest_('GET', '/leave-requests');
  return allRequestsCache_;
}

async function fetchRequests_() {
  mgrRequestsLoading.classList.remove('hidden');
  mgrRequestsEmpty.classList.add('hidden');
  mgrRequestsList.innerHTML = '';
  try {
    await fetchAllRequests_();
    requestsCache_ = allRequestsCache_
      .filter((r) => r.status === 'requested' || r.status === 'pending_documentation')
      .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
    renderRequestsList_();
  } catch (err) {
    showErrorToast_('Could not load requests: ' + err.message);
  } finally {
    mgrRequestsLoading.classList.add('hidden');
  }
}

function renderRequestsList_() {
  const decidable = requestsCache_.filter((r) => r.status === 'requested').length;
  mgrRequestsCount.textContent = requestsCache_.length
    ? requestsCache_.length + (requestsCache_.length === 1 ? ' request' : ' requests')
    : '';
  mgrTabRequestsBadge.classList.toggle('hidden', decidable === 0);
  if (!requestsCache_.length) {
    mgrRequestsEmpty.classList.remove('hidden');
    mgrRequestsList.innerHTML = '';
    return;
  }
  mgrRequestsEmpty.classList.add('hidden');
  mgrRequestsList.innerHTML = requestsCache_.map((rec) => {
    const awaitingDocs = rec.status === 'pending_documentation';
    return `
    <button type="button" class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 hover:ring-orange-300 transition p-3.5" data-request-id="${escapeHtml(rec.requestId)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(rec.name)}</div>
          <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(leaveTypeLabel_(rec.type))} · ${escapeHtml(dateRangeLabel_(rec))}</div>
        </div>
        ${awaitingDocs
          ? '<span class="tag wait shrink-0 mt-0.5">Awaiting docs</span>'
          : `<span class="text-[11px] text-slate-400 shrink-0 mt-0.5">${escapeHtml(timeAgo_(rec.requestedAt))}</span>`}
      </div>
    </button>
  `;
  }).join('');
}

mgrRequestsList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-request-id]');
  if (!btn) return;
  const rec = requestsCache_.find((r) => r.requestId === btn.dataset.requestId);
  if (rec) openDetail_(rec);
});

function archivedStatusTag_(status) {
  if (status === 'approved') return '<span class="tag ok">Approved</span>';
  if (status === 'rejected') return '<span class="tag no">Rejected</span>';
  if (status === 'withdrawn') return '<span class="tag neutral">Withdrawn</span>';
  if (status === 'dismissed') return '<span class="tag neutral">Dismissed</span>';
  return '<span class="tag neutral">' + escapeHtml(status) + '</span>';
}

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
    `<span class="tag neutral">${escapeHtml(leaveTypeLabel_(rec.type))}</span>` +
    `<span class="tag neutral">${escapeHtml(dateRangeLabel_(rec))}</span>` +
    (rec.shortLeaveTime ? `<span class="tag neutral">${escapeHtml(rec.shortLeaveTime)}</span>` : '') +
    (rec.checkOutTime ? `<span class="tag neutral">${escapeHtml(rec.checkOutTime)} – ${escapeHtml(rec.checkInTime || '')}</span>` : '') +
    (opts.readOnly ? archivedStatusTag_(rec.status) : '');
  mgrDetailReason.innerHTML = rec.reasonHtml && rec.reasonHtml.trim() ? rec.reasonHtml : '<i class="text-slate-400">No reason provided.</i>';

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

  mgrDetailError.classList.add('hidden');
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
  mgrDetailError.classList.add('hidden');
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
    mgrDetailError.textContent = err.message;
    mgrDetailError.classList.remove('hidden');
  } finally {
    mgrApproveBtn.disabled = false;
    mgrDecideConfirmBtn.disabled = false;
  }
}

// ---------- Archived tab ----------
const mgrArchivedFilters = document.getElementById('mgrArchivedFilters');
const mgrArchivedSearch = document.getElementById('mgrArchivedSearch');
const mgrArchivedLoading = document.getElementById('mgrArchivedLoading');
const mgrArchivedEmpty = document.getElementById('mgrArchivedEmpty');
const mgrArchivedList = document.getElementById('mgrArchivedList');
const mgrArchivedCount = document.getElementById('mgrArchivedCount');

const ARCHIVED_STATUSES_ = ['approved', 'rejected', 'withdrawn', 'dismissed'];
let archivedStatusFilter_ = 'all';

async function fetchArchived_() {
  mgrArchivedLoading.classList.remove('hidden');
  mgrArchivedEmpty.classList.add('hidden');
  mgrArchivedList.innerHTML = '';
  try {
    await fetchAllRequests_();
    renderArchivedList_();
  } catch (err) {
    showErrorToast_('Could not load archive: ' + err.message);
  } finally {
    mgrArchivedLoading.classList.add('hidden');
  }
}

function renderArchivedList_() {
  const search = mgrArchivedSearch.value.trim().toLowerCase();
  const filtered = allRequestsCache_
    .filter((r) => ARCHIVED_STATUSES_.includes(r.status))
    .filter((r) => archivedStatusFilter_ === 'all' || r.status === archivedStatusFilter_)
    .filter((r) => !search || r.name.toLowerCase().includes(search))
    .sort((a, b) => new Date(b.resolvedAt || b.requestedAt) - new Date(a.resolvedAt || a.requestedAt));

  mgrArchivedCount.textContent = filtered.length ? filtered.length + (filtered.length === 1 ? ' result' : ' results') : '';
  if (!filtered.length) {
    mgrArchivedEmpty.classList.remove('hidden');
    mgrArchivedList.innerHTML = '';
    return;
  }
  mgrArchivedEmpty.classList.add('hidden');
  mgrArchivedList.innerHTML = filtered.map((rec) => `
    <button type="button" class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 hover:ring-orange-300 transition p-3.5" data-request-id="${escapeHtml(rec.requestId)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(rec.name)}</div>
          <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(leaveTypeLabel_(rec.type))} · ${escapeHtml(dateRangeLabel_(rec))}</div>
        </div>
        <div class="shrink-0">${archivedStatusTag_(rec.status)}</div>
      </div>
    </button>
  `).join('');
}

wireChipGroup_(mgrArchivedFilters, 'archivedStatus', (val) => { archivedStatusFilter_ = val; renderArchivedList_(); });
mgrArchivedSearch.addEventListener('input', renderArchivedList_);
mgrArchivedList.addEventListener('click', (e) => {
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
const mgrSumTrend = document.getElementById('mgrSumTrend');
const mgrSumLeaderboard = document.getElementById('mgrSumLeaderboard');

function monthKey_(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function monthLabel_(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

async function fetchSummary_() {
  mgrSummaryLoading.classList.remove('hidden');
  mgrSummaryBody.classList.add('hidden');
  try {
    const [requests, uninformed] = await Promise.all([
      fetchAllRequests_(),
      apiRequest_('GET', '/uninformed-leaves')
    ]);
    renderSummary_(requests, uninformed);
    mgrSummaryUpdated.textContent = 'Updated just now';
  } catch (err) {
    showErrorToast_('Could not load summary: ' + err.message);
  } finally {
    mgrSummaryLoading.classList.add('hidden');
    mgrSummaryBody.classList.remove('hidden');
  }
}

function renderSummary_(requests, uninformed) {
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
          <div class="h-full bg-orange-500 rounded-full" style="width:${Math.round((count / maxType) * 100)}%"></div>
        </div>
      </div>
    `).join('') : '<div class="text-sm text-slate-400 text-center py-4">No data yet.</div>';

  // Monthly trend - last 6 months
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(monthKey_(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  const monthCounts = {};
  months.forEach((m) => { monthCounts[m] = 0; });
  requests.forEach((r) => {
    const key = monthKey_(new Date(r.requestedAt));
    if (key in monthCounts) monthCounts[key]++;
  });
  const maxMonth = Math.max(1, ...Object.values(monthCounts));
  mgrSumTrend.innerHTML = months.map((m) => `
    <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
      <div class="text-[10px] font-semibold text-slate-500">${monthCounts[m]}</div>
      <div class="w-full bg-orange-500 rounded-t-md" style="height:${Math.max(4, Math.round((monthCounts[m] / maxMonth) * 88))}px"></div>
      <div class="text-[9px] text-slate-400">${monthLabel_(m)}</div>
    </div>
  `).join('');

  // Leaderboard - this calendar month, by request count
  const thisMonthKey = monthKey_(now);
  const byEmail = {};
  requests.filter((r) => monthKey_(new Date(r.requestedAt)) === thisMonthKey).forEach((r) => {
    if (!byEmail[r.email]) byEmail[r.email] = { name: r.name, count: 0 };
    byEmail[r.email].count++;
  });
  const top = Object.values(byEmail).sort((a, b) => b.count - a.count).slice(0, 5);
  mgrSumLeaderboard.innerHTML = top.length ? top.map((p, i) => `
        <div class="flex items-center justify-between text-sm">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center shrink-0">${i + 1}</span>
            <span class="truncate text-slate-700">${escapeHtml(p.name)}</span>
          </div>
          <span class="font-semibold text-slate-800">${p.count}</span>
        </div>
      `).join('') : '<div class="text-sm text-slate-400 text-center py-4">No requests this month yet.</div>';
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
const mgrNewReportError = document.getElementById('mgrNewReportError');
const mgrNewReportSubmitBtn = document.getElementById('mgrNewReportSubmitBtn');
const mgrReportDecideModal = document.getElementById('mgrReportDecideModal');
const mgrReportDecideBackdrop = document.getElementById('mgrReportDecideBackdrop');
const mgrReportDecideCloseBtn = document.getElementById('mgrReportDecideCloseBtn');
const mgrReportDecideName = document.getElementById('mgrReportDecideName');
const mgrReportDecideMeta = document.getElementById('mgrReportDecideMeta');
const mgrReportDecideReason = document.getElementById('mgrReportDecideReason');
const mgrReportDecideExplanation = document.getElementById('mgrReportDecideExplanation');
const mgrReportDecideNote = document.getElementById('mgrReportDecideNote');
const mgrReportDecideError = document.getElementById('mgrReportDecideError');
const mgrReportDecideRejectBtn = document.getElementById('mgrReportDecideRejectBtn');
const mgrReportDecideAcceptBtn = document.getElementById('mgrReportDecideAcceptBtn');

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
      apiRequest_('GET', '/late-arrival-notices')
    ]);
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
    ? '<span class="tag wait">Explained</span>'
    : kind === 'open' ? '<span class="tag neutral">Awaiting explanation</span>' : '<span class="tag ok">Resolved</span>';
  const bodyHtml = kind === 'decision' ? r.explanationHtml : kind === 'open' ? r.reasonHtml : r.resolutionHtml;
  const isDecision = kind === 'decision';
  return `
    <${isDecision ? 'button type="button"' : 'div'} ${isDecision ? `data-report-id="${escapeHtml(r.reportId)}"` : ''} class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 ${isDecision ? 'hover:ring-orange-300 transition' : ''} p-3.5 block">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(r.name)}</div>
          <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(fmtDate_(r.date))}</div>
        </div>
        <div class="shrink-0">${badge}</div>
      </div>
      ${bodyHtml && bodyHtml.trim() ? `<div class="rich-text text-xs text-slate-600 mt-2">${bodyHtml}</div>` : ''}
    </${isDecision ? 'button' : 'div'}>
  `;
}

function lateNoticeCard_(n) {
  const ack = n.status === 'acknowledged';
  return `
    <div class="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 p-3.5">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(n.name)}</div>
          <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(fmtDate_(n.date))}${n.expectedArrivalTime ? ' · ETA ' + escapeHtml(n.expectedArrivalTime) : ''}</div>
        </div>
        ${ack ? '<span class="tag ok shrink-0">Acknowledged</span>' : `<button type="button" data-ack-notice-id="${escapeHtml(n.id)}" class="text-xs font-semibold text-orange-700 hover:text-orange-800 shrink-0">Acknowledge</button>`}
      </div>
      ${n.reasonHtml && n.reasonHtml.trim() ? `<div class="rich-text text-xs text-slate-600 mt-2">${n.reasonHtml}</div>` : ''}
    </div>
  `;
}

function renderReportTab_() {
  const decision = uninformedCache_.filter((r) => r.status === 'explained').sort((a, b) => new Date(a.explainedAt) - new Date(b.explainedAt));
  const open = uninformedCache_.filter((r) => r.status === 'reported').sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
  const resolved = uninformedCache_.filter((r) => r.status === 'resolved').sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt));

  mgrReportDecisionEmpty.classList.toggle('hidden', decision.length > 0);
  mgrReportDecisionList.innerHTML = decision.map((r) => reportCard_(r, 'decision')).join('');
  mgrReportOpenEmpty.classList.toggle('hidden', open.length > 0);
  mgrReportOpenList.innerHTML = open.map((r) => reportCard_(r, 'open')).join('');
  mgrReportResolvedEmpty.classList.toggle('hidden', resolved.length > 0);
  mgrReportResolvedList.innerHTML = resolved.map((r) => reportCard_(r, 'resolved')).join('');

  const notices = lateNoticesCache_.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  mgrLateNoticeEmpty.classList.toggle('hidden', notices.length > 0);
  mgrLateNoticeList.innerHTML = notices.map(lateNoticeCard_).join('');
}

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
  mgrReportDecideReason.innerHTML = rec.reasonHtml && rec.reasonHtml.trim() ? rec.reasonHtml : '<i class="text-slate-400">No reason given.</i>';
  mgrReportDecideExplanation.innerHTML = rec.explanationHtml && rec.explanationHtml.trim() ? rec.explanationHtml : '<i class="text-slate-400">No explanation given.</i>';
  mgrReportDecideNote.value = '';
  mgrReportDecideError.classList.add('hidden');
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
  mgrReportDecideError.classList.add('hidden');
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
    mgrReportDecideError.textContent = err.message;
    mgrReportDecideError.classList.remove('hidden');
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
  mgrNewReportError.classList.add('hidden');
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
  mgrNewReportError.classList.add('hidden');
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
    mgrNewReportError.textContent = err.message;
    mgrNewReportError.classList.remove('hidden');
  } finally {
    mgrNewReportSubmitBtn.disabled = false;
  }
});

// ---------- Team tab: Directory ----------
const mgrTeamSearch = document.getElementById('mgrTeamSearch');
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
  const search = mgrTeamSearch.value.trim().toLowerCase();
  const filtered = usersCache_.filter((u) =>
    !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search) ||
    (u.designation || '').toLowerCase().includes(search)
  );
  if (!filtered.length) {
    mgrTeamDirectoryList.innerHTML = '<div class="text-center py-12 text-sm text-slate-400">No matches.</div>';
    return;
  }
  mgrTeamDirectoryList.innerHTML = filtered.map((u) => `
    <button type="button" class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 hover:ring-orange-300 transition p-3.5" data-user-email="${escapeHtml(u.email)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(u.name)}${!u.active ? ' <span class="text-[10px] text-slate-400 font-normal">(inactive)</span>' : ''}</div>
          <div class="text-xs text-slate-500 mt-0.5 truncate">${escapeHtml(u.designation || u.email)}</div>
        </div>
        ${u.isOwner ? '<span class="tag neutral shrink-0">Manager</span>' : ''}
      </div>
    </button>
  `).join('');
}
mgrTeamSearch.addEventListener('input', renderTeamDirectory_);
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
const mgrUserEditError = document.getElementById('mgrUserEditError');
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
  mgrUserEditError.classList.add('hidden');
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
  mgrUserEditError.classList.add('hidden');
  mgrUserViewMode.classList.add('hidden');
  mgrUserEditMode.classList.remove('hidden');
});
mgrUserEditCancelBtn.addEventListener('click', () => {
  mgrUserEditMode.classList.add('hidden');
  mgrUserViewMode.classList.remove('hidden');
});
mgrUserEditSaveBtn.addEventListener('click', async () => {
  if (!currentUserRecord_) return;
  mgrUserEditError.classList.add('hidden');
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
    mgrUserEditError.textContent = err.message;
    mgrUserEditError.classList.remove('hidden');
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
const mgrAttMarkError = document.getElementById('mgrAttMarkError');
const mgrAttMarkSaveBtn = document.getElementById('mgrAttMarkSaveBtn');

let attSelectedDate_ = new Date().toISOString().slice(0, 10);
let attRecordsCache_ = [];

const ATT_STATUS_LABELS_ = {
  present: 'Present', absent: 'Absent', late: 'Late', night_duty: 'Night Duty',
  on_duty: 'On Duty', on_leave: 'On Leave', unmarked: 'Unmarked'
};
const ATT_STATUS_TAG_CLASS_ = {
  present: 'ok', late: 'wait', absent: 'no', night_duty: 'neutral', on_duty: 'neutral', on_leave: 'neutral', unmarked: 'neutral'
};
function attStatusTag_(status) {
  return `<span class="tag ${ATT_STATUS_TAG_CLASS_[status] || 'neutral'}">${ATT_STATUS_LABELS_[status] || status}</span>`;
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
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(u.name)}</div>
            <div class="text-xs text-slate-500 mt-0.5 truncate">${escapeHtml(u.designation || '')}</div>
          </div>
          <div class="shrink-0">${attStatusTag_(st.status)}</div>
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

function selectAttOption_(status) {
  attMarkSelectedStatus_ = status;
  document.querySelectorAll('.mgr-att-opt').forEach((b) => {
    const active = b.dataset.attStatus === status;
    b.classList.toggle('bg-orange-600', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('border-orange-600', active);
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
  mgrAttMarkError.classList.add('hidden');
  document.querySelectorAll('.mgr-att-opt').forEach((b) => b.classList.remove('bg-orange-600', 'text-white', 'border-orange-600'));
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
  mgrAttMarkError.classList.add('hidden');
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
    mgrAttMarkError.textContent = err.message;
    mgrAttMarkError.classList.remove('hidden');
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
const mgrStatsByPerson = document.getElementById('mgrStatsByPerson');

let statsPeriod_ = 'week';
wireChipGroup_(document.getElementById('mgrStatsPeriodChips'), 'statsPeriod', (val) => { statsPeriod_ = val; fetchStats_(); });

function isoDate_(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function periodRange_(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
  } else if (period === 'month') {
    start.setDate(1);
  } else if (period === 'quarter') {
    start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
  }
  return { start: isoDate_(start), end: isoDate_(now) };
}
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
    const { start, end } = periodRange_(statsPeriod_);
    const [attendance] = await Promise.all([
      apiRequest_('GET', '/attendance?start=' + start + '&end=' + end),
      usersCache_.length ? Promise.resolve() : fetchUsers_(),
      allRequestsCache_.length ? Promise.resolve() : fetchAllRequests_()
    ]);
    renderStats_(attendance, start, end);
  } catch (err) {
    showErrorToast_('Could not load stats: ' + err.message);
  } finally {
    mgrStatsLoading.classList.add('hidden');
    mgrStatsBody.classList.remove('hidden');
  }
}
function renderStats_(attendance, start, end) {
  const roster = usersCache_.filter((u) => u.active && !u.isOwner);
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

  const totalMarked = counts.present + counts.late + counts.absent + counts.night_duty + counts.on_duty;
  const pct = (n) => totalMarked ? Math.round((n / totalMarked) * 100) : 0;
  mgrStatsKpiPresent.textContent = pct(counts.present) + '%';
  mgrStatsKpiLate.textContent = pct(counts.late) + '%';
  mgrStatsKpiAbsent.textContent = pct(counts.absent) + '%';

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
