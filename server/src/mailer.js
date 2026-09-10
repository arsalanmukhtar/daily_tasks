import nodemailer from 'nodemailer';

// Same GMAIL_USER/GMAIL_APP_PASSWORD convention push-daemon already uses
// (see push-daemon/README.md) - one Gmail account sends every transactional
// email this whole product needs (magic links, decision emails, uninformed
// leave reports). Skips silently (logged) if not configured, same as
// push-daemon does, so the API still runs locally without email set up.
const mailer =
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
      })
    : null;

export async function sendMail({ to, subject, html }) {
  if (!mailer) {
    console.log(`[mailer] GMAIL_USER/GMAIL_APP_PASSWORD not set - skipping email to ${to}: ${subject}`);
    return;
  }
  await mailer.sendMail({ from: `"Daily Tasks" <${process.env.GMAIL_USER}>`, to, subject, html });
}
