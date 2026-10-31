/* Resolve + verify IMDb ids for a batch of extra titles.
   Build-time only. Usage: node tools/resolve-batch.js
   Reads the TITLES array below, writes tools/ids-batch.json. */
const fs = require("fs");
const path = require("path");

const TITLES = [
  { title: "Jawan", year: 2023, type: "movie" },
  { title: "Pathaan", year: 2023, type: "movie" },
  { title: "Animal", year: 2023, type: "movie" },
  { title: "Drishyam 2", year: 2022, type: "movie" },
  { title: "Article 15", year: 2019, type: "movie" },
  { title: "Shershaah", year: 2021, type: "movie" },
  { title: "Sardar Udham", year: 2021, type: "movie" },
  { title: "Monica O My Darling", year: 2022, type: "movie" },
  { title: "Kill", year: 2024, type: "movie" },
  { title: "Rocky Aur Rani Kii Prem Kahaani", year: 2023, type: "movie" },
  { title: "Gangubai Kathiawadi", year: 2022, type: "movie" },
  { title: "Chandu Champion", year: 2024, type: "movie" },
  { title: "Farzi", year: 2023, type: "series" },
  { title: "Delhi Crime", year: 2019, type: "series" },
  { title: "Kohrra", year: 2023, type: "series" },
  { title: "The Railway Men", year: 2023, type: "series" },
  { title: "Rocket Boys", year: 2022, type: "series" },
  { title: "Aarya", year: 2020, type: "series" }
];

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
  for (const film of TITLES) {
    const type = film.type === "series" ? "series" : "movie";
    const best = await resolve(film);
    if (!best) {
      console.log(`MISS ${film.title}`);
      continue;
    }
    const m = await meta(best.id, type);
    out[film.title] = {
      id: best.id,
      name: m ? m.name : best.l,
      year: m ? m.year : best.y,
      rating: m ? m.imdbRating : null,
      runtime: m ? m.runtime : null
    };
    console.log(
      `${m ? "ok  " : "NO_META"} ${film.title} -> ${best.id} | ${m ? m.name : best.l} (${m ? m.year : best.y}) | ` +
      `rating ${m ? m.imdbRating : "-"} | ${m ? m.runtime : "-"} | ${m ? (m.cast || []).slice(0, 3).join(", ") : "-"}`
    );
  }
  fs.writeFileSync(path.join(__dirname, "ids-batch.json"), JSON.stringify(out, null, 2));
})();
