// Renders assets/activity.svg and assets/activity-mobile.svg: the last year of contributions
// drawn as a mountain ridge at nightfall (one point per week), with the contact note below it.
// Data comes from the public contributions calendar, so no token is needed.
// Usage: node scripts/activity-card.mjs <github-user> <out-file>

import { writeFile } from "node:fs/promises";
import { FONT, embedFont } from "./font.mjs";

const [user = "harshaltupe12", outFile = "assets/activity.svg"] = process.argv.slice(2);

const C = {
  night: "#0B1324", ink: "#14213D", deep: "#1E2F55", navy: "#2E4A7D", mid: "#4E6CA3",
  steel: "#6F8FC4", haze: "#A9BCDD", paper: "#E8EEF8",
};
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EMAIL = "harshaltupe12@gmail.com";
const f = (n) => Math.round(n * 10) / 10;

async function fetchDays() {
  const res = await fetch(`https://github.com/users/${user}/contributions`, {
    headers: { "User-Agent": "activity-card" },
  });
  if (!res.ok) throw new Error(`contributions page returned ${res.status}`);
  const html = await res.text();

  const cells = new Map();
  for (const [tag] of html.matchAll(/<td[^>]*data-date="[^"]+"[^>]*>/g)) {
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    if (!id) continue;
    cells.set(id, { date: tag.match(/data-date="([^"]+)"/)[1], count: 0 });
  }
  for (const [, id, label] of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = label.match(/^([\d,]+) contributions?/);
    if (n && cells.has(id)) cells.get(id).count = Number(n[1].replace(/,/g, ""));
  }

  const days = [...cells.values()];
  if (days.length < 300) throw new Error(`expected a year of days, parsed ${days.length}`);
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function summarize(days) {
  const total = days.reduce((s, d) => s + d.count, 0);

  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  // A streak survives until the end of today, so skip today if it is still empty.
  let i = days.length - 1;
  if (days[i].count === 0) i--;
  let current = 0;
  while (i >= 0 && days[i].count > 0) {
    current++;
    i--;
  }

  const weeks = [];
  days.forEach((d, n) => {
    if (n % 7 === 0) weeks.push({ start: d.date, count: 0, months: new Map() });
    const w = weeks.at(-1);
    w.count += d.count;
    const m = Number(d.date.slice(5, 7)) - 1;
    w.months.set(m, (w.months.get(m) ?? 0) + d.count);
  });

  const byMonth = new Map();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + d.count);
  }
  const [bestKey, bestCount] = [...byMonth].reduce((b, e) => (e[1] > b[1] ? e : b));
  const bestMonth = Number(bestKey.slice(5, 7)) - 1;
  // Peak marker sits on the week that contributed most to the busiest month.
  const peakWeek = weeks.reduce((b, w, i) => ((w.months.get(bestMonth) ?? 0) > (weeks[b].months.get(bestMonth) ?? 0) ? i : b), 0);

  return { total, longest, current, weeks, bestMonth, bestCount, peakWeek };
}

