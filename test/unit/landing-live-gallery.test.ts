import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('landing-live gallery metadata rendering', () => {
  it('renders a single variant badge per card', () => {
    const htmlPath = path.resolve(process.cwd(), 'landing-live/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const renderCardsSection = html.slice(
      html.indexOf('function renderCards()'),
      html.indexOf('function renderStars')
    );

    expect(renderCardsSection).toContain("'<span class=\"meta-badge ");
    expect(renderCardsSection).not.toContain("'<span class=\"variant-badge ");
  });
});

describe('landing-live s1ntr.com brand consistency', () => {
  const htmlPath = path.resolve(process.cwd(), 'landing-live/index.html');
  const dataPath = path.resolve(process.cwd(), 'landing-live/gallery-data.js');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const data = fs.readFileSync(dataPath, 'utf8');

  it('uses Sinter in the <title> and canonical URL', () => {
    expect(html).toMatch(/<title>Sinter/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/s1ntr\.com\/">/);
    expect(html).toMatch(/<meta property="og:url" content="https:\/\/s1ntr\.com\/">/);
    expect(html).toMatch(/<meta property="og:site_name" content="Sinter \(s1ntr\.com\)">/);
  });

  it('brands the hero as Sinter (not Liminal)', () => {
    expect(html).toMatch(/<span class="accent">Sinter<\/span> Dogfood Gallery/);
    expect(html).not.toMatch(/<span class="accent">Liminal<\/span>/);
  });

  it('brands the footer with Sinter and s1ntr.com link', () => {
    expect(html).toMatch(/<span class="footer-version">Sinter v[\d.]+<\/span>/);
    expect(html).toMatch(/<a href="https:\/\/s1ntr\.com\/">s1ntr\.com<\/a>/);
    expect(html).not.toMatch(/Liminal v[\d.]+/);
  });

  it('uses the sinter-ratings localStorage key (not liminal-ratings)', () => {
    expect(html).toMatch(/var STORAGE_KEY = 'sinter-ratings';/);
    expect(html).toMatch(/a\.download = 'sinter-ratings-'/);
    expect(html).not.toMatch(/'liminal-ratings'/);
  });

  it('brands the gallery-data.js header as Sinter (s1ntr.com)', () => {
    expect(data).toMatch(/Sinter \(s1ntr\.com\) Dogfood Gallery/);
    expect(data).not.toMatch(/Liminal Dogfood Gallery/);
  });

  it('contains zero Liminal/liminal references in the user-facing landing surface', () => {
    // Strict: no case-insensitive "liminal" in the visible landing surface.
    // (The word "Liminal" is now exclusively a Sinter internal/legacy name in source code.)
    const lowerHtml = html.toLowerCase();
    const lowerData = data.toLowerCase();
    expect(lowerHtml).not.toContain('liminal');
    expect(lowerData).not.toContain('liminal');
  });
});
