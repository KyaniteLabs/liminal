#!/usr/bin/env node
/**
 * Generate Landing Gallery from Dogfood Results
 * Produces the premium styled gallery with design tokens, star ratings, and animations
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

interface GalleryItem {
  domain: string;
  model: string;
  provider: string;
  path: string;
  success: boolean;
  iframeSrc?: string;
  label?: string;
  prompt?: string;
  iterations?: number;
  variant?: string;
  generatedAt?: string;
  duration?: number;
}

const DOMAIN_META: Record<string, { icon: string; color: string; title: string }> = {
  'glsl': { icon: '🎨', color: 'var(--accent-cyan)', title: 'GLSL Shaders' },
  'html': { icon: '🌐', color: 'var(--accent-blue)', title: 'HTML/CSS' },
  'p5': { icon: '✨', color: 'var(--accent-amber)', title: 'p5.js Sketches' },
  'hydra': { icon: '🔮', color: 'var(--accent-violet)', title: 'Hydra Synths' },
  'strudel': { icon: '🎵', color: 'var(--accent-rose)', title: 'Strudel Patterns' },
  'tone': { icon: '🎹', color: 'var(--accent-cyan)', title: 'Tone.js' },
  'three': { icon: '🧊', color: 'var(--accent-blue)', title: 'Three.js Scenes' },
  'remotion': { icon: '🎬', color: 'var(--accent-rose)', title: 'Revideo Scenes' },
  'ascii': { icon: '💻', color: 'var(--accent-violet)', title: 'ASCII Art' },
};

const DOMAIN_DISPLAY: Record<string, string> = {
  remotion: 'revideo',
};

function parseFilename(filename: string): GalleryItem | null {
  if (filename === 'index.html') return null;

  const noExt = filename.replace(/\.html$/, '');

  // Pattern: cloud-minimax-*, local-lmstudio-*, local-ollama-*
  const compoundMatch = noExt.match(/^(cloud-minimax|local-lmstudio|local-ollama)-(.+)-(.+)$/);
  if (compoundMatch) {
    const [, compound, domain, model] = compoundMatch;
    const provider = compound.split('-')[1];
    return { domain, model, provider, path: filename, success: true };
  }

  // Pattern: provider-domain-model.html
  const match = noExt.match(/^(cloud|lmstudio|ollama|minimax|glm)-(.+)-(.+)$/);
  if (match) {
    const [, provider, domain, model] = match;
    return { domain, model, provider, path: filename, success: true };
  }

  // Legacy: domain-model.html
  const legacyMatch = noExt.match(/^([a-z][\w:]+)-(.+)$/);
  if (legacyMatch) {
    const [, domain, model] = legacyMatch;
    let provider = 'unknown';
    if (model.includes('lmstudio') || model.startsWith('google-')) provider = 'lmstudio';
    else if (model.includes('ollama')) provider = 'ollama';
    else if (['gemma', 'qwen', 'phi4', 'granite', 'lfm2.5', 'deepseek', 'kimi', 'gemini'].some(m => model.toLowerCase().includes(m))) {
      provider = 'ollama';
    }
    return { domain, model, provider, path: filename, success: true };
  }

  return null;
}

function generateGallery() {
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  const files = fs.readdirSync(landingDir).filter(f => f.endsWith('.html') && f !== 'index.html');

  const items = files.map(parseFilename).filter((i): i is GalleryItem => i !== null);

  // Build GALLERY_CARDS format
  const galleryCards = items.map((item, idx) => ({
    id: `card-${idx}`,
    domain: item.domain,
    model: `${item.provider}/${item.model}`,
    label: (DOMAIN_DISPLAY[item.domain] ?? item.domain).toUpperCase(),
    iframeSrc: item.path,
    prompt: `${DOMAIN_DISPLAY[item.domain] ?? item.domain} creative code output`,
    iterations: 1,
    variant: 'standard',
    generatedAt: new Date().toISOString().slice(0, 10),
    duration: null,
  }));

  // Group by domain for stats
  const byDomain: Record<string, GalleryItem[]> = {};
  for (const item of items) {
    if (!byDomain[item.domain]) byDomain[item.domain] = [];
    byDomain[item.domain].push(item);
  }

  const totalOutputs = items.length;
  const domainsTested = Object.keys(byDomain).length;
  const models = new Set(items.map(i => i.model)).size;

  // Build domain meta
  const domainMeta = Object.fromEntries(
    Object.entries(DOMAIN_META).filter(([k]) => byDomain[k])
  );
  // Add domains not in DOMAIN_META
  for (const domain of Object.keys(byDomain)) {
    if (!domainMeta[domain]) {
      domainMeta[domain] = { icon: '📁', color: 'var(--text-muted)', title: domain };
    }
  }

  // Generate gallery-data.js
  const galleryData = {
    GALLERY_CARDS: galleryCards,
    GALLERY_STATS: { totalOutputs, domainsTested, models },
    DOMAIN_META: domainMeta,
  };

  fs.writeFileSync(
    path.join(landingDir, 'gallery-data.js'),
    `window.GALLERY_DATA = ${JSON.stringify(galleryData, null, 2)};`
  );

  // Generate premium index.html
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Liminal Dogfood Gallery — Today's Run</title>
<meta name="description" content="Real outputs from AI-generated creative code. Today's dogfood run across multiple domains and models.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&family=Source+Sans+3:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
/* ==============================
   Design Tokens (CSS Custom Properties)
   ============================== */
