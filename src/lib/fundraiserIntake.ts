/**
 * Intake of supporter-proposed fundraisers.
 *
 * A visitor fills in the form at /acties/start; this module turns that
 * submission into something a maintainer can act on. It does not publish
 * anything — fundraisers stay `.mdoc` files written by hand, and this only
 * removes the several rounds of email it used to take to collect a title,
 * a goal, an end date, a story and a usable photo.
 *
 * Delivery is GitHub first, email second. An issue is assignable,
 * searchable and keeps the photo next to the text; a mailbox is where
 * these submissions used to get lost. Email stays as the fallback so a
 * submission is never dropped just because the API is unreachable — or
 * because GITHUB_TOKEN was never set, which is also how this behaves on a
 * fresh checkout.
 */
import type { Lang } from "../i18n";

/** Limits are shared with the client so both sides agree on what fits. */
export const INTAKE_LIMITS = {
  title: 120,
  organizer: 80,
  excerpt: 300,
  story: 20000,
  photoAlt: 200,
  email: 254,
  /** Same floor scripts/check-image-sizes.mjs enforces on the library. */
  minImageWidth: 1200,
  maxImageBytes: 8 * 1024 * 1024,
  /** A goal above this is almost always a typo (a stray zero). */
  maxGoal: 1_000_000,
  /** Extra material for the maintainer: logos, a route map, a poster. */
  maxAttachments: 5,
  maxAttachmentBytes: 10 * 1024 * 1024,
  maxAttachmentTotalBytes: 25 * 1024 * 1024,
} as const;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Attachments are looser than the cover photo: they are not published as
 * they are, so they only have to be something a maintainer can open.
 */
export const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

/** Minimum time a human plausibly needs for a form this long. */
export const MIN_FILL_MS = 8000;

export interface FundraiserIntake {
  title: string;
  organizer: string;
  excerpt: string;
  goalAmount: number;
  endDate: string; // ISO yyyy-mm-dd
  story: string;
  photoAlt: string;
  email: string;
  lang: Lang;
}

export type IntakeField = keyof FundraiserIntake | "photo" | "attachments";

export interface ValidationResult {
  ok: boolean;
  /** Field-keyed so the form can mark the offending input. */
  errors: Partial<Record<IntakeField, string>>;
  value: FundraiserIntake;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_LANGS = new Set<string>(["nl", "en", "es"]);

function str(form: FormData, key: string, max: number): string {
  return String(form.get(key) ?? "")
    .trim()
    .slice(0, max);
}

/**
 * Server-side validation. The browser checks the same things for a quicker
 * response, but nothing here trusts that — the endpoint is a public POST.
 */
export function validateIntake(form: FormData): ValidationResult {
  const errors: Partial<Record<IntakeField, string>> = {};

  const title = str(form, "title", INTAKE_LIMITS.title);
  const organizer = str(form, "organizer", INTAKE_LIMITS.organizer);
  const excerpt = str(form, "excerpt", INTAKE_LIMITS.excerpt);
  const story = str(form, "story", INTAKE_LIMITS.story);
  const photoAlt = str(form, "photoAlt", INTAKE_LIMITS.photoAlt);
  const email = str(form, "email", INTAKE_LIMITS.email).toLowerCase();
  const endDate = str(form, "endDate", 10);
  const rawLang = String(form.get("lang") ?? "nl");
  const lang = (ALLOWED_LANGS.has(rawLang) ? rawLang : "nl") as Lang;

  const goalAmount = Math.round(Number(form.get("goalAmount")));

  if (!title) errors.title = "required";
  if (!organizer) errors.organizer = "required";
  if (!excerpt) errors.excerpt = "required";
  if (!story) errors.story = "required";

  if (!email || !EMAIL_RE.test(email)) errors.email = "invalid";

  if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
    errors.goalAmount = "invalid";
  } else if (goalAmount > INTAKE_LIMITS.maxGoal) {
    errors.goalAmount = "too-large";
  }

  // A fundraiser that has already ended cannot be published, and the date
  // drives the "days to go" counter on the page.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    errors.endDate = "invalid";
  } else {
    const end = new Date(`${endDate}T23:59:59Z`);
    if (Number.isNaN(end.getTime())) {
      errors.endDate = "invalid";
    } else if (end.getTime() < Date.now()) {
      errors.endDate = "past";
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      title,
      organizer,
      excerpt,
      goalAmount,
      endDate,
      story,
      photoAlt,
      email,
      lang,
    },
  };
}

/**
 * A URL-safe, collision-resistant stem derived from the title. Only a
 * suggestion — the maintainer owns the real slug, and `translationKey`
 * has to be the Dutch one regardless of which language this was written in.
 */
export function suggestSlug(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "nieuwe-actie";
}

/** The frontmatter block, ready to paste into a new `.mdoc`. */
export function buildFrontmatter(
  intake: FundraiserIntake,
  imagePath: string,
): string {
  const slug = suggestSlug(intake.title);
  return [
    "---",
    "draft: true",
    `title: ${JSON.stringify(intake.title)}`,
    `slug: ${JSON.stringify(slug)}`,
    `translationKey: ${JSON.stringify(slug)}`,
    `organizer: ${JSON.stringify(intake.organizer)}`,
    `excerpt: ${JSON.stringify(intake.excerpt)}`,
    `goal_amount: ${intake.goalAmount}`,
    "raised_offset: 0",
    "backers_offset: 0",
    `end_date: ${intake.endDate}`,
    `featured_image: ${imagePath}`,
    `featured_image_alt: ${JSON.stringify(intake.photoAlt || intake.title)}`,
    "---",
  ].join("\n");
}

