---
name: Quina Care
description: Healthcare nonprofit in the Ecuadorian Amazon
colors:
  qc-red: "#e6172c"
  qc-black: "#111111"
  qc-gray: "#fcfcfc"
  qc-red-hover: "#b8422e"
  text-primary: "#6b7280"
  text-light: "rgba(255, 255, 255, 0.85)"
  pill-bg: "#f3f4f6"
  pill-hover: "#e5e7eb"
  pill-text: "#4b5563"
  border-gray: "#e5e7eb"
typography:
  label:
    fontFamily: "Arimo, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "0.1em"
  heading:
    fontFamily: "Effra, sans-serif"
    fontSize: "clamp(1.5rem, 5vw, 3.5rem)"
    fontWeight: 700
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Arimo, sans-serif"
    fontSize: "18px"
    lineHeight: 1.6
  meta:
    fontFamily: "Arimo, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.2em"
  button:
    fontFamily: "Arimo, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "0.1em"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
rounded:
  sm: "6px"
  pill: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.qc-red}"
    textColor: "white"
    padding: "1rem 2rem"
    rounded: "{rounded.sm}"
  button-primary-hover:
    backgroundColor: "{colors.qc-black}"
    textColor: "white"
  button-secondary:
    backgroundColor: "{colors.qc-black}"
    textColor: "white"
    padding: "1rem 2rem"
    rounded: "{rounded.sm}"
  button-secondary-hover:
    backgroundColor: "{colors.qc-red}"
    textColor: "white"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.qc-black}"
    padding: "1rem 2rem"
    rounded: "{rounded.sm}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.qc-red}"
  pill-filter:
    backgroundColor: "{colors.pill-bg}"
    textColor: "{colors.pill-text}"
    padding: "0.6rem 1.15rem"
    rounded: "{rounded.pill}"
  pill-active:
    backgroundColor: "{colors.qc-black}"
    textColor: "white"
---

# Design System: Quina Care

## Overview

**Creative North Star: "The Impact Clarity"**

Quina Care's visual system is direct, authentic, and mission-driven. Built on warmth, trust, and radical transparency, every design choice serves to connect donors with real outcomes. The system favors authentic photography of real staff and real hospital work over abstraction. Color is purposeful—warm reds anchor emotional connection and call-to-action, while black provides stability and hierarchy. Typography is confident and accessible: Effra headlines command attention, Arimo body text invites reading, and Cormorant serif elevates featured content. Spacing is generous to breathe; the system avoids density or decoration. Buttons move on hover—a subtle promise that interaction matters.

**Key Characteristics:**

- Authentic over polished: real staff photos, real data, real stories
- Red for impact, black for clarity, white for rest
- Generous vertical rhythm; horizontal restraint
- Micro-interactions signal engagement (button lift, hover color shift)

## Colors

Quina Care uses a disciplined two-color palette: a warm, action-driving red and a stabilizing black, anchored in neutrals. Red (#e6172c) is the emotional color—it appears on CTAs, highlights impact, and invites donation. Black (#111111) is the trust color—it grounds text, buttons, and navigation. Grays serve as support: light grays for backgrounds and pill filters, mid-grays for secondary text and borders.

- **Primary (Quina Red):** #e6172c. Warm, urgent, human. Appears on all primary CTAs and donation buttons. On hover, darkens to a muted terracotta (#b8422e) to signal engagement.
- **Secondary (Quina Black):** #111111. Foundational and trustworthy. Dominates text, navigation, and secondary buttons. On hover over black buttons, shifts to red to show the reverse relationship.
- **Neutral (Light):** #fcfcfc. Barely perceptible—used for subtle backgrounds and card surfaces.
- **Text (Mid-Gray):** #6b7280. Body and description text. Readable without aggression.
- **Accents (Light Grays):** #f3f4f6 (pill backgrounds), #e5e7eb (borders and hover states).

## Typography

Three typefaces form the hierarchy: **Effra** (sans-serif, bold, headlines) commands authority. **Arimo** (sans-serif, body) is warm and readable—the primary voice for storytelling. **Cormorant** (serif, featured content) elevates and dignifies—reserved for pull-quotes, staff names, and impact highlights. All text is uppercase where it signals category or hierarchy (labels, button text, footer headings), but never decoratively.

- **Label:** Arimo 14px, 700, 0.1em tracking. Red. Uppercase. Marks section categories.
- **Heading:** Effra, responsive scale, 700. Black. -0.025em tracking. Commands the page.
- **Body:** Arimo 18px, 700 line-height, mid-gray. The story. Warm, readable, never cramped.
- **Meta:** Arimo 10px, 700, 0.2em tracking. Dates, categories, staff roles. Uppercase.
- **Button:** Arimo 14px, 700, 0.1em tracking. Uppercase. All buttons: confident voice.

## Layout

The site uses a single-column mobile-first layout that expands to two columns at desktop. Horizontal rhythm is built on 8px and 16px increments, but vertical rhythm is more generous: sections are separated by 1.5rem to 2rem of margin, giving each section breathing room. Cards and content blocks use 1rem internal padding as the baseline, expanding to 2rem at desktop. The hero section is full-viewport height; card stacks are two-column at desktop, one-column at tablet, responsive throughout.

## Shapes

Buttons use a subtle 6px radius (0.375rem)—enough to feel approachable, minimal enough to read as serious. Filter pills use full-round radius (9999px) to create a playful, interactive feel. Cards have no radius by default (sharp corners, modern), but some feature boxes use 6px for warmth. No clipping or complex forms; the system favors clarity and direct communication.

## Components

**Buttons** are the primary interactive element. All buttons uppercase, all use Arimo 700. Primary buttons are warm red on white, black on hover. Secondary buttons start black, shift to red on hover—a visual echo of the primary relationship. Outline buttons use a 1px black border. Ghost buttons have no fill, red text. All buttons are 48px tall minimum and use 0.3s motion on hover (translateY -1px, color shift). The lift on hover is subtle but consistent.

**Pills** (filter tags in news archives) are rounded, light gray background, dark text. On hover, background darkens. When active, they invert: black background, white text.

**Labels** (section markers) are small, uppercase, red, always above a heading to signal category.

**Meta text** (dates, author names, tags) is tiny (10px), uppercase, 0.2em tracking, mid-gray. Always subservient to the main narrative.

**Links** inherit color from context (red in body text, black in navigation) and have a subtle underline on hover.

## Do's and Don'ts

**Do:**

- Use authentic photography of real staff, real patients, real hospital work
- Prioritize clarity and direct communication over decoration
- Maintain generous spacing, especially vertical rhythm
- Use red for donation CTAs and moments of impact
- Let the content breathe; don't over-design

**Don't:**

- Introduce new colors. The red/black/gray palette is complete.
- Use decorative imagery or stock photography of generic healthcare
- Create dense layouts or small type. Readability is non-negotiable.
- Add shadows, gradients, or other depth effects. The system is intentionally flat.
- Animate text or use motion gratuitously. Hover motion on buttons is the limit.
- Fabricate data or metrics. Transparency is the brand.
