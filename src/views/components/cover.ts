// Generative cover art — bespoke per genre, drawn as SVG strings. No stock
// images, so nothing for the iframe CSP to block, and every tile feels designed.
import type { Cover, Motif } from '../../catalog.js';

let UID = 0;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

// A fixed, deterministic particle scatter — a faint star/ember field that gives
// every frame ambient texture and keeps a wide hero crop from reading as empty.
const DOTS: [number, number, number, number][] = [
  [40, 60, 2.2, 0.5],
  [82, 28, 1.3, 0.32],
  [128, 78, 1.7, 0.4],
  [201, 48, 2.6, 0.5],
  [251, 100, 1.5, 0.3],
  [281, 158, 2.0, 0.45],
  [30, 150, 1.5, 0.34],
  [61, 240, 2.2, 0.4],
  [110, 201, 1.3, 0.3],
  [171, 262, 1.7, 0.4],
  [231, 221, 2.4, 0.46],
  [272, 271, 1.5, 0.3],
  [151, 40, 1.5, 0.34],
  [211, 150, 1.3, 0.3],
  [100, 121, 1.1, 0.24],
  [242, 182, 1.7, 0.4],
];

export function coverArt(c: Cover, glyph = '', opts: { hero?: boolean } = {}): string {
  const id = `m${UID++}`;
  const a = c.accent;
  const hero = !!opts.hero;
  const scenes: Record<Motif, string> = {
    court: `
      <path d="M0 210 H300" stroke="${a}" stroke-width="2" opacity=".5"/>
      <circle cx="150" cy="210" r="48" fill="none" stroke="${a}" stroke-width="2" opacity=".55"/>
      <rect x="108" y="210" width="84" height="120" fill="none" stroke="${a}" stroke-width="2" opacity=".45"/>
      <path d="M70 330 A120 120 0 0 1 230 330" fill="none" stroke="${a}" stroke-width="2" opacity=".4"/>
      <circle cx="150" cy="150" r="10" fill="${a}" opacity=".9"/>`,
    pitch: `
      <line x1="150" y1="0" x2="150" y2="300" stroke="${a}" stroke-width="2" opacity=".45"/>
      <circle cx="150" cy="150" r="46" fill="none" stroke="${a}" stroke-width="2" opacity=".5"/>
      <rect x="-40" y="95" width="86" height="110" fill="none" stroke="${a}" stroke-width="2" opacity=".45"/>
      <rect x="254" y="95" width="86" height="110" fill="none" stroke="${a}" stroke-width="2" opacity=".45"/>
      <circle cx="150" cy="150" r="6" fill="${a}"/>`,
    ice: `
      <circle cx="150" cy="60" r="40" fill="none" stroke="${a}" stroke-width="2" opacity=".4"/>
      <circle cx="70" cy="230" r="34" fill="none" stroke="${a}" stroke-width="2" opacity=".5"/>
      <circle cx="230" cy="230" r="34" fill="none" stroke="${a}" stroke-width="2" opacity=".5"/>
      <line x1="0" y1="150" x2="300" y2="150" stroke="#fff" stroke-width="3" opacity=".35"/>
      <circle cx="150" cy="150" r="7" fill="${a}"/>`,
    newsroom: `
      <circle cx="150" cy="120" r="62" fill="none" stroke="${a}" stroke-width="1.5" opacity=".45"/>
      <ellipse cx="150" cy="120" rx="26" ry="62" fill="none" stroke="${a}" stroke-width="1.5" opacity=".45"/>
      <line x1="88" y1="120" x2="212" y2="120" stroke="${a}" stroke-width="1.5" opacity=".45"/>
      <rect x="40" y="232" width="150" height="13" rx="3" fill="${a}" opacity=".85"/>
      <rect x="40" y="254" width="92" height="9" rx="3" fill="#fff" opacity=".25"/>`,
    globe: `
      <circle cx="150" cy="150" r="92" fill="none" stroke="${a}" stroke-width="1.5" opacity=".5"/>
      <ellipse cx="150" cy="150" rx="34" ry="92" fill="none" stroke="${a}" stroke-width="1.5" opacity=".4"/>
      <ellipse cx="150" cy="150" rx="70" ry="92" fill="none" stroke="${a}" stroke-width="1.5" opacity=".3"/>
      <line x1="58" y1="150" x2="242" y2="150" stroke="${a}" stroke-width="1.5" opacity=".4"/>
      <path d="M70 110 H230 M70 190 H230" stroke="${a}" stroke-width="1.5" opacity=".3"/>`,
    film: `
      <circle cx="150" cy="205" r="80" fill="${a}" opacity=".9"/>
      <circle cx="150" cy="205" r="80" fill="url(#sun${id})"/>
      <rect x="0" y="0" width="300" height="34" fill="#000" opacity=".5"/>
      <rect x="0" y="266" width="300" height="34" fill="#000" opacity=".5"/>
      <path d="M30 250 H270 M55 268 H245" stroke="#000" stroke-width="2" opacity=".25"/>`,
    summit: `
      <path d="M0 300 L95 120 L160 300 Z" fill="${a}" opacity=".85"/>
      <path d="M120 300 L215 150 L300 300 Z" fill="#fff" opacity=".14"/>
      <path d="M95 120 L120 158 L72 158 Z" fill="#fff" opacity=".5"/>
      <circle cx="235" cy="72" r="26" fill="${a}" opacity=".55"/>`,
    orbit: `
      <ellipse cx="150" cy="150" rx="120" ry="48" fill="none" stroke="${a}" stroke-width="1.5" opacity=".5" transform="rotate(-18 150 150)"/>
      <ellipse cx="150" cy="150" rx="120" ry="70" fill="none" stroke="${a}" stroke-width="1.5" opacity=".3" transform="rotate(22 150 150)"/>
      <circle cx="150" cy="150" r="30" fill="${a}" opacity=".9"/>
      <circle cx="150" cy="150" r="30" fill="url(#sun${id})"/>
      <circle cx="262" cy="118" r="7" fill="#fff" opacity=".8"/>`,
    stage: `
      <path d="M70 0 L20 300 L120 300 L130 0 Z" fill="${a}" opacity=".18"/>
      <path d="M210 0 L170 300 L270 300 L240 0 Z" fill="${a}" opacity=".12"/>
      <circle cx="100" cy="0" r="8" fill="${a}"/>
      <circle cx="210" cy="0" r="8" fill="${a}"/>
      <rect x="0" y="280" width="300" height="20" fill="${a}" opacity=".5"/>`,
  };
  const scene = scenes[c.motif] ?? '';
  // In the hero the 300×300 art is sliced into a wide frame; scaling the motif
  // up from centre fills more of it and reads as a composed still, not a chip.
  const sceneLayer = hero ? `<g transform="translate(150 150) scale(1.45) translate(-150 -150)">${scene}</g>` : scene;
  const particles = DOTS.map(
    ([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${a}" opacity="${hero ? o * 0.85 : o}"/>`,
  ).join('');
  const glyphOp = hero ? 0.045 : 0.05;

  return `
  <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c.from}"/><stop offset="1" stop-color="${c.to}"/>
      </linearGradient>
      <radialGradient id="sun${id}" cx="0.5" cy="0.4" r="0.6">
        <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glow${id}" cx="0.8" cy="0.22" r="0.75">
        <stop offset="0" stop-color="${a}" stop-opacity="${hero ? '.5' : '.4'}"/><stop offset="1" stop-color="${a}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="lb${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset=".32" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".5" stop-color="#fff" stop-opacity="${hero ? '.09' : '.06'}"/>
        <stop offset=".68" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="vig${id}" cx="0.5" cy="0.35" r="0.9">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
      </radialGradient>
    </defs>
    <rect width="300" height="300" fill="url(#bg${id})"/>
    <rect width="300" height="300" fill="url(#glow${id})"/>
    <g>${particles}</g>
    ${sceneLayer}
    <rect width="300" height="300" fill="url(#lb${id})"/>
    ${glyph ? `<text x="288" y="292" text-anchor="end" font-family="Big Shoulders Display, sans-serif" font-weight="900" font-size="190" fill="#fff" opacity="${glyphOp}">${escapeHtml(glyph)}</text>` : ''}
    <rect width="300" height="300" fill="url(#vig${id})"/>
  </svg>`;
}

export const ICON = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01" stroke-linecap="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  cast: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16a6 6 0 0 1 6 6M2 12a10 10 0 0 1 10 10M2 20h.01"/><rect x="2" y="3" width="20" height="14" rx="2"/></svg>`,
  tv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>`,
} as const;
