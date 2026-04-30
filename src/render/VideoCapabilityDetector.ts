import { createRequire } from 'module';

export interface VideoCapabilities {
  revideo: boolean;
  hyperframes: boolean;
}

export class VideoCapabilityDetector {
  private static cached: VideoCapabilities | undefined;

  static detect(): VideoCapabilities {
    if (this.cached) {
      return this.cached;
    }

    const req = createRequire(import.meta.url);

    let revideo = false;
    try {
      req.resolve('@revideo/renderer');
      req.resolve('@revideo/vite-plugin');
      req.resolve('@revideo/ui');
      revideo = true;
    } catch {
      // not installed
    }

    let hyperframes = false;
    try {
      req.resolve('@hyperframes/producer');
      hyperframes = true;
    } catch {
      // not installed
    }

    this.cached = { revideo, hyperframes };
    return this.cached;
  }

  static require(domain: 'revideo' | 'hyperframes'): void {
    const caps = this.detect();

    if (domain === 'revideo' && !caps.revideo) {
      throw new Error(
        'Revideo rendering is not available. Install optional dependencies with: pnpm install or pnpm add -O @revideo/renderer @revideo/vite-plugin @revideo/ui'
      );
    }

    if (domain === 'hyperframes' && !caps.hyperframes) {
      throw new Error(
        'HyperFrames rendering is not available. Install with: pnpm add @hyperframes/producer'
      );
    }
  }

  static reset(): void {
    this.cached = undefined;
  }
}