const LANG_NAME: Record<Lang, string> = {
  nl: "Nederlands",
  en: "English",
  es: "Español",
};

/**
 * The issue body. Two audiences in one document: a human reading what was
 * proposed, and a maintainer who wants to copy frontmatter without
 * retyping it. Hence the summary table first and the paste-ready block after.
 */
export interface UploadedFile {
  name: string;
  url: string | null;
  type: string;
}

export function buildIssueBody(
  intake: FundraiserIntake,
  photo: { url: string | null; note: string },
  attachments: UploadedFile[] = [],
): string {
  const lines = [
    `**${intake.organizer}** wil een actie starten voor Quina Care.`,
    "Ingediend via het formulier op de website.",
    "",
    "| | |",
    "| --- | --- |",
    `| Titel | ${intake.title} |`,
    `| Organisator | ${intake.organizer} |`,
    `| Doelbedrag | € ${intake.goalAmount.toLocaleString("nl-NL")} |`,
    `| Einddatum | ${intake.endDate} |`,
    `| Taal | ${LANG_NAME[intake.lang]} |`,
    `| Contact | ${intake.email} |`,
    "",
    "## Korte samenvatting",
    "",
    intake.excerpt,
    "",
    "## Verhaal",
    "",
    "Geschreven met de opmaakknoppen op het formulier, dus dit is Markdown",
    "en kan zo in de body van het `.mdoc`-bestand.",
    "",
    intake.story,
    "",
    "## Foto",
    "",
  ];

  if (photo.url) {
    lines.push(
      `![${intake.photoAlt || intake.title}](${photo.url})`,
      "",
      `Omschrijving: ${intake.photoAlt || "_niet opgegeven_"}`,
      "",
      `[Origineel bestand](${photo.url})`,
    );
  } else {
    lines.push(photo.note);
  }

  if (attachments.length) {
    lines.push("", "## Bijlagen", "");
    for (const file of attachments) {
      lines.push(
        file.url
          ? `- [${file.name}](${file.url})`
          : `- ${file.name} (meegestuurd per e-mail)`,
      );
    }
  }

  lines.push(
    "",
    "## Frontmatter",
    "",
    "Klaar om te plakken in een nieuw bestand onder",
    "`src/content/fundraisers/<taal>/`. Staat op `draft: true`: de actie is",
    "pas publiek als iemand dat bewust omzet. Controleer de slug en zorg dat",
    "`translationKey` de **Nederlandse** slug is.",
    "",
    "```yaml",
    buildFrontmatter(intake, "../../../assets/media/<jaar>/<maand>/<bestand>"),
    "```",
    "",
    "---",
    "",
    "Reageren op de indiener kan via bovenstaand e-mailadres — dat adres",
    "staat niet op de website.",
  );

  return lines.join("\n");
}

/** Plain-text version for the email fallback. */
export function buildEmailBody(intake: FundraiserIntake): string {
  return [
    "Nieuwe actie ingediend via het formulier op de website.",
    "",
    `Titel:       ${intake.title}`,
    `Organisator: ${intake.organizer}`,
    `Doelbedrag:  EUR ${intake.goalAmount}`,
    `Einddatum:   ${intake.endDate}`,
    `Taal:        ${LANG_NAME[intake.lang]}`,
    `Contact:     ${intake.email}`,
    "",
    "Korte samenvatting:",
    intake.excerpt,
    "",
    "Verhaal:",
    intake.story,
    "",
    `Fotobeschrijving: ${intake.photoAlt || "(niet opgegeven)"}`,
    "",
    "De foto zit als bijlage bij deze mail, samen met de extra bestanden",
    "die de indiener heeft meegestuurd.",
  ].join("\n");
}

/**
 * Read an image's pixel dimensions from its header.
 *
 * Done by hand rather than with Sharp: the only question is "is this photo
 * big enough to print sharply", the answer lives in the first few dozen
 * bytes of the file, and keeping a native module out of a serverless
 * function is worth forty lines. Returns null for anything unrecognised,
 * which the caller treats as an unusable file.
 */
export function imageSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // PNG: an IHDR chunk always starts at byte 8, dimensions at 16.
  if (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // WebP: "RIFF" .... "WEBP", then a VP8 / VP8L / VP8X chunk.
  if (
    bytes.length > 30 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const fourcc = String.fromCharCode(...bytes.subarray(12, 16));
    if (fourcc === "VP8 ") {
      // Lossy: 14 bytes of frame header, then 16-bit width and height.
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (fourcc === "VP8L") {
      // Lossless: 14 bits width, 14 bits height, both minus one.
      const bits =
        bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (fourcc === "VP8X") {
      // Extended: 24-bit little-endian canvas size, each minus one.
      return {
        width: (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1,
        height: (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1,
      };
    }
    return null;
  }

  // JPEG: walk the marker chain to the first start-of-frame.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      // Padding and standalone markers carry no length field.
      if (marker === 0xff || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const length = view.getUint16(i + 2);
      // SOF0-SOF15, skipping DHT (c4), JPG (c8) and DAC (cc).
      const isFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isFrame) {
        return {
          height: view.getUint16(i + 5),
          width: view.getUint16(i + 7),
        };
      }
      if (length < 2) return null;
      i += 2 + length;
    }
  }

  return null;
}
