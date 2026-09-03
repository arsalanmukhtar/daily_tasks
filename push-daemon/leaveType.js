// Same 5-type taxonomy as app.js's LEAVE_TYPES/LEAVE_TYPE_ALIASES and the
// Android app's LeaveType.kt - kept in the same `type` Firestore field the
// old binary 'short'/'full' values lived in, aliased forward here too so
// this daemon's emails describe old and new requests identically.
const LABELS = {
  foreignTrip: 'Foreign Trip',
  umrah: 'Umrah',
  medical: 'Medical',
  casualShort: 'Short Leave',
  casualFull: 'Full Leave'
};
const ALIASES = { short: 'casualShort', full: 'casualFull' };

function normalizeLeaveType(type) {
  return ALIASES[type] || type || 'casualShort';
}

function leaveTypeLabel(type) {
  return LABELS[normalizeLeaveType(type)] || 'Leave';
}

module.exports = { normalizeLeaveType, leaveTypeLabel };
