export const languages = {
  nl: 'Nederlands',
  en: 'English',
  es: 'Español',
} as const;

export const defaultLang = 'nl' as const;

export type Lang = keyof typeof languages;

export const ui = {
  nl: {
    'nav.whatCanYouDo': 'Wat kun jij doen?',
    'nav.whatDoWeDo': 'Wat doen wij?',
    'nav.whoAreWe': 'Wie zijn wij?',
    'nav.news': 'Actueel',
    'nav.donate': 'Doneer Nu',
    'news.title': 'ACTUEEL',
    'news.subtitle': 'Onze Verhalen',
    'news.all': 'Alles',
    'news.vlogs': 'Vlogs',
    'news.articles': 'Artikelen',
    'news.updates': 'Updates',
    'news.readPost': 'Lees bericht',
    'news.page': 'Pagina',
    'post.readingTime': 'min leestijd',
    'post.shareStory': 'Deel dit verhaal',
    'post.aboutAuthor': 'Over de auteur',
    'post.authorBio': 'Quina Care zet zich in voor medische zorg in de meest afgelegen gebieden van de Amazone.',
    'post.continueReading': 'Verder Lezen',
    'post.next': 'Volgende',
    'post.previous': 'Vorige',
    'category.article': 'Artikel',
    'category.vlog': 'Vlog',
    'category.update': 'Update',
  },
  en: {
    'nav.whatCanYouDo': 'What can you do?',
    'nav.whatDoWeDo': 'What do we do?',
    'nav.whoAreWe': 'Who are we?',
    'nav.news': 'News',
    'nav.donate': 'Donate Now',
    'news.title': 'NEWS',
    'news.subtitle': 'Our Stories',
    'news.all': 'All',
    'news.vlogs': 'Vlogs',
    'news.articles': 'Articles',
    'news.updates': 'Updates',
    'news.readPost': 'Read post',
    'news.page': 'Page',
    'post.readingTime': 'min read',
    'post.shareStory': 'Share this story',
    'post.aboutAuthor': 'About the author',
    'post.authorBio': 'Quina Care is committed to providing medical care in the most remote areas of the Amazon.',
    'post.continueReading': 'Continue Reading',
    'post.next': 'Next',
    'post.previous': 'Previous',
    'category.article': 'Article',
    'category.vlog': 'Vlog',
    'category.update': 'Update',
  },
  es: {
    'nav.whatCanYouDo': '¿Qué puedes hacer?',
    'nav.whatDoWeDo': '¿Qué hacemos?',
    'nav.whoAreWe': '¿Quiénes somos?',
    'nav.news': 'Noticias',
    'nav.donate': 'Donar Ahora',
    'news.title': 'NOTICIAS',
    'news.subtitle': 'Nuestras Historias',
    'news.all': 'Todo',
    'news.vlogs': 'Vlogs',
    'news.articles': 'Artículos',
    'news.updates': 'Actualizaciones',
    'news.readPost': 'Leer artículo',
    'news.page': 'Página',
    'post.readingTime': 'min de lectura',
    'post.shareStory': 'Comparte esta historia',
    'post.aboutAuthor': 'Sobre el autor',
    'post.authorBio': 'Quina Care se dedica a brindar atención médica en las zonas más remotas del Amazonas.',
    'post.continueReading': 'Seguir Leyendo',
    'post.next': 'Siguiente',
    'post.previous': 'Anterior',
    'category.article': 'Artículo',
    'category.vlog': 'Vlog',
    'category.update': 'Actualización',
  },
} as const;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang in languages) {
    return lang as Lang;
  }
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof typeof ui[typeof defaultLang]): string {
    return ui[lang][key] || ui[defaultLang][key];
  };
}

export function getLocalizedPath(path: string, lang: Lang): string {
  // Remove any existing language prefix
  const cleanPath = path.replace(/^\/(nl|en|es)/, '');

  // For default language, don't add prefix
  if (lang === defaultLang) {
    return cleanPath || '/';
  }

  return `/${lang}${cleanPath}`;
}

export function getDateLocale(lang: Lang): string {
  const locales: Record<Lang, string> = {
    nl: 'nl-NL',
    en: 'en-US',
    es: 'es-ES',
  };
  return locales[lang];
}

export function getCollectionName(lang: Lang): 'news-nl' | 'news-en' | 'news-es' {
  return `news-${lang}` as const;
}

export function getAlternateUrls(currentUrl: URL): { lang: Lang; url: string }[] {
  const pathname = currentUrl.pathname;
  const origin = currentUrl.origin;

  return (Object.keys(languages) as Lang[]).map((lang) => ({
    lang,
    url: `${origin}${getLocalizedPath(pathname, lang)}`,
  }));
}
