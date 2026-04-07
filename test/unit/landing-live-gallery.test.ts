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

    expect(renderCardsSection).toContain("'<span class=\"meta-badge '");
    expect(renderCardsSection).not.toContain("'<span class=\"variant-badge ");
  });
});
