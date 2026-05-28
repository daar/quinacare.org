// POST /api/putumayo-loop/contact-hub
//
// Receives a "I'd like to organize a Putumayo Loop hub" inquiry from
// the public modal and forwards it to the run manager by email.

export const prerender = false;

import type { APIRoute } from "astro";
import { sendMail } from "../../../lib/mailer";
import { runManager } from "../../../data/putumayoLoop";

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
    });
  }

  try {
    await sendMail({
      to: runManager.email,
      subject: `[Putumayo Loop hub] Inquiry from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      replyTo: `${name} <${email}>`,
    });
  } catch (err) {
    console.error("[putumayo-loop/contact-hub] mail failed:", err);
    return new Response(
      JSON.stringify({ error: "Could not send your message" }),
      { status: 500 },
    );
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
