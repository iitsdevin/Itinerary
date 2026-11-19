(function () {
  "use strict";
  const { CITIES, CATS } = window.TABI_DATA;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  /* ================= storage ================= */
  const KEY = "tabi.v1";
  const blank = () => ({
    profile: { name: "", trip: "Japan trip", start: "", end: "" },
    items: [],
    todos: [],
    explore: { city: "tokyo", kind: "any", cat: "all" },
    onboarded: false,
  });
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(blank(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return blank();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast("Couldn't save. Your phone storage might be full."); }
  }
  // ask the browser not to clear our data
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ================= dates ================= */
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const todayISO = () => toISO(new Date());
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
  const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (s, long) => {
    if (!s) return "No date";
    const d = parseISO(s);
    return long ? `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}` : `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`;
  };
  const fmtTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "pm" : "am";
    const hh = h % 12 || 12;
    return m ? `${hh}:${pad(m)}${ap}` : `${hh}${ap}`;
  };
  const dayNum = (s) => (S.profile.start && s ? diffDays(S.profile.start, s) + 1 : null);
  const tripLen = () => (S.profile.start && S.profile.end ? diffDays(S.profile.start, S.profile.end) + 1 : null);

  /* ================= types ================= */
  const TYPES = {
    travel: { label: "Travel", emoji: "🚄" },
    hotel: { label: "Hotel", emoji: "🏨" },
    activity: { label: "Activity", emoji: "⛩️" },
    food: { label: "Food", emoji: "🍜" },
  };
  const cityById = (id) => CITIES.find((c) => c.id === id);
  const actById = (id) => { for (const c of CITIES) { const a = c.acts.find((x) => x.id === id); if (a) return a; } return null; };
  const mapsUrl = (q) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

  /* ================= icons ================= */
  const I = {
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 14.5v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3"/></svg>',
    cog: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M4 7h3.5c5 0 4 10 9 10H20M17 14l3 3-3 3M4 17h3.5c1.5 0 2.4-.9 3.1-2.1M17 4l3 3-3 3M13.4 9.1C14.1 7.9 15 7 16.5 7H20"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m6 12.5 4 4L18 8"/></svg>',
    ticket: '<svg viewBox="0 0 24 24"><path d="M4 8.5V6h16v2.5a2.5 2.5 0 0 0 0 5V18H4v-4.5a2.5 2.5 0 0 0 0-5z"/><path d="M14 6v12" stroke-dasharray="2 2"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M6 4h9l4 4v12H6z"/><path d="M14.5 4v4.5H19M9 12.5h6M9 16h4"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="M12 3.5c.6 4.4 2.5 6.6 7 7.5-4.5.9-6.4 3.1-7 7.5-.6-4.4-2.5-6.6-7-7.5 4.5-.9 6.4-3.1 7-7.5z"/></svg>',
  };
  const usa = (cls = "") => `<svg class="usa ${cls}" viewBox="0 0 120 120" aria-hidden="true"><use href="#mascot"/></svg>`;

  /* ================= toast ================= */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ================= sheets ================= */
  let sheetStack = [];
  function openSheet(html, opts = {}) {
    const root = $("#sheet-root");
    const wrap = document.createElement("div");
    wrap.className = "sheet-wrap";
    wrap.innerHTML = `<div class="sheet-backdrop"></div>
      <section class="sheet ${opts.cls || ""}" role="dialog" aria-modal="true">
        <div class="sheet-grab"></div>
        <button class="icon-btn sheet-close" aria-label="Close">${I.x}</button>
        <div class="sheet-body">${html}</div>
      </section>`;
    root.appendChild(wrap);
    document.body.classList.add("sheet-open");
    requestAnimationFrame(() => wrap.classList.add("open"));
    const close = () => closeSheet(wrap);
    $(".sheet-backdrop", wrap).onclick = close;
    $(".sheet-close", wrap).onclick = close;
    sheetStack.push(wrap);
    // swipe down to close
    const sheet = $(".sheet", wrap);
    let y0 = null, dy = 0;
    sheet.addEventListener("touchstart", (e) => {
      if (sheet.scrollTop > 0 || e.target.closest("input,textarea,select")) return;
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    sheet.addEventListener("touchmove", (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheet.addEventListener("touchend", () => {
      if (y0 === null) return;
      sheet.style.transform = "";
      if (dy > 110) close();
      y0 = null;
    });
    return { el: $(".sheet-body", wrap), close };
  }
  function closeSheet(wrap) {
    wrap = wrap || sheetStack[sheetStack.length - 1];
    if (!wrap) return;
    sheetStack = sheetStack.filter((w) => w !== wrap);
    wrap.classList.remove("open");
    setTimeout(() => wrap.remove(), 260);
    if (!sheetStack.length) document.body.classList.remove("sheet-open");
  }
  function closeAllSheets() { [...sheetStack].forEach(closeSheet); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

  function confirmSheet(msg, yesLabel, onYes) {
    const s = openSheet(`<div class="confirm">${usa("usa-sm")}<h3>${esc(msg)}</h3>
      <div class="btn-row"><button class="btn ghost" data-no>Cancel</button><button class="btn danger" data-yes>${esc(yesLabel)}</button></div></div>`);
    $("[data-no]", s.el).onclick = s.close;
    $("[data-yes]", s.el).onclick = () => { s.close(); onYes(); };
  }

  /* ================= router ================= */
  const VIEWS = { home: renderHome, itinerary: renderItinerary, explore: renderExplore, todo: renderTodo };
  function route() {
    if (!S.onboarded) return renderWelcome();
    document.body.classList.remove("welcome-mode");
    const tab = (location.hash || "#home").slice(1).split("/")[0];
    const fn = VIEWS[tab] || renderHome;
    $$(".tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === (VIEWS[tab] ? tab : "home")));
    fn();
  }
  window.addEventListener("hashchange", () => { closeAllSheets(); route(); window.scrollTo(0, 0); });
  function rerender() { route(); }

  /* ================= welcome ================= */
  function renderWelcome() {
    document.body.classList.add("welcome-mode");
    $("#view").innerHTML = `
      <div class="welcome">
        <div class="bubble">Welcome!</div>
        ${usa("usa-xl bob")}
        <h1 class="brand"><span>Tabibito</span> <small>旅人</small></h1>
        <p class="lead">Your little Japan travel buddy. Plans, ideas and a wish list, all in one place.</p>
        <form class="card form" id="welcome-form">
          <label>What should I call you?
            <input name="name" autocomplete="given-name" placeholder="Your name" required value="${esc(S.profile.name)}">
          </label>
          <div class="grid2">
            <label>Trip starts<input type="date" name="start" value="${esc(S.profile.start)}"></label>
            <label>Trip ends<input type="date" name="end" value="${esc(S.profile.end)}"></label>
          </div>
          <button class="btn primary big" type="submit">Let's go! ✈️</button>
          <p class="fine">Everything stays on this phone. Nothing is uploaded anywhere.</p>
        </form>
      </div>
      <svg class="scene-bottom" viewBox="0 0 400 160" preserveAspectRatio="xMidYMax slice"><use href="#scene"/></svg>`;
    $("#welcome-form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      S.profile.name = f.get("name").trim();
      S.profile.start = f.get("start");
      S.profile.end = f.get("end");
      if (S.profile.start && S.profile.end && S.profile.end < S.profile.start) [S.profile.start, S.profile.end] = [S.profile.end, S.profile.start];
      S.onboarded = true;
      save();
      location.hash = "#home";
      route();
    };
  }

  /* ================= helpers for items ================= */
  const sortItems = (a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "99").localeCompare(b.time || "99") || (a.created || 0) - (b.created || 0);
  function itemsOn(date) { return S.items.filter((i) => i.date === date).sort(sortItems); }
  function hotelFor(date) {
    return S.items.find((i) => i.type === "hotel" && i.endDate && i.date < date && date <= i.endDate);
  }
  function itemStart(i) {
    if (!i.date) return null;
    const [y, m, d] = i.date.split("-").map(Number);
    const [h, mi] = (i.time || "00:00").split(":").map(Number);
    return new Date(y, m - 1, d, h, mi);
  }
  function nextUp() {
    const now = new Date();
    const upcoming = S.items.filter((i) => i.date).map((i) => ({ i, t: itemStart(i) }))
      .filter((x) => (x.i.time ? x.t > new Date(now - 30 * 60000) : x.i.date >= todayISO()))
      .sort((a, b) => a.t - b.t);
    return upcoming[0] ? upcoming[0].i : null;
  }
  function relTime(i) {
    const t = itemStart(i);
    const mins = Math.round((t - new Date()) / 60000);
    if (!i.time) {
      const d = diffDays(todayISO(), i.date);
      return d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`;
    }
    if (mins < -1) return "Happening now";
    if (mins < 1) return "Starting now";
    if (mins < 60) return `In ${mins} min`;
    if (mins < 60 * 24) { const h = Math.floor(mins / 60), m = mins % 60; return `In ${h}h${m ? " " + m + "m" : ""}`; }
    const d = diffDays(todayISO(), i.date);
    return d === 1 ? "Tomorrow" : `In ${d} days`;
  }
  function tripDates() {
    const set = new Set(S.items.filter((i) => i.date).map((i) => i.date));
    if (S.profile.start && S.profile.end && diffDays(S.profile.start, S.profile.end) <= 120) {
      for (let d = S.profile.start; d <= S.profile.end; d = addDays(d, 1)) set.add(d);
    }
    return [...set].sort();
  }
  function statusPill() {
    const t = todayISO(), p = S.profile;
    if (p.start && t < p.start) {
      const n = diffDays(t, p.start);
      return `<span class="pill yellow">${n} day${n === 1 ? "" : "s"} to go</span>`;
    }
    if (p.start && p.end && t <= p.end) return `<span class="pill yellow">Day ${dayNum(t)} of ${tripLen()}</span>`;
    if (p.end && t > p.end) return `<span class="pill yellow">Okaeri! 🏡</span>`;
    return `<span class="pill yellow">${esc(p.trip || "Japan trip")}</span>`;
  }

  function itemCard(i, opts = {}) {
    const ty = TYPES[i.type] || TYPES.activity;
    const time = opts.inTimeline ? (i.endTime ? `until ${fmtTime(i.endTime)}` : "") : i.time ? `${fmtTime(i.time)}${i.endTime ? "–" + fmtTime(i.endTime) : ""}` : "";
    const nights = i.type === "hotel" && i.endDate ? diffDays(i.date, i.endDate) : 0;
    return `<button class="item t-${i.type}" data-item="${i.id}">
      <span class="item-ico">${ty.emoji}</span>
      <span class="item-main">
        <span class="item-title">${esc(i.title)}</span>
        <span class="item-meta">
          ${opts.showDate && i.date ? `<span>${fmtDate(i.date)}</span>` : ""}
          ${time ? `<span>${I.clock}${time}</span>` : ""}
          ${nights ? `<span>${nights} night${nights > 1 ? "s" : ""}</span>` : ""}
          ${i.location ? `<span class="loc">${I.pin}${esc(i.location)}</span>` : ""}
        </span>
      </span>
    </button>`;
  }

  function bindItemClicks(el) {
    $$("[data-item]", el).forEach((b) => (b.onclick = () => openItem(b.dataset.item)));
  }

  /* ================= HOME ================= */
  const GREETINGS = {
    morning: ["Ohayō! ☀️", "Rise and shine! 🌸", "Breakfast first? 🍙", "Let's go adventuring!", "Ikuzo! 🚄"],
    day: ["Let's go adventuring!", "Ganbatte! 💪", "Snack break? 🍡", "Remember to drink water!", "Ikuzo! 🚄"],
    evening: ["Otsukaresama! 🍵", "Ramen time? 🍜", "Onsen o'clock ♨️", "What a day! ✨", "Oyasumi soon 🌙"],
  };
  function renderHome() {
    const p = S.profile, t = todayISO();
    const nu = nextUp();
    const inTrip = p.start && p.end && t >= p.start && t <= p.end;
    const focusDate = inTrip ? t : (p.start && t < p.start ? p.start : t);
    const todays = itemsOn(focusDate);
    const hotel = hotelFor(focusDate);
    const openTodos = S.todos.filter((x) => !x.done);
    const doneTodos = S.todos.length - openTodos.length;
    const tl = tripLen();
    const daysDone = inTrip ? dayNum(t) : (p.end && t > p.end ? tl : 0);
    const hour = new Date().getHours();
    const hello = hour < 11 ? "Ohayō" : hour < 17 ? "Konnichiwa" : "Konbanwa";
    const pool = GREETINGS[hour < 11 ? "morning" : hour < 17 ? "day" : "evening"];
    const greet = pool[Math.floor(Math.random() * pool.length)];

    $("#view").innerHTML = `
      <header class="topbar">
        <button class="avatar" data-settings aria-label="Settings">${esc((p.name || "?").slice(0, 1).toUpperCase())}</button>
        ${statusPill()}
        <span class="spacer"></span>
        <button class="icon-btn soft" data-settings aria-label="Settings">${I.cog}</button>
      </header>

      <section class="hero">
        <div class="hero-text">
          <h1>${hello}, ${esc(p.name || "friend")}!</h1>
          <p>${inTrip ? "Here's your day in Japan" : p.start && t < p.start ? "Getting ready for Japan" : "Let's explore Japan"}</p>
        </div>
        <svg class="hero-scene" viewBox="0 0 400 160" preserveAspectRatio="xMidYMax slice"><use href="#scene"/></svg>
        <div class="hero-usa"><div class="bubble small">${greet}</div>${usa("usa-md bob")}</div>
      </section>

      <section class="card next-card">
        ${nu ? `
          <div class="row between"><span class="label">Up next</span><span class="pill t-${nu.type}">${relTime(nu)}</span></div>
          ${itemCard(nu, { showDate: true })}
          ${nu.location ? `<a class="link-btn" target="_blank" rel="noopener" href="${mapsUrl(nu.location)}">${I.pin} Directions</a>` : ""}
        ` : `
          <div class="row between"><span class="label">Up next</span></div>
          <p class="muted">Nothing planned yet. Add your plans or import a document and they'll show up here.</p>
          <div class="btn-row"><a class="btn sky" href="#itinerary/import">${I.upload} Import</a><a class="btn ghost" href="#itinerary/add">${I.plus} Add plan</a></div>
        `}
      </section>

      ${todays.length || hotel ? `
      <div class="divider"><span>${inTrip ? "Today" : "Day 1"} · ${fmtDate(focusDate)}</span></div>
      <section class="stack">
        ${hotel ? `<div class="stay-banner">🏨 Staying at <b>${esc(hotel.title)}</b>${hotel.endDate === focusDate ? " · check-out today" : ""}</div>` : ""}
        ${todays.map((i) => itemCard(i)).join("")}
      </section>` : ""}

      <div class="divider"><span>Training ground</span></div>
      <section class="card spin-card">
        <div class="spin-art">${usa("usa-md")}</div>
        <div>
          <h3>Feeling spontaneous?</h3>
          <p class="muted">${CITIES.reduce((n, c) => n + c.acts.length, 0)} ideas across ${CITIES.length} places</p>
          <a class="btn sage" href="#explore">${I.shuffle} Pick for me</a>
        </div>
      </section>

      <h2 class="section-title">Trip progress</h2>
      <section class="rings">
        <a class="ring-card" href="#todo">
          ${ring(doneTodos, S.todos.length || 1, "var(--orange)")}
          <div><b>${doneTodos}/${S.todos.length}</b><span>To-dos done</span></div>
        </a>
        <a class="ring-card" href="#itinerary">
          ${ring(daysDone || 0, tl || 1, "var(--blue)")}
          <div><b>${tl ? `${daysDone}/${tl}` : S.items.length}</b><span>${tl ? "Days in Japan" : "Plans saved"}</span></div>
        </a>
      </section>

      ${openTodos.length ? `
      <h2 class="section-title">On your wish list</h2>
      <section class="chip-grid">
        ${openTodos.slice(0, 6).map((x) => `<a class="wish" href="#todo"><span>${x.city && cityById(x.city) ? cityById(x.city).emoji : "✨"}</span>${esc(x.text)}</a>`).join("")}
      </section>` : ""}
      <div class="bottom-pad"></div>`;

    $$("[data-settings]").forEach((b) => (b.onclick = openSettings));
    bindItemClicks($("#view"));
  }

  function ring(v, max, color) {
    const r = 22, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, v / max));
    return `<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" stroke="#F1E6DA" stroke-width="6"/>
      <circle cx="28" cy="28" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 28 28)"/></svg>`;
  }

  /* ================= ITINERARY ================= */
  function renderItinerary() {
    const sub = (location.hash.split("/")[1] || "");
    const dates = tripDates();
    const undated = S.items.filter((i) => !i.date);
    const t = todayISO();

    $("#view").innerHTML = `
      <header class="page-head">
        <div><h1>Itinerary</h1><p class="muted">${S.items.length ? `${S.items.length} plan${S.items.length === 1 ? "" : "s"}${S.profile.start ? " · " + fmtDate(S.profile.start) + (S.profile.end ? " – " + fmtDate(S.profile.end) : "") : ""}` : "Your trip, day by day"}</p></div>
        <div class="head-actions">
          <button class="icon-btn soft" data-import aria-label="Import a document">${I.upload}</button>
          <button class="icon-btn primary" data-add aria-label="Add a plan">${I.plus}</button>
        </div>
      </header>
      ${dates.length ? `
        <div class="date-strip" id="date-strip">
          ${dates.map((d) => {
            const n = itemsOn(d).length, dd = parseISO(d);
            return `<button class="date-chip ${d === t ? "today" : ""}" data-jump="${d}"><span>${WD[dd.getDay()]}</span><b>${dd.getDate()}</b><i class="${n ? "has" : ""}"></i></button>`;
          }).join("")}
        </div>
        <div class="days">
          ${dates.map((d) => dayBlock(d)).join("")}
          ${undated.length ? `<section class="day" id="day-undated"><h3 class="day-head"><span class="day-num">?</span>Unscheduled</h3><div class="timeline">${undated.map((i) => `<div class="tl-row"><div class="tl-time">-</div>${itemCard(i)}</div>`).join("")}</div></section>` : ""}
        </div>
      ` : `
        <section class="empty">
          ${usa("usa-lg bob")}
          <h3>No plans yet!</h3>
          <p class="muted">Upload her itinerary doc (Word, PDF, Excel, calendar) and I'll sort it into days, or add plans one by one.</p>
          <div class="btn-col">
            <button class="btn primary" data-import>${I.upload} Import a document</button>
            <button class="btn ghost" data-add>${I.plus} Add a plan</button>
            <button class="btn link" data-sample>Try with a sample trip</button>
          </div>
        </section>
        ${undated.length ? `<div class="timeline">${undated.map((i) => itemCard(i)).join("")}</div>` : ""}
      `}
      <div class="bottom-pad"></div>`;

    $$("[data-import]").forEach((b) => (b.onclick = openImport));
    $$("[data-add]").forEach((b) => (b.onclick = () => openItemForm()));
    $$("[data-sample]").forEach((b) => (b.onclick = loadSample));
    $$("[data-jump]").forEach((b) => (b.onclick = () => {
      const el = document.getElementById("day-" + b.dataset.jump);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth" });
    }));
    $$("[data-add-day]").forEach((b) => (b.onclick = () => openItemForm({ date: b.dataset.addDay })));
    bindItemClicks($("#view"));

    // scroll strip & page to today
    const strip = $("#date-strip");
    if (strip) {
      const todayChip = $(".date-chip.today", strip);
      if (todayChip) strip.scrollLeft = todayChip.offsetLeft - 16;
      if (dates.includes(t) && !sub) {
        const el = document.getElementById("day-" + t);
        if (el) setTimeout(() => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140 }), 30);
      }
    }
    if (sub === "import") { history.replaceState(null, "", "#itinerary"); openImport(); }
    if (sub === "add") { history.replaceState(null, "", "#itinerary"); openItemForm(); }
  }

  function dayBlock(d) {
    const list = itemsOn(d);
    const hotel = hotelFor(d);
    const n = dayNum(d);
    const isToday = d === todayISO();
    return `<section class="day ${isToday ? "is-today" : ""}" id="day-${d}">
      <h3 class="day-head">
        <span class="day-num">${n && n > 0 ? n : "•"}</span>
        <span>${n && n > 0 ? `Day ${n} · ` : ""}${fmtDate(d, true)}${isToday ? ' <em class="pill pink">Today</em>' : ""}</span>
      </h3>
      ${hotel ? `<div class="stay-banner">🏨 ${hotel.endDate === d ? "Check out of" : "Staying at"} <b>${esc(hotel.title)}</b></div>` : ""}
      <div class="timeline">
        ${list.map((i) => `<div class="tl-row"><div class="tl-time">${i.time ? fmtTime(i.time) : ""}</div>${itemCard(i, { inTimeline: true })}</div>`).join("")}
        <button class="add-to-day ${list.length ? "" : "empty-day"}" data-add-day="${d}">${list.length ? `${I.plus} Add to this day` : `Free day ✨ <span>${I.plus} Add a plan</span>`}</button>
      </div>
    </section>`;
  }

  function openItem(id) {
    const i = S.items.find((x) => x.id === id);
    if (!i) return;
    const ty = TYPES[i.type] || TYPES.activity;
    const n = dayNum(i.date);
    const nights = i.type === "hotel" && i.endDate ? diffDays(i.date, i.endDate) : 0;
    const s = openSheet(`
      <div class="detail">
        <span class="pill t-${i.type}">${ty.emoji} ${ty.label}</span>
        <h2>${esc(i.title)}</h2>
        <div class="facts">
          <div>${I.clock}<span>${i.date ? `${n && n > 0 ? `Day ${n} · ` : ""}${fmtDate(i.date, true)}` : "No date yet"}${i.time ? ` · ${fmtTime(i.time)}${i.endTime ? " – " + fmtTime(i.endTime) : ""}` : ""}</span></div>
          ${nights ? `<div>🌙<span>${nights} night${nights > 1 ? "s" : ""} · check out ${fmtDate(i.endDate)}</span></div>` : i.endDate ? `<div>📅<span>Until ${fmtDate(i.endDate, true)}</span></div>` : ""}
          ${i.location ? `<div>${I.pin}<span>${esc(i.location)}</span></div>` : ""}
          ${i.ref ? `<div>${I.ticket}<span>Booking ref: <b class="ref">${esc(i.ref)}</b> <button class="mini" data-copy="${esc(i.ref)}">${I.copy} Copy</button></span></div>` : ""}
        </div>
        ${i.notes ? `<div class="notes">${esc(i.notes).replace(/\n/g, "<br>")}</div>` : ""}
        <div class="btn-col">
          <a class="btn sky" target="_blank" rel="noopener" href="${mapsUrl(i.location || i.title + ", Japan")}">${I.pin} Open in Google Maps</a>
          <div class="btn-row">
            <button class="btn ghost" data-edit>${I.edit} Edit</button>
            <button class="btn ghost danger-text" data-del>${I.trash} Delete</button>
          </div>
        </div>
      </div>`);
    $("[data-edit]", s.el).onclick = () => { s.close(); openItemForm(i); };
    $("[data-del]", s.el).onclick = () => confirmSheet(`Delete "${i.title}"?`, "Delete", () => {
      S.items = S.items.filter((x) => x.id !== i.id); save(); s.close(); rerender(); toast("Deleted");
    });
    const cp = $("[data-copy]", s.el);
    if (cp) cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(cp.dataset.copy); toast("Copied!"); };
  }

  function openItemForm(item = {}, after) {
    const isEdit = !!item.id;
    const v = Object.assign({ type: "activity", title: "", date: "", time: "", endTime: "", endDate: "", location: "", ref: "", notes: "" }, item);
    if (!v.date && !isEdit) {
      const t = todayISO();
      v.date = S.profile.start && t < S.profile.start ? S.profile.start : t;
    }
    const s = openSheet(`
      <form class="form" id="item-form">
        <h2>${isEdit ? "Edit plan" : "New plan"}</h2>
        <div class="seg type-seg" role="radiogroup">
          ${Object.entries(TYPES).map(([k, t]) => `<label class="seg-opt t-${k}"><input type="radio" name="type" value="${k}" ${v.type === k ? "checked" : ""}><span>${t.emoji}<br>${t.label}</span></label>`).join("")}
        </div>
        <label>What's the plan?<input name="title" required placeholder="e.g. Shinkansen to Kyoto" value="${esc(v.title)}"></label>
        <div class="grid2">
          <label><span data-lbl-date>${v.type === "hotel" ? "Check-in" : "Date"}</span><input type="date" name="date" value="${esc(v.date)}"></label>
          <label class="hotel-only"><span>Check-out</span><input type="date" name="endDate" value="${esc(v.endDate)}"></label>
        </div>
        <div class="grid2">
          <label>Start time<input type="time" name="time" value="${esc(v.time)}"></label>
          <label>End time<input type="time" name="endTime" value="${esc(v.endTime)}"></label>
        </div>
        <label>Location / address<input name="location" placeholder="e.g. Kyoto Station" value="${esc(v.location)}"></label>
        <label>Booking ref<input name="ref" placeholder="Confirmation number" value="${esc(v.ref)}"></label>
        <label>Notes<textarea name="notes" rows="3" placeholder="Seat numbers, what to bring, links...">${esc(v.notes)}</textarea></label>
        <button class="btn primary big" type="submit">${isEdit ? "Save changes" : "Add to itinerary"}</button>
      </form>`);
    const form = $("#item-form", s.el);
    const syncType = () => {
      const ty = form.type.value;
      form.classList.toggle("is-hotel", ty === "hotel");
      $("[data-lbl-date]", form).textContent = ty === "hotel" ? "Check-in" : "Date";
    };
    $$("input[name=type]", form).forEach((r) => (r.onchange = syncType));
    syncType();
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const data = {
        type: f.type, title: f.title.trim(), date: f.date, time: f.time, endTime: f.endTime,
        endDate: f.type === "hotel" ? f.endDate : (v.endDate || ""), location: f.location.trim(), ref: f.ref.trim(), notes: f.notes.trim(),
      };
      if (data.endDate && data.date && data.endDate <= data.date) data.endDate = "";
      if (isEdit) Object.assign(S.items.find((x) => x.id === item.id), data);
      else S.items.push(Object.assign({ id: uid(), created: Date.now() }, data, item.fromTodo ? { fromTodo: item.fromTodo } : {}));
      save(); s.close();
      toast(isEdit ? "Saved ✨" : "Added to your itinerary ✨");
      if (after) after(); else rerender();
    };
  }

  /* ================= IMPORT ================= */
  const SAMPLE_TEXT = `Monday 7 December
10:30am Land at Narita - flight QF79
1:00pm Narita Express to Shinjuku
3:00pm Check in: Hotel Gracery Shinjuku (4 nights)
Booking ref: 8XK2LQ
7:00pm Dinner at Omoide Yokocho

Tuesday 8 December
8:00 - 10:00 Tsukiji Outer Market breakfast
11am teamLab Planets
Address: 6-1-16 Toyosu, Koto City
6pm Shibuya Sky sunset

Friday 11 December
9:00am Shinkansen Nozomi to Kyoto
Platform 14, car 7 seats 12A-B
3pm Check in Kyoto Ryokan
Fushimi Inari at sunset`;

  function openImport() {
    const s = openSheet(`
      <div class="import">
        <h2>Import plans</h2>
        <p class="muted">Upload an itinerary and I'll sort it into days and times. You can check everything before it's added.</p>
        <label class="dropzone" id="dropzone">
          <input type="file" id="file-in" accept=".docx,.pdf,.xlsx,.csv,.tsv,.txt,.md,.ics,text/plain,text/calendar,application/pdf">
          ${usa("usa-sm")}
          <b>Choose a file</b>
          <span>Word, PDF, Excel, CSV, text or calendar (.ics)</span>
        </label>
        <div class="or"><span>or paste it</span></div>
        <textarea id="paste-in" rows="6" placeholder="Paste your itinerary here..."></textarea>
        <div class="btn-row">
          <button class="btn link" id="sample-btn">Use example</button>
          <button class="btn primary" id="paste-go">Read text</button>
        </div>
        <details class="help">
          <summary>What format works best?</summary>
          <p>Anything with dates and times works. For example:</p>
          <pre>Tuesday 8 December
9:00am Tsukiji Market breakfast
2pm - 4pm teamLab Planets
Address: Toyosu, Tokyo
Check in: Hotel Gracery (3 nights)</pre>
          <p>Tables with columns like <b>Date</b>, <b>Time</b>, <b>Activity</b>, <b>Location</b> and <b>Notes</b> work great too. From Google Docs, use <i>File → Download → Word (.docx)</i> or just copy and paste.</p>
        </details>
      </div>`, { cls: "tall" });
    const fileIn = $("#file-in", s.el);
    const opts = () => ({ tripStart: S.profile.start, tripEnd: S.profile.end });
    const go = async (fn) => {
      const dz = $("#dropzone", s.el);
      dz.classList.add("loading");
      try {
        const res = await fn();
        if (!res.items.length) {
          toast("Hmm, I couldn't find any plans in there. Try pasting the text instead.");
          if (res.text) $("#paste-in", s.el).value = res.text.slice(0, 20000);
          return;
        }
        s.close();
        openReview(res.items);
      } catch (err) {
        console.error(err);
        toast(err.message || "Couldn't read that file.");
      } finally { dz.classList.remove("loading"); }
    };
    fileIn.onchange = () => { const f = fileIn.files[0]; if (f) go(() => TabiImporter.importFile(f, opts())); };
    const dz = $("#dropzone", s.el);
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("over"));
    dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) go(() => TabiImporter.importFile(f, opts())); });
    $("#sample-btn", s.el).onclick = () => { $("#paste-in", s.el).value = SAMPLE_TEXT; };
    $("#paste-go", s.el).onclick = () => {
      const txt = $("#paste-in", s.el).value;
      if (!txt.trim()) return toast("Paste some text first");
      go(async () => ({ items: /BEGIN:VCALENDAR/.test(txt) ? TabiImporter.parseICS(txt) : TabiImporter.parseText(txt, opts()), text: txt }));
    };
  }

  function openReview(items) {
    items = items.map((x) => Object.assign({ _keep: true, _id: uid() }, x));
    const s = openSheet(`<div class="review"><h2>Found ${items.length} plan${items.length === 1 ? "" : "s"}!</h2>
      <p class="muted">Check them over. Tap a field to fix it, or untick anything you don't want.</p>
      <div id="rv-list"></div>
      ${S.items.length ? `<label class="check-line"><input type="checkbox" id="rv-replace"> Replace my current itinerary (${S.items.length} plans)</label>` : ""}
      <div class="sticky-foot"><button class="btn primary big" id="rv-go"></button></div></div>`, { cls: "tall" });
    const list = $("#rv-list", s.el);
    const draw = () => {
      list.innerHTML = items.map((x) => `
        <div class="rv-item t-${x.type} ${x._keep ? "" : "off"}" data-rid="${x._id}">
          <label class="rv-keep"><input type="checkbox" data-k="_keep" ${x._keep ? "checked" : ""}><span>${I.check}</span></label>
          <div class="rv-fields">
            <input class="rv-title" data-k="title" value="${esc(x.title)}">
            <div class="rv-row">
              <select data-k="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${x.type === k ? "selected" : ""}>${t.emoji} ${t.label}</option>`).join("")}</select>
              <input type="date" data-k="date" value="${esc(x.date)}" class="${x.date ? "" : "warn"}">
              <input type="time" data-k="time" value="${esc(x.time)}">
            </div>
            ${x.location || x.notes || x.ref ? `<div class="rv-extra">${[x.location && "📍 " + esc(x.location), x.ref && "🎫 " + esc(x.ref), x.notes && "📝 " + esc(x.notes).replace(/\n/g, " · ")].filter(Boolean).join("<br>")}</div>` : ""}
          </div>
        </div>`).join("");
      updateBtn();
    };
    const updateBtn = () => {
      const n = items.filter((x) => x._keep).length;
      const b = $("#rv-go", s.el);
      b.textContent = n ? `Add ${n} plan${n === 1 ? "" : "s"} ✨` : "Nothing selected";
      b.disabled = !n;
    };
    list.addEventListener("input", (e) => {
      const row = e.target.closest("[data-rid]"); if (!row) return;
      const x = items.find((y) => y._id === row.dataset.rid);
      const k = e.target.dataset.k;
      if (k === "_keep") { x._keep = e.target.checked; row.classList.toggle("off", !x._keep); updateBtn(); }
      else { x[k] = e.target.value; if (k === "type") { row.className = `rv-item t-${x.type}`; } if (k === "date") e.target.classList.toggle("warn", !x.date); }
    });
    draw();
    $("#rv-go", s.el).onclick = () => {
      const keep = items.filter((x) => x._keep).map(({ _keep, _id, ...rest }) => Object.assign({ id: uid(), created: Date.now() }, rest));
      const replace = $("#rv-replace", s.el) && $("#rv-replace", s.el).checked;
      if (replace) S.items = [];
      S.items.push(...keep);
      // set trip dates from the plans if they're not set yet
      const ds = S.items.map((i) => i.date).filter(Boolean).sort();
      if (ds.length && !S.profile.start) { S.profile.start = ds[0]; S.profile.end = ds[ds.length - 1]; }
      save(); s.close();
      toast(`Added ${keep.length} plan${keep.length === 1 ? "" : "s"} 🎉`);
      if (location.hash !== "#itinerary") location.hash = "#itinerary"; else rerender();
    };
  }

  function loadSample() {
    const start = S.profile.start || addDays(todayISO(), 14);
    if (!S.profile.start) { S.profile.start = start; S.profile.end = addDays(start, 9); }
    const d = (n) => addDays(start, n);
    const add = (o) => S.items.push(Object.assign({ id: uid(), created: Date.now(), time: "", endTime: "", endDate: "", location: "", ref: "", notes: "" }, o));
    add({ type: "travel", title: "Land at Narita Airport", date: d(0), time: "10:30", ref: "QF79", notes: "Pick up Suica card and pocket wifi in arrivals" });
    add({ type: "travel", title: "Narita Express to Shinjuku", date: d(0), time: "12:15", endTime: "13:45", location: "Narita Airport Terminal 1" });
    add({ type: "hotel", title: "Hotel Gracery Shinjuku", date: d(0), endDate: d(4), time: "15:00", location: "1-19-1 Kabukicho, Shinjuku", ref: "8XK2LQ" });
    add({ type: "food", title: "Yakitori at Omoide Yokocho", date: d(0), time: "19:00", location: "Omoide Yokocho, Shinjuku" });
    add({ type: "food", title: "Tsukiji Outer Market breakfast", date: d(1), time: "08:00", endTime: "10:00", location: "Tsukiji Outer Market" });
    add({ type: "activity", title: "teamLab Planets", date: d(1), time: "11:00", location: "teamLab Planets Toyosu", notes: "Wear shorts, you wade through water!" });
    add({ type: "activity", title: "Shibuya Sky sunset", date: d(1), time: "17:00", location: "Shibuya Scramble Square", ref: "SKY-22931" });
    add({ type: "activity", title: "Senso-ji & Asakusa", date: d(2), time: "07:30", location: "Senso-ji, Asakusa" });
    add({ type: "travel", title: "Shinkansen Nozomi to Kyoto", date: d(4), time: "09:00", endTime: "11:15", location: "Tokyo Station", notes: "Car 7, seats 12A & 12B" });
    add({ type: "hotel", title: "Kyoto Ryokan", date: d(4), endDate: d(7), time: "15:00", location: "Gion, Kyoto" });
    add({ type: "activity", title: "Fushimi Inari sunrise hike", date: d(5), time: "06:30", location: "Fushimi Inari Taisha" });
    save(); rerender(); toast("Sample trip loaded. Delete anything you like!");
  }

  /* ================= EXPLORE ================= */
  let lastPicks = [];
  const recentlyShown = {};
  function renderExplore() {
    const ex = S.explore;
    const city = cityById(ex.city) || CITIES[0];
    const pool = filteredActs(city);
    $("#view").innerHTML = `
      <header class="page-head">
        <div><h1>Explore</h1><p class="muted">Can't decide? Let Momo pick for you!</p></div>
      </header>
      <div class="city-strip" id="city-strip">
        ${CITIES.map((c) => `<button class="city-chip ${c.id === city.id ? "active" : ""}" data-city="${c.id}"><span class="ce">${c.emoji}</span><span>${esc(c.name)}</span></button>`).join("")}
      </div>
      <section class="card city-card">
        <div class="city-top">
          <div>
            <h2>${esc(city.name)} <small>${city.jp}</small></h2>
            <p class="muted">${esc(city.blurb)}</p>
          </div>
        </div>
        <div class="seg small" id="kind-seg">
          ${[["any", "Anything"], ["popular", "⭐ Popular"], ["hidden", "💎 Hidden"]].map(([k, l]) => `<button class="${ex.kind === k ? "on" : ""}" data-kind="${k}">${l}</button>`).join("")}
        </div>
        <div class="cat-row">
          <button class="cat ${ex.cat === "all" ? "on" : ""}" data-cat="all">All</button>
          ${Object.entries(CATS).filter(([k]) => city.acts.some((a) => a.cat === k)).map(([k, c]) => `<button class="cat ${ex.cat === k ? "on" : ""}" data-cat="${k}">${c.emoji} ${c.label}</button>`).join("")}
        </div>
        <button class="btn primary big spin-btn" id="spin" ${pool.length ? "" : "disabled"}>
          ${I.shuffle} ${lastPicks.length && lastPicks[0].city === city.id ? "Shuffle again" : "Pick 3 for me!"}
        </button>
        <p class="fine center">${pool.length} idea${pool.length === 1 ? "" : "s"} match</p>
      </section>
      <section class="picks" id="picks">${lastPicks.length && lastPicks[0].city === city.id ? picksHTML(lastPicks) : `
        <div class="picks-empty">${usa("usa-md bob")}<p>Press the button and I'll pick three things to do in ${esc(city.name)}!</p></div>`}
      </section>
      <details class="browse">
        <summary>Browse all ${city.acts.length} ideas in ${esc(city.name)}</summary>
        <div class="browse-list">${city.acts.map((a) => actRow(a)).join("")}</div>
      </details>
      <div class="bottom-pad"></div>`;

    const strip = $("#city-strip");
    const active = $(".city-chip.active", strip);
    if (active) strip.scrollLeft = active.offsetLeft - 16;
    $$("[data-city]").forEach((b) => (b.onclick = () => { S.explore.city = b.dataset.city; S.explore.cat = "all"; save(); lastPicks = []; const sl = strip.scrollLeft; renderExplore(); $("#city-strip").scrollLeft = sl; }));
    $$("[data-kind]").forEach((b) => (b.onclick = () => { S.explore.kind = b.dataset.kind; save(); keepScroll(renderExplore); }));
    $$("[data-cat]").forEach((b) => (b.onclick = () => { S.explore.cat = b.dataset.cat; save(); keepScroll(renderExplore); }));
    $("#spin").onclick = spin;
    bindActClicks($("#view"));
  }
  function keepScroll(fn) {
    const y = window.scrollY, sl = $("#city-strip") ? $("#city-strip").scrollLeft : 0;
    fn(); window.scrollTo(0, y); if ($("#city-strip")) $("#city-strip").scrollLeft = sl;
  }
  function filteredActs(city) {
    const { kind, cat } = S.explore;
    return city.acts.filter((a) => (kind === "any" || a.kind === kind) && (cat === "all" || a.cat === cat));
  }
  function spin() {
    const city = cityById(S.explore.city) || CITIES[0];
    const pool = filteredActs(city);
    if (!pool.length) return;
    const seen = recentlyShown[city.id] || (recentlyShown[city.id] = []);
    let fresh = pool.filter((a) => !seen.includes(a.id));
    if (fresh.length < Math.min(3, pool.length)) { seen.length = 0; fresh = pool.slice(); }
    const picks = [];
    const bag = fresh.slice();
    while (picks.length < 3 && bag.length) picks.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    // top up from the wider pool if needed
    const rest = pool.filter((a) => !picks.includes(a));
    while (picks.length < Math.min(3, pool.length) && rest.length) picks.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
    seen.push(...picks.map((p) => p.id));
    lastPicks = picks;

    const box = $("#picks");
    const btn = $("#spin");
    btn.disabled = true;
    box.innerHTML = `<div class="shuffling">${[0, 1, 2].map((n) => `<div class="pick ghost-card" style="animation-delay:${n * 90}ms">${["🎲", "🎴", "🎐"][n]}</div>`).join("")}</div>`;
    if (navigator.vibrate) navigator.vibrate(15);
    setTimeout(() => {
      box.innerHTML = picksHTML(picks, true);
      bindActClicks(box);
      btn.disabled = false;
      btn.innerHTML = `${I.shuffle} Shuffle again`;
    }, 650);
  }
  function picksHTML(picks, animate) {
    return picks.map((a, n) => {
      const c = CATS[a.cat];
      const saved = S.todos.some((t) => t.actId === a.id);
      return `<button class="pick c-${a.cat} ${animate ? "pop" : ""}" style="animation-delay:${n * 110}ms" data-act="${a.id}">
        <span class="pick-num">${n + 1}</span>
        <span class="pick-emoji">${c.emoji}</span>
        <span class="pick-body">
          <span class="pick-name">${esc(a.name)}</span>
          <span class="pick-meta">${esc(a.area)} · ${esc(a.dur)}</span>
          <span class="pick-tags"><em class="tag ${a.kind}">${a.kind === "hidden" ? "💎 Hidden gem" : "⭐ Popular"}</em><em class="tag">${c.label}</em>${saved ? '<em class="tag saved">✓ On to-do</em>' : ""}</span>
        </span>
      </button>`;
    }).join("");
  }
  function actRow(a) {
    const c = CATS[a.cat];
    return `<button class="act-row" data-act="${a.id}"><span>${c.emoji}</span><span class="ar-name">${esc(a.name)}${a.kind === "hidden" ? " 💎" : ""}</span><span class="ar-meta">${esc(a.dur)}</span></button>`;
  }
  function bindActClicks(el) { $$("[data-act]", el).forEach((b) => (b.onclick = () => openAct(b.dataset.act))); }

  function openAct(id) {
    const a = actById(id);
    if (!a) return;
    const city = cityById(a.city);
    const c = CATS[a.cat];
    const existing = S.todos.find((t) => t.actId === a.id);
    const s = openSheet(`
      <div class="detail act-detail c-${a.cat}">
        <div class="act-hero"><span>${c.emoji}</span></div>
        <div class="pill-row"><span class="tag ${a.kind}">${a.kind === "hidden" ? "💎 Hidden gem" : "⭐ Popular"}</span><span class="tag">${c.label}</span><span class="tag">${city.emoji} ${esc(city.name)}</span></div>
        <h2>${esc(a.name)}</h2>
        <div class="info-grid">
          <div><small>Area</small><b>${esc(a.area)}</b></div>
          <div><small>Time</small><b>${esc(a.dur)}</b></div>
          <div><small>Cost</small><b>${esc(a.cost)}</b></div>
        </div>
        <h4>What you'll do</h4>
        <p>${esc(a.desc)}</p>
        <div class="tip"><b>💡 Tip</b><p>${esc(a.tip)}</p></div>
        <div class="btn-col">
          <button class="btn ${existing ? "ghost" : "primary"}" data-todo>${existing ? "✓ On your to-do list" : `${I.plus} Add to to-do list`}</button>
          <button class="btn sage" data-itin>${I.plus} Add to itinerary</button>
          <a class="btn sky" target="_blank" rel="noopener" href="${mapsUrl(a.name + ", " + a.area + ", " + city.name + ", Japan")}">${I.pin} Open in Google Maps</a>
        </div>
        <p class="fine">Hours and prices change. Check before you go!</p>
      </div>`);
    $("[data-todo]", s.el).onclick = (e) => {
      if (S.todos.some((t) => t.actId === a.id)) return;
      S.todos.unshift({ id: uid(), text: a.name, city: a.city, notes: "", done: false, actId: a.id, created: Date.now() });
      save();
      e.currentTarget.className = "btn ghost";
      e.currentTarget.innerHTML = "✓ On your to-do list";
      toast("Added to your to-do list 📝");
      refreshPicks();
    };
    $("[data-itin]", s.el).onclick = () => {
      s.close();
      openItemForm({ type: a.cat === "food" ? "food" : "activity", title: a.name, location: `${a.name}, ${a.area}, ${city.name}`, notes: a.tip }, () => rerender());
    };
  }
  function refreshPicks() {
    const box = $("#picks");
    if (box && lastPicks.length && location.hash.startsWith("#explore")) { box.innerHTML = picksHTML(lastPicks); bindActClicks(box); }
  }

  /* ================= TO-DO ================= */
  let todoFilter = "open";
  function renderTodo() {
    const all = S.todos;
    const done = all.filter((t) => t.done).length;
    const list = all.filter((t) => (todoFilter === "all" ? true : todoFilter === "done" ? t.done : !t.done));
    const groups = {};
    list.forEach((t) => { const k = t.city && cityById(t.city) ? t.city : "_"; (groups[k] = groups[k] || []).push(t); });
    const order = Object.keys(groups).sort((a, b) => (a === "_" ? 1 : b === "_" ? -1 : CITIES.findIndex((c) => c.id === a) - CITIES.findIndex((c) => c.id === b)));
    const pct = all.length ? Math.round((done / all.length) * 100) : 0;

    $("#view").innerHTML = `
      <header class="page-head">
        <div><h1>To-do</h1><p class="muted">Things you want to do in Japan</p></div>
      </header>
      <section class="card progress-card">
        <div class="row between"><b>${done} of ${all.length} done</b><span class="pill sage">${pct}%</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </section>
      <form class="add-todo card" id="todo-form">
        <input name="text" placeholder="I want to..." autocomplete="off" required>
        <div class="row">
          <select name="city" aria-label="City">
            <option value="">📍 Anywhere</option>
            ${CITIES.map((c) => `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join("")}
          </select>
          <button class="btn primary" type="submit">${I.plus} Add</button>
        </div>
      </form>
      <div class="seg small filter-seg">
        ${[["open", "To do"], ["done", "Done"], ["all", "All"]].map(([k, l]) => `<button class="${todoFilter === k ? "on" : ""}" data-filter="${k}">${l}</button>`).join("")}
      </div>
      ${list.length ? order.map((k) => {
        const c = cityById(k);
        return `<h3 class="group-head">${c ? `${c.emoji} ${esc(c.name)}` : "✨ Anywhere"}</h3>
          <div class="todo-list">${groups[k].map(todoRow).join("")}</div>`;
      }).join("") : `
        <section class="empty small">
          ${usa("usa-md bob")}
          <p class="muted">${todoFilter === "done" ? "Nothing ticked off yet. Go have fun!" : all.length ? "All done! You legend. 🎉" : "Add things you want to do, or find ideas in Explore."}</p>
          ${!all.length ? `<a class="btn sage" href="#explore">${I.sparkle} Get ideas</a>` : ""}
        </section>`}
      <div class="bottom-pad"></div>`;

    const form = $("#todo-form");
    form.city.value = S.explore.lastTodoCity || "";
    form.onsubmit = (e) => {
      e.preventDefault();
      const text = form.text.value.trim();
      if (!text) return;
      S.todos.unshift({ id: uid(), text, city: form.city.value, notes: "", done: false, created: Date.now() });
      S.explore.lastTodoCity = form.city.value;
      save();
      if (todoFilter === "done") todoFilter = "open";
      renderTodo();
      $("#todo-form input[name=text]").focus();
    };
    $$("[data-filter]").forEach((b) => (b.onclick = () => { todoFilter = b.dataset.filter; renderTodo(); }));
    $$("[data-toggle]").forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const t = S.todos.find((x) => x.id === b.dataset.toggle);
      t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
      save();
      if (t.done) { toast(["Yatta! 🎉", "Sugoi! ✨", "Nice one! 🙌", "Ticked off! 💮"][Math.floor(Math.random() * 4)]); if (navigator.vibrate) navigator.vibrate([10, 40, 10]); }
      const row = b.closest(".todo");
      row.classList.toggle("done", t.done);
      setTimeout(() => keepScroll(renderTodo), todoFilter === "all" ? 0 : 450);
    }));
    $$("[data-todo]").forEach((b) => (b.onclick = () => openTodo(b.dataset.todo)));
  }
  function todoRow(t) {
    return `<div class="todo ${t.done ? "done" : ""}">
      <button class="tick" data-toggle="${t.id}" aria-label="${t.done ? "Mark not done" : "Mark done"}">${I.check}</button>
      <button class="todo-text" data-todo="${t.id}">
        <span>${esc(t.text)}</span>
        ${t.notes ? `<small>${esc(t.notes)}</small>` : t.actId && actById(t.actId) ? `<small>${esc(actById(t.actId).area)} · ${esc(actById(t.actId).dur)}</small>` : ""}
      </button>
    </div>`;
  }
  function openTodo(id) {
    const t = S.todos.find((x) => x.id === id);
    if (!t) return;
    const a = t.actId ? actById(t.actId) : null;
    const s = openSheet(`
      <form class="form" id="todo-edit">
        <h2>To-do</h2>
        <label>What<input name="text" required value="${esc(t.text)}"></label>
        <label>Where
          <select name="city"><option value="">📍 Anywhere</option>${CITIES.map((c) => `<option value="${c.id}" ${t.city === c.id ? "selected" : ""}>${c.emoji} ${esc(c.name)}</option>`).join("")}</select>
        </label>
        <label>Notes<textarea name="notes" rows="3" placeholder="Links, who recommended it, opening hours...">${esc(t.notes || "")}</textarea></label>
        ${a ? `<button type="button" class="btn ghost" data-details>${CATS[a.cat].emoji} See idea details</button>` : ""}
        <button type="button" class="btn sage" data-itin>${I.plus} Schedule it in the itinerary</button>
        <div class="btn-row">
          <button type="button" class="btn ghost danger-text" data-del>${I.trash} Delete</button>
          <button class="btn primary" type="submit">Save</button>
        </div>
      </form>`);
    const form = $("#todo-edit", s.el);
    form.onsubmit = (e) => {
      e.preventDefault();
      t.text = form.text.value.trim(); t.city = form.city.value; t.notes = form.notes.value.trim();
      save(); s.close(); keepScroll(renderTodo);
    };
    $("[data-del]", s.el).onclick = () => confirmSheet(`Delete "${t.text}"?`, "Delete", () => {
      S.todos = S.todos.filter((x) => x.id !== t.id); save(); s.close(); keepScroll(renderTodo);
    });
    const det = $("[data-details]", s.el);
    if (det) det.onclick = () => openAct(a.id);
    $("[data-itin]", s.el).onclick = () => {
      s.close();
      const city = cityById(t.city);
      openItemForm({
        type: a && a.cat === "food" ? "food" : "activity", title: t.text,
        location: a ? `${a.name}, ${a.area}, ${city ? city.name : ""}` : city ? city.name : "",
        notes: t.notes || (a ? a.tip : ""), fromTodo: t.id,
      }, () => keepScroll(renderTodo));
    };
  }

  /* ================= SETTINGS ================= */
  function openSettings() {
    const p = S.profile;
    const s = openSheet(`
      <form class="form" id="settings">
        <div class="settings-head">${usa("usa-sm")}<h2>Settings</h2></div>
        <label>Your name<input name="name" value="${esc(p.name)}"></label>
        <label>Trip name<input name="trip" value="${esc(p.trip)}"></label>
        <div class="grid2">
          <label>Trip starts<input type="date" name="start" value="${esc(p.start)}"></label>
          <label>Trip ends<input type="date" name="end" value="${esc(p.end)}"></label>
        </div>
        <button class="btn primary" type="submit">Save</button>

        <h4>Backup</h4>
        <p class="fine">Your plans live on this phone only. Save a backup file now and then (or before switching phones).</p>
        <div class="btn-row">
          <button type="button" class="btn ghost" data-export>⬇️ Save backup</button>
          <label class="btn ghost file-btn">⬆️ Restore<input type="file" accept=".json,application/json" data-restore hidden></label>
        </div>

        <h4>Install on your phone</h4>
        <p class="fine"><b>iPhone:</b> open in Safari → Share button → <i>Add to Home Screen</i>.<br><b>Android:</b> Chrome menu ⋮ → <i>Add to Home screen</i> / <i>Install app</i>.<br>It then works offline too.</p>

        <h4>Start over</h4>
        <div class="btn-row">
          <button type="button" class="btn ghost danger-text" data-clear-items>Clear itinerary</button>
          <button type="button" class="btn ghost danger-text" data-reset>Reset everything</button>
        </div>
        <p class="fine center">Made with 💖 for your trip · 旅人</p>
      </form>`);
    const form = $("#settings", s.el);
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      Object.assign(S.profile, { name: f.name.trim(), trip: f.trip.trim(), start: f.start, end: f.end });
      if (S.profile.start && S.profile.end && S.profile.end < S.profile.start) [S.profile.start, S.profile.end] = [S.profile.end, S.profile.start];
      save(); s.close(); rerender(); toast("Saved ✨");
    };
    $("[data-export]", s.el).onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tabibito-backup-${todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $("[data-restore]", s.el).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || !Array.isArray(data.items)) throw new Error();
        S = Object.assign(blank(), data); save(); s.close(); rerender(); toast("Backup restored 🎉");
      } catch (err) { toast("That doesn't look like a Tabibito backup file."); }
    };
    $("[data-clear-items]", s.el).onclick = () => confirmSheet("Delete every plan in the itinerary?", "Clear it", () => { S.items = []; save(); s.close(); rerender(); toast("Itinerary cleared"); });
    $("[data-reset]", s.el).onclick = () => confirmSheet("Reset everything? This deletes all plans and to-dos.", "Reset", () => { S = blank(); save(); closeAllSheets(); location.hash = ""; route(); });
  }

  /* ================= boot ================= */
  route();
  // refresh "up next" countdown every minute on home
  setInterval(() => { if (!sheetStack.length && S.onboarded && (location.hash === "#home" || !location.hash)) renderHome(); }, 60000);

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