:root {
  /* Background layers */
  --bg-deep: #050507;
  --bg-primary: #0a0a0a;
  --bg-elevated: #111114;
  --bg-card: #131318;
  --bg-card-hover: #1a1a22;
  --bg-iframe: #000000;

  /* Text */
  --text-primary: #e0e0e0;
  --text-secondary: #9a9aaa;
  --text-muted: #5e5e6e;
  --text-bright: #f0f0f5;

  /* Accent palette */
  --accent-cyan: #00e5c8;
  --accent-amber: #ffb020;
  --accent-rose: #ff4f7b;
  --accent-violet: #a87bff;
  --accent-blue: #4facfe;

  /* Star rating */
  --star-filled: #FFD700;
  --star-empty: #555555;

  /* Badge */
  --badge-variant-bg: rgba(255, 79, 123, 0.12);
  --badge-variant-text: var(--accent-rose);
  --badge-standard-bg: rgba(0, 229, 200, 0.12);
  --badge-standard-text: var(--accent-cyan);

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-hover: rgba(255, 255, 255, 0.12);

  /* Glow */
  --glow-cyan: 0 0 40px rgba(0, 229, 200, 0.08);

  /* Typography */
  --font-heading: 'JetBrains Mono', monospace;
  --font-body: 'Source Sans 3', 'Segoe UI', sans-serif;

  /* Spacing scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
  --space-4xl: 6rem;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  /* Transitions */
  --transition-fast: 180ms ease;
  --transition-base: 300ms ease;
  --transition-slow: 500ms cubic-bezier(0.16, 1, 0.3, 1);

  /* Layout */
  --grid-min: 400px;
  --iframe-height: 300px;
  --iframe-height-mobile: 220px;
  --card-icon-size: 40px;
  --card-icon-font: 24px;
  --star-size: 20px;
}

/* ==============================
   Reset + Base
   ============================== */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-primary);
  min-height: 100vh;
}

/* ==============================
   Skip to content (accessibility)
   ============================== */
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--accent-cyan);
  color: var(--bg-deep);
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  border-radius: var(--radius-sm);
  z-index: 9999;
  transition: top var(--transition-fast);
}

.skip-link:focus {
  top: var(--space-md);
}

/* ==============================
   Focus visible (keyboard nav)
   ============================== */
:focus-visible {
  outline: 2px solid var(--accent-cyan);
  outline-offset: 2px;
}

a:focus:not(:focus-visible) {
  outline: none;
}

/* ==============================
   Hero Section
   ============================== */
.hero {
  position: relative;
  padding: var(--space-4xl) var(--space-xl) var(--space-3xl);
  text-align: center;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: -40%;
  left: 50%;
  transform: translateX(-50%);
  width: 140%;
  height: 80%;
  background: radial-gradient(ellipse at center, rgba(0, 229, 200, 0.06) 0%, rgba(10, 10, 10, 0) 60%);
  pointer-events: none;
}

.hero-badge {
  display: inline-block;
  font-family: var(--font-heading);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--accent-cyan);
  border: 1px solid rgba(0, 229, 200, 0.25);
  padding: var(--space-xs) var(--space-md);
  border-radius: 100px;
  margin-bottom: var(--space-lg);
  opacity: 0;
  animation: fadeSlideUp 600ms var(--transition-slow) 200ms forwards;
}

