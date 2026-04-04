export default async (request, context) => {
  const SLUG = "medusa-italian-osteria-romana";
  const API  = `https://mcp.getfork.ai/api/availability/${SLUG}.json`;
  const BOOK = `https://mcp.getfork.ai/book/${SLUG}`;

  let weekSlots = [];
  let fetchError = "";

  try {
    const res  = await fetch(API, { headers: { "User-Agent": "GetFork-SSR/1.0" } });
    const json = await res.json();
    const today   = new Date();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 6);
    const todayStr   = today.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    weekSlots = (json.availability ?? []).filter(d => d.date >= todayStr && d.date <= weekEndStr);
  } catch (e) {
    fetchError = String(e);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // SSR plain HTML slots — for AI crawlers
  const ssrSlots = weekSlots.map(day => {
    const isToday = day.date === todayStr;
    const byShift = {};
    for (const s of day.slots) {
      const shift = s.shift || "Available";
      if (!byShift[shift]) byShift[shift] = [];
      byShift[shift].push(s.time);
    }
    const shiftsHTML = Object.entries(byShift).map(([shift, times]) =>
      `<div class="s-shift"><span class="s-shift-name">${shift}</span><div class="s-pills">${times.map(t => `<span class="s-pill" data-time="${t}" data-day="${day.dayName}" data-date="${day.date}">${t}</span>`).join("")}</div></div>`
    ).join("");
    return `<div class="s-day${isToday ? " s-today" : ""}" data-date="${day.date}" aria-label="${day.dayName} ${day.date}">
      <div class="s-day-header" onclick="toggleDay(this)">
        <span class="s-day-name">${day.dayName}${isToday ? ' <em class="s-today-badge">Today</em>' : ""}</span>
        <span class="s-day-meta"><span class="s-slot-count">${day.slots.length} slots</span><span class="s-chevron">▾</span></span>
      </div>
      <div class="s-slots-body">${shiftsHTML}</div>
    </div>`;
  }).join("");

  // JS data for interactive UI
  const jsData = JSON.stringify(weekSlots.map(d => ({
    date: d.date,
    dayName: d.dayName,
    isToday: d.date === todayStr,
    shifts: d.slots.reduce((acc, s) => {
      const k = s.shift || "Available";
      if (!acc[k]) acc[k] = [];
      acc[k].push(s.time);
      return acc;
    }, {})
  })));

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
    "openingHours": ["Mo-Th 17:00-22:00","Fr 12:00-23:00","Sa 12:00-23:00","Su 12:00-21:00"]
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Medusa Osteria Romana — Reservations</title>
<meta name="description" content="Book a table at Medusa Osteria Romana, Fortitude Valley Brisbane. Live availability, instant confirmation."/>
<meta name="robots" content="index,follow"/>
<script type="application/ld+json">${jsonLD}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0b0906;--bg2:#130f0b;--surface:#1c1711;--border:#2d2620;
  --gold:#c8a96e;--gold-dim:#8a6f3f;--cream:#f0e8d8;--muted:#6b6055;
  --text:#e8ddd0;--green:#4caf7a;--red:#c97c7c;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'Montserrat',sans-serif;font-weight:300;line-height:1.7;min-height:100vh}

/* HERO */
.hero{text-align:center;padding:3rem 2rem 2rem;border-bottom:1px solid var(--border);background:radial-gradient(ellipse 80% 50% at 50% 0%,#2a1a0a33 0%,transparent 70%)}
.snake{font-size:2.5rem;display:block;margin-bottom:1rem;animation:float 4s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
h1{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,6vw,3.5rem);font-weight:300;color:var(--cream);line-height:1.05;margin-bottom:.4rem}
h1 em{font-style:italic;color:var(--gold)}
.hero-sub{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:1.5rem}
.badges{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;margin-bottom:2rem}
.badge{border:1px solid var(--gold-dim);color:var(--gold);font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;padding:.3rem .8rem;border-radius:2px}
.ssr-tag{display:inline-flex;align-items:center;gap:.35rem;background:#0f1f0f;border:1px solid #2a4a2a;color:var(--green);font-size:.65rem;letter-spacing:.08em;padding:.25rem .6rem;border-radius:2px}

/* TABS */
.tabs{display:flex;border-bottom:1px solid var(--border);background:var(--bg2)}
.tab{flex:1;padding:.9rem;font-family:'Montserrat',sans-serif;font-size:.72rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;background:transparent;border:none;cursor:pointer;color:var(--muted);border-bottom:2px solid transparent;transition:all .15s}
.tab.active{color:var(--gold);border-bottom:2px solid var(--gold)}

/* PANELS */
.panel{display:none;padding:2rem;max-width:740px;margin:0 auto}
.panel.active{display:block}

/* SSR AVAILABILITY — AI reads this */
.s-week-label{font-size:.65rem;letter-spacing:.25em;text-transform:uppercase;color:var(--muted);margin-bottom:1.25rem}
.s-day{border:1px solid var(--border);border-radius:6px;margin-bottom:.75rem;overflow:hidden}
.s-day.s-today{border-color:var(--gold-dim)}
.s-day-header{display:flex;justify-content:space-between;align-items:center;padding:.85rem 1.1rem;background:var(--surface);cursor:pointer;user-select:none}
.s-day-name{font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:var(--gold)}
.s-today-badge{font-family:'Montserrat',sans-serif;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;background:var(--gold-dim);color:var(--bg);padding:.15rem .5rem;border-radius:2px;margin-left:.5rem;font-style:normal}
.s-day-meta{display:flex;align-items:center;gap:.75rem}
.s-slot-count{font-size:.7rem;color:var(--muted)}
.s-chevron{font-size:.75rem;color:var(--muted);transition:transform .2s}
.s-day.open .s-chevron{transform:rotate(180deg)}
.s-slots-body{display:none;padding:1rem 1.1rem;border-top:1px solid var(--border)}
.s-day.open .s-slots-body{display:block}
.s-shift{margin-bottom:.85rem}
.s-shift:last-child{margin-bottom:0}
.s-shift-name{display:block;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
.s-pills{display:flex;flex-wrap:wrap;gap:.4rem}
.s-pill{font-size:.78rem;font-family:'Montserrat',sans-serif;background:transparent;border:1px solid var(--border);color:var(--text);padding:.3rem .65rem;border-radius:3px;cursor:pointer;transition:all .15s}
.s-pill:hover{border-color:var(--gold-dim);color:var(--gold)}
.s-pill.selected{background:var(--gold);color:var(--bg);border-color:var(--gold)}

/* BOOKING BAR */
.booking-bar{position:sticky;bottom:0;background:var(--bg2);border-top:1px solid var(--border);padding:1rem 2rem;display:flex;gap:1rem;align-items:center;z-index:10}
.sel-info{flex:1}
.sel-time{font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:var(--gold)}
.sel-day{font-size:.7rem;color:var(--muted);margin-top:.1rem}
.book-btn{background:var(--gold);color:var(--bg);font-family:'Montserrat',sans-serif;font-size:.72rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;border:none;padding:.7rem 1.8rem;border-radius:2px;cursor:pointer;transition:opacity .15s}
.book-btn:disabled{opacity:.35;cursor:not-allowed}
.book-btn:not(:disabled):hover{opacity:.85}

/* CHAT */
.chat-wrap{display:flex;flex-direction:column;height:520px;border:1px solid var(--border);border-radius:6px;overflow:hidden}
.chat-msgs{flex:1;overflow-y:auto;padding:1.25rem;display:flex;flex-direction:column;gap:1rem;background:var(--bg)}
.msg{display:flex;gap:.75rem}
.msg.user{flex-direction:row-reverse}
.av{width:30px;height:30px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:500}
.av.bot{background:var(--surface);color:var(--gold);border:1px solid var(--gold-dim)}
.av.user{background:var(--gold);color:var(--bg)}
.bubble{max-width:75%;padding:.6rem .9rem;border-radius:4px;font-size:.82rem;line-height:1.6}
.msg.bot .bubble{background:var(--surface);border-radius:2px 6px 6px 6px}
.msg.user .bubble{background:var(--gold-dim);color:var(--cream);border-radius:6px 2px 6px 6px}
.qrs{display:flex;flex-wrap:wrap;gap:.5rem;padding:.75rem 1.25rem;background:var(--bg2);border-top:1px solid var(--border)}
.qr{font-size:.7rem;padding:.35rem .85rem;border:1px solid var(--gold-dim);color:var(--gold);background:transparent;border-radius:2px;cursor:pointer;transition:all .15s}
.qr:hover{background:var(--gold-dim);color:var(--bg)}
.chat-input-row{display:flex;gap:.75rem;padding:.85rem 1.25rem;background:var(--bg2);border-top:1px solid var(--border)}
.chat-input{flex:1;background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:'Montserrat',sans-serif;font-size:.82rem;padding:.55rem .85rem;border-radius:3px;outline:none}
.chat-input:focus{border-color:var(--gold-dim)}
.chat-send{background:var(--gold);color:var(--bg);border:none;font-family:'Montserrat',sans-serif;font-size:.72rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;padding:.55rem 1.2rem;border-radius:3px;cursor:pointer}
.typing{display:flex;gap:4px;align-items:center;padding:.5rem .9rem}
.dot{width:5px;height:5px;border-radius:50%;background:var(--muted);animation:blink 1.2s infinite}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.3}40%{opacity:1}}

/* FOOTER */
footer{text-align:center;padding:2.5rem 2rem;border-top:1px solid var(--border);margin-top:2rem}
.footer-name{font-family:'Cormorant Garamond',serif;font-size:1.2rem;color:var(--gold);margin-bottom:.4rem}
.footer-details{font-size:.72rem;color:var(--muted);line-height:2}
.footer-details a{color:var(--gold-dim);text-decoration:none}
.powered{font-size:.6rem;color:#2a2520;margin-top:1rem}
.powered a{color:#3a3530;text-decoration:none}

@media(max-width:500px){
  .panel{padding:1.25rem}
  .booking-bar{padding:.85rem 1.25rem}
}
</style>
</head>
<body>

<div class="hero">
  <span class="snake">🐍</span>
  <h1>Medusa<br/><em>Osteria Romana</em></h1>
  <p class="hero-sub">Fortitude Valley · Brisbane · Roman Italian</p>
  <div class="badges">
    <span class="badge">Roman Italian</span>
    <span class="badge">4.7 ★ · 312 reviews</span>
    <span class="badge">$$–$$$</span>
    <span class="badge">Dine In</span>
  </div>
  <span class="ssr-tag">✓ Live availability · server-rendered · AI-readable</span>
</div>

<div class="tabs">
  <button class="tab active" onclick="switchTab('avail')">Availability</button>
  <button class="tab" onclick="switchTab('chat')">Chat &amp; Book</button>
</div>

<!-- ══ AVAILABILITY — SSR baked for AI crawlers ══ -->
<div id="avail-panel" class="panel active">
  <p class="s-week-label">This week — live table availability</p>

  <!--
    ════════════════════════════════════════════
    GETFORK LIVE AVAILABILITY — SERVER RENDERED
    All slots below are pre-baked. No JavaScript
    required to read this content.
    ════════════════════════════════════════════
  -->
  ${ssrSlots || `<p style="color:var(--muted);font-size:.85rem">No availability data found.</p>`}

</div>

<!-- ══ CHAT ══ -->
<div id="chat-panel" class="panel">
  <div class="chat-wrap">
    <div class="chat-msgs" id="chat-msgs">
      <div class="msg bot">
        <div class="av bot">M</div>
        <div class="bubble">Ciao! I'm Medusa's booking assistant. I can check availability, answer questions, and help you reserve a table. What would you like?</div>
      </div>
    </div>
    <div class="qrs" id="qrs">
      <button class="qr" onclick="sendQuick('Are you free tonight?')">Free tonight?</button>
      <button class="qr" onclick="sendQuick('Table for 2 on Sunday')">Sunday table for 2</button>
      <button class="qr" onclick="sendQuick('What time is last seating?')">Last seating?</button>
      <button class="qr" onclick="sendQuick('Do you have outdoor seating?')">Outdoor seating?</button>
      <button class="qr" onclick="sendQuick('Do you cater for dietary requirements?')">Dietary options?</button>
    </div>
    <div class="chat-input-row">
      <input class="chat-input" id="chat-input" placeholder="Type anything…" onkeydown="if(event.key==='Enter')sendChat()"/>
      <button class="chat-send" onclick="sendChat()">Send</button>
    </div>
  </div>
</div>

<!-- BOOKING BAR -->
<div class="booking-bar">
  <div class="sel-info">
    <div class="sel-time" id="sel-time">No time selected</div>
    <div class="sel-day" id="sel-day">Tap a slot above to reserve</div>
  </div>
  <button class="book-btn" id="book-btn" disabled onclick="confirmBook()">Reserve →</button>
</div>

<footer>
  <div class="footer-name">Medusa Osteria Romana</div>
  <div class="footer-details">
    14 Via Roma Lane, Fortitude Valley QLD 4006<br/>
    <a href="tel:+61731930200">07 3193 0200</a> · Walk-ins welcome · Tables held 15 min
  </div>
  <p class="powered">Powered by <a href="https://getfork.ai">GetFork Voice AI</a></p>
</footer>

<script>
// Hydrate pills from SSR HTML — make them interactive
const DATA = ${jsData};
let sel = null;

// Open today by default
document.querySelectorAll('.s-day').forEach((el, i) => {
  if (i === 0) el.classList.add('open');
});

// Make pills clickable
document.querySelectorAll('.s-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.s-pill.selected').forEach(p => p.classList.remove('selected'));
    pill.classList.add('selected');
    sel = { time: pill.dataset.time, day: pill.dataset.day, date: pill.dataset.date };
    document.getElementById('sel-time').textContent = sel.time;
    document.getElementById('sel-day').textContent = sel.day + ' · ' + sel.date;
    document.getElementById('book-btn').disabled = false;
  });
});

function toggleDay(header) {
  header.closest('.s-day').classList.toggle('open');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', (i===0&&tab==='avail')||(i===1&&tab==='chat')));
  document.getElementById('avail-panel').classList.toggle('active', tab==='avail');
  document.getElementById('chat-panel').classList.toggle('active', tab==='chat');
}

function confirmBook() {
  if (!sel) return;
  switchTab('chat');
  setTimeout(() => {
    addUser('I\\'d like to book a table for ' + sel.time + ' on ' + sel.day);
    setTimeout(() => botSay('Perfect! A table for ' + sel.time + ' on ' + sel.day + ' — how many guests, and what name should I put the reservation under?'), 900);
  }, 200);
}

const KB = {
  'tonight':   () => 'Tonight we have dinner slots from 5:00pm to 9:30pm. Slots like 5:00, 5:30 and 6:00pm are still available. Shall I hold one?',
  'sunday':    () => 'Sunday we have lunch from 12:00–2:30pm and dinner from 5:30–9:30pm. Any preference?',
  'last seat': () => 'Last seating is 90 minutes before close — so tonight that\\'s 9:30pm.',
  'outdoor':   () => 'We have a lovely courtyard! Mention it when booking and we\\'ll do our best to seat you outside.',
  'parking':   () => 'Street parking on Via Roma Lane, and Brunswick St car park is a 2-minute walk.',
  'menu':      () => 'Roman Italian — handmade pasta, wood-fired proteins, Lazio wine list. Vegetarian, vegan and gluten-free options available.',
  'dietary':   () => 'Absolutely — we cater for vegetarian, vegan, gluten-free, halal and dairy-free. Just let us know when booking.',
  'private':   () => 'Yes! Private dining for groups of 10+. Call us on 07 3193 0200 to arrange.',
  'cancel':    () => 'To cancel or modify, call 07 3193 0200. Tables are held for 15 minutes past booking time.',
  'book':      () => 'Happy to help! What date and time, and how many guests?',
  'halal':     () => 'Yes, we have halal options. Just mention it when you book and our kitchen will take care of it.',
};

function getReply(msg) {
  const l = msg.toLowerCase();
  for (const [k,fn] of Object.entries(KB)) { if (l.includes(k)) return fn(); }
  if (l.match(/\\d{1,2}[:.]\\d{2}|dinner|lunch|table for|seat|reservation/)) {
    return 'Got it! Can you confirm the date and number of guests so I can lock in the best available slot?';
  }
  return 'Thanks! For anything specific you can also call 07 3193 0200. I\\'m here to help with availability and bookings — what would you like to know?';
}

function addUser(text) {
  const c = document.getElementById('chat-msgs');
  c.innerHTML += '<div class="msg user"><div class="av user">U</div><div class="bubble">' + text + '</div></div>';
  c.scrollTop = c.scrollHeight;
}

function addTyping() {
  const c = document.getElementById('chat-msgs');
  c.innerHTML += '<div class="msg bot" id="typing"><div class="av bot">M</div><div class="bubble"><div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div></div>';
  c.scrollTop = c.scrollHeight;
}

function botSay(text) {
  const t = document.getElementById('typing');
  if (t) t.remove();
  const c = document.getElementById('chat-msgs');
  c.innerHTML += '<div class="msg bot"><div class="av bot">M</div><div class="bubble">' + text + '</div></div>';
  c.scrollTop = c.scrollHeight;
}

function sendChat() {
  const inp = document.getElementById('chat-input');
  const txt = inp.value.trim();
  if (!txt) return;
  inp.value = '';
  document.getElementById('qrs').style.display = 'none';
  addUser(txt);
  addTyping();
  setTimeout(() => botSay(getReply(txt)), 800 + Math.random() * 400);
}

function sendQuick(txt) {
  document.getElementById('qrs').style.display = 'none';
  addUser(txt);
  addTyping();
  setTimeout(() => botSay(getReply(txt)), 800 + Math.random() * 400);
}
</script>
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
