// Translate an ISO 3166-1 alpha-2 country code into the locale-
// appropriate display name via the platform's Intl.DisplayNames
// (e.g. "NL" → "Nederland" / "Netherlands" / "Países Bajos"). Falls
// back to the raw code if the platform can't translate it.

import type { Lang } from "../i18n";

const cache = new Map<string, Intl.DisplayNames>();

function getDisplay(lang: Lang): Intl.DisplayNames | null {
  if (cache.has(lang)) return cache.get(lang) ?? null;
  try {
    const dn = new Intl.DisplayNames([lang], { type: "region" });
    cache.set(lang, dn);
    return dn;
  } catch {
    return null;
  }
}

export function countryName(code: string, lang: Lang): string {
  const dn = getDisplay(lang);
  if (!dn) return code;
  try {
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
