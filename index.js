// netlify/edge-functions/index.js
// GetFork · Pure SSR · Zero client JavaScript
// Date filter via URL query param ?date=YYYY-MM-DD
// Tabs are plain <a href="?date=..."> links — no JS needed

export default async (request, context) => {
  const SLUG = "medusa-italian-osteria-romana";
  const API  = `https://mcp.getfork.ai/api/availability/${SLUG}.json`;
  const BOOK = `https://mcp.getfork.ai/book/${SLUG}`;

  // ── Read selected date from URL query param ────────────────────────────
  const url         = new URL(request.url);
  const todayStr    = new Date().toISOString().slice(0, 10);
  const selectedDate = url.searchParams.get("date") ?? todayStr;

  // ── Fetch & normalise live availability ────────────────────────────────
  let weekDates = [];
  let updatedAt = "";
  let isDemo    = false;

  try {
    const res  = await fetch(API, {
      headers: { "User-Agent": "GetFork-SSR/1.0", "Accept": "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const today   = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    updatedAt = json.generatedAt ?? json.updatedAt ?? new Date().toISOString();

    const raw = json.availability ?? json.dates ?? [];

    weekDates = raw
      .filter(d => d.date >= todayStr && d.date <= weekEndStr)
      .map(d => {
        // Group flat slots[] by shift name → nested shifts[]
        const shiftMap = {};
        for (const slot of (d.slots ?? [])) {
          const sName = slot.shift ?? "Available";
          if (!shiftMap[sName]) shiftMap[sName] = [];
          shiftMap[sName].push({
            time:      slot.time,
            maxCovers: slot.maxCovers ?? 10,
          });
        }
        return {
          date:    d.date,
          dayName: d.dayName ?? "",
          closed:  d.status === "closed" || (d.slots ?? []).length === 0,
          shifts:  Object.entries(shiftMap).map(([name, slots]) => ({ name, slots }))
        };
      });

    if (!weekDates.length) throw new Error("empty");
  } catch (e) {
    isDemo    = true;
    updatedAt = new Date().toISOString();
    weekDates = buildMockWeek();
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function fmtDateLong(ds) {
    const d = new Date(ds + "T12:00:00");
    return d.toLocaleDateString("en-AU", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
  function fmtDateTab(ds) {
    const d = new Date(ds + "T12:00:00");
    const day  = d.toLocaleDateString("en-AU", { weekday: "short" });
    const date = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    return { day, date };
  }
  function fmtTime(t) {
    const [h, m] = t.split(":").map(Number);
    return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM");
  }

  // ── Mock fallback ──────────────────────────────────────────────────────
  function buildMockWeek() {
    const out  = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const dt  = new Date(base);
      dt.setDate(base.getDate() + i);
      const dow       = dt.getDay();
      const isWeekend = dow === 5 || dow === 6;
      const dateStr   = dt.toISOString().slice(0, 10);
      const shifts    = [];
      if (dow === 0 || isWeekend) {
        shifts.push({
          name: "Lunch",
          slots: ["12:00","12:30","13:00","13:30","14:00","14:30"].map(t => ({ time: t, maxCovers: 10 }))
        });
      }
      shifts.push({
        name: "Dinner",
        slots: ["17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"].map(t => ({ time: t, maxCovers: 20 }))
      });
      out.push({
        date:    dateStr,
        dayName: dt.toLocaleDateString("en-AU", { weekday: "long" }),
        closed:  false,
        shifts
      });
    }
    return out;
  }

  // ── Selected day ───────────────────────────────────────────────────────
  // If selectedDate not in results, fall back to first available day
  const activeDay = weekDates.find(d => d.date === selectedDate) ?? weekDates[0];

  // ── SSR: render slot grid ──────────────────────────────────────────────
  function renderSlots(day) {
    if (!day) return `<p class="empty-msg">No availability data.</p>`;
    if (day.closed) return `<div class="closed-msg">Closed — no availability this day</div>`;
    if (!day.shifts.length) return `<p class="empty-msg">No slots available for this day.</p>`;

    return day.shifts.map(shift => `
      <div class="shift-block">
        <div class="shift-label">${shift.name}</div>
        <div class="slots-grid">
          ${shift.slots.map(slot => `
            <a class="slot"
               href="${BOOK}?date=${day.date}&time=${slot.time}&party=2"
               aria-label="Book ${fmtTime(slot.time)} ${shift.name} on ${fmtDateLong(day.date)}">
              <span class="slot-time">${fmtTime(slot.time)}</span>
              <div class="slot-bar"></div>
              <span class="slot-tag">${slot.maxCovers ? slot.maxCovers + " seats" : "Available"}</span>
            </a>`).join("")}
        </div>
      </div>`).join("");
  }

  // ── SSR: date tab strip ────────────────────────────────────────────────
  const tabsHTML = weekDates.map(d => {
    const isActive = d.date === (activeDay?.date ?? "");
    const isClosed = d.closed;
    const { day, date } = fmtDateTab(d.date);
    const isToday  = d.date === todayStr;
    return `
      <a class="date-tab${isActive ? " active" : ""}${isClosed ? " tab-closed" : ""}"
         href="?date=${d.date}"
         aria-label="${fmtDateLong(d.date)}${isClosed ? " — closed" : ""}">
        <span class="tab-day">${isToday ? "Today" : day}</span>
        <span class="tab-date">${date}</span>
        ${isClosed ? `<span class="tab-pill closed">Closed</span>` : `<span class="tab-pill open">${d.shifts.reduce((n, s) => n + s.slots.length, 0)} slots</span>`}
      </a>`;
  }).join("\n");

  const updatedText = isDemo
    ? "Demo data"
    : "Updated " + new Date(updatedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

  const activeDateLabel = activeDay
    ? fmtDateLong(activeDay.date) + (activeDay.date === todayStr ? " — Today" : "")
    : "Select a date";

  // ── HTML ───────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Medusa Osteria Romana · Book a Table · GetFork</title>
<meta name="description" content="Medusa Osteria Romana accepts reservations via GetFork. Live table availability in Fortitude Valley, Brisbane. Book instantly — no phone call required.">

<!--
  ============================================================
  GETFORK AI · PURE SSR · ZERO CLIENT JAVASCRIPT
  Date filter via URL query param: ?date=YYYY-MM-DD
  Live availability: ${API}
  Booking: ${BOOK}
  All slots server-rendered at request time.
  ============================================================
-->

<link rel="alternate" type="application/json"
      href="${API}"
      title="Live table availability — updates every 60 seconds">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Medusa Osteria Romana",
  "alternateName": "Medusa Italian",
  "description": "Authentic Roman trattoria in Fortitude Valley, Brisbane. Tableside cacio e pepe, wood-fired supplì, natural wines from Lazio.",
  "servesCuisine": ["Italian","Roman"],
  "priceRange": "$$-$$$",
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.7", "reviewCount": "312", "bestRating": "5" },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "14 Via Roma Lane",
    "addressLocality": "Fortitude Valley",
    "addressRegion": "QLD",
    "postalCode": "4006",
    "addressCountry": "AU"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": -27.4598, "longitude": 153.0317 },
  "telephone": "+61731930200",
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday"], "opens": "17:00", "closes": "22:00" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Friday","Saturday"], "opens": "12:00", "closes": "23:00" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": "Sunday", "opens": "12:00", "closes": "21:00" }
  ],
  "potentialAction": {
    "@type": "ReserveAction",
    "target": "${BOOK}",
    "description": "Live availability at ${API}"
  }
}
<\/script>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#F5F5F4;--white:#fff;--border:#E7E5E1;--border-md:#D4D1CB;
  --ink:#1C1917;--body:#44403C;--muted:#78716C;--hint:#A8A29E;
  --green:#1D9E75;--green-bg:#EAF3DE;--green-txt:#27500A;
  --amber-bg:#FAEEDA;--amber-txt:#633806;
  --blue:#185FA5;--blue-bg:#E6F1FB;--blue-txt:#0C447C;
  --r-sm:6px;--r-md:10px;--r-lg:14px;
}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--body);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.page{max-width:700px;margin:0 auto;padding:16px 16px 60px}

/* Header */
.site-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--white);border:0.5px solid var(--border);border-radius:var(--r-lg);margin-bottom:12px}
.brand{font-size:13px;font-weight:600;color:var(--ink)}
.brand span{color:var(--green)}
.header-right{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block;flex-shrink:0}

