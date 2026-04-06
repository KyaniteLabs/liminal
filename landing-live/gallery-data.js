/**
 * Liminal Dogfood Gallery — Card Data
 * Auto-generated from main repo dogfood-temp scan on 2026-04-06
 *
 * Each card represents one AI-generated creative coding output.
 * Paths are relative to landing-live/ directory.
 */

const GALLERY_CARDS = [
  // Per-domain per-model outputs (dogfood-all-domains matrix)
  {
    id: "p5-minimax-m27-1774975643180",
    domain: "p5",
    model: "MiniMax M2.7",
    label: "p5.js",
    variant: "standard",
    iframeSrc: "../dogfood-temp/p5-minimax-m27-1774975643180/dogfood-p5-minimax-m27-final.html"
  },
  {
    id: "p5-minimax-m25-1774975643317",
    domain: "p5",
    model: "MiniMax M2.5",
    label: "p5.js",
    variant: "standard",
    iframeSrc: "../dogfood-temp/p5-minimax-m25-1774975643317/dogfood-p5-minimax-m25-final.html"
  },
  {
    id: "p5-qwen35-1774975643355",
    domain: "p5",
    model: "Qwen 3.5",
    label: "p5.js",
    variant: "standard",
    iframeSrc: "../dogfood-temp/p5-qwen35-1774975643355/dogfood-p5-qwen35-final.html"
  },
  {
    id: "p5-phi4-1774975643433",
    domain: "p5",
    model: "Phi-4",
    label: "p5.js",
    variant: "standard",
    iframeSrc: "../dogfood-temp/p5-phi4-1774975643433/dogfood-p5-phi4-final.html"
  },
  {
    id: "p5-gemma-1774975643396",
    domain: "p5",
    model: "Gemma",
    label: "p5.js",
    variant: "standard",
    iframeSrc: "../dogfood-temp/p5-gemma-1774975643396/dogfood-p5-gemma-final.html"
  },
  {
    id: "p5-granite-1774975643468",
    domain: "p5",
    model: "Granite",
    label: "p5.js",
    variant: "standard",
    iframeSrc: "../dogfood-temp/p5-granite-1774975643468/dogfood-p5-granite-final.html"
  },
  {
    id: "glsl-gemma-1774975764764",
    domain: "glsl",
    model: "Gemma",
    label: "GLSL",
    variant: "standard",
    iframeSrc: "../dogfood-temp/glsl-gemma-1774975764764/dogfood-glsl-gemma-final.html"
  },

  // MiniMax M2.7 full stress test (all 9 domains)
  {
    id: "minimax-m27-p5",
    domain: "p5",
    model: "MiniMax M2.7",
    label: "p5.js",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/p5.html"
  },
  {
    id: "minimax-m27-glsl",
    domain: "glsl",
    model: "MiniMax M2.7",
    label: "GLSL",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/glsl.html"
  },
  {
    id: "minimax-m27-three",
    domain: "three",
    model: "MiniMax M2.7",
    label: "Three.js",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/three.html"
  },
  {
    id: "minimax-m27-strudel",
    domain: "strudel",
    model: "MiniMax M2.7",
    label: "Strudel",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/strudel.html"
  },
  {
    id: "minimax-m27-hydra",
    domain: "hydra",
    model: "MiniMax M2.7",
    label: "Hydra",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/hydra.html"
  },
  {
    id: "minimax-m27-tone",
    domain: "tone",
    model: "MiniMax M2.7",
    label: "Tone.js",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/tone.html"
  },
  {
    id: "minimax-m27-remotion",
    domain: "remotion",
    model: "MiniMax M2.7",
    label: "Remotion",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/remotion.html"
  },
  {
    id: "minimax-m27-html",
    domain: "html",
    model: "MiniMax M2.7",
    label: "HTML",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/html.html"
  },
  {
    id: "minimax-m27-ascii",
    domain: "ascii",
    model: "MiniMax M2.7",
    label: "ASCII",
    variant: "stress",
    iframeSrc: "../dogfood-temp/minimax-m27/ascii.html"
  }
];

/**
 * Domain metadata for display badges
 */
const DOMAIN_META = {
  p5:      { icon: "\u{1F3A8}", color: "var(--accent-cyan)",   title: "p5.js" },
  glsl:    { icon: "\u{1F52E}", color: "var(--accent-violet)",  title: "GLSL" },
  three:   { icon: "\u{1F9CA}", color: "var(--accent-blue)",    title: "Three.js" },
  strudel: { icon: "\u{1F941}", color: "var(--accent-amber)",   title: "Strudel" },
  hydra:   { icon: "\u{1F4FA}", color: "var(--accent-rose)",    title: "Hydra" },
  tone:    { icon: "\u{1F3B5}", color: "var(--accent-amber)",   title: "Tone.js" },
  remotion:{ icon: "\u{1F3AC}", color: "var(--accent-violet)",  title: "Remotion" },
  html:    { icon: "\u{1F5BC}", color: "var(--accent-blue)",    title: "HTML" },
  ascii:   { icon: "\u{1F4BB}", color: "var(--accent-cyan)",    title: "ASCII" }
};

/**
 * Computed stats from card data
 */
const GALLERY_STATS = {
  totalOutputs: GALLERY_CARDS.length,
  domainsTested: new Set(GALLERY_CARDS.map(function(c) { return c.domain; })).size,
  models: new Set(GALLERY_CARDS.map(function(c) { return c.model; })).size
};
