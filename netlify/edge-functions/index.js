export default async (request, context) => {
  const SLUG = "medusa-italian-osteria-romana";
  const API  = `https://mcp.getfork.ai/api/availability/${SLUG}.json`;

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

  const slotsHTML = weekSlots.map(day => {
    const isToday = day.date === todayStr;
    const byShift = {};
    for (const s of day.slots) {
      const mins = s.time.split(":")[1];
      if (mins !== "00" && mins !== "30") continue;
      const shift = s.shift || "Available";
      if (!byShift[shift]) byShift[shift] = [];
      byShift[shift].push(s.time);
    }
    const totalSlots = Object.values(byShift).flat().length;
    const shiftsHTML = Object.entries(byShift).map(([shift, times]) => {
      const pillsHTML = times.map(t => {
        return '<button class="pill" onclick="selectSlot(\'' + t + '\',\'' + day.dayName + '\',\'' + day.date + '\',this)">' + t + '</button>';
      }).join("");
      return '<div class="shift-row"><div class="shift-name">' + shift + '</div><div class="pills">' + pillsHTML + '</div></div>';
    }).join("");

    return '<div class="day-block' + (isToday ? ' open' : '') + '" id="day-' + day.date + '" data-date="' + day.date + '">'
      + '<div class="day-header" onclick="toggleDay(\'day-' + day.date + '\')">'
      + '<div class="day-name-row"><span class="day-name">' + day.dayName + '</span>'
      + (isToday ? '<span class="today-pill">Today</span>' : '')
      + '</div>'
      + '<div class="day-right"><span class="slot-count">' + totalSlots + ' slots</span><span class="chevron">&#9662;</span></div>'
      + '</div>'
      + '<div class="day-slots">' + shiftsHTML + '</div>'
      + '</div>';
  }).join("");

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

  const html = '<!DOCTYPE html>'
  + '<html lang="en">'
  + '<head>'
  + '<meta charset="UTF-8"/>'
  + '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>'
  + '<title>Medusa Osteria Romana — Reservations</title>'
  + '<meta name="description" content="Book a table at Medusa Osteria Romana, Fortitude Valley Brisbane. Live availability."/>'
  + '<meta name="robots" content="index,follow"/>'
  + '<script type="application/ld+json">' + jsonLD + '<\/script>'
  + '<link rel="preconnect" href="https://fonts.googleapis.com"/>'
  + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap" rel="stylesheet"/>'
  + '<style>'
  + '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}'
  + 'html{scroll-behavior:smooth}'
  + 'body{font-family:Inter,sans-serif;font-weight:400;background:#f8f7f5;color:#1a1a1a;min-height:100vh}'
  + '.page{max-width:560px;margin:0 auto;padding:2rem 1.25rem 6rem}'
  + '.resto-header{margin-bottom:2rem}'
  + '.resto-name{font-size:20px;font-weight:500;margin-bottom:5px}'
  + '.resto-meta{font-size:12px;color:#6b6b6b;display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
  + '.rating{color:#b8860b;font-weight:500}'
  + '.sep{color:#ccc}'
  + '.live-pill{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:500;padding:2px 8px;background:#edfaf3;color:#1a7a47;border-radius:999px}'
  + '.live-dot{width:5px;height:5px;border-radius:50%;background:currentColor;animation:pulse 2s infinite}'
  + '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}'
  + '.section-label{font-size:10px;font-weight:500;color:#9a9a9a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.85rem}'
  + '.ssr-note{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:#9a9a9a;margin-bottom:1rem}'
  + '.ssr-dot{width:5px;height:5px;border-radius:50%;background:#4caf7a}'
  + '.day-block{border-bottom:1px solid #f0f0f0}'
  + '.day-block:last-child{border-bottom:none}'
  + '.day-header{display:flex;align-items:center;justify-content:space-between;padding:12px 0;cursor:pointer;user-select:none}'
  + '.day-name-row{display:flex;align-items:center;gap:6px}'
  + '.day-name{font-size:13px;font-weight:500}'
  + '.today-pill{font-size:9px;padding:2px 7px;font-weight:500;background:#e8f0fe;color:#1a56db;border-radius:999px}'
  + '.day-right{display:flex;align-items:center;gap:8px}'
  + '.slot-count{font-size:11px;color:#9a9a9a}'
  + '.chevron{font-size:11px;color:#aaa;transition:transform .2s;display:inline-block}'
  + '.day-block.open .chevron{transform:rotate(180deg)}'
  + '.day-slots{display:none;padding-bottom:12px}'
  + '.day-block.open .day-slots{display:block}'
  + '.shift-row{margin-bottom:10px}'
  + '.shift-name{font-size:9px;color:#9a9a9a;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}'
  + '.pills{display:flex;flex-wrap:wrap;gap:5px}'
  + '.pill{font-size:12px;padding:7px 13px;border:1px solid #e0e0e0;border-radius:8px;background:#fff;color:#1a1a1a;cursor:pointer;transition:all .12s;font-family:Inter,sans-serif}'
  + '.pill:hover{border-color:#999;background:#f5f5f5}'
  + '.pill.selected{background:#1a1a1a;color:#fff;border-color:#1a1a1a}'
  + '.panel{background:#fff;border:1px solid #e8e8e8;border-radius:16px;overflow:hidden;margin-top:1.25rem;display:none}'
  + '.panel.visible{display:block;animation:slideIn .2s ease}'
  + '@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}'
  + '.panel-header{padding:.9rem 1.25rem;background:#fafafa;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between}'
  + '.panel-title{font-size:13px;font-weight:500}'
  + '.panel-sub{font-size:11px;color:#6b6b6b;margin-top:2px}'
  + '.close-btn{font-size:16px;color:#aaa;cursor:pointer;background:none;border:none;padding:0 4px;line-height:1}'
  + '.close-btn:hover{color:#1a1a1a}'
  + '.panel-body{padding:1.25rem}'
  + '.guests-row{display:flex;gap:6px;margin-bottom:1rem}'
  + '.guest-opt{flex:1;padding:9px 4px;text-align:center;font-size:12px;font-weight:500;border:1px solid #e0e0e0;border-radius:8px;cursor:pointer;transition:all .12s;background:#fff;font-family:Inter,sans-serif}'
  + '.guest-opt:hover{border-color:#999}'
  + '.guest-opt.selected{background:#1a1a1a;color:#fff;border-color:#1a1a1a}'
  + '.form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}'
  + '.form-group{margin-bottom:8px}'
  + '.form-label{font-size:11px;font-weight:500;color:#6b6b6b;margin-bottom:4px;display:block}'
  + '.form-input{width:100%;padding:9px 12px;font-size:13px;border:1px solid #e0e0e0;border-radius:8px;background:#fff;color:#1a1a1a;font-family:Inter,sans-serif;outline:none;transition:border-color .12s}'
  + '.form-input:focus{border-color:#1a1a1a}'
  + '.confirm-btn{width:100%;padding:12px;font-size:13px;font-weight:500;background:#1a1a1a;color:#fff;border:none;border-radius:10px;cursor:pointer;margin-top:.85rem;font-family:Inter,sans-serif;transition:opacity .12s}'
  + '.confirm-btn:disabled{opacity:.3;cursor:not-allowed}'
  + '.confirm-btn:not(:disabled):hover{opacity:.85}'
  + '.chat-msgs{height:220px;overflow-y:auto;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:10px;background:#fff}'
  + '.msg{display:flex;gap:7px}'
  + '.msg.user{flex-direction:row-reverse}'
  + '.av{width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:500}'
  + '.av.bot{background:#f0f0f0;color:#6b6b6b;border:1px solid #e8e8e8}'
  + '.av.usr{background:#1a1a1a;color:#fff}'
  + '.bubble{max-width:80%;padding:7px 11px;font-size:12px;line-height:1.5;border-radius:12px}'
  + '.msg.bot .bubble{background:#f5f5f5;border-radius:3px 12px 12px 12px}'
  + '.msg.user .bubble{background:#1a1a1a;color:#fff;border-radius:12px 3px 12px 12px}'
  + '.qrs{display:flex;flex-wrap:wrap;gap:5px;padding:.6rem 1.25rem;border-top:1px solid #f0f0f0;background:#fff}'
  + '.qr{font-size:11px;padding:4px 10px;border:1px solid #e0e0e0;border-radius:999px;background:transparent;color:#1a1a1a;cursor:pointer;transition:background .1s;font-family:Inter,sans-serif}'
  + '.qr:hover{background:#f5f5f5}'
  + '.chat-input-row{display:flex;gap:7px;padding:.75rem 1.25rem;border-top:1px solid #f0f0f0;background:#fff}'
  + '.chat-input{flex:1;padding:8px 13px;font-size:12px;border:1px solid #e0e0e0;border-radius:999px;background:#f8f8f8;color:#1a1a1a;font-family:Inter,sans-serif;outline:none}'
  + '.chat-input:focus{border-color:#999;background:#fff}'
  + '.send-btn{width:32px;height:32px;border-radius:50%;background:#1a1a1a;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}'
  + '.success-panel{background:#edfaf3;border:1px solid #b7e8cc;border-radius:16px;padding:2rem 1.5rem;text-align:center;margin-top:1.25rem;display:none}'
  + '.success-panel.visible{display:block;animation:slideIn .2s ease}'
  + '.success-icon{font-size:32px;margin-bottom:.6rem}'
  + '.success-title{font-size:16px;font-weight:500;color:#1a5c38;margin-bottom:.4rem}'
  + '.success-msg{font-size:12px;color:#1a7a47;line-height:1.6;margin-bottom:1rem;opacity:.9}'
  + '.success-detail{border-top:1px solid #b7e8cc;padding-top:.75rem;display:flex;flex-direction:column;gap:4px}'
  + '.success-row{display:flex;justify-content:space-between;font-size:12px}'
  + '.success-key{color:#1a7a47;opacity:.7}'
  + '.success-val{font-weight:500;color:#1a5c38}'
  + '.new-btn{margin-top:1rem;padding:7px 18px;font-size:12px;font-weight:500;background:transparent;color:#1a7a47;border:1px solid #b7e8cc;border-radius:8px;cursor:pointer;font-family:Inter,sans-serif}'
  + '.chat-fab{position:fixed;bottom:1.5rem;right:1.5rem;display:flex;align-items:center;gap:7px;background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:999px;cursor:pointer;border:none;font-family:Inter,sans-serif;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.18);transition:opacity .15s;z-index:100}'
  + '.chat-fab:hover{opacity:.85}'
  + '.chat-fab-dot{width:7px;height:7px;border-radius:50%;background:#4caf7a;flex-shrink:0}'
  + '.divider{height:1px;background:#ececec;margin:1.5rem 0}'
  + '.footer{text-align:center}'
  + '.footer-info{font-size:11px;color:#9a9a9a;line-height:2}'
  + '.footer-info a{color:#9a9a9a;text-decoration:none}'
  + '.powered{font-size:10px;color:#c0c0c0;margin-top:.5rem}'
  + '.typing{display:flex;gap:3px;align-items:center}'
  + '.dot{width:4px;height:4px;border-radius:50%;background:#999;animation:blink 1.2s infinite}'
  + '.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}'
  + '@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}'
  + '@media(max-width:480px){.page{padding:1.5rem 1rem 6rem}.form-row{grid-template-columns:1fr}.chat-fab{bottom:1rem;right:1rem;padding:9px 14px;font-size:12px}}'
  + '</style>'
  + '</head>'
  + '<body>'
  + '<div class="page">'
  + '<div class="resto-header">'
  + '<div class="resto-name">Medusa Osteria Romana</div>'
  + '<div class="resto-meta">'
  + '<span class="rating">4.7 &#9733;</span>'
  + '<span class="sep">&middot;</span>'
  + '<span>Roman Italian &middot; Fortitude Valley, Brisbane</span>'
  + '<span class="sep">&middot;</span>'
  + '<div class="live-pill"><div class="live-dot"></div> Live</div>'
  + '</div>'
  + '</div>'
  + '<div class="section-label">This week &mdash; tap a day to expand, tap a time to book</div>'
  + '<div class="ssr-note"><div class="ssr-dot"></div> Server-rendered &middot; updated every 60s &middot; AI-readable</div>'
  + (fetchError ? '<p style="color:#c00;font-size:13px;margin-bottom:1rem">Could not load availability. Call 07 3193 0200.</p>' : slotsHTML)
  + '<div class="panel" id="booking-panel">'
  + '<div class="panel-header">'
  + '<div><div class="panel-title" id="b-title">Reserve a table</div><div class="panel-sub" id="b-sub">Complete your details below</div></div>'
  + '<button class="close-btn" onclick="closeBooking()">&#10005;</button>'
  + '</div>'
  + '<div class="panel-body">'
  + '<div class="section-label" style="margin-bottom:.5rem">How many guests?</div>'
  + '<div class="guests-row">'
  + '<div class="guest-opt" onclick="pickG(1,this)">1</div>'
  + '<div class="guest-opt" onclick="pickG(2,this)">2</div>'
  + '<div class="guest-opt" onclick="pickG(3,this)">3</div>'
  + '<div class="guest-opt" onclick="pickG(4,this)">4+</div>'
  + '</div>'
  + '<div class="form-row">'
  + '<div class="form-group"><label class="form-label">Name</label><input class="form-input" id="inp-name" placeholder="Your name" oninput="chk()"/></div>'
  + '<div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="inp-phone" placeholder="04XX XXX XXX" type="tel" oninput="chk()"/></div>'
  + '</div>'
  + '<div class="form-group"><label class="form-label">Special requests <span style="font-weight:400;color:#bbb">(optional)</span></label><input class="form-input" id="inp-notes" placeholder="Dietary needs, occasion, seating preference&hellip;"/></div>'
  + '<button class="confirm-btn" id="confirm-btn" disabled onclick="confirmBook()">Confirm reservation</button>'
  + '</div>'
  + '</div>'
  + '<div class="panel" id="chat-panel">'
  + '<div class="panel-header">'
  + '<div><div class="panel-title">Chat with us</div><div class="panel-sub">Ask anything about Medusa</div></div>'
  + '<button class="close-btn" onclick="closeChat()">&#10005;</button>'
  + '</div>'
  + '<div class="chat-msgs" id="chat-msgs">'
  + '<div class="msg bot"><div class="av bot">M</div><div class="bubble">Hi! I can help with availability, dietary needs, parking, or anything else. What would you like to know?</div></div>'
  + '</div>'
  + '<div class="qrs" id="qrs">'
  + '<button class="qr" onclick="sq(\'Free tonight?\')">Tonight?</button>'
  + '<button class="qr" onclick="sq(\'Outdoor seating?\')">Outdoor?</button>'
  + '<button class="qr" onclick="sq(\'Dietary options?\')">Dietary?</button>'
  + '<button class="qr" onclick="sq(\'Where to park?\')">Parking?</button>'
  + '<button class="qr" onclick="sq(\'Last seating time?\')">Last seating?</button>'
  + '</div>'
  + '<div class="chat-input-row">'
  + '<input class="chat-input" id="chat-input" placeholder="Ask anything&hellip;" onkeydown="if(event.key===\'Enter\')sc()"/>'
  + '<button class="send-btn" onclick="sc()">&#8593;</button>'
  + '</div>'
  + '</div>'
  + '<div class="success-panel" id="success-panel">'
  + '<div class="success-icon">&#127881;</div>'
  + '<div class="success-title">You\'re booked!</div>'
  + '<div class="success-msg" id="success-msg"></div>'
  + '<div class="success-detail">'
  + '<div class="success-row"><span class="success-key">Date</span><span class="success-val" id="sc-date"></span></div>'
  + '<div class="success-row"><span class="success-key">Time</span><span class="success-val" id="sc-time"></span></div>'
  + '<div class="success-row"><span class="success-key">Guests</span><span class="success-val" id="sc-guests"></span></div>'
  + '</div>'
  + '<button class="new-btn" onclick="resetBooking()">Make another booking</button>'
  + '</div>'
  + '<div class="divider"></div>'
  + '<div class="footer">'
  + '<div class="footer-info">14 Via Roma Lane, Fortitude Valley QLD 4006<br/><a href="tel:+61731930200">07 3193 0200</a> &middot; Tables held 15 min &middot; Walk-ins welcome</div>'
  + '<div class="powered">Powered by <a href="https://getfork.ai" style="color:#c0c0c0">GetFork</a></div>'
  + '</div>'
  + '</div>'
  + '<button class="chat-fab" id="chat-fab" onclick="toggleChat()">'
  + '<div class="chat-fab-dot"></div> Need help?'
  + '</button>'
  + '<script>'
  + 'var sel={time:null,day:null,date:null,guests:null};'
  + 'var activeBtn=null,chatOpen=false;'
  + 'function toggleDay(id){'
  + '  var el=document.getElementById(id);'
  + '  el.classList.toggle("open");'
  + '}'
  + 'function selectSlot(time,day,date,btn){'
  + '  if(activeBtn)activeBtn.classList.remove("selected");'
  + '  btn.classList.add("selected");activeBtn=btn;'
  + '  sel={time:time,day:day,date:date,guests:null};'
  + '  document.querySelectorAll(".guest-opt.selected").forEach(function(b){b.classList.remove("selected");});'
  + '  document.getElementById("inp-name").value="";'
  + '  document.getElementById("inp-phone").value="";'
  + '  document.getElementById("inp-notes").value="";'
  + '  document.getElementById("confirm-btn").disabled=true;'
  + '  document.getElementById("b-title").textContent=day+" \u00b7 "+time;'
  + '  document.getElementById("b-sub").textContent="Complete your details to confirm";'
  + '  closeChat();'
  + '  document.getElementById("success-panel").classList.remove("visible");'
  + '  document.getElementById("booking-panel").classList.add("visible");'
  + '  document.getElementById("booking-panel").scrollIntoView({behavior:"smooth",block:"nearest"});'
  + '}'
  + 'function closeBooking(){'
  + '  document.getElementById("booking-panel").classList.remove("visible");'
  + '  if(activeBtn){activeBtn.classList.remove("selected");activeBtn=null;}'
  + '}'
  + 'function pickG(n,btn){'
  + '  document.querySelectorAll(".guest-opt.selected").forEach(function(b){b.classList.remove("selected");});'
  + '  btn.classList.add("selected");sel.guests=n;chk();'
  + '}'
  + 'function chk(){'
  + '  var n=document.getElementById("inp-name").value.trim();'
  + '  var p=document.getElementById("inp-phone").value.trim();'
  + '  document.getElementById("confirm-btn").disabled=!(n&&p&&sel.guests);'
  + '}'
  + 'function confirmBook(){'
  + '  var name=document.getElementById("inp-name").value.trim();'
  + '  var phone=document.getElementById("inp-phone").value.trim();'
  + '  document.getElementById("sc-date").textContent=sel.day+" \u00b7 "+sel.date;'
  + '  document.getElementById("sc-time").textContent=sel.time;'
  + '  document.getElementById("sc-guests").textContent=sel.guests+(sel.guests===1?" guest":" guests");'
  + '  document.getElementById("success-msg").textContent="See you "+sel.day+" at "+sel.time+", "+name+"! We will send a reminder to "+phone+".";'
  + '  document.getElementById("booking-panel").classList.remove("visible");'
  + '  document.getElementById("success-panel").classList.add("visible");'
  + '  document.getElementById("success-panel").scrollIntoView({behavior:"smooth",block:"nearest"});'
  + '  if(activeBtn){activeBtn.classList.remove("selected");activeBtn=null;}'
  + '}'
  + 'function resetBooking(){'
  + '  document.getElementById("success-panel").classList.remove("visible");'
  + '  window.scrollTo({top:0,behavior:"smooth"});'
  + '}'
  + 'function toggleChat(){chatOpen?closeChat():openChat();}'
  + 'function openChat(){'
  + '  closeBooking();'
  + '  document.getElementById("chat-panel").classList.add("visible");'
  + '  document.getElementById("chat-fab").innerHTML="<div class=\\"chat-fab-dot\\"></div> Close chat";'
  + '  document.getElementById("chat-panel").scrollIntoView({behavior:"smooth",block:"nearest"});'
  + '  chatOpen=true;'
  + '}'
  + 'function closeChat(){'
  + '  document.getElementById("chat-panel").classList.remove("visible");'
  + '  document.getElementById("chat-fab").innerHTML="<div class=\\"chat-fab-dot\\"></div> Need help?";'
  + '  chatOpen=false;'
  + '}'
  + 'var KB={'
  + '  "tonight":"Tonight we have dinner slots from 5:00pm to 9:30pm. Tap any time above to book!",'
  + '  "outdoor":"Yes! We have a courtyard. Add it in special requests when booking.",'
  + '  "dietary":"We cater for vegetarian, vegan, gluten-free, halal and dairy-free. Mention it when booking.",'
  + '  "park":"Street parking on Via Roma Lane. Brunswick St car park is a 2 min walk.",'
  + '  "last seat":"Last seating is 90 min before close.",'
  + '  "menu":"Roman Italian - handmade pasta, wood-fired proteins, curated Lazio wine list.",'
  + '  "private":"Private dining for groups of 10+. Call 07 3193 0200 to arrange.",'
  + '  "cancel":"To cancel or modify, call 07 3193 0200. Tables held for 15 minutes.",'
  + '  "halal":"Yes, halal options available. Just mention it when booking.",'
  + '  "sunday":"Sunday has lunch 12:00-2:30pm and dinner 5:30-9:30pm.",'
  + '  "gluten":"Yes, gluten-free options available. Please mention it when booking.",'
  + '  "vegan":"Yes, we have vegan options. Please let us know when booking."'
  + '};'
  + 'function getBot(msg){'
  + '  var l=msg.toLowerCase();'
  + '  var keys=Object.keys(KB);'
  + '  for(var i=0;i<keys.length;i++){if(l.indexOf(keys[i])>=0)return KB[keys[i]];}'
  + '  if(/dinner|lunch|table|book|seat|reserv/.test(l))return "Happy to help! What date and how many guests are you thinking?";'
  + '  return "Great question! For anything specific you can also call us on 07 3193 0200.";'
  + '}'
  + 'function addUser(t){'
  + '  var c=document.getElementById("chat-msgs");'
  + '  document.getElementById("qrs").style.display="none";'
  + '  c.innerHTML+="<div class=\\"msg user\\"><div class=\\"av usr\\">U</div><div class=\\"bubble\\">"+t+"</div></div>";'
  + '  c.scrollTop=c.scrollHeight;'
  + '}'
  + 'function addTyping(){'
  + '  var c=document.getElementById("chat-msgs");'
  + '  c.innerHTML+="<div class=\\"msg bot\\" id=\\"ty\\"><div class=\\"av bot\\">M</div><div class=\\"bubble\\"><div class=\\"typing\\"><div class=\\"dot\\"></div><div class=\\"dot\\"></div><div class=\\"dot\\"></div></div></div></div>";'
  + '  c.scrollTop=c.scrollHeight;'
  + '}'
  + 'function botSay(t){'
  + '  var ty=document.getElementById("ty");if(ty)ty.parentNode.removeChild(ty);'
  + '  var c=document.getElementById("chat-msgs");'
  + '  c.innerHTML+="<div class=\\"msg bot\\"><div class=\\"av bot\\">M</div><div class=\\"bubble\\">"+t+"</div></div>";'
  + '  c.scrollTop=c.scrollHeight;'
  + '}'
  + 'function sc(){'
  + '  var inp=document.getElementById("chat-input");'
  + '  var txt=inp.value.trim();if(!txt)return;'
  + '  inp.value="";addUser(txt);addTyping();'
  + '  setTimeout(function(){botSay(getBot(txt));},800+Math.floor(Math.random()*400));'
  + '}'
  + 'function sq(t){'
  + '  document.getElementById("qrs").style.display="none";'
  + '  addUser(t);addTyping();'
  + '  setTimeout(function(){botSay(getBot(t));},800+Math.floor(Math.random()*400));'
  + '}'
  + '<\/script>'
  + '</body>'
  + '</html>';

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
