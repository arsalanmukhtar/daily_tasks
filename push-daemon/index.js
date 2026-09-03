// Long-running daemon (systemd-managed on the VM): listens for newly created
// `leaveRequests` docs and pushes an FCM notification to whichever
// allowlist doc(s) have isOwner==true. Replaces the old Apps Script
// sendPushToOwner_() path - same message shape (title/body/data.requestId)
// so the existing Android LeaveFcmService needs no changes.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp({
  credential: applicationDefault()
});

const db = getFirestore();
const messaging = getMessaging();

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
  const typeLabel = data.type === 'full' ? 'Full Leave' : 'Short Leave';
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

log('Starting leave-approvals push daemon...');

// onSnapshot's very first callback always reports every doc already matching
// the query as an 'added' change (there's no prior state to diff against
// yet) - without this guard, every restart (a redeploy, a crash, a VM
// reboot) would re-notify for every still-pending request all over again.
let isInitialSnapshot = true;

const unsubscribe = db
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

function shutdown() {
  log('Shutting down.');
  unsubscribe();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (err) => {
  logError('Unhandled rejection, exiting for systemd to restart:', err);
  process.exit(1);
});
