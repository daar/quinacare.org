export const languages = {
  nl: "Nederlands",
  en: "English",
  es: "Español",
} as const;

export const defaultLang = "nl" as const;

export type Lang = keyof typeof languages;

export const ui = {
  nl: {
    // Navigation
    "nav.whatCanYouDo": "Wat kun jij doen?",
    "nav.whatDoWeDo": "Wat doen wij?",
    "nav.whoAreWe": "Wie zijn wij?",
    "nav.news": "Actueel",
    "nav.donate": "Doneer Nu",
    // News section
    "news.title": "ACTUEEL",
    "news.subtitle": "Onze Verhalen",
    "news.all": "Alles",
    "news.vlogs": "Vlogs",
    "news.articles": "Artikelen",
    "news.updates": "Updates",
    "news.readPost": "Lees bericht",
    "news.page": "Pagina",
    // Post
    "post.readingTime": "min leestijd",
    "post.shareStory": "Deel dit verhaal",
    "share.facebook": "Deel op Facebook",
    "share.linkedin": "Deel op LinkedIn",
    "share.whatsapp": "Deel via WhatsApp",
    "share.email": "Deel via e-mail",
    "share.copyLink": "Kopieer link",
    "share.native": "Delen",
    "post.aboutAuthor": "Over de auteur",
    "post.authorBio":
      "Quina Care zet zich in voor medische zorg in de meest afgelegen gebieden van de Amazone.",
    "post.continueReading": "Verder Lezen",
    "post.next": "Volgende",
    "post.previous": "Vorige",
    "category.article": "Artikel",
    "category.vlog": "Vlog",
    "category.update": "Update",
    // Homepage - Hero
    "hero.foundation": "Stichting Quina Care / Hospital San Miguel",
    "hero.subtitlePrefix": "Ook de mensen van de Amazone hebben recht op ",
    "hero.subtitleHighlight": "goede zorg",
    "hero.cta1": "Bekijk onze impact",
    "hero.cta2": "Help Quina Care",
    // Homepage - Live Metrics
    "metrics.liveData": "Live Data",
    "metrics.consultations": "Consulten",
    "metrics.births": "Geboortes",
    "metrics.medication": "Medicatie",
    "metrics.directMedical": "Directe Medische Hulp",
    "metrics.directMedicalDesc":
      "Ons ziekenhuis verzorgt belangrijke medische zorg in de regio. Elk consult draagt bij aan een gezondere gemeenschap.",
    "metrics.buildingFuture": "Toekomst Bouwen",
    "metrics.buildingFutureDesc":
      "Goede medische zorg voor vrouwen en kinderen is een van onze belangrijke taken. Wij zorgen dat medische complicaties professioneel worden behandeld en voorkomen.",
    "metrics.jungleLogistics": "Logistiek in de Jungle",
    "metrics.jungleLogisticsDesc":
      "Het leveren van medicijnen vereist doorzettingsvermogen. Dankzij lokale kennis bereiken we dorpen waar geen wegen naar leiden.",
    "metrics.patients": "Patiënten",
    "metrics.admissions": "Opnames",
    "metrics.amazonReach": "Bereik in de Amazone",
    "metrics.amazonReachDesc":
      "Duizenden patiënten in afgelegen gemeenschappen vertrouwen op ons ziekenhuis. Elk bezoek is een bewijs van wat lokale aanwezigheid mogelijk maakt.",
    "achieved.label": "Onze Impact",
    "achieved.title": "Wat we samen hebben bereikt",
    "achieved.subtitle":
      "Realtime cijfers rechtstreeks uit het elektronisch patiëntendossier van ons ziekenhuis in Ecuador.",
    // Homepage - News section
    "homeNews.title": "Actueel",
    "homeNews.subtitle": "Nieuws",
    "homeNews.allPosts": "Alle berichten",
    "homeNews.medical": "Medisch",
    "homeNews.impact": "Impact",
    "homeNews.vacancy": "Vacature",
    "homeNews.readMore": "Lees verder",
    "homeNews.placeholderTitle": "Binnenkort meer",
    "homeNews.placeholderMessage":
      "We werken aan een vernieuwde website. Kom binnenkort terug voor nieuwe verhalen en updates.",
    // Homepage - Donation Cards
    "donation.directImpact": "Directe Impact",
    "donation.title": "Wat jouw steun betekent",
    "donation.subtitle":
      "Elke euro gaat rechtstreeks naar het ziekenhuis in Ecuador. Hier zie je wat wij met jouw bijdrage kunnen realiseren.",
    "donation.consultation": "Consult & Diagnostiek",
    "donation.consultationDesc":
      "Met je donatie financier je een volledig consult inclusief laboratoriumonderzoek en medicatie voor een patiënt.",
    "donation.prenatal": "Prenatale Check-up",
    "donation.prenatalDesc":
      "Een volledige medische controle inclusief echo voor een aanstaande moeder, essentieel voor een veilige bevalling.",
    "donation.surgery": "Levensreddende Ingreep",
    "donation.surgeryDesc":
      "Draag bij aan de kosten van chirurgische ingrepen en de noodzakelijke nabehandeling in ons ziekenhuis.",
    "donation.donate": "Doneer",
    "donation.chooseAmount": "Of kies zelf een bedrag",
    // Homepage - Focus Project
    "focus.label": "Focus Project",
    "focus.title": "HPV Screening Putumayo.",
    "focus.description":
      "Screen 1.000 inheemse vrouwen op baarmoederhalskanker. Met een eenvoudige zelftest maken we preventieve zorg toegankelijk in de Amazone.",
    "focus.cta": "Bekijk dit project",
    // Homepage - Partners
    "partners.label": "Gezamenlijke Impact",
    "partners.title":
      "Dankzij onze partners kunnen we de mensen helpen die dit het meest nodig hebben.",
    "partners.subtitle":
      "We zijn heel blij met een toegewijde groep partners die ons ondersteunen met zowel materiële hulp als structurele financiering.",
    "partners.viewAll": "Bekijk al onze partners",
    "partners.interested": "Interesse in een samenwerking?",
    "partners.contact": "Neem contact op",
    // Homepage - Call to Action
    "cta.label": "Word onderdeel van de missie",
    "cta.title1": "Samen redden we",
    "cta.title2": "levens.",
    "cta.subtitle":
      "Jouw bijdrage gaat direct naar medische apparatuur en personeel op locatie in Ecuador. 100% impact.",
    "cta.donate": "Doneer nu",
    "cta.securePayment": "Veilig betalen",
    "cta.certified": "CBF Erkend",
    // Homepage - Newsletter
    "newsletter.label": "Blijf Betrokken",
    "newsletter.title": "Ontvang updates rechtstreeks uit het",
    "newsletter.titleHighlight": "ziekenhuis.",
    "newsletter.subtitle":
      "Schrijf je in voor onze nieuwsbrief en ontvang kwartaalupdates over lopende projecten, medische resultaten en hoe jouw steun impact maakt in Ecuador.",
    "newsletter.placeholder": "Jouw e-mailadres",
    "newsletter.submit": "Inschrijven",
    "newsletter.privacy":
      "Wij respecteren je privacy. Geen spam, alleen impact.",
    "newsletter.success": "Bedankt, je bent succesvol ingeschreven!",
    "newsletter.invalidEmail": "Vul een geldig e-mailadres in.",
    "newsletter.error": "Er ging iets mis. Probeer het opnieuw.",
    // Footer
    "footer.description":
      "Quina Care is een stichting die zich inzet voor het verbeteren van de gezondheidszorg in het Amazonewoud in Ecuador.",
    "footer.organization": "Organisatie",
    "footer.aboutUs": "Over Ons",
    "footer.ourProjects": "Onze Projecten",
    "footer.newsPosts": "Nieuwsberichten",
    "footer.financialReport": "Financiële Verantwoording",
    "footer.contact": "Contact",
    "footer.certifications": "Erkenningen",
    "footer.certifiedCharity":
      "Quina Care is een officieel erkende goededoelinstelling.",
    "footer.privacyPolicy": "Privacy Policy",
    // Donate page
    "donate.pageTitle": "Doneer aan Quina Care",
    "donate.pageSubtitle":
      "Jouw bijdrage gaat 100% naar medische zorg in de Ecuadoriaanse Amazone.",
    "donate.oneTime": "Eenmalig",
    "donate.monthly": "Maandelijks",
    "donate.customPlaceholder": "Ander bedrag",
    "donate.impactGeneric": "Jouw donatie maakt direct verschil in de Amazone.",
    "donate.impactLabel": "Jouw Impact",
    "donate.paymentMethod": "Betaalmethode",
    "donate.creditCard": "Credit/Debit Card",
    "donate.paypal": "PayPal",
    "donate.submitButton": "Doneer",
    "donate.thankYouTitle": "Bedankt!",
    "donate.thankYouMessage":
      "Jouw donatie maakt een wereld van verschil. Samen brengen we zorg waar het het hardst nodig is.",
    "donate.backHome": "Terug naar home",
    "donate.thankYouFormIntro":
      "Wil je een persoonlijk bedankje ontvangen? Laat je gegevens achter.",
    "donate.thankYouName": "Naam",
    "donate.thankYouNamePlaceholder": "Jouw naam",
    "donate.thankYouEmail": "E-mail",
    "donate.thankYouEmailPlaceholder": "jouw@email.nl",
    "donate.thankYouNewsletter": "Ik wil ook de nieuwsbrief ontvangen",
    "donate.thankYouSubmit": "Versturen",
    "donate.thankYouSubmitted": "Bedankt, we nemen contact met je op!",
    // Donate page - Counter
    "donate.counterValue": "4.200+",
    "donate.counterLabel": "patiënten geholpen, en het telt door",
    // Donate page - Personal notes
    "donate.notesLabel": "Vanuit het Veld",
    "donate.notesTitle": "De mensen achter de missie",
    "donate.quote1":
      "Dankzij jullie steun kunnen we elke dag levens redden in de meest afgelegen gebieden van de Amazone. Elke donatie maakt direct verschil.",
    "donate.quote1Author": "Yvonne van der Ende",
    "donate.quote1Role": "Oprichter & Directeur",
    "donate.quote2":
      "Het ziekenhuis is een baken van hoop voor duizenden families. Jullie bijdragen zorgen ervoor dat we medicijnen en apparatuur hebben wanneer het er écht toe doet.",
    "donate.quote2Author": "Dr. Elvis Salazar",
    "donate.quote2Role": "Arts in het ziekenhuis",
    // Donate page - Achievements
    "donate.achievedLabel": "Onze Resultaten",
    "donate.achievedTitle": "Wat we samen al hebben bereikt",
    "donate.achieved1":
      "Een volwaardig ziekenhuis gebouwd en operationeel in het hart van de Ecuadoriaanse Amazone",
    "donate.achieved2":
      "Meer dan 4.200 patiënten voorzien van medische zorg, inclusief spoedeisende hulp",
    "donate.achieved3":
      "Honderden veilige bevallingen begeleid in een regio waar dat eerder onmogelijk was",
    "donate.achieved4":
      "Structurele levering van essentiële medicijnen aan afgelegen gemeenschappen langs de rivier",
    // Donate page - FAQ
    "donate.faqTitle": "Veelgestelde Vragen",
    "donate.faq1Q": "Waar gaat mijn donatie naartoe?",
    "donate.faq1A":
      "100% van je donatie gaat naar het ziekenhuis in Ecuador. We gebruiken het voor medicijnen, medische apparatuur, salarissen van lokaal personeel en het onderhoud van het ziekenhuis.",
    "donate.faq2Q": "Is mijn donatie fiscaal aftrekbaar?",
    "donate.faq2A":
      "Stichting Quina Care is een in Nederland geregistreerde stichting met ANBI-status. Je donaties zijn hierdoor fiscaal aftrekbaar, volgens de geldende regels.",
    "donate.faq3Q": "Kan ik mijn maandelijkse donatie opzeggen?",
    "donate.faq3A":
      "Ja, je kunt je maandelijkse donatie op elk moment stopzetten door contact met ons op te nemen via care@quinacare.org.",
    // Sponsor form (yura-boom)
    "sponsor.nameLabel": "Naam",
    "sponsor.namePlaceholder": "Je volledige naam",
    "sponsor.emailLabel": "E-mail",
    "sponsor.emailPlaceholder": "je@email.nl",
    "sponsor.monthly": "Maandelijks",
    "sponsor.yearly": "Jaarlijks",
    "sponsor.submitButton": "Sponsoren",
    "sponsor.yearlyNote": "Jaarlijks bedrag",
    // Fundraise section
    "fundraise.title": "SPONSOR ACTIES",
    "fundraise.subtitle": "Acties",
    "fundraise.raised": "opgehaald",
    "fundraise.goal": "doel",
    "fundraise.of": "van",
    "fundraise.backers": "donateurs",
    "fundraise.daysToGo": "dagen te gaan",
    "fundraise.funded": "gefinancierd",
    "fundraise.by": "door",
    "fundraise.donateNow": "Steun deze actie",
    "fundraise.viewCampaign": "Bekijk actie",
    "fundraise.active": "Actief",
    "fundraise.completed": "Voltooid",
    "fundraise.upcoming": "Binnenkort",
    "fundraise.backToList": "Terug naar acties",
    "fundraise.campaignBy": "Een actie van",
    "fundraise.endDate": "Einddatum",
    "fundraise.noFundraisers": "Er zijn momenteel geen sponsor acties.",
    "fundraise.qrTitle": "Deel deze actie",
    "fundraise.qrDownload": "Download QR-code",
    "fundraise.impactLabel": "Met deze donatie steun je de sponsoractie van",
    // Projects section
    "projects.title": "PROJECTEN",
    "projects.subtitle": "Onze Projecten",
    "projects.readMore": "Lees meer",
    "projects.backToList": "Terug naar projecten",
    "projects.active": "Actief",
    "projects.completed": "Voltooid",
    "projects.upcoming": "Binnenkort",
    "projects.noProjects": "Er zijn momenteel geen projecten.",
    // 404
    "404.title": "Pagina niet gevonden",
    "404.subtitle": "404",
    "404.description": "Je bent verdwaald... maar wij laten niemand achter.",
    "404.backHome": "Terug naar home",
    // Submenu - Wat kun jij doen?
    "submenu.fundraise": "Sponsor acties",
    "submenu.joinTeam": "Word vrijwilliger",
    "submenu.becomePartner": "Word partner",
    "submenu.yuraBoom": "De Yura Boom",
    "submenu.yuraBoomDesc":
      "Koop een blad aan onze symbolische bamboe boom en steun het ziekenhuis.",
    "submenu.sponsorBooklet": "Sponsorboekje",
    "submenu.sponsorBookletDesc":
      "Sponsor een personeelslid en maak direct impact op de zorg.",
    // Submenu - Wat doen wij?
    "submenu.projects": "Projecten",
    "submenu.hospital": "Ons ziekenhuis",
    "submenu.hospitalDesc":
      "Ontdek ons ziekenhuis in het hart van de Ecuadoriaanse Amazone.",
    "submenu.contact": "Contact",
    // Submenu - Wie zijn wij?
    "submenu.aboutUs": "Over ons",
    "submenu.organization": "Organisatie",
    "submenu.media": "Media",
    "submenu.goals": "Onze doelstellingen",
    // Search
    "search.title": "Zoeken",
    "search.label": "Zoekresultaten",
    "search.placeholder": "Zoek op trefwoord...",
    "search.noResults": "Geen resultaten gevonden",
    "search.startTyping": "Begin met typen om te zoeken",
    "search.seeAll": "Bekijk alle resultaten",
    "search.results": "resultaten",
  },
  en: {
    // Navigation
    "nav.whatCanYouDo": "What can you do?",
    "nav.whatDoWeDo": "What do we do?",
    "nav.whoAreWe": "Who are we?",
    "nav.news": "News",
    "nav.donate": "Donate Now",
    // News section
    "news.title": "NEWS",
    "news.subtitle": "Our Stories",
    "news.all": "All",
    "news.vlogs": "Vlogs",
    "news.articles": "Articles",
    "news.updates": "Updates",
    "news.readPost": "Read post",
    "news.page": "Page",
    // Post
    "post.readingTime": "min read",
    "post.shareStory": "Share this story",
    "share.facebook": "Share on Facebook",
    "share.linkedin": "Share on LinkedIn",
    "share.whatsapp": "Share on WhatsApp",
    "share.email": "Share via email",
    "share.copyLink": "Copy link",
    "share.native": "Share",
    "post.aboutAuthor": "About the author",
    "post.authorBio":
      "Quina Care is committed to providing medical care in the most remote areas of the Amazon.",
    "post.continueReading": "Continue Reading",
    "post.next": "Next",
    "post.previous": "Previous",
    "category.article": "Article",
    "category.vlog": "Vlog",
    "category.update": "Update",
    // Homepage - Hero
    "hero.foundation": "Stichting Quina Care / Hospital San Miguel",
    "hero.subtitlePrefix": "The people of the Amazon also have a right to ",
    "hero.subtitleHighlight": "good healthcare",
    "hero.cta1": "See our impact",
    "hero.cta2": "Help Quina Care",
    // Homepage - Live Metrics
    "metrics.liveData": "Live Data",
    "metrics.consultations": "Consultations",
    "metrics.births": "Births",
    "metrics.medication": "Medication",
    "metrics.directMedical": "Direct Medical Care",
    "metrics.directMedicalDesc":
      "Our hospital provides essential medical care to the region. Every consultation contributes to a healthier community.",
    "metrics.buildingFuture": "Building the Future",
    "metrics.buildingFutureDesc":
      "Quality medical care for women and children is one of our core responsibilities. We make sure medical complications are treated professionally and prevented.",
    "metrics.jungleLogistics": "Jungle Logistics",
    "metrics.jungleLogisticsDesc":
      "Delivering medicine requires perseverance. Thanks to local knowledge, we reach villages where no roads lead.",
    "metrics.patients": "Patients",
    "metrics.admissions": "Admissions",
    "metrics.amazonReach": "Amazon Reach",
    "metrics.amazonReachDesc":
      "Thousands of patients in remote communities rely on our hospital. Each visit is proof of what a steady local presence makes possible.",
    "achieved.label": "Our Impact",
    "achieved.title": "What we've achieved together",
    "achieved.subtitle":
      "Real-time figures pulled straight from the electronic medical record of our hospital in Ecuador.",
    // Homepage - News section
    "homeNews.title": "Latest",
    "homeNews.subtitle": "News",
    "homeNews.allPosts": "All posts",
    "homeNews.medical": "Medical",
    "homeNews.impact": "Impact",
    "homeNews.vacancy": "Vacancy",
    "homeNews.readMore": "Read more",
    "homeNews.placeholderTitle": "More coming soon",
    "homeNews.placeholderMessage":
      "We're rebuilding this site. Check back soon for new stories and updates.",
    // Homepage - Donation Cards
    "donation.directImpact": "Direct Impact",
    "donation.title": "What your support means",
    "donation.subtitle":
      "Every euro goes directly to the hospital in Ecuador. Here you can see what we can achieve with your contribution.",
    "donation.consultation": "Consultation & Diagnostics",
    "donation.consultationDesc":
      "With your donation you fund a full consultation including laboratory tests and medication for a patient.",
    "donation.prenatal": "Prenatal Check-up",
    "donation.prenatalDesc":
      "A complete medical check-up including ultrasound for an expectant mother, essential for a safe delivery.",
    "donation.surgery": "Life-saving Procedure",
    "donation.surgeryDesc":
      "Contribute to the costs of surgical procedures and necessary aftercare at our hospital.",
    "donation.donate": "Donate",
    "donation.chooseAmount": "Or choose your own amount",
    // Homepage - Focus Project
    "focus.label": "Focus Project",
    "focus.title": "HPV Screening Putumayo.",
    "focus.description":
      "Screen 1,000 indigenous women for cervical cancer. With a simple self-test, we make preventive care accessible in the Amazon.",
    "focus.cta": "View this project",
    // Homepage - Partners
    "partners.label": "Joint Impact",
    "partners.title":
      "Thanks to our partners, we can help the people who need it most.",
    "partners.subtitle":
      "We are very happy to have a dedicated group of partners who support us with both material aid and structural financing.",
    "partners.viewAll": "View all our partners",
    "partners.interested": "Interested in a partnership?",
    "partners.contact": "Get in touch",
    // Homepage - Call to Action
    "cta.label": "Become part of the mission",
    "cta.title1": "Together we save",
    "cta.title2": "lives.",
    "cta.subtitle":
      "Your contribution goes directly to medical equipment and staff on location in Ecuador. 100% impact.",
    "cta.donate": "Donate now",
    "cta.securePayment": "Secure payment",
    "cta.certified": "CBF Certified",
    // Homepage - Newsletter
    "newsletter.label": "Stay Involved",
    "newsletter.title": "Receive updates directly from the",
    "newsletter.titleHighlight": "hospital.",
    "newsletter.subtitle":
      "Subscribe to our newsletter and receive quarterly updates on ongoing projects, medical results and how your support makes an impact in Ecuador.",
    "newsletter.placeholder": "Your email address",
    "newsletter.submit": "Subscribe",
    "newsletter.privacy": "We respect your privacy. No spam, only impact.",
    "newsletter.success": "Thank you, you have successfully subscribed!",
    "newsletter.invalidEmail": "Please enter a valid email address.",
    "newsletter.error": "Something went wrong. Please try again.",
    // Footer
    "footer.description":
      "Quina Care is a foundation dedicated to improving healthcare in the Amazon rainforest of Ecuador.",
    "footer.organization": "Organization",
    "footer.aboutUs": "About Us",
    "footer.ourProjects": "Our Projects",
    "footer.newsPosts": "News Posts",
    "footer.financialReport": "Financial Report",
    "footer.contact": "Contact",
    "footer.certifications": "Recognitions",
    "footer.certifiedCharity":
      "Quina Care is an officially recognized charity.",
    "footer.privacyPolicy": "Privacy Policy",
    // Donate page
    "donate.pageTitle": "Donate to Quina Care",
    "donate.pageSubtitle":
      "Your contribution goes 100% to medical care in the Ecuadorian Amazon.",
    "donate.oneTime": "One-time",
    "donate.monthly": "Monthly",
    "donate.customPlaceholder": "Custom amount",
    "donate.impactGeneric":
      "Your donation makes a direct difference in the Amazon.",
    "donate.impactLabel": "Your Impact",
    "donate.paymentMethod": "Payment Method",
    "donate.creditCard": "Credit/Debit Card",
    "donate.paypal": "PayPal",
    "donate.submitButton": "Donate",
    "donate.thankYouTitle": "Thank You!",
    "donate.thankYouMessage":
      "Your donation makes a world of difference. Together we bring care where it is needed most.",
    "donate.backHome": "Back to home",
    "donate.thankYouFormIntro":
      "Would you like to receive a personal thank you? Leave your details below.",
    "donate.thankYouName": "Name",
    "donate.thankYouNamePlaceholder": "Your name",
    "donate.thankYouEmail": "Email",
    "donate.thankYouEmailPlaceholder": "your@email.com",
    "donate.thankYouNewsletter": "I'd also like to receive the newsletter",
    "donate.thankYouSubmit": "Submit",
    "donate.thankYouSubmitted": "Thank you, we'll be in touch!",
    // Donate page - Counter
    "donate.counterValue": "4,200+",
    "donate.counterLabel": "patients helped, and counting",
    // Donate page - Personal notes
    "donate.notesLabel": "From the Field",
    "donate.notesTitle": "The people behind the mission",
    "donate.quote1":
      "Thanks to your support, we can save lives every day in the most remote areas of the Amazon. Every donation makes a direct difference.",
    "donate.quote1Author": "Yvonne van der Ende",
    "donate.quote1Role": "Founder & Director",
    "donate.quote2":
      "The hospital is a beacon of hope for thousands of families. Your contributions ensure we have medicine and equipment when it truly matters.",
    "donate.quote2Author": "Dr. Elvis Salazar",
    "donate.quote2Role": "Hospital Physician",
    // Donate page - Achievements
    "donate.achievedLabel": "Our Results",
    "donate.achievedTitle": "What we've achieved together",
    "donate.achieved1":
      "Built and operate a full hospital in the heart of the Ecuadorian Amazon",
    "donate.achieved2":
      "Provided medical care to over 4,200 patients, including emergency treatment",
    "donate.achieved3":
      "Guided hundreds of safe deliveries in a region where this was previously impossible",
    "donate.achieved4":
      "Structural delivery of essential medicine to remote communities along the river",
    // Donate page - FAQ
    "donate.faqTitle": "Frequently Asked Questions",
    "donate.faq1Q": "Where does my donation go?",
    "donate.faq1A":
      "100% of your donation goes to the hospital in Ecuador. We use it for medicine, medical equipment, local staff salaries, and hospital maintenance.",
    "donate.faq2Q": "Is my donation tax-deductible?",
    "donate.faq2A":
      "Quina Care is a foundation registered in the Netherlands with ANBI status. Your donations are therefore tax-deductible under the applicable rules.",
    "donate.faq3Q": "Can I cancel my monthly donation?",
    "donate.faq3A":
      "Yes, you can cancel your monthly donation at any time by contacting us at care@quinacare.org.",
    // Sponsor form (yura-boom)
    "sponsor.nameLabel": "Name",
    "sponsor.namePlaceholder": "Your full name",
    "sponsor.emailLabel": "Email",
    "sponsor.emailPlaceholder": "you@email.com",
    "sponsor.monthly": "Monthly",
    "sponsor.yearly": "Yearly",
    "sponsor.submitButton": "Sponsor",
    "sponsor.yearlyNote": "Yearly amount",
    // Fundraise section
    "fundraise.title": "FUNDRAISING",
    "fundraise.subtitle": "Campaigns",
    "fundraise.raised": "raised",
    "fundraise.goal": "goal",
    "fundraise.of": "of",
    "fundraise.backers": "backers",
    "fundraise.daysToGo": "days to go",
    "fundraise.funded": "funded",
    "fundraise.by": "by",
    "fundraise.donateNow": "Support this campaign",
    "fundraise.viewCampaign": "View campaign",
    "fundraise.active": "Active",
    "fundraise.completed": "Completed",
    "fundraise.upcoming": "Upcoming",
    "fundraise.backToList": "Back to campaigns",
    "fundraise.campaignBy": "A campaign by",
    "fundraise.endDate": "End date",
    "fundraise.noFundraisers": "There are currently no fundraising campaigns.",
    "fundraise.qrTitle": "Share this fundraiser",
    "fundraise.qrDownload": "Download QR code",
    "fundraise.impactLabel":
      "With this donation you are supporting the fundraiser from",
    // Projects section
    "projects.title": "PROJECTS",
    "projects.subtitle": "Our Projects",
    "projects.readMore": "Read more",
    "projects.backToList": "Back to projects",
    "projects.active": "Active",
    "projects.completed": "Completed",
    "projects.upcoming": "Upcoming",
    "projects.noProjects": "There are currently no projects.",
    // 404
    "404.title": "Page not found",
    "404.subtitle": "404",
    "404.description":
      "You've wandered off the path... but we never leave anyone behind.",
    "404.backHome": "Back to home",
    // Submenu - What can you do?
    "submenu.fundraise": "Fundraising campaigns",
    "submenu.joinTeam": "Join Our Team",
    "submenu.becomePartner": "Become a Partner",
    "submenu.yuraBoom": "The Yura Tree",
    "submenu.yuraBoomDesc":
      "Buy a leaf on our symbolic bamboo tree and support the hospital.",
    "submenu.sponsorBooklet": "Sponsor Booklet",
    "submenu.sponsorBookletDesc":
      "Sponsor a staff member and make a direct impact on care.",
    // Submenu - What do we do?
    "submenu.projects": "Projects",
    "submenu.hospital": "Our Hospital",
    "submenu.hospitalDesc":
      "Discover our hospital in the heart of the Ecuadorian Amazon.",
    "submenu.contact": "Contact",
    // Submenu - Who are we?
    "submenu.aboutUs": "About Us",
    "submenu.organization": "Organization",
    "submenu.media": "Media",
    "submenu.goals": "Our Goals",
    // Search
    "search.title": "Search",
    "search.label": "Search results",
    "search.placeholder": "Search by keyword...",
    "search.noResults": "No results found",
    "search.startTyping": "Start typing to search",
    "search.seeAll": "See all results",
    "search.results": "results",
  },
  es: {
    // Navigation
    "nav.whatCanYouDo": "¿Qué puedes hacer?",
    "nav.whatDoWeDo": "¿Qué hacemos?",
    "nav.whoAreWe": "¿Quiénes somos?",
    "nav.news": "Noticias",
    "nav.donate": "Donar Ahora",
    // News section
    "news.title": "NOTICIAS",
    "news.subtitle": "Nuestras Historias",
    "news.all": "Todo",
    "news.vlogs": "Vlogs",
    "news.articles": "Artículos",
    "news.updates": "Actualizaciones",
    "news.readPost": "Leer artículo",
    "news.page": "Página",
    // Post
    "post.readingTime": "min de lectura",
    "post.shareStory": "Comparte esta historia",
    "share.facebook": "Compartir en Facebook",
    "share.linkedin": "Compartir en LinkedIn",
    "share.whatsapp": "Compartir por WhatsApp",
    "share.email": "Compartir por correo",
    "share.copyLink": "Copiar enlace",
    "share.native": "Compartir",
    "post.aboutAuthor": "Sobre el autor",
    "post.authorBio":
      "Quina Care se dedica a brindar atención médica en las zonas más remotas del Amazonas.",
    "post.continueReading": "Seguir Leyendo",
    "post.next": "Siguiente",
    "post.previous": "Anterior",
    "category.article": "Artículo",
    "category.vlog": "Vlog",
    "category.update": "Actualización",
    // Homepage - Hero
    "hero.foundation": "Stichting Quina Care / Hospital San Miguel",
    "hero.subtitlePrefix":
      "Las personas de la Amazonía también tienen derecho a una ",
    "hero.subtitleHighlight": "buena atención médica",
    "hero.cta1": "Ver nuestro impacto",
    "hero.cta2": "Ayuda a Quina Care",
    // Homepage - Live Metrics
    "metrics.liveData": "Datos en Vivo",
    "metrics.consultations": "Consultas",
    "metrics.births": "Nacimientos",
    "metrics.medication": "Medicamentos",
    "metrics.directMedical": "Atención Médica Directa",
    "metrics.directMedicalDesc":
      "Nuestro hospital ofrece atención médica esencial en la región. Cada consulta contribuye a una comunidad más saludable.",
    "metrics.buildingFuture": "Construyendo el Futuro",
    "metrics.buildingFutureDesc":
      "Una buena atención médica para mujeres y niños es una de nuestras responsabilidades principales. Nos aseguramos de que las complicaciones médicas se traten profesionalmente y se prevengan.",
    "metrics.jungleLogistics": "Logística en la Selva",
    "metrics.jungleLogisticsDesc":
      "Entregar medicamentos requiere perseverancia. Gracias al conocimiento local, llegamos a aldeas donde no hay caminos.",
    "metrics.patients": "Pacientes",
    "metrics.admissions": "Ingresos",
    "metrics.amazonReach": "Alcance en la Amazonía",
    "metrics.amazonReachDesc":
      "Miles de pacientes en comunidades remotas confían en nuestro hospital. Cada visita demuestra lo que hace posible una presencia local constante.",
    "achieved.label": "Nuestro Impacto",
    "achieved.title": "Lo que hemos logrado juntos",
    "achieved.subtitle":
      "Cifras en tiempo real directamente desde el historial clínico electrónico de nuestro hospital en Ecuador.",
    // Homepage - News section
    "homeNews.title": "Últimas",
    "homeNews.subtitle": "Noticias",
    "homeNews.allPosts": "Todos los artículos",
    "homeNews.medical": "Médico",
    "homeNews.impact": "Impacto",
    "homeNews.vacancy": "Vacante",
    "homeNews.readMore": "Leer más",
    "homeNews.placeholderTitle": "Próximamente",
    "homeNews.placeholderMessage":
      "Estamos renovando nuestra web. Vuelve pronto para descubrir nuevas historias y novedades.",
    // Homepage - Donation Cards
    "donation.directImpact": "Impacto Directo",
    "donation.title": "Lo que significa tu apoyo",
    "donation.subtitle":
      "Cada euro va directamente al hospital en Ecuador. Aquí puedes ver lo que podemos lograr con tu contribución.",
    "donation.consultation": "Consulta y Diagnóstico",
    "donation.consultationDesc":
      "Con tu donación financias una consulta completa incluyendo análisis de laboratorio y medicación para un paciente.",
    "donation.prenatal": "Control Prenatal",
    "donation.prenatalDesc":
      "Un control médico completo incluyendo ecografía para una futura madre, esencial para un parto seguro.",
    "donation.surgery": "Procedimiento que Salva Vidas",
    "donation.surgeryDesc":
      "Contribuye a los costos de procedimientos quirúrgicos y el cuidado posterior necesario en nuestro hospital.",
    "donation.donate": "Donar",
    "donation.chooseAmount": "O elige tu propia cantidad",
    // Homepage - Focus Project
    "focus.label": "Proyecto Enfoque",
    "focus.title": "Detección VPH Putumayo.",
    "focus.description":
      "Tamizar a 1.000 mujeres indígenas para detectar cáncer de cuello uterino. Con una simple autoprueba, hacemos accesible la atención preventiva en la Amazonía.",
    "focus.cta": "Ver este proyecto",
    // Homepage - Partners
    "partners.label": "Impacto Conjunto",
    "partners.title":
      "Gracias a nuestros socios, podemos ayudar a las personas que más lo necesitan.",
    "partners.subtitle":
      "Estamos muy contentos de tener un grupo dedicado de socios que nos apoyan tanto con ayuda material como con financiamiento estructural.",
    "partners.viewAll": "Ver todos nuestros socios",
    "partners.interested": "¿Interesado en una alianza?",
    "partners.contact": "Contáctanos",
    // Homepage - Call to Action
    "cta.label": "Sé parte de la misión",
    "cta.title1": "Juntos salvamos",
    "cta.title2": "vidas.",
    "cta.subtitle":
      "Tu contribución va directamente a equipos médicos y personal en Ecuador. 100% impacto.",
    "cta.donate": "Donar ahora",
    "cta.securePayment": "Pago seguro",
    "cta.certified": "Certificado CBF",
    // Homepage - Newsletter
    "newsletter.label": "Mantente Involucrado",
    "newsletter.title": "Recibe actualizaciones directamente desde el",
    "newsletter.titleHighlight": "hospital.",
    "newsletter.subtitle":
      "Suscríbete a nuestro boletín y recibe actualizaciones trimestrales sobre proyectos en curso, resultados médicos y cómo tu apoyo genera impacto en Ecuador.",
    "newsletter.placeholder": "Tu correo electrónico",
    "newsletter.submit": "Suscribirse",
    "newsletter.privacy": "Respetamos tu privacidad. Sin spam, solo impacto.",
    "newsletter.success": "¡Gracias, te has suscrito exitosamente!",
    "newsletter.invalidEmail": "Introduce una dirección de correo válida.",
    "newsletter.error": "Algo salió mal. Inténtalo de nuevo.",
    // Footer
    "footer.description":
      "Quina Care es una fundación dedicada a mejorar la atención sanitaria en la selva amazónica de Ecuador.",
    "footer.organization": "Organización",
    "footer.aboutUs": "Sobre Nosotros",
    "footer.ourProjects": "Nuestros Proyectos",
    "footer.newsPosts": "Noticias",
    "footer.financialReport": "Informe Financiero",
    "footer.contact": "Contacto",
    "footer.certifications": "Reconocimientos",
    "footer.certifiedCharity":
      "Quina Care es una organización benéfica oficialmente reconocida.",
    "footer.privacyPolicy": "Política de Privacidad",
    // Donate page
    "donate.pageTitle": "Dona a Quina Care",
    "donate.pageSubtitle":
      "Tu contribución va 100% a la atención médica en la Amazonía ecuatoriana.",
    "donate.oneTime": "Una vez",
    "donate.monthly": "Mensual",
    "donate.customPlaceholder": "Otra cantidad",
    "donate.impactGeneric":
      "Tu donación marca una diferencia directa en la Amazonía.",
    "donate.impactLabel": "Tu Impacto",
    "donate.paymentMethod": "Método de Pago",
    "donate.creditCard": "Tarjeta de Crédito/Débito",
    "donate.paypal": "PayPal",
    "donate.submitButton": "Donar",
    "donate.thankYouTitle": "¡Gracias!",
    "donate.thankYouMessage":
      "Tu donación marca una gran diferencia. Juntos llevamos atención donde más se necesita.",
    "donate.backHome": "Volver al inicio",
    "donate.thankYouFormIntro":
      "¿Te gustaría recibir un agradecimiento personal? Deja tus datos a continuación.",
    "donate.thankYouName": "Nombre",
    "donate.thankYouNamePlaceholder": "Tu nombre",
    "donate.thankYouEmail": "Correo electrónico",
    "donate.thankYouEmailPlaceholder": "tu@correo.com",
    "donate.thankYouNewsletter":
      "También quiero recibir el boletín informativo",
    "donate.thankYouSubmit": "Enviar",
    "donate.thankYouSubmitted": "¡Gracias, nos pondremos en contacto!",
    // Donate page - Counter
    "donate.counterValue": "4.200+",
    "donate.counterLabel": "pacientes atendidos, y contando",
    // Donate page - Personal notes
    "donate.notesLabel": "Desde el Campo",
    "donate.notesTitle": "Las personas detrás de la misión",
    "donate.quote1":
      "Gracias a su apoyo, podemos salvar vidas cada día en las zonas más remotas de la Amazonía. Cada donación marca una diferencia directa.",
    "donate.quote1Author": "Yvonne van der Ende",
    "donate.quote1Role": "Fundadora y Directora",
    "donate.quote2":
      "El hospital es un faro de esperanza para miles de familias. Sus contribuciones aseguran que tengamos medicinas y equipos cuando realmente importa.",
    "donate.quote2Author": "Dr. Elvis Salazar",
    "donate.quote2Role": "Médico del hospital",
    // Donate page - Achievements
    "donate.achievedLabel": "Nuestros Resultados",
    "donate.achievedTitle": "Lo que hemos logrado juntos",
    "donate.achieved1":
      "Construimos y operamos un hospital completo en el corazón de la Amazonía ecuatoriana",
    "donate.achieved2":
      "Atención médica brindada a más de 4.200 pacientes, incluyendo tratamiento de emergencia",
    "donate.achieved3":
      "Cientos de partos seguros asistidos en una región donde antes era imposible",
    "donate.achieved4":
      "Entrega estructural de medicamentos esenciales a comunidades remotas a lo largo del río",
    // Donate page - FAQ
    "donate.faqTitle": "Preguntas Frecuentes",
    "donate.faq1Q": "¿A dónde va mi donación?",
    "donate.faq1A":
      "El 100% de tu donación va al hospital en Ecuador. La usamos para medicinas, equipos médicos, salarios del personal local y mantenimiento del hospital.",
    "donate.faq2Q": "¿Es mi donación deducible de impuestos?",
    "donate.faq2A":
      "Quina Care es una fundación registrada en los Países Bajos con estatus ANBI. Sus donaciones son por lo tanto deducibles de impuestos según las normas vigentes.",
    "donate.faq3Q": "¿Puedo cancelar mi donación mensual?",
    "donate.faq3A":
      "Sí, puedes cancelar tu donación mensual en cualquier momento contactándonos en care@quinacare.org.",
    // Sponsor form (yura-boom)
    "sponsor.nameLabel": "Nombre",
    "sponsor.namePlaceholder": "Tu nombre completo",
    "sponsor.emailLabel": "Correo electrónico",
    "sponsor.emailPlaceholder": "tu@email.com",
    "sponsor.monthly": "Mensual",
    "sponsor.yearly": "Anual",
    "sponsor.submitButton": "Patrocinar",
    "sponsor.yearlyNote": "Importe anual",
    // Fundraise section
    "fundraise.title": "RECAUDACIÓN",
    "fundraise.subtitle": "Campañas",
    "fundraise.raised": "recaudado",
    "fundraise.goal": "meta",
    "fundraise.of": "de",
    "fundraise.backers": "donantes",
    "fundraise.daysToGo": "días restantes",
    "fundraise.funded": "financiado",
    "fundraise.by": "por",
    "fundraise.donateNow": "Apoya esta campaña",
    "fundraise.viewCampaign": "Ver campaña",
    "fundraise.active": "Activa",
    "fundraise.completed": "Completada",
    "fundraise.upcoming": "Próximamente",
    "fundraise.backToList": "Volver a campañas",
    "fundraise.campaignBy": "Una campaña de",
    "fundraise.endDate": "Fecha de cierre",
    "fundraise.noFundraisers": "Actualmente no hay campañas de recaudación.",
    "fundraise.qrTitle": "Comparte esta campaña",
    "fundraise.qrDownload": "Descargar código QR",
    "fundraise.impactLabel": "Con esta donación apoyas la campaña de",
    // Projects section
    "projects.title": "PROYECTOS",
    "projects.subtitle": "Nuestros Proyectos",
    "projects.readMore": "Leer más",
    "projects.backToList": "Volver a proyectos",
    "projects.active": "Activo",
    "projects.completed": "Completado",
    "projects.upcoming": "Próximamente",
    "projects.noProjects": "Actualmente no hay proyectos.",
    // 404
    "404.title": "Página no encontrada",
    "404.subtitle": "404",
    "404.description": "Te has perdido... pero nunca dejamos a nadie atrás.",
    "404.backHome": "Volver al inicio",
    // Submenu - ¿Qué puedes hacer?
    "submenu.fundraise": "Campañas de recaudación",
    "submenu.joinTeam": "Únete al equipo",
    "submenu.becomePartner": "Sé socio",
    "submenu.yuraBoom": "El Árbol Yura",
    "submenu.yuraBoomDesc":
      "Compra una hoja en nuestro árbol simbólico de bambú y apoya al hospital.",
    "submenu.sponsorBooklet": "Folleto de patrocinio",
    "submenu.sponsorBookletDesc":
      "Patrocina a un miembro del personal y genera un impacto directo en la atención.",
    // Submenu - ¿Qué hacemos?
    "submenu.projects": "Proyectos",
    "submenu.hospital": "Nuestro hospital",
    "submenu.hospitalDesc":
      "Descubre nuestro hospital en el corazón de la Amazonía ecuatoriana.",
    "submenu.contact": "Contacto",
    // Submenu - ¿Quiénes somos?
    "submenu.aboutUs": "Sobre nosotros",
    "submenu.organization": "Organización",
    "submenu.media": "Medios",
    "submenu.goals": "Nuestros objetivos",
    // Search
    "search.title": "Buscar",
    "search.label": "Resultados de búsqueda",
    "search.placeholder": "Buscar por palabra clave...",
    "search.noResults": "No se encontraron resultados",
    "search.startTyping": "Empieza a escribir para buscar",
    "search.seeAll": "Ver todos los resultados",
    "search.results": "resultados",
  },
} as const;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang in languages) {
    return lang as Lang;
  }
  return defaultLang;
}

export type TranslationKey = keyof (typeof ui)[typeof defaultLang];

export function useTranslations(lang: Lang) {
  return function t(key: TranslationKey): string {
    return ui[lang][key] || ui[defaultLang][key];
  };
}

export function getLocalizedPath(path: string, lang: Lang): string {
  // Remove any existing language prefix
  const cleanPath = path.replace(/^\/(nl|en|es)/, "");

  // For default language, don't add prefix
  if (lang === defaultLang) {
    return cleanPath || "/";
  }

  return `/${lang}${cleanPath}`;
}

export function getDateLocale(lang: Lang): string {
  const locales: Record<Lang, string> = {
    nl: "nl-NL",
    en: "en-US",
    es: "es-ES",
  };
  return locales[lang];
}

export function getCollectionName(
  lang: Lang,
): "news-nl" | "news-en" | "news-es" {
  return `news-${lang}` as const;
}

export function getAlternateUrls(
  currentUrl: URL,
): { lang: Lang; url: string }[] {
  const pathname = currentUrl.pathname;
  const origin = currentUrl.origin;

  return (Object.keys(languages) as Lang[]).map((lang) => ({
    lang,
    url: `${origin}${getLocalizedPath(pathname, lang)}`,
  }));
}
