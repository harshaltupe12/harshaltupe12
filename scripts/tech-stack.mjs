// Renders assets/tech.svg (desktop: the shields.io badge wall, composed into one image)
// and assets/tech-mobile.svg (phones: the same badges in narrower rows).
// Badges and logos are fetched from shields.io at build time. Run from the repo root:
//   node scripts/tech-stack.mjs
import { writeFile } from "node:fs/promises";


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

async function desktop() {
  const GAP = 6, H = 28;
  const rows = await Promise.all(ROWS.map((row, r) =>
    Promise.all(row.map((label) => fetchBadge(label, r % 2 ? DARK : LIGHT)))));
  const widths = rows.map((row) => row.reduce((w, b) => w + b.width, 0) + GAP * (row.length - 1));
  const W = Math.ceil(Math.max(...widths));
  let out = "";
  rows.forEach((row, r) => {
    let x = (W - widths[r]) / 2;
    for (const b of row) {
      out += b.svg.replace(/^<svg /, `<svg x="${x.toFixed(1)}" y="${r * (H + GAP)}" `);
      x += b.width + GAP;
    }
  });
  const totalH = rows.length * (H + GAP) - GAP;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}" role="img" aria-label="${esc(ALT)}">${out}</svg>\n`, logos: rows };
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
  const widths = badges.map((row) => row.reduce((s, b) => s + b.width, 0) + GAP * (row.length - 1));
  const W = Math.ceil(Math.max(...widths));
  let out = "";
  badges.forEach((row, r) => {
    let x = (W - widths[r]) / 2;
    for (const b of row) {
      out += b.svg.replace(/^<svg /, `<svg x="${x.toFixed(1)}" y="${r * (H + GAP)}" `);
      x += b.width + GAP;
    }
  });
  const totalH = badges.length * (H + GAP) - GAP;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}" role="img" aria-label="${esc(ALT)}">${out}</svg>\n`;
}

const [d, m] = await Promise.all([desktop(), mobile()]);
await writeFile("assets/tech.svg", d.svg);
await writeFile("assets/tech-mobile.svg", m);
console.log("wrote assets/tech.svg and assets/tech-mobile.svg");
