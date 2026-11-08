// Renders assets/banner.svg: the morning landscape at the top of the profile.
// Run from the repo root: node scripts/banner.mjs
import { writeFileSync } from "node:fs";
import { FONT, embedFont } from "./font.mjs";
import { at } from "./motion.mjs";

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const W = 1200, H = 400;
const f = (n) => Math.round(n * 10) / 10;

// A bird hanging in place: wings flap, body bobs a little.
const bird = (x, y, s, bob) => `<g>
      <path class="flap" style="animation-duration:${(0.9 + s * 0.06).toFixed(2)}s" d="M${x} ${y} q${s} -${s} ${2 * s} 0 q${s} -${s} ${2 * s} 0"/>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -${bob};0 0" dur="${(3.4 + s * 0.2).toFixed(1)}s" repeatCount="indefinite"/>
    </g>`;

// A soft cloud wisp drifting left to right.
const cloud = (y, scale, dur, offset, opacity) => `<g opacity="${opacity}" filter="url(#soft)"><g transform="scale(${scale})">
      <ellipse cx="0" cy="${y}" rx="90" ry="14" fill="#F7F9FD"/><ellipse cx="40" cy="${y - 8}" rx="50" ry="12" fill="#F7F9FD"/><ellipse cx="-50" cy="${y - 3}" rx="40" ry="9" fill="#F7F9FD"/></g>
      <animateTransform attributeName="transform" type="translate" values="-220 0;1420 0" dur="${dur}s" begin="${-offset}s" repeatCount="indefinite"/>
    </g>`;

// One hill layer as a sum of sines; `shift` slides the crests so the layer can roll.
function ridgeLine(base, waves, shift) {
  let d = "";
  for (let x = -20; x <= W + 20; x += 20) {
    const y = base - waves.reduce((s, [amp, len, ph]) => s + amp * Math.sin((x / len) * Math.PI * 2 + ph + shift), 0);
    d += `${d ? "L" : "M"}${x} ${f(y)}`;
  }
  return `${d} L${W + 20} ${H + 10} L-20 ${H + 10} Z`;
}

// Hills roll like slow waves: each layer morphs between two crest positions, the
// nearer layers a little faster, which reads as depth.
const hills = (fill, base, waves, dur, delay) => {
  const d0 = ridgeLine(base, waves, 0), d1 = ridgeLine(base, waves, 0.9);
  return `<g class="up" ${at(delay)}><path fill="${fill}" d="${d0}">
      <animate attributeName="d" values="${d0};${d1};${d0}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/></path></g>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Welcome to Harshal's GitHub">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E8EEF8"/>
      <stop offset="0.5" stop-color="#C9D5EB"/>
      <stop offset="1" stop-color="#93A9D1"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#F7F9FD" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#F7F9FD" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E8EEF8" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#E8EEF8" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#E8EEF8" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="16"/></clipPath>
  </defs>

  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="600" cy="260" r="150" fill="url(#glow)">
      <animate attributeName="r" values="150;172;150" dur="7s" repeatCount="indefinite"/>
    </circle>

    <!-- clouds -->
    ${cloud(70, 1, 95, 30, 0.7)}
    ${cloud(130, 0.8, 120, 85, 0.55)}

    <!-- title -->
    <g font-family="${FONT}" text-anchor="middle">
      <text class="up" ${at(0.1)} x="600" y="112" font-size="46" font-weight="700" fill="#14213D">Welcome to Harshal's GitHub</text>
      <text class="up" ${at(0.35)} x="600" y="156" font-size="16.5" letter-spacing="4.5" fill="#2E4A7D">SENIOR SOFTWARE ENGINEER · MUMBAI, INDIA</text>
      <text class="up" ${at(0.6)} x="600" y="200" font-family="${MONO}" font-size="26" font-weight="600" fill="#2E4A7D">&lt;/&gt;<tspan fill="#14213D">_<animate attributeName="opacity" values="1;1;0;0" dur="1.2s" repeatCount="indefinite"/></tspan></text>
    </g>

    <!-- birds, held in place -->
    <g fill="none" stroke="#3F5F99" stroke-width="1.6" stroke-linecap="round">
      ${bird(120, 64, 6, 5)}
      ${bird(162, 88, 4, 4)}
      ${bird(1036, 58, 5, 5)}
    </g>

    <!-- rolling hills, far to near; the mist drifts between the first two -->
    ${hills("#7F98C6", 246, [[12, 520, 0.4], [6, 230, 1.8]], 11, 0.05)}
    <rect x="-80" y="232" width="1360" height="70" fill="url(#mist)">
      <animate attributeName="x" values="-80;-10;-80" dur="14s" repeatCount="indefinite"/>
    </rect>
    ${hills("#4E6CA3", 282, [[16, 640, 2.2], [7, 260, 0.6]], 9, 0.15)}
    ${hills("#2E4A7D", 326, [[14, 560, 4.1], [6, 210, 2.9]], 7.5, 0.25)}
    ${hills("#1E2F55", 366, [[10, 700, 1.3], [5, 240, 5.2]], 6, 0.35)}
  </g>
</svg>
`;

writeFileSync("assets/banner.svg", embedFont(svg));