// Catmull-Rom through the points, as cubic Beziers.
function smooth(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

function ridge(s, { x0, x1, base, height }) {
  const max = Math.max(1, ...s.weeks.map((w) => w.count));
  const step = (x1 - x0) / (s.weeks.length - 1);
  // Quiet weeks still read as rolling foothills; activity is log-scaled on top,
  // so one busy month doesn't flatten the rest of the year.
  const hills = (i) => 14 + 9 * Math.sin(i / 3.1) + 6 * Math.sin(i / 1.7 + 2);
  const lift = (c) => (Math.log1p(c) / Math.log1p(max)) * (height - 40);
  const front = s.weeks.map((w, i) => [x0 + i * step, base - hills(i) - lift(w.count)]);
  // Back range: a wider moving average, lifted, so the skyline has depth.
  const back = s.weeks.map((_, i) => {
    const win = s.weeks.slice(Math.max(0, i - 3), i + 4);
    return [x0 + i * step, base - hills(i + 5) - lift(win.reduce((a, w) => a + w.count, 0) / win.length) - 26];
  });
  const months = [];
  s.weeks.forEach((w, i) => {
    const m = Number(w.start.slice(5, 7)) - 1;
    if (i === 0 || m !== Number(s.weeks[i - 1].start.slice(5, 7)) - 1) months.push([x0 + i * step, MONTHS[m]]);
  });
  return { front, back, months, step };
}

function defs(W, H, horizon) {
  const h = (horizon / H).toFixed(3);
  return `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#060B18"/><stop offset="${(h * 0.45).toFixed(3)}" stop-color="#14234A"/>
      <stop offset="${(h * 0.8).toFixed(3)}" stop-color="#3C4A7E"/><stop offset="${h}" stop-color="#8F84AE"/>
      <stop offset="1" stop-color="#8F84AE"/>
    </linearGradient>
    <linearGradient id="land" x1="0" y1="${horizon - 120}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#101B33"/><stop offset="0.45" stop-color="${C.night}"/><stop offset="1" stop-color="#050A16"/>
    </linearGradient>
    <radialGradient id="moonglow"><stop offset="0" stop-color="${C.haze}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.haze}" stop-opacity="0"/></radialGradient>
    <radialGradient id="fireglow"><stop offset="0" stop-color="#F2A65A" stop-opacity="0.45"/><stop offset="1" stop-color="#F2A65A" stop-opacity="0"/></radialGradient>
    ${campDefs}
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="16"/></clipPath>
  </defs>`;
}

// Stars only in the sky, kept clear of the text blocks.
function starField(W, H, n, avoid = []) {
  let seed = 11, out = "";
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < n; i++) {
    const x = f(r() * W), y = f(r() * H), s = r(), o = f(0.3 + r() * 0.55);
    if (avoid.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1)) continue;
    const tw = s > 0.85 ? `<animate attributeName="opacity" values="${o};0.15;${o}" dur="${f(2.5 + s * 3)}s" repeatCount="indefinite"/>` : "";
    out += `<circle cx="${x}" cy="${y}" r="${s > 0.9 ? 1.4 : s > 0.55 ? 1 : 0.7}" fill="${C.paper}" opacity="${o}">${tw}</circle>`;
  }
  return out;
}

const moon = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="url(#moonglow)"/>
    <mask id="crescent"><rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" fill="#fff"/><circle cx="${x + r * 0.45}" cy="${y - r * 0.25}" r="${r * 0.9}" fill="#000"/></mask>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${C.paper}" mask="url(#crescent)"/>`;

const pine = (x, h) => {
  const w = h * 0.42;
  return `<path d="M${x} ${-h} L${x + w * 0.55} ${-h * 0.62} L${x + w * 0.3} ${-h * 0.62} L${x + w * 0.8} ${-h * 0.3} L${x + w * 0.45} ${-h * 0.3} L${x + w} 0 L${x - w} 0 L${x - w * 0.45} ${-h * 0.3} L${x - w * 0.8} ${-h * 0.3} L${x - w * 0.3} ${-h * 0.62} L${x - w * 0.55} ${-h * 0.62} Z" fill="#111C38"/>`;
};

// Sparks drift up from the fire and fade.
const spark = (dx, delay) => `<circle cx="0" cy="-12" r="0.9" fill="#FFD9A0" opacity="0">
      <animate attributeName="cy" values="-12;-46" dur="2.4s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="cx" values="0;${dx}" dur="2.4s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${delay}s" repeatCount="indefinite"/>
    </circle>`;

const flicker = (dur) => `<animateTransform attributeName="transform" type="scale" values="1 1;0.94 1.1;1.05 0.93;0.97 1.05;1 1" dur="${dur}s" repeatCount="indefinite"/>`;

// Blue code glyphs float up from the laptop, the way sparks rise from the fire.
const glyph = (ch, dx, delay) => `<text x="0" y="0" font-family="${MONO}" font-size="5.5" fill="#9FC0FF" opacity="0">${ch}
      <animate attributeName="y" values="-22;-50" dur="3.6s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="x" values="-14;${-14 + dx}" dur="3.6s" begin="${delay}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0.9;0" dur="3.6s" begin="${delay}s" repeatCount="indefinite"/>
    </text>`;

