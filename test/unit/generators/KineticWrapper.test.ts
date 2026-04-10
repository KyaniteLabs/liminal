import { describe, it, expect } from 'vitest';
import { KineticWrapper } from '../../../src/generators/kinetic/KineticWrapper.js';

describe('KineticWrapper', () => {
  it('wraps code with @keyframes in iframe-safe HTML', () => {
    const input = '<style>@keyframes spin { to { rotate: 360deg; } }</style>';
    const result = KineticWrapper.wrap(input);
    expect(result).to.include('<!DOCTYPE html>');
    expect(result).to.include('@keyframes spin');
    expect(result).to.include('kinetic-canvas');
  });

  it('returns code unchanged if already wrapped', () => {
    const input = '<!DOCTYPE html><html><body><div class="kinetic-canvas"></div></body></html>';
    const result = KineticWrapper.wrap(input);
    expect(result).toBe(input);
  });

  it('sets the title', () => {
    const input = '<style>@keyframes x { }</style>';
    const result = KineticWrapper.wrap(input, { title: 'My Art' });
    expect(result).to.include('<title>My Art</title>');
  });

  it('contains security headers', () => {
    const input = '<style>@keyframes x { }</style>';
    const result = KineticWrapper.wrap(input);
    expect(result).to.include('X-Frame-Options');
    expect(result).to.include('Content-Security-Policy');
  });

  it('sets default title when not provided', () => {
    const input = '<style>@keyframes x { }</style>';
    const result = KineticWrapper.wrap(input);
    expect(result).to.include('<title>Kinetic Artwork</title>');
  });
});
