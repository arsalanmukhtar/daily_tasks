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
    if (msg.resource === 'leaveRequests') fetchRequests_().catch(() => {});
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
function setMgrTab_(tab) {
  mgrActiveTab_ = tab;
  Object.keys(PANELS_).forEach((key) => PANELS_[key].classList.toggle('hidden', key !== tab));
  mgrTabbar.querySelectorAll('.mgr-tab-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mtab === tab);
  });
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

let requestsCache_ = [];

async function fetchRequests_() {
  mgrRequestsLoading.classList.remove('hidden');
  mgrRequestsEmpty.classList.add('hidden');
  mgrRequestsList.innerHTML = '';
  try {
    const all = await apiRequest_('GET', '/leave-requests');
    requestsCache_ = all
      .filter((r) => r.status === 'requested')
      .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
    renderRequestsList_();
  } catch (err) {
    showErrorToast_('Could not load requests: ' + err.message);
  } finally {
    mgrRequestsLoading.classList.add('hidden');
  }
}

function renderRequestsList_() {
  mgrRequestsCount.textContent = requestsCache_.length
    ? requestsCache_.length + (requestsCache_.length === 1 ? ' request' : ' requests')
    : '';
  mgrTabRequestsBadge.classList.toggle('hidden', requestsCache_.length === 0);
  if (!requestsCache_.length) {
    mgrRequestsEmpty.classList.remove('hidden');
    mgrRequestsList.innerHTML = '';
    return;
  }
  mgrRequestsEmpty.classList.add('hidden');
  mgrRequestsList.innerHTML = requestsCache_.map((rec) => `
    <button type="button" class="w-full text-left bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 hover:ring-orange-300 transition p-3.5" data-request-id="${escapeHtml(rec.requestId)}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 text-sm truncate">${escapeHtml(rec.name)}</div>
          <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(leaveTypeLabel_(rec.type))} · ${escapeHtml(dateRangeLabel_(rec))}</div>
        </div>
        <span class="text-[11px] text-slate-400 shrink-0 mt-0.5">${escapeHtml(timeAgo_(rec.requestedAt))}</span>
      </div>
    </button>
  `).join('');
}

mgrRequestsList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-request-id]');
  if (!btn) return;
  const rec = requestsCache_.find((r) => r.requestId === btn.dataset.requestId);
  if (rec) openDetail_(rec);
});

// ---------- Detail sheet + decide ----------
let currentDetailRecord_ = null;
let pendingDecision_ = null; // 'approved' | 'rejected'

function openDetail_(rec) {
  currentDetailRecord_ = rec;
  pendingDecision_ = null;
  mgrDetailName.textContent = rec.name;
  mgrDetailMeta.textContent = 'Sent ' + timeAgo_(rec.requestedAt) + (rec.weekLabel ? ' · ' + rec.weekLabel : '');
  mgrDetailChips.innerHTML =
    `<span class="tag neutral">${escapeHtml(leaveTypeLabel_(rec.type))}</span>` +
    `<span class="tag neutral">${escapeHtml(dateRangeLabel_(rec))}</span>` +
    (rec.shortLeaveTime ? `<span class="tag neutral">${escapeHtml(rec.shortLeaveTime)}</span>` : '') +
    (rec.checkOutTime ? `<span class="tag neutral">${escapeHtml(rec.checkOutTime)} – ${escapeHtml(rec.checkInTime || '')}</span>` : '');
  mgrDetailReason.innerHTML = rec.reasonHtml && rec.reasonHtml.trim() ? rec.reasonHtml : '<i class="text-slate-400">No reason provided.</i>';

  const attachments = Array.isArray(rec.attachments) ? rec.attachments : [];
  mgrDetailAttachWrap.classList.toggle('hidden', attachments.length === 0);
  mgrDetailAttachList.classList.toggle('hidden', attachments.length === 0);
  mgrDetailAttachList.innerHTML = attachments.map((a) =>
    `<a class="file" href="${escapeHtml(a.url)}" target="_blank" rel="noopener"><div class="fname"><b>${escapeHtml(a.name || 'Attachment')}</b></div></a>`
  ).join('');

  mgrDetailReplacementWrap.classList.add('hidden'); // replacement lookup is a v2 follow-up, not wired yet

  mgrDetailError.classList.add('hidden');
  mgrDecideRejectExtra.classList.add('hidden');
  mgrDecideNote.value = '';
  mgrDecideAllowReschedule.checked = false;
  mgrDetailFooter.classList.remove('hidden');
  mgrDecideConfirmFooter.classList.add('hidden');

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

// PWA install support - see ../app.js for why this silently no-ops until
// the app is served over TLS.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/manager/sw.js', { scope: '/manager/' }).catch(function () {});
  });
}

// ---------- Boot ----------
restoreSession_();
