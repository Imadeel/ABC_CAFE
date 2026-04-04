# GetFork — SSR Availability Page

## The problem
The current page fetches slots via client-side JS (`fetch()` in the browser).  
GPT, Gemini, and search engine crawlers get the raw HTML **before** JS runs, so they only see:
```
"Fetching live availability…"
```
They can't read any slots.

## The solution — Netlify Edge Function
`netlify/edge-functions/availability.js` intercepts every request to `/` **at the edge** (Deno runtime, ~10ms overhead).  
It:
1. Fetches `mcp.getfork.ai/api/availability/{slug}.json` server-side
2. Renders all slots into static HTML
3. Embeds a `application/ld+json` schema.org block with structured slot data
4. Returns the complete HTML — **no JS needed to read any slot**

AI crawlers, GPT browsing, Gemini, and Google all get fully pre-rendered content.

## How to deploy

1. Copy `netlify/edge-functions/availability.js` into your repo
2. Copy `netlify.toml` into your repo root (merge with existing if you have one)
3. Push — Netlify auto-detects edge functions

```
your-repo/
├── netlify.toml
├── netlify/
│   └── edge-functions/
│       └── availability.js
└── (your other files)
```

## Caching
The function sets `Cache-Control: public, max-age=60` — slots are cached for 60 seconds at the CDN edge, keeping API calls low while staying fresh.

## What AI crawlers now see
```html
<section class="day" data-date="2026-04-05" aria-label="Availability for Sunday 2026-04-05">
  <h2 class="day-name">Sunday <time datetime="2026-04-05">2026-04-05</time></h2>
  <p class="status">Status: <strong>open</strong></p>
  <div class="shift">
    <span class="shift-label">Dinner</span>
    <div class="times">
      <span class="slot">17:30</span>
      <span class="slot">18:00</span>
      ...
    </div>
  </div>
</section>
```
Plain, semantic HTML. No JavaScript required. GPT/Gemini can read every slot.
