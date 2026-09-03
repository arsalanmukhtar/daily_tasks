# push-daemon/

Long-running service on the VM. Listens to Firestore's `leaveRequests`
collection directly (`firebase-admin`, no polling) and sends an FCM push to
every allowlisted owner's registered device the instant a new request is
created. Replaces the old Apps Script `sendPushToOwner_()` path - no Cloud
Functions, no server framework, just one Node process kept alive by systemd.

## One-time setup

1. **Generate a fresh service-account key** (do not reuse `tools/service-account.json`):
   Firebase Console -> gear icon -> **Project settings** -> **Service accounts**
   tab -> **Generate new private key**.
2. Copy this whole `push-daemon/` directory to the VM, e.g. into
   `/home/gtechapp/push-daemon`.
3. Put the downloaded key at `/home/gtechapp/push-daemon/service-account.json`
   on the VM (`chmod 600`, owned by `gtechapp`). It's git-ignored - never
   committed.
4. On the VM, inside `push-daemon/`:
   ```
   npm install --omit=dev
   ```
5. Install the systemd unit (requires sudo):
   ```
   sudo cp leaveapprovals-push.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now leaveapprovals-push
   ```
6. Check it's alive:
   ```
   sudo systemctl status leaveapprovals-push
   journalctl -u leaveapprovals-push -f
   ```

## Redeploying after a code change

```
cd /home/gtechapp/push-daemon
git pull            # or re-copy index.js
npm install --omit=dev   # only needed if package.json changed
sudo systemctl restart leaveapprovals-push
```

No dropdown, no "New version" trap - `systemctl restart` picks up the new
code immediately, and `journalctl` gives real logs (unlike Apps Script's
silent `doPost` failures that started this whole migration).

## What it actually does

- Query: `leaveRequests` where `status == 'requested'`, real-time listener
  (`onSnapshot`), reacting only to newly **added** docs - a status flip to
  approved/rejected makes a doc leave this query and is correctly ignored.
- For each new request: resolve current owner(s) from `allowlist` where
  `isOwner == true && active == true` (so adding a second manager is a data
  change, not a code change), then their tokens from `pushTokens`.
- Sends via `messaging().sendEachForMulticast()` with the same
  `{notification: {title, body}, data: {requestId}}` shape the Android app's
  `LeaveFcmService` already expects - no Android-side changes needed.
- Any token FCM reports as unregistered/invalid gets deleted from
  `pushTokens` automatically.
- Any fatal listener error (bad/revoked credentials, etc.) exits the process
  deliberately so systemd restarts it with a clean connection, rather than
  reimplementing reconnect/backoff logic Firestore's SDK already handles for
  transient issues.
