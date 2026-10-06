export const prerender = false;

import type { APIRoute } from "astro";
import { sendMail } from "../../../lib/mailer";
import {
  getSubscriber,
  updatePreferences,
  verifySubscriberToken,
  emailChangeToken,
  normaliseEmail,
  normaliseName,
  isLocale,
  PREFERENCES_PATH,
  type Locale,
} from "../../../lib/subscribers";

const CONFIRM_SUBJECT: Record<Locale, string> = {
  nl: "Bevestig je nieuwe e-mailadres",
  en: "Confirm your new email address",
  es: "Confirma tu nueva dirección de correo",
};

const CONFIRM_BODY: Record<Locale, (link: string) => string> = {
  nl: (link) =>
    `Je hebt gevraagd om de nieuwsbrief voortaan naar dit adres te sturen.\n\n` +
    `Klik op onderstaande link om dat te bevestigen:\n${link}\n\n` +
    `Heb je dit niet aangevraagd, doe dan niets — er verandert dan niets.\n\nQuina Care`,
  en: (link) =>
    `You asked us to send the newsletter to this address from now on.\n\n` +
    `Click the link below to confirm:\n${link}\n\n` +
    `If you did not ask for this, do nothing — nothing will change.\n\nQuina Care`,
  es: (link) =>
    `Has pedido que enviemos el boletín a esta dirección a partir de ahora.\n\n` +
    `Haz clic en el siguiente enlace para confirmarlo:\n${link}\n\n` +
    `Si no lo has solicitado, no hagas nada — no cambiará nada.\n\nQuina Care`,
};

export const POST: APIRoute = async ({ request, url }) => {
  const form = await request.formData();
  const id = Number(form.get("u"));
  const token = String(form.get("t") ?? "");
  const langRaw = form.get("lang");
  const lang: Locale = isLocale(langRaw) ? langRaw : "nl";
  const back = PREFERENCES_PATH[lang];

  if (!Number.isInteger(id) || id <= 0 || !verifySubscriberToken(id, token)) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${back}?status=error` },
    });
  }

  const current = await getSubscriber(id);
  if (!current) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${back}?status=error` },
    });
  }

  const locales = form
    .getAll("locale")
    .map(String)
    .filter(isLocale) as Locale[];
  const result = await updatePreferences(id, {
    name: normaliseName(form.get("name")),
    locales,
  });

  // A new address has to prove it wants the mail. The link they arrived
  // with was issued to the old address, so on its own it must not be
  // enough to point someone's newsletter somewhere else.
  let emailPending = false;
  const wanted = normaliseEmail(form.get("email"));
  if (wanted && wanted !== current.email) {
    const confirm =
      `${url.origin}/api/newsletter/confirm-email` +
      `?u=${id}&e=${encodeURIComponent(wanted)}` +
      `&t=${emailChangeToken(id, wanted)}&lang=${lang}`;
    try {
      await sendMail({
        to: wanted,
        subject: CONFIRM_SUBJECT[lang],
        text: CONFIRM_BODY[lang](confirm),
      });
      emailPending = true;
    } catch {
      // Mail is down; the rest of their changes still saved.
      emailPending = false;
    }
  }

  const status =
    result === "unsubscribed"
      ? "unsubscribed"
      : emailPending
        ? "check-email"
        : "saved";
  const query =
    result === "unsubscribed"
      ? `?u=${id}&t=${encodeURIComponent(token)}&status=${status}`
      : `?u=${id}&t=${encodeURIComponent(token)}&status=${status}`;

  return new Response(null, {
    status: 302,
    headers: { Location: `${back}${query}` },
  });
};
