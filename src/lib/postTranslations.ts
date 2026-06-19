import { getCollection } from "astro:content";
import type { Lang } from "../i18n";

// Build-time index linking the language variants of a post by their shared
// `translationKey`, so the switcher can map one native slug to another.
type KeyMap = Map<string, Partial<Record<Lang, string>>>;
let keyToSlugs: KeyMap | null = null;
let slugToKey: Record<Lang, Map<string, string>> | null = null;

async function build(): Promise<void> {
  if (keyToSlugs && slugToKey) return;
  keyToSlugs = new Map();
  slugToKey = { nl: new Map(), en: new Map(), es: new Map() };
  for (const lang of ["nl", "en", "es"] as Lang[]) {
    const posts = await getCollection(`news-${lang}` as "news-nl");
    for (const p of posts) {
      const key = p.data.translationKey;
      if (!key) continue;
      const slug = p.data.slug || p.id;
      const entry = keyToSlugs.get(key) ?? {};
      entry[lang] = slug;
      keyToSlugs.set(key, entry);
      slugToKey[lang].set(slug, key);
    }
  }
}

/**
 * Returns a function that maps a post slug from one language to its
 * counterpart in another (via the shared translationKey), or null when
 * there is no linked translation.
 */
export async function buildPostTranslator(): Promise<
  (slug: string, from: Lang, to: Lang) => string | null
> {
  await build();
  return (slug, from, to) => {
    const key = slugToKey![from].get(slug);
    if (!key) return null;
    return keyToSlugs!.get(key)?.[to] ?? null;
  };
}
