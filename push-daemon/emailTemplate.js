const { leaveTypeLabel, normalizeLeaveType } = require('./leaveType');

const TIME_ZONE = 'Asia/Karachi';
const APP_URL = 'https://arsalanmukhtar.github.io/daily_tasks/';
const HISTORY_URL = APP_URL + '#my-leaves';

const FONT = "-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

// Leave-type chip colors, matching the web/Android apps' new --t-*/--d-*
// design tokens (see screens/mail-response.html) - a "family" chip for every
// type, plus a second "duration" chip only for the two casual types (the
// other three have no duration sub-choice).
const TYPE_CHIP_STYLE = {
  foreignTrip: 'background:#FDF0E4;color:#B45B0B;border:1px solid #F0CDA0;',
  umrah: 'background:#EAF3E6;color:#3F7D2C;border:1px solid #C7E0BB;',
  medical: 'background:#E4F2F9;color:#0B7FA8;border:1px solid #B2DAEA;',
  casualShort: 'background:#F0ECFB;color:#6C4CC4;border:1px solid #D3C8F0;',
  casualFull: 'background:#F0ECFB;color:#6C4CC4;border:1px solid #D3C8F0;'
};
const DURATION_CHIP_STYLE = 'background:#ECEBFA;color:#3730A3;border:1px solid #CBC9F0;';

function formatTime(timestamp) {
  if (!timestamp || !timestamp.toDate) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE
  }).format(timestamp.toDate());
}

function formatDate(timestamp, opts) {
  if (!timestamp || !timestamp.toDate) return '';
  return new Intl.DateTimeFormat(
    'en-GB',
    Object.assign({ timeZone: TIME_ZONE }, opts)
  ).format(timestamp.toDate());
}

// "3 Sept 2026" - used for the headline and the leave-date detail row.
function formatDayMonthYear(timestamp) {
  return formatDate(timestamp, { day: 'numeric', month: 'short', year: 'numeric' });
}

