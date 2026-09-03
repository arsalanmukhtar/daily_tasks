const { leaveTypeLabel } = require('./leaveType');

const TIME_ZONE = 'Asia/Karachi';

const CHIP_STYLE =
  'display:inline-block;background:#f1f5f9;color:#334155;font-size:12px;font-weight:600;' +
  'padding:5px 10px;border-radius:8px;margin:0 6px 6px 0;';

function formatTime(timestamp) {
  if (!timestamp || !timestamp.toDate) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE
  }).format(timestamp.toDate());
}

// Builds the HTML email sent to an employee once their leave request is
// approved/rejected - the same chip shape (Type / Week / Timestamp) and
// reasonHtml the apps already show, plus a prominent colored status banner
// matching the apps' StatusApproved/StatusRejected colors.
function buildDecisionEmail(data) {
  const approved = data.status === 'approved';
  const statusWord = approved ? 'Approved' : 'Rejected';
  const bannerColor = approved ? '#166534' : '#991b1b';
  const bannerBg = approved ? '#dcfce7' : '#fee2e2';
  const time = formatTime(data.requestedAt);

  const chips = [leaveTypeLabel(data.type), data.weekLabel || '']
    .concat(time ? [time] : [])
    .filter(Boolean)
    .map((c) => `<span style="${CHIP_STYLE}">${escapeHtml(c)}</span>`)
    .join('');

  const attachmentsHtml = (data.attachments || [])
    .filter((a) => a && a.url)
    .map(
      (a) =>
        `<div style="margin-top:6px;"><a href="${escapeAttr(a.url)}" style="color:#c2410c;font-weight:600;text-decoration:none;">${escapeHtml(
          a.name || 'Attachment'
        )}</a></div>`
    )
    .join('');

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <p>Hi ${escapeHtml(data.name || 'there')},</p>
  <p>Your leave request has been <strong>${statusWord.toLowerCase()}</strong>.</p>

  <div style="margin:16px 0;">${chips}</div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:16px 0;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Reason</div>
    <div style="font-size:14px;line-height:1.5;color:#334155;">${data.reasonHtml || '<i>No reason provided.</i>'}</div>
    ${attachmentsHtml}
  </div>

  <div style="background:${bannerBg};color:${bannerColor};border-radius:10px;padding:14px 16px;text-align:center;font-size:16px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;margin:20px 0;">
    ${statusWord}
  </div>

  <p style="color:#64748b;font-size:13px;">Decided by <strong>${escapeHtml(data.resolvedBy || 'the manager')}</strong>.</p>
</div>`.trim();

  return {
    subject: `Your leave request has been ${statusWord.toLowerCase()}`,
    html
  };
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

module.exports = { buildDecisionEmail };
