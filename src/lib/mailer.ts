// Thin nodemailer wrapper. Reads SMTP credentials from the same env
// vars as src/pages/api/contact/send.ts so all transactional mail
// goes out through the same configured provider (e.g. Resend).

import nodemailer from "nodemailer";

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export async function sendMail(payload: MailPayload): Promise<void> {
  const host = import.meta.env.SMTP_HOST;
  const port = Number(import.meta.env.SMTP_PORT) || 587;
  const user = import.meta.env.SMTP_USER;
  const pass = import.meta.env.SMTP_PASS;
  // Authenticated sender must be on a domain verified at the SMTP
  // provider; the visitor's address goes in replyTo so SPF/DKIM pass.
  const from =
    import.meta.env.MAIL_FROM || "Quina Care <noreply@quinacare.org>";

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured: set SMTP_HOST / SMTP_USER / SMTP_PASS in .env",
    );
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transport.sendMail({ from, ...payload });
}
