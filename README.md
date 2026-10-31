# Blind Reel — The Title Is the Twist

A story-first movie and series recommendation site. Every card gives you the plot, the mood, and a cheesy one-line verdict — but hides the title, year, rating, and cast behind a reveal button.

**Live site:** https://ajeet-iitk.github.io/movie-theme1/

## What's inside

- **100 curated stories** — 80 films and 20 series, split across Hollywood (57), Bollywood (36) and world cinema (7).
- **Reveal cards** — one tap opens the title, year, IMDb rating, runtime/seasons, language, director/creator, cast, and a "why it hurts so good" line.
- **Collection filters** — All, Movies, Series, Bollywood, World, plus mood filters (feel-good, dark & heavy, mind-benders, true stories, romance, survival, comedy, crime).
- **Surprise me** — picks a random unrevealed story and scrolls you straight to it. It highlights the card but **never opens the title**; the reveal stays your call.
- **Live shelf** — a "Fresh off the catalogue" strip pulls brand-new titles at runtime from a keyless public API, so the catalogue keeps growing without a redeploy.
- **Progress that remembers** — revealed titles are saved in `localStorage`. A reset button puts all 100 mysteries back.
- **Cinematic details** — film grain, floating poster, marquee, scroll-aware header, pointer spotlight, confetti on reveal, and reduced-motion support.
- **Mobile-first** — single-column cards, sticky filters, scrollable filter rail, 44px+ tap targets, no horizontal overflow down to 320px.

## Tech

Plain HTML, CSS, and vanilla JavaScript. No build step, no dependencies, no tracking, no API keys.

```
movie-theme1/
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/data.js       # the 100 curated stories + bundled metadata
│   ├── js/api.js        # live catalogue layer (Cinemeta, cached)
│   ├── js/app.js        # rendering, filters, reveal, persistence
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

(Opening `index.html` directly also works in most browsers, but a local server is closer to GitHub Pages.)

## How the live data works

The site ships with a complete offline catalogue, then upgrades itself in the browser:

1. **Ratings refresh** — up to 12 titles per visit are re-checked against Cinemeta, a public IMDb mirror, and their rating/runtime patch in place. Results are cached in `localStorage` for 7 days, so repeat visits are instant.
2. **Live shelf** — the popular film and series catalogues are fetched, filtered to IMDb 7.0+, deduplicated against everything already on the page, and interleaved film/series. Cached for 6 hours.
3. **Graceful fallback** — if the network, CORS, or the API fails, the bundled catalogue renders exactly as before. Nothing blocks on a request.

Every request is keyless and read-only. No TMDB/OMDb key, no server, no proxy.

### Why not TMDB?

TMDB is excellent, but every endpoint requires a personal API key tied to an account. Shipping a key in a public static repo either exposes it or breaks the site for anyone who doesn't have one, so this build stays on keyless sources. If you want TMDB later, add a small proxy (Cloudflare Worker) and swap `assets/js/api.js` — the module is deliberately isolated behind `window.BlindReelAPI`.

## Maintenance

`tools/` holds the scripts used to build the catalogue. They are not part of the deployed site.

```bash
node tools/resolve-ids.js   # re-resolve IMDb ids + verify metadata (writes tools/ids.json)
node tools/build-data.js    # rebuild assets/js/data.js from the curated list
```

To add titles by hand, edit `tools/new-films.js` with the same shape, then run `node tools/build-data.js`. Each entry needs `title`, `year`, `type`, `sector`, `imdb`, `genres`, `moods`, `rating`, `length`, `creditLabel`, `director`, `cast`, `language`, `story`, and `vibe`.

## Data notes

- Ratings, runtimes, and cast are from IMDb (via the Cinemeta API), checked October 2026, then refreshed in the browser.
- Storylines are original, spoiler-light descriptions written for this project — not copied from IMDb or Rotten Tomatoes. The live shelf is the exception: it shows a trimmed IMDb logline and labels itself "Auto synopsis".
- Several titles had festival-versus-wide release differences (for example, *Companion* is listed as 2024 in the source list but released in 2025). The site uses the release year shown on IMDb.
- Bollywood here means Hindi-language cinema; *RRR* and other regional-language films are outside that count.
- This is a personal, non-commercial fan project. No posters or stills are used; all visuals are CSS and generated artwork.

## Deploy

The site is published with GitHub Pages from the `main` branch, root folder. Any push to `main` updates the live page automatically.