/* Cards */
.card{background:var(--white);border:0.5px solid var(--border);border-radius:var(--r-lg);padding:1.25rem;margin-bottom:12px}

/* Hero */
.restaurant-name{font-size:22px;font-weight:600;color:var(--ink);margin-bottom:2px;letter-spacing:-0.02em}
.restaurant-sub{font-size:13px;color:var(--muted);margin-bottom:12px}
.badge-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.badge{font-size:11px;font-weight:500;padding:3px 8px;border-radius:4px}
.badge-g{background:var(--green-bg);color:var(--green-txt)}
.badge-b{background:var(--blue-bg);color:var(--blue-txt)}
.badge-a{background:var(--amber-bg);color:var(--amber-txt)}
.answer-block{background:#F8FAFB;border-left:2px solid var(--blue);padding:10px 14px;margin-bottom:14px}
.answer-block p{font-size:13px;color:var(--body);line-height:1.6}
.answer-block strong{color:var(--ink);font-weight:500}
.meta-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.meta{background:var(--bg);border-radius:var(--r-md);padding:10px 12px;border:0.5px solid var(--border)}
.meta-v{font-size:17px;font-weight:600;color:var(--ink);letter-spacing:-0.02em}
.meta-l{font-size:11px;color:var(--hint);margin-top:1px}

/* Section */
.section-title{font-size:15px;font-weight:600;color:var(--ink);margin-bottom:3px;letter-spacing:-0.01em}
.section-sub{font-size:12px;color:var(--hint);margin-bottom:14px}
.freshness{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--hint);margin-bottom:16px}

