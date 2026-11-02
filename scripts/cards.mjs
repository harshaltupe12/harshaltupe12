// Renders the static profile art: section headers (light + dark), the About map card
// (desktop + mobile). Run from the repo root:
//   node scripts/cards.mjs
// Each card is a different time of day, so the page reads morning (banner) to night (activity).
import { writeFileSync, mkdirSync } from "node:fs";
import { FONT, embedFont } from "./font.mjs";

const C = {
  night: "#0B1324", ink: "#14213D", deep: "#1E2F55", navy: "#2E4A7D", mid: "#4E6CA3",
  steel: "#6F8FC4", far: "#7F98C6", haze: "#A9BCDD", mist: "#C9D5EB", paper: "#E8EEF8",
};

// Small deterministic PRNG so stars and contours don't shift between runs.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
const f = (n) => Math.round(n * 10) / 10;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------------------------------------------------------------- section headers

const HEADER_THEMES = {
  light: { num: C.mid, title: C.ink, ridge: "#93A9D1", peak: C.navy, caption: C.mid },
  dark: { num: C.steel, title: C.paper, ridge: C.navy, peak: C.haze, caption: C.steel },
};

function header(num, title, caption, t, W = 800) {
  const x0 = 64 + title.length * 12.6 + 22; // ridge starts after the title
  const peakX = x0 + (W - 12 - x0) * 0.72;
  let d = "", top = { x: 0, y: 99 };
  for (let x = x0; x <= W - 12; x += 4) {
    const fade = Math.min(1, (x - x0) / 60, (W - 12 - x) / 60);
    const y = 44 - fade * (2.5 * Math.sin(x / 31) + 1.5 * Math.sin(x / 11 + 1) + 2.5 + 11 * Math.exp(-(((x - peakX) / 46) ** 2)));
    d += `${d ? "L" : "M"}${f(x)} ${f(y)}`;
    if (y < top.y) top = { x, y };
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="60" viewBox="0 0 ${W} 60" role="img" aria-label="${title}">
  <text x="12" y="43" font-family="${FONT}" font-size="13" letter-spacing="1" fill="${t.num}">${num}</text>
  <rect x="40" y="27" width="1.2" height="20" fill="${t.ridge}"/>
  <text x="54" y="44" font-family="${FONT}" font-size="22" font-weight="700" fill="${t.title}">${title}</text>
  <path d="${d}" fill="none" stroke="${t.ridge}" stroke-width="1.3" stroke-linejoin="round"/>
  <circle cx="${f(top.x)}" cy="${f(top.y)}" r="2.6" fill="${t.peak}"/>
  <text x="${W - 12}" y="18" text-anchor="end" font-family="${FONT}" font-size="10.5" letter-spacing="2.2" fill="${t.caption}">${caption}</text>
</svg>
`;
}

function headerMobile(num, title, t) {
  return header(num, title, "", t, 420).replace(/<text[^>]*text-anchor="end"[^>]*><\/text>\n/, "");
}

// ---------------------------------------------------------------- about: map card with a "how I work" trail

const ABOUT_ALT = "I care how things work, all the way down. I like owning things end to end, from the protocol layer up to the interface people actually touch. How I work: design first, plan before I build. Chase edge cases, the ones most skip. Plan for systems, small features grow.";

// Topographic contour rings around a peak.
function contours(cx, cy, rings, step, sx, seed) {
  const r = rng(seed), p1 = r() * 6, p2 = r() * 6;
  let out = "";
  for (let k = 1; k <= rings; k++) {
    let d = "";
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const rad = k * step * (1 + 0.13 * Math.sin(3 * a + p1 + k * 0.15) + 0.07 * Math.sin(5 * a + p2 - k * 0.2));
      d += `${i ? "L" : "M"}${f(cx + Math.cos(a) * rad * sx)} ${f(cy + Math.sin(a) * rad)}`;
    }
    const index = k % 4 === 0;
    out += `<path d="${d}Z" fill="none" stroke="${index ? "#BFCDE5" : "#D3DDEE"}" stroke-width="${index ? 1.3 : 0.9}"/>`;
  }
  return out;
}

// How I work, as stops along a dashed trail; the last one is the summit flag.
const STOPS = [
  { title: "DESIGN FIRST", note: "Plan before I build." },
  { title: "CHASE EDGE CASES", note: "The ones most skip." },
  { title: "PLAN FOR SYSTEMS", note: "Small features grow.", summit: true },
];

function marker(x, y, summit) {
  if (!summit) return `<circle cx="${x}" cy="${y}" r="5.5" fill="#F4F7FC" stroke="${C.ink}" stroke-width="1.8"/>`;
  return `<line x1="${x}" x2="${x}" y1="${y}" y2="${y - 26}" stroke="${C.ink}" stroke-width="1.6"/>
    <path d="M${x} ${y - 26} l14 5 l-14 5 z" fill="${C.navy}"><animate attributeName="d" values="M${x} ${y - 26} l14 5 l-14 5 z;M${x} ${y - 26} l13 6 l-13 4 z;M${x} ${y - 26} l14 5 l-14 5 z" dur="2.4s" repeatCount="indefinite"/></path>
    <circle cx="${x}" cy="${y}" r="5" fill="${C.ink}"/>`;
}

