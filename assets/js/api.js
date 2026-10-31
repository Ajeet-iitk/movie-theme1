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
  const WIKI = "https://en.wikipedia.org/w/api.php";
  const WIKIDATA = "https://www.wikidata.org/w/api.php";
  const CACHE_KEY = "blindReel.api.v4";
  const META_TTL = 7 * 24 * 60 * 60 * 1000; // refresh ratings weekly
  const LIVE_TTL = 6 * 60 * 60 * 1000; // refresh the live rail every 6 hours
  const BOLLY_TTL = 6 * 60 * 60 * 1000; // refresh the Bollywood shelf every 6 hours
  const TIMEOUT = 9000;

  const EMPTY = { meta: {}, live: null, bollywood: null };

  let cache = load();

  function load() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return { ...EMPTY };
      return {
        meta: parsed.meta || {},
        live: parsed.live || null,
        bollywood: parsed.bollywood || null
      };
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
      released: meta.released || "",
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

  /* -------------------------------------------------------------------------
     Bollywood, fresh — discovery via Wikipedia, metadata via IMDb/Cinemeta.
     Wikipedia's category API is the only keyless, CORS-open way to ask
     "what Hindi films came out this year?", and Wikidata gives us the IMDb
     ids in one batched call. Nothing here needs an API key.
     ------------------------------------------------------------------------- */

  function cleanWikiTitle(title) {
    return String(title || "")
      .replace(/\s*\((?:19|20)\d{2}\s+film\)\s*$/i, "")
      .replace(/\s*\(film\)\s*$/i, "")
      .trim();
  }

  async function wikiCategory(year) {
    const url =
      `${WIKI}?action=query&generator=categorymembers` +
      `&gcmtitle=${encodeURIComponent(`Category:${year} Hindi-language films`)}` +
      `&gcmtype=page&gcmlimit=30&prop=pageprops|extracts&exintro=1&explaintext=1` +
      `&exlimit=20&format=json&origin=*`;
    try {
      const json = await getJSON(url);
      const pages = Object.values((json.query && json.query.pages) || {});
      return pages.filter((page) => page.ns === 0 && !/^List of/i.test(page.title));
    } catch (error) {
      return [];
    }
  }

  /* One batched Wikidata call for every P345 (IMDb id) in the batch. */
  async function imdbIds(pages) {
    const qs = pages
      .map((page) => page.pageprops && page.pageprops.wikibase_item)
      .filter(Boolean)
      .slice(0, 40);
    if (!qs.length) return {};

    try {
      const json = await getJSON(
        `${WIKIDATA}?action=wbgetentities&ids=${qs.join("|")}&props=claims&format=json&origin=*`
      );
      const out = {};
      Object.entries(json.entities || {}).forEach(([qid, entity]) => {
        const claim = entity.claims && entity.claims.P345 && entity.claims.P345[0];
        const value =
          claim && claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value;
        if (value) out[qid] = value;
      });
      return out;
    } catch (error) {
      return {};
    }
  }

  async function mapLimit(list, limit, fn) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (cursor < list.length) {
        const index = cursor;
        cursor += 1;
        await fn(list[index]);
      }
    });
    await Promise.all(workers);
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function bollyCard(meta, id) {
    const year = parseInt(String(meta.year).replace(/[^\d].*$/, ""), 10) || null;
    return {
      id,
      imdb: id,
      title: meta.name,
      year,
      type: "movie",
      sector: "bollywood",
      live: true,
      genres: meta.genres.length ? meta.genres : ["Drama"],
      moods: moodsFor(meta.genres),
      rating: meta.rating,
      length: meta.runtime || "—",
      creditLabel: "Directed by",
      director: meta.director || "—",
      cast: meta.cast || "—",
      language: "Hindi",
      ott: [],
      story: logline(meta.description),
      vibe: meta.rating
        ? `New in Hindi cinema · ${meta.rating.toFixed(1)} on IMDb.`
        : "New in Hindi cinema.",
      releasedAt: Date.parse(meta.released) || 0
    };
  }

  async function bollywoodPool(force = false) {
    if (!force && cache.bollywood && Date.now() - cache.bollywood.at < BOLLY_TTL) {
      return cache.bollywood.items;
    }

    const year = new Date().getFullYear();
    const lists = await Promise.all([wikiCategory(year), wikiCategory(year - 1)]);
    let pages = lists.flat();

    if (pages.length < 10) {
      pages = pages.concat(await wikiCategory(year - 2));
    }

    const seen = new Set();
    const candidates = [];
    pages.forEach((page) => {
      const title = cleanWikiTitle(page.title);
      if (!title || seen.has(title.toLowerCase())) return;
      seen.add(title.toLowerCase());
      candidates.push({ ...page, cleanTitle: title });
    });

    const batch = shuffle(candidates).slice(0, 18);
    const idMap = await imdbIds(batch);
    const items = [];

    await mapLimit(batch, 5, async (page) => {
      const imdb = idMap[page.pageprops && page.pageprops.wikibase_item];
      if (!imdb) return;
      const fresh = await meta(imdb, "movie");
      if (!fresh) return;

      const story = logline(fresh.description);
      if (story.length < 45) return;

      const card = bollyCard(fresh, imdb);
      if (!card.title) return;
      items.push(card);
    });

    items.sort((a, b) => b.releasedAt - a.releasedAt);
    const shelf = items.slice(0, 16);

    cache.bollywood = { at: Date.now(), items: shelf };
    save();
    return shelf;
  }

  async function bollywoodFresh({ count = 6, exclude = [], force = false } = {}) {
    const items = await bollywoodPool(force);
    const skip = new Set(exclude.filter(Boolean));
    return items.filter((item) => !skip.has(item.id)).slice(0, count);
  }

  return { meta, refresh, fresh, bollywoodFresh, moodsFor, pool, bollywoodPool };
})();
