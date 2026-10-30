/* Blind Reel — app logic */

(() => {
  "use strict";

  const TOTAL = FILMS.length;
  const STORAGE_KEY = "blindReel.revealed.v1";
  const ACCENTS = ["#f5c451", "#ff7a59", "#7fe7d4", "#b8a1ff", "#7cc7ff", "#ff9ec4"];

  const MOODS = [
    { key: "all", label: "All moods" },
    { key: "feel-good", label: "Feel-good" },
    { key: "dark", label: "Dark & heavy" },
    { key: "mind-bender", label: "Mind-benders" },
    { key: "true-story", label: "True stories" },
    { key: "romance", label: "Romance" },
    { key: "survival", label: "Survival" },
    { key: "laugh", label: "Make me laugh" },
    { key: "crime", label: "Crime & cons" }
  ];

  const TOASTS = [
    "One more mystery solved.",
    "Title revealed. Handle with care.",
    "You did not see that coming, did you?",
    "Plot: 1. You: 0.",
    "Added to your imaginary watchlist.",
    "A dangerous amount of taste.",
    "That one has been waiting for you."
  ];

  const els = {
    grid: document.getElementById("grid"),
    empty: document.getElementById("emptyState"),
    results: document.getElementById("resultsCount"),
    progressText: document.getElementById("progressText"),
    progressBar: document.getElementById("progressBar"),
    headerCount: document.getElementById("headerCount"),
    headerTotal: document.getElementById("headerTotal"),
    headerBar: document.getElementById("headerBar"),
    resetBtn: document.getElementById("resetBtn"),
    moodRow: document.getElementById("moodRow"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toastText"),
    toTop: document.getElementById("toTop"),
    header: document.getElementById("siteHeader"),
    scrollBar: document.getElementById("scrollBar")
  };

  const state = {
    type: "all",
    mood: "all",
    revealed: loadRevealed(),
    toastTimer: 0
  };

  let cards = [];
  let observer = null;
  let toastId = 0;

  /* -------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------- */

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, seed) {
    const copy = list.slice();
    const rand = seededRandom(seed);
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function loadRevealed() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const valid = new Set(FILMS.map((film) => film.title));
      return new Set(Array.isArray(parsed) ? parsed.filter((title) => valid.has(title)) : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveRevealed() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.revealed]));
    } catch (error) {
      /* Private mode / storage disabled: the site still works this session. */
    }
  }

  function yearLabel(film) {
    if (film.endYear) return `${film.year}–${film.endYear}`;
    if (film.type === "series" && film.ongoing) return `${film.year}–`;
    return `${film.year}`;
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function showToast(message) {
    if (!els.toast || !els.toastText) return;
    toastId += 1;
    const current = toastId;
    els.toastText.textContent = message;
    els.toast.classList.add("is-show");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      if (current === toastId) els.toast.classList.remove("is-show");
    }, 2600);
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /* -------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------- */

  // Keep the grid varied: four films, then a series, all the way down.
  const moviePool = shuffle(FILMS.filter((film) => film.type === "movie"), 0xb11d5eed);
  const seriesPool = shuffle(FILMS.filter((film) => film.type === "series"), 0x5e21e5);
  const ordered = [];

  moviePool.forEach((film, index) => {
    ordered.push(film);
    if (index % 4 === 3 && seriesPool.length) ordered.push(seriesPool.shift());
  });
  while (seriesPool.length) ordered.push(seriesPool.shift());

  function cardMarkup(film, position) {
    const accent = ACCENTS[position % ACCENTS.length];
    const typeLabel = film.type === "series" ? "Series" : "Movie";
    const typeIcon = film.type === "series" ? "i-tv" : "i-film";
    const panelId = `reveal-${position + 1}`;
    const tags = film.genres
      .slice(0, 3)
      .map((genre) => `<span class="tag">${esc(genre)}</span>`)
      .join("");

    return `
      <article class="card" data-title="${esc(film.title)}" data-type="${film.type}" data-moods="${film.moods.join(" ")}" style="--accent:${accent}">
        <div class="confetti" aria-hidden="true"></div>
        <div class="card-top">
          <span class="card-type${film.type === "series" ? " is-series" : ""}">
            <svg class="icon" aria-hidden="true"><use href="#${typeIcon}"/></svg>
            ${typeLabel}
          </span>
          <span class="card-num">${String(position + 1).padStart(2, "0")}</span>
        </div>
        <div class="card-tags">${tags}</div>
        <div class="card-body">
          <span class="story-label">The story</span>
          <p class="card-story">${esc(film.story)}</p>
        </div>
        <div class="card-foot">
          <button class="reveal-btn" type="button" aria-expanded="false" aria-controls="${panelId}" data-action="reveal">
            <span class="left">
              <svg class="icon" aria-hidden="true"><use href="#i-eye"/></svg>
              <span class="reveal-label">Reveal the title</span>
            </span>
            <svg class="icon chev" aria-hidden="true"><use href="#i-arrow-down"/></svg>
          </button>
          <div class="card-reveal" id="${panelId}" aria-hidden="true" aria-live="polite">
            <div class="reveal-inner">
              <div class="reveal-content">
                <p class="reveal-kicker">The title was</p>
                <h3 class="reveal-title">${esc(film.title)}<span class="year">${yearLabel(film)}</span></h3>
                <div class="reveal-meta">
                  <span class="rating-badge"><svg class="icon" aria-hidden="true"><use href="#i-star"/></svg>${film.rating.toFixed(1)}<small>IMDb</small></span>
                  <span class="meta-item"><svg class="icon" aria-hidden="true"><use href="#i-clock"/></svg>${esc(film.length)}</span>
                  <span class="meta-item"><svg class="icon" aria-hidden="true"><use href="#i-film"/></svg>${esc(film.language)}</span>
                </div>
                <p class="reveal-vibe">“${esc(film.vibe)}”</p>
                <div class="reveal-credits">
                  <span><b>${esc(film.creditLabel)}</b> ${esc(film.director)}</span>
                  <span><b>Starring</b> ${esc(film.cast)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>`;
  }

  function render() {
    els.grid.innerHTML = ordered.map(cardMarkup).join("");
    cards = [...els.grid.querySelectorAll(".card")];

    document.getElementById("countAll").textContent = TOTAL;
    document.getElementById("countMovies").textContent = FILMS.filter((film) => film.type === "movie").length;
    document.getElementById("countSeries").textContent = FILMS.filter((film) => film.type === "series").length;
    els.headerTotal.textContent = TOTAL;

    // Re-apply saved reveals without celebration.
    cards.forEach((card) => {
      if (state.revealed.has(card.dataset.title)) {
        setRevealed(card, true, { celebrate: false, toast: false });
      }
    });

    setupObserver();
    updateProgress();
  }

  function renderMoodChips() {
    els.moodRow.innerHTML = MOODS.map((mood, index) => `
      <button
        class="mood-chip${index === 0 ? " is-active" : ""}"
        type="button"
        data-mood="${mood.key}"
        aria-pressed="${index === 0 ? "true" : "false"}"
      >${mood.label}</button>`).join("");
  }

  function setupObserver() {
    if (!("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("is-visible"));
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -36px 0px", threshold: 0.04 }
    );

    cards.forEach((card) => observer.observe(card));
  }

  /* -------------------------------------------------------------------------
     Reveal / hide
     ------------------------------------------------------------------------- */

  function setRevealed(card, on, options = {}) {
    const { celebrate = true, toast = true } = options;
    const button = card.querySelector(".reveal-btn");
    const label = card.querySelector(".reveal-label");
    const panel = card.querySelector(".card-reveal");

    if (!button || !panel || !label) return;

    if (on) {
      card.classList.add("is-revealed");
      button.setAttribute("aria-expanded", "true");
      panel.setAttribute("aria-hidden", "false");
      label.textContent = "Hide the title";
      button.querySelector("use").setAttribute("href", "#i-close");
      state.revealed.add(card.dataset.title);
      if (celebrate) {
        burst(card);
        if (toast) showToast(randomFrom(TOASTS));
      }
    } else {
      card.classList.remove("is-revealed");
      button.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
      label.textContent = "Reveal the title";
      button.querySelector("use").setAttribute("href", "#i-eye");
      state.revealed.delete(card.dataset.title);
      if (toast) showToast("Back under wraps.");
    }

    saveRevealed();
    updateProgress();
  }

  function toggleCard(card) {
    const isOpen = card.classList.contains("is-revealed");
    setRevealed(card, !isOpen, { celebrate: !isOpen, toast: true });
  }

  function burst(card) {
    if (reducedMotion()) return;
    const wrap = card.querySelector(".confetti");
    if (!wrap) return;

    wrap.innerHTML = "";
    for (let i = 0; i < 22; i += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      const angle = Math.random() * Math.PI * 2;
      const distance = 52 + Math.random() * 125;
      piece.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--y", `${Math.sin(angle) * distance - 18}px`);
      piece.style.setProperty("--rot", `${Math.round(Math.random() * 760 - 380)}deg`);
      piece.style.setProperty("--c", ACCENTS[Math.floor(Math.random() * ACCENTS.length)]);
      piece.style.animationDelay = `${Math.random() * 0.07}s`;
      wrap.appendChild(piece);
    }

    window.setTimeout(() => {
      wrap.innerHTML = "";
    }, 1250);
  }

  function scrollToCard(card) {
    const filter = document.querySelector(".filter-shell");
    const stickyTop = filter ? parseFloat(window.getComputedStyle(filter).top) || 0 : 84;
    const offset = stickyTop + (filter ? filter.offsetHeight : 0) + 44;
    const top = card.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
    card.classList.add("is-visible");
    if (!reducedMotion()) {
      card.animate(
        [
          { transform: "translateY(0)" },
          { transform: "translateY(-5px)" },
          { transform: "translateY(0)" }
        ],
        { duration: 480, easing: "cubic-bezier(.22,1,.36,1)" }
      );
    }
  }

  /* -------------------------------------------------------------------------
     Progress
     ------------------------------------------------------------------------- */

  function updateProgress() {
    const count = state.revealed.size;
    const percent = TOTAL ? (count / TOTAL) * 100 : 0;

    els.headerCount.textContent = count;
    els.progressText.textContent = `${count} of ${TOTAL} revealed`;
    els.progressBar.style.width = `${percent}%`;
    els.headerBar.style.width = `${percent}%`;
    els.resetBtn.hidden = count === 0;
  }

  /* -------------------------------------------------------------------------
     Filters
     ------------------------------------------------------------------------- */

  function setType(type) {
    state.type = type;
    document.querySelectorAll(".seg-btn").forEach((button) => {
      const active = button.dataset.type === type;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setMood(mood) {
    state.mood = mood;
    document.querySelectorAll(".mood-chip").forEach((button) => {
      const active = button.dataset.mood === mood;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function applyFilters() {
    let visible = 0;

    cards.forEach((card) => {
      const typeMatch = state.type === "all" || card.dataset.type === state.type;
      const moodMatch = state.mood === "all" || card.dataset.moods.split(" ").includes(state.mood);
      const show = typeMatch && moodMatch;
      card.hidden = !show;

      if (show) {
        visible += 1;
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          card.classList.add("is-visible");
        }
      }
    });

    els.results.textContent = `Showing ${visible} ${visible === 1 ? "story" : "stories"}`;
    els.empty.hidden = visible !== 0;
    els.grid.hidden = visible === 0;
  }

  function resetFilters() {
    setType("all");
    setMood("all");
    applyFilters();
  }

  function watchlistAnchor() {
    const section = document.getElementById("watchlist");
    if (!section) return window.scrollY;
    return section.getBoundingClientRect().top + window.scrollY - 92;
  }

  function applyFiltersAndReturn() {
    const anchor = watchlistAnchor();
    const shouldReturn = window.scrollY > anchor + 60;
    applyFilters();
    if (shouldReturn) window.scrollTo({ top: anchor, behavior: "auto" });
  }

  /* -------------------------------------------------------------------------
     Surprise me
     ------------------------------------------------------------------------- */

  function surprise() {
    const visible = cards.filter((card) => !card.hidden);
    let pool = visible.filter((card) => !state.revealed.has(card.dataset.title));

    if (!pool.length) {
      pool = cards.filter((card) => !state.revealed.has(card.dataset.title));
      if (pool.length) {
        resetFilters();
      }
    }

    if (!pool.length) {
      showToast("All 60 revealed. Reset the mystery to play again.");
      els.resetBtn.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.12)" },
          { transform: "scale(1)" }
        ],
        { duration: 480, easing: "ease" }
      );
      return;
    }

    const card = randomFrom(pool);
    card.hidden = false;
    setRevealed(card, true, { celebrate: true, toast: true });
    scrollToCard(card);
  }

  /* -------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------- */

  function bindEvents() {
    document.querySelectorAll(".seg-btn").forEach((button) => {
      button.addEventListener("click", () => {
        setType(button.dataset.type);
        applyFiltersAndReturn();
      });
    });

    els.moodRow.addEventListener("click", (event) => {
      const button = event.target.closest(".mood-chip");
      if (!button) return;
      setMood(button.dataset.mood);
      applyFiltersAndReturn();
    });

    els.grid.addEventListener("click", (event) => {
      const button = event.target.closest(".reveal-btn");
      if (!button) return;
      const card = button.closest(".card");
      if (card) toggleCard(card);
    });

    // Soft spotlight follows the pointer inside each card (desktop only).
    if (window.matchMedia("(hover: hover)").matches) {
      let frame = 0;
      let pointerEvent = null;

      els.grid.addEventListener(
        "pointermove",
        (event) => {
          pointerEvent = event;
          if (frame) return;
          frame = window.requestAnimationFrame(() => {
            frame = 0;
            if (!pointerEvent) return;
            const card = pointerEvent.target.closest(".card");
            if (!card) return;
            const rect = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${pointerEvent.clientX - rect.left}px`);
            card.style.setProperty("--my", `${pointerEvent.clientY - rect.top}px`);
          });
        },
        { passive: true }
      );
    }

    document.getElementById("headerSurprise").addEventListener("click", surprise);
    document.getElementById("heroSurprise").addEventListener("click", surprise);
    document.getElementById("ctaSurprise").addEventListener("click", surprise);
    document.getElementById("emptySurprise").addEventListener("click", surprise);

    els.resetBtn.addEventListener("click", () => {
      const confirmed = window.confirm("Hide all 60 titles and start the mystery over?");
      if (!confirmed) return;

      cards.forEach((card) => {
        if (card.classList.contains("is-revealed")) {
          setRevealed(card, false, { toast: false });
        }
      });

      state.revealed.clear();
      saveRevealed();
      updateProgress();
      showToast("The mystery is back. All 60 titles hidden.");
    });

    els.toTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    });

    window.addEventListener(
      "scroll",
      () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? scrollTop / max : 0;

        els.scrollBar.style.width = `${ratio * 100}%`;
        els.header.classList.toggle("is-scrolled", scrollTop > 18);
        els.toTop.classList.toggle("is-show", scrollTop > 620);
      },
      { passive: true }
    );
  }

  /* -------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------- */

  renderMoodChips();
  render();
  bindEvents();
  applyFilters();
  updateProgress();
})();