// One arm from shoulder to keyboard; the hand taps on its own rhythm.
const arm = (shade, dur, delay) => `<path d="M-3 -21 L-7 -13 L-11.5 -11.5" fill="none" stroke="${shade}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <animate attributeName="d" values="M-3 -21 L-7 -13 L-11.5 -11.5;M-3 -21 L-7 -13.6 L-11.5 -13;M-3 -21 L-7 -13 L-11.5 -11.5" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
    </path>`;

// Someone on a log, facing the fire, coding on a laptop. Origin is the ground under the log.
const coder = `<g>
    <rect x="-10" y="-5.5" width="20" height="5.5" rx="2.6" fill="#5A3A26"/>
    <ellipse cx="9.6" cy="-2.75" rx="1.6" ry="2.6" fill="#8A5C3C"/>
    <path d="M3 -7 L-12 -8 L-14 0" fill="none" stroke="#16223F" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-16 0 h4" stroke="#0E1730" stroke-width="2.4" stroke-linecap="round"/>

    <!-- laptop: base across the knees, lid facing the coder -->
    <ellipse cx="-12" cy="-17" rx="10" ry="8" fill="url(#screenglow)"><animate attributeName="opacity" values="0.8;1;0.85;1;0.8" dur="3s" repeatCount="indefinite"/></ellipse>
    <path d="M-16 -10.4 H-4" stroke="#8FA3C8" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M-16 -10.4 L-18.5 -21.5" stroke="#A9BCDD" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M-15.2 -11.2 L-17.5 -20.8" stroke="#CFE0FF" stroke-width="0.8" stroke-linecap="round"><animate attributeName="opacity" values="1;0.6;1;0.8;1" dur="1.4s" repeatCount="indefinite"/></path>

    <g>
      ${arm("#1B2A4D", 0.42, 0)}
      <path d="M-5.5 -6 C-6.5 -13 -6 -19.5 -3.5 -22.5 C-0.5 -23.8 3.4 -21.6 4.2 -16.5 C4.8 -12 4.4 -8.5 4 -6 Z" fill="#22345E"/>
      <path d="M-5.5 -6 C-6.5 -13 -6 -19.5 -3.5 -22.5" fill="none" stroke="#F2A65A" stroke-width="0.9" opacity="0.55"/>
      <g>
        <circle cx="-4.2" cy="-27.8" r="4.4" fill="#1D2B4E"/>
        <path d="M-8.4 -28.6 C-8 -33 -1.5 -34 0.4 -29.6 C-1 -31 -4.6 -31.4 -8.4 -28.6 Z" fill="#101A33"/>
        <path d="M-8.3 -27 C-8.4 -25.6 -7.6 -24.2 -6.4 -23.8" fill="none" stroke="#9FC0FF" stroke-width="1" opacity="0.7"/>
        <animateTransform attributeName="transform" type="rotate" values="0 -3 -24;5 -3 -24;5 -3 -24;0 -3 -24;0 -3 -24" keyTimes="0;0.15;0.45;0.6;1" dur="5s" repeatCount="indefinite"/>
      </g>
      ${arm("#2A3F70", 0.36, 0.17)}
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -0.5;0 0" dur="3.2s" repeatCount="indefinite"/>
    </g>

    ${glyph("&lt;/&gt;", -6, 0)}${glyph("{ }", 4, 1.2)}${glyph(";", -2, 2.4)}
  </g>`;

