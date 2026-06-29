export const prerender = false;

import type { APIRoute } from "astro";
import nodemailer from "nodemailer";
import { reportError } from "../../../lib/errors";

const SOURCE = "api/contact/send";
const CONTACT_TO_EMAIL = "care@quinacare.org";
// Minimum time a human plausibly takes to fill the form. Submissions faster
// than this are bots auto-posting the rendered form.
const MIN_FILL_MS = 3000;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name, email, subject, message, company, elapsedMs } =
      await request.json();

    // Invisible anti-spam (honeypot + time-trap). Return a 200 "ok" so the
    // bot believes it succeeded and doesn't retry/adapt — we just never send.
    const isSpam =
      (typeof company === "string" && company.trim() !== "") ||
      (typeof elapsedMs === "number" &&
        elapsedMs >= 0 &&
        elapsedMs < MIN_FILL_MS);
    if (isSpam) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (!name || !email || !subject || !message) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
      });
    }

    const host = import.meta.env.SMTP_HOST;
    const port = Number(import.meta.env.SMTP_PORT) || 587;
    const user = import.meta.env.SMTP_USER;
    const pass = import.meta.env.SMTP_PASS;
    // Authenticated sender — must be on a domain verified at the SMTP provider
    // (e.g. Resend). Visitor's address goes in replyTo so SPF/DKIM still pass.
    const from =
      import.meta.env.MAIL_FROM || "Quina Care <noreply@quinacare.org>";

    if (!host || !user || !pass) {
      reportError(
        SOURCE,
        "SMTP not configured: missing SMTP_HOST / SMTP_USER / SMTP_PASS",
      );
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500 },
      );
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transport.sendMail({
      from,
      to: CONTACT_TO_EMAIL,
      subject: `[${subject}] Message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      replyTo: `${name} <${email}>`,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    reportError(SOURCE, "send failed", err);
    const detail = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: detail }), { status: 500 });
  }
};
