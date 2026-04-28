import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoCapabilityDetector } from '../../../src/render/VideoCapabilityDetector.js';

// Mock the 'module' built-in to control createRequire behavior
const mockResolve = vi.hoisted(() => vi.fn());

vi.mock('module', () => ({
  createRequire: () => ({ resolve: mockResolve }),
}));

describe('VideoCapabilityDetector', () => {
  beforeEach(() => {
    mockResolve.mockReset();
    VideoCapabilityDetector.reset();
  });

  it('detects both frameworks available when modules resolve', () => {
    mockResolve.mockReturnValue('/fake/path');

    const caps = VideoCapabilityDetector.detect();
    expect(caps.revideo).toBe(true);
    expect(caps.hyperframes).toBe(true);
  });

  it('detects neither framework when modules fail to resolve', () => {
    mockResolve.mockImplementation(() => {
      throw new Error('Cannot find module');
    });

    const caps = VideoCapabilityDetector.detect();
    expect(caps.revideo).toBe(false);
    expect(caps.hyperframes).toBe(false);
  });

  it('detects only revideo available', () => {
    mockResolve.mockImplementation((id: string) => {
      if (id === '@revideo/renderer') return '/fake/revideo';
      throw new Error('Cannot find module');
    });

    const caps = VideoCapabilityDetector.detect();
    expect(caps.revideo).toBe(true);
    expect(caps.hyperframes).toBe(false);
  });

  it('detects only hyperframes available', () => {
    mockResolve.mockImplementation((id: string) => {
      if (id === '@hyperframes/producer') return '/fake/hyperframes';
      throw new Error('Cannot find module');
    });

    const caps = VideoCapabilityDetector.detect();
    expect(caps.revideo).toBe(false);
    expect(caps.hyperframes).toBe(true);
  });

  it('require() throws for missing revideo', () => {
    mockResolve.mockImplementation(() => {
      throw new Error('Cannot find module');
    });

    expect(() => VideoCapabilityDetector.require('revideo')).toThrow('pnpm add @revideo/renderer');
  });

  it('require() throws for missing hyperframes', () => {
    mockResolve.mockImplementation(() => {
      throw new Error('Cannot find module');
    });

    expect(() => VideoCapabilityDetector.require('hyperframes')).toThrow('pnpm add @hyperframes/producer');
  });

  it('require() does not throw when framework is available', () => {
    mockResolve.mockImplementation((id: string) => {
      if (id === '@revideo/renderer') return '/fake/path';
      throw new Error('Cannot find module');
    });

    expect(() => VideoCapabilityDetector.require('revideo')).not.toThrow();
  });

  it('caches result across multiple detect() calls', () => {
    mockResolve.mockReturnValue('/fake/path');

    const first = VideoCapabilityDetector.detect();
    const second = VideoCapabilityDetector.detect();
    expect(first).toBe(second);
  });

  it('reset() clears the cache', () => {
    mockResolve.mockImplementation(() => {
      throw new Error('Cannot find module');
    });

    const first = VideoCapabilityDetector.detect();
    expect(first.revideo).toBe(false);

    VideoCapabilityDetector.reset();

    mockResolve.mockImplementation((id: string) => {
      if (id === '@revideo/renderer') return '/fake/path';
      throw new Error('Cannot find module');
    });

    const second = VideoCapabilityDetector.detect();
    expect(second.revideo).toBe(true);
  });
});
