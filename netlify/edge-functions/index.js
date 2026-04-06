// netlify/edge-functions/index.js
// GetFork · Pure SSR · Zero client JavaScript
// Date filter: ?date=YYYY-MM-DD
// Booking form: ?book=true&date=YYYY-MM-DD&time=HH:MM&party=N
// All state via URL params — no JS, no modals, pure server-rendered HTML

export default async (request, context) => {
  const SLUG = "medusa-italian-osteria-romana";
  const API  = `https://mcp.getfork.ai/api/availability/${SLUG}.json`;

  // ── Read URL params ────────────────────────────────────────────────────
  const url          = new URL(request.url);
  const todayStr     = new Date().toISOString().slice(0, 10);
  const selectedDate = url.searchParams.get("date") ?? todayStr;
  const isBooking    = url.searchParams.get("book") === "true";
  const bookTime     = url.searchParams.get("time") ?? "";
  const bookParty    = parseInt(url.searchParams.get("party") ?? "2", 10);
  const bookDate     = url.searchParams.get("date") ?? todayStr;
  const confirmed    = url.searchParams.get("confirmed") === "true";

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
        const shiftMap = {};
        for (const slot of (d.slots ?? [])) {
          const sName = slot.shift ?? "Available";
          if (!shiftMap[sName]) shiftMap[sName] = [];
          shiftMap[sName].push({ time: slot.time, maxCovers: slot.maxCovers ?? 10 });
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
    return new Date(ds + "T12:00:00").toLocaleDateString("en-AU", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
  function fmtDateShort(ds) {
    return new Date(ds + "T12:00:00").toLocaleDateString("en-AU", {
      weekday: "short", day: "numeric", month: "short"
    });
  }
  function fmtTime(t) {
    const [h, m] = t.split(":").map(Number);
    return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM");
  }

  // ── Mock fallback ──────────────────────────────────────────────────────
  function buildMockWeek() {
    const out = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const dt = new Date(base);
      dt.setDate(base.getDate() + i);
      const dow = dt.getDay();
      const dateStr = dt.toISOString().slice(0, 10);
      const shifts = [];
      if (dow === 0 || dow === 5 || dow === 6) {
        shifts.push({ name: "Lunch", slots: ["12:00","12:30","13:00","13:30","14:00","14:30"].map(t => ({ time: t, maxCovers: 10 })) });
      }
      shifts.push({ name: "Dinner", slots: ["17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30"].map(t => ({ time: t, maxCovers: 20 })) });
      out.push({ date: dateStr, dayName: dt.toLocaleDateString("en-AU", { weekday: "long" }), closed: false, shifts });
    }
    return out;
  }

  const updatedText  = isDemo ? "Demo data" : "Updated " + new Date(updatedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  const activeDay    = weekDates.find(d => d.date === selectedDate) ?? weekDates[0];

  // ── SSR: date tabs ─────────────────────────────────────────────────────
  const tabsHTML = weekDates.map(d => {
    const isActive = d.date === (activeDay?.date ?? "");
    const isToday  = d.date === todayStr;
    const dt       = new Date(d.date + "T12:00:00");
    const dayLabel = isToday ? "Today" : dt.toLocaleDateString("en-AU", { weekday: "short" });
    const dateLabel = dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const slotCount = d.shifts.reduce((n, s) => n + s.slots.length, 0);
    return `
      <a class="date-tab${isActive ? " active" : ""}${d.closed ? " tab-closed" : ""}"
         href="?date=${d.date}">
        <span class="tab-day">${dayLabel}</span>
        <span class="tab-date">${dateLabel}</span>
        ${d.closed
          ? `<span class="tab-pill closed">Closed</span>`
          : `<span class="tab-pill open">${slotCount} slots</span>`}
      </a>`;
  }).join("\n");

  // ── SSR: slot grid ─────────────────────────────────────────────────────
  function renderSlots(day) {
    if (!day || day.closed) return `<div class="closed-msg">Closed — no availability this day</div>`;
    return day.shifts.map(shift => `
      <div class="shift-block">
        <div class="shift-label">${shift.name}</div>
        <div class="slots-grid">
          ${shift.slots.map(slot => `
            <a class="slot"
               href="?date=${day.date}&time=${slot.time}&party=2&book=true"
               aria-label="Book ${fmtTime(slot.time)} on ${fmtDateLong(day.date)}">
              <span class="slot-time">${fmtTime(slot.time)}</span>
              <div class="slot-bar"></div>
              <span class="slot-tag">${slot.maxCovers ? slot.maxCovers + " seats" : "Available"}</span>
            </a>`).join("")}
        </div>
      </div>`).join("");
  }

  // ── SSR: booking form (shown when ?book=true) ──────────────────────────
  function renderBookingForm() {
    const dateDisplay = fmtDateLong(bookDate);
    const timeDisplay = bookTime ? fmtTime(bookTime) : "";

    return `
    <div class="booking-form-wrap">
      <a class="back-link" href="?date=${bookDate}">← Back to availability</a>

      <div class="booking-summary">
        <div class="booking-summary-row">
          <span class="bs-label">Restaurant</span>
          <span class="bs-val">Medusa Osteria Romana</span>
        </div>
        <div class="booking-summary-row">
          <span class="bs-label">Date</span>
          <span class="bs-val">${dateDisplay}</span>
        </div>
        <div class="booking-summary-row">
          <span class="bs-label">Time</span>
          <span class="bs-val highlight">${timeDisplay}</span>
        </div>
        <div class="booking-summary-row">
          <span class="bs-label">Party size</span>
          <span class="bs-val">${bookParty} guests</span>
        </div>
        <div class="booking-summary-row">
          <span class="bs-label">Deposit</span>
          <span class="bs-val">None required</span>
        </div>
      </div>

      <form class="booking-form" method="POST" action="/api/book">
        <input type="hidden" name="date"  value="${bookDate}">
        <input type="hidden" name="time"  value="${bookTime}">
        <input type="hidden" name="party" value="${bookParty}">
        <input type="hidden" name="slug"  value="${SLUG}">

        <div class="form-row">
          <label class="form-label" for="name">Full name</label>
          <input class="form-input" type="text" id="name" name="name"
                 placeholder="Your full name" required autocomplete="name">
        </div>

        <div class="form-row">
          <label class="form-label" for="email">Email address</label>
          <input class="form-input" type="email" id="email" name="email"
                 placeholder="your@email.com" required autocomplete="email">
        </div>

        <div class="form-row">
          <label class="form-label" for="phone">Phone number</label>
          <input class="form-input" type="tel" id="phone" name="phone"
                 placeholder="+61 4XX XXX XXX" required autocomplete="tel">
        </div>

        <div class="form-row">
          <label class="form-label" for="party-select">Party size</label>
          <select class="form-input" id="party-select" name="party_display">
            ${[1,2,3,4,5,6,7,8].map(n =>
              `<option value="${n}"${n === bookParty ? " selected" : ""}>${n} guest${n > 1 ? "s" : ""}</option>`
            ).join("")}
          </select>
        </div>

        <div class="form-row">
          <label class="form-label" for="notes">Special requests <span class="optional">(optional)</span></label>
          <textarea class="form-input form-textarea" id="notes" name="notes"
                    placeholder="Dietary requirements, occasion, seating preferences…" rows="3"></textarea>
        </div>

        <button class="confirm-btn" type="submit">
          Confirm reservation — ${timeDisplay}, ${dateDisplay}
        </button>

        <p class="form-note">
          Table held for 15 minutes past booking time.
          You'll receive a confirmation email immediately.
        </p>
      </form>
    </div>`;
  }

  // ── SSR: confirmation screen (shown after successful POST redirect) ────
  function renderConfirmation() {
    return `
    <div class="confirm-screen">
      <div class="confirm-icon">✓</div>
      <div class="confirm-title">Booking confirmed</div>
      <div class="confirm-sub">A confirmation has been sent to your email.</div>
      <div class="booking-summary" style="margin-top:20px">
        <div class="booking-summary-row">
          <span class="bs-label">Restaurant</span>
          <span class="bs-val">Medusa Osteria Romana</span>
        </div>
        <div class="booking-summary-row">
          <span class="bs-label">Date</span>
          <span class="bs-val">${fmtDateLong(bookDate)}</span>
        </div>
        <div class="booking-summary-row">
          <span class="bs-label">Time</span>
          <span class="bs-val highlight">${bookTime ? fmtTime(bookTime) : ""}</span>
        </div>
        <div class="booking-summary-row">
          <span class="bs-label">Party</span>
          <span class="bs-val">${bookParty} guests</span>
        </div>
      </div>
      <a class="back-link" href="/" style="display:inline-block;margin-top:20px">← Back to availability</a>
    </div>`;
  }

  // ── HTML ───────────────────────────────────────────────────────────────
  const pageTitle = isBooking
    ? `Book ${bookTime ? fmtTime(bookTime) : ""} · Medusa Osteria Romana`
    : "Medusa Osteria Romana · Book a Table · GetFork";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<meta name="description" content="Medusa Osteria Romana accepts reservations via GetFork. Live table availability in Fortitude Valley, Brisbane. Book instantly — no phone call required.">

<!--
  ============================================================
  GETFORK AI · PURE SSR · ZERO CLIENT JAVASCRIPT
  Availability: ${API}
  Date filter:  /?date=YYYY-MM-DD
  Booking form: /?book=true&date=YYYY-MM-DD&time=HH:MM&party=N
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
  "telephone": "+61731930200",
  "potentialAction": {
    "@type": "ReserveAction",
    "target": "${url.origin}/?book=true",
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

.section-title{font-size:15px;font-weight:600;color:var(--ink);margin-bottom:3px;letter-spacing:-0.01em}
.section-sub{font-size:12px;color:var(--hint);margin-bottom:14px}
.freshness{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--hint);margin-bottom:16px}

/* Date tabs */
.date-tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:20px;padding-bottom:2px;scrollbar-width:none}
.date-tabs::-webkit-scrollbar{display:none}
.date-tab{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 14px;border-radius:var(--r-md);border:0.5px solid var(--border);background:var(--white);flex-shrink:0;min-width:72px}
.date-tab:hover:not(.active):not(.tab-closed){background:var(--bg);border-color:var(--border-md)}
.date-tab.active{background:var(--ink);border-color:var(--ink)}
.date-tab.tab-closed{opacity:0.45}
.tab-day{font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em}
.tab-date{font-size:14px;font-weight:600;color:var(--ink);letter-spacing:-0.01em}
.tab-pill{font-size:10px;font-weight:500;padding:2px 6px;border-radius:3px;margin-top:2px}
.tab-pill.open{background:var(--green-bg);color:var(--green-txt)}
.tab-pill.closed{background:#F1EFE8;color:#5F5E5A}
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

/* ── BOOKING FORM ── */
.booking-form-wrap{padding:4px 0}
.back-link{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--muted);margin-bottom:20px}
.back-link:hover{color:var(--ink)}

.booking-summary{background:var(--bg);border:0.5px solid var(--border);border-radius:var(--r-md);padding:14px 16px;margin-bottom:20px}
.booking-summary-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid var(--border);font-size:13px}
.booking-summary-row:last-child{border-bottom:none}
.bs-label{color:var(--muted)}
.bs-val{font-weight:500;color:var(--ink)}
.bs-val.highlight{color:var(--green);font-weight:600}

.booking-form{display:flex;flex-direction:column;gap:14px}
.form-row{display:flex;flex-direction:column;gap:5px}
.form-label{font-size:12px;font-weight:500;color:var(--ink)}
.optional{font-weight:400;color:var(--hint)}
.form-input{width:100%;padding:10px 12px;border:0.5px solid var(--border-md);border-radius:var(--r-md);font-size:14px;font-family:inherit;color:var(--ink);background:var(--white);outline:none}
.form-input:focus{border-color:var(--ink)}
.form-textarea{resize:vertical;min-height:80px}
select.form-input{cursor:pointer}

.confirm-btn{width:100%;padding:13px;background:var(--ink);color:#fff;border:none;border-radius:var(--r-md);font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;letter-spacing:-0.01em;margin-top:4px}
.confirm-btn:hover{opacity:0.85}
.form-note{font-size:11px;color:var(--hint);text-align:center;line-height:1.6;margin-top:2px}

/* ── CONFIRMATION SCREEN ── */
.confirm-screen{text-align:center;padding:32px 16px}
.confirm-icon{width:56px;height:56px;border-radius:50%;background:var(--green-bg);color:var(--green);font-size:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-weight:600}
.confirm-title{font-size:20px;font-weight:600;color:var(--ink);margin-bottom:6px;letter-spacing:-0.02em}
.confirm-sub{font-size:13px;color:var(--muted)}

/* About */
.geo-block{border-left:2px solid var(--border);padding-left:12px;margin-bottom:12px}
.geo-title{font-size:13px;font-weight:500;color:var(--ink);margin-bottom:3px}
.geo-body{font-size:13px;color:var(--muted);line-height:1.6}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.info-cell{font-size:13px;color:var(--muted);line-height:1.5}
.info-cell strong{color:var(--ink);font-weight:500;display:block;margin-bottom:1px}

.schema-label{font-size:12px;color:var(--hint);font-weight:500;margin-bottom:6px}
.schema-note{background:var(--bg);border-radius:var(--r-md);padding:12px 14px;font-size:11px;color:var(--hint);font-family:'SF Mono','Fira Mono',monospace;line-height:1.7;border:0.5px solid var(--border);word-break:break-all}
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

  <div class="site-header">
    <div class="brand">Get<span>Fork</span></div>
    <div class="header-right">
      <span class="live-dot"></span>
      Live · ${updatedText}
    </div>
  </div>

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

  <div class="card">
    ${isBooking ? `
      <div class="section-title">Complete your booking</div>
      <div class="section-sub">Fill in your details to confirm the reservation</div>
      ${confirmed ? renderConfirmation() : renderBookingForm()}
    ` : `
      <div class="section-title">Live table availability</div>
      <div class="section-sub">Select a date then tap a time to book</div>
      <div class="freshness">
        <span class="live-dot"></span>
        ${isDemo ? "Demo data — live API offline" : `Fetched live from GetFork MCP · ${updatedText}`}
      </div>
      <div class="date-tabs">${tabsHTML}</div>
      <div class="active-day-header">
        <span class="active-day-name">${activeDay ? fmtDateLong(activeDay.date) + (activeDay.date === todayStr ? " — Today" : "") : "Select a date"}</span>
        ${activeDay && !activeDay.closed
          ? `<span class="active-day-badge">${activeDay.shifts.reduce((n,s) => n + s.slots.length, 0)} slots available</span>`
          : `<span class="active-day-badge closed">Closed</span>`}
      </div>
      ${renderSlots(activeDay)}
    `}
  </div>

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

  <div class="card">
    <div class="schema-label">Machine-readable availability — GetFork AI endpoint</div>
    <div class="schema-note">GET ${API}<br><br>→ availability[], slots[], shift, maxCovers, generatedAt, ttl:60<br>→ Booking form: ${url.origin}/?book=true&amp;date=YYYY-MM-DD&amp;time=HH:MM&amp;party=N<br>→ schema.org/FoodEstablishmentReservation compatible</div>
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
      "Cache-Control": isBooking ? "no-store" : "public, max-age=60, stale-while-revalidate=30",
      "X-Rendered-By": "GetFork-SSR",
      "X-JS":          "none"
    }
  });
};

export const config = { path: "/" };