// A-frame tent in three-quarter view, lit from the right by a stone-ringed campfire.
// (x, y) is the ground point under the tent's front face.
const camp = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})">
    ${pine(-70, 50)}${pine(-52, 36)}
    <ellipse cx="46" cy="1" rx="78" ry="11" fill="url(#firepool)"/>
    <circle cx="46" cy="-8" r="44" fill="url(#fireglow)"><animate attributeName="opacity" values="0.85;1;0.75;0.95;0.85" dur="1.8s" repeatCount="indefinite"/></circle>

    <!-- guy ropes and stakes -->
    <g stroke="${C.mid}" stroke-width="0.8" opacity="0.7">
      <line x1="-26" y1="-37" x2="-62" y2="-1"/><line x1="0" y1="-34" x2="34" y2="0"/>
    </g>
    <g fill="${C.steel}"><rect x="-63" y="-3" width="2" height="4"/><rect x="33" y="-3" width="2" height="4"/></g>

    <!-- tent: far side panel, front face, open door with lamp-lit interior -->
    <path d="M0 -34 L-26 -37 L-50 -3 L-26 0 Z" fill="#15234A"/>
    <path d="M-26 0 L0 -34 L26 0 Z" fill="url(#tentface)"/>
    <path d="M-9 0 L0 -21 L9 0 Z" fill="url(#tentlight)"/>
    <path d="M0 -21 L9 0 L16 0 Z" fill="#4A64A0"/>
    <path d="M0 -34 L26 0" stroke="#F2A65A" stroke-width="1.3" opacity="0.65"/>
    <path d="M-26 0 L0 -34 L-26 -37" fill="none" stroke="#0B1324" stroke-width="0.8" opacity="0.6"/>
    <line x1="0" y1="-34" x2="0" y2="-39" stroke="${C.haze}" stroke-width="1.2" stroke-linecap="round"/>

    <!-- campfire -->
    <g transform="translate(46 0)">
      <g fill="#2B3554">
        <ellipse cx="-11" cy="-1" rx="3.4" ry="2.2"/><ellipse cx="-5" cy="1" rx="3" ry="2"/><ellipse cx="2" cy="1.4" rx="3.2" ry="2"/>
        <ellipse cx="8.5" cy="0.6" rx="3" ry="2"/><ellipse cx="12.5" cy="-1.2" rx="2.8" ry="1.9"/>
      </g>
      <rect x="-10" y="-4.5" width="20" height="3.6" rx="1.8" fill="#5A3A26" transform="rotate(-16)"/>
      <rect x="-10" y="-4.5" width="20" height="3.6" rx="1.8" fill="#6B4630" transform="rotate(16)"/>
      <g transform="translate(0 -3)">
        <g><path d="M-7 0 C-8.5 -8 -3 -12 -1 -21 C2 -14 8.5 -10 7 0 Z" fill="#E9782F"/>${flicker(1.1)}</g>
        <g><path d="M-4.6 0 C-5.2 -6 -2 -9.5 0 -15 C2 -9.5 5.2 -6 4.6 0 Z" fill="#F6B04B"/>${flicker(0.8)}</g>
        <g><path d="M-2.3 0 C-2.6 -3 -1 -5.5 0 -8.5 C1 -5.5 2.6 -3 2.3 0 Z" fill="#FFF1CF"/>${flicker(0.6)}</g>
      </g>
      ${spark(-5, 0)}${spark(4, 0.8)}${spark(-1, 1.6)}
    </g>

    <g transform="translate(102 0) scale(1.15)">${coder}</g>
  </g>`;

const campDefs = `<linearGradient id="tentface" x1="0" x2="1">
      <stop offset="0" stop-color="#1E2F55"/><stop offset="1" stop-color="#3D5893"/>
    </linearGradient>
    <linearGradient id="tentlight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C9773A"/><stop offset="1" stop-color="#F6C987"/>
    </linearGradient>
    <radialGradient id="screenglow"><stop offset="0" stop-color="#9FC0FF" stop-opacity="0.45"/><stop offset="1" stop-color="#9FC0FF" stop-opacity="0"/></radialGradient>
    <radialGradient id="firepool"><stop offset="0" stop-color="#F2A65A" stop-opacity="0.3"/><stop offset="1" stop-color="#F2A65A" stop-opacity="0"/></radialGradient>`;

// Foreground hill the camp sits on, with a faint lit edge.
const hill = (d) => `<path d="${d}" fill="#070E1F"/><path d="${d.split(" V")[0]}" fill="none" stroke="${C.deep}" stroke-width="1"/>`;

function landscape(s, W, H, area, monthEvery = 1) {
  const r = ridge(s, area);
  const close = ` L${area.x1 + 40} ${area.base} L${area.x1 + 40} ${H} L${area.x0 - 40} ${H} L${area.x0 - 40} ${area.base} Z`;
  const extend = (pts) => [[area.x0 - 40, pts[0][1] + 6], ...pts, [area.x1 + 40, pts.at(-1)[1] + 6]];
  const [px, py] = r.front[s.peakWeek];
  const [tx, ty] = r.front.at(-1);
  // Label sits above the peak, or beside it when the peak is near a top corner.
  const side = px > W - 150 || px < 150;
  const anchor = side ? (px > W / 2 ? "end" : "start") : "middle";
  const lx = side ? px + (px > W / 2 ? -14 : 14) : px;
  const ly = side ? py + 14 : py - 32;
  return `<path d="${smooth(extend(r.back))}${close}" fill="#33467A" opacity="0.75"/>
    <path d="${smooth(extend(r.front))}${close}" fill="url(#land)"/>
    <path d="${smooth(r.front)}" fill="none" stroke="${C.haze}" stroke-width="1.4" stroke-linejoin="round" opacity="0.9"/>

    <g font-family="${FONT}">
      ${side ? "" : `<line x1="${f(px)}" x2="${f(px)}" y1="${f(py - 6)}" y2="${f(py - 26)}" stroke="${C.haze}" stroke-width="1"/>`}
      <circle cx="${f(px)}" cy="${f(py)}" r="3.5" fill="${C.paper}"/>
      <text x="${f(lx)}" y="${f(ly - 14)}" text-anchor="${anchor}" font-size="11" font-weight="700" letter-spacing="1.5" fill="${C.paper}">BUSIEST · ${MONTHS[s.bestMonth].toUpperCase()}</text>
      <text x="${f(lx)}" y="${f(ly)}" text-anchor="${anchor}" font-size="11" fill="${C.haze}">${s.bestCount} contributions</text>

      <circle cx="${f(tx)}" cy="${f(ty)}" r="3" fill="${C.paper}"/>
      <circle cx="${f(tx)}" cy="${f(ty)}" r="3" fill="none" stroke="${C.paper}"><animate attributeName="r" values="3;10" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite"/></circle>

      <g font-size="10.5" letter-spacing="1" fill="${C.mid}">
        ${r.months.filter((_, i) => i % monthEvery === 0).map(([x, m]) => `<text x="${f(x)}" y="${area.base + 24}">${m}</text>`).join("")}
      </g>
    </g>`;
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const alt = (s) => `${s.total} contributions in the last year. Busiest month ${MONTHS[s.bestMonth]} with ${s.bestCount}. Current streak ${plural(s.current, "day")}, longest ${plural(s.longest, "day")}. Got an interesting problem? I read every message. Email ${EMAIL}.`;

function desktop(s) {
  const W = 800, H = 620, base = 330;
  const digits = String(s.total).length;
  const stat = (x, value, label) => `<text x="${x}" y="66" text-anchor="end" font-size="20" font-weight="700" fill="${C.paper}">${value}</text>
      <text x="${x}" y="86" text-anchor="end" font-size="10" letter-spacing="2" fill="${C.haze}">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt(s)}">
  ${defs(W, H, base)}
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${starField(W, 230, 80, [[30, 30, 310, 100], [500, 36, 780, 100]])}
    ${moon(430, 74, 18)}
    <g font-family="${FONT}">
      <text x="44" y="82" font-size="42" font-weight="700" fill="${C.paper}">${s.total}</text>
      <text x="${44 + digits * 25.5 + 14}" y="64" font-size="12" fill="${C.haze}">contributions</text>
      <text x="${44 + digits * 25.5 + 14}" y="81" font-size="12" fill="${C.haze}">in the last year</text>
      ${stat(600, plural(s.current, "day"), "CURRENT STREAK")}
      ${stat(756, plural(s.longest, "day"), "LONGEST STREAK")}
    </g>
    ${landscape(s, W, H, { x0: 36, x1: 764, base, height: 170 })}

    <line x1="44" x2="756" y1="384" y2="384" stroke="${C.deep}"/>
    <g font-family="${FONT}">
      <text x="44" y="428" font-size="11" letter-spacing="2.4" fill="${C.steel}">SAY HELLO</text>
      <text x="44" y="468" font-size="28" font-weight="700" fill="${C.paper}">Got an interesting problem?</text>
      <text x="44" y="502" font-size="15" fill="${C.haze}">I read every message. If the context is clear,</text>
      <text x="44" y="526" font-size="15" fill="${C.haze}">you'll hear back from me.</text>
      <rect x="44.5" y="550.5" width="290" height="40" rx="20" fill="#0B1324" stroke="${C.mid}"/>
      <text x="66" y="575" font-size="14" fill="${C.paper}">${EMAIL}</text>
      <text x="314" y="575" text-anchor="end" font-size="14" fill="${C.steel}">→</text>
    </g>

    ${hill(`M470 ${H} C540 586 600 574 650 574 C710 574 760 580 ${W} 588 V${H} H470 Z`)}
    ${camp(608, 576, 1.35)}
    <text x="772" y="606" text-anchor="end" font-family="${FONT}" font-size="10" letter-spacing="2.4" fill="${C.mid}">THANKS FOR VISITING</text>
  </g>
