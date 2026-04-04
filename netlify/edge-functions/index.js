// netlify/edge-functions/index.js
// SSR restaurant landing page — availability baked in for current week only

export default async (request, context) => {
  const SLUG = "medusa-italian-osteria-romana";
  const API  = `https://mcp.getfork.ai/api/availability/${SLUG}.json`;
  const BOOK = `https://mcp.getfork.ai/book/${SLUG}`;

  // ── Fetch live availability ─────────────────────────────────────────────
  let weekSlots = [];
  let fetchError = "";

  try {
    const res  = await fetch(API, { headers: { "User-Agent": "GetFork-SSR/1.0" } });
    const json = await res.json();

    // Filter to current week only (today + next 6 days)
    const today = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 6);

    const todayStr   = today.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    weekSlots = (json.availability ?? []).filter(d => d.date >= todayStr && d.date <= weekEndStr);
  } catch (e) {
    fetchError = String(e);
  }

  // ── Build availability HTML ─────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);

  const availHTML = weekSlots.map(day => {
    const isToday = day.date === todayStr;
    const label   = isToday ? `${day.dayName} — Today` : day.dayName;

    const byShift = {};
    for (const s of day.slots) {
      const shift = s.shift || "Available";
      if (!byShift[shift]) byShift[shift] = [];
      byShift[shift].push(s.time);
    }

    const shiftsHTML = Object.entries(byShift).map(([shift, times]) => `
      <div class="shift-group">
        <span class="shift-name">${shift}</span>
        <div class="time-pills">${times.map(t => `<span class="pill">${t}</span>`).join("")}</div>
      </div>`).join("");

    return `
    <div class="day-card${isToday ? " today" : ""}" 
         data-date="${day.date}"
         aria-label="${day.dayName} ${day.date} availability">
      <div class="day-header">
        <span class="day-label">${label}</span>
        <span class="day-date">${day.date}</span>
      </div>
      ${shiftsHTML}
    </div>`;
  }).join("");

  // ── JSON-LD structured data ─────────────────────────────────────────────
  const jsonLD = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    "name": "Medusa Osteria Romana",
    "servesCuisine": "Roman Italian",
    "priceRange": "$$-$$$",
    "telephone": "+61731930200",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "14 Via Roma Lane",
      "addressLocality": "Fortitude Valley",
      "addressRegion": "QLD",
      "postalCode": "4006",
      "addressCountry": "AU"
    },
    "openingHours": [
      "Mo-Th 17:00-22:00",
      "Fr 12:00-23:00",
      "Sa 12:00-23:00",
      "Su 12:00-21:00"
    ]
  });

  // ── Full page HTML ──────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Medusa Osteria Romana — Fortitude Valley, Brisbane</title>
  <meta name="description" content="Authentic Roman Italian dining in Fortitude Valley, Brisbane. Award-winning cuisine, live availability, and easy online booking."/>
  <meta name="robots" content="index, follow"/>
  <meta property="og:title" content="Medusa Osteria Romana"/>
  <meta property="og:description" content="Roman Italian dining in the heart of Fortitude Valley, Brisbane."/>
  <script type="application/ld+json">${jsonLD}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        #0b0906;
      --bg2:       #130f0b;
      --surface:   #1c1711;
      --border:    #2d2620;
      --gold:      #c8a96e;
      --gold-dark: #8a6f3f;
      --cream:     #f0e8d8;
      --muted:     #6b6055;
      --red:       #8b2020;
      --text:      #e8ddd0;
    }

    html { scroll-behavior: smooth; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Montserrat', sans-serif;
      font-weight: 300;
      line-height: 1.7;
      overflow-x: hidden;
    }

    /* ── HERO ── */
    .hero {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 4rem 2rem;
      position: relative;
      background:
        radial-gradient(ellipse 80% 60% at 50% 0%, #2a1a0a44 0%, transparent 70%),
        radial-gradient(ellipse 40% 40% at 80% 80%, #8b202015 0%, transparent 60%),
        var(--bg);
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 80px,
        #ffffff03 80px,
        #ffffff03 81px
      );
      pointer-events: none;
    }

    .snake {
      font-size: 3rem;
      margin-bottom: 1.5rem;
      animation: float 4s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-10px); }
    }

    .hero-eyebrow {
      font-family: 'Montserrat', sans-serif;
      font-size: 0.7rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 1rem;
    }

    h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(3rem, 8vw, 6rem);
      font-weight: 300;
      line-height: 1.05;
      color: var(--cream);
      margin-bottom: 0.5rem;
    }

    h1 em {
      font-style: italic;
      color: var(--gold);
    }

    .hero-sub {
      font-size: 0.78rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 2.5rem;
    }

    .hero-badges {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 3rem;
    }

    .badge {
      border: 1px solid var(--gold-dark);
      color: var(--gold);
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 0.4rem 1rem;
      border-radius: 2px;
    }

    .hero-cta {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .btn-primary {
      background: var(--gold);
      color: #0b0906;
      font-family: 'Montserrat', sans-serif;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      text-decoration: none;
      padding: 0.85rem 2.2rem;
      border-radius: 2px;
      transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.85; }

    .btn-secondary {
      border: 1px solid var(--gold-dark);
      color: var(--gold);
      font-family: 'Montserrat', sans-serif;
      font-size: 0.75rem;
      font-weight: 400;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      text-decoration: none;
      padding: 0.85rem 2.2rem;
      border-radius: 2px;
      transition: all 0.2s;
    }
    .btn-secondary:hover { background: var(--gold-dark)22; }

    .scroll-hint {
      position: absolute;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      color: var(--muted);
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

    /* ── DIVIDER ── */
    .divider {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0 2rem;
      max-width: 780px;
      margin: 0 auto;
    }
    .divider-line { flex: 1; height: 1px; background: var(--border); }
    .divider-icon { color: var(--gold-dark); font-size: 0.8rem; }

    /* ── SECTIONS ── */
    section { padding: 5rem 2rem; }

    .section-inner {
      max-width: 780px;
      margin: 0 auto;
    }

    .section-label {
      font-size: 0.65rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 1rem;
    }

    h2 {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(2rem, 5vw, 3.2rem);
      font-weight: 300;
      color: var(--cream);
      margin-bottom: 1.5rem;
      line-height: 1.1;
    }

    h2 em { font-style: italic; color: var(--gold); }

    p { color: var(--muted); font-size: 0.9rem; max-width: 560px; }

    /* ── ABOUT ── */
    .about-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      align-items: center;
      margin-top: 2rem;
    }

    @media (max-width: 640px) {
      .about-grid { grid-template-columns: 1fr; }
    }

    .about-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .stat {
      border-left: 1px solid var(--gold-dark);
      padding-left: 1rem;
    }

    .stat-number {
      font-family: 'Cormorant Garamond', serif;
      font-size: 2.5rem;
      font-weight: 300;
      color: var(--gold);
      line-height: 1;
    }

    .stat-label {
      font-size: 0.65rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--muted);
      margin-top: 0.3rem;
    }

    /* ── HOURS ── */
    .hours-section { background: var(--bg2); }

    .hours-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }

    .hours-card {
      border: 1px solid var(--border);
      padding: 1.25rem;
      border-radius: 3px;
    }

    .hours-day {
      font-size: 0.7rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 0.4rem;
    }

    .hours-time {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.2rem;
      color: var(--cream);
    }

    /* ── AVAILABILITY ── */
    .avail-section { background: var(--bg); }

    .ssr-note {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #0f1f0f;
      border: 1px solid #2a4a2a;
      color: #6abf6a;
      font-size: 0.65rem;
      letter-spacing: 0.1em;
      font-family: 'Montserrat', sans-serif;
      padding: 0.3rem 0.7rem;
      border-radius: 2px;
      margin-bottom: 2rem;
    }

    .avail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .day-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1.25rem;
      transition: border-color 0.2s;
    }

    .day-card:hover { border-color: var(--gold-dark); }

    .day-card.today {
      border-color: var(--gold-dark);
      background: #1e1a10;
    }

    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    .day-label {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.1rem;
      color: var(--gold);
    }

    .day-date {
      font-size: 0.65rem;
      color: var(--muted);
      font-family: monospace;
    }

    .shift-group { margin-bottom: 0.75rem; }

    .shift-name {
      font-size: 0.6rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--muted);
      display: block;
      margin-bottom: 0.4rem;
    }

    .time-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .pill {
      font-size: 0.75rem;
      font-family: 'Montserrat', sans-serif;
      background: #ffffff06;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.2rem 0.5rem;
      border-radius: 2px;
    }

    .no-avail {
      color: var(--muted);
      font-size: 0.85rem;
      font-style: italic;
      margin-top: 1rem;
    }

    /* ── BOOK CTA ── */
    .book-section {
      background: var(--bg2);
      text-align: center;
    }

    .book-section h2 { margin: 0 auto 0.5rem; }
    .book-section p  { margin: 0 auto 2rem; text-align: center; }

    /* ── INFO STRIP ── */
    .info-strip {
      background: var(--surface);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }

    .info-strip .section-inner {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 2rem;
      padding: 2.5rem 0;
    }

    .info-item { text-align: center; }

    .info-icon { font-size: 1.4rem; margin-bottom: 0.4rem; }

    .info-title {
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 0.3rem;
    }

    .info-value {
      font-size: 0.82rem;
      color: var(--text);
    }

    /* ── FOOTER ── */
    footer {
      padding: 3rem 2rem;
      text-align: center;
      border-top: 1px solid var(--border);
    }

    .footer-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.4rem;
      color: var(--gold);
      margin-bottom: 0.5rem;
    }

    .footer-details {
      font-size: 0.75rem;
      color: var(--muted);
      line-height: 2;
    }

    .footer-details a { color: var(--gold-dark); text-decoration: none; }

    .powered {
      margin-top: 1.5rem;
      font-size: 0.65rem;
      color: #3a3530;
      letter-spacing: 0.1em;
    }
    .powered a { color: #4a4540; text-decoration: none; }
  </style>
</head>
<body>

<!-- ══ HERO ══════════════════════════════════════════════════════════════ -->
<section class="hero">
  <div class="snake">🐍</div>
  <p class="hero-eyebrow">Fortitude Valley · Brisbane</p>
  <h1>Medusa<br/><em>Osteria Romana</em></h1>
  <p class="hero-sub">Authentic Roman Italian · Est. 2019</p>
  <div class="hero-badges">
    <span class="badge">Roman Italian</span>
    <span class="badge">4.7 ★ · 312 Reviews</span>
    <span class="badge">$$–$$$</span>
    <span class="badge">Dine In · Reservations</span>
  </div>
  <div class="hero-cta">
    <a href="${BOOK}" class="btn-primary">Reserve a Table</a>
    <a href="#availability" class="btn-secondary">View Availability</a>
  </div>
  <span class="scroll-hint">↓ scroll</span>
</section>

<!-- ══ ABOUT ══════════════════════════════════════════════════════════════ -->
<section>
  <div class="section-inner">
    <p class="section-label">Our Story</p>
    <div class="about-grid">
      <div>
        <h2>Roman tradition,<br/><em>Brisbane soul</em></h2>
        <p>Medusa brings the soul of Rome's trattorias to Fortitude Valley — hand-rolled pasta, wood-fired proteins, and a wine list curated from the hills of Lazio. Every dish is a tribute to the eternal city.</p>
      </div>
      <div class="about-stats">
        <div class="stat">
          <div class="stat-number">4.7</div>
          <div class="stat-label">Guest Rating</div>
        </div>
        <div class="stat">
          <div class="stat-number">312</div>
          <div class="stat-label">Reviews</div>
        </div>
        <div class="stat">
          <div class="stat-number">5+</div>
          <div class="stat-label">Years Serving</div>
        </div>
        <div class="stat">
          <div class="stat-number">$$</div>
          <div class="stat-label">Price Range</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ══ INFO STRIP ══════════════════════════════════════════════════════════ -->
<div class="info-strip">
  <div class="section-inner">
    <div class="info-item">
      <div class="info-icon">📍</div>
      <div class="info-title">Location</div>
      <div class="info-value">14 Via Roma Lane<br/>Fortitude Valley QLD 4006</div>
    </div>
    <div class="info-item">
      <div class="info-icon">📞</div>
      <div class="info-title">Phone</div>
      <div class="info-value"><a href="tel:+61731930200">07 3193 0200</a></div>
    </div>
    <div class="info-item">
      <div class="info-icon">🍽️</div>
      <div class="info-title">Cuisine</div>
      <div class="info-value">Roman Italian<br/>Wood-fired · Handmade Pasta</div>
    </div>
    <div class="info-item">
      <div class="info-icon">🅿️</div>
      <div class="info-title">Parking</div>
      <div class="info-value">Street parking available<br/>Brunswick St car park nearby</div>
    </div>
  </div>
</div>

<!-- ══ HOURS ══════════════════════════════════════════════════════════════ -->
<section class="hours-section">
  <div class="section-inner">
    <p class="section-label">When To Visit</p>
    <h2>Opening <em>Hours</em></h2>
    <div class="hours-grid">
      <div class="hours-card">
        <div class="hours-day">Monday – Thursday</div>
        <div class="hours-time">5:00 pm – 10:00 pm</div>
      </div>
      <div class="hours-card">
        <div class="hours-day">Friday</div>
        <div class="hours-time">12:00 pm – 11:00 pm</div>
      </div>
      <div class="hours-card">
        <div class="hours-day">Saturday</div>
        <div class="hours-time">12:00 pm – 11:00 pm</div>
      </div>
      <div class="hours-card">
        <div class="hours-day">Sunday</div>
        <div class="hours-time">12:00 pm – 9:00 pm</div>
      </div>
    </div>
    <p style="margin-top:1.5rem;font-size:0.75rem;">Last seating 90 minutes before close · Walk-ins welcome · Reservations strongly recommended Fri & Sat</p>
  </div>
</section>

<!-- ══ AVAILABILITY ════════════════════════════════════════════════════════ -->
<section class="avail-section" id="availability">
  <div class="section-inner">
    <p class="section-label">Live Table Availability</p>
    <h2>This <em>Week</em></h2>
    <span class="ssr-note">✓ Pre-rendered · Updated every 60 seconds · AI-readable</span>

    ${fetchError
      ? `<p class="no-avail">⚠ Could not load availability: ${fetchError}</p>`
      : weekSlots.length === 0
        ? `<p class="no-avail">No availability data for this week.</p>`
        : `<div class="avail-grid">${availHTML}</div>`
    }

    <div style="margin-top:2.5rem;text-align:center">
      <a href="${BOOK}" class="btn-primary">Book a Table →</a>
      <p style="margin-top:0.75rem;font-size:0.72rem;text-align:center;">Tables held for 15 minutes · Private dining available for groups of 10+</p>
    </div>
  </div>
</section>

<!-- ══ FOOTER ══════════════════════════════════════════════════════════════ -->
<footer>
  <div class="footer-name">Medusa Osteria Romana</div>
  <div class="footer-details">
    14 Via Roma Lane, Fortitude Valley QLD 4006<br/>
    <a href="tel:+61731930200">07 3193 0200</a> · Roman Italian · Dine In
  </div>
  <p class="powered">Powered by <a href="https://getfork.ai">GetFork Voice AI</a></p>
</footer>

</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type":  "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
      "X-Rendered-By": "GetFork-SSR"
    }
  });
};

export const config = { path: "/" };
