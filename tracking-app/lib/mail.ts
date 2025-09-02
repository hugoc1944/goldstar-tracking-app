// lib/mail.ts
import { Resend } from 'resend';
import { ReactElement } from 'react';

let resend: Resend | null = null;
function getResend() {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY missing');
    resend = new Resend(key);
  }
  return resend;
}

export async function sendMail(opts: { to: string; subject: string; react: ReactElement }) {
  const from = process.env.EMAIL_FROM || 'no-reply@example.com';
  return getResend().emails.send({ from, to: opts.to, subject: opts.subject, react: opts.react });
}
