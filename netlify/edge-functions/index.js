// netlify/edge-functions/index.js
// GetFork · GEO-optimised SSR restaurant landing page
// Fetches live availability from MCP endpoint, bakes into HTML for AI crawlers
// Humans get full interactive booking UI · AI gets plain HTML slots

export default async (request, context) => {
  const SLUG = "medusa-italian-osteria-romana";
  const API  = `https://mcp.getfork.ai/api/availability/${SLUG}.json`;
  const BOOK = `https://mcp.getfork.ai/book/${SLUG}`;

  // ── Fetch live availability ─────────────────────────────────────────────
  let weekDates  = [];
  let updatedAt  = "";
  let isDemo     = false;

  try {
    const res  = await fetch(API, {
      headers: { "User-Agent": "GetFork-SSR/1.0", "Accept": "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Filter to current week (today + 6 days)
    const today   = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 6);
    const todayStr   = today.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const raw = json.dates ?? json.availability ?? [];
    weekDates = raw.filter(d => d.date >= todayStr && d.date <= weekEndStr);
    updatedAt = json.updatedAt ?? json.last_updated ?? new Date().toISOString();

    if (!weekDates.length) throw new Error("empty");
  } catch (e) {
    // Graceful fallback — build realistic demo data
    isDemo    = true;
    updatedAt = new Date().toISOString();
    weekDates = buildMockWeek();
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function fmtDateLong(ds) {
    const d = new Date(ds + "T12:00:00");
    return d.toLocaleDateString("en-AU", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  }
  function fmtDateShort(ds) {
    const d = new Date(ds + "T12:00:00");
    return d.toLocaleDateString("en-AU", { weekday:"short", day:"numeric", month:"short" });
  }
  function fmtTime(t) {
    const [h, m] = t.split(":").map(Number);
    return (h % 12 || 12) + ":" + String(m).padStart(2,"0") + " " + (h >= 12 ? "PM" : "AM");
  }
  function slotStatus(pct) {
    if (pct === 0)  return "full";
    if (pct < 35)   return "hot";
    return "available";
  }

  // ── Mock week builder ──────────────────────────────────────────────────
  function buildMockWeek() {
    const out = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const dt  = new Date(base);
      dt.setDate(base.getDate() + i);
      const dow        = dt.getDay();
      const isWeekend  = dow === 5 || dow === 6;
      const hasLunch   = dow === 0 || isWeekend;
      const dateStr    = dt.toISOString().slice(0, 10);
      const shifts     = [];

      if (hasLunch) {
        shifts.push({
          name: "Lunch",
          slots: ["12:00","12:30","13:00","13:30","14:00","14:30"].map((t, idx) => ({
            time: t,
            availablePct: isWeekend ? [20,0,40,65,85,90][idx] : [80,85,80,75,70,60][idx],
            maxCovers: 8
          }))
        });
      }

      const dinnerTimes = ["17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"];
      const dinnerPcts  = isWeekend
        ? [35, 15, 5, 0, 0, 25, 50, 75]
        : (i === 0 ? [85,75,60,50,45,55,70,85] : [92,88,82,72,68,72,82,92]);

      shifts.push({
        name: "Dinner",
        slots: dinnerTimes.map((t, idx) => ({
          time: t, availablePct: dinnerPcts[idx], maxCovers: 8
        }))
      });

      out.push({ date: dateStr, closed: false, shifts });
    }
    return out;
  }

  // ── Build SSR availability HTML (AI-readable plain text) ───────────────
  const todayStr = new Date().toISOString().slice(0, 10);

  const ssrAvailHTML = weekDates.map(day => {
    if (day.closed) {
      return `<div class="ssr-day"><div class="ssr-day-name">${fmtDateLong(day.date)}</div><div class="ssr-closed">Closed</div></div>`;
    }
    const shifts = day.shifts ?? [];
    const shiftsHTML = shifts.map(shift => {
      const pills = (shift.slots ?? []).map(slot => {
        const pct    = slot.availablePct ?? 100;
        const status = slotStatus(pct);
        const label  = status === "full" ? "Full" : status === "hot" ? "Filling fast" : `${Math.round(slot.maxCovers * pct / 100)} left`;
        return `<span class="ssr-pill ssr-${status}" data-time="${slot.time}" data-date="${day.date}" data-pct="${pct}">${fmtTime(slot.time)} — ${label}</span>`;
      }).join(" ");
      return `<div class="ssr-shift"><span class="ssr-shift-name">${shift.name}</span>${pills}</div>`;
    }).join("");
    return `<div class="ssr-day${day.date === todayStr ? " ssr-today" : ""}"><div class="ssr-day-name">${fmtDateLong(day.date)}${day.date === todayStr ? " (Today)" : ""}</div>${shiftsHTML}</div>`;
  }).join("\n");

  // ── Build date buttons for interactive JS layer ────────────────────────
  const dateBtnsHTML = weekDates.map((d, i) =>
    `<button class="date-btn${i === 0 ? " active" : ""}" data-idx="${i}">${fmtDateShort(d.date)}${d.date === todayStr ? " · Today" : ""}</button>`
  ).join("\n    ");

  // ── Serialise slot data for JS ─────────────────────────────────────────
  const jsData = JSON.stringify(weekDates);

  // ── Updated badge text ─────────────────────────────────────────────────
  const updatedBadge = isDemo
    ? "Demo data"
    : "Updated " + new Date(updatedAt).toLocaleTimeString("en-AU", { hour:"2-digit", minute:"2-digit" });

  // ── Full HTML page ─────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Medusa Osteria Romana · Book a Table · GetFork</title>
<meta name="description" content="Medusa Osteria Romana accepts reservations via GetFork. Live table availability in Fortitude Valley, Brisbane. Book instantly — no phone call required.">

<!--
  ============================================================
  GETFORK AI · GEO-OPTIMISED RESTAURANT PAGE · SSR
  Live availability endpoint (updates every 60 seconds):
  ${API}
  Booking: ${BOOK}
  Slots below are server-rendered at request time — always current.
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
  "amenityFeature": [
    { "@type": "LocationFeatureSpecification", "name": "Wheelchair Accessible", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Outdoor Seating", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Private Dining Room", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "Vegetarian Options", "value": true }
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
  --bg:#F5F5F4;--white:#FFFFFF;--border:#E7E5E1;--border-md:#D4D1CB;
  --ink:#1C1917;--body:#44403C;--muted:#78716C;--hint:#A8A29E;
  --green:#1D9E75;--green-bg:#EAF3DE;--green-txt:#27500A;
  --amber:#BA7517;--amber-bg:#FAEEDA;--amber-txt:#633806;
  --blue:#185FA5;--blue-bg:#E6F1FB;--blue-txt:#0C447C;
  --gray-bg:#F1EFE8;--gray-txt:#5F5E5A;
  --r-sm:6px;--r-md:10px;--r-lg:14px;
}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--body);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.page{max-width:680px;margin:0 auto;padding:16px 16px 60px}

/* Header */
.site-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--white);border:0.5px solid var(--border);border-radius:var(--r-lg);margin-bottom:14px}
.brand{font-size:13px;font-weight:600;color:var(--ink);letter-spacing:-0.01em}
.brand span{color:var(--green)}
.header-badge{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:5px}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;flex-shrink:0}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}

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
.answer-block{background:#F8FAFB;border-left:2px solid var(--blue);border-radius:0 var(--r-sm) var(--r-sm) 0;padding:10px 14px;margin-bottom:14px}
.answer-block p{font-size:13px;color:var(--body);line-height:1.6}
.answer-block strong{color:var(--ink);font-weight:500}
.meta-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.meta{background:var(--bg);border-radius:var(--r-md);padding:10px 12px;border:0.5px solid var(--border)}
.meta-v{font-size:17px;font-weight:600;color:var(--ink);letter-spacing:-0.02em}
.meta-l{font-size:11px;color:var(--hint);margin-top:1px}

/* Section */
.section-title{font-size:15px;font-weight:600;color:var(--ink);margin-bottom:3px;letter-spacing:-0.01em}
.section-sub{font-size:12px;color:var(--hint);margin-bottom:14px}

/* Date tabs */
.date-row{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.date-btn{font-size:12px;font-weight:500;padding:6px 12px;border-radius:var(--r-md);border:0.5px solid var(--border);background:var(--white);color:var(--muted);cursor:pointer;transition:all 0.12s;font-family:inherit}
.date-btn.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.date-btn:hover:not(.active){background:var(--bg);border-color:var(--border-md);color:var(--ink)}

/* Party */
.party-row{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.party-label{font-size:13px;color:var(--muted);min-width:64px}
.party-btn{width:30px;height:30px;border-radius:50%;border:0.5px solid var(--border-md);background:var(--white);color:var(--ink);font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;transition:background 0.1s}
.party-btn:hover{background:var(--bg)}
.party-count{font-size:16px;font-weight:600;color:var(--ink);min-width:24px;text-align:center}

/* Freshness */
.freshness{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--hint);margin-bottom:14px}

/* Legend */
.avail-legend{display:flex;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--hint)}
.legend-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}

