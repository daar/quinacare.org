import { getCollection } from "astro:content";
import type { Lang } from "../i18n";

// Build-time index linking the language variants of a post. Posts that
// share a `translationKey` are linked explicitly; posts without one fall
// back to a same-slug lookup, so identical slugs across languages link
// automatically without needing the key.
type KeyMap = Map<string, Partial<Record<Lang, string>>>;
let keyToSlugs: KeyMap | null = null;
let slugToKey: Record<Lang, Map<string, string>> | null = null;
let allSlugs: Record<Lang, Set<string>> | null = null;

async function build(): Promise<void> {
  if (keyToSlugs && slugToKey && allSlugs) return;
  keyToSlugs = new Map();
  slugToKey = { nl: new Map(), en: new Map(), es: new Map() };
  allSlugs = { nl: new Set(), en: new Set(), es: new Set() };
  for (const lang of ["nl", "en", "es"] as Lang[]) {
    const posts = await getCollection(`news-${lang}` as "news-nl");
    for (const p of posts) {
      const slug = p.data.slug || p.id;
      allSlugs[lang].add(slug);
      const key = p.data.translationKey;
      if (!key) continue;
      const entry = keyToSlugs.get(key) ?? {};
      entry[lang] = slug;
      keyToSlugs.set(key, entry);
      slugToKey[lang].set(slug, key);
    }
  }
}

/**
 * Returns a function that maps a post slug from one language to its
 * counterpart in another. Resolves via the shared translationKey first;
 * if that yields nothing but a post with the same slug exists in the
 * target language, returns that same slug. Returns null when no
 * translation can be found either way.
 */
export async function buildPostTranslator(): Promise<
  (slug: string, from: Lang, to: Lang) => string | null
> {
  await build();
  return (slug, from, to) => {
    const key = slugToKey![from].get(slug);
    if (key) {
      const linked = keyToSlugs!.get(key)?.[to];
      if (linked) return linked;
    }
    if (allSlugs![to].has(slug)) return slug;
    return null;
  };
}
