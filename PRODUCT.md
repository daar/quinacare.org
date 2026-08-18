# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are donors and financial supporters of Quina Care considering contributions. They arrive to understand the foundation's mission, see the real impact of donations, and decide how to support—whether through one-time gifts, recurring donations, sponsorship of staff, or partnership.

Secondary audiences include institutional partners, volunteers, and job seekers interested in involvement with Hospital San Miguel or Quina Care programs.

## Product Purpose

Quina Care's website is the primary fundraising and advocacy vehicle. It communicates the foundation's mission, demonstrates real outcomes through staff stories and live hospital data, and converts visitor attention into financial support and partnerships. Success is measured by donation volume, sustained donor engagement, volunteer applications, and partnership inquiries.

## Positioning

Quina Care's meaningfully different mechanism is operating Hospital San Miguel as a permanent, locally-run institution in one of Ecuador's most remote Amazon regions. Unlike temporary clinics or external aid models, Quina Care built and operates a real hospital staffed by and serving the local community. The website's job is to show this local-first reality—real staff, real patients, real outcomes—making the connection between donor support and sustainable healthcare possible.

## Operating Context

- **Donation workflows:** Donors discover Quina Care (often via organic search or referral), evaluate impact and trustworthiness, choose a giving method (one-time, recurring, staff sponsorship, Yura Tree items), and complete checkout.
- **Partnership discovery:** Institutional partners research Quina Care's programs, view partner logos and testimonials, and reach out for collaboration.
- **Volunteer recruitment:** Potential volunteers learn about volunteer opportunities, housing, staff roles, and apply via email.
- **Ongoing donor engagement:** Existing donors receive newsletters, updates, impact reports, and invitations to events (Putumayo Run/Loop).
- **Language-specific workflows:** Dutch donors access local legal proofs (ANBI, CBF); US/international donors see 501(c)(3); Spanish speakers in Ecuador and Latin America see regional context and Spanish language content.

## Capabilities and Constraints

**Confirmed capabilities:**

- Multi-language support (NL/EN/ES) with full parity in all content and updates.
- Live hospital metrics (consultations, births, admissions, reach) via Turso database integration.
- Staff stories and profiles tied to donation campaigns (staff sponsorship, Putumayo Run fundraising).
- Donation modal and checkout flows on key pages.
- Content collections (pages, news, fundraisers) with translation keys and route mappings.
- Redirect system for legacy URL support and multi-language routing.

**Technical constraints:**

- Built on Astro (currently v7.2.2) with static site generation.
- Content stored in Astro content collections (MDOc format) with frontmatter.
- Images processed and optimized at build time; large media (video) must go in `public/`, not `src/assets/`.
- i18n routing handled via URL structure and ROUTES mapping, not subdomains.
- Pre-commit hooks enforce spelling, formatting, and image optimization.

**Operating constraints:**

- All content must be maintained across three languages (NL/EN/ES) simultaneously.
- Staff featured on the site are real people; any updates must coordinate with their consent.
- Hospital data is real; metrics are live and updated regularly from production database.
- Featured images must exist and be properly licensed; no placeholder images in production.

## Brand Commitments

- **Name and legal status:** Stichting Quina Care (Netherlands), registered 501(c)(3) in the US.
- **Voice:** Warm, direct, human-centered. Emphasizes real people and real impact over institutional jargon.
- **Visual identity:** Warm reds and earth tones; photography of real staff and hospital; minimal but intentional use of color.
- **Critical legal assets:** ANBI certification (Netherlands), 501(c)(3) status (USA), CBF Erkend Goed Doel (Netherlands). These must be prominently displayed and linked on language-appropriate pages.
- **Staff is the brand:** The website's power comes from genuine stories of real healthcare workers. Authentic photos and quotes are non-negotiable.
- **Hospital as the proof:** Hospital San Miguel's existence, operations, and patient outcomes are the foundation's credibility. Real metrics and visual documentation matter.

## Evidence on Hand

- **Real staff directory:** 15+ staff members with photos, roles, and personal stories (multi-language).
- **Live hospital dashboard:** Real-time metrics from electronic patient records (consultations, births, admissions).
- **News archive:** 100+ published articles and updates dating back to 2017 (multilingual).
- **Fundraising campaigns:** Established programs (Putumayo Run/Loop, Yura Tree sponsorship, monthly giving).
- **Partner logos and testimonials:** 20+ organizational partners with public endorsements.
- **Legal proofs:** Current ANBI and CBF certifications (Netherlands), 501(c)(3) status (USA).
- **Asset inventory:** Hospital photography, staff portraits, operations footage, and video content in `public/video/`.

**Deliberately undecided:** No product-specific accessibility requirements beyond WCAG baseline have been confirmed; legal and compliance standards (GDPR for EU visitors, state-specific US regulations) are assumed standard for a public-facing nonprofit but not explicitly codified.

## Product Principles

1. **Authenticity over perfection:** Real staff, real stories, real data—never fabricate or over-produce. Authenticity builds trust and is Quina Care's core asset.
2. **Local sustainability is the outcome:** The website exists to fund a permanently-operating local institution, not a campaign or a program. Donor support is measured by ongoing institutional viability.
3. **Transparency earns support:** Show exactly where donations go (staff salaries, equipment, operations) and prove impact with real metrics. Donors give because they see the truth.
4. **Multilingual parity is non-negotiable:** Dutch, English, and Spanish audiences must have equal access to information and giving pathways. Content updates require all three languages.
5. **Human connection drives conversion:** Features, timelines, and statistics matter less than real faces, personal stories, and the ability to sponsor a named healthcare worker. Relationships convert donors.

## Accessibility & Inclusion

No product-specific accessibility requirements beyond standard WCAG 2.1 AA compliance have been established. The site serves a global audience across three languages; localization (language parity, regional currency for donations, regional legal status display) is a core constraint.
