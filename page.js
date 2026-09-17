/* PRJ-03 · листы 02–06. Липкая сцена, инструмент реестра в пяти состояниях,
   форма поздравления. Ноль зависимостей, состояние только локальное (ТЗ, раздел 10). */
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s);
  const track = (name, extra) =>
    document.dispatchEvent(new CustomEvent("ceh:analytics", { detail: { event: name, ...extra } }));

  /* ── лист 02 · липкая сцена (motion/recipes/sticky-scene/snippet.js) ── */
  const steps = [...document.querySelectorAll(".step")];
  const num = $("#scene-num"), label = $("#scene-label"), note = $("#scene-note"), bar = $("#scene-bar");
  if (steps.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        steps.forEach((s) => (s.dataset.active = String(s === el)));
        num.textContent = el.dataset.num;
        label.textContent = el.dataset.label;
        const idx = steps.indexOf(el);
        note.textContent = `шаг ${idx + 1} из ${steps.length}: меняется ровно одна строка листа`;
        bar.style.width = (((idx + 1) / steps.length) * 100).toFixed(2) + "%";
      }
    }, { threshold: 0.55, rootMargin: "-20% 0px -35% 0px" });
    steps.forEach((s) => io.observe(s));
  }

  /* ── лист 03 · реестр достижений (skills/value-calculator + skills/ux-states) ── */
  const FACTS = [
    { text: "собрал рамку для семейной фотографии", sheet: "04 · руки", cat: "hands", ok: true, date: "2026-08" },
    { text: "подтягивания 12 раз без остановки", sheet: "02 · спорт", cat: "sport", ok: true, date: "2026-09" },
    { text: "четвертная отметка на велике вокруг озера", sheet: "02 · спорт", cat: "sport", ok: false, date: "2026-07" },
    { text: "годовая по физике: четвертая, без двойек", sheet: "01 · школа", cat: "school", ok: true, date: "2026-05" },
    { text: "починил петлю на двери мастерской", sheet: "04 · руки", cat: "hands", ok: false, date: "2026-06" },
    { text: "запустил этот сайт кодом без чужих библиотек", sheet: "00 · код", cat: "other", ok: true, date: "2026-09" },
  ];
  const body = $("#fact-body"), state = $("#fact-state"), partial = $("#fact-partial");
  const empty = $("#fact-empty"), err = $("#fact-err"), table = $("#fact-table");
  let broken = false, cat = "all";

  const visible = () => (cat === "all" ? FACTS : FACTS.filter((f) => f.cat === cat));

  function render(mode) {
    if (broken) {
      table.hidden = true; partial.hidden = true; empty.hidden = true; err.hidden = false;
      state.textContent = "строки дела не читаются: аварийный режим включён вручную";
      return;
    }
    err.hidden = true;
    const rows = visible();
    if (mode === "loading") {
      table.hidden = false; partial.hidden = true; empty.hidden = true;
      body.innerHTML = "";
      for (let i = 0; i < 3; i++) {
        const tr = document.createElement("tr");
        tr.innerHTML = '<td><span class="skel"></span></td><td><span class="skel" style="width:40%"></span></td><td><span class="skel" style="width:60%"></span></td>';
        body.appendChild(tr);
      }
      state.textContent = "пересобираю реестр…";
      return;
    }
    table.hidden = false;
    body.innerHTML = "";
    empty.hidden = rows.length > 0;
    if (!rows.length) {
      table.hidden = true; partial.hidden = true;
      state.textContent = "в этой категории пока пусто";
      return;
    }
    for (const f of rows) {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td"); td1.textContent = f.text;
      const td2 = document.createElement("td"); td2.textContent = f.sheet;
      const td3 = document.createElement("td");
      td3.innerHTML = f.ok
        ? '<span class="ok">подтверждено</span> · ' + f.date
        : '<span class="wait">жду подтверждения</span>';
      tr.append(td1, td2, td3);
      body.appendChild(tr);
    }
    const wait = rows.filter((f) => !f.ok).length;
    partial.hidden = wait === 0;
    partial.firstChild.textContent = `${rows.length - wait} из ${rows.length} строк подтверждено, `;
    state.textContent = `показано ${rows.length} из ${FACTS.length} строк`;
  }

  let timer = 0;
  document.querySelectorAll(".chip[data-cat]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-cat]").forEach((c) => {
        c.classList.toggle("is-on", c === chip);
        c.setAttribute("aria-pressed", String(c === chip));
      });
      cat = chip.dataset.cat;
      track("fact_filter_click", { cat });
      if (reduced) return render("full");
      render("loading");
      clearTimeout(timer);
      timer = setTimeout(() => render("full"), 380);
    });
  });
  const resetBtn = $("#fact-empty button");
  resetBtn && resetBtn.addEventListener("click", () => { cat = "all"; render("full"); });
  partial.querySelector("button").addEventListener("click", () => { cat = "all"; render("full"); });
  $("#tool-break").addEventListener("click", () => { broken = !broken; render("full"); track("tool_break_click"); });
  $("#fact-retry").addEventListener("click", () => { broken = false; render("full"); track("fact_retry_click"); });

  /* карточка строк собирается на клиенте, файл никуда не отправляется */
  $("#fact-dl").addEventListener("click", () => {
    const lines = visible().map((f) =>
      `${f.ok ? "[ok]  " : "[...] "} ${f.sheet} · ${f.text} · ${f.date}`);
    const txt = ["ДЕЛО №12 · лист 03 · реестр строк", `выгрузка от ${new Date().toLocaleDateString("ru-RU")}`, `категория: ${cat}`, "", ...lines, "", "строк: " + visible().length].join("\n");
    const url = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "delo-12-list-03.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    track("fact_card_download", { cat, rows: visible().length });
  });
  render("full");

  /* ── лист 06 · поздравление в дело (skills/ux-writing) ─────────── */
  const form = $("#wish"), nameI = $("#wish-name"), textI = $("#wish-text");
  const counter = $("#wish-count"), store = $("#wish-store"), list = $("#wish-list");
  const KEY = "maxim12.wishes";
  const MIN = 8;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; } };

  function drawList() {
    const arr = load();
    list.innerHTML = "";
    arr.forEach((w, i) => {
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = `пункт ${String(arr.length - i).padStart(2, "0")} · ${w.when}`;
      li.appendChild(b);
      li.appendChild(document.createTextNode((w.who ? w.who + ": " : "") + w.text));
      list.appendChild(li);
    });
    store.textContent = "записей: " + arr.length;
  }
  function check() {
    const n = textI.value.trim().length;
    counter.classList.remove("good", "bad");
    if (!n) { counter.textContent = "дело ждёт первую запись"; return; }
    if (n < MIN) { counter.textContent = `не хватает ${MIN - n} символов, чтобы запись пошла в дело`; counter.classList.add("bad"); return; }
    counter.textContent = `готово к записи · ${n} символов`;
    counter.classList.add("good");
  }
  textI.addEventListener("input", check);
  check();
  drawList();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = textI.value.trim();
    if (text.length < MIN) {
      counter.textContent = `не хватает ${Math.max(1, MIN - text.length)} символов, чтобы запись пошла в дело`;
      counter.classList.add("bad");
      textI.focus();
      return;
    }
    const btn = form.querySelector("button[type=submit]");
    const was = btn.textContent;
    btn.disabled = true;
    btn.textContent = "записываю в дело…";
    setTimeout(() => {
      const arr = load();
      arr.unshift({
        who: nameI.value.trim().slice(0, 40),
        text: text.slice(0, 420),
        when: new Date().toLocaleDateString("ru-RU"),
      });
      const ok = save(arr);
      btn.disabled = false;
      btn.textContent = was;
      if (ok) {
        counter.textContent = `записано в дело, пункт ${String(arr.length).padStart(2, "0")} · хранится только в этом браузере`;
        form.reset();
      } else {
        counter.textContent = "браузер запретил сохранение: запись осталась в поле";
        counter.classList.add("bad");
      }
      drawList();
      track("wish_submit_click", { ok, len: text.length });
    }, reduced ? 0 : 420);
  });

  $("#wish-clear").addEventListener("click", () => {
    try { localStorage.removeItem(KEY); } catch (e) { /* игнорируем запрет хранилища */ }
    drawList();
    check();
    counter.textContent = "дело очищено: записей нет";
    track("wish_clear_click");
  });

  /* счётчик событий аналитики: nothing leaves the page, только консоль отладки */
  let events = 0;
  document.addEventListener("ceh:analytics", (e) => {
    events += 1;
    if (location.search.includes("debug")) console.log("[ceh]", e.detail.event, e.detail);
  });
})();
