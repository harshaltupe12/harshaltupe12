// Shared typeface for every generated card. Manrope is embedded in each SVG (from
// assets/fonts) so it renders the same on GitHub, on any OS, without a network fetch.
import { readFileSync } from "node:fs";

export const FONT = "Manrope, 'Segoe UI', system-ui, -apple-system, sans-serif";

const face = (weight) => {
  const b64 = readFileSync(new URL(`../assets/fonts/manrope-${weight}.woff2`, import.meta.url)).toString("base64");
  return `@font-face{font-family:Manrope;font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
};
const STYLE = `<style>${face(400)}${face(700)}</style>`;

// Insert the font right after the root <svg ...> tag.
export const embedFont = (svg) => svg.replace(/(<svg\b[^>]*>)/, `$1\n  ${STYLE}`);