/* Slots grid */
.slots-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px}
.shift-label{grid-column:1/-1;font-size:11px;font-weight:500;color:var(--hint);text-transform:uppercase;letter-spacing:0.06em;padding:2px 0 4px}
.slot{border:0.5px solid var(--border);border-radius:var(--r-md);padding:10px 8px;text-align:center;cursor:pointer;transition:all 0.12s;background:var(--white)}
.slot:hover:not(.slot-full):not(.slot-selected){background:var(--bg);border-color:var(--border-md)}
.slot-time{font-size:13px;font-weight:600;color:var(--ink);display:block;margin-bottom:4px;letter-spacing:-0.01em}
.slot-bar{height:3px;border-radius:2px;margin:4px 0}
.slot-tag{font-size:10px;font-weight:500;padding:2px 5px;border-radius:3px;display:inline-block}
.slot-full{opacity:0.38;cursor:not-allowed}
.slot-full .slot-time{color:var(--hint)}
.slot-hot{border-color:#F0B429}
.slot-selected{border:1.5px solid var(--blue);background:var(--blue-bg)}
.slot-selected .slot-time{color:var(--blue-txt)}

/* Booking panel */
.booking-panel{border:0.5px solid var(--border);border-radius:var(--r-md);padding:1rem;background:var(--bg);margin-top:4px}
.booking-panel-title{font-size:13px;font-weight:600;color:var(--ink);margin-bottom:10px}
.booking-detail{font-size:13px;color:var(--muted);margin-bottom:5px;line-height:1.5}
.booking-detail strong{color:var(--ink);font-weight:500}
.confirm-btn{width:100%;margin-top:12px;padding:11px;font-size:14px;font-weight:500;border-radius:var(--r-md);border:none;background:var(--ink);color:#fff;cursor:pointer;transition:opacity 0.12s;font-family:inherit;letter-spacing:-0.01em}
.confirm-btn:hover{opacity:0.82}

/* About */
.geo-block{border-left:2px solid var(--border);padding-left:12px;margin-bottom:12px}
.geo-title{font-size:13px;font-weight:500;color:var(--ink);margin-bottom:3px}
.geo-body{font-size:13px;color:var(--muted);line-height:1.6}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.info-cell{font-size:13px;color:var(--muted);line-height:1.5}
.info-cell strong{color:var(--ink);font-weight:500;display:block;margin-bottom:1px}

/* SSR availability (AI-readable, hidden for humans) */
.ssr-avail{position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;font-size:1px;color:transparent}

/* Schema / machine-readable card */
.schema-label{font-size:12px;color:var(--hint);font-weight:500;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.schema-label::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--hint)}
.schema-note{background:var(--bg);border-radius:var(--r-md);padding:12px 14px;font-size:11px;color:var(--hint);font-family:'SF Mono','Fira Mono',monospace;line-height:1.7;border:0.5px solid var(--border);word-break:break-all}

/* Footer */
.site-footer{text-align:center;font-size:11px;color:var(--hint);margin-top:24px;padding-top:16px;border-top:0.5px solid var(--border)}
.site-footer a{color:var(--green);text-decoration:none}

@media(max-width:480px){
  .slots-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .info-grid{grid-template-columns:1fr}
  .meta-row{grid-template-columns:repeat(3,minmax(0,1fr))}
}
</style>
</head>
<body>

<!-- ══ SSR AVAILABILITY — AI/crawler readable, visually hidden ══ -->
<div class="ssr-avail" aria-hidden="true">
  <h2>Medusa Osteria Romana — Live Table Availability This Week</h2>
  <p>Source: ${API} | Rendered: ${new Date().toISOString()}${isDemo ? " | Note: demo data — live API offline" : ""}</p>
  ${ssrAvailHTML}
</div>

<div class="page">

  <!-- Header -->
  <div class="site-header">
    <div class="brand">Get<span>Fork</span></div>
    <div class="header-badge"><div class="live-dot"></div>Live availability</div>
  </div>

  <!-- Hero -->
  <div class="card">
    <div class="restaurant-name">Medusa Osteria Romana</div>
    <div class="restaurant-sub">Italian · Fortitude Valley, Brisbane · Powered by GetFork</div>
    <div class="badge-row">
      <span class="badge badge-g">Bookings open</span>
      <span class="badge badge-b">Live availability</span>
      <span class="badge badge-a">${updatedBadge}</span>
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

  <!-- Reservation -->
  <div class="card">
    <div class="section-title">Reserve a table</div>
    <div class="section-sub">Select a date, party size, and time — all slots are live</div>

    <div class="date-row" id="date-row">
      ${dateBtnsHTML}
    </div>

    <div class="party-row">
      <span class="party-label">Party size</span>
      <button class="party-btn" id="dec">−</button>
      <span class="party-count" id="count">2</span>
      <button class="party-btn" id="inc">+</button>
      <span style="font-size:12px;color:var(--hint);margin-left:4px">guests</span>
    </div>

    <div class="freshness">
      <div class="live-dot"></div>
      <span id="freshness-text">Live availability · ${isDemo ? "demo data — live API offline" : "updated " + new Date(updatedAt).toLocaleTimeString("en-AU", { hour:"2-digit", minute:"2-digit" })}</span>
    </div>

    <div class="avail-legend">
      <div class="legend-item"><div class="legend-dot" style="background:#1D9E75"></div>Available</div>
      <div class="legend-item"><div class="legend-dot" style="background:#BA7517"></div>Filling fast</div>
      <div class="legend-item"><div class="legend-dot" style="background:#888780"></div>Full</div>
      <div class="legend-item"><div class="legend-dot" style="background:#185FA5"></div>Selected</div>
    </div>

    <div class="slots-grid" id="slots-grid"></div>

    <div class="booking-panel" id="booking-panel" style="display:none">
      <div class="booking-panel-title">Confirm your booking</div>
      <div class="booking-detail"><strong>Restaurant:</strong> Medusa Osteria Romana, Fortitude Valley</div>
      <div class="booking-detail" id="bp-date"><strong>Date:</strong> —</div>
      <div class="booking-detail" id="bp-time"><strong>Time:</strong> —</div>
      <div class="booking-detail" id="bp-party"><strong>Party:</strong> 2 guests</div>
      <div class="booking-detail"><strong>Avg dining time:</strong> 90 minutes</div>
      <div class="booking-detail"><strong>Deposit:</strong> None required (parties under 6)</div>
      <button class="confirm-btn" id="confirm-btn">Confirm reservation →</button>
    </div>
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
    <div class="schema-note">GET ${API}<br><br>→ Returns: dates[], shifts[], slots[], availablePct, maxCovers, last_updated<br>→ schema.org/FoodEstablishmentReservation compatible</div>
  </div>

  <div class="site-footer">
    Medusa Osteria Romana · 14 Via Roma Lane, Fortitude Valley QLD 4006 ·
    <a href="tel:+61731930200">07 3193 0200</a> ·
    Availability powered by <a href="https://getfork.ai" target="_blank">GetFork Voice AI</a>
  </div>

</div>

<script>
const DATA  = ${jsData};
const BOOK  = "${BOOK}";
let activeIdx = 0;
let party     = 2;
let selected  = null; // "shiftName_slotIdx"

function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  return (h % 12 || 12) + ":" + String(m).padStart(2,"0") + " " + (h >= 12 ? "PM" : "AM");
}
function fmtDateLong(ds) {
  const d = new Date(ds + "T12:00:00");
  return d.toLocaleDateString("en-AU", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

function slotStatusForParty(pct) {
  const needed = party * 12.5;
  if (pct < needed || pct === 0) return "full";
  if (pct < 35) return "hot";
  return "available";
}

function renderSlots() {
  const grid    = document.getElementById("slots-grid");
  const dateObj = DATA[activeIdx];
  grid.innerHTML = "";

  if (!dateObj || dateObj.closed) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;font-size:13px;color:var(--hint)">Closed this day</div>';
    return;
  }

  (dateObj.shifts ?? []).forEach(shift => {
    const lbl = document.createElement("div");
    lbl.className = "shift-label";
    lbl.textContent = shift.name;
    grid.appendChild(lbl);

    (shift.slots ?? []).forEach((slot, i) => {
      const pct    = slot.availablePct ?? 100;
      const status = slotStatusForParty(pct);
      const key    = shift.name + "_" + i;
      const isSel  = selected === key;

      const el = document.createElement("div");
      el.className = "slot"
        + (status === "full" ? " slot-full" : "")
        + (status === "hot" && !isSel ? " slot-hot" : "")
        + (isSel ? " slot-selected" : "");

      let barColor = "#1D9E75", tagHtml = "";
      const spotsLeft = Math.max(0, Math.round(slot.maxCovers * pct / 100));

      if (status === "full") {
        barColor = "#888780";
        tagHtml  = '<span class="slot-tag" style="background:#F1EFE8;color:#5F5E5A">Full</span>';
      } else if (status === "hot") {
        barColor = "#BA7517";
        tagHtml  = '<span class="slot-tag" style="background:#FAEEDA;color:#633806">Filling fast</span>';
      } else {
        tagHtml  = '<span class="slot-tag" style="background:#EAF3DE;color:#27500A">' + spotsLeft + ' left</span>';
      }
      if (isSel) {
        barColor = "#185FA5";
        tagHtml  = '<span class="slot-tag" style="background:#E6F1FB;color:#0C447C">Selected</span>';
      }

      el.innerHTML = '<span class="slot-time">' + fmtTime(slot.time) + '</span>'
        + '<div class="slot-bar" style="background:' + barColor + '"></div>'
        + tagHtml;

      if (status !== "full") {
        el.onclick = () => {
          selected = isSel ? null : key;
          renderSlots();
          renderPanel(isSel ? null : slot);
        };
      }
      grid.appendChild(el);
    });
  });
}

function renderPanel(slot) {
  const panel = document.getElementById("booking-panel");
  if (!slot) { panel.style.display = "none"; return; }
  panel.style.display = "block";
  const dateObj = DATA[activeIdx];
  document.getElementById("bp-date").innerHTML  = "<strong>Date:</strong> " + fmtDateLong(dateObj.date);
  document.getElementById("bp-time").innerHTML  = "<strong>Time:</strong> " + fmtTime(slot.time);
  document.getElementById("bp-party").innerHTML = "<strong>Party:</strong> " + party + " guest" + (party > 1 ? "s" : "");
  document.getElementById("confirm-btn").onclick = () => {
    window.open(BOOK + "?date=" + dateObj.date + "&time=" + slot.time + "&party=" + party, "_blank");
  };
}

// Date tabs
document.getElementById("date-row").querySelectorAll(".date-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeIdx = parseInt(btn.dataset.idx);
    selected  = null;
    renderSlots();
    renderPanel(null);
  };
});

// Party controls
document.getElementById("inc").onclick = () => {
  if (party < 8) { party++; document.getElementById("count").textContent = party; selected = null; renderSlots(); renderPanel(null); }
};
document.getElementById("dec").onclick = () => {
  if (party > 1) { party--; document.getElementById("count").textContent = party; selected = null; renderSlots(); renderPanel(null); }
};

// Boot
renderSlots();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type":  "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
      "X-Rendered-By": "GetFork-SSR",
      "X-Availability": isDemo ? "demo" : "live"
    }
  });
};

export const config = { path: "/" };
