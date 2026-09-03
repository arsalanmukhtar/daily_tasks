// One-time script: populates the `allowlist` Firestore collection from the
// same 14 entries that used to live in the old Apps Script backend's
// ALLOWLIST + OWNER_EMAIL (that file has since been retired and removed).
// Run once locally (`node seed-allowlist.js` from inside tools/), never
// deployed anywhere. Safe to re-run - it overwrites each doc with the same
// values (idempotent), it doesn't append/duplicate.
//
// Requires a service-account key: Firebase Console -> Project Settings ->
// Service Accounts -> Generate new private key. Save it as
// tools/service-account.json (already git-ignored via tools/*.json).

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const OWNER_EMAIL = 'developer.ndma@gmail.com';

const ALLOWLIST = {
  'developer.ndma@gmail.com': { name: 'Muhammad Arsalan Mukhtar', designation: 'Deputy Manager - I', reportedTo: 'Junaid Aziz Khan' },
  'as2040704@gmail.com': { name: 'Abdul Sattar Sheikh', designation: 'Assistant Manager - II', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'mustafa.haider2011@gmail.com': { name: 'Syed Mustafa Haider', designation: 'Assistant Manager - III', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'shehzadalikhan586@gmail.com': { name: 'Shehzad Ali', designation: 'Assistant Manager - I', reportedTo: 'Kashif Iqbal' },
  'seemalnaeem100@gmail.com': { name: 'Seemal Naeem', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'muddasir.ndma25@gmail.com': { name: 'Muddasir Shah', designation: 'Assistant Manager - I', reportedTo: 'Imtiaz Nabi' },
  'ahad.khan.work01@gmail.com': { name: 'Muhammad Ahad Khan', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'zainabali27feb2004@gmail.com': { name: 'Zainab Ali', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'ttalha063@gmail.com': { name: 'Talha Rizwan', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'zeeshannasir2001@gmail.com': { name: 'Zeeshan Nasir', designation: 'Assistant Manager - I', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'ibrahimabdullahh84@gmail.com': { name: 'Ibrahim Abdullah', designation: 'Assistant Manager - I', reportedTo: 'Imtiaz Nabi' },
  'usamabinumar199@gmail.com': { name: 'Usama bin Umar', designation: 'Intern', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'osamakhan32156@gmail.com': { name: 'Muhammad Osama Khan', designation: 'Intern', reportedTo: 'Muhammad Arsalan Mukhtar' },
  'muqeetahmad155@gmail.com': { name: 'Muqeet Ahmad', designation: 'Assistant Manager - I', reportedTo: 'Imtiaz Nabi' }
};

async function main() {
  const db = admin.firestore();
  const batch = db.batch();

  for (const [email, entry] of Object.entries(ALLOWLIST)) {
    const ref = db.collection('allowlist').doc(email);
    batch.set(ref, {
      name: entry.name,
      designation: entry.designation,
      reportedTo: entry.reportedTo,
      domain: 'GIS Developer',
      isOwner: email === OWNER_EMAIL,
      active: true
    });
  }

  await batch.commit();
  console.log(`Seeded ${Object.keys(ALLOWLIST).length} allowlist documents.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
