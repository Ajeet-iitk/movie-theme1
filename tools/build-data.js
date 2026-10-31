/* Rebuild assets/js/data.js from the curated lists + verified IMDb ids.
   Run after editing tools/new-films.js, tools/more-bollywood.js or tools/ott.js:
     node tools/build-data.js */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "..");
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, "ids.json"), "utf8"));
const extra = [...require("./new-films"), ...require("./more-bollywood")];
const OTT = require("./ott");

const src = fs.readFileSync(path.join(root, "assets", "js", "data.js"), "utf8");
const sandbox = {};
vm.runInNewContext(src + "\nthis.FILMS = FILMS;", sandbox);
const existing = sandbox.FILMS;

// Collections. Everything Western is "hollywood"; two Indian picks from the
// original 60 and the Argentine thriller need their own shelf.
const SECTOR_OVERRIDE = {
  "Ankhon Dekhi": "bollywood",
  "Mard Ko Dard Nahi Hota": "bollywood",
  "El Secreto de Sus Ojos": "world"
};

function sectorFor(title) {
  return SECTOR_OVERRIDE[title] || "hollywood";
}

/* Rebuilds are idempotent: an entry in the hand-written lists always wins over
   the generated copy, so edits to stories, moods or OTT homes propagate. */
const extraByTitle = new Map(extra.map((film) => [film.title, film]));

const merged = existing.map((film) => {
  const override = extraByTitle.get(film.title);
  const base = override ? { ...film, ...override } : film;
  return {
    ...base,
    imdb: (ids[film.title] || {}).id || base.imdb || undefined,
    sector: base.sector === "global" || !base.sector ? sectorFor(film.title) : base.sector,
    ott: OTT[film.title] || base.ott || undefined
  };
});

const seen = new Set(merged.map((f) => f.title));
for (const film of extra) {
  if (seen.has(film.title)) continue;
  merged.push(film);
  seen.add(film.title);
}

const ORDER = [
  "title", "year", "endYear", "ongoing", "type", "sector", "imdb",
  "genres", "moods", "rating", "length", "creditLabel", "director",
  "cast", "language", "ott", "story", "vibe"
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
   and refreshed live in the browser by assets/js/api.js.
   \`ott\` is the main India streaming home at time of writing; the UI also
   links to JustWatch because rights rotate. */

const FILMS = [
${merged.map(serialize).join(",\n")}
];
`;

fs.writeFileSync(path.join(root, "assets", "js", "data.js"), header);
console.log(`wrote data.js with ${merged.length} titles`);
console.log("sectors:", merged.reduce((acc, f) => { acc[f.sector] = (acc[f.sector] || 0) + 1; return acc; }, {}));
console.log("types:", merged.reduce((acc, f) => { acc[f.type] = (acc[f.type] || 0) + 1; return acc; }, {}));
console.log("with ott:", merged.filter((f) => f.ott && f.ott.length).length);
console.log("missing imdb:", merged.filter((f) => !f.imdb).map((f) => f.title));
