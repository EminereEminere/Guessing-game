(() => {
  "use strict";

  const LEVELS = [
    { key: "normal",   en: "Normal",      pt: "Normal",           heat: 1, theme: "#1b2433" },
    { key: "bitSpicy", en: "A bit spicy", pt: "Um pouco picante", heat: 2, theme: "#2c1622" },
    { key: "spicy",    en: "Spicy",       pt: "Picante",          heat: 3, theme: "#1a0508" },
  ];
  const levelByKey = Object.fromEntries(LEVELS.map(l => [l.key, l]));
  const STORAGE_KEY = "couples-cards:v1";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = id => document.getElementById(id);
  const deckEl = $("deck"), deckTop = $("deckTop"), deckCount = $("deckCount");
  const stage = $("stage"), hint = $("hint"), toastEl = $("toast");
  const levelBtn = $("levelBtn"), levelMenu = $("levelMenu"), levelHeat = $("levelHeat"), levelSub = $("levelSub");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  // ---------- State (persisted per level: a shuffled order + position) ----------
  let state = { level: "normal", decks: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && levelByKey[saved.level]) state = { level: saved.level, decks: saved.decks || {} };
  } catch (_) { /* storage unavailable — play without persistence */ }

  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} };

  const shuffle = n => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const deckState = key => {
    const total = window.DECKS[key].length;
    let d = state.decks[key];
    const valid = d && Array.isArray(d.order) && d.order.length === total && d.pos >= 0;
    if (!valid) d = state.decks[key] = { order: shuffle(total), pos: 0 };
    return d;
  };

  const remaining = key => {
    const d = deckState(key);
    return d.order.length - d.pos;
  };

  // Returns the next question index; reshuffles (no immediate repeat) when the deck runs out.
  const takeCard = key => {
    let d = deckState(key);
    let reshuffled = false;
    if (d.pos >= d.order.length) {
      const last = d.order[d.order.length - 1];
      const order = shuffle(d.order.length);
      if (order[0] === last && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
      d = state.decks[key] = { order, pos: 0 };
      reshuffled = true;
    }
    const idx = d.order[d.pos++];
    save();
    return { idx, reshuffled };
  };

  // ---------- Rendering helpers ----------
  const heatHTML = n =>
    [1, 2, 3].map(i => `<span class="pep${i <= n ? "" : " off"}">🌶️</span>`).join("");

  const heartSVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20.5c-4.9-3.3-8.5-6.4-8.5-10.3A4.7 4.7 0 0 1 8.2 5.5c1.6 0 3 .8 3.8 2.1.8-1.3 2.2-2.1 3.8-2.1a4.7 4.7 0 0 1 4.7 4.7c0 3.9-3.6 7-8.5 10.3z"/></svg>';

  const escapeHTML = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const buildCard = (levelKey, idx) => {
    const lvl = levelByKey[levelKey];
    const [en, pt] = window.DECKS[levelKey][idx];
    const card = document.createElement("article");
    card.className = "card current";
    card.setAttribute("aria-live", "polite");
    card.innerHTML = `
      <div class="face front">
        <div class="card-top">
          <span class="chip"><span class="heat">${heatHTML(lvl.heat)}</span>${escapeHTML(lvl.en)}</span>
          <span class="num">#${idx + 1}</span>
        </div>
        <div class="q">
          <p class="en" lang="en">${escapeHTML(en)}</p>
          <div class="divider">${heartSVG}</div>
          <p class="pt" lang="pt-BR">${escapeHTML(pt)}</p>
        </div>
        <div class="card-foot"><span>English</span><span>Português</span></div>
      </div>
      <div class="face back" aria-hidden="true"></div>`;
    return card;
  };

  // Shrink text until it fits inside the card.
  const fitText = card => {
    const q = card.querySelector(".q");
    if (!q) return;
    let size = Math.min(card.clientWidth * 0.088, 40);
    const min = 13;
    q.style.fontSize = size + "px";
    while (q.scrollHeight > q.clientHeight + 1 && size > min) {
      size -= 1;
      q.style.fontSize = size + "px";
    }
  };

  const updateDeckUI = () => {
    const n = remaining(state.level);
    deckCount.textContent = n;
    deckEl.classList.toggle("is-empty", n === 0);
    deckEl.setAttribute("aria-label", `Draw a card (${n} left)`);
  };

  const applyLevelUI = () => {
    const lvl = levelByKey[state.level];
    document.body.dataset.level = lvl.key;
    levelHeat.innerHTML = heatHTML(lvl.heat);
    levelSub.textContent = lvl.en;
    levelBtn.setAttribute("aria-label", `Spicy level: ${lvl.en}`);
    if (themeMeta) themeMeta.content = lvl.theme;
    levelMenu.querySelectorAll(".level-option").forEach(o =>
      o.setAttribute("aria-selected", String(o.dataset.level === lvl.key)));
    updateDeckUI();
  };

  let toastTimer;
  const toast = msg => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  };

  // ---------- Animations ----------
  const dismissCurrent = (direction = 1) => {
    const old = stage.querySelector(".card.current");
    if (!old) return;
    old.classList.remove("current");
    old.style.pointerEvents = "none";
    const anim = old.animate(
      reduceMotion
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { transform: "none", opacity: 1 },
            { transform: `translate(${direction * 70}vw, 18vh) rotate(${direction * 24}deg)`, opacity: 0 },
          ],
      { duration: reduceMotion ? 200 : 520, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
    );
    anim.finished.then(() => old.remove(), () => old.remove());
  };

  let busy = false;
  const draw = () => {
    if (busy) return;
    busy = true;
    closeMenu();

    const levelKey = state.level;
    const { idx, reshuffled } = takeCard(levelKey);
    if (reshuffled) toast("Deck reshuffled · Baralho embaralhado 🔀");

    dismissCurrent(1);
    hint.classList.add("hidden");
    deckEl.classList.remove("pulse");

    const card = buildCard(levelKey, idx);
    stage.appendChild(card);
    fitText(card);

    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }

    // Fly from the deck in the top bar to the center, flipping face-up on the way.
    const d = deckTop.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const dx = d.left + d.width / 2 - (c.left + c.width / 2);
    const dy = d.top + d.height / 2 - (c.top + c.height / 2);
    const s = d.width / c.width;

    const anim = reduceMotion
      ? card.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }],
          { duration: 220, easing: "ease-out" })
      : card.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotateY(180deg) rotateZ(-8deg)`, offset: 0, easing: "cubic-bezier(.3,.1,.5,1)" },
            { transform: `translate(${dx * 0.35}px, ${dy * 0.35 + 30}px) scale(${0.55 + s * 0.3}) rotateY(95deg) rotateZ(-4deg)`, offset: 0.4, easing: "cubic-bezier(.2,.6,.35,1)" },
            { transform: "translate(0, -10px) scale(1.03) rotateY(-6deg) rotateZ(0.6deg)", offset: 0.8, easing: "ease-in-out" },
            { transform: "none", offset: 1 },
          ],
          { duration: 900, easing: "linear" }
        );

    // Little "lift" on the deck so the tap feels physical.
    if (!reduceMotion) {
      deckTop.animate(
        [{ transform: "none" }, { transform: "translateY(-6px) rotate(-6deg)" }, { transform: "none" }],
        { duration: 300, easing: "ease-out" }
      );
    }

    updateDeckUI();
    const done = () => { busy = false; };
    anim.finished.then(done, done);
  };

  // ---------- Level menu ----------
  levelMenu.innerHTML = LEVELS.map(l => `
    <li>
      <button class="level-option" type="button" role="option" data-level="${l.key}" aria-selected="false">
        <span class="heat" aria-hidden="true">${heatHTML(l.heat)}</span>
        <span class="level-names"><b>${l.en}</b><small>${l.pt}</small></span>
        <svg class="check" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </li>`).join("");

  const openMenu = () => { levelMenu.hidden = false; levelBtn.setAttribute("aria-expanded", "true"); };
  function closeMenu() { levelMenu.hidden = true; levelBtn.setAttribute("aria-expanded", "false"); }

  levelBtn.addEventListener("click", e => {
    e.stopPropagation();
    levelMenu.hidden ? openMenu() : closeMenu();
  });

  levelMenu.addEventListener("click", e => {
    const opt = e.target.closest(".level-option");
    if (!opt) return;
    e.stopPropagation();
    closeMenu();
    const key = opt.dataset.level;
    if (key === state.level) return;
    state.level = key;
    save();
    dismissCurrent(-1);
    applyLevelUI();
    hint.classList.remove("hidden");
    deckEl.classList.add("pulse");
    toast(`${levelByKey[key].en} · ${levelByKey[key].pt}`);
  });

  document.addEventListener("click", e => {
    if (!levelMenu.hidden && !e.target.closest(".level-wrap")) closeMenu();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeMenu();
  });

  // ---------- Wire up ----------
  deckEl.addEventListener("click", draw);
  hint.addEventListener("click", draw);

  let resizeRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      const c = stage.querySelector(".card.current");
      if (c) fitText(c);
    });
  });

  // Prevent iOS pinch-zoom / double-tap zoom getting in the way of the game.
  document.addEventListener("gesturestart", e => e.preventDefault());

  applyLevelUI();
  deckEl.classList.add("pulse");

  // Re-fit once web fonts load (metrics change).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      const c = stage.querySelector(".card.current");
      if (c) fitText(c);
    });
  }
})();
