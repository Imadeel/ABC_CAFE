// netlify/edge-functions/availability.js
// Runs at the edge BEFORE the page is served — slots are baked into HTML
// GPT, Gemini, and any scraper will see them in plain text.

export default async (request, context) => {
  const SLUG = "medusa-italian-osteria-romana";
  const API   = `https://mcp.getfork.ai/api/availability/${SLUG}.json`;
  const BOOK  = `https://mcp.getfork.ai/book/${SLUG}`;

  // ── Fetch live availability ────────────────────────────────────────────────
  let availability = [];
  let fetchedAt    = "";
  let fetchError   = "";

  try {
    const res  = await fetch(API, { headers: { "User-Agent": "GetFork-SSR/1.0" } });
    const json = await res.json();
    availability = json.availability ?? [];
    fetchedAt    = json.generatedAt ?? new Date().toISOString();
  } catch (e) {
    fetchError = String(e);
  }

  // ── Build structured-data (JSON-LD) for AI crawlers ───────────────────────
  const slotsForLD = availability.flatMap(day =>
    day.slots.map(s => ({
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": `https://schema.org/${day.dayName}`,
      "opens":  s.time,
      "closes": "23:00"
    }))
  );

  const jsonLD = JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "FoodEstablishment",
    "name":     "Medusa Osteria Romana",
    "address": {
      "@type":           "PostalAddress",
      "streetAddress":   "14 Via Roma Lane",
      "addressLocality": "Fortitude Valley",
      "addressRegion":   "QLD",
      "postalCode":      "4006",
      "addressCountry":  "AU"
    },
    "telephone":         "+61731930200",
    "openingHoursSpecification": slotsForLD
  }, null, 2);

  // ── Build human-readable slot HTML ────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  const slotRows = availability.map(day => {
    const isPast   = day.date < today;
    const isToday  = day.date === today;
    const label    = isToday ? `${day.dayName} (Today)` : day.dayName;

    // Group by shift
    const byShift = {};
    for (const s of day.slots) {
      const shift = s.shift || "Available";
      if (!byShift[shift]) byShift[shift] = [];
      byShift[shift].push(s.time);
    }

    const shiftHtml = Object.entries(byShift).map(([shift, times]) => `
      <div class="shift">
        <span class="shift-label">${shift}</span>
        <div class="times">${times.map(t => `<span class="slot">${t}</span>`).join("")}</div>
      </div>`).join("");

    return `
    <section class="day${isPast ? " past" : ""}${isToday ? " today" : ""}" 
             data-date="${day.date}" 
             aria-label="Availability for ${day.dayName} ${day.date}">
      <h2 class="day-name">${label} <time datetime="${day.date}" class="day-date">${day.date}</time></h2>
      <p class="status">Status: <strong>${day.status}</strong></p>
      ${shiftHtml}
    </section>`;
  }).join("\n");

  // ── Full HTML response (fully pre-rendered — no JS required to read) ───────
  const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Medusa Osteria Romana — Live Availability</title>
  <meta name="description" content="Live dining availability for Medusa Osteria Romana, Fortitude Valley Brisbane. Book a table online." />
  <meta name="robots" content="index, follow" />

  <!-- Open Graph -->
  <meta property="og:title"       content="Medusa Osteria Romana — Live Availability" />
  <meta property="og:description" content="Roman Italian dining in Fortitude Valley. See live table availability." />
  <meta property="og:type"        content="restaurant" />

  <!-- Structured data for AI / search engines -->
  <script type="application/ld+json">${jsonLD}</script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #0e0c0a;
      --surface:  #1a1714;
      --border:   #2e2a26;
      --gold:     #c9a84c;
      --gold-dim: #7a6030;
      --text:     #e8e0d5;
      --muted:    #7a7268;
      --green:    #4caf7a;
      --dinner:   #c9a84c;
      --lunch:    #7ab8c9;
      --avail:    #a07ac9;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: Georgia, "Times New Roman", serif;
      min-height: 100vh;
      padding: 2rem 1rem 4rem;
    }

    header {
      text-align: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 2rem;
      margin-bottom: 2rem;
    }

    header .emoji { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }

    h1 {
      font-size: clamp(1.4rem, 4vw, 2.2rem);
      color: var(--gold);
      letter-spacing: 0.04em;
      font-weight: normal;
    }

    .subtitle {
      color: var(--muted);
      font-size: 0.9rem;
      margin-top: 0.4rem;
    }

    /* ── SSR badge — tells AI crawlers this is pre-rendered ── */
    .ssr-badge {
      display: inline-block;
      background: #1e2a1a;
      border: 1px solid #4caf7a55;
      color: var(--green);
      font-family: monospace;
      font-size: 0.72rem;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      margin-top: 0.8rem;
      letter-spacing: 0.06em;
    }

    .fetched-at {
      color: var(--muted);
      font-size: 0.75rem;
      font-family: monospace;
      margin-top: 0.3rem;
    }

    main {
      max-width: 780px;
      margin: 0 auto;
    }

    /* ── Availability sections ── */
    .day {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1rem;
    }

    .day.today {
      border-color: var(--gold-dim);
      box-shadow: 0 0 0 1px var(--gold-dim);
    }

    .day.past { opacity: 0.4; }

    .day-name {
      font-size: 1.05rem;
      color: var(--gold);
      font-weight: normal;
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      margin-bottom: 0.3rem;
    }

    .day-date {
      font-size: 0.8rem;
      color: var(--muted);
      font-family: monospace;
    }

    .status {
      font-size: 0.8rem;
      color: var(--muted);
      margin-bottom: 0.8rem;
    }
    .status strong { color: var(--green); }

    .shift {
      margin-bottom: 0.8rem;
    }

    .shift-label {
      display: inline-block;
      font-size: 0.72rem;
      font-family: monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.15rem 0.5rem;
      border-radius: 3px;
      margin-bottom: 0.5rem;
      background: #ffffff0d;
      color: var(--muted);
    }

    .shift:has(.shift-label:contains("Dinner"))  .shift-label { color: var(--dinner); }
    .shift:has(.shift-label:contains("Lunch"))   .shift-label { color: var(--lunch);  }
    .shift:has(.shift-label:contains("Available")) .shift-label { color: var(--avail); }

    /* Colour shift labels via class on parent */
    .shift[data-shift="Dinner"]    .shift-label { color: var(--dinner); }
    .shift[data-shift="Lunch"]     .shift-label { color: var(--lunch);  }
    .shift[data-shift="Available"] .shift-label { color: var(--avail);  }

    .times {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .slot {
      font-family: monospace;
      font-size: 0.82rem;
      background: #ffffff08;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.2rem 0.55rem;
      color: var(--text);
    }

    /* ── Book CTA ── */
    .book-cta {
      text-align: center;
      margin: 2.5rem 0 1rem;
    }

    .book-btn {
      display: inline-block;
      background: var(--gold);
      color: #0e0c0a;
      font-family: Georgia, serif;
      font-size: 1rem;
      text-decoration: none;
      padding: 0.75rem 2rem;
      border-radius: 6px;
      letter-spacing: 0.05em;
      transition: opacity 0.2s;
    }
    .book-btn:hover { opacity: 0.85; }

    .policy {
      text-align: center;
      color: var(--muted);
      font-size: 0.78rem;
      margin-top: 0.6rem;
    }

    /* ── Error state ── */
    .error {
      background: #2a1a1a;
      border: 1px solid #7a3030;
      color: #c97c7c;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.85rem;
    }

    footer {
      text-align: center;
      color: var(--muted);
      font-size: 0.75rem;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
    footer a { color: var(--gold-dim); text-decoration: none; }
  </style>
</head>
<body>

<header>
  <span class="emoji">🐍</span>
  <h1>Medusa Osteria Romana</h1>
  <p class="subtitle">Fortitude Valley · Brisbane · Roman Italian</p>
  <span class="ssr-badge">✓ SERVER-SIDE RENDERED — slots pre-baked into HTML</span>
  ${fetchedAt ? `<p class="fetched-at">Data fetched at: ${fetchedAt}</p>` : ""}
</header>

<main>

  ${fetchError ? `<div class="error">⚠ Could not fetch live availability: ${fetchError}</div>` : ""}

  <!--
    ════════════════════════════════════════════════════════
    AVAILABILITY DATA — PRE-RENDERED FOR AI CRAWLERS
    All time slots are in this HTML. No JavaScript required.
    ════════════════════════════════════════════════════════
  -->
  ${slotRows || `<p style="color:var(--muted);text-align:center">No availability data found.</p>`}

  <div class="book-cta">
    <a href="${BOOK}" class="book-btn">Book a Table →</a>
    <p class="policy">Walk-ins welcome · Tables held 15 min · Last seating 90 min before close</p>
  </div>

</main>

<footer>
  <p>Medusa Osteria Romana · 14 Via Roma Lane, Fortitude Valley QLD 4006 · <a href="tel:+61731930200">07 3193 0200</a></p>
  <p style="margin-top:0.4rem">Availability powered by <a href="https://getfork.ai">GetFork Voice AI</a></p>
</footer>

</body>
</html>`;

  return new Response(html, {
    status:  200,
    headers: {
      "Content-Type":  "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
      "X-Rendered-By": "GetFork-Edge-SSR"
    }
  });
};

export const config = { path: "/" };
