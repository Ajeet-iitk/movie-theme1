/* Resolve + verify IMDb ids for every curated title.
   Build-time only: IMDb suggestion (accurate search) -> Cinemeta (metadata). */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets", "js", "data.js"), "utf8");
const sandbox = {};
vm.runInNewContext(src + "\nthis.FILMS = FILMS;", sandbox);
const films = sandbox.FILMS;

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const TYPE_OK = {
  movie: ["feature", "tv movie", "tv special", "video"],
  series: ["tv series", "tv mini-series", "podcast series"]
};

function score(m, film) {
  if (!/^tt\d+$/.test(m.id || "")) return Infinity;
  const wanted = norm(film.title);
  const got = norm(m.l);
  let s = 0;
  if (got === wanted) s -= 100;
  else if (got.startsWith(wanted) || wanted.startsWith(got)) s -= 50;
  else s += 60;

  if (m.y != null && film.year != null) {
    const diff = Math.abs(m.y - film.year);
    if (diff === 0) s -= 80;
    else if (diff <= 1) s -= 45;
    else s += diff * 8;
  }

  const q = String(m.q || "").toLowerCase();
  if ((TYPE_OK[film.type] || []).some((t) => q.includes(t))) s -= 25;
  else s += 35;

  return s;
}

async function resolve(film) {
  const url = "https://v3.sg.media-imdb.com/suggestion/x/" + encodeURIComponent(film.title) + ".json";
  const res = await fetch(url);
  const json = await res.json();
  const list = json.d || [];
  let best = null;
  let bestScore = Infinity;
  for (const m of list) {
    const s = score(m, film);
    if (s < bestScore) { bestScore = s; best = m; }
  }
  return best;
}

async function meta(id, type) {
  const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${id}.json`);
  const json = await res.json();
  return json.meta || null;
}

(async () => {
  const out = {};
  const problems = [];

  for (const film of films) {
    const type = film.type === "series" ? "series" : "movie";
    let best = null;
    try { best = await resolve(film); } catch (e) { best = null; }

    if (!best) {
      problems.push(`NO MATCH  ${film.title} (${film.year})`);
      out[film.title] = { id: null };
      continue;
    }

    let m = null;
    try { m = await meta(best.id, type); } catch (e) { m = null; }

    if (!m) {
      problems.push(`NO META   ${film.title} -> ${best.id} (${best.l}, ${best.y})`);
    }

    const titleMismatch = m && norm(m.name) !== norm(film.title);
    const yearMismatch = m && Math.abs(parseInt(m.year, 10) - film.year) > 1;

    out[film.title] = {
      id: best.id,
      imdbName: m ? m.name : best.l,
      imdbYear: m ? m.year : best.y,
      rating: m ? m.imdbRating : null,
      runtime: m ? m.runtime : null
    };

    if (titleMismatch || yearMismatch) {
      problems.push(`CHECK     ${film.title} (${film.year}) -> ${best.id} "${m.name}" (${m.year})`);
    } else {
      console.log(`ok        ${film.title} -> ${best.id}`);
    }
  }

  fs.writeFileSync(path.join(__dirname, "ids.json"), JSON.stringify(out, null, 2));
  console.log("\n--- needs review ---");
  problems.forEach((p) => console.log(p));
})();