.hero-title {
  font-family: var(--font-heading);
  font-weight: 800;
  font-size: clamp(32px, 6vw, 64px);
  line-height: 1.1;
  color: var(--text-bright);
  letter-spacing: -0.02em;
  margin-bottom: var(--space-md);
  opacity: 0;
  animation: fadeSlideUp 600ms var(--transition-slow) 350ms forwards;
}

.hero-title .accent {
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-family: var(--font-body);
  font-weight: 300;
  font-size: clamp(16px, 2.5vw, 20px);
  color: var(--text-secondary);
  max-width: 540px;
  margin: 0 auto;
  opacity: 0;
  animation: fadeSlideUp 600ms var(--transition-slow) 500ms forwards;
}

/* ==============================
   Stats Bar
   ============================== */
.stats-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2xl);
  padding: var(--space-lg) var(--space-xl);
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: var(--space-3xl);
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  background: var(--bg-primary);
  z-index: 100;
}

.stat-item {
  text-align: center;
  opacity: 0;
  animation: fadeSlideUp 400ms var(--transition-slow) forwards;
}

.stat-item:nth-child(1) { animation-delay: 600ms; }
.stat-item:nth-child(2) { animation-delay: 700ms; }
.stat-item:nth-child(3) { animation-delay: 800ms; }
.stat-item:nth-child(4) { animation-delay: 900ms; }

.stat-value {
  font-family: var(--font-heading);
  font-weight: 800;
  font-size: 28px;
  color: var(--text-bright);
  line-height: 1;
}

.stat-item:nth-child(1) .stat-value { color: var(--accent-cyan); }
.stat-item:nth-child(4) .stat-value { color: var(--accent-amber); }

.stat-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-top: var(--space-xs);
}

.stat-divider {
  width: 1px;
  background: var(--border-subtle);
  align-self: stretch;
}

.export-btn {
  font-family: var(--font-heading);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  color: var(--accent-cyan);
  border: 1px solid rgba(0, 229, 200, 0.3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  animation: fadeSlideUp 400ms var(--transition-slow) 1000ms forwards;
  opacity: 0;
}

.export-btn:hover {
  background: rgba(0, 229, 200, 0.1);
  color: var(--text-bright);
}

/* ==============================
   Gallery Grid
   ============================== */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--grid-min), 1fr));
  gap: var(--space-xl);
  padding: 0 var(--space-xl) var(--space-4xl);
  max-width: 1600px;
  margin: 0 auto;
}

/* ==============================
   Domain Card
   ============================== */
.domain-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition:
    background var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-slow);
  opacity: 0;
  transform: translateY(20px);
}

.domain-card.visible {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 500ms var(--transition-slow), transform 500ms var(--transition-slow),
    background var(--transition-base), border-color var(--transition-base),
    box-shadow var(--transition-slow);
}

.domain-card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  box-shadow: var(--glow-cyan);
}

/* Card header */
.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-lg) var(--space-sm);
}

.card-icon {
  font-size: var(--card-icon-font);
  line-height: 1;
  flex-shrink: 0;
  width: var(--card-icon-size);
  height: var(--card-icon-size);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
}

.card-title-group {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 15px;
  color: var(--text-bright);
  line-height: 1.3;
}

.card-model-name {
  font-size: 13px;
  color: var(--accent-cyan);
  margin-top: 2px;
  line-height: 1.4;
  font-weight: 600;
}

/* Metadata row (iterations + variant badges) */
.card-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 0 var(--space-lg);
  margin-top: var(--space-xs);
}

.meta-badge {
  font-family: var(--font-heading);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 100px;
  flex-shrink: 0;
}

.meta-badge.hard {
  background: var(--badge-variant-bg);
  color: var(--badge-variant-text);
}

.meta-badge.simple {
  background: var(--badge-standard-bg);
  color: var(--badge-standard-text);
}

.meta-badge.iterations {
  background: rgba(168, 123, 255, 0.12);
  color: var(--accent-violet);
}

.meta-badge.model-badge {
  background: rgba(79, 172, 254, 0.12);
  color: var(--accent-blue);
}

/* Prompt section */
.card-prompt {
  padding: var(--space-sm) var(--space-lg);
}

.card-prompt-label {
  font-family: var(--font-heading);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.card-prompt-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
  transition: color var(--transition-fast);
}

.card-prompt-text:hover {
  color: var(--text-primary);
}

