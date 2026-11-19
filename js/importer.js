/* Turns an uploaded document (or pasted text) into itinerary items.
 * Supports: .docx, .pdf, .xlsx, .csv/.tsv, .txt/.md, .ics
 * Everything runs in the browser, so nothing is uploaded anywhere.
 */
(function () {
  const MONTHS = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
    september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const MON_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const WEEKDAY_RE = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|nesday|sday|urday|rsday)?\b\.?,?/gi;

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const validDate = (y, m, d) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getMonth() === m - 1 && dt.getDate() === d;
  };

  /* ---------- type detection ---------- */
  const TYPE_WORDS = {
    travel: /\b(flight|fly|flying|airport|depart|departure|arrive|arrival|land(?:ing)?|train|shinkansen|jr\b|bus|coach|ferry|transfer|taxi|uber|drive|car hire|rental car|metro|subway|limousine|narita express|n'ex|haruka|skyliner|platform|gate\s?\d|terminal|nozomi|hikari|kodama|tokaido|travel to|head to|go to .* station)\b|✈|🚄|🚆/i,
    hotel: /\b(hotel|hostel|ryokan|airbnb|check[\s-]?in|check[\s-]?out|stay(?:ing)? at|accommodation|lodge|inn|guesthouse|minshuku|capsule|apartment|resort|nights?\b)|🏨/i,
    food: /\b(breakfast|brunch|lunch|dinner|supper|restaurant|caf[eé]|coffee|ramen|sushi|izakaya|yakitori|omakase|kaiseki|tempura|okonomiyaki|takoyaki|food tour|eat|bar\b|drinks?|reservation at|teppanyaki|wagyu|bbq|market)\b|🍜|🍣/i,
  };
  function guessType(text) {
    const t = text.toLowerCase();
    // order matters: hotel check-in lines often also say "arrive"
    if (/\bcheck[\s-]?(in|out)\b/.test(t) && !/\b(flight|shinkansen|train)\b/.test(t)) return "hotel";
    if (/\b(breakfast|brunch|lunch|dinner|supper)\b/.test(t)) return "food";
    if (/\b(hotel|ryokan|hostel|airbnb)\b/.test(t) && !/\b(flight|shinkansen|train|bus|taxi)\b/.test(t)) return "hotel";
    if (TYPE_WORDS.travel.test(t)) return "travel";
    if (TYPE_WORDS.hotel.test(t)) return "hotel";
    if (TYPE_WORDS.food.test(t)) return "food";
    return "activity";
  }

  /* ---------- time parsing ---------- */
  // 9:30, 09.30, 9am, 9:30pm, 14:00, 9h30, noon
  const TIME_TOKEN = "(?:(?:[01]?\\d|2[0-3])[:.h][0-5]\\d\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?|(?:1[0-2]|0?[1-9])\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)|noon|midday|midnight)";
  const TIME_RANGE_RE = new RegExp(`(${TIME_TOKEN})(?:\\s*(?:-|–|—|to|until|till)\\s*(${TIME_TOKEN}))?`, "i");

  function normTime(tok) {
    if (!tok) return "";
    let s = tok.toLowerCase().replace(/\./g, (m, i, str) => (/\d/.test(str[i - 1] || "") && /\d/.test(str[i + 1] || "") ? ":" : "")).replace(/\s+/g, "");
    if (s === "noon" || s === "midday") return "12:00";
    if (s === "midnight") return "00:00";
    s = s.replace("h", ":");
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
    if (!m) return "";
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return "";
    return `${pad(h)}:${pad(min)}`;
  }

  const SHORT_RANGE_RE = /(?<![\d:/.])(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|—|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i;
  function findTimes(line) {
    const sr = line.match(SHORT_RANGE_RE);
    if (sr) {
      const endT = normTime(sr[3] + (sr[4] ? ":" + sr[4] : "") + sr[5]);
      let startT = normTime(sr[1] + (sr[2] ? ":" + sr[2] : "") + sr[5]);
      if (startT && endT && startT > endT) startT = normTime(sr[1] + (sr[2] ? ":" + sr[2] : "") + "am");
      if (startT) return { start: startT, end: endT, raw: sr[0], index: sr.index };
    }
    const m = line.match(TIME_RANGE_RE);
    if (!m) return null;
    let start = normTime(m[1]);
    let end = normTime(m[2]);
    // "2-4pm": apply pm from end to start
    if (m[2] && /pm/i.test(m[2]) && !/am|pm/i.test(m[1])) {
      const s = normTime(m[1] + "pm");
      if (s && (!end || s < end)) start = s;
    }
    if (!start) return null;
    return { start, end, raw: m[0], index: m.index };
  }

  // bare "9-11" style ranges are too ambiguous; only accept them at the line start
  const LEADING_HOUR_RANGE = /^\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(am|pm)\b/i;

  /* ---------- date parsing ---------- */
  function makeYearResolver(opts) {
    const start = opts.tripStart ? new Date(opts.tripStart + "T00:00") : null;
    const end = opts.tripEnd ? new Date(opts.tripEnd + "T00:00") : null;
    const today = new Date();
    return function (m, d) {
      const candidates = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2];
      if (start) {
        const lo = new Date(start); lo.setDate(lo.getDate() - 45);
        const hi = new Date(end || start); hi.setDate(hi.getDate() + 45);
        for (const y of candidates) {
          const dt = new Date(y, m - 1, d);
          if (dt >= lo && dt <= hi) return y;
        }
      }
      // otherwise: the next time this date happens (allowing a couple of months in the past)
      const floor = new Date(today); floor.setDate(floor.getDate() - 60);
      for (const y of candidates) {
        if (new Date(y, m - 1, d) >= floor) return y;
      }
      return today.getFullYear();
    };
  }

  function addDays(isoDate, n) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d + n);
    return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }

  /* Returns {date, endDate, raw, index} or null */
  function findDate(line, resolveYear, opts) {
    let m;
    // 2026-12-05
    m = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (m && validDate(+m[1], +m[2], +m[3])) return { date: iso(+m[1], +m[2], +m[3]), raw: m[0], index: m.index };

    // 2026年12月5日 / 12月5日
    m = line.match(/(?:(20\d{2})年)?\s*(\d{1,2})月\s*(\d{1,2})日/);
    if (m) {
      const y = m[1] ? +m[1] : resolveYear(+m[2], +m[3]);
      if (validDate(y, +m[2], +m[3])) return { date: iso(y, +m[2], +m[3]), raw: m[0], index: m.index };
    }

    // 5 Dec 2026, 5th December, 5-8 Dec, 5 – 8 December
    m = line.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|—|to)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\s+(?:of\\s+)?${MON_RE}\\.?,?(?:\\s+'?(\\d{4}|\\d{2})\\b)?`, "i"));
    if (m) {
      const mon = MONTHS[m[3].toLowerCase()] || MONTHS[m[3].toLowerCase().slice(0, 3)];
      const d = +m[1];
      let y = m[4] ? +m[4] : resolveYear(mon, d);
      if (y < 100) y += 2000;
      if (validDate(y, mon, d)) {
        const out = { date: iso(y, mon, d), raw: m[0], index: m.index };
        if (m[2] && validDate(y, mon, +m[2]) && +m[2] > d) out.endDate = iso(y, mon, +m[2]);
        return out;
      }
    }

    // Dec 5, December 5th 2026, Dec 5-8
    m = line.match(new RegExp(`\\b${MON_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|—|to)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?,?(?:\\s+(\\d{4}))?\\b`, "i"));
    if (m) {
      const mon = MONTHS[m[1].toLowerCase()] || MONTHS[m[1].toLowerCase().slice(0, 3)];
      const d = +m[2];
      const y = m[4] ? +m[4] : resolveYear(mon, d);
      if (validDate(y, mon, d)) {
        const out = { date: iso(y, mon, d), raw: m[0], index: m.index };
        if (m[3] && validDate(y, mon, +m[3]) && +m[3] > d) out.endDate = iso(y, mon, +m[3]);
        return out;
      }
    }

    // 05/12/2026, 5/12, 5.12.26  (day first unless that's impossible)
    m = line.match(/(?<![\d:.])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?!\d)/) || line.match(/(?<![\d:.])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/);
    if (m) {
      let a = +m[1], b = +m[2];
      let d = a, mon = b;
      if (opts.monthFirst || (b > 12 && a <= 12)) { d = b; mon = a; }
      let y = m[3] ? +m[3] : resolveYear(mon, d);
      if (y < 100) y += 2000;
      if (validDate(y, mon, d)) return { date: iso(y, mon, d), raw: m[0], index: m.index };
    }

    // Day 3
    m = line.match(/\bday\s*(\d{1,2})\b/i);
    if (m && opts.tripStart) {
      return { date: addDays(opts.tripStart, +m[1] - 1), raw: m[0], index: m.index, dayN: true };
    }
    return null;
  }

  /* ---------- cleaning ---------- */
  function cleanTitle(s) {
    return s
      .replace(WEEKDAY_RE, " ")
      .replace(/^[\s•◦▪●○■□➤➢►▶→\-–—*·>|#]+/, "")
      .replace(/^\s*\d{1,2}[.)]\s+/, "")
      .replace(/^\s*(?:at|@|from)\s+/i, "")
      .replace(/\s*[|]\s*/g, " · ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s:,;.\-–—·]+|[\s:,;\-–—·]+$/g, "")
      .replace(/\s+(?:at|@|from|by|on|until|till|-)$/i, "")
      .replace(/\(\s*\)/g, "")
      .trim();
  }
  // tidy hotel titles: "Check in: Hotel X (4 nights)" -> "Hotel X", endDate +4
  function tidyHotel(item) {
    if (item.type !== "hotel") return;
    const n = item.title.match(/\(?\s*(\d{1,2})\s*nights?\s*\)?/i);
    if (n) {
      if (item.date && !item.endDate) item.endDate = addDays(item.date, +n[1]);
      item.title = item.title.replace(n[0], " ");
    }
    item.title = item.title
      .replace(/^\s*(?:hotel|accommodation|stay)\s*:\s*/i, "")
      .replace(/^\s*check[\s-]?in\s*(?::|at|-|–|to)?\s*/i, "")
      .replace(/,?\s*check[\s-]?in\b\s*(?:from|at)?\s*$/i, "")
      .replace(/\s{2,}/g, " ").replace(/[\s,:;\-–]+$/, "").trim() || item.title;
  }

  const NOTE_PREFIX = /^\s*(?:[-•*]\s*)?(address|location|where|venue|booking|confirmation|conf\.?|ref(?:erence)?|reservation|note|notes|tip|phone|tel|ph|cost|price|tickets?|seats?|car|platform|gate|terminal|pnr|website|url|link)(?:\s+(?:ref(?:erence)?|no\.?|number|code|id|details))?\s*(?:no\.?|number|#)?\s*[:\-–#]\s*(.+)$/i;
  const NOTE_START = /^\s*(?:[-•*]\s*)?(?:platform\s+\d|car\s+\d|seats?\s+\d|gate\s+\d|terminal\s+\d|flight\s+(?:no|number)|pnr\b|https?:\/\/)/i;

  function attachNote(item, line) {
    const m = line.match(NOTE_PREFIX);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (/^(address|location|where|venue)$/.test(key) && !item.location) { item.location = val; return; }
      if (/^(booking|confirmation|conf|ref|reference|reservation|pnr)/.test(key) && !item.ref) { item.ref = val; return; }
      item.notes = (item.notes ? item.notes + "\n" : "") + m[1].replace(/^./, (c) => c.toUpperCase()) + ": " + val;
      return;
    }
    item.notes = (item.notes ? item.notes + "\n" : "") + cleanTitle(line);
  }

  function newItem(fields) {
    return Object.assign({ type: "activity", title: "", date: "", time: "", endTime: "", endDate: "", location: "", ref: "", notes: "" }, fields);
  }

  /* ---------- tables (csv, xlsx, docx tables) ---------- */
  const COLS = {
    date: /^(date|day|when|dates?)$|\bdate\b/i,
    time: /^(time|start|start time|from|starts?|departs?|departure)$|\btime\b/i,
    end: /^(end|end time|to|until|finish|ends?|arrives?|arrival)$/i,
    type: /^(type|category|kind|cat)$/i,
    title: /^(activity|activities|title|event|what|description|item|plan|plans|details|name|thing|itinerary|schedule)$/i,
    location: /^(location|where|place|address|venue|city|area)$/i,
    notes: /^(notes?|comments?|info|more|extra|remarks)$/i,
    ref: /^(ref|reference|booking|booking ref|confirmation|conf|confirmation number|booking number|pnr)$/i,
  };

  function mapHeader(cells) {
    const map = {};
    cells.forEach((c, i) => {
      const t = c.trim().replace(/[:*]/g, "");
      for (const k of Object.keys(COLS)) {
        if (map[k] === undefined && COLS[k].test(t)) { map[k] = i; break; }
      }
    });
    const score = Object.keys(map).length;
    if (score >= 2 && (map.title !== undefined || map.notes !== undefined || map.location !== undefined) && (map.date !== undefined || map.time !== undefined)) {
      if (map.title === undefined) map.title = map.notes !== undefined ? map.notes : map.location;
      return map;
    }
    return null;
  }

  function splitDelimited(line, delim) {
    if (delim !== "," && delim !== ";") return line.split(delim).map((x) => x.trim());
    const out = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === delim && !q) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function detectHeader(raw) {
    for (const delim of ["\t", "|", ",", ";"]) {
      if (!raw.includes(delim)) continue;
      const cells = splitDelimited(raw, delim);
      if (cells.length < 2) continue;
      const map = mapHeader(cells);
      if (map) return { map, delim };
    }
    return null;
  }

  function typeFromCell(typeCell, fallbackText) {
    const t = typeCell.toLowerCase();
    if (/travel|transport|flight|train|transit/.test(t)) return "travel";
    if (/hotel|accom|stay|lodg/.test(t)) return "hotel";
    if (/food|eat|meal|restaurant|dining|drink/.test(t)) return "food";
    if (/activ|sight|tour|thing|fun|event|visit/.test(t)) return "activity";
    return guessType(fallbackText);
  }

  /* ---------- free text (with inline tables) ---------- */
  function parseFreeText(lines, opts) {
    const resolveYear = makeYearResolver(opts);
    const items = [];
    let currentDate = "";
    let last = null;
    let lastWasHeader = false;
    let table = null;

    function rowToItem(cells, map) {
      const get = (k) => (map[k] !== undefined && cells[map[k]] != null ? String(cells[map[k]]).trim() : "");
      const dateCell = get("date");
      let rowDate = null;
      if (dateCell) {
        rowDate = findDate(dateCell, resolveYear, opts);
        if (rowDate) currentDate = rowDate.date;
      }
      const title = get("title");
      if (!title) return null;
      const timeCell = get("time");
      const tm = timeCell ? findTimes(timeCell) || findTimes(timeCell.replace(/^(\d{1,2})$/, "$1:00")) : null;
      const endTm = get("end") ? findTimes(get("end")) : null;
      const it = newItem({
        title: cleanTitle(title) || title,
        date: currentDate,
        endDate: rowDate && rowDate.endDate ? rowDate.endDate : "",
        time: tm ? tm.start : "",
        endTime: endTm ? endTm.start : tm ? tm.end : "",
        type: typeFromCell(get("type"), [title, get("notes"), get("location")].join(" ")),
        location: map.title !== map.location ? get("location") : "",
        notes: map.title !== map.notes ? get("notes") : "",
        ref: get("ref"),
      });
      it._dated = !!currentDate;
      tidyHotel(it);
      return it;
    }

    for (const raw0 of lines) {
      const raw = raw0.replace(/ /g, " ");
      const line = raw.trim();
      if (!line) continue;
      if (table) {
        const cells = splitDelimited(raw, table.delim);
        if (cells.length >= 2) {
          const it = rowToItem(cells, table.map);
          if (it) { items.push(it); last = it; lastWasHeader = false; }
          continue;
        }
        table = null;
      }
      const hdr = detectHeader(raw);
      if (hdr) { table = hdr; last = null; continue; }
      if (/^[-=_*~.]{3,}$/.test(line)) continue;

      const isBullet = /^[•◦▪●○■□➤➢►▶→\-–—*·]\s*/.test(line) || /^\d{1,2}[.)]\s+/.test(line);
      const dt = findDate(line, resolveYear, opts);
      let rest = line;
      if (dt) rest = rest.replace(dt.raw, " ");

      // a date with nothing else meaningful -> it's a day heading
      if (dt) {
        const leftover = cleanTitle(rest.replace(/\bday\s*\d+\b/i, "")).replace(/[()[\]]/g, "").trim();
        currentDate = dt.date;
        if (leftover.length < 3 || (!findTimes(leftover) && /^(day|itinerary|schedule|plan)\b/i.test(leftover))) {
          last = null; lastWasHeader = true;
          continue;
        }
        // "Day 3 – Kyoto": keep the city as a heading note, not an item
        if (leftover.length < 25 && !findTimes(leftover) && dt.index <= 12 && !isBullet && !TYPE_WORDS.travel.test(leftover) && !TYPE_WORDS.hotel.test(leftover) && !TYPE_WORDS.food.test(leftover)) {
          last = null; lastWasHeader = true;
          continue;
        }
      }

      if (last && !dt && (NOTE_PREFIX.test(line) || NOTE_START.test(line))) {
        attachNote(last, line);
        continue;
      }

      const tm = findTimes(rest);
      let start = "", end = "";
      if (tm) {
        start = tm.start; end = tm.end;
        rest = rest.replace(tm.raw, " ");
      } else {
        const lr = rest.match(LEADING_HOUR_RANGE);
        if (lr) {
          start = normTime(lr[1] + lr[3]); end = normTime(lr[2] + lr[3]);
          rest = rest.replace(lr[0], " ");
        }
      }
      let title = cleanTitle(rest);
  
      const startsNew = dt || start || isBullet || lastWasHeader || !last || line.length <= 70;
      if (!startsNew && last) {
        attachNote(last, line);
        continue;
      }
      if (!title) {
        if (start) { last = newItem({ date: currentDate, time: start, endTime: end, _needsTitle: true }); items.push(last); }
        continue;
      }
      if (last && last._needsTitle && !start) {
        last.title = title; last.type = guessType(title); delete last._needsTitle;
        lastWasHeader = false;
        continue;
      }

      // "Title @ Place"
      let location = "";
      const at = title.match(/^(.{3,}?)\s+@\s+(.{2,})$/);
      if (at) { title = at[1]; location = at[2]; }

      last = newItem({
        title, location,
        date: dt ? dt.date : currentDate,
        endDate: dt && dt.endDate ? dt.endDate : "",
        time: start, endTime: end,
        type: guessType(line),
      });
      last._dated = !!currentDate || !!dt;
      tidyHotel(last);
      items.push(last);
      lastWasHeader = false;
    }
    const firstDated = items.findIndex((i) => i._dated);
    return items
      .filter((i, n) => i.title && !(firstDated > 0 && n < firstDated))
      .map((i) => { delete i._needsTitle; delete i._dated; return i; });
  }

  function parseText(text, opts = {}) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    return dedupe(parseFreeText(lines, opts));
  }

  function dedupe(items) {
    const seen = new Set();
    return items.filter((i) => {
      const k = [i.date, i.time, i.title.toLowerCase()].join("|");
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  /* ---------- ICS calendar ---------- */
  function parseICS(text) {
    const unfolded = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
    const events = unfolded.split("BEGIN:VEVENT").slice(1);
    const out = [];
    const unesc = (s) => (s || "").replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
    const fmtTokyo = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    function dt(val) {
      if (!val) return null;
      const m = val.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
      if (!m) return null;
      if (m[7]) {
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
        const p = Object.fromEntries(fmtTokyo.formatToParts(d).map((x) => [x.type, x.value]));
        return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
      }
      return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : "" };
    }
    for (const ev of events) {
      const body = ev.split("END:VEVENT")[0];
      const get = (k) => {
        const m = body.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, "m"));
        return m ? m[1] : "";
      };
      const s = dt(get("DTSTART"));
      const e = dt(get("DTEND"));
      const title = unesc(get("SUMMARY"));
      if (!s || !title) continue;
      const allDay = !s.time;
      let endDate = "";
      const location = unesc(get("LOCATION"));
      const type = guessType([title, location].join(" "));
      if (e && e.date !== s.date) endDate = allDay && type !== "hotel" ? addDays(e.date, -1) : e.date;
      if (endDate === s.date) endDate = "";
      const notes = unesc(get("DESCRIPTION"));
      out.push(newItem({
        title, date: s.date, time: s.time, endTime: e && !allDay && e.date === s.date ? e.time : "",
        endDate, location, notes, type,
      }));
    }
    return out;
  }

  /* ---------- zip (docx / xlsx) ---------- */
  async function unzip(buf, wanted) {
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("This doesn't look like a valid Word/Excel file.");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const xlen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
      p += 46 + nlen + xlen + clen;
      if (!wanted(name)) continue;
      const lnlen = dv.getUint16(local + 26, true);
      const lxlen = dv.getUint16(local + 28, true);
      const data = new Uint8Array(buf, local + 30 + lnlen + lxlen, csize);
      if (method === 0) files[name] = dec.decode(data);
      else if (method === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const stream = new Blob([data]).stream().pipeThrough(ds);
        files[name] = await new Response(stream).text();
      }
    }
    return files;
  }

  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  function docxText(xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const body = doc.getElementsByTagNameNS(W, "body")[0];
    const lines = [];
    function paraText(p) {
      let s = "";
      const walk = (n) => {
        for (const c of n.childNodes) {
          if (c.nodeType !== 1) continue;
          const ln = c.localName;
          if (ln === "t") s += c.textContent;
          else if (ln === "tab") s += " ";
          else if (ln === "br" || ln === "cr") s += "\n";
          else walk(c);
        }
      };
      walk(p);
      const isList = p.getElementsByTagNameNS(W, "numPr").length > 0;
      return (isList && s.trim() ? "• " : "") + s;
    }
    function walkBlock(node) {
      for (const c of node.childNodes) {
        if (c.nodeType !== 1) continue;
        if (c.localName === "p") lines.push(...paraText(c).split("\n"));
        else if (c.localName === "tbl") {
          for (const tr of c.childNodes) {
            if (tr.localName !== "tr") continue;
            const cells = [];
            for (const tc of tr.childNodes) {
              if (tc.localName !== "tc") continue;
              const ps = Array.from(tc.getElementsByTagNameNS(W, "p")).map((p) => paraText(p).replace(/^• /, "").trim()).filter(Boolean);
              cells.push(ps.join(" / "));
            }
            lines.push(cells.join("\t"));
          }
          lines.push("");
        } else if (c.localName === "sdt" || c.localName === "sdtContent") walkBlock(c);
      }
    }
    if (body) walkBlock(body);
    return lines.join("\n");
  }

  function colIndex(ref) {
    const letters = ref.replace(/\d+/g, "");
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }
  function excelSerial(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    if (n > 30000 && n < 80000) {
      const ms = Math.round((n - 25569) * 86400000);
      const d = new Date(ms);
      const date = iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      const frac = n % 1;
      if (frac > 0.0001) return date + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
      return date;
    }
    if (n > 0 && n < 1) {
      const mins = Math.round(n * 1440);
      return pad(Math.floor(mins / 60)) + ":" + pad(mins % 60);
    }
    return v;
  }
  async function xlsxRows(buf) {
    const files = await unzip(buf, (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    const shared = [];
    if (files["xl/sharedStrings.xml"]) {
      const d = new DOMParser().parseFromString(files["xl/sharedStrings.xml"], "application/xml");
      for (const si of d.getElementsByTagName("si")) {
        shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent).join(""));
      }
    }
    const sheetName = Object.keys(files).filter((n) => n.includes("worksheets")).sort()[0];
    if (!sheetName) return "";
    const d = new DOMParser().parseFromString(files[sheetName], "application/xml");
    const lines = [];
    for (const row of d.getElementsByTagName("row")) {
      const cells = [];
      for (const c of row.getElementsByTagName("c")) {
        const idx = colIndex(c.getAttribute("r") || "A");
        const t = c.getAttribute("t");
        const vEl = c.getElementsByTagName("v")[0];
        let v = vEl ? vEl.textContent : "";
        if (t === "s") v = shared[+v] || "";
        else if (t === "inlineStr") v = Array.from(c.getElementsByTagName("t")).map((x) => x.textContent).join("");
        else if (!t || t === "n") v = excelSerial(v);
        cells[idx] = String(v).replace(/[\t\n]+/g, " ");
      }
      lines.push(Array.from(cells, (x) => x || "").join("\t"));
    }
    return lines.join("\n");
  }

  /* ---------- pdf (pdf.js loaded on demand) ---------- */
  // pdf.js 3.11.174 (Apache-2.0) is bundled in js/vendor so PDFs work offline
  const PDFJS = "js/vendor/pdf.min.js";
  const PDFJS_WORKER = "js/vendor/pdf.worker.min.js";
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Couldn't load the PDF reader. Try again, or copy and paste the text instead."));
      document.head.appendChild(s);
    });
  }
  async function pdfText(buf) {
    if (!window.pdfjsLib) await loadScript(PDFJS);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const rows = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const y = Math.round(it.transform[5]);
        const x = it.transform[4];
        let row = rows.find((r) => Math.abs(r.y - y) <= 3);
        if (!row) { row = { y, parts: [] }; rows.push(row); }
        row.parts.push({ x, s: it.str, w: it.width || 0 });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.parts.sort((a, b) => a.x - b.x);
        let line = "", lastEnd = null;
        for (const part of r.parts) {
          if (lastEnd !== null) line += part.x - lastEnd > 18 ? "\t" : part.x - lastEnd > 1.5 ? " " : "";
          line += part.s;
          lastEnd = part.x + part.w;
        }
        out.push(line);
      }
      out.push("");
    }
    return out.join("\n");
  }

  /* ---------- public API ---------- */
  async function fileToText(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".docx")) {
      const files = await unzip(await file.arrayBuffer(), (n) => n === "word/document.xml");
      if (!files["word/document.xml"]) throw new Error("Couldn't find any text in that Word document.");
      return { kind: "text", text: docxText(files["word/document.xml"]) };
    }
    if (name.endsWith(".xlsx")) return { kind: "text", text: await xlsxRows(await file.arrayBuffer()) };
    if (name.endsWith(".pdf")) return { kind: "text", text: await pdfText(await file.arrayBuffer()) };
    if (name.endsWith(".ics")) return { kind: "ics", text: await file.text() };
    if (name.endsWith(".doc") || name.endsWith(".pages") || name.endsWith(".numbers") || name.endsWith(".xls")) {
      throw new Error("That file type can't be read in the browser. Save it as .docx, .xlsx or .pdf (File → Save As / Export) and try again.");
    }
    return { kind: "text", text: await file.text() };
  }

  async function importFile(file, opts) {
    const res = await fileToText(file);
    if (res.kind === "ics") return { items: parseICS(res.text), text: res.text };
    return { items: parseText(res.text, opts), text: res.text };
  }

  window.TabiImporter = { importFile, parseText, parseICS, guessType };
})();
