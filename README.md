# Blind Reel — The Title Is the Twist

A story-first movie and series recommendation site. Every card gives you the plot, the mood, and a cheesy one-line verdict — but hides the title, year, rating, and cast behind a reveal button.

**Live site:** https://ajeet-iitk.github.io/movie-theme1/

## What's inside

- **118 curated stories** — 92 films and 26 series, split across Hollywood (57), Bollywood (54) and world cinema (7).
- **Reveal cards** — one tap opens the title, year, IMDb rating, runtime/seasons, language, director/creator, cast, a "why it hurts so good" line, and where to stream it in India.
- **Collection tags + filters** — every card is tagged Hollywood, Bollywood or World. Filter by All, Movies, Series, Hollywood, Bollywood, World, plus mood filters (feel-good, dark & heavy, mind-benders, true stories, romance, survival, comedy, crime).
- **Surprise me** — picks a random unrevealed story and scrolls you straight to it. It highlights the card but **never opens the title**; the reveal stays your call.
- **See more** — cards are painted a page at a time (6 on phones, 9 on tablets, 12 on desktop) so the list never becomes an endless scroll. Sealed cards stay in the DOM, so reveals, filters and Surprise keep working across pages.
- **Two live shelves** — "Bollywood, fresh" discovers new Hindi releases through Wikipedia and Wikidata, and "Fresh off the catalogue" pulls popular titles from a keyless IMDb mirror. Both hydrate at runtime, so the site keeps growing without a redeploy.
- **OTT homes** — curated press-kit cards carry a hand-checked India streaming home (Netflix, Prime Video, JioHotstar, SonyLIV, ZEE5); every reveal also links to JustWatch because rights rotate.
- **Progress that remembers** — revealed titles are saved in `localStorage`. A reset button puts all 118 mysteries back.
- **Cinematic details** — film grain, floating poster, marquee, a header that folds its nav away as you scroll down, pointer spotlight, confetti on reveal, and reduced-motion support.
- **Mobile-first** — single-column cards, sticky filters that follow the collapsing header, scrollable filter rail, 44px+ tap targets, no horizontal overflow down to 320px.

## Tech

Plain HTML, CSS, and vanilla JavaScript. No build step, no dependencies, no tracking, no API keys.

```
movie-theme1/
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/data.js       # the 118 curated stories + bundled metadata
│   ├── js/api.js        # live layers (Cinemeta + Wikipedia/Wikidata, cached)
│   ├── js/app.js        # rendering, filters, paging, reveal, persistence
│   └── img/             # favicon, Apple touch icon, OG image
├── tools/               # one-off maintenance scripts (Node 18+)
└── README.md
```

## Run locally

From the project folder:

```bash
python -m http.server 8765
```

Then open `http://localhost:8765/`.

(Opening `index.html` directly also works in most browsers, but a local server is closer to GitHub Pages. The live shelves need a network connection; the curated catalogue does not.)

## How the live data works

The site ships with a complete offline catalogue, then upgrades itself in the browser:

1. **Ratings refresh** — up to 12 titles per visit are re-checked against Cinemeta, a public IMDb mirror, and their rating/runtime patch in place. Results are cached in `localStorage` for 7 days, so repeat visits are instant.
2. **Bollywood, fresh** — the newest Hindi films are discovered from Wikipedia's `Category:<year> Hindi-language films` (fast, CORS-open), their IMDb ids come from one batched Wikidata `wbgetentities` call, and Cinemeta supplies rating, runtime, cast and logline. Candidates are shuffled and sorted by release date, then cached for 6 hours.
3. **Live shelf** — the popular film and series catalogues are fetched, filtered to IMDb 7.0+, deduplicated against everything already on the page, and interleaved film/series. Cached for 6 hours.
4. **Graceful fallback** — if the network, CORS, or an API fails, the bundled catalogue renders exactly as before. Nothing blocks on a request.

Every request is keyless and read-only. No TMDB/OMDb key, no server, no proxy.

### Why not TMDB?

TMDB is excellent, but every endpoint requires a personal API key tied to an account. Shipping a key in a public static repo either exposes it or breaks the site for anyone who doesn't have one, so this build stays on keyless sources. If you want TMDB later, add a small proxy (Cloudflare Worker) and swap `assets/js/api.js` — the module is deliberately isolated behind `window.BlindReelAPI`.

### Why not JustWatch for OTT data?

JustWatch's GraphQL endpoint answers, but it sends no CORS headers, so a browser on GitHub Pages cannot read it. OTT homes are therefore curated by hand, and every card links out to a JustWatch search for a live check. Wikidata's SPARQL endpoint also works but takes ~28 seconds per query, which is far too slow for a page load.

## Maintenance

`tools/` holds the scripts used to build the catalogue. They are not part of the deployed site.

```bash
node tools/resolve-ids.js     # re-resolve IMDb ids + verify metadata (writes tools/ids.json)
node tools/resolve-batch.js   # same, for the second Bollywood batch (writes tools/ids-batch.json)
node tools/build-data.js      # rebuild assets/js/data.js from the curated lists
```

To add titles by hand, add entries to `tools/new-films.js` or `tools/more-bollywood.js` with the same shape, then run `node tools/build-data.js`. Each entry needs `title`, `year`, `type`, `sector`, `imdb`, `genres`, `moods`, `rating`, `length`, `creditLabel`, `director`, `cast`, `language`, `story`, and `vibe`; `ott` (an array of platform names) is optional.

`build-data.js` is idempotent: a title already present in `data.js` is updated in place from the hand-written list rather than duplicated, so editing a story, mood or OTT home and re-running the script is safe. `tools/ott.js` maps the original catalogue's titles to streaming homes.

## Data notes

- Ratings, runtimes, and cast are from IMDb (via the Cinemeta API), checked October 2026, then refreshed in the browser.
- Storylines are original, spoiler-light descriptions written for this project — not copied from IMDb or Rotten Tomatoes. The live shelves are the exception: they show a trimmed IMDb logline and label themselves "Auto synopsis".
- OTT homes are India-specific and current at time of writing; licensing moves constantly, so treat the JustWatch link as the source of truth.
- Several titles had festival-versus-wide release differences (for example, *Companion* is listed as 2024 in the source list but released in 2025). The site uses the release year shown on IMDb.
- Bollywood here means Hindi-language cinema; *RRR* and other regional-language films are outside that count.
- This is a personal, non-commercial fan project. No posters or stills are used; all visuals are CSS and generated artwork.

## Deploy

The site is published with GitHub Pages from the `main` branch, root folder. Any push to `main` updates the live page automatically.
