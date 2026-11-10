// Background effects on one full-screen canvas behind the card.
// Modes: "none", "embers", "fire", "candle1", "candle2", "candle3".
window.FX = (() => {
  "use strict";
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let mode = "none", W = 0, H = 0, dpr = 1, raf = 0, last = 0, t = 0;
  let cardEl = null;
  const parts = [];
  const MAX = 520;

  // Pre-rendered glow sprites (radial gradients) for fast additive drawing.
  const sprite = (inner, mid) => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d").createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, mid);
    g.addColorStop(1, "rgba(0,0,0,0)");
    const x = c.getContext("2d");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  };
  const SPR = {
    hot: sprite("rgba(255,250,210,1)", "rgba(255,200,80,.55)"),
    orange: sprite("rgba(255,190,90,1)", "rgba(255,110,30,.5)"),
    red: sprite("rgba(255,110,50,.9)", "rgba(200,30,20,.4)"),
    candle: sprite("rgba(255,230,170,1)", "rgba(255,170,70,.5)"),
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  const add = p => { if (parts.length < MAX) parts.push(p); };

  // ---- emitters ----
  const emitEmber = (x, y, fast) => add({
    kind: "ember", x, y,
    vx: rand(-12, 12), vy: fast ? rand(-160, -70) : rand(-45, -18),
    size: fast ? rand(6, 12) : rand(10, 22),
    life: 0, max: fast ? rand(1.2, 2.6) : rand(4, 8),
    wob: rand(0, Math.PI * 2), wobS: rand(1, 2.4),
  });

  const emitFlame = (x, y, scale, vyMul = 1) => add({
    kind: "flame", x, y,
    vx: rand(-14, 14), vy: rand(-170, -90) * vyMul,
    size: rand(34, 70) * scale,
    life: 0, max: rand(0.55, 1.1),
  });

  const cardRect = () => {
    if (!cardEl || !cardEl.isConnected) return null;
    const r = cardEl.getBoundingClientRect();
    return r.width > 20 ? r : null;
  };

  // ---- per-mode spawning ----
  const spawn = dt => {
    if (mode === "embers") {
      const rate = 26 * Math.max(0.8, W / 400);
      if (Math.random() < dt * rate) emitEmber(rand(0, W), rand(H * 0.55, H + 10), false);
      if (Math.random() < dt * 4) emitEmber(rand(0, W), H + 10, true);
    } else if (mode === "fire") {
      const scale = Math.max(0.7, Math.min(1.3, W / 420));
      // Floor of fire across the bottom of the screen.
      const n = Math.round(dt * W * 0.55);
      for (let i = 0; i < n; i++) emitFlame(rand(-20, W + 20), H + rand(0, 30), scale * 1.25, rand(1, 1.6));
      // Flames up the sides of the screen.
      if (Math.random() < dt * 22) emitFlame(rand(-10, 18), rand(H * 0.25, H), scale * 0.8);
      if (Math.random() < dt * 22) emitFlame(W - rand(-10, 18), rand(H * 0.25, H), scale * 0.8);
      // Sparks everywhere.
      if (Math.random() < dt * 14) emitEmber(rand(0, W), H, true);
      // The card is on fire: flames along its top and upper sides.
      const r = cardRect();
      if (r) {
        const per = r.width / 360;
        const m = Math.round(dt * 70 * Math.max(per, 0.6));
        for (let i = 0; i < m; i++) {
          const side = Math.random();
          if (side < 0.55) emitFlame(rand(r.left + 10, r.right - 10), r.top + rand(4, 14), 0.6 * per + 0.2, 0.8);
          else if (side < 0.775) emitFlame(r.left + rand(-4, 8), rand(r.top, r.top + r.height * 0.75), 0.45 * per + 0.15, 0.7);
          else emitFlame(r.right - rand(-4, 8), rand(r.top, r.top + r.height * 0.75), 0.45 * per + 0.15, 0.7);
        }
        if (Math.random() < dt * 6) emitEmber(rand(r.left, r.right), r.top, true);
      }
    } else if (mode.startsWith("candle")) {
      const lvl = +mode.slice(-1);
      if (Math.random() < dt * [0, 1.2, 2.5, 4.5][lvl]) {
        add({ kind: "mote", x: rand(0, W), y: H + 10, vx: rand(-6, 6), vy: rand(-22, -10), size: rand(6, 12),
              life: 0, max: rand(6, 10), wob: rand(0, 6), wobS: rand(0.5, 1.2) });
      }
    }
  };

  // ---- drawing ----
  const flicker = (speed, seed) =>
    0.82 + 0.1 * Math.sin(t * speed + seed) + 0.08 * Math.sin(t * speed * 2.7 + seed * 3.1);

  const glow = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace("A", a));
    g.addColorStop(1, color.replace("A", 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  const drawBackdrop = () => {
    if (mode === "embers") {
      const a = 0.34 + 0.1 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 4.1);
      const g = ctx.createLinearGradient(0, H, 0, H * 0.55);
      g.addColorStop(0, `rgba(255,90,30,${a})`);
      g.addColorStop(1, "rgba(255,90,30,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
    } else if (mode === "fire") {
      const p = flicker(7, 0);
      const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(255,60,0,0)");
      g.addColorStop(1, `rgba(255,50,0,${0.42 * p})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const b = ctx.createLinearGradient(0, H, 0, H * 0.5);
      b.addColorStop(0, `rgba(255,120,20,${0.5 * p})`);
      b.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = b;
      ctx.fillRect(0, H * 0.5, W, H * 0.5);
      const r = cardRect();
      if (r) glow(r.left + r.width / 2, r.top + r.height / 2, Math.max(r.width, r.height) * 0.75, "rgba(255,90,20,A)", 0.35 * p);
    } else if (mode.startsWith("candle")) {
      const lvl = +mode.slice(-1);
      const s = Math.max(W, H);
      const pools = lvl === 1
        ? [[0.5, 1.02]]
        : lvl === 2 ? [[0.1, 1.0], [0.9, 1.0]]
        : [[0.08, 1.0], [0.5, 1.04], [0.92, 1.0], [0.06, 0.12], [0.94, 0.12]];
      const strength = [0, 0.42, 0.55, 0.68][lvl];
      pools.forEach(([px, py], i) =>
        glow(px * W, py * H, s * (0.38 + lvl * 0.08), "rgba(255,170,70,A)", strength * flicker(5 + i, i * 1.7)));
      if (lvl === 3) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, s * 0.8);
        g.addColorStop(0, "rgba(255,150,60,0)");
        g.addColorStop(1, `rgba(255,140,40,${0.22 * flicker(4, 9)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    }
  };


  const drawParts = dt => {
    ctx.globalCompositeOperation = "lighter";
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) { parts.splice(i, 1); continue; }
      if (p.kind === "flame") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98;
        const size = p.size * (1 - k * 0.75);
        const img = k < 0.25 ? SPR.hot : k < 0.6 ? SPR.orange : SPR.red;
        ctx.globalAlpha = k < 0.1 ? k * 10 : (1 - k) * 0.95;
        ctx.drawImage(img, p.x - size / 2, p.y - size / 2, size, size);
      } else {
        p.wob += p.wobS * dt;
        p.x += (p.vx + Math.sin(p.wob) * 14) * dt;
        p.y += p.vy * dt;
        const fade = k < 0.1 ? k * 10 : 1 - k;
        const tw = 0.6 + 0.4 * Math.sin(p.life * 9 + p.wob);
        ctx.globalAlpha = Math.max(0, fade * tw);
        const img = p.kind === "mote" ? SPR.candle : SPR.orange;
        ctx.drawImage(img, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };

  const frame = now => {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    t += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (mode === "none") { parts.length = 0; return; }
    drawBackdrop();
    if (!reduceMotion) {
      spawn(dt);
      drawParts(dt);
    }
    if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const kick = () => {
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  };

  window.addEventListener("resize", () => { resize(); kick(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
  resize();

  return {
    set(m) {
      if (m === mode) return;
      mode = m;
      parts.length = 0;
      canvas.dataset.mode = m;
      kick();
    },
    get mode() { return mode; },
    setCard(el) { cardEl = el; },
    // Burst of sparks and flame from the card (used when a card is drawn in fire mode).
    burst() {
      if (mode !== "fire" || reduceMotion) return;
      const r = cardRect();
      if (!r) return;
      for (let i = 0; i < 40; i++) emitEmber(rand(r.left, r.right), rand(r.top, r.top + 40), true);
      for (let i = 0; i < 30; i++) emitFlame(rand(r.left, r.right), r.top + rand(0, 20), 0.9, 1.2);
    },
    stats: () => ({ particles: parts.length, mode }),
  };
})();