</svg>
`;
}

function mobile(s) {
  const W = 400, H = 780, base = 390;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt(s)}">
  ${defs(W, H, base)}
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${starField(W, 280, 50, [[20, 30, 300, 150]])}
    ${moon(336, 60, 14)}
    <g font-family="${FONT}">
      <text x="28" y="66" font-size="38" font-weight="700" fill="${C.paper}">${s.total}</text>
      <text x="28" y="90" font-size="12" fill="${C.haze}">contributions in the last year</text>
      <text x="28" y="126" font-size="16" font-weight="700" fill="${C.paper}">${plural(s.current, "day")}</text>
      <text x="28" y="143" font-size="9.5" letter-spacing="1.8" fill="${C.haze}">CURRENT STREAK</text>
      <text x="200" y="126" font-size="16" font-weight="700" fill="${C.paper}">${plural(s.longest, "day")}</text>
      <text x="200" y="143" font-size="9.5" letter-spacing="1.8" fill="${C.haze}">LONGEST STREAK</text>
    </g>
    ${landscape(s, W, H, { x0: 20, x1: 380, base, height: 150 }, 2)}

    <line x1="28" x2="372" y1="442" y2="442" stroke="${C.deep}"/>
    <g font-family="${FONT}">
      <text x="28" y="482" font-size="10.5" letter-spacing="2.2" fill="${C.steel}">SAY HELLO</text>
      <text x="28" y="516" font-size="22" font-weight="700" fill="${C.paper}">Got an interesting</text>
      <text x="28" y="544" font-size="22" font-weight="700" fill="${C.paper}">problem?</text>
      <text x="28" y="578" font-size="14.5" fill="${C.haze}">I read every message. If the</text>
      <text x="28" y="601" font-size="14.5" fill="${C.haze}">context is clear, you'll hear</text>
      <text x="28" y="624" font-size="14.5" fill="${C.haze}">back from me.</text>
      <rect x="28.5" y="648.5" width="290" height="40" rx="20" fill="#0B1324" stroke="${C.mid}"/>
      <text x="50" y="673" font-size="14" fill="${C.paper}">${EMAIL}</text>
      <text x="298" y="673" text-anchor="end" font-size="14" fill="${C.steel}">→</text>
    </g>

    ${hill(`M150 ${H} C210 752 250 744 300 744 C340 744 376 748 ${W} 754 V${H} H150 Z`)}
    ${camp(258, 746, 1.15)}
  </g>
</svg>
`;
}

const stats = summarize(await fetchDays());
await writeFile(outFile, embedFont(desktop(stats)));
await writeFile(outFile.replace(/\.svg$/, "-mobile.svg"), embedFont(mobile(stats)));
console.log(`wrote ${outFile}: ${alt(stats)}`);
