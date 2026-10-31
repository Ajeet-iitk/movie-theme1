/* Blind Reel — live catalogue layer.
 *
 * Everything here is keyless and CORS-friendly, so it runs straight from
 * GitHub Pages with no server and no signup:
 *   - Cinemeta  (IMDb mirror): per-title metadata + popular catalogues
 *   - TVMaze   : optional series lookup fallback
 *
 * TMDB is deliberately not used: its API requires a personal key, so the
 * site would break for every visitor without one. If you add a key later,
 * see README.md -> "Swapping in TMDB".
 */
window.BlindReelAPI = (() => {
  "use strict";

  const CINEMETA = "https://v3-cinemeta.strem.io";
  const CACHE_KEY = "blindReel.api.v3";
  const META_TTL = 7 * 24 * 60 * 60 * 1000; // refresh ratings weekly
  const LIVE_TTL = 6 * 60 * 60 * 1000; // refresh the live rail every 6 hours
  const TIMEOUT = 9000;

  const EMPTY = { meta: {}, live: null };

  let cache = load();

  function load() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return { ...EMPTY };
      return { meta: parsed.meta || {}, live: parsed.live || null };
    } catch (error) {
      return { ...EMPTY };
    }
  }

  function save() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      /* Storage full or blocked: keep working from memory. */
    }
  }

  async function getJSON(url, attempt = 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      // Cinemeta occasionally answers with a 5xx / missing CORS headers.
      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        return getJSON(url, attempt + 1);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function first(value) {
    if (Array.isArray(value)) return value[0] || "";
    if (typeof value === "string") return value.split(",")[0].trim();
    return "";
  }

  function pluck(list, count) {
    return (Array.isArray(list) ? list : []).slice(0, count).join(", ");
  }

  function normalise(meta, type) {
    if (!meta) return null;
    const genres = Array.isArray(meta.genres)
      ? meta.genres
      : String(meta.genre || "").split(",").map((g) => g.trim()).filter(Boolean);

    return {
      name: meta.name || "",
      year: meta.year || "",
      type,
      rating: Number(meta.imdbRating) || null,
      runtime: meta.runtime || "",
      genres: genres.slice(0, 3),
      cast: pluck(meta.cast, 3),
      director: first(meta.director),
      description: meta.description || "",
      country: first(meta.country),
      status: meta.status || "",
      at: Date.now()
    };
  }

  function cached(imdb) {
    const hit = cache.meta[imdb];
    if (!hit) return null;
    if (Date.now() - hit.at > META_TTL) return null;
    return hit;
  }

  async function meta(imdb, type) {
    if (!imdb) return null;
    const hit = cached(imdb);
    if (hit) return hit;

    const kind = type === "series" ? "series" : "movie";
    try {
      const json = await getJSON(`${CINEMETA}/meta/${kind}/${imdb}.json`);
      const out = normalise(json.meta, kind);
      if (out) {
        cache.meta[imdb] = out;
        save();
      }
      return out;
    } catch (error) {
      return null;
    }
  }

  /* Refresh a slice of the curated catalogue. Sequential on purpose: a
     hundred parallel requests would be rude to a free API. */
  async function refresh(films, limit = 10) {
    const now = Date.now();
    const stale = films.filter((film) => {
      if (!film.imdb) return false;
      const hit = cache.meta[film.imdb];
      return !hit || now - hit.at > META_TTL;
    });

    const slice = stale.slice(0, limit);
    const updated = {};

    for (const film of slice) {
      const fresh = await meta(film.imdb, film.type);
      if (fresh) updated[film.imdb] = fresh;
    }

    return updated;
  }

  function moodsFor(genres) {
    const set = new Set();
    const list = genres.map((g) => g.toLowerCase());
    if (list.some((g) => ["comedy"].includes(g))) set.add("laugh");
    if (list.some((g) => ["romance"].includes(g))) set.add("romance");
    if (list.some((g) => ["crime", "film-noir"].includes(g))) set.add("crime");
    if (list.some((g) => ["thriller", "horror", "drama"].includes(g))) set.add("dark");
    if (list.some((g) => ["sci-fi", "mystery", "fantasy"].includes(g))) set.add("mind-bender");
    if (list.some((g) => ["biography", "history", "documentary"].includes(g))) set.add("true-story");
    if (list.some((g) => ["adventure", "action", "war"].includes(g))) set.add("survival");
    if (!set.size) set.add("feel-good");
    return [...set].slice(0, 3);
  }

  // A logline, not a synopsis: first sentence only, trimmed hard.
  function logline(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    const match = clean.match(/^.{40,220}?[.!?](?=\s|$)/);
    const sentence = match ? match[0] : clean.slice(0, 190);
    return sentence.length < clean.length && !/[.!?]$/.test(sentence) ? `${sentence}…` : sentence;
  }

  function toCard(meta) {
    return {
      id: meta.imdb || meta.id,
      imdb: meta.imdb || meta.id,
      title: meta.name,
      year: parseInt(meta.year, 10) || null,
      type: meta.type === "series" ? "series" : "movie",
      live: true,
      genres: meta.genres.length ? meta.genres : ["Drama"],
      moods: moodsFor(meta.genres),
      rating: meta.rating,
      length: meta.runtime || "—",
      creditLabel: "Directed by",
      director: meta.director || "—",
      cast: meta.cast || "—",
      language: meta.country || "—",
      story: logline(meta.description) || "A story the API is keeping quiet about.",
      vibe: meta.rating ? `Currently rated ${meta.rating.toFixed(1)} on IMDb.` : "Fresh off the catalogue."
    };
  }

  async function pool(force = false) {
    if (!force && cache.live && Date.now() - cache.live.at < LIVE_TTL) {
      return cache.live.items;
    }

    const urls = [
      `${CINEMETA}/catalog/movie/top.json`,
      `${CINEMETA}/catalog/series/top.json`
    ];

    const responses = await Promise.allSettled(urls.map((url) => getJSON(url)));
    const movies = [];
    const shows = [];

    responses.forEach((result) => {
      if (result.status !== "fulfilled") return;
      const metas = result.value.metas || [];
      metas.forEach((m) => {
        if (!m.imdb_id || !m.name || !m.description) return;
        const rating = Number(m.imdbRating);
        if (!rating || rating < 7) return;
        const card = toCard({
          imdb: m.imdb_id,
          name: m.name,
          year: m.year || m.releaseInfo,
          type: m.type,
          rating,
          runtime: m.runtime,
          genres: m.genres || String(m.genre || "").split(", "),
          cast: m.cast,
          director: m.director,
          description: m.description,
          country: m.country
        });
        if (card.type === "series") shows.push(card);
        else movies.push(card);
      });
    });

    // Alternate film, series, film, series so the shelf never looks one-note.
    const mixed = [];
    const longest = Math.max(movies.length, shows.length);
    for (let i = 0; i < longest; i += 1) {
      if (movies[i]) mixed.push(movies[i]);
      if (shows[i]) mixed.push(shows[i]);
    }

    const deduped = [];
    const seen = new Set();
    for (const item of mixed) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      deduped.push(item);
    }

    cache.live = { at: Date.now(), items: deduped };
    save();
    return deduped;
  }

  /* Newest live cards, skipping anything already on the page. */
  async function fresh({ count = 6, exclude = [], force = false } = {}) {
    const items = await pool(force);
    const skip = new Set(exclude.filter(Boolean));
    return items.filter((item) => !skip.has(item.id)).slice(0, count);
  }

  return { meta, refresh, fresh, moodsFor, pool };
})();
