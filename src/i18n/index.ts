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
    "hero.foundation": "Stichting Quina Care",
    "hero.title1": "ZORG ZONDER",
    "hero.title2": "GRENZEN.",
    "hero.subtitle":
      "Wij brengen medische expertise naar de meest afgelegen gebieden van de Amazone. Omdat elk leven telt.",
    "hero.cta1": "Bekijk onze impact",
    "hero.cta2": "Help Quina Care",
    // Homepage - Live Metrics
    "metrics.liveData": "Live Data",
    "metrics.consultations": "Consulten",
    "metrics.births": "Geboortes",
    "metrics.medication": "Medicatie",
    "metrics.directMedical": "Directe Medische Hulp",
    "metrics.directMedicalDesc":
      "Onze kliniek fungeert als centrale hub voor medische zorg in de regio. Elke consultatie is een stap richting een gezondere gemeenschap.",
    "metrics.buildingFuture": "Toekomst Bouwen",
    "metrics.buildingFutureDesc":
      "Veilige bevallingen zijn de kern van ons werk. Wij zorgen dat medische complicaties direct en professioneel worden afgehandeld.",
    "metrics.jungleLogistics": "Logistiek in de Jungle",
    "metrics.jungleLogisticsDesc":
      "Het leveren van medicijnen vereist doorzettingsvermogen. Dankzij lokale kennis bereiken we dorpen waar geen wegen naar leiden.",
    // Homepage - News section
    "homeNews.title": "Actueel",
    "homeNews.subtitle": "Nieuws",
    "homeNews.allPosts": "Alle berichten",
    "homeNews.medical": "Medisch",
    "homeNews.impact": "Impact",
    "homeNews.vacancy": "Vacature",
    // Homepage - Donation Cards
    "donation.directImpact": "Directe Impact",
    "donation.title": "Wat jouw steun betekent",
    "donation.subtitle":
      "Elke euro gaat rechtstreeks naar de kliniek in Ecuador. Hier zie je exact wat wij met jouw specifieke bijdrage kunnen realiseren.",
    "donation.medication": "Essentiële Medicatie",
    "donation.medicationDesc":
      "Voor €15 verzorgen wij een volledige kuur van antibiotica of antimalariamiddelen voor een patiënt.",
    "donation.prenatal": "Prenatale Check-up",
    "donation.prenatalDesc":
      "Een volledige medische controle inclusief echo voor een aanstaande moeder, essentieel voor een veilige bevalling.",
    "donation.surgery": "Levensreddende Ingreep",
    "donation.surgeryDesc":
      "Draag bij aan de kosten van chirurgische ingrepen en de noodzakelijke nabehandeling in onze kliniek.",
    "donation.donate": "Doneer",
    "donation.chooseAmount": "Of kies zelf een bedrag",
    // Homepage - Focus Project
    "focus.label": "Focus Project 2026",
    "focus.title": "Nieuwe Kraamafdeling.",
    "focus.description":
      "Wij bouwen aan de toekomst. Help ons 500 extra veilige bevallingen per jaar te realiseren.",
    "focus.cta": "Steun de bouw",
    // Homepage - Partners
    "partners.label": "Gezamenlijke Impact",
    "partners.title":
      "Dankzij onze partners kunnen we de mensen helpen die dit het meest nodig hebben.",
    "partners.subtitle":
      "We zijn vereerd met een toegewijde groep partners die ons ondersteunen met zowel materiële hulp als structurele financiering.",
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
    "newsletter.title": "Ontvang updates rechtstreeks uit de",
    "newsletter.titleHighlight": "kliniek.",
    "newsletter.subtitle":
      "Schrijf je in voor onze nieuwsbrief en ontvang kwartaalupdates over lopende projecten, medische resultaten en hoe jouw steun impact maakt in Ecuador.",
    "newsletter.placeholder": "Jouw e-mailadres",
    "newsletter.submit": "Inschrijven",
    "newsletter.privacy":
      "Wij respecteren je privacy. Geen spam, alleen impact.",
    // Footer
    "footer.description":
      "Medische zorg op de meest afgelegen plekken. Stichting Quina Care zet zich in voor levensreddende hulp in de Ecuadoriaanse jungle.",
    "footer.organization": "Organisatie",
    "footer.aboutUs": "Over Ons",
    "footer.ourProjects": "Onze Projecten",
    "footer.newsPosts": "Nieuwsberichten",
    "footer.financialReport": "Financiële Verantwoording",
    "footer.contact": "Contact",
    "footer.certifications": "Certificeringen",
    "footer.certifiedCharity":
      "Quina Care is een officieel erkende goededoelinstelling.",
    "footer.privacyPolicy": "Privacy Policy",
    "footer.cookies": "Cookies",
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
    "donate.bankTransfer": "Bankoverschrijving",
    "donate.submitButton": "Doneer",
    "donate.thankYouTitle": "Bedankt!",
    "donate.thankYouMessage":
      "Jouw donatie maakt een wereld van verschil. Samen brengen we zorg waar het het hardst nodig is.",
    "donate.backHome": "Terug naar home",
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
      "De kliniek is een baken van hoop voor duizenden families. Jullie bijdragen zorgen ervoor dat we medicijnen en apparatuur hebben wanneer het er écht toe doet.",
    "donate.quote2Author": "Dr. Elvis Salazar",
    "donate.quote2Role": "Arts in de kliniek",
    // Donate page - Achievements
    "donate.achievedLabel": "Onze Resultaten",
    "donate.achievedTitle": "Wat we samen al hebben bereikt",
    "donate.achieved1":
      "Een volwaardige kliniek gebouwd en operationeel in het hart van de Ecuadoriaanse Amazone",
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
      "100% van je donatie gaat naar de kliniek in Ecuador. We gebruiken het voor medicijnen, medische apparatuur, salarissen van lokaal personeel en het onderhoud van de kliniek.",
    "donate.faq2Q": "Is mijn donatie fiscaal aftrekbaar?",
    "donate.faq2A":
      "Ja, Stichting Quina Care heeft de ANBI-status. Je donatie is daarmee aftrekbaar van de belasting in Nederland.",
    "donate.faq3Q": "Kan ik mijn maandelijkse donatie opzeggen?",
    "donate.faq3A":
      "Ja, je kunt je maandelijkse donatie op elk moment stopzetten door contact met ons op te nemen via info@quinacare.org.",
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
    "hero.foundation": "Quina Care Foundation",
    "hero.title1": "CARE WITHOUT",
    "hero.title2": "BORDERS.",
    "hero.subtitle":
      "We bring medical expertise to the most remote areas of the Amazon. Because every life counts.",
    "hero.cta1": "See our impact",
    "hero.cta2": "Help Quina Care",
    // Homepage - Live Metrics
    "metrics.liveData": "Live Data",
    "metrics.consultations": "Consultations",
    "metrics.births": "Births",
    "metrics.medication": "Medication",
    "metrics.directMedical": "Direct Medical Care",
    "metrics.directMedicalDesc":
      "Our clinic serves as a central hub for medical care in the region. Every consultation is a step towards a healthier community.",
    "metrics.buildingFuture": "Building the Future",
    "metrics.buildingFutureDesc":
      "Safe deliveries are at the core of our work. We ensure medical complications are handled immediately and professionally.",
    "metrics.jungleLogistics": "Jungle Logistics",
    "metrics.jungleLogisticsDesc":
      "Delivering medicine requires perseverance. Thanks to local knowledge, we reach villages where no roads lead.",
    // Homepage - News section
    "homeNews.title": "Latest",
    "homeNews.subtitle": "News",
    "homeNews.allPosts": "All posts",
    "homeNews.medical": "Medical",
    "homeNews.impact": "Impact",
    "homeNews.vacancy": "Vacancy",
    // Homepage - Donation Cards
    "donation.directImpact": "Direct Impact",
    "donation.title": "What your support means",
    "donation.subtitle":
      "Every euro goes directly to the clinic in Ecuador. Here you can see exactly what we can achieve with your specific contribution.",
    "donation.medication": "Essential Medication",
    "donation.medicationDesc":
      "For €15 we provide a complete course of antibiotics or antimalarial drugs for a patient.",
    "donation.prenatal": "Prenatal Check-up",
    "donation.prenatalDesc":
      "A complete medical check-up including ultrasound for an expectant mother, essential for a safe delivery.",
    "donation.surgery": "Life-saving Procedure",
    "donation.surgeryDesc":
      "Contribute to the costs of surgical procedures and necessary aftercare at our clinic.",
    "donation.donate": "Donate",
    "donation.chooseAmount": "Or choose your own amount",
    // Homepage - Focus Project
    "focus.label": "Focus Project 2026",
    "focus.title": "New Maternity Ward.",
    "focus.description":
      "We are building for the future. Help us achieve 500 additional safe deliveries per year.",
    "focus.cta": "Support the construction",
    // Homepage - Partners
    "partners.label": "Joint Impact",
    "partners.title":
      "Thanks to our partners, we can help the people who need it most.",
    "partners.subtitle":
      "We are honored to have a dedicated group of partners who support us with both material aid and structural financing.",
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
    "newsletter.titleHighlight": "clinic.",
    "newsletter.subtitle":
      "Subscribe to our newsletter and receive quarterly updates on ongoing projects, medical results and how your support makes an impact in Ecuador.",
    "newsletter.placeholder": "Your email address",
    "newsletter.submit": "Subscribe",
    "newsletter.privacy": "We respect your privacy. No spam, only impact.",
    // Footer
    "footer.description":
      "Medical care in the most remote places. Quina Care Foundation is committed to life-saving care in the Ecuadorian jungle.",
    "footer.organization": "Organization",
    "footer.aboutUs": "About Us",
    "footer.ourProjects": "Our Projects",
    "footer.newsPosts": "News Posts",
    "footer.financialReport": "Financial Report",
    "footer.contact": "Contact",
    "footer.certifications": "Certifications",
    "footer.certifiedCharity":
      "Quina Care is an officially recognized charity.",
    "footer.privacyPolicy": "Privacy Policy",
    "footer.cookies": "Cookies",
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
    "donate.bankTransfer": "Bank Transfer",
    "donate.submitButton": "Donate",
    "donate.thankYouTitle": "Thank You!",
    "donate.thankYouMessage":
      "Your donation makes a world of difference. Together we bring care where it is needed most.",
    "donate.backHome": "Back to home",
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
      "The clinic is a beacon of hope for thousands of families. Your contributions ensure we have medicine and equipment when it truly matters.",
    "donate.quote2Author": "Dr. Elvis Salazar",
    "donate.quote2Role": "Clinic Physician",
    // Donate page - Achievements
    "donate.achievedLabel": "Our Results",
    "donate.achievedTitle": "What we've achieved together",
    "donate.achieved1":
      "Built and operate a full medical clinic in the heart of the Ecuadorian Amazon",
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
      "100% of your donation goes to the clinic in Ecuador. We use it for medicine, medical equipment, local staff salaries, and clinic maintenance.",
    "donate.faq2Q": "Is my donation tax-deductible?",
    "donate.faq2A":
      "Yes, Quina Care Foundation has ANBI status in the Netherlands, making your donation tax-deductible under Dutch tax law.",
    "donate.faq3Q": "Can I cancel my monthly donation?",
    "donate.faq3A":
      "Yes, you can cancel your monthly donation at any time by contacting us at info@quinacare.org.",
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
    "hero.foundation": "Fundación Quina Care",
    "hero.title1": "CUIDADO SIN",
    "hero.title2": "FRONTERAS.",
    "hero.subtitle":
      "Llevamos experiencia médica a las zonas más remotas del Amazonas. Porque cada vida cuenta.",
    "hero.cta1": "Ver nuestro impacto",
    "hero.cta2": "Ayuda a Quina Care",
    // Homepage - Live Metrics
    "metrics.liveData": "Datos en Vivo",
    "metrics.consultations": "Consultas",
    "metrics.births": "Nacimientos",
    "metrics.medication": "Medicamentos",
    "metrics.directMedical": "Atención Médica Directa",
    "metrics.directMedicalDesc":
      "Nuestra clínica sirve como centro de atención médica en la región. Cada consulta es un paso hacia una comunidad más saludable.",
    "metrics.buildingFuture": "Construyendo el Futuro",
    "metrics.buildingFutureDesc":
      "Los partos seguros son el núcleo de nuestro trabajo. Nos aseguramos de que las complicaciones médicas se manejen de inmediato y profesionalmente.",
    "metrics.jungleLogistics": "Logística en la Selva",
    "metrics.jungleLogisticsDesc":
      "Entregar medicamentos requiere perseverancia. Gracias al conocimiento local, llegamos a aldeas donde no hay caminos.",
    // Homepage - News section
    "homeNews.title": "Últimas",
    "homeNews.subtitle": "Noticias",
    "homeNews.allPosts": "Todos los artículos",
    "homeNews.medical": "Médico",
    "homeNews.impact": "Impacto",
    "homeNews.vacancy": "Vacante",
    // Homepage - Donation Cards
    "donation.directImpact": "Impacto Directo",
    "donation.title": "Lo que significa tu apoyo",
    "donation.subtitle":
      "Cada euro va directamente a la clínica en Ecuador. Aquí puedes ver exactamente lo que podemos lograr con tu contribución específica.",
    "donation.medication": "Medicación Esencial",
    "donation.medicationDesc":
      "Por €15 proporcionamos un curso completo de antibióticos o medicamentos antipalúdicos para un paciente.",
    "donation.prenatal": "Control Prenatal",
    "donation.prenatalDesc":
      "Un control médico completo incluyendo ecografía para una futura madre, esencial para un parto seguro.",
    "donation.surgery": "Procedimiento que Salva Vidas",
    "donation.surgeryDesc":
      "Contribuye a los costos de procedimientos quirúrgicos y el cuidado posterior necesario en nuestra clínica.",
    "donation.donate": "Donar",
    "donation.chooseAmount": "O elige tu propia cantidad",
    // Homepage - Focus Project
    "focus.label": "Proyecto Enfoque 2026",
    "focus.title": "Nueva Sala de Maternidad.",
    "focus.description":
      "Estamos construyendo para el futuro. Ayúdanos a lograr 500 partos seguros adicionales por año.",
    "focus.cta": "Apoya la construcción",
    // Homepage - Partners
    "partners.label": "Impacto Conjunto",
    "partners.title":
      "Gracias a nuestros socios, podemos ayudar a las personas que más lo necesitan.",
    "partners.subtitle":
      "Nos sentimos honrados de tener un grupo dedicado de socios que nos apoyan tanto con ayuda material como con financiamiento estructural.",
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
    "newsletter.title": "Recibe actualizaciones directamente desde la",
    "newsletter.titleHighlight": "clínica.",
    "newsletter.subtitle":
      "Suscríbete a nuestro boletín y recibe actualizaciones trimestrales sobre proyectos en curso, resultados médicos y cómo tu apoyo genera impacto en Ecuador.",
    "newsletter.placeholder": "Tu correo electrónico",
    "newsletter.submit": "Suscribirse",
    "newsletter.privacy": "Respetamos tu privacidad. Sin spam, solo impacto.",
    // Footer
    "footer.description":
      "Atención médica en los lugares más remotos. La Fundación Quina Care está comprometida con la atención que salva vidas en la selva ecuatoriana.",
    "footer.organization": "Organización",
    "footer.aboutUs": "Sobre Nosotros",
    "footer.ourProjects": "Nuestros Proyectos",
    "footer.newsPosts": "Noticias",
    "footer.financialReport": "Informe Financiero",
    "footer.contact": "Contacto",
    "footer.certifications": "Certificaciones",
    "footer.certifiedCharity":
      "Quina Care es una organización benéfica oficialmente reconocida.",
    "footer.privacyPolicy": "Política de Privacidad",
    "footer.cookies": "Cookies",
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
    "donate.bankTransfer": "Transferencia Bancaria",
    "donate.submitButton": "Donar",
    "donate.thankYouTitle": "¡Gracias!",
    "donate.thankYouMessage":
      "Tu donación marca una gran diferencia. Juntos llevamos atención donde más se necesita.",
    "donate.backHome": "Volver al inicio",
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
      "La clínica es un faro de esperanza para miles de familias. Sus contribuciones aseguran que tengamos medicinas y equipos cuando realmente importa.",
    "donate.quote2Author": "Dr. Elvis Salazar",
    "donate.quote2Role": "Médico de la clínica",
    // Donate page - Achievements
    "donate.achievedLabel": "Nuestros Resultados",
    "donate.achievedTitle": "Lo que hemos logrado juntos",
    "donate.achieved1":
      "Construimos y operamos una clínica médica completa en el corazón de la Amazonía ecuatoriana",
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
      "El 100% de tu donación va a la clínica en Ecuador. La usamos para medicinas, equipos médicos, salarios del personal local y mantenimiento de la clínica.",
    "donate.faq2Q": "¿Es mi donación deducible de impuestos?",
    "donate.faq2A":
      "Sí, la Fundación Quina Care tiene estatus ANBI en los Países Bajos, lo que hace tu donación deducible de impuestos bajo la ley fiscal holandesa.",
    "donate.faq3Q": "¿Puedo cancelar mi donación mensual?",
    "donate.faq3A":
      "Sí, puedes cancelar tu donación mensual en cualquier momento contactándonos en info@quinacare.org.",
  },
} as const;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang in languages) {
    return lang as Lang;
  }
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]): string {
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
