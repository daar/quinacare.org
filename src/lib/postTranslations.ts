import { getCollection } from "astro:content";
import type { Lang } from "../i18n";

// Build-time index linking the language variants of a post or fundraiser.
// Entries that share a `translationKey` are linked explicitly; entries
// without one fall back to a same-slug lookup, so identical slugs across
// languages link automatically without needing the key.
export type TranslateKind = "news" | "fundraisers";
const LANGS: Lang[] = ["nl", "en", "es"];

type KeyMap = Map<string, Partial<Record<Lang, string>>>;
type KindIndex = {
  keyToSlugs: KeyMap;
  slugToKey: Record<Lang, Map<string, string>>;
  allSlugs: Record<Lang, Set<string>>;
};

let indices: Record<TranslateKind, KindIndex> | null = null;

async function build(): Promise<void> {
  if (indices) return;
  const kinds: TranslateKind[] = ["news", "fundraisers"];
  indices = {} as Record<TranslateKind, KindIndex>;
  for (const kind of kinds) {
    const idx: KindIndex = {
      keyToSlugs: new Map(),
      slugToKey: { nl: new Map(), en: new Map(), es: new Map() },
      allSlugs: { nl: new Set(), en: new Set(), es: new Set() },
    };
    for (const lang of LANGS) {
      const entries = await getCollection(`${kind}-${lang}` as "news-nl");
      for (const p of entries) {
        const slug = p.data.slug || p.id;
        idx.allSlugs[lang].add(slug);
        const key = (p.data as { translationKey?: string }).translationKey;
        if (!key) continue;
        const entry = idx.keyToSlugs.get(key) ?? {};
        entry[lang] = slug;
        idx.keyToSlugs.set(key, entry);
        idx.slugToKey[lang].set(slug, key);
      }
    }
    indices[kind] = idx;
  }
}

/**
 * Returns a function that maps an entry slug from one language to its
 * counterpart in another, within the given collection kind (defaults to
 * "news"). Resolves via the shared translationKey first; if that yields
 * nothing but an entry with the same slug exists in the target language,
 * returns that same slug. Returns null when no translation can be found.
 */
export async function buildPostTranslator(): Promise<
  (slug: string, from: Lang, to: Lang, kind?: TranslateKind) => string | null
> {
  await build();
  return (slug, from, to, kind = "news") => {
    const idx = indices![kind];
    const key = idx.slugToKey[from].get(slug);
    if (key) {
      const linked = idx.keyToSlugs.get(key)?.[to];
      if (linked) return linked;
    }
    if (idx.allSlugs[to].has(slug)) return slug;
    return null;
  };
}