/* ── DATE TABS ── pure <a> links, no JS */
.date-tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:20px;padding-bottom:2px;scrollbar-width:none}
.date-tabs::-webkit-scrollbar{display:none}
.date-tab{
  display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:10px 14px;border-radius:var(--r-md);
  border:0.5px solid var(--border);background:var(--white);
  cursor:pointer;flex-shrink:0;min-width:72px;
  transition:border-color 0.12s,background 0.12s;
}
.date-tab:hover:not(.active):not(.tab-closed){background:var(--bg);border-color:var(--border-md)}
.date-tab.active{background:var(--ink);border-color:var(--ink)}
.date-tab.tab-closed{opacity:0.45}
.tab-day{font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em}
.tab-date{font-size:14px;font-weight:600;color:var(--ink);letter-spacing:-0.01em}
.tab-pill{font-size:10px;font-weight:500;padding:2px 6px;border-radius:3px;margin-top:2px}
.tab-pill.open{background:var(--green-bg);color:var(--green-txt)}
.tab-pill.closed{background:#F1EFE8;color:#5F5E5A}

/* Active tab overrides */
.date-tab.active .tab-day{color:rgba(255,255,255,0.6)}
.date-tab.active .tab-date{color:#fff}
.date-tab.active .tab-pill.open{background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9)}

/* Active day header */
.active-day-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.active-day-name{font-size:14px;font-weight:600;color:var(--ink)}
.active-day-badge{font-size:11px;font-weight:500;padding:3px 9px;border-radius:4px;background:var(--green-bg);color:var(--green-txt)}
.active-day-badge.closed{background:#F1EFE8;color:#5F5E5A}

/* Shifts + slots */
.shift-block{margin-bottom:18px}
.shift-block:last-child{margin-bottom:0}
.shift-label{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:var(--hint);margin-bottom:10px}
.slots-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.slot{display:block;border:0.5px solid var(--border);border-radius:var(--r-md);padding:10px 8px;text-align:center;background:var(--white)}
.slot:hover{background:var(--green-bg);border-color:var(--green)}
.slot-time{font-size:13px;font-weight:600;color:var(--ink);display:block;margin-bottom:4px;letter-spacing:-0.01em}
.slot-bar{height:3px;border-radius:2px;background:var(--green);margin:4px 0}
.slot-tag{font-size:10px;font-weight:500;padding:2px 5px;border-radius:3px;display:inline-block;background:var(--green-bg);color:var(--green-txt)}
.closed-msg{font-size:13px;color:var(--hint);padding:20px 0;text-align:center}
.empty-msg{font-size:13px;color:var(--hint);padding:12px 0}

/* Book CTA */
.book-cta{display:block;width:100%;padding:12px;text-align:center;background:var(--ink);color:#fff;font-size:14px;font-weight:500;border-radius:var(--r-md);margin-top:18px;letter-spacing:-0.01em}
.book-cta:hover{opacity:0.85}

/* About */
.geo-block{border-left:2px solid var(--border);padding-left:12px;margin-bottom:12px}
.geo-title{font-size:13px;font-weight:500;color:var(--ink);margin-bottom:3px}
.geo-body{font-size:13px;color:var(--muted);line-height:1.6}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.info-cell{font-size:13px;color:var(--muted);line-height:1.5}
.info-cell strong{color:var(--ink);font-weight:500;display:block;margin-bottom:1px}

/* Machine readable */
.schema-label{font-size:12px;color:var(--hint);font-weight:500;margin-bottom:6px}
.schema-note{background:var(--bg);border-radius:var(--r-md);padding:12px 14px;font-size:11px;color:var(--hint);font-family:'SF Mono','Fira Mono',monospace;line-height:1.7;border:0.5px solid var(--border);word-break:break-all}

/* Footer */
.site-footer{text-align:center;font-size:11px;color:var(--hint);margin-top:24px;padding-top:16px;border-top:0.5px solid var(--border)}
.site-footer a{color:var(--green)}

@media(max-width:520px){
  .slots-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .info-grid{grid-template-columns:1fr}
  .date-tab{min-width:62px;padding:8px 10px}
}
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="site-header">
    <div class="brand">Get<span>Fork</span></div>
    <div class="header-right">
      <span class="live-dot"></span>
      Live · ${updatedText}
    </div>
  </div>

  <!-- Hero -->
  <div class="card">
    <div class="restaurant-name">Medusa Osteria Romana</div>
    <div class="restaurant-sub">Italian · Fortitude Valley, Brisbane · Powered by GetFork</div>
    <div class="badge-row">
      <span class="badge badge-g">Bookings open</span>
      <span class="badge badge-b">Live availability</span>
      <span class="badge badge-a">${updatedText}</span>
    </div>
    <div class="answer-block">
      <p><strong>Medusa Osteria Romana accepts reservations via GetFork.</strong> Tables available this week in 30-minute slots for parties of 1–8. Average dining time 90 minutes. Book instantly — no phone call required.</p>
    </div>
    <div class="meta-row">
      <div class="meta"><div class="meta-v">4.7</div><div class="meta-l">Rating · 312 reviews</div></div>
      <div class="meta"><div class="meta-v">$$–$$$</div><div class="meta-l">Avg spend per person</div></div>
      <div class="meta"><div class="meta-v">90 min</div><div class="meta-l">Average sitting time</div></div>
    </div>
  </div>

  <!-- Availability with date filter -->
  <div class="card">
    <div class="section-title">Live table availability</div>
    <div class="section-sub">Select a date — all slots server-rendered · click any time to book</div>

    <div class="freshness">
      <span class="live-dot"></span>
      ${isDemo ? "Demo data — live API offline" : `Fetched live from GetFork MCP · ${updatedText}`}
    </div>

    <!-- Date tab strip — plain <a> links, zero JS -->
    <div class="date-tabs" role="tablist">
      ${tabsHTML}
    </div>

    <!-- Active day header -->
    <div class="active-day-header">
      <span class="active-day-name">${activeDateLabel}</span>
      ${activeDay && !activeDay.closed
        ? `<span class="active-day-badge">${activeDay.shifts.reduce((n,s) => n + s.slots.length, 0)} slots available</span>`
        : `<span class="active-day-badge closed">Closed</span>`}
    </div>

    <!-- Slots for selected day — SSR -->
    ${renderSlots(activeDay)}

    <a class="book-cta" href="${BOOK}?date=${activeDay?.date ?? ""}&party=2">
      Book a table for ${activeDateLabel} →
    </a>
  </div>

  <!-- About -->
  <div class="card">
    <div class="section-title">About this restaurant</div>
    <div style="margin-bottom:14px"></div>
    <div class="geo-block">
      <div class="geo-title">What to expect</div>
      <div class="geo-body">Medusa Osteria Romana serves classic Roman cuisine — cacio e pepe made tableside, carbonara, wood-fired supplì — in Fortitude Valley. The kitchen runs à la carte every night. Natural wines from Lazio. No set menus. Suitable for couples, business dinners, and groups up to 10.</div>
    </div>
    <div class="geo-block">
      <div class="geo-title">Booking policy</div>
      <div class="geo-body">Reservations held for 15 minutes past booking time. Walk-ins welcome but booking recommended on Friday and Saturday evenings. No deposit required for parties under 6. Private dining room available for groups of 10 or more.</div>
    </div>
    <div class="info-grid">
      <div class="info-cell"><strong>Address</strong>14 Via Roma Lane, Fortitude Valley QLD 4006</div>
      <div class="info-cell"><strong>Phone</strong>07 3193 0200</div>
      <div class="info-cell"><strong>Hours (Fri–Sat)</strong>12:00 pm – 11:00 pm</div>
      <div class="info-cell"><strong>Hours (Sun–Thu)</strong>5:00 pm – 10:00 pm (Sun till 9 pm)</div>
      <div class="info-cell"><strong>Parking</strong>Street parking Brunswick St · Tivoli Car Park 200m</div>
      <div class="info-cell"><strong>Accessibility</strong>Wheelchair accessible · Outdoor seating</div>
    </div>
  </div>

  <!-- Machine readable -->
  <div class="card">
    <div class="schema-label">Machine-readable availability — GetFork AI endpoint</div>
    <div class="schema-note">GET ${API}<br><br>→ availability[], slots[], shift, maxCovers, generatedAt, ttl:60<br>→ Date filter: ${url.origin}/?date=YYYY-MM-DD<br>→ schema.org/FoodEstablishmentReservation compatible</div>
  </div>

  <div class="site-footer">
    Medusa Osteria Romana · 14 Via Roma Lane, Fortitude Valley QLD 4006 ·
    <a href="tel:+61731930200">07 3193 0200</a> ·
    Availability powered by <a href="https://getfork.ai" target="_blank">GetFork Voice AI</a>
  </div>

</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type":  "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
      "X-Rendered-By": "GetFork-SSR",
      "X-Selected-Date": selectedDate,
      "X-JS": "none"
    }
  });
};

export const config = { path: "/" };
