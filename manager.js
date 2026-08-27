// Tech EW - Leave Approvals (manager-only PWA).
//
// Mirrors app.js's Firebase config/auth pattern and APPS_SCRIPT_URL - kept
// as a separate constant block here (not imported) since this is a
// standalone page loaded independently of app.js, same as Code.gs already
// mirrors these values independently from app.js.

const FIREBASE_CONFIG = {
  apiKey:     'AIzaSyA1exz20sN1WqLQdNkP986JX5wHuICYolg',
  authDomain: 'devteam-daily-tasks.firebaseapp.com',
  projectId:  'devteam-daily-tasks',
  messagingSenderId: '690432267181',
  appId:      '1:690432267181:web:1a80dfa3bfcd6d0b160724'
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz6njgCzwRK1i1aXzW9dmlZzlYfexxx72snoSB46L20u4ecitTTTYrLUnrHY_T_rkUmDQ/exec';

// The account owner - the only user allowed into this app. Must mirror
// OWNER_EMAIL in app.js and Code.gs.
const OWNER_EMAIL = 'developer.ndma@gmail.com';

// Firebase Console -> Project Settings -> Cloud Messaging -> Web Push
// certificates -> generate a key pair, then paste the public key here. This
// is a public key (like FIREBASE_CONFIG.apiKey above), safe to ship to the
// client.
const VAPID_KEY = 'BOcDJj1MtIhfI-PSJ17sohrayKZanCX7FPDKJnMQpGjnX_G4h6yP28RtpmlVqcBMkfHPzAPQxAIQ3ENDSpDTbGw';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getMessaging,
  getToken
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';

// Named app instance ('managerApp'), not the default one - this page shares
// an origin (and Firebase project) with index.html, and the default app's
// persisted session is broadcast across every tab on that origin. Without a
// distinct name, a session refresh here would flash a transient "signed
// out" state that index.html's tab would pick up too.
const firebaseApp = initializeApp(FIREBASE_CONFIG, 'managerApp');
const auth = getAuth(firebaseApp);

// ---------- DOM refs ----------
const signInGate     = document.getElementById('signInGate');
const signInBtn      = document.getElementById('signInBtn');
const signInError    = document.getElementById('signInError');
const restrictedGate = document.getElementById('restrictedGate');
const appEl          = document.getElementById('app');
const iosBanner      = document.getElementById('iosInstallBanner');
const refreshBtn     = document.getElementById('refreshBtn');
const emptyState     = document.getElementById('emptyState');
const requestList    = document.getElementById('requestList');
const toastContainer = document.getElementById('toastContainer');

let currentUser = null;

// ---------- JSONP GET helper (same pattern as app.js's jsonpFetch) ----------
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
      reject(new Error('Could not reach the endpoint.'));
    };
    document.head.appendChild(script);
  });
}

function showToast_(message, tone) {
  const el = document.createElement('div');
  el.className = 'px-4 py-2 rounded-lg text-sm font-semibold shadow-lg text-white ' +
    (tone === 'error' ? 'bg-red-600' : 'bg-slate-900');
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(function () { el.remove(); }, 3000);
}

// ---------- Sign-in ----------
// signInWithRedirect, not signInWithPopup - an installed iOS home-screen app
// has no real popup window to open, so signInWithPopup fails there with
// "auth/cancelled-popup-request". Redirect works in both an installed app
// and a normal browser tab.
signInBtn.addEventListener('click', async () => {
  signInError.classList.add('hidden');
  try {
    await signInWithRedirect(auth, new GoogleAuthProvider());
  } catch (err) {
    signInError.textContent = 'Sign-in failed: ' + err.message;
    signInError.classList.remove('hidden');
  }
});

getRedirectResult(auth).catch((err) => {
  signInError.textContent = 'Sign-in failed: ' + err.message;
  signInError.classList.remove('hidden');
});

onAuthStateChanged(auth, (user) => {
  signInGate.classList.add('hidden');
  restrictedGate.classList.add('hidden');
  appEl.classList.add('hidden');

  if (!user) {
    signInGate.classList.remove('hidden');
    return;
  }
  currentUser = user;
  const isOwner = (user.email || '').toLowerCase() === OWNER_EMAIL;
  if (!isOwner) {
    restrictedGate.classList.remove('hidden');
    return;
  }
  appEl.classList.remove('hidden');
  initOwnerSession_();
});

// ---------- Owner session: push setup + request list ----------
async function initOwnerSession_() {
  setupPushIfEligible_();
  await refreshRequests_();
}

function setupPushIfEligible_() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  if (isIOS && !isStandalone) {
    // iOS only supports web push once the PWA is installed to the home
    // screen (iOS 16.4+) - requesting permission before that silently does
    // nothing, so skip it and tell the user what to do instead.
    iosBanner.classList.remove('hidden');
    return;
  }
  registerForPush_();
}

