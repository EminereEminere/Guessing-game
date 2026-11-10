(() => {
  "use strict";

  const PACKS = window.PACKS;
  const packById = Object.fromEntries(PACKS.map(p => [p.id, p]));
  const STORAGE_KEY = "couples-cards:v2";
  const SKIPS = 5;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = id => document.getElementById(id);
  const els = {
    deck: $("deck"), deckTop: $("deckTop"), deckCount: $("deckCount"),
    stage: $("stage"), hint: $("hint"), hintMain: $("hintMain"), hintSub: $("hintSub"), hintTurn: $("hintTurn"),
    packBtn: $("packBtn"), packIcon: $("packIcon"), packName: $("packName"), packSub: $("packSub"),
    levelBtn: $("levelBtn"), levelMenu: $("levelMenu"), levelHeat: $("levelHeat"),
    skipBtn: $("skipBtn"), skipLabel: $("skipLabel"), skipWho: $("skipWho"), skipDots: $("skipDots"),
    score: $("score"), shareBtn: $("shareBtn"), menuBtn: $("menuBtn"),
    sheet: $("sheet"), sheetBody: $("sheetBody"), sheetBackdrop: $("sheetBackdrop"),
    setup: $("setup"), setupStep: $("setupStep"),
    drink: $("drink"), toast: $("toast"),
  };
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  // ---------- State ----------
  const freshState = () => ({
    lang: null,                 // "en" | "pt" | "bi"
    names: ["", ""],
    skips: [SKIPS, SKIPS],
    scores: [0, 0],
    turn: 0,                    // player who draws the next card
    pack: "questions",
    level: 0,
    room: "",
    decks: {},                  // "pack:level" -> { order, pos, cycle }
    seen: {},                   // one-time prompts
  });

  let state = freshState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") state = Object.assign(freshState(), saved);
  } catch (_) { /* storage unavailable: play without saving */ }
  if (!packById[state.pack]) state.pack = "questions";
  if (!(state.level >= 0 && state.level <= 2)) state.level = 0;

  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} };

  // ---------- Text helpers ----------
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : ""));
  const one = () => (state.lang === "pt" ? "pt" : "en");          // single language for short labels
  const t = (key, vars) => state.lang === "bi"
    ? `${fill(I18N.en[key], vars)} · ${fill(I18N.pt[key], vars)}`
    : fill(I18N[one()][key], vars);
  const t2 = (key, vars) => state.lang === "bi"
    ? [fill(I18N.en[key], vars), fill(I18N.pt[key], vars)]
    : [fill(I18N[one()][key], vars), ""];
  const tShort = (key, vars) => fill(I18N[one()][key], vars);     // one language even in bilingual mode
  const txt = o => (state.lang === "bi" ? (o.en === o.pt ? o.en : `${o.en} · ${o.pt}`) : o[one()]);
  const txtShort = o => o[one()];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const name = i => (state.names[i] || "").trim() || tShort("player", { n: i + 1 });

  // ---------- Decks (shuffled, no repeats, optional shared seed) ----------
  const hash = str => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const seeded = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const shuffle = (n, rnd) => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const deckKey = (packId, level) => `${packId}:${level}`;
  const makeOrder = (key, n, cycle) =>
    shuffle(n, state.room ? seeded(hash(`${state.room}|${key}|${cycle}`)) : Math.random);

  const deckState = (packId, level) => {
    const key = deckKey(packId, level);
    const n = packById[packId].levels[level].cards.length;
    let d = state.decks[key];
    if (!d || !Array.isArray(d.order) || d.order.length !== n || !(d.pos >= 0)) {
      d = state.decks[key] = { order: makeOrder(key, n, 0), pos: 0, cycle: 0 };
    }
    return d;
  };
  const remaining = () => {
    const d = deckState(state.pack, state.level);
    return d.order.length - d.pos;
  };
  const takeCard = (packId, level) => {
    const key = deckKey(packId, level);
    let d = deckState(packId, level);
    let reshuffled = false;
    if (d.pos >= d.order.length) {
      const last = d.order[d.order.length - 1];
      const cycle = (d.cycle || 0) + 1;
      const order = makeOrder(key, d.order.length, cycle);
      if (order[0] === last && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
      d = state.decks[key] = { order, pos: 0, cycle };
      reshuffled = true;
    }
    const idx = d.order[d.pos++];
    return { idx, reshuffled };
  };

  // ---------- Look & feel per pack/level ----------
  const pack = () => packById[state.pack];
  const isCandle = p => p.fx === "candle";
  const THEMES = ["normal", "bitSpicy", "spicy"];
  const THEME_COLORS = { normal: "#1b2433", bitSpicy: "#2c1622", spicy: "#1a0508", deep: "#160f0a" };
  const themeFor = () => (isCandle(pack()) ? "deep" : THEMES[state.level]);
  const fxFor = () => (isCandle(pack()) ? `candle${state.level + 1}` : ["none", "embers", "fire"][state.level]);

  const heatHTML = (p, level) => {
    const icon = isCandle(p) ? "🕯️" : "🌶️";
    return [0, 1, 2].map(i => `<span class="pep${i <= level ? "" : " off"}">${icon}</span>`).join("");
  };

  const heartSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 20.5c-4.9-3.3-8.5-6.4-8.5-10.3A4.7 4.7 0 0 1 8.2 5.5c1.6 0 3 .8 3.8 2.1.8-1.3 2.2-2.1 3.8-2.1a4.7 4.7 0 0 1 4.7 4.7c0 3.9-3.6 7-8.5 10.3z"/></svg>';
  const checkSVG = '<svg class="check" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- Timers on cards that mention a duration ----------
  const WORDS = { one: 1, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, sixty: 60 };
  const durationOf = en => {
    const s = en.toLowerCase();
    let m = s.match(/\b(\d+)[- ]seconds?\b/);
    if (m) return +m[1];
    m = s.match(/\b(one|five|ten|fifteen|twenty|thirty|sixty)[- ]seconds?\b/);
    if (m) return WORDS[m[1]];
    if (/\b(one|a)[- ](full )?minute\b/.test(s)) return 60;
    return 0;
  };

  // ---------- Current card ----------
  let cur = null;          // { packId, level, idx, player, done, el }
  let timer = null;

  const stopTimer = () => { if (timer) { clearInterval(timer.id); timer = null; } };

  const buildCard = c => {
    const p = packById[c.packId];
    const lvl = p.levels[c.level];
    const [en, pt] = lvl.cards[c.idx];
    const main = state.lang === "pt" ? pt : en;
    const second = state.lang === "bi" ? pt : "";
    const guess = p.type === "guess";
    const turnLine = guess
      ? t("guessLine", { guesser: name(c.player), answerer: name(1 - c.player) })
      : t("turn", { name: name(c.player) });
    const secs = durationOf(en);

    let foot = `<span class="type-label">${esc(p.icon)} ${esc(txtShort(p.name))}</span>`;
    if (guess) {
      foot += c.result
        ? `<span class="result">${esc(c.result)}</span>`
        : `<span class="guess-btns">
             <button class="card-btn right" type="button" data-act="right">✓ ${esc(tShort("right"))}</button>
             <button class="card-btn wrong" type="button" data-act="wrong">✗ ${esc(tShort("wrong"))}</button>
           </span>`;
    } else if (secs) {
      foot += `<button class="card-btn solid" type="button" data-act="timer" data-secs="${secs}">▶ ${esc(tShort("timer", { s: secs }))}</button>`;
    }

    const card = document.createElement("article");
    card.className = "card current";
    card.innerHTML = `
      <div class="face front">
        <div class="card-top">
          <span class="chip"><span class="heat">${heatHTML(p, c.level)}</span>${esc(txtShort(lvl.name))}</span>
          <span class="num">#${c.idx + 1}</span>
        </div>
        <div class="turn-line">${esc(turnLine)}</div>
        <div class="q">
          <p class="main" lang="${state.lang === "pt" ? "pt-BR" : "en"}">${esc(main)}</p>
          ${second ? `<div class="divider">${heartSVG}</div><p class="second" lang="pt-BR">${esc(second)}</p>` : ""}
        </div>
        <div class="card-foot">${foot}</div>
      </div>
      <div class="face back" aria-hidden="true"></div>`;
    card.addEventListener("click", onCardClick);
    return card;
  };

  // Shrink text until it fits inside the card.
  const fitText = card => {
    const q = card.querySelector(".q");
    if (!q) return;
    const single = state.lang !== "bi";
    let size = Math.min(card.clientWidth * (single ? 0.1 : 0.088), single ? 46 : 40);
    q.style.fontSize = size + "px";
    while (q.scrollHeight > q.clientHeight + 1 && size > 12) {
      size -= 1;
      q.style.fontSize = size + "px";
    }
  };

  const dismissCurrent = (direction = 1) => {
    stopTimer();
    FX.setCard(null);
    const old = els.stage.querySelector(".card.current");
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

  // Re-render the current card in place (after a language or name change).
  const rerenderCard = () => {
    if (!cur || !cur.el) return;
    stopTimer();
    const fresh = buildCard(cur);
    cur.el.replaceWith(fresh);
    cur.el = fresh;
    fitText(fresh);
    FX.setCard(fresh);
  };

  let busy = false;
  const draw = () => {
    if (busy) return;
    busy = true;
    closeLevelMenu();

    const { idx, reshuffled } = takeCard(state.pack, state.level);
    if (reshuffled) toast(t("reshuffled") + " 🔀");
    const player = state.turn;
    state.turn = 1 - player;
    save();

    dismissCurrent(1);
    els.hint.classList.add("hidden");
    els.deck.classList.remove("pulse");

    cur = { packId: state.pack, level: state.level, idx, player, done: false };
    const card = buildCard(cur);
    cur.el = card;
    els.stage.appendChild(card);
    fitText(card);
    FX.setCard(card);

    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (_) {} }

    // Fly from the deck in the top bar to the center, flipping face-up on the way.
    const d = els.deckTop.getBoundingClientRect();
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

    if (!reduceMotion) {
      els.deckTop.animate(
        [{ transform: "none" }, { transform: "translateY(-6px) rotate(-6deg)" }, { transform: "none" }],
        { duration: 300, easing: "ease-out" }
      );
    }

    updateDeckUI();
    renderBar();
    const done = () => { busy = false; FX.burst(); };
    anim.finished.then(done, done);
  };

  // ---------- Card actions: Know-Me scoring, timers ----------
  function onCardClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn || !cur || btn.closest(".card") !== cur.el) return;
    const act = btn.dataset.act;
    if (act === "right" || act === "wrong") {
      if (cur.done) return;
      cur.done = true;
      if (act === "right") {
        state.scores[cur.player]++;
        cur.result = tShort("pointFor", { name: name(cur.player) }) + " 🎉";
        bumpScore();
      } else {
        cur.result = tShort("noPoint");
      }
      save();
      rerenderCard();
      renderBar();
    } else if (act === "timer") {
      startTimer(btn, +btn.dataset.secs);
    }
  }

  const startTimer = (btn, secs) => {
    stopTimer();
    const R = 15, C = 2 * Math.PI * R;
    const wrap = document.createElement("span");
    wrap.className = "timer";
    wrap.innerHTML = `<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="track" cx="18" cy="18" r="${R}" fill="none" stroke-width="4"/><circle class="prog" cx="18" cy="18" r="${R}" fill="none" stroke-width="4" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><span class="secs">${secs}s</span>`;
    btn.replaceWith(wrap);
    const prog = wrap.querySelector(".prog"), label = wrap.querySelector(".secs");
    const end = Date.now() + secs * 1000;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      prog.style.strokeDashoffset = String(C * (1 - left / (secs * 1000)));
      label.textContent = Math.ceil(left / 1000) + "s";
      if (left <= 0) {
        stopTimer();
        wrap.classList.add("done");
        label.textContent = tShort("timeUp");
        if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch (_) {} }
      }
    };
    timer = { id: setInterval(tick, 200) };
    tick();
  };

  // ---------- Skip = drink ----------
  const skip = () => {
    if (!cur || cur.done) return;
    const p = cur.player;
    if (state.skips[p] <= 0) return;
    state.skips[p]--;
    cur.done = true;
    save();
    showDrink(p);
    dismissCurrent(-1);
    cur = null;
    showHint();
    renderBar();
  };

  const showDrink = p => {
    const [main, sub] = t2("drinks", { name: name(p) });
    const left = state.skips[p];
    els.drink.innerHTML = `<div class="drink-inner"><div class="drink-emoji">🍷</div>
      <div class="drink-text">${esc(main)}</div>
      ${sub ? `<div class="drink-sub">${esc(sub)}</div>` : ""}
      <div class="dots">${dotsHTML(left)}</div></div>`;
    els.drink.classList.remove("show");
    void els.drink.offsetWidth;
    els.drink.classList.add("show");
    if (navigator.vibrate) { try { navigator.vibrate([30, 60, 30]); } catch (_) {} }
  };

  const dotsHTML = left => Array.from({ length: SKIPS }, (_, i) => `<i class="${i < left ? "" : "used"}"></i>`).join("");

  // ---------- UI rendering ----------
  const updateDeckUI = () => {
    const n = remaining();
    els.deckCount.textContent = n;
    els.deck.classList.toggle("is-empty", n === 0);
    els.deck.setAttribute("aria-label", `Draw a card (${n} left)`);
  };

  const showHint = () => {
    const [main, sub] = t2("tapDeck");
    els.hintMain.textContent = main;
    els.hintSub.textContent = sub;
    els.hintTurn.textContent = t("turn", { name: name(state.turn) });
    els.hint.classList.remove("hidden");
    els.deck.classList.add("pulse");
  };

  const renderBar = () => {
    const p = cur && !cur.done ? cur.player : (cur ? cur.player : state.turn);
    const knowMe = pack().type === "guess";
    const left = state.skips[p];
    els.skipLabel.textContent = left <= 0
      ? tShort("noSkips")
      : (knowMe || state.lang === "bi" ? t("skipShort") : t("skip"));
    els.skipWho.textContent = name(p);
    els.skipDots.innerHTML = dotsHTML(left);
    els.skipBtn.disabled = !cur || cur.done || left <= 0;
    els.skipBtn.setAttribute("aria-label", `${t("skip")} — ${name(p)}: ${left}/${SKIPS}`);

    els.score.hidden = !knowMe;
    if (knowMe) {
      els.score.innerHTML = `<small>${esc(tShort("score"))}</small><b>${state.scores[0]} – ${state.scores[1]}</b>`;
      els.score.title = `${name(0)} ${state.scores[0]} – ${state.scores[1]} ${name(1)}`;
    }
    els.shareBtn.setAttribute("aria-label", tShort("share"));
    els.menuBtn.setAttribute("aria-label", tShort("menu"));
  };

  const bumpScore = () => {
    els.score.classList.remove("bump");
    void els.score.offsetWidth;
    els.score.classList.add("bump");
  };

  const renderTop = () => {
    const p = pack();
    const lvl = p.levels[state.level];
    els.packIcon.textContent = p.icon;
    els.packName.textContent = txtShort(p.name);
    let sub = txtShort(lvl.name);
    if (lvl.subtitle) sub += " · " + txtShort(lvl.subtitle);
    if (state.room) sub += " · 🔗 " + state.room;
    els.packSub.textContent = sub;
    els.levelHeat.innerHTML = heatHTML(p, state.level);
    els.levelBtn.setAttribute("aria-label", txtShort(lvl.name));
    els.levelMenu.innerHTML = p.levels.map((l, i) => `
      <li><button class="level-option" type="button" role="option" data-level="${i}" aria-selected="${i === state.level}">
        <span class="heat" aria-hidden="true">${heatHTML(p, i)}</span>
        <span class="names"><b>${esc(txtShort(l.name))}</b><small>${esc(l.subtitle ? txt(l.subtitle) : (state.lang === "bi" ? l.name.pt : ""))}</small></span>
        ${checkSVG}
      </button></li>`).join("");
  };

  const applyTheme = () => {
    const theme = themeFor();
    document.body.dataset.theme = theme;
    document.body.dataset.fx = fxFor();
    if (themeMeta) themeMeta.content = THEME_COLORS[theme];
    document.documentElement.lang = state.lang === "pt" ? "pt-BR" : "en";
    FX.set(fxFor());
  };

  const renderAll = () => {
    applyTheme();
    renderTop();
    updateDeckUI();
    renderBar();
    if (!cur) showHint();
  };

  let toastTimer;
  const toast = msg => {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
  };

  // ---------- Level menu ----------
  const openLevelMenu = () => { els.levelMenu.hidden = false; els.levelBtn.setAttribute("aria-expanded", "true"); };
  function closeLevelMenu() { els.levelMenu.hidden = true; els.levelBtn.setAttribute("aria-expanded", "false"); }

  els.levelBtn.addEventListener("click", e => {
    e.stopPropagation();
    els.levelMenu.hidden ? openLevelMenu() : closeLevelMenu();
  });
  els.levelMenu.addEventListener("click", e => {
    const opt = e.target.closest(".level-option");
    if (!opt) return;
    e.stopPropagation();
    closeLevelMenu();
    const level = +opt.dataset.level;
    if (level === state.level) return;
    state.level = level;
    save();
    switchedDeck(-1);
    toast(txt(pack().levels[level].name));
  });
  document.addEventListener("click", e => {
    if (!els.levelMenu.hidden && !e.target.closest(".level-wrap")) closeLevelMenu();
  });

  const switchedDeck = dir => {
    dismissCurrent(dir);
    cur = null;
    renderAll();
  };

  // ---------- Sheets ----------
  let sheetClose = null;
  const openSheet = (html, onMount, onClose) => {
    closeLevelMenu();
    els.sheetBody.innerHTML = html;
    els.sheet.hidden = false;
    els.sheetBackdrop.hidden = false;
    sheetClose = onClose || null;
    if (onMount) onMount(els.sheetBody);
  };
  const closeSheet = () => {
    if (els.sheet.hidden) return;
    els.sheet.hidden = true;
    els.sheetBackdrop.hidden = true;
    els.sheetBody.innerHTML = "";
    const cb = sheetClose;
    sheetClose = null;
    if (cb) cb();
  };
  els.sheetBackdrop.addEventListener("click", closeSheet);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeLevelMenu(); closeSheet(); }
  });

  const twoLine = (key, vars) => {
    const [a, b] = t2(key, vars);
    return `${esc(a)}${b ? `<small>${esc(b)}</small>` : ""}`;
  };

  // Pack picker
  const openPacks = () => {
    openSheet(`
      <h2>${esc(t("packs"))}</h2>
      <ul class="list" style="margin-top:14px">${PACKS.map(p => `
        <li><button class="row" type="button" data-pack="${p.id}" aria-selected="${p.id === state.pack}">
          <span class="ico" aria-hidden="true">${p.icon}</span>
          <span class="names"><b>${esc(txt(p.name))}</b><small>${esc(txt(PACK_INFO[p.id]))}</small></span>
          ${checkSVG}
        </button></li>`).join("")}
      </ul>`, body => {
      body.addEventListener("click", e => {
        const row = e.target.closest("[data-pack]");
        if (!row) return;
        closeSheet();
        choosePack(row.dataset.pack);
      });
    });
  };

  const choosePack = id => {
    if (id === state.pack) return;
    state.pack = id;
    save();
    switchedDeck(1);
    toast(txt(pack().name));
    // One-time helpers for packs that need explaining.
    if (id === "knowMe" && !state.seen.knowMe) {
      state.seen.knowMe = true; save();
      setTimeout(openRules, 350);
    } else if (id === "longDistance" && !state.seen.longDistance && !state.room) {
      state.seen.longDistance = true; save();
      setTimeout(openRoom, 350);
    }
  };

  const openRules = () => {
    const p = packById.knowMe;
    const [a, b] = state.lang === "bi" ? [p.rules.en, p.rules.pt] : [p.rules[one()], ""];
    const [s1, s2] = t2("skipsInfo");
    openSheet(`
      <h2>${esc(txtShort(p.name))}</h2>
      <p>${esc(t("howToPlay"))}</p>
      <div class="rules-box">${esc(a)}${b ? `<small>${esc(b)}</small>` : ""}</div>
      <div class="rules-box">${esc(s1)}${s2 ? `<small>${esc(s2)}</small>` : ""}</div>
      <div class="btns"><button class="btn primary" type="button" data-close>${esc(t("gotIt"))}</button></div>`,
      body => body.querySelector("[data-close]").addEventListener("click", closeSheet));
  };

  // Main menu
  const openMenu = () => {
    const rows = [
      ["lang", "🌐", t("language"), { en: "English", pt: "Português (Brasil)", bi: "English + Português" }[state.lang]],
      ["players", "👥", t("players"), `${name(0)} & ${name(1)}`],
      ["new", "🔄", t("newGame"), t("skipsInfo")],
      ["room", "🔗", t("room"), state.room ? t("roomOn", { code: state.room }) : ""],
      ["share", "💌", t("share"), t("shareText")],
    ];
    if (pack().type === "guess") rows.push(["rules", "❓", t("howToPlay"), txtShort(pack().name)]);
    openSheet(`
      <h2>Just Us</h2>
      <ul class="list" style="margin-top:14px">${rows.map(([k, ico, title, sub]) => `
        <li><button class="row" type="button" data-menu="${k}">
          <span class="ico" aria-hidden="true">${ico}</span>
          <span class="names"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>
        </button></li>`).join("")}
      </ul>
      <div class="btns"><button class="btn" type="button" data-close>${esc(t("close"))}</button></div>`, body => {
      body.addEventListener("click", e => {
        if (e.target.closest("[data-close]")) return closeSheet();
        const row = e.target.closest("[data-menu]");
        if (!row) return;
        const k = row.dataset.menu;
        if (k === "lang") openLanguage();
        else if (k === "players") openPlayers();
        else if (k === "new") { closeSheet(); newGame(); }
        else if (k === "room") openRoom();
        else if (k === "share") { closeSheet(); share(); }
        else if (k === "rules") openRules();
      });
    });
  };

  const LANG_CHOICES = [
    { id: "en", flag: "🇬🇧", title: "English", sub: "All cards in English" },
    { id: "pt", flag: "🇧🇷", title: "Português (Brasil)", sub: "Todas as cartas em português" },
    { id: "bi", flag: "🇬🇧🇧🇷", title: "Bilingual · Bilíngue", sub: "English + Português" },
  ];
  const langButtons = () => `<div class="lang-choices">${LANG_CHOICES.map(c => `
    <button class="lang-choice" type="button" data-lang="${c.id}" aria-selected="${c.id === state.lang}">
      <span class="flag" aria-hidden="true">${c.flag}</span>
      <span><b>${c.title}</b><small>${c.sub}</small></span>
    </button>`).join("")}</div>`;

  const setLang = lang => {
    state.lang = lang;
    save();
    renderAll();
    rerenderCard();
  };

  const openLanguage = () => {
    openSheet(`<h2>Language · Idioma</h2><p></p>${langButtons()}`, body => {
      body.addEventListener("click", e => {
        const b = e.target.closest("[data-lang]");
        if (!b) return;
        closeSheet();
        setLang(b.dataset.lang);
      });
    });
  };

  const namesForm = () => `
    <div class="field"><input class="input" id="name0" maxlength="20" autocomplete="off" value="${esc(state.names[0])}" placeholder="${esc(tShort("namePh", { n: 1 }))}"></div>
    <div class="field"><input class="input" id="name1" maxlength="20" autocomplete="off" value="${esc(state.names[1])}" placeholder="${esc(tShort("namePh", { n: 2 }))}"></div>`;
  const readNames = root => {
    state.names = [root.querySelector("#name0").value.trim(), root.querySelector("#name1").value.trim()];
    save();
  };

  const openPlayers = () => {
    const [h, hs] = t2("whoPlays");
    openSheet(`<h2>${esc(h)}</h2><p>${esc(hs || t("namesHint"))}</p>${namesForm()}
      <div class="btns"><button class="btn primary" type="button" data-save>${esc(t("save"))}</button></div>`, body => {
      body.querySelector("[data-save]").addEventListener("click", () => {
        readNames(body);
        closeSheet();
        renderAll();
        rerenderCard();
      });
    });
  };

  const openRoom = () => {
    const [intro, introPt] = t2("roomIntro");
    openSheet(`
      <h2>${esc(t("room"))}</h2>
      <p>${esc(intro)}${introPt ? `<br><br>${esc(introPt)}` : ""}</p>
      <div class="field"><input class="input" id="roomCode" maxlength="16" autocomplete="off" autocapitalize="characters" spellcheck="false"
        value="${esc(state.room)}" placeholder="${esc(tShort("roomPlaceholder"))}"></div>
      <div class="btns">
        ${state.room
          ? `<button class="btn" type="button" data-leave>${esc(tShort("roomLeave"))}</button>`
          : `<button class="btn" type="button" data-close>${esc(tShort("notNow"))}</button>`}
        <button class="btn primary" type="button" data-join>${esc(tShort("roomJoin"))}</button>
      </div>`, body => {
      const input = body.querySelector("#roomCode");
      body.addEventListener("click", e => {
        if (e.target.closest("[data-close]")) return closeSheet();
        if (e.target.closest("[data-leave]")) { closeSheet(); setRoom(""); return; }
        if (e.target.closest("[data-join]")) {
          const code = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
          if (!code) { input.focus(); return; }
          closeSheet();
          setRoom(code);
        }
      });
    });
  };

  const setRoom = code => {
    state.room = code;
    state.decks = {};   // both phones start every deck from the same shared order
    state.turn = 0;
    save();
    switchedDeck(1);
    toast(code ? t("roomOn", { code }) : t("roomOff"));
  };

  const newGame = () => {
    state.skips = [SKIPS, SKIPS];
    state.scores = [0, 0];
    state.turn = 0;
    save();
    switchedDeck(-1);
    toast(t("newGameDone"));
  };

  // ---------- Share ----------
  const share = async () => {
    const url = location.origin + location.pathname;
    const text = t("shareText");
    if (navigator.share) {
      try { await navigator.share({ title: "Just Us", text, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast(t("linkCopied"));
    } catch (_) {
      window.prompt(t("share"), url);
    }
  };

  // ---------- First-launch setup ----------
  const runSetup = () => {
    els.setup.hidden = false;
    const step1 = () => {
      els.setupStep.innerHTML = `<h2>Choose your language</h2><p>Escolha o idioma</p>${langButtons()}`;
      els.setupStep.onclick = e => {
        const b = e.target.closest("[data-lang]");
        if (!b) return;
        state.lang = b.dataset.lang;
        save();
        step2();
      };
    };
    const step2 = () => {
      const [h, hs] = t2("whoPlays");
      const [n, ns] = t2("namesHint");
      const [k, ks] = t2("skipsInfo");
      els.setupStep.innerHTML = `
        <h2>${esc(h)}</h2>${hs ? `<p style="margin:0">${esc(hs)}</p>` : ""}
        <p>${esc(n)}${ns ? `<br>${esc(ns)}` : ""}</p>
        ${namesForm()}
        <p style="margin-top:8px">${esc(k)}${ks ? `<br>${esc(ks)}` : ""}</p>
        <div class="btns">
          <button class="btn" type="button" data-skip>${esc(tShort("skipStep"))}</button>
          <button class="btn primary" type="button" data-start>${esc(tShort("start"))}</button>
        </div>`;
      els.setupStep.onclick = e => {
        if (e.target.closest("[data-start]")) readNames(els.setupStep);
        else if (!e.target.closest("[data-skip]")) return;
        finish();
      };
    };
    const finish = () => {
      els.setupStep.onclick = null;
      els.setup.hidden = true;
      renderAll();
    };
    step1();
  };

  // ---------- Wire up ----------
  els.deck.addEventListener("click", draw);
  els.hint.addEventListener("click", draw);
  els.skipBtn.addEventListener("click", skip);
  els.shareBtn.addEventListener("click", share);
  els.menuBtn.addEventListener("click", openMenu);
  els.packBtn.addEventListener("click", openPacks);

  let resizeRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { if (cur && cur.el) fitText(cur.el); });
  });
  document.addEventListener("gesturestart", e => e.preventDefault());
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (cur && cur.el) fitText(cur.el); });
  }

  if (!state.lang) {
    state.lang = "bi";      // temporary, so the screen behind the setup renders
    renderAll();
    state.lang = null;
    runSetup();
  } else {
    renderAll();
  }

  // Exposed for automated checks only.
  window.__game = { state: () => state, current: () => cur, durationOf };
})();
