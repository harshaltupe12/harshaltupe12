// Renders assets/activity.svg: a contribution heatmap card in the profile palette.
// Data comes from the public contributions calendar, so no token is needed.
// Usage: node scripts/activity-card.mjs <github-user> <out-file>

import { writeFile } from "node:fs/promises";

const [user = "harshaltupe12", outFile = "assets/activity.svg"] = process.argv.slice(2);

const C = {
  bg: "#0B1324",
  panel: "#101B33",
  line: "#1E2F55",
  steel: "#2E4A7D",
  blue: "#4E6CA3",
  accent: "#6F8FC4",
  mist: "#A9BCDD",
  text: "#CFDAEE",
  bright: "#E8EEF8",
};
// Heatmap cell colours for GitHub's contribution levels 0-4.
const LEVELS = ["#131F38", "#2E4A7D", "#4E6CA3", "#7F98C6", "#C9D5EB"];
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
    cells.set(id, {
      date: tag.match(/data-date="([^"]+)"/)[1],
      level: Number(tag.match(/data-level="(\d)"/)?.[1] ?? 0),
      count: 0,
    });
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

  const best = days.reduce((b, d) => (d.count > b.count ? d : b), days[0]);
  return { total, longest, current, best };
}

const fmtDate = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

function tiles(stats, W, y) {
  const tileW = 164;
  const gap = (W - 2 * 48 - stats.length * tileW) / (stats.length - 1);
  return stats
    .map(([value, label], i) => {
      const x = (48 + i * (tileW + gap)).toFixed(1);
      return `<g transform="translate(${x} ${y})">
      <rect width="${tileW}" height="76" rx="10" fill="${C.panel}" stroke="${C.line}"/>
      <rect x="16" y="0" width="${tileW - 32}" height="2" rx="1" fill="url(#accent)"/>
      <text x="${tileW / 2}" y="40" text-anchor="middle" font-size="24" font-weight="700" fill="${C.bright}">${value}</text>
      <text x="${tileW / 2}" y="60" text-anchor="middle" font-size="10" letter-spacing="1.5" fill="${C.accent}">${label}</text>
    </g>`;
    })
    .join("\n    ");
}

function heatmap(days, x0, y0) {
  const step = 12.6;
  const size = 10;
  const firstRow = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const cols = [];
  days.forEach((d, i) => {
    const pos = i + firstRow;
    (cols[Math.floor(pos / 7)] ??= []).push({ ...d, row: pos % 7 });
  });

  const lastIdx = days.length - 1 + firstRow;
  const today = { x: x0 + Math.floor(lastIdx / 7) * step, y: y0 + (lastIdx % 7) * step };

  const body = cols
    .map((col, c) => {
      const cells = col
        .map((d) => `<rect x="${(x0 + c * step).toFixed(1)}" y="${(y0 + d.row * step).toFixed(1)}" width="${size}" height="${size}" rx="2.5" fill="${LEVELS[d.level]}"/>`)
        .join("");
      return `<g>${cells}</g>`;
    })
    .join("\n    ");

  // Month label above the first column that starts in a new month, kept at least 3 columns apart.
  const labels = [];
  let lastCol = -9;
  cols.forEach((col, c) => {
    const m = Number(col[0].date.slice(5, 7)) - 1;
    const prev = c > 0 ? Number(cols[c - 1][0].date.slice(5, 7)) - 1 : -1;
    if (m !== prev && c - lastCol >= 3) {
      labels.push(`<text x="${(x0 + c * step).toFixed(1)}" y="${y0 - 10}" font-size="10" fill="${C.accent}">${MONTHS[m]}</text>`);
      lastCol = c;
    }
  });
  const weekdays = [[1, "Mon"], [3, "Wed"], [5, "Fri"]]
    .map(([r, l]) => `<text x="${x0 - 8}" y="${y0 + r * step + 8.5}" text-anchor="end" font-size="9.5" fill="${C.steel}">${l}</text>`)
    .join("");

  const pulse = `<rect x="${today.x - 2}" y="${today.y - 2}" width="${size + 4}" height="${size + 4}" rx="4" fill="none" stroke="${C.bright}" stroke-width="1.2">
      <animate attributeName="stroke-opacity" values="0.9;0.1;0.9" dur="2.4s" repeatCount="indefinite"/>
    </rect>`;

  return { svg: `${labels.join("")}${weekdays}\n    ${body}\n    ${pulse}`, width: cols.length * step, height: 7 * step };
}

function render(days, { total, longest, current, best }) {
  const W = 800;
  const grid = heatmap(days, 82, 184);
  const legendY = 184 + grid.height + 22;
  const H = legendY + 30;

  const stats = [
    [total.toLocaleString("en-US"), "CONTRIBUTIONS"],
    [`${current} ${current === 1 ? "day" : "days"}`, "CURRENT STREAK"],
    [`${longest} ${longest === 1 ? "day" : "days"}`, "LONGEST STREAK"],
    [String(best.count), `BEST DAY · ${fmtDate(best.date).toUpperCase()}`],
  ];

  const legendX = W - 48 - (5 * 14 + 70);
  const legend = `<text x="${legendX}" y="${legendY + 9}" font-size="10" fill="${C.accent}">Less</text>
    ${LEVELS.map((c, i) => `<rect x="${legendX + 32 + i * 14}" y="${legendY}" width="10" height="10" rx="2.5" fill="${c}"/>`).join("")}
    <text x="${legendX + 32 + 5 * 14 + 4}" y="${legendY + 9}" font-size="10" fill="${C.accent}">More</text>`;

  const range = `${fmtDate(days[0].date)}, ${days[0].date.slice(0, 4)} – ${fmtDate(days.at(-1).date)}, ${days.at(-1).date.slice(0, 4)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${total} contributions in the last year">
  <defs>
    <linearGradient id="accent" x1="0" x2="1">
      <stop offset="0" stop-color="${C.steel}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${C.mist}"/>
      <stop offset="1" stop-color="${C.steel}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${C.bg}" stroke="${C.line}"/>
  <g font-family="${MONO}">
    <text x="48" y="42" font-size="15" font-weight="700" fill="${C.text}">Contribution activity</text>
    <text x="${W - 48}" y="42" text-anchor="end" font-size="11" fill="${C.accent}">last 12 months</text>
    ${tiles(stats, W, 64)}
    ${grid.svg}
    <text x="48" y="${legendY + 9}" font-size="10" fill="${C.steel}">${range}</text>
    ${legend}
  </g>
</svg>
`;
}

const days = await fetchDays();
await writeFile(outFile, render(days, summarize(days)));
console.log(`wrote ${outFile} (${days.length} days)`);
