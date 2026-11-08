// Renders assets/tech.svg (desktop: the shields.io badge wall, composed into one image)
// and assets/tech-mobile.svg (phones: the same badges in narrower rows).
// Badges and logos are fetched from shields.io at build time. Run from the repo root:
//   node scripts/tech-stack.mjs
import { writeFile } from "node:fs/promises";
import { MOTION_CSS, at } from "./motion.mjs";


const LIGHT = "2E4A7D", DARK = "1E2F55";

// [label, simple-icons slug or null]
const GROUPS = [
  ["LANGUAGES", [["TypeScript", "typescript"], ["JavaScript", "javascript"], ["Python", "python"], ["C#", "dotnet"]]],
  ["FRONTEND", [["React", "react"], ["Next.js", "nextdotjs"], ["Tailwind CSS", "tailwindcss"]]],
  ["BACKEND", [["Node.js", "nodedotjs"], ["Express", "express"], ["FastAPI", "fastapi"], [".NET", "dotnet"], ["Socket.IO", "socketdotio"]]],
  ["DATA", [["PostgreSQL", "postgresql"], ["MongoDB", "mongodb"], ["MySQL", "mysql"], ["Prisma", "prisma"], ["MinIO", "minio"]]],
  ["DEVOPS", [["Docker", "docker"], ["Jenkins", "jenkins"], ["Git", "git"], ["GitHub", "github"], ["Vercel", "vercel"], ["OVHcloud", "ovh"]]],
  ["PROTOCOLS", [["MQTT", "mqtt"], ["DICOM", null], ["Orthanc", null], ["OPC UA", null], ["Modbus", null]]],
];

// Desktop rows keep the original badge wall: alternating row colours.
const ROWS = [
  ["TypeScript", "JavaScript", "Python", "C#"],
  ["React", "Next.js", "Tailwind CSS", "Node.js", "Express"],
  ["FastAPI", ".NET", "Socket.IO", "PostgreSQL", "MongoDB"],
  ["MySQL", "Prisma", "MinIO", "Docker", "Jenkins"],
  ["Git", "GitHub", "Vercel", "OVHcloud", "MQTT"],
  ["DICOM", "Orthanc", "OPC UA", "Modbus"],
];

const logos = new Map(GROUPS.flatMap(([, items]) => items));
const badgeUrl = (label, color) => {
  const logo = logos.get(label);
  return `https://img.shields.io/badge/${encodeURIComponent(label)}-${color}?style=for-the-badge${logo ? `&logo=${logo}&logoColor=E8EEF8` : ""}`;
};

async function fetchBadge(label, color) {
  const res = await fetch(badgeUrl(label, color));
  if (!res.ok) throw new Error(`shields.io returned ${res.status} for ${label}`);
  const svg = await res.text();
  return {
    svg,
    width: Number(svg.match(/<svg[^>]*\bwidth="([\d.]+)"/)[1]),
    logo: svg.match(/<image[^>]*href="(data:image\/svg\+xml;base64,[^"]+)"/)?.[1] ?? null,
  };
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const ALL = GROUPS.flatMap(([, items]) => items.map(([l]) => l));
const ALT = `Tech stack: ${ALL.join(", ")}`;

// Lays badge rows out centred. Badges rise in one after another, then a soft light
// sweeps across them every few seconds (clipped to the badges themselves).
function compose(rows, GAP, H) {
  const widths = rows.map((row) => row.reduce((w, b) => w + b.width, 0) + GAP * (row.length - 1));
  const W = Math.ceil(Math.max(...widths)), totalH = rows.length * (H + GAP) - GAP;
  let out = "", clip = "", n = 0;
  rows.forEach((row, r) => {
    let x = (W - widths[r]) / 2;
    for (const b of row) {
      const y = r * (H + GAP);
      out += `<g class="up" ${at(0.1 + n++ * 0.045)}>${b.svg.replace(/^<svg /, `<svg x="${x.toFixed(1)}" y="${y}" `)}</g>`;
      clip += `<rect x="${x.toFixed(1)}" y="${y}" width="${b.width}" height="${H}"/>`;
      x += b.width + GAP;
    }
  });
  const sweepStart = (0.1 + n * 0.045 + 0.8).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}" role="img" aria-label="${esc(ALT)}">
  <style>${MOTION_CSS}</style>
  <defs><clipPath id="badges">${clip}</clipPath>
    <linearGradient id="sheen" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  ${out}
  <g clip-path="url(#badges)"><rect x="-160" y="-20" width="140" height="${totalH + 40}" fill="url(#sheen)" transform="skewX(-20)">
    <animate attributeName="x" values="-160;${W + 120};${W + 120}" keyTimes="0;0.3;1" dur="8s" begin="${sweepStart}s" repeatCount="indefinite"/></rect></g>
</svg>
`;
}

async function desktop() {
  const GAP = 6, H = 28;
  const rows = await Promise.all(ROWS.map((row, r) =>
    Promise.all(row.map((label) => fetchBadge(label, r % 2 ? DARK : LIGHT)))));
  return { svg: compose(rows, GAP, H), logos: rows };
}

// Same badges as desktop, re-flowed into narrower rows so they scale down evenly on phones.
async function mobile() {
  const MAX = 400, GAP = 5, H = 28;
  const order = ROWS.flat();
  const sized = await Promise.all(order.map((l) => fetchBadge(l, LIGHT)));
  const pack = (max) => {
    const rows = [[]];
    let w = 0;
    order.forEach((label, i) => {
      const bw = sized[i].width;
      if (rows.at(-1).length && w + GAP + bw > max) { rows.push([]); w = 0; }
      w += (rows.at(-1).length ? GAP : 0) + bw;
      rows.at(-1).push(label);
    });
    return rows;
  };
  // Widest packing up to MAX that leaves no badge alone on the last row.
  let rows = pack(MAX);
  for (let max = MAX; max >= 300 && rows.at(-1).length < 2; max -= 5) rows = pack(max);
  const badges = await Promise.all(rows.map((row, r) =>
    Promise.all(row.map((label) => fetchBadge(label, r % 2 ? DARK : LIGHT)))));
  return compose(badges, GAP, H);
}

const [d, m] = await Promise.all([desktop(), mobile()]);
await writeFile("assets/tech.svg", d.svg);
await writeFile("assets/tech-mobile.svg", m);
console.log("wrote assets/tech.svg and assets/tech-mobile.svg");