// "Thursday, 3 Sept 2026" - single-day leave-date detail row.
function formatWeekdayDayMonthYear(timestamp) {
  return formatDate(timestamp, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

// "3 Sept 2026, 10:16" - submitted timestamp.
function formatDateTime(timestamp) {
  const date = formatDayMonthYear(timestamp);
  const time = formatTime(timestamp);
  return date && time ? `${date}, ${time}` : date;
}

// Monday-Friday inclusive count between two Firestore Timestamps (used for
// the "N working day(s)" note under the leave date). Walks whole calendar
// days in the daemon's fixed timezone rather than diffing raw ms, so DST-free
// Asia/Karachi is safe either way.
function countWorkingDays(startTimestamp, endTimestamp) {
  if (!startTimestamp || !startTimestamp.toDate || !endTimestamp || !endTimestamp.toDate) return 0;
  const start = startTimestamp.toDate();
  const end = endTimestamp.toDate();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  // Normalize to UTC midnight for each calendar day in TIME_ZONE so DST/TZ
  // offsets can't shift which weekday a given day lands on.
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const toUtcMidnight = (date) => {
    const parts = dayFormatter.formatToParts(date).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };

  let cursor = Math.min(toUtcMidnight(start), toUtcMidnight(end));
  const last = Math.max(toUtcMidnight(start), toUtcMidnight(end));
  let count = 0;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  while (cursor <= last) {
    const weekday = new Date(cursor).getUTCDay(); // 0=Sun ... 6=Sat
    if (weekday >= 1 && weekday <= 5) count += 1;
    cursor += MS_PER_DAY;
  }
  return count;
}

function pluralWorkingDays(n) {
  return `${n} working day${n === 1 ? '' : 's'}`;
}

// First letters of the first and last "word" in a name, e.g.
// "Farah Bukhari" -> "FB", "Alice" -> "A".
function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function leaveTypeChipsHtml(type) {
  const normalized = normalizeLeaveType(type);
  const familyLabel = normalized === 'casualShort' || normalized === 'casualFull' ? 'Casual' : leaveTypeLabel(type);
  const familyStyle = TYPE_CHIP_STYLE[normalized] || TYPE_CHIP_STYLE.casualFull;
  const chipBase =
    `display:inline-block;border-radius:6px;padding:3px 9px;` +
    `font:600 12px/1.35 ${FONT};margin:0 6px 4px 0;`;

  let html = `<span style="${chipBase}${familyStyle}">${escapeHtml(familyLabel)}</span>`;

  if (normalized === 'casualShort' || normalized === 'casualFull') {
    const durationLabel = normalized === 'casualShort' ? 'Short leave' : 'Full leave';
    html += `<span style="${chipBase}${DURATION_CHIP_STYLE}">${escapeHtml(durationLabel)}</span>`;
  }

  return html;
}

// Renders the "Leave date" detail cell content: a single formatted date, or
// a formatted range when start/end differ, plus the week label and working
// day count underneath.
function leaveDateDetailHtml(data) {
  const start = data.startDate;
  const end = data.endDate;
  const sameDay =
    start && end && start.toDate && end.toDate && start.toDate().toDateString() === end.toDate().toDateString();

  let dateLine;
  if (start && end && !sameDay) {
    dateLine = `${formatDayMonthYear(start)} – ${formatDayMonthYear(end)}`;
  } else if (start) {
    dateLine = formatWeekdayDayMonthYear(start);
  } else {
    dateLine = '';
  }

  const workingDays = countWorkingDays(start, end || start);
  const subParts = [data.weekLabel, workingDays ? pluralWorkingDays(workingDays) : ''].filter(Boolean);

  const halfDayNote =
    normalizeLeaveType(data.type) === 'casualShort' && (data.halfDayPeriod === 'AM' || data.halfDayPeriod === 'PM')
      ? ` · ${data.halfDayPeriod}`
      : '';

  return {
    dateLine: escapeHtml(dateLine),
    subLine: escapeHtml(subParts.join(' · ')) + escapeHtml(halfDayNote),
    label: sameDay || !start || !end ? 'LEAVE DATE' : 'LEAVE DATES'
  };
}

function headlineDateText(data) {
  const start = data.startDate;
  const end = data.endDate;
  const sameDay =
    start && end && start.toDate && end.toDate && start.toDate().toDateString() === end.toDate().toDateString();
  if (start && end && !sameDay) {
    // "9–10 April" style short range for the headline sentence.
    const startFmt = formatDate(start, { day: 'numeric', month: 'long' });
    const endFmt = formatDate(end, { day: 'numeric', month: 'long' });
    return `${startFmt} – ${endFmt}`;
  }
  if (start) return formatDayMonthYear(start);
  return '';
}

function attachmentsDetailHtml(attachments) {
  const list = (attachments || []).filter((a) => a && a.url);
  if (list.length === 0) {
    return '<span style="color:#7A8698;">None</span>';
  }
  return list
    .map(
      (a) =>
        `<a href="${escapeAttr(a.url)}" style="color:#334155;text-decoration:underline;">${escapeHtml(
          a.name || 'Attachment'
        )}</a>`
    )
    .join('<br>');
}

// Builds the HTML email sent to an employee once their leave request is
// approved/rejected, matching the two employee-facing variants of the
// screens/mail-response.html mockup (a masthead, colored status rule,
// headline, details table, quoted reason, "decided by" panel with an
// initials avatar + optional decision note, and two CTA buttons).
function buildDecisionEmail(data) {
  const approved = data.status === 'approved';
  const name = data.name || 'there';
  const firstName = String(name).trim().split(/\s+/)[0] || name;
  const resolvedByName = data.resolvedBy || 'the manager';
  const typeLabel = leaveTypeLabel(data.type);
  const headlineDate = headlineDateText(data);
  const submittedText = formatDateTime(data.requestedAt);
  const decidedDateText = formatDayMonthYear(data.resolvedAt) || submittedText;
  const decidedTimeText = formatTime(data.resolvedAt);

  const statusPillStyle = approved
    ? 'background:#E9F7F1;border:1px solid #B4E3CF;color:#0A6B4A;'
    : 'background:#FCEDED;border:1px solid #F2C4C4;color:#A32C2C;';
  const ruleColor = approved ? '#12996B' : '#D64545';
  const decidedPanelStyle = approved
    ? 'background:#E9F7F1;border:1px solid #B4E3CF;'
    : 'background:#FCEDED;border:1px solid #F2C4C4;';
  const decidedAvatarBg = approved ? '#12996B' : '#D64545';
  const decidedTitleColor = approved ? '#0A6B4A' : '#A32C2C';
  const decidedNoteColor = approved ? '#3F7F62' : '#8C4141';

  const headline = approved
    ? `Your ${escapeHtml(typeLabel.toLowerCase())} for ${escapeHtml(headlineDate)} is approved`
    : `Your ${escapeHtml(typeLabel.toLowerCase())} for ${escapeHtml(headlineDate)} was not approved`;

  const subhead = approved
    ? `Hello ${escapeHtml(firstName)} — ${escapeHtml(resolvedByName)} approved this request` +
      (decidedDateText ? ` on ${escapeHtml(decidedDateText)}${decidedTimeText ? ` at ${escapeHtml(decidedTimeText)}` : ''}` : '') +
      `. Nothing further is needed from you.`
    : `Hello ${escapeHtml(firstName)} — ${escapeHtml(resolvedByName)} reviewed this` +
      (decidedDateText ? ` on ${escapeHtml(decidedDateText)}` : '') +
      `. You can submit a new request for different dates whenever you are ready.`;

  const dateDetail = leaveDateDetailHtml(data);

  const decidedMetaText = [decidedDateText, decidedTimeText].filter(Boolean).join(' · ');
  const decidedMetaHtml = decidedMetaText
    ? `<div style="margin-top:2px;font:400 12px/1.35 ${FONT};color:${decidedNoteColor};">${escapeHtml(decidedMetaText)}</div>`
    : '';
  const decidedNoteHtml =
    data.decisionNote && String(data.decisionNote).trim()
      ? `<div style="margin-top:3px;font:400 12.5px/1.5 ${FONT};color:${decidedNoteColor};">&#8220;${escapeHtml(
          String(data.decisionNote).trim()
        )}&#8221;</div>`
      : '';

  const primaryCta = approved
    ? { href: APP_URL, label: 'Open in Tech EW', bg: '#E8590C', color: '#FFFFFF' }
    : { href: APP_URL, label: 'Request different dates', bg: '#E8590C', color: '#FFFFFF' };

  const html = `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    `${approved ? 'Approved' : 'Not approved'} — ${typeLabel}, ${data.weekLabel || ''}, ${headlineDate}. Decided by ${resolvedByName}.`
  )}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F4;">
<tr><td align="center" style="padding:32px 12px;">

  <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">

    <!-- masthead -->
    <tr><td style="padding:0 4px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:700 13px/1.2 ${FONT};color:#0F172A;letter-spacing:-.01em;">
          <span style="display:inline-block;width:9px;height:9px;background:#E8590C;border-radius:2px;margin-right:8px;"></span>Tech EW
        </td>
        <td align="right" style="font:400 12px/1.2 ${FONT};color:#7A8698;">Leave decision</td>
      </tr></table>
    </td></tr>

    <!-- card -->
    <tr><td style="background:#FFFFFF;border:1px solid #E3E8EF;border-radius:14px;overflow:hidden;">

      <!-- status rule -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td height="4" style="height:4px;line-height:4px;font-size:0;background:${ruleColor};">&nbsp;</td>
      </tr></table>

      <!-- headline -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="gut" style="padding:26px 32px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="${statusPillStyle}border-radius:999px;padding:5px 12px;
                       font:700 11px/1 ${FONT};letter-spacing:.06em;">
              ${approved ? 'APPROVED' : 'NOT APPROVED'}
            </td>
          </tr></table>

          <p class="h1" style="margin:16px 0 0;font:700 23px/1.3 ${FONT};color:#0F172A;letter-spacing:-.02em;">
            ${headline}
          </p>
          <p style="margin:9px 0 0;font:400 14px/1.6 ${FONT};color:#5A6879;">
            ${subhead}
          </p>
        </td>
      </tr></table>

      <!-- details -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="gut" style="padding:22px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid #E9EDF3;border-radius:12px;background:#FAFBFD;">

            <tr>
              <td width="50%" class="stackcell" style="padding:14px 16px 10px;border-right:1px solid #E9EDF3;">
                <div style="font:700 10px/1 ${FONT};color:#93A0B0;letter-spacing:.07em;">LEAVE TYPE</div>
                <div style="margin-top:6px;">
                  ${leaveTypeChipsHtml(data.type)}
                </div>
              </td>
              <td width="50%" class="stackcell" style="padding:14px 16px 10px;">
                <div style="font:700 10px/1 ${FONT};color:#93A0B0;letter-spacing:.07em;">${dateDetail.label}</div>
                <div style="margin-top:6px;font:600 14px/1.35 ${FONT};color:#0F172A;">
                  ${dateDetail.dateLine}
                </div>
                <div style="margin-top:2px;font:400 12px/1.35 ${FONT};color:#7A8698;">
                  ${dateDetail.subLine}
                </div>
              </td>
            </tr>

            <tr><td colspan="2" style="border-top:1px solid #E9EDF3;font-size:0;line-height:0;">&nbsp;</td></tr>

            <tr>
              <td width="50%" class="stackcell" style="padding:12px 16px 14px;border-right:1px solid #E9EDF3;">
                <div style="font:700 10px/1 ${FONT};color:#93A0B0;letter-spacing:.07em;">SUBMITTED</div>
                <div style="margin-top:5px;font:500 13px/1.35 ${FONT};color:#334155;">
                  ${escapeHtml(submittedText)}
                </div>
              </td>
              <td width="50%" class="stackcell" style="padding:12px 16px 14px;">
                <div style="font:700 10px/1 ${FONT};color:#93A0B0;letter-spacing:.07em;">ATTACHMENTS</div>
                <div style="margin-top:5px;font:500 13px/1.35 ${FONT};color:#334155;">
                  ${attachmentsDetailHtml(data.attachments)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr></table>

      <!-- reason -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="gut" style="padding:18px 32px 0;">
          <div style="font:700 10px/1 ${FONT};color:#93A0B0;letter-spacing:.07em;">YOUR REASON</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr><td style="border-left:3px solid #E3E8EF;padding:2px 0 2px 14px;
                           font:400 14px/1.6 ${FONT};color:#334155;">
              ${data.reasonHtml || '<i>No reason provided.</i>'}
            </td></tr>
          </table>
        </td>
      </tr></table>

      <!-- decided by -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="gut" style="padding:22px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="${decidedPanelStyle}border-radius:12px;">
            <tr>
              <td width="42" style="padding:13px 0 13px 14px;" valign="top">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td width="30" height="30" align="center" valign="middle"
                      style="width:30px;height:30px;background:${decidedAvatarBg};border-radius:99px;
                             font:700 11px/30px ${FONT};color:#FFFFFF;">${escapeHtml(initials(resolvedByName))}</td>
                </tr></table>
              </td>
              <td style="padding:13px 14px 13px 10px;">
                <div style="font:700 13px/1.35 ${FONT};color:${decidedTitleColor};">${
    approved ? 'Approved' : 'Declined'
  } by ${escapeHtml(resolvedByName)}</div>
                ${decidedMetaHtml}
                ${decidedNoteHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr></table>

      <!-- cta -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="gut" style="padding:20px 32px 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" class="btn"><tr>
            <td style="background:${primaryCta.bg};border-radius:9px;">
              <a href="${escapeAttr(primaryCta.href)}" style="display:inline-block;padding:12px 22px;font:600 14px/1 ${FONT};color:${primaryCta.color};">${escapeHtml(
    primaryCta.label
  )}</a>
            </td>
            <td width="10" style="font-size:0;line-height:0;">&nbsp;</td>
            <td style="border:1px solid #DDE3EB;border-radius:9px;">
              <a href="${escapeAttr(HISTORY_URL)}" style="display:inline-block;padding:11px 20px;font:600 14px/1 ${FONT};color:#475569;">View leave history</a>
            </td>
          </tr></table>
        </td>
      </tr></table>

    </td></tr>

    <!-- footer -->
    <tr><td class="gut" style="padding:16px 8px 0;">
      <p style="margin:0;font:400 11.5px/1.7 ${FONT};color:#8593A5;">
        Sent by Tech EW because you submitted a leave request. Internal use only.<br>
        Replies to this address are not monitored — raise anything else with ${escapeHtml(resolvedByName)}.
      </p>
    </td></tr>

  </table>

</td></tr>
</table>`.trim();

  const subject = `${approved ? 'Approved' : 'Not approved'} — ${typeLabel}${
    data.weekLabel ? `, ${data.weekLabel}` : ''
  }${headlineDate ? `, ${headlineDate}` : ''}. Decided by ${resolvedByName}.`;

  return { subject, html };
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