.card-prompt-text.expanded {
  -webkit-line-clamp: unset;
  display: block;
}

/* Timestamp + duration row */
.card-timestamp {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xs) var(--space-lg);
  font-family: var(--font-heading);
  font-size: 11px;
  color: var(--text-muted);
}

.card-timestamp .ts-label {
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 10px;
}

.card-timestamp .ts-value {
  color: var(--text-secondary);
  font-weight: 600;
}

.card-timestamp .ts-duration {
  color: var(--accent-amber);
  font-weight: 600;
}

.card-timestamp .ts-unknown {
  color: var(--text-muted);
  font-style: italic;
  font-weight: 400;
}

/* Iframe preview */
.card-preview {
  padding: 0 var(--space-md);
}

.card-preview iframe {
  width: 100%;
  height: var(--iframe-height);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--bg-iframe);
  display: block;
}

/* Star rating */
.card-rating {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
}

.star-widget {
  display: inline-flex;
  gap: 2px;
}

.star-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  font-size: var(--star-size);
  line-height: 1;
  color: var(--star-empty);
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.star-btn:hover {
  transform: scale(1.2);
}

.star-btn.filled {
  color: var(--star-filled);
}

.star-btn:hover ~ .star-btn {
  color: var(--star-empty);
}

.rating-label {
  font-family: var(--font-heading);
  font-size: 11px;
  color: var(--text-muted);
  margin-left: var(--space-sm);
}

/* Card footer */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-lg) var(--space-lg);
}

.card-fullscreen {
  font-family: var(--font-heading);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-cyan);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color var(--transition-fast);
}

.card-fullscreen:hover {
  color: var(--text-bright);
}

.card-fullscreen .arrow {
  transition: transform var(--transition-fast);
}

.card-fullscreen:hover .arrow {
  transform: translateX(3px);
}

/* ==============================
   Footer
   ============================== */
.site-footer {
  text-align: center;
  padding: var(--space-3xl) var(--space-xl);
  border-top: 1px solid var(--border-subtle);
}

.footer-label {
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.footer-version {
  color: var(--accent-cyan);
}

.footer-note {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: var(--space-sm);
}

/* ==============================
   Animations
   ============================== */
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==============================
   Reduced Motion
   ============================== */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .hero-badge,
  .hero-title,
  .hero-subtitle,
  .stat-item,
  .export-btn,
  .domain-card {
    opacity: 1;
    transform: none;
  }

  html {
    scroll-behavior: auto;
  }
}

/* ==============================
   Responsive
   ============================== */
@media (max-width: 860px) {
  .gallery-grid {
    grid-template-columns: 1fr;
    padding: 0 var(--space-md) var(--space-3xl);
  }

  .hero {
    padding: var(--space-3xl) var(--space-md) var(--space-2xl);
  }

  .stats-bar {
    gap: var(--space-lg);
    padding: var(--space-md);
  }

  .stat-divider {
    display: none;
  }
}

@media (max-width: 480px) {
  :root {
    --iframe-height: 220px;
  }

  .hero-title {
    font-size: 28px;
  }

  .hero-subtitle {
    font-size: 15px;
  }

  .card-header {
    flex-wrap: wrap;
  }

  .stats-bar {
    gap: var(--space-md);
  }

  .stat-value {
    font-size: 22px;
  }
}
</style>
</head>
<body>
<a href="#gallery" class="skip-link">Skip to gallery</a>

<header class="hero">
  <div class="hero-badge">Dogfood Gallery</div>
  <h1 class="hero-title">
    <span class="accent">Liminal</span> Dogfood Gallery
  </h1>
  <p class="hero-subtitle">
    Today's run — AI-generated creative code across multiple domains.
    Every card is an unretouched LLM output. Rate and compare.
  </p>
</header>

<nav class="stats-bar" aria-label="Gallery statistics">
  <div class="stat-item">
    <div class="stat-value" id="stat-outputs">--</div>
    <div class="stat-label">Outputs</div>
  </div>
  <div class="stat-divider" aria-hidden="true"></div>
  <div class="stat-item">
    <div class="stat-value" id="stat-domains">--</div>
    <div class="stat-label">Domains</div>
  </div>
  <div class="stat-divider" aria-hidden="true"></div>
  <div class="stat-item">
    <div class="stat-value" id="stat-models">--</div>
    <div class="stat-label">Models</div>
  </div>
  <div class="stat-divider" aria-hidden="true"></div>
  <div class="stat-item">
    <div class="stat-value" id="stat-avg-rating">--</div>
    <div class="stat-label">Avg Rating</div>
  </div>
  <button class="export-btn" id="export-btn" type="button" aria-label="Export ratings as JSON">Export Ratings</button>
