# Blind Reel — The Title Is the Twist

A story-first movie and series recommendation site. Every card gives you the plot, the mood, and a cheesy one-line verdict — but hides the title, year, rating, and cast behind a reveal button.

**Live site:** https://ajeet-iitk.github.io/movie-theme1/

## What's inside

- **60 curated stories** — 48 films and 12 series, picked from a personal watchlist.
- **Reveal cards** — one tap opens the title, year, IMDb rating, runtime/seasons, language, director/creator, cast, and a "why it hurts so good" line.
- **Mood filters** — feel-good, dark & heavy, mind-benders, true stories, romance, survival, comedy, and crime.
- **Surprise me** — picks a random unrevealed story and scrolls you straight to it.
- **Progress that remembers** — revealed titles are saved in `localStorage`. A reset button puts all 60 mysteries back.
- **Cinematic details** — film grain, floating poster, marquee, scroll-aware header, pointer spotlight, confetti on reveal, and reduced-motion support.
- **Mobile-first** — single-column cards, sticky filters, 44px+ tap targets, no horizontal overflow down to 320px.

## Tech

Plain HTML, CSS, and vanilla JavaScript. No build step, no dependencies, no tracking.

```
movie-theme1/
├── index.html
├── assets/
│   ├── css/style.css
│   ├── js/data.js       # the 60 stories + metadata
│   ├── js/app.js        # rendering, filters, reveal, persistence
│   └── img/             # favicon, Apple touch icon, OG image
└── README.md
```

## Run locally

From the project folder:

```bash
python -m http.server 8765
```

Then open `http://localhost:8765/`.

(Opening `index.html` directly also works in most browsers, but a local server is closer to GitHub Pages.)

## Data notes

- Ratings, runtimes, and cast are from IMDb (via the Cinemeta API), checked October 2026. Ratings change over time.
- Storylines are original, spoiler-light descriptions written for this project — not copied from IMDb or Rotten Tomatoes.
- Several titles in the source list had festival-versus-wide release differences (for example, *Companion* is listed as 2024 in the PDF but released in 2025). The site uses the release year shown on IMDb.
- This is a personal, non-commercial fan project. No posters or stills are used; all visuals are CSS and generated artwork.

## Deploy

The site is published with GitHub Pages from the `main` branch, root folder. Any push to `main` updates the live page automatically.
