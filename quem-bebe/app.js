(() => {
  "use strict";

  const CATEGORIES = window.QUIZ_CATEGORIES || [];
  const QUESTIONS_PER_PLAYER = 3;
  const TURNS_PER_ROUND = QUESTIONS_PER_PLAYER * 2;
  const STORE_KEY = "quemBebe.v1";
  const LEVEL_LABEL = {
    easy: "Easy · Fácil",
    medium: "Medium · Médio",
    hard: "Difficult · Difícil",
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const catById = (id) => CATEGORIES.find((c) => c.id === id);
  const pcVar = (p) => `var(--p${p + 1})`;

  let state = null;

  /* ---------- Persistence ---------- */
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (s && s.v === 1 && Array.isArray(s.players)) return s;
    } catch (_) {}
    return null;
  }

  /* ---------- Decks ---------- */
  function shuffled(n) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function drawFrom(catId) {
    const cat = catById(catId);
    let pile = state.decks[catId];
    // Reshuffle when empty, or if the question file changed size since last save.
    if (!pile || !pile.length || pile.some((i) => i >= cat.questions.length)) {
      pile = shuffled(cat.questions.length);
    }
    const idx = pile.pop();
    state.decks[catId] = pile;
    return idx;
  }

  /* ---------- Game flow ---------- */
  const currentPlayer = () => state.turn % 2;

  function newGame(name1, name2) {
    state = {
      v: 1,
      players: [{ name: name1, score: 0 }, { name: name2, score: 0 }],
      round: 1,
      turn: 0,
      history: [[], []],
      decks: {},
      phase: "table",
      card: null,
    };
    save();
    showGame();
  }

  function pickDeck(catId) {
    state.card = { cat: catId, idx: drawFrom(catId), picked: null };
    state.phase = "card";
    save();
    render();
  }

  function answer(choice) {
    const c = state.card;
    if (!c || c.picked) return;
    const q = catById(c.cat).questions[c.idx];
    const ok = choice === q.answer;
    const p = currentPlayer();
    c.picked = choice;
    state.history[p].push({ cat: c.cat, ok });
    if (ok) state.players[p].score += 1;
    save();
    if (navigator.vibrate) navigator.vibrate(ok ? 30 : [60, 40, 60]);
    renderScoreboard(ok ? p : null);
    renderCard(true);
  }

  function next() {
    state.turn += 1;
    state.card = null;
    state.phase = state.turn >= TURNS_PER_ROUND ? "result" : "table";
    save();
    render();
  }

  function nextRound() {
    state.round += 1;
    state.turn = 0;
    state.history = [[], []];
    state.phase = "table";
    save();
    render();
  }

  /* ---------- Rendering ---------- */
  function showGame() {
    $("setup").hidden = true;
    $("game").hidden = false;
    render();
  }

  function render() {
    renderScoreboard();
    $("cardLayer").hidden = state.phase !== "card";
    $("resultLayer").hidden = state.phase !== "result";
    if (state.phase === "table") renderTable();
    if (state.phase === "card") renderCard(false);
    if (state.phase === "result") renderResult();
  }

  function renderScoreboard(bumpPlayer) {
    const active = state.phase === "result" ? -1 : currentPlayer();
    state.players.forEach((pl, p) => {
      const n = p + 1;
      $(`p${n}Name`).textContent = pl.name;
      const score = $(`p${n}Score`);
      score.textContent = pl.score;
      if (bumpPlayer === p) {
        score.classList.remove("bump");
        void score.offsetWidth;
        score.classList.add("bump");
      }
      $(`p${n}`).classList.toggle("is-active", p === active);
      const dots = $(`p${n}Dots`);
      dots.textContent = "";
      for (let i = 0; i < QUESTIONS_PER_PLAYER; i++) {
        const h = state.history[p][i];
        dots.appendChild(el("span", "dot" + (h ? (h.ok ? " ok" : " ko") : "")));
      }
    });
    $("roundNum").textContent = state.round;
  }

  function renderTable() {
    const p = currentPlayer();
    const who = $("turnWho");
    who.textContent = "";
    who.style.setProperty("--pc", pcVar(p));
    who.append(el("b", null, state.players[p].name), "’s turn · vez de ", el("b", null, state.players[p].name));

    // Each player must use different categories within a round (when there are enough of them).
    const used = new Set(state.history[p].map((h) => h.cat));
    const enforceUnique = CATEGORIES.length >= QUESTIONS_PER_PLAYER;

    const decks = $("decks");
    decks.textContent = "";
    CATEGORIES.forEach((cat) => {
      const b = el("button", "deck");
      b.type = "button";
      b.style.setProperty("--pc", pcVar(p));
      const isUsed = enforceUnique && used.has(cat.id);
      if (isUsed) b.classList.add("is-used");
      b.append(el("span", "deck-layer"), el("span", "deck-layer"));
      const face = el("span", "deck-face");
      face.append(el("span", "deck-icon", cat.icon), el("span", "deck-en", cat.en), el("span", "deck-pt", cat.pt));
      const left = (state.decks[cat.id] || []).length || cat.questions.length;
      face.append(el("span", "deck-count", `${left}`));
      b.append(face);
      b.setAttribute("aria-label", `${cat.en} / ${cat.pt}`);
      b.addEventListener("click", () => pickDeck(cat.id));
      decks.appendChild(b);
    });
  }

  function renderCard(answered) {
    const c = state.card;
    const cat = catById(c.cat);
    const q = cat.questions[c.idx];
    const p = currentPlayer();
    const card = $("card");

    card.style.setProperty("--pc", pcVar(p));
    if (!answered) {
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.animation = "";
      card.scrollTop = 0;
    }

    $("cardCat").textContent = `${cat.icon} ${cat.en} · ${cat.pt}`;
    const lvl = $("cardLevel");
    lvl.className = `chip chip--level ${q.level}`;
    lvl.textContent = LEVEL_LABEL[q.level] || q.level;
    const qNum = state.history[p].length + (c.picked ? 0 : 1);
    $("cardFor").textContent = `${state.players[p].name} · ${Math.min(qNum, QUESTIONS_PER_PLAYER)}/${QUESTIONS_PER_PLAYER}`;
    $("qEn").textContent = q.q[0];
    $("qPt").textContent = q.q[1];

    const list = $("options");
    list.textContent = "";
    list.classList.toggle("is-locked", !!c.picked);
    q.options.forEach(([en, pt], i) => {
      const n = i + 1;
      const li = el("li");
      const b = el("button", "opt");
      b.type = "button";
      const text = el("span", "opt-text");
      text.append(el("span", "opt-en", en));
      if (pt && pt.toLowerCase() !== en.toLowerCase()) text.append(el("span", "opt-pt", pt));
      let mark = "";
      if (c.picked) {
        if (n === q.answer) { b.classList.add("is-correct"); mark = "✓"; }
        else if (n === c.picked) { b.classList.add("is-wrong"); mark = "✗"; }
      }
      b.append(el("span", "opt-num", n), text, el("span", "opt-mark", mark));
      b.addEventListener("click", () => answer(n));
      li.appendChild(b);
      list.appendChild(li);
    });

    const fb = $("feedback");
    fb.hidden = !c.picked;
    if (c.picked) {
      const ok = c.picked === q.answer;
      const t = $("feedbackText");
      t.className = "feedback-text " + (ok ? "good" : "bad");
      t.textContent = ok ? "Correct! +1 point · Certo! +1 ponto 🎉" : "Wrong! No points · Errado! Sem pontos 😬";
      $("nextBtn").textContent = state.turn + 1 >= TURNS_PER_ROUND
        ? "Who drinks? · Quem bebe? 🍻"
        : `Next: ${state.players[1 - p].name} · Próximo →`;
      if (answered) setTimeout(() => fb.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  }

  function renderResult() {
    const pts = state.history.map((h) => h.filter((x) => x.ok).length);
    const [a, b] = pts;
    const names = state.players.map((pl) => pl.name);
    const drinkers = a === b ? [0, 1] : [a < b ? 0 : 1];

    $("resultRound").textContent = `Round ${state.round} · Rodada ${state.round}`;
    const who = $("resultWho");
    who.textContent = "";
    if (drinkers.length === 2) {
      who.append("It’s a tie, ", el("b", null, "both drink!"));
      who.querySelector("b").style.setProperty("--pc", "var(--gold)");
      $("resultPt").textContent = "Empate, os dois bebem!";
    } else {
      const d = drinkers[0];
      const nb = el("b", null, names[d]);
      nb.style.setProperty("--pc", pcVar(d));
      who.append(nb, " drinks!");
      $("resultPt").textContent = `${names[d]} bebe!`;
    }

    const table = $("resultTable");
    table.textContent = "";
    [0, 1].forEach((p) => {
      const col = el("div", `result-col p${p + 1}` + (drinkers.includes(p) ? " drinks" : ""));
      col.append(el("div", "result-col-name", (drinkers.includes(p) ? "🍷 " : "") + names[p]));
      const ptsEl = el("div", "result-col-pts", pts[p]);
      ptsEl.append(el("small", null, ` / ${QUESTIONS_PER_PLAYER}`));
      col.append(ptsEl);
      const ul = el("ul");
      state.history[p].forEach((h) => {
        const cat = catById(h.cat);
        const li = el("li");
        li.append(el("b", h.ok ? "ok" : "ko", h.ok ? "✓" : "✗"), `${cat ? cat.icon + " " + cat.en : h.cat}`);
        ul.append(li);
      });
      col.append(ul);
      table.append(col);
    });
  }

  /* ---------- Events ---------- */
  $("setupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const n1 = $("name1").value.trim() || "Player 1";
    const n2 = $("name2").value.trim() || "Player 2";
    document.activeElement && document.activeElement.blur();
    newGame(n1, n2);
  });
  $("nextBtn").addEventListener("click", next);
  $("nextRoundBtn").addEventListener("click", nextRound);
  $("menuBtn").addEventListener("click", () => { $("menuLayer").hidden = false; });
  $("resumeBtn").addEventListener("click", () => { $("menuLayer").hidden = true; });
  $("menuLayer").addEventListener("click", (e) => { if (e.target === $("menuLayer")) $("menuLayer").hidden = true; });
  $("newGameBtn").addEventListener("click", () => {
    if (!confirm("Start a new game? Scores will be reset.\nComeçar um novo jogo? Os pontos serão zerados.")) return;
    const names = state ? state.players.map((p) => p.name) : ["", ""];
    try { localStorage.removeItem(STORE_KEY); } catch (_) {}
    state = null;
    $("menuLayer").hidden = true;
    $("game").hidden = true;
    $("setup").hidden = false;
    $("name1").value = names[0];
    $("name2").value = names[1];
  });

  /* ---------- Boot ---------- */
  state = load();
  if (state && state.card && !catById(state.card.cat)) { state.card = null; state.phase = "table"; }
  if (state) showGame();
})();