function trailPath(pts, start) {
  let d = `M${start[0]} ${start[1]} C${(start[0] + pts[0][0]) / 2} ${start[1]} ${(start[0] + pts[0][0]) / 2} ${pts[0][1]} ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2, w = i % 2 ? 16 : -16;
    d += ` C${mx} ${y0 + w} ${mx} ${y1 - w} ${x1} ${y1}`;
  }
  return d;
}

const compass = (x, y) => `<g transform="translate(${x} ${y})" font-family="${FONT}">
    <circle r="15" fill="none" stroke="${C.far}" stroke-width="1"/>
    <path d="M0 -11 L4 0 L0 -2 L-4 0 Z" fill="${C.navy}"/><path d="M0 11 L4 0 L0 2 L-4 0 Z" fill="${C.far}"/>
    <text y="-20" text-anchor="middle" font-size="10" font-weight="700" fill="${C.navy}">N</text>
  </g>`;

function aboutDesktop() {
  const W = 800, H = 360;
  const pts = [[150, 312], [400, 298], [650, 282]];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ABOUT_ALT}">
  <defs><clipPath id="frame"><rect width="${W}" height="${H}" rx="16"/></clipPath></defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="#F4F7FC"/>
    ${contours(668, 118, 11, 15, 1.35, 7)}
    ${contours(150, 430, 9, 20, 1.6, 21)}
    ${contours(520, 400, 5, 18, 1.5, 3)}

    <g font-family="${FONT}">
      <text x="44" y="64" font-size="11" letter-spacing="2.4" fill="${C.mid}">A BIT ABOUT ME</text>
      <text x="44" y="102" font-size="24" font-weight="700" fill="${C.ink}">I care how things work,</text>
      <text x="44" y="134" font-size="24" font-weight="700" fill="${C.ink}">all the way down.</text>
      <g font-size="15" fill="${C.deep}">
        <text x="44" y="176">I like owning things end to end, from the protocol layer</text>
        <text x="44" y="200">up to the interface people actually touch.</text>
      </g>
    </g>

    <path d="${trailPath(pts, [-10, 328])}" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="2 6" stroke-linecap="round"/>
    ${pts.map(([x, y], i) => marker(x, y, STOPS[i].summit)).join("\n    ")}
    <g font-family="${FONT}" text-anchor="middle">
      ${pts.map(([x, y], i) => `<text x="${x}" y="${y - (STOPS[i].summit ? 54 : 34)}" font-size="12" font-weight="700" letter-spacing="1.5" fill="${C.ink}">${STOPS[i].title}</text>
      <text x="${x}" y="${y - (STOPS[i].summit ? 40 : 20)}" font-size="12" fill="${C.navy}">${STOPS[i].note}</text>`).join("\n      ")}
    </g>

    ${compass(752, 64)}
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="15.5" fill="none" stroke="#C9D5EB"/>
</svg>
`;
}

function aboutMobile() {
  const W = 400, H = 520, x = 58, ys = [322, 392, 462];
  let d = `M${x} 286`;
  ys.forEach((y, i) => {
    const p = i ? ys[i - 1] : 286, w = i % 2 ? -14 : 14;
    d += ` C${x + w} ${p + 24} ${x - w} ${y - 24} ${x} ${y}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ABOUT_ALT}">
  <defs><clipPath id="frame"><rect width="${W}" height="${H}" rx="16"/></clipPath></defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="#F4F7FC"/>
    ${contours(330, 110, 8, 13, 1.2, 7)}
    ${contours(300, 470, 8, 17, 1.1, 21)}

    <g font-family="${FONT}">
      <text x="28" y="52" font-size="10.5" letter-spacing="2.2" fill="${C.mid}">A BIT ABOUT ME</text>
      <text x="28" y="88" font-size="21" font-weight="700" fill="${C.ink}">I care how things</text>
      <text x="28" y="116" font-size="21" font-weight="700" fill="${C.ink}">work, all the way down.</text>
      <g font-size="14.5" fill="${C.deep}">
        ${["I like owning things end to end,", "from the protocol layer up to", "the interface people actually", "touch."]
          .map((l, i) => `<text x="28" y="${156 + i * 23}">${l}</text>`).join("\n        ")}
      </g>
    </g>

    <path d="${d}" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="2 6" stroke-linecap="round"/>
    ${ys.map((y, i) => marker(x, y, STOPS[i].summit)).join("\n    ")}
    <g font-family="${FONT}">
      ${ys.map((y, i) => `<text x="${x + 30}" y="${y - 3}" font-size="12" font-weight="700" letter-spacing="1.5" fill="${C.ink}">${STOPS[i].title}</text>
      <text x="${x + 30}" y="${y + 15}" font-size="13" fill="${C.navy}">${STOPS[i].note}</text>`).join("\n      ")}
    </g>
    ${compass(352, 486)}
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="15.5" fill="none" stroke="#C9D5EB"/>
</svg>
`;
}

// ---------------------------------------------------------------- write

mkdirSync("assets", { recursive: true });
const out = (name, svg) => writeFileSync(`assets/${name}.svg`, embedFont(svg));

const SECTIONS = [
  ["tech", "01", "Technologies", "WHAT I BUILD WITH"],
  ["about", "02", "About", "HOW I WORK"],
  ["activity", "03", "Activity", "LAST 12 MONTHS"],
];
for (const [key, num, title, caption] of SECTIONS) {
  for (const [theme, t] of Object.entries(HEADER_THEMES)) {
    out(`h-${key}-${theme}`, header(num, esc(title), caption, t));
    out(`h-${key}-${theme}-mobile`, headerMobile(num, esc(title), t));
  }
}
out("about", aboutDesktop());
out("about-mobile", aboutMobile());
