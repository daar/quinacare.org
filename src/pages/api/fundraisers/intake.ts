export const prerender = false;

import type { APIRoute } from "astro";
import { reportError } from "../../../lib/errors";
import { sendMail } from "../../../lib/mailer";
import {
  githubConfig,
  uploadIntakeImage,
  createIssue,
} from "../../../lib/github";
import {
  validateIntake,
  imageSize,
  suggestSlug,
  buildIssueBody,
  buildEmailBody,
  INTAKE_LIMITS,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_ATTACHMENT_TYPES,
  MIN_FILL_MS,
  type UploadedFile,
} from "../../../lib/fundraiserIntake";

const SOURCE = "api/fundraisers/intake";
const INTAKE_TO_EMAIL =
  import.meta.env.CONTACT_TO_EMAIL || "care@quinacare.org";
const ISSUE_LABEL = "fundraiser-intake";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Strip anything that would change where an upload path points. */
function safeName(name: string): string {
  return (
    name
      .replace(/[^\w.-]+/g, "-")
      .replace(/^[-.]+/, "")
      .slice(0, 80) || "bijlage"
  );
}

/** Same 200 a spam submission gets: the bot believes it worked and stops. */
const silentOk = () =>
  new Response(JSON.stringify({ ok: true }), { status: 200 });

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "invalid-form" }, 400);
    }

    // Invisible anti-spam, same pair as the contact form: a field no
    // person can see, and a floor on how fast the form can be filled in.
    const honeypot = String(form.get("company") ?? "").trim();
    const elapsedMs = Number(form.get("elapsedMs"));
    if (
      honeypot !== "" ||
      (Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < MIN_FILL_MS)
    ) {
      return silentOk();
    }

    const { ok, errors, value } = validateIntake(form);

    // The photo is required. It is the single thing that most often stalls
    // a fundraiser, and it is far cheaper to say so while someone is still
    // looking at the form than to chase them a week later.
    const photo = form.get("photo");
    let bytes: Uint8Array | null = null;
    let contentType = "";

    if (!(photo instanceof File) || photo.size === 0) {
      errors.photo = "required";
    } else if (!ALLOWED_IMAGE_TYPES.has(photo.type)) {
      errors.photo = "type";
    } else if (photo.size > INTAKE_LIMITS.maxImageBytes) {
      errors.photo = "too-large";
    } else {
      bytes = new Uint8Array(await photo.arrayBuffer());
      contentType = photo.type;
      const size = imageSize(bytes);
      if (!size) {
        errors.photo = "unreadable";
      } else if (size.width < INTAKE_LIMITS.minImageWidth) {
        errors.photo = "too-small";
      }
    }

    // Extra material for the maintainer — a route map, a sponsor logo, a
    // poster. Not published as-is, so the accepted types are looser than
    // the cover photo's, but the count and size still have a ceiling.
    const extras = form
      .getAll("attachments")
      .filter((f): f is File => f instanceof File && f.size > 0);

    let attachmentBytes = 0;
    for (const file of extras) attachmentBytes += file.size;

    if (extras.length > INTAKE_LIMITS.maxAttachments) {
      errors.attachments = "too-many";
    } else if (extras.some((f) => !ALLOWED_ATTACHMENT_TYPES.has(f.type))) {
      errors.attachments = "type";
    } else if (
      extras.some((f) => f.size > INTAKE_LIMITS.maxAttachmentBytes) ||
      attachmentBytes > INTAKE_LIMITS.maxAttachmentTotalBytes
    ) {
      errors.attachments = "too-large";
    }

    if (!ok || errors.photo || errors.attachments) {
      return json({ error: "validation", fields: errors }, 400);
    }

    const extraFiles = await Promise.all(
      extras.map(async (file) => ({
        name: safeName(file.name),
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );

    const stem = suggestSlug(value.title);
    const filename = `${stem}.${EXTENSION[contentType] ?? "jpg"}`;
    const issueTitle = `Nieuwe actie: ${value.title} (${value.organizer})`;

    // GitHub first — an issue is assignable, searchable, and keeps the
    // photo beside the text. Email is the fallback so nothing is lost
    // when the API is unreachable or GITHUB_TOKEN was never set.
    const cfg = githubConfig();
    // One folder per submission keeps the cover photo and its attachments
    // together, and dating it means two fundraisers with the same title
    // cannot overwrite each other.
    const folder = `intake/${new Date().toISOString().slice(0, 10)}-${stem}`;

    if (cfg) {
      try {
        const url = await uploadIntakeImage(
          cfg,
          `${folder}/${filename}`,
          bytes!,
        );
        const uploaded: UploadedFile[] = [];
        for (const file of extraFiles) {
          uploaded.push({
            name: file.name,
            type: file.type,
            url: await uploadIntakeImage(
              cfg,
              `${folder}/bijlagen/${file.name}`,
              file.bytes,
            ),
          });
        }
        const issueUrl = await createIssue(cfg, {
          title: issueTitle,
          body: buildIssueBody(value, { url, note: "" }, uploaded),
          label: ISSUE_LABEL,
        });
        await confirmToSubmitter(value.email, value.lang, value.title);
        return json({ ok: true, delivered: "github", url: issueUrl }, 200);
      } catch (err) {
        // Fall through to email; the submission itself is still good.
        reportError(SOURCE, "GitHub intake failed, falling back to email", err);
      }
    }

    await sendMail({
      to: INTAKE_TO_EMAIL,
      subject: issueTitle,
      text: buildEmailBody(value),
      replyTo: `${value.organizer} <${value.email}>`,
      attachments: [
        { filename, content: Buffer.from(bytes!), contentType },
        ...extraFiles.map((f) => ({
          filename: f.name,
          content: Buffer.from(f.bytes),
          contentType: f.type,
        })),
      ],
    });
    await confirmToSubmitter(value.email, value.lang, value.title);
    return json({ ok: true, delivered: "email" }, 200);
  } catch (err) {
    reportError(SOURCE, "intake failed", err);
    return json({ error: "server" }, 500);
  }
};

const CONFIRMATION: Record<string, { subject: string; body: string }> = {
  nl: {
    subject: "We hebben je actie ontvangen",
    body: "Hoi,\n\nJe hebt zojuist een actie voor Quina Care ingediend: “{title}”.\n\nWe lezen hem door en zetten hem voor je klaar op de website. Meestal hoor je binnen een week van ons. Klopt er iets niet, of wil je nog iets aanvullen? Antwoord dan gewoon op deze mail.\n\nDank je wel — het team van Quina Care",
  },
  en: {
    subject: "We received your fundraiser",
    body: "Hi,\n\nYou have just submitted a fundraiser for Quina Care: “{title}”.\n\nWe will read it through and set it up on the website for you. You will usually hear from us within a week. Anything wrong, or something you would like to add? Just reply to this email.\n\nThank you — the Quina Care team",
  },
  es: {
    subject: "Hemos recibido tu campaña",
    body: "Hola:\n\nAcabas de enviar una campaña para Quina Care: “{title}”.\n\nLa leeremos y la prepararemos en el sitio web. Normalmente tendrás noticias nuestras en una semana. ¿Hay algo incorrecto o quieres añadir algo? Responde a este correo.\n\nGracias — el equipo de Quina Care",
  },
};

/**
 * Tell the submitter it arrived. Best-effort: a failure here must not turn
 * a delivered submission into an error on their screen.
 */
async function confirmToSubmitter(
  email: string,
  lang: string,
  title: string,
): Promise<void> {
  try {
    const copy = CONFIRMATION[lang] ?? CONFIRMATION.nl;
    await sendMail({
      to: email,
      subject: copy.subject,
      text: copy.body.replace("{title}", title),
      replyTo: INTAKE_TO_EMAIL,
    });
  } catch (err) {
    reportError(SOURCE, "confirmation mail to submitter failed", err);
  }
}
