// Long-running daemon (systemd-managed on the VM): listens for newly created
// `leaveRequests` docs and pushes an FCM notification to whichever
// allowlist doc(s) have isOwner==true. Replaces the old Apps Script
// sendPushToOwner_() path - same message shape (title/body/data.requestId)
// so the existing Android LeaveFcmService needs no changes.
const nodemailer = require('nodemailer');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { leaveTypeLabel } = require('./leaveType');
const { buildDecisionEmail } = require('./emailTemplate');

initializeApp({
  credential: applicationDefault()
});

const db = getFirestore();
const messaging = getMessaging();

// Email is a soft dependency - if GMAIL_USER/GMAIL_APP_PASSWORD aren't set
// (e.g. push-only deployments, or before the App Password has been
// generated), the daemon logs it once and simply skips sending, rather than
// crashing the whole process over a feature that isn't wired up yet.
const mailer =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
      })
    : null;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function logError(...args) {
  console.error(new Date().toISOString(), ...args);
}

async function getOwnerTokens() {
  const ownersSnap = await db
    .collection('allowlist')
    .where('isOwner', '==', true)
    .where('active', '==', true)
    .get();

  const ownerEmails = ownersSnap.docs.map((d) => d.id);
  if (ownerEmails.length === 0) return [];

  const tokensSnap = await db
    .collection('pushTokens')
    .where('email', 'in', ownerEmails.slice(0, 30))
    .get();

  return tokensSnap.docs.map((d) => d.id);
}

async function pruneToken(token) {
  await db.collection('pushTokens').doc(token).delete().catch((err) => {
    logError('Failed to prune dead token', token, err.message || err);
  });
}

async function handleNewRequest(doc) {
  const data = doc.data();
  const requestId = doc.id;
  const typeLabel = leaveTypeLabel(data.type);
  const title = 'New leave request';
  const body = `${data.name || 'Someone'} - ${typeLabel} for ${data.weekLabel || ''}`;

  const tokens = await getOwnerTokens();
  if (tokens.length === 0) {
    log('New request', requestId, '- no registered owner push tokens, skipping.');
    return;
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { requestId }
  });

  log(`Sent push for ${requestId} - ${response.successCount}/${tokens.length} delivered.`);

  await Promise.all(
    response.responses.map((result, i) => {
      if (result.success) return null;
      const code = result.error && result.error.code;
      logError('Push failed for a token', code, result.error && result.error.message);
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        return pruneToken(tokens[i]);
      }
      return null;
    })
  );
}

// Emails the employee once their request is approved/rejected - a request
// newly satisfying the status in ['approved','rejected'] query (below) is
// exactly "just got decided", the same trick the push listener uses instead
// of manually diffing old/new field values.
async function handleDecidedRequest(doc) {
  const data = doc.data();
  if (!mailer) {
    log('Request', doc.id, 'decided - GMAIL_USER/GMAIL_APP_PASSWORD not set, skipping email.');
    return;
  }
  if (!data.email) {
    log('Request', doc.id, 'decided - no email on the request, skipping.');
    return;
  }
  const { subject, html } = buildDecisionEmail(data);
  await mailer.sendMail({
    from: `"Tech EW - Leave Approvals" <${process.env.GMAIL_USER}>`,
    to: data.email,
    subject,
    html
  });
  log(`Sent decision email for ${doc.id} to ${data.email} (${data.status}).`);
}

log('Starting leave-approvals push daemon...');

// onSnapshot's very first callback always reports every doc already matching
// the query as an 'added' change (there's no prior state to diff against
// yet) - without this guard, every restart (a redeploy, a crash, a VM
// reboot) would re-notify for every still-pending request all over again.
let isInitialSnapshot = true;

const unsubscribeNew = db
  .collection('leaveRequests')
  .where('status', '==', 'requested')
  .onSnapshot(
    (snapshot) => {
      if (isInitialSnapshot) {
        isInitialSnapshot = false;
        log(`Baseline loaded: ${snapshot.size} already-pending request(s), not notifying for these.`);
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        handleNewRequest(change.doc).catch((err) => {
          logError('Error handling new request', change.doc.id, err);
        });
      });
    },
    (err) => {
      // Firestore's SDK already retries transient errors on its own; an error
      // reaching here is treated as fatal (e.g. bad credentials, revoked
      // access) - exit and let systemd restart with a clean connection
      // rather than reimplementing our own reconnect/backoff logic.
      logError('Firestore listener error, exiting for systemd to restart:', err);
      process.exit(1);
    }
  );

log('Listening for new leave requests.');

// Same baseline-skip guard as above, tracked separately since this listener
// starts its own independent initial snapshot.
let isInitialDecidedSnapshot = true;

const unsubscribeDecided = db
  .collection('leaveRequests')
  .where('status', 'in', ['approved', 'rejected'])
  .onSnapshot(
    (snapshot) => {
      if (isInitialDecidedSnapshot) {
        isInitialDecidedSnapshot = false;
        log(`Baseline loaded: ${snapshot.size} already-decided request(s), not emailing for these.`);
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        handleDecidedRequest(change.doc).catch((err) => {
          logError('Error handling decided request', change.doc.id, err);
        });
      });
    },
    (err) => {
      logError('Firestore listener error (decided), exiting for systemd to restart:', err);
      process.exit(1);
    }
  );

log('Listening for decided leave requests.');

function shutdown() {
  log('Shutting down.');
  unsubscribeNew();
  unsubscribeDecided();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (err) => {
  logError('Unhandled rejection, exiting for systemd to restart:', err);
  process.exit(1);
});
