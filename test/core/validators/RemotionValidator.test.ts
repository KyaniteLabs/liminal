import { describe, it, expect } from 'vitest';
import { RemotionValidator } from '../../../src/core/validators/RemotionValidator.js';

describe('RemotionValidator', () => {
  describe('validate', () => {
    it('should validate valid Remotion code with useCurrentFrame', () => {
      const code = `
import { useCurrentFrame, AbsoluteFill } from 'remotion';

export default function MyComp() {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <div style={{ color: 'white', fontSize: 100 }}>
        Frame {frame}
      </div>
    </AbsoluteFill>
  );
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Remotion code with interpolate', () => {
      const code = `
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

export default function Animated() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 100], [0, 1]);
  
  return (
    <AbsoluteFill>
      <div style={{ opacity }}>Hello</div>
    </AbsoluteFill>
  );
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Remotion code with spring animation', () => {
      const code = `
import { useCurrentFrame, spring, AbsoluteFill } from 'remotion';

export default function Bounce() {
  const frame = useCurrentFrame();
  const scale = spring({ frame, fps: 30, config: { damping: 10 } });
  
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: \`scale(\${scale})\`, width: 100, height: 100, background: 'red' }} />
    </AbsoluteFill>
  );
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Remotion code with Composition', () => {
      const code = `
import { Composition, useCurrentFrame } from 'remotion';

const MyVideo = () => {
  const frame = useCurrentFrame();
  return <div>Frame {frame}</div>;
};

export const Root = () => {
  return (
    <Composition
      id="MyVideo"
      component={MyVideo}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(true);
    });

    it('should validate Remotion code with Sequence', () => {
      const code = `
import { Sequence, AbsoluteFill } from 'remotion';

export default function Timeline() {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={30}>
        <div>Scene 1</div>
      </Sequence>
      <Sequence from={30} durationInFrames={60}>
        <div>Scene 2</div>
      </Sequence>
    </AbsoluteFill>
  );
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject code without Remotion import', () => {
      const code = `
function MyComp() {
  return <div>Hello</div>;
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Remotion code must import from "remotion" or use Remotion components/hooks');
    });

    it('should reject code without export', () => {
      const code = `
import { useCurrentFrame } from 'remotion';

function MyComp() {
  const frame = useCurrentFrame();
  return <div>{frame}</div>;
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Remotion composition should have an export (default export or named export)');
    });

    it('should reject code without component structure', () => {
      const code = `
import { useCurrentFrame } from 'remotion';

const frame = useCurrentFrame();
export { frame };
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Remotion code should define a React function component');
    });

    it('should reject empty code', () => {
      const result = RemotionValidator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should validate Remotion code with audio', () => {
      const code = `
import { useCurrentFrame, Audio, AbsoluteFill, staticFile } from 'remotion';

export default function VideoWithAudio() {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill>
      <div>Frame {frame}</div>
      <Audio src={staticFile("music.mp3")} />
    </AbsoluteFill>
  );
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Remotion code with useVideoConfig', () => {
      const code = `
import { useVideoConfig, AbsoluteFill } from 'remotion';

export default function ConfigAware() {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  
  return (
    <AbsoluteFill style={{ width, height }}>
      <div>{fps} fps, {durationInFrames} frames</div>
    </AbsoluteFill>
  );
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate named exports', () => {
      const code = `
import { useCurrentFrame, AbsoluteFill } from 'remotion';

export function MyVideo() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <div>{frame}</div>
    </AbsoluteFill>
  );
}
      `;

      const result = RemotionValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getMinSize', () => {
    it('should return 500 bytes as minimum size', () => {
      expect(RemotionValidator.getMinSize()).toBe(500);
    });
  });
});
