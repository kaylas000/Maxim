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

  let frame = 0, raf = 0, presetIdx = 0, sound = false, audio = null, running = false, lastHit = -1;

  function resize() {
    if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.floor(innerWidth * dpr);
    cv.height = Math.floor(innerHeight * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", () => { resize(); if (running) paint(frame); if (heroOn) paintHero(heroFrame); });
  addEventListener("orientationchange", () => setTimeout(() => { resize(); if (running) paint(frame); if (heroOn) paintHero(heroFrame); }, 260));

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
    if (reduced) return;
    cancelAnimationFrame(raf);
    running = true;
    lastHit = -1;
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
    heroSequence();
  }

  function skip() { finish(); }

  btnSkip && btnSkip.addEventListener("click", () => { track("intro_skip_click"); skip(); });
  document.querySelectorAll("[data-intro-replay]").forEach((b) =>
    b.addEventListener("click", () => { track("hero_intro_replay_click"); replay(); }));
  const replayBtn = document.getElementById("replay");
  replayBtn && replayBtn.addEventListener("click", () => { track("intro_replay_click"); replay(); });

  function replay() {
    presetIdx = (presetIdx + 1) % PRESETS.length; /* пресеты крутятся по кругу (SK-06) */
    heroDone();
    const hero = document.getElementById("delo");
    if (hero) hero.dataset.hero = "wait";
    intro.dataset.state = "idle";
    start();
    if (hero) heroSequence();
  }

  addEventListener("keydown", (e) => {
    if (!running) return;
    if (e.key === "Escape") skip();
    if (e.key === " ") { e.preventDefault(); replay(); }
  });


  /* ── секвенция героя (лист 01) · тот же кадровый движок, кривые из реестра ── */
  const HERO = { total: 104, lead: 4, letters: 8, ride: 26, rule: 34, stair: 52, stamp: 70, plate: 16 };
  let heroFrame = 0, heroRaf = 0, heroOn = false;

  function splitHero() {
    const h1 = document.getElementById("mega-hero");
    if (!h1) return [];
    if (h1.dataset.split === "1") return [...h1.querySelectorAll(".hl")];
    const txt = h1.textContent.replace(/\u00a0/g, " ");
    h1.textContent = "";
    for (const ch of txt) {
      if (ch === " ") { h1.appendChild(document.createTextNode(" ")); continue; }
      const span = document.createElement("span");
      span.className = "hl";
      span.textContent = ch;
      h1.appendChild(span);
    }
    h1.dataset.split = "1";
    h1.setAttribute("data-full", txt);
    return [...h1.querySelectorAll(".hl")];
  }

  function paintHero(f) {
    const hero = document.getElementById("delo");
    const h1 = document.getElementById("mega-hero");
    const nodes = h1 ? [...h1.querySelectorAll(".hl")] : [];
    nodes.forEach((n, i) => {
      const k = flight(clamp((f - HERO.lead - i * HERO.letters) / HERO.ride, 0, 1));
      const settle = land(clamp((f - HERO.lead - i * HERO.letters - HERO.ride) / 12, 0, 1));
      n.style.opacity = String(clamp(k * 1.5, 0, 1));
      n.style.transform = `translate3d(0, ${((1 - k) * 0.45).toFixed(3)}em, 0) scale(${(0.88 + settle * 0.12).toFixed(3)})`;
    });
    const rule = document.getElementById("hero-rule");
    if (rule) rule.style.width = (flight(clamp((f - HERO.rule) / 30, 0, 1)) * 100).toFixed(2) + "%";
    const stair = document.getElementById("stair");
    if (stair) [...stair.children].forEach((li, i) => {
      const k = coast(clamp((f - HERO.stair - i * 6) / 22, 0, 1));
      li.style.opacity = String(k);
      li.style.transform = `translate3d(${(-10 * (1 - k)).toFixed(1)}px, ${(6 * (1 - k)).toFixed(1)}px, 0)`;
    });
    const plate = document.querySelector(".plate .facts");
    if (plate) [...plate.querySelectorAll("dd")].forEach((dd, i) => {
      dd.style.opacity = String(coast(clamp((f - HERO.plate - i * 4) / 18, 0, 1)));
    });
    const lead = document.querySelector(".lead");
    if (lead) {
      const k = drag(clamp((f - HERO.letters * nodes.length - HERO.ride) / 34, 0, 1));
      lead.style.opacity = String(k);
    }
    const stamp = document.getElementById("stamp");
    if (stamp && f >= HERO.stamp && !stamp.classList.contains("pressed")) stamp.classList.add("pressed");
    if (f >= HERO.total) return heroDone();
  }

  function heroTick() {
    heroFrame += 1;
    paintHero(heroFrame);
    if (heroFrame < HERO.total) heroRaf = requestAnimationFrame(heroTick);
  }

  function heroDone() {
    cancelAnimationFrame(heroRaf);
    heroOn = false;
    const hero = document.getElementById("delo");
    if (hero) hero.dataset.hero = "done";
  }

  function heroSequence() {
    const hero = document.getElementById("delo");
    if (!hero) return;
    if (reduced) { hero.dataset.hero = "done"; return; }
    splitHero();
    hero.dataset.hero = "play";
    if (heroOn) return;
    heroOn = true;
    heroFrame = 0;
    heroRaf = requestAnimationFrame(heroTick);
  }

  /* тройной тап по экрану: live-диагностика мобилы (docs/MOBILE_PLAYBOOK.md, п.2) */
  let taps = 0, tapTimer = 0;
  addEventListener("pointerdown", () => {
    taps += 1;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 600);
    if (taps < 3) return;
    taps = 0;
    mobileDebug();
  }, { passive: true });

  function mobileDebug() {
    const old = document.getElementById("ceh-mdbg");
    if (old) { old.remove(); return; }
    const de = document.documentElement;
    const hScroll = de.scrollWidth - de.clientWidth;
    const small = [...document.querySelectorAll("a,button,input,textarea,select")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); })
      .map((el) => (el.textContent || el.id || el.tagName).trim().slice(0, 24) + ` ${Math.round(el.getBoundingClientRect().height)}px`);
    const box = document.createElement("div");
    box.id = "ceh-mdbg";
    box.style.cssText = "position:fixed;z-index:90;left:8px;right:8px;bottom:8px;background:#0a2145;color:#e9f0f8;border:1px solid #ff7a18;padding:10px 12px;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap";
    box.textContent = [
      `viewport ${innerWidth}×${innerHeight} · dpr ${devicePixelRatio} · ориентация ${innerWidth > innerHeight ? "landscape" : "portrait"}`,
      `горизонтальный скролл: ${hScroll > 0 ? "ЕСТЬ (" + hScroll + "px)" : "нет"}`,
      `safe-area bottom: ${getComputedStyle(document.body).getPropertyValue("--sab") || envSafe()}`,
      `зоны < 44px: ${small.length ? small.join(", ") : "нет"}`,
      `герой: ${document.getElementById("delo")?.dataset.hero || "—"} · заставка: ${intro.dataset.state}`,
    ].join("\n");
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 9000);
  }
  function envSafe() {
    const t = document.createElement("div");
    t.style.cssText = "position:absolute;height:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(t);
    const v = getComputedStyle(t).height;
    t.remove();
    return v;
  }

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

  /* загрузка: reduced-motion → сразу дело; повторный визит → дело с секвенцией героя;
     первый визит → ждём Unbounded и играем заставку, герой стартует по её finish() */
  function boot() {
    if (reduced) {
      intro.dataset.state = "off";
      document.documentElement.dataset.introDone = "1";
      document.querySelectorAll(".mega-row .ltr").forEach((n) => {
        n.style.opacity = "1";
        n.style.transform = "none";
      });
      heroSequence();
      return;
    }
    if (seen) {
      intro.dataset.state = "off";
      document.documentElement.dataset.introDone = "1";
      heroSequence();
      return;
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => start());
    else start();
  }
  boot();

})();
