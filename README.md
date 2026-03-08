# Quina Care Website

De officiële website van [Stichting Quina Care](https://www.quinacare.org), gebouwd met Astro, Markdoc en Tailwind CSS.

## Aan de slag

```sh
npm install        # Installeer dependencies
npm run dev        # Start de ontwikkelserver op localhost:4321
npm run build      # Bouw de productiesite naar ./dist/
npm run preview    # Bekijk de productie-build lokaal
npm run lint       # ESLint controle
npm run spellcheck # Spellingcontrole van alle .mdoc bestanden
npm run format:check # Prettier formatting controle
```

## Projectstructuur

```
src/
├── assets/media/          # Alle afbeeldingen (bereikbaar via /media/... paden)
├── components/
│   ├── markdoc/           # Herbruikbare markdoc-tag componenten
│   ├── Nav.astro          # Hoofdnavigatie
│   ├── Footer.astro       # Footer van de site
│   ├── Partners.astro     # Partnerbalk op de homepage
│   └── ...
├── content/
│   ├── news/{nl,en,es}/   # Nieuwsberichten (article layout)
│   └── pages/{nl,en,es}/  # Statische pagina's (article of landing layout)
├── data/
│   ├── menus.json         # Navigatiemenu-structuur
│   └── partners.ts        # Partners & sponsors data
├── i18n/
│   └── index.ts           # Alle UI-vertalingen (NL, EN, ES)
├── lib/
│   └── images.ts          # resolveImage() helper voor media-paden
├── pages/                 # Astro route handlers
└── styles/
    └── global.css         # Themakleuren, typografie, knopstijlen
```

## Talen (i18n)

De site ondersteunt drie talen:

| Taal                   | URL-prefix | Content-map         |
| ---------------------- | ---------- | ------------------- |
| Nederlands (standaard) | `/`        | `src/content/*/nl/` |
| Engels                 | `/en/`     | `src/content/*/en/` |
| Spaans                 | `/es/`     | `src/content/*/es/` |

Zorg er bij het toevoegen of bewerken van een pagina voor dat dezelfde slug in alle drie de taalmappen bestaat. UI-teksten (knoppen, labels, navigatie) staan in `src/i18n/index.ts`.

## Content-collecties

Alle content staat in `src/content/` en is gedefinieerd in `src/content.config.ts`. Er zijn vier collectietypes:

| Collectie   | Map                                   | Beschrijving                                             |
| ----------- | ------------------------------------- | -------------------------------------------------------- |
| News        | `src/content/news/{nl,en,es}/`        | Nieuwsberichten met datum, auteur, samenvatting          |
| Pages       | `src/content/pages/{nl,en,es}/`       | Statische pagina's (over ons, contact, ziekenhuis, etc.) |
| Projects    | `src/content/projects/{nl,en,es}/`    | Projectbeschrijvingen met status                         |
| Fundraisers | `src/content/fundraisers/{nl,en,es}/` | Fondsenwervingsacties met doelen en voortgang            |

## Veelvoorkomende taken

### Nieuwsbericht toevoegen

Maak een nieuw `.mdoc` bestand in `src/content/news/nl/` (en `en/`, `es/` voor vertalingen):

```yaml
---
title: "Titel van het bericht"
date: 2024-06-15
status: publish
slug: "bericht-slug"
author: "Quina Care"
excerpt: "Korte beschrijving voor de overzichtspagina."
language: "nl"
featured_image: "../../../assets/media/2024/06/hero-afbeelding.jpg"
---
Je content hier. Je kunt markdoc-tags gebruiken zoals {% image %} en {% video %}.
```

Het bericht verschijnt automatisch op de `/news` overzichtspagina, gesorteerd op datum.

### Statische pagina toevoegen

Maak een nieuw `.mdoc` bestand in `src/content/pages/nl/` (en `en/`, `es/`):

```yaml
---
title: "Paginatitel"
subtitle: "Optionele ondertitel"
category_label: "Sectielabel"
slug: "pagina-slug"
layout: "article"
featured_image: "../../../assets/media/2024/06/hero.jpg"
featured_image_alt: "Beschrijving"
---
```

Voor landingspagina's gebruik je `layout: "landing"` en bouw je de pagina op met markdoc-tags (zie hieronder). De pagina is bereikbaar op `/{slug}` (NL), `/en/{slug}` (EN), `/es/{slug}` (ES).

### Partner of sponsor toevoegen/bewerken

Bewerk `src/data/partners.ts`:

```ts
// Nieuwe partner toevoegen
{
  name: "Bedrijfsnaam",
  logo: "/media/2024/01/bedrijf-logo.png",  // afbeelding toevoegen aan src/assets/media/
  url: "https://bedrijf.nl",                // optioneel, maakt logo klikbaar
  premium: true,                            // toont op de homepage partnerbalk
},
```

Partners verschijnen op de `/become-partner` pagina. Premium partners worden ook op de homepage getoond.

Sponsors staan in de `sponsors` array in hetzelfde bestand en verschijnen in een apart gedeelte.

### Teamlid toevoegen

Bewerk de organisatiepagina's rechtstreeks: `src/content/pages/{nl,en,es}/organization.mdoc`. Voeg een `team-member` tag toe binnen de juiste `team-grid`:

```markdoc
{% team-member image="/media/2024/01/foto.png" name="Volledige Naam" role="Functie" email="naam@quinacare.org" %}
Korte bio-tekst hier.
{% /team-member %}
```

Vergeet niet de vermelding in alle drie de talen toe te voegen.

### Afbeeldingen toevoegen

1. Plaats de afbeelding in `src/assets/media/` volgens de jaar/maand-conventie (bijv. `src/assets/media/2024/06/mijn-afbeelding.jpg`)
2. Verwijs ernaar in content als `/media/2024/06/mijn-afbeelding.jpg` — de `resolveImage()` helper koppelt dit pad automatisch

### Navigatiemenu's bewerken

Bewerk `src/data/menus.json`. De structuur is:

```json
{
  "menuSleutel": {
    "label": { "nl": "Nederlands label", "en": "Engels label", "es": "Spaans label" },
    "items": [
      {
        "slug": "pagina-slug",
        "label": { "nl": "...", "en": "...", "es": "..." },
        "image": "/media/...",
        "meta": { ... }
      }
    ]
  }
}
```

### Project toevoegen

Maak een `.mdoc` bestand in `src/content/projects/{nl,en,es}/`:

```yaml
---
title: "Projectnaam"
slug: "project-slug"
excerpt: "Korte beschrijving"
featured_image: "../../../assets/media/2024/06/project.jpg"
featured_image_alt: "Beschrijving"
date: 2024-01-01
status: "active" # active | completed | upcoming
---
```

### Fondsenwervingsactie toevoegen

Maak een `.mdoc` bestand in `src/content/fundraisers/{nl,en,es}/`:

```yaml
---
title: "Naam actie"
slug: "actie-slug"
organizer: "Naam organisator"
excerpt: "Korte beschrijving"
goal_amount: 5000
raised_amount: 2500
backers: 42
start_date: 2024-01-01
end_date: 2024-12-31
status: "active" # active | completed | upcoming
---
```

### Footer bewerken

De footer staat in `src/components/Footer.astro`. Deze bevat:

- Contactgegevens (e-mail, adres)
- Organisatielinks
- Social media links
- Certificeringslogo's (opgeslagen in `public/images/certifications/`)
- Footertekst gebruikt vertaalsleutels uit `src/i18n/index.ts` (sleutels die beginnen met `footer.`)

### Homepage bewerken

De homepage staat in `src/pages/index.astro` (NL), met taalvarianten via het routeringssysteem. De premium partnerbalk op de homepage haalt data op uit `src/data/partners.ts` (partners met `premium: true`).

### Merkkleuren aanpassen

Bewerk `src/styles/global.css` — de themakleuren staan bovenaan gedefinieerd:

```css
--color-qcRed: #ee172c; /* Primair rood */
--color-qcBlack: #111111; /* Donkere tekst / achtergronden */
--color-qcGray: #fcfcfc; /* Lichtgrijze sectie-achtergronden */
```

Deze zijn beschikbaar als Tailwind-klassen: `text-qcRed`, `bg-qcBlack`, `bg-qcGray`, etc.

### Lettertype aanpassen

Het lettertype is gedefinieerd in `src/styles/global.css` als `--font-effra`. Lettertypebestanden en de `@font-face` declaraties staan ook in global.css.

## Pre-commit hooks

Bij elke commit draait [Husky](https://typicode.github.io/husky/) automatisch [lint-staged](https://github.com/lint-staged/lint-staged) met de volgende controles:

| Bestanden                       | Actie                                  |
| ------------------------------- | -------------------------------------- |
| `*.{js,ts,mjs,cjs,json,css,md}` | Prettier formatting                    |
| `*.astro`                       | Prettier formatting (met astro-plugin) |
| `*.mdoc`                        | cspell spellingcontrole                |

### Spellingcontrole (cspell)

De configuratie staat in `cspell.json` en ondersteunt drie talen met per-map taalherkenning:

- `src/content/**/nl/**` → Nederlands + Engels
- `src/content/**/en/**` → Engels
- `src/content/**/es/**` → Spaans + Engels

Projectspecifieke woorden (namen, plaatsen, medische termen) staan in `project-words.txt`. Voeg nieuwe woorden toe in de juiste categorie, altijd in lowercase.

Om de spellingcontrole handmatig op alle content te draaien:

```sh
npm run spellcheck
```

## Pagina-layouts

Er zijn twee pagina-layouts:

- **article** (standaard) — Standaard contentpagina met optionele full-width hero-afbeelding. Stel `featured_image` in de frontmatter in om een hero te tonen. Gebruikt voor nieuwsberichten en tekst-zware pagina's zoals `/hospital` en `/join-team`.

- **landing** — Sectie-gebaseerde layout die volledig wordt opgebouwd met markdoc-tags. Geen standaard opmaak — je stelt de pagina samen met `hero-banner`, `section`, `cta-banner`, etc. Gebruikt voor `/organization`, `/become-partner`, `/contact`, `/about`.

Stel de layout in via frontmatter:

```yaml
layout: "landing"
```

## Beschikbare markdoc-tags

Alle tags zijn geregistreerd in `markdoc.config.mjs` en renderen componenten uit `src/components/markdoc/`.

| Tag                         | Doel                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| `hero-banner`               | Full-width hero met achtergrondafbeelding, titel en ondertitel           |
| `section`                   | Paginasectie met optioneel label, titel en achtergrond (white/gray/dark) |
| `cta-banner`                | Call-to-action banner met knop                                           |
| `team-grid` / `team-member` | Teamleden-grid met ronde foto's                                          |
| `partner-grid`              | Automatisch gegenereerd partner- of sponsor-logogrid                     |
| `contact-form`              | Contactformulier met contactgegevens-zijbalk (meertalig)                 |
| `foundation-details`        | Gestileerde ANBI/KvK/RSIN-kaarten (meertalig)                            |
| `video`                     | Ingebedde HTML5 videospeler                                              |
| `image`                     | Geoptimaliseerde afbeelding met optionele uitlijning en bijschrift       |
| `download`                  | Download-linkknop                                                        |
| `tier-grid` / `tier-card`   | Donatieniveau-kaarten met prijzen                                        |
| `profile-section`           | Profiel met foto, naam, functie en citaat                                |
| `quote-block`               | Gestyled citaat met bronvermelding                                       |
| `feature-card`              | Icoonkaart met titel en beschrijving                                     |
| `contact-cards`             | Contactgegevens- of social media-kaarten                                 |

## Certificeringen

Certificeringslogo's in de navigatiebalk en footer staan in `public/images/certifications/`. ANBI en CBF verschijnen voor alle talen; Certified Nonprofit verschijnt alleen voor Engels.
