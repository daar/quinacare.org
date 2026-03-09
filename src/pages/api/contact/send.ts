export const prerender = false;

import type { APIRoute } from "astro";
import nodemailer from "nodemailer";

export const POST: APIRoute = async ({ request }) => {
  const { name, email, subject, message } = await request.json();

  if (!name || !email || !subject || !message) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
    });
  }

  const transport = nodemailer.createTransport({
    host: import.meta.env.SMTP_HOST,
    port: Number(import.meta.env.SMTP_PORT),
    auth: {
      user: import.meta.env.SMTP_USER,
      pass: import.meta.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: `"${name}" <${email}>`,
    to: import.meta.env.CONTACT_TO_EMAIL || "care@quinacare.org",
    subject: `[${subject}] Message from ${name}`,
    text: `From: ${name} (${email})\n\n${message}`,
    replyTo: email,
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
