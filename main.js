/* PRJ-03 · лист 00 — заставка «Сварка».
   Каноны: skills/cinema-intro/SKILL.md, motion/recipes/intro-assembly, motion/recipes/cart-assembly.
   К-19: всё считается от номера кадра, часы лишь продвигают счётчик. */
(() => {
  "use strict";
  const FPS = 60, TOTAL = 204;
  const LOAD = 18, STAGGER = 8, RIDE = 20, TAP = 10, TITR = 150, CURTAIN = 178;
  const SESSION_KEY = "maxim12.intro.seen";

  /* кривые только из реестра motion/easing-curves.json */
  const CURVE = {
    "ceh-brake": [0.16, 1, 0.3, 1],
    "ceh-snap": [0.34, 1.56, 0.64, 1],
    "ceh-coast": [0.33, 0.01, 0.16, 1],
    "ceh-drag": [0.65, 0, 0.15, 1],
    "ceh-drive": [0, 0, 1, 1],
  };
  function curveOf(id) {
    const [x1, y1, x2, y2] = CURVE[id] || CURVE["ceh-drive"];
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const fx = (t) => ((ax * t + bx) * t + cx) * t;
    const fy = (t) => ((ay * t + by) * t + cy) * t;
    return (p) => {
      let t = p;
      for (let i = 0; i < 5; i++) {
        const d = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(d) < 1e-6) break;
        t -= (fx(t) - p) / d;
      }
      return fy(Math.min(1, Math.max(0, t)));
    };
  }
  const flight = curveOf("ceh-brake");
  const land = curveOf("ceh-snap");
  const coast = curveOf("ceh-coast");
  const drag = curveOf("ceh-drag");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /* детерминированный hash от пары (буква, частица): кадр N всегда даёт тот же набор */
  function rnd(a, b) {
    let h = (a * 374761393 + b * 668265263) >>> 0;
    h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const PRESETS = [
    { id: "SBR-01", name: "«Сварка»", n: 34, tail: 14, drift: -0.9, lift: 1.25, ring: false },
    { id: "LUM-02", name: "«Россыпь»", n: 64, tail: 26, drift: 0.7, lift: 0.8, ring: false },
    { id: "TYP-03", name: "«Штамп»", n: 12, tail: 10, drift: 0.15, lift: 2.1, ring: true },
  ];

  const intro = document.getElementById("intro");
  if (!intro) return;
  const rows = [...document.querySelectorAll(".mega-row")].map((el) => ({
    el, letters: [...el.querySelectorAll(".ltr")],
  }));
  const letters = rows.flatMap((r) => r.letters);
  const strap = document.querySelector("#strap i");
  const meta = document.querySelector(".intro-meta");
  const tc = document.getElementById("intro-tc");
  const presetLabel = document.getElementById("intro-preset");
  const btnSkip = document.getElementById("intro-skip");
  const btnSound = document.getElementById("intro-sound");
  const cv = document.getElementById("sparks");
  const ctx = cv.getContext ? cv.getContext("2d") : null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tokenColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  const COL = { spark: "#f2b705", hot: "#ff7a18", ink: "#e9f0f8" };

  let frame = 0, raf = 0, presetIdx = 0, sound = false, audio = null, running = false;

  function resize() {
    if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.floor(innerWidth * dpr);
    cv.height = Math.floor(innerHeight * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);

  /* положение основания буквы в кадре — для точки удара искр */
  function anchor(node) {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.bottom - r.height * 0.12, w: r.width };
  }

  function drawSparks(f) {
    if (!ctx) return;
    const p = PRESETS[presetIdx];
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (f < LOAD) return;
    letters.forEach((node, i) => {
      const start = LOAD + i * STAGGER;
      const hit = start + RIDE;
      const age = f - hit;
      if (age < 0 || age > p.tail + 8) return;
      const a = anchor(node);
      const glow = clamp(1 - age / (p.tail + 8), 0, 1);
      for (let s = 0; s < p.n; s++) {
        const r1 = rnd(i + 1, s + 1), r2 = rnd(i + 7, s * 3 + 5), r3 = rnd(i * 5 + 2, s + 11);
        const ang = -Math.PI / 2 + (r1 - 0.5) * 2.6;
        const speed = (0.9 + r2 * 2.4) * p.lift;
        const vx = Math.cos(ang) * speed + p.drift * 1.6;
        const vy = Math.sin(ang) * speed;
        const t = age / p.tail;
        const x = a.x + vx * t * 26;
        const y = a.y + vy * t * 26 + 46 * t * t;
        const len = (4 + r3 * 12) * (1 - t * 0.4);
        const alpha = glow * (0.35 + r3 * 0.65);
        ctx.strokeStyle = alpha > 0.72 ? COL.hot : (r1 > 0.55 ? COL.spark : COL.ink);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1 + r2;
        /* след по вектору скорости вместо размытия (skills/webgpu-codevideo) */
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - vx * len * 0.32, y - vy * len * 0.32);
        ctx.stroke();
      }
      if (p.ring && age >= 0 && age <= 12) {
        const k = age / 12;
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = COL.spark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, a.w * 0.5 + k * 90, (a.w * 0.16) + k * 34, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (age < 3) {
        ctx.globalAlpha = (3 - age) / 3 * 0.55;
        ctx.fillStyle = COL.ink;
        ctx.fillRect(a.x - a.w * 0.9, a.y, a.w * 1.8, 1);
      }
    });
    ctx.globalAlpha = 1;
  }

  function paint(f) {
    letters.forEach((node, i) => {
      const start = LOAD + i * STAGGER;
      const inFlight = clamp((f - start) / RIDE, 0, 1);
      const k = flight(inFlight);
      const settle = clamp((f - start - RIDE) / TAP, 0, 1);
      const bump = land(settle);
      const done = f >= start + RIDE;
      node.style.opacity = String(clamp(k * 1.4, 0, 1));
      const rise = (1 - k) * 1.2;
      const squash = done ? 1 + (1 - bump) * 0.16 : 0.6 + k * 0.4;
      node.style.transform = `translate3d(0, ${rise}em, 0) scale(${squash.toFixed(3)})`;
    });
    const sk = coast(clamp((f - TITR) / (CURTAIN - TITR), 0, 1));
    if (strap) strap.style.width = (sk * 100).toFixed(2) + "%";
    if (meta) meta.style.opacity = String(sk);
    const ck = drag(clamp((f - CURTAIN) / (TOTAL - CURTAIN), 0, 1));
    const a = document.querySelector(".curtain-a");
    const b = document.querySelector(".curtain-b");
    if (a) a.style.clipPath = `inset(0 ${50 + ck * 50}% 0 0)`;
    if (b) b.style.clipPath = `inset(0 0 0 ${50 + ck * 50}%)`;
    if (tc) tc.textContent = String(Math.min(f, TOTAL)).padStart(3, "0") + " / " + TOTAL;
    drawSparks(f);
    if (f >= TITR) intro.dataset.state = "titr";
    if (f >= CURTAIN) intro.dataset.state = "curtain";
  }

  function tick() {
    frame += 1;
    paint(frame);
    if (frame >= TOTAL) return finish();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (reduced || running) return;
    running = true;
    resize();
    frame = 0;
    intro.dataset.state = "play";
    presetLabel.textContent = `${PRESETS[presetIdx].id} ${PRESETS[presetIdx].name}`;
    raf = requestAnimationFrame(tick);
  }

  function finish() {
    cancelAnimationFrame(raf);
    running = false;
    intro.dataset.state = "off";
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) { /* приватный режим */ }
    document.documentElement.dataset.introDone = "1";
  }

  function skip() { finish(); }

  btnSkip && btnSkip.addEventListener("click", () => { track("intro_skip_click"); skip(); });
  document.querySelectorAll("[data-intro-replay]").forEach((b) =>
    b.addEventListener("click", () => { track("hero_intro_replay_click"); replay(); }));
  const replayBtn = document.getElementById("replay");
  replayBtn && replayBtn.addEventListener("click", () => { track("intro_replay_click"); replay(); });

  function replay() {
    presetIdx = (presetIdx + 1) % PRESETS.length; /* пресеты крутятся по кругу (SK-06) */
    intro.dataset.state = "idle";
    start();
  }

  addEventListener("keydown", (e) => {
    if (!running) return;
    if (e.key === "Escape") skip();
    if (e.key === " ") { e.preventDefault(); replay(); }
  });

  /* звук — синтез, только по жесту; запасной путь на осцилляторе */
  function ensureAudio() {
    if (audio) return audio.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const c = new AC();
    const worklet = "class Hit extends AudioWorkletProcessor{process(i,o,p){const a=o[0][0];const m=p.framesReceived/12000;for(let n=0;n<a.length;n++){const t=n/48000;a[n]=Math.exp(-t*26)*Math.sin(2*Math.PI*(180+m*40)*t)*0.28;}return true}}";
    if (c.audioWorklet) {
      const url = URL.createObjectURL(new Blob([worklet], { type: "application/javascript" }));
      c.audioWorklet.addModule(url).catch(() => {});
    }
    audio = { ctx: c, fallback: true };
    return c;
  }
  function hit(soft) {
    if (!sound) return;
    const c = ensureAudio();
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = soft ? "sine" : "square";
    o.frequency.value = soft ? 320 : 180;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.16);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.18);
  }
  btnSound && btnSound.addEventListener("click", () => {
    sound = !sound;
    btnSound.textContent = sound ? "Звук вкл" : "Звук выкл";
    btnSound.setAttribute("aria-pressed", String(sound));
    if (sound) ensureAudio();
    track("intro_sound_toggle");
  });

  /* удар буквы → щелчок: событие, а не фоновый луп */
  let lastHit = -1;
  const obs = setInterval(() => {
    if (!running) return;
    const hitIdx = Math.floor((frame - LOAD - RIDE) / STAGGER);
    if (hitIdx !== lastHit && hitIdx >= 0 && hitIdx < letters.length) {
      lastHit = hitIdx;
      hit(presetIdx === 1);
    }
  }, 16);
  addEventListener("pagehide", () => clearInterval(obs));

  function track(name) {
    document.dispatchEvent(new CustomEvent("ceh:analytics", { detail: { event: name } }));
  }

  COL.spark = tokenColor("--spark", COL.spark);
  COL.hot = tokenColor("--hot", COL.hot);
  COL.ink = tokenColor("--ink", COL.ink);

  let seen = false;
  try { seen = sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) { seen = false; }
  if (reduced) {
    intro.dataset.state = "off";
    document.documentElement.dataset.introDone = "1";
    document.querySelectorAll(".mega-row .ltr").forEach((n) => { n.style.opacity = "1"; n.style.transform = "none"; });
  } else if (!seen) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => start());
    else start();
  } else {
    intro.dataset.state = "off";
    document.documentElement.dataset.introDone = "1";
  }
})();
