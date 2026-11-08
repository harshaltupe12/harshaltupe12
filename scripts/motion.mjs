// Shared entrance and ambient animations for every card. Pure CSS inside the SVG, so it
// plays on GitHub (images run their own CSS and SMIL, no scripts). Easings are GSAP's
// expo.out (up, fade), back.out (pop) and power2.inOut (draw) as cubic-beziers.
//
// Entrance classes animate *from* a hidden state with `backwards` fill, so the resting
// state is the finished design: with reduced motion (or no animation support) the card
// simply renders static.
//
// CSS transforms replace an element's transform attribute, so put these classes on an
// element (or wrapper <g>) that has no transform of its own.
export const MOTION_CSS = `
@keyframes up{from{opacity:0;transform:translateY(10px)}}
@keyframes fade{from{opacity:0}}
@keyframes pop{from{opacity:0;transform:scale(.2)}}
@keyframes draw{from{stroke-dashoffset:1}}
@keyframes flap{50%{transform:scaleY(.45)}}
@keyframes nudge{50%{transform:translateX(4px)}}
@keyframes breathe{50%{opacity:.45}}
.up{animation:up 1s cubic-bezier(.16,1,.3,1) backwards}
.fade{animation:fade 1.4s cubic-bezier(.16,1,.3,1) backwards}
.pop{animation:pop .6s cubic-bezier(.34,1.56,.64,1) backwards;transform-box:fill-box;transform-origin:center}
.draw{stroke-dasharray:1;animation:draw 2.2s cubic-bezier(.65,0,.35,1) backwards}
.flap{animation:flap 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nudge{animation:nudge 1.8s ease-in-out infinite}
.breathe{animation:breathe 3.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`.replace(/\n/g, "");

// Inline delay for an entrance class.
export const at = (s) => `style="animation-delay:${s.toFixed(2)}s"`;
