/* Rebuild assets/js/data.js from the curated list + verified IMDb ids.
   Run after editing tools/new-films.js: node tools/build-data.js */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "..");
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, "ids.json"), "utf8"));
const extra = require("./new-films");

const src = fs.readFileSync(path.join(root, "assets", "js", "data.js"), "utf8");
const sandbox = {};
vm.runInNewContext(src + "\nthis.FILMS = FILMS;", sandbox);
const existing = sandbox.FILMS;

// Titles already in the list that belong to a non-Western collection.
const SECTOR_OVERRIDE = {
  "Ankhon Dekhi": "bollywood",
  "Mard Ko Dard Nahi Hota": "bollywood",
  "El Secreto de Sus Ojos": "world"
};

const merged = existing.map((film) => ({
  ...film,
  imdb: (ids[film.title] || {}).id || undefined,
  sector: SECTOR_OVERRIDE[film.title] || "global"
}));

const seen = new Set(merged.map((f) => f.title));
for (const film of extra) {
  if (seen.has(film.title)) throw new Error("Duplicate title: " + film.title);
  merged.push(film);
  seen.add(film.title);
}

const ORDER = [
  "title", "year", "endYear", "ongoing", "type", "sector", "imdb",
  "genres", "moods", "rating", "length", "creditLabel", "director",
  "cast", "language", "story", "vibe"
];

const q = (value) => JSON.stringify(value).replace(/\\"/g, '\\"');

function serialize(film) {
  const lines = ORDER
    .filter((key) => film[key] !== undefined)
    .map((key) => {
      const value = film[key];
      if (Array.isArray(value)) {
        return `    ${key}: [${value.map((v) => q(v)).join(", ")}],`;
      }
      if (typeof value === "number") return `    ${key}: ${value},`;
      if (typeof value === "boolean") return `    ${key}: ${value},`;
      return `    ${key}: ${q(value)},`;
    });
  return `  {\n${lines.join("\n")}\n  }`;
}

const header = `/* Blind Reel — curated story-first watchlist.
   ${merged.length} titles: ${merged.filter((f) => f.type === "movie").length} films, ${merged.filter((f) => f.type === "series").length} series.
   Storylines are original and spoiler-light.
   Metadata (rating, runtime, cast, director) verified via Cinemeta / IMDb,
   and refreshed live in the browser by assets/js/api.js. */

const FILMS = [
${merged.map(serialize).join(",\n")}
];
`;

fs.writeFileSync(path.join(root, "assets", "js", "data.js"), header);
console.log(`wrote data.js with ${merged.length} titles`);
console.log("sectors:", merged.reduce((acc, f) => { acc[f.sector] = (acc[f.sector] || 0) + 1; return acc; }, {}));
console.log("missing imdb:", merged.filter((f) => !f.imdb).map((f) => f.title));