</nav>

<main id="gallery" class="gallery-grid" role="main">
  <!-- Cards injected by JS from gallery-data.js -->
</main>

<footer class="site-footer">
  <p class="footer-label">
    Generated by <span class="footer-version">Liminal v2.1.0</span>
  </p>
  <p class="footer-note">
    Every output is an unretouched LLM generation. No cherry-picking, no manual edits.
  </p>
</footer>

<script src="gallery-data.js"></script>
<script>
// Expose globals for the gallery renderer (after data loads)
window.GALLERY_CARDS = window.GALLERY_DATA.GALLERY_CARDS;
window.GALLERY_STATS = window.GALLERY_DATA.GALLERY_STATS;
window.DOMAIN_META = window.GALLERY_DATA.DOMAIN_META;
</script>
<script>
(function() {
  'use strict';

  /* ==============================
     Constants
     ============================== */
  var STORAGE_KEY = 'liminal-ratings';
  var VISIBLE_CLASS = 'visible';
  var REVEAL_THRESHOLD = 0.08;
  var REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

  /* ==============================
     Ratings persistence
     ============================== */
  function loadRatings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveRatings(ratings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
    } catch (e) {
      /* silently fail if storage is full or blocked */
    }
  }

  function getAverageRating(ratings) {
    var keys = Object.keys(ratings);
    if (keys.length === 0) return '--';
    var sum = 0;
    for (var i = 0; i < keys.length; i++) {
      sum += ratings[keys[i]];
    }
    return (sum / keys.length).toFixed(1);
  }

  /* ==============================
     Stats update
     ============================== */
  function updateStats(ratings) {
    document.getElementById('stat-outputs').textContent = GALLERY_STATS.totalOutputs;
    document.getElementById('stat-domains').textContent = GALLERY_STATS.domainsTested;
    document.getElementById('stat-models').textContent = GALLERY_STATS.models;
    document.getElementById('stat-avg-rating').textContent = getAverageRating(ratings);
  }

  /* ==============================
     Card rendering
     ============================== */
  function renderCards() {
    var ratings = loadRatings();
    var grid = document.getElementById('gallery');
    var html = '';

    for (var i = 0; i < GALLERY_CARDS.length; i++) {
      var card = GALLERY_CARDS[i];
      var meta = DOMAIN_META[card.domain] || { icon: '\\u{1F4CB}', color: 'var(--text-muted)', title: card.domain };
      var currentRating = ratings[card.id] || 0;
      var isHard = card.variant === 'hard' || card.variant === 'stress';
      var variantLabel = isHard ? 'STRESS' : 'SIMPLE';

      var starsHtml = '';
      for (var s = 1; s <= 5; s++) {
        var filledClass = s <= currentRating ? ' filled' : '';
        starsHtml += '<button class="star-btn' + filledClass + '" ' +
          'data-card-id="' + card.id + '" ' +
          'data-star="' + s + '" ' +
          'type="button" ' +
          'aria-label="Rate ' + s + ' out of 5">' +
          '\\u2605' +
          '</button>';
      }

      var promptText = card.prompt || '(no prompt recorded)';
      var iterCount = card.iterations || '?';
      var genTime = card.generatedAt || 'Unknown';
      var durText = card.duration ? (card.duration + 's') : 'Duration not captured';

      html += '<article class="domain-card" data-domain="' + card.domain + '">' +
        '<div class="card-header">' +
          '<div class="card-icon" aria-hidden="true">' + meta.icon + '</div>' +
          '<div class="card-title-group">' +
            '<h2 class="card-title">' + (card.label || meta.title) + '</h2>' +
            '<p class="card-model-name">' + card.model + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="card-meta-row">' +
          '<span class="meta-badge iterations">' + iterCount + ' iter</span>' +
          '<span class="meta-badge ' + (isHard ? 'hard' : 'simple') + '">' + variantLabel + '</span>' +
        '</div>' +
        '<div class="card-timestamp">' +
          '<span class="ts-label">Generated</span> ' +
          '<span class="ts-value">' + genTime + '</span>' +
          '<span class="ts-label">Duration</span> ' +
          (card.duration
            ? '<span class="ts-duration">' + durText + '</span>'
            : '<span class="ts-unknown">' + durText + '</span>') +
        '</div>' +
        '<div class="card-prompt">' +
          '<div class="card-prompt-label">Prompt</div>' +
          '<div class="card-prompt-text" id="prompt-' + card.id + '">' + promptText + '</div>' +
        '</div>' +
        '<div class="card-preview">' +
          '<iframe src="' + card.iframeSrc + '" ' +
            'sandbox="allow-scripts allow-same-origin" ' +
            'loading="lazy" ' +
            'title="' + meta.title + ' output by ' + card.model + ' — AI-generated creative coding" ' +
            '>' +
          '</iframe>' +
        '</div>' +
        '<div class="card-rating">' +
          '<div class="star-widget" role="group" aria-label="Rate this output from 1 to 5 stars">' +
            starsHtml +
          '</div>' +
          '<span class="rating-label" id="rating-label-' + card.id + '">' +
            (currentRating > 0 ? currentRating + '/5' : 'Not rated') +
          '</span>' +
        '</div>' +
        '<div class="card-footer">' +
          '<span></span>' +
          '<a class="card-fullscreen" href="' + card.iframeSrc + '" target="_blank" rel="noopener">' +
            'View Fullscreen <span class="arrow" aria-hidden="true">\\u2192</span>' +
          '</a>' +
        '</div>' +
      '</article>';
    }

    grid.innerHTML = html;
    updateStats(ratings);
  }

  /* ==============================
     Star click handler
     ============================== */
  function handleStarClick(e) {
    var btn = e.target.closest('.star-btn');
    if (!btn) return;

    var cardId = btn.getAttribute('data-card-id');
    var starValue = parseInt(btn.getAttribute('data-star'), 10);

    var ratings = loadRatings();
    ratings[cardId] = starValue;
    saveRatings(ratings);

    /* Update star visuals for this card */
    var widget = btn.closest('.star-widget');
    var stars = widget.querySelectorAll('.star-btn');
    for (var i = 0; i < stars.length; i++) {
      var sv = parseInt(stars[i].getAttribute('data-star'), 10);
      if (sv <= starValue) {
        stars[i].classList.add('filled');
      } else {
        stars[i].classList.remove('filled');
      }
    }

    /* Update label */
    var label = document.getElementById('rating-label-' + cardId);
    if (label) {
      label.textContent = starValue + '/5';
    }

    /* Update average */
    document.getElementById('stat-avg-rating').textContent = getAverageRating(ratings);
  }

  /* ==============================
     Export ratings
     ============================== */
  function handleExport() {
    var ratings = loadRatings();
    var json = JSON.stringify(ratings, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'liminal-ratings-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ==============================
     Scroll reveal
     ============================== */
  function prefersReducedMotion() {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  }

  function revealCards() {
    if (prefersReducedMotion()) {
      var cards = document.querySelectorAll('.domain-card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.add(VISIBLE_CLASS);
      }
      return;
    }

    var observer = new IntersectionObserver(
      function(entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            entries[i].target.classList.add(VISIBLE_CLASS);
            observer.unobserve(entries[i].target);
          }
        }
      },
      { threshold: REVEAL_THRESHOLD }
    );

    var cards = document.querySelectorAll('.domain-card');
    for (var j = 0; j < cards.length; j++) {
      observer.observe(cards[j]);
    }
  }

  /* ==============================
     Init
     ============================== */
  function init() {
    renderCards();

    /* Delegated click handler for stars */
    document.getElementById('gallery').addEventListener('click', handleStarClick);

    /* Prompt expand/collapse */
    document.getElementById('gallery').addEventListener('click', function(e) {
      var promptEl = e.target.closest('.card-prompt-text');
      if (promptEl) {
        promptEl.classList.toggle('expanded');
      }
    });

    /* Export button */
    document.getElementById('export-btn').addEventListener('click', handleExport);

    /* Scroll reveal */
    revealCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(landingDir, 'index.html'), html);

  console.log('\\u2705 Gallery generated!');
  console.log('  \\u2022 ' + items.length + ' outputs');
  console.log('  \\u2022 ' + Object.keys(byDomain).length + ' domains');
  console.log('  \\u2022 ' + models + ' models');
  console.log('  \\u2022 landing-live/index.html (premium style with star ratings)');
  console.log('  \\u2022 landing-live/gallery-data.js');
}

generateGallery();