async function registerForPush_() {
  try {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      showToast_('Push not supported in this browser.', 'error');
      return;
    }
    const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast_('Notification permission was not granted.', 'error');
      return;
    }

    // getMessaging(firebaseApp) - not the no-arg form, which looks up the
    // default app. This page only initializes the named 'managerApp'
    // instance (see the comment where firebaseApp is created above), so the
    // no-arg form would throw "No Firebase App '[DEFAULT]' has been created".
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) {
      showToast_('Could not get a push token.', 'error');
      return;
    }

    const idToken = await currentUser.getIdToken(false);
    const platform = /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : (/android/i.test(navigator.userAgent) ? 'android' : 'web');
    const payload = { action: 'registerPushToken', idToken, token, platform };
    const formBody = new URLSearchParams();
    formBody.append('payload', JSON.stringify(payload));
    await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: formBody, redirect: 'follow' });
    showToast_('Push notifications enabled.');
  } catch (err) {
    // Push is a convenience layer - never block the approvals list on it -
    // but still surface the failure, since a silent console.warn here is
    // invisible on a phone with no way to open devtools.
    showToast_('Push setup failed: ' + err.message, 'error');
  }
}

// ---------- Request list ----------
async function refreshRequests_() {
  if (!currentUser) return;
  try {
    const idToken = await currentUser.getIdToken(false);
    const data = await jsonpFetch(APPS_SCRIPT_URL, { action: 'listLeaveRequests', idToken });
    if (data.status !== 'ok') {
      showToast_(data.message || 'Could not load requests.', 'error');
      return;
    }
    renderRequests_(data.records || []);
  } catch (err) {
    showToast_('Could not load requests: ' + err.message, 'error');
  }
}

function renderRequests_(records) {
  requestList.innerHTML = '';
  emptyState.classList.toggle('hidden', records.length > 0);

  records.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'mgr-card p-4';

    const typeLabel = r.type === 'full' ? 'Full Leave' : 'Short Leave';
    const requestedAt = r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '';
    const attachmentHtml = r.attachmentUrl
      ? `<a href="${r.attachmentUrl}" target="_blank" rel="noopener" class="text-xs font-semibold text-orange-600 hover:underline">${escapeHtml_(r.attachmentName || 'View attachment')}</a>`
      : '';
    const resolvedHtml = r.status !== 'requested'
      ? `<div class="text-xs text-slate-500 mt-1">${escapeHtml_(r.status === 'approved' ? 'Approved' : 'Rejected')} by ${escapeHtml_(r.resolvedBy || '')}${r.resolvedAt ? ' on ' + new Date(r.resolvedAt).toLocaleString() : ''}</div>`
      : '';

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="font-bold text-sm">${escapeHtml_(r.name)}</div>
          <div class="text-xs text-slate-500">${escapeHtml_(r.email)} - ${escapeHtml_(r.weekLabel)} - ${escapeHtml_(typeLabel)}</div>
          <div class="text-xs text-slate-400">${escapeHtml_(requestedAt)}</div>
        </div>
        <span class="mgr-badge ${r.status}">${escapeHtml_(r.status)}</span>
      </div>
      <div class="mgr-reason text-sm mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">${r.reasonHtml || '<em class="text-slate-400">No reason provided.</em>'}</div>
      <div class="mt-2">${attachmentHtml}</div>
      ${resolvedHtml}
      <div class="flex gap-2 mt-3 decide-actions" ${r.status !== 'requested' ? 'style="display:none"' : ''}>
        <button type="button" data-decision="approved" class="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition">Approve</button>
        <button type="button" data-decision="rejected" class="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Reject</button>
      </div>
    `;

    card.querySelectorAll('[data-decision]').forEach((btn) => {
      btn.addEventListener('click', () => decide_(r.requestId, btn.getAttribute('data-decision'), card));
    });

    requestList.appendChild(card);
  });
}

function escapeHtml_(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

async function decide_(requestId, decision, card) {
  const actions = card.querySelector('.decide-actions');
  actions.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    const idToken = await currentUser.getIdToken(false);
    const payload = { action: 'decideLeave', idToken, requestId, decision };
    const formBody = new URLSearchParams();
    formBody.append('payload', JSON.stringify(payload));
    await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: formBody, redirect: 'follow' });
    showToast_(decision === 'approved' ? 'Request approved.' : 'Request rejected.');
    await refreshRequests_();
  } catch (err) {
    showToast_('Could not save decision: ' + err.message, 'error');
    actions.querySelectorAll('button').forEach((b) => { b.disabled = false; });
  }
}

refreshBtn.addEventListener('click', refreshRequests_);
