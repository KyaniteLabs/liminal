/**
 * RemotionTemplates - Self-contained Remotion component templates
 *
 * Each template is a complete TSX React component using Remotion's
 * useCurrentFrame, interpolate, AbsoluteFill, and spring for animation.
 * Selected by prompt keywords in RemotionGenerator.
 */

export type RemotionTemplateType =
  | 'particle-animation'
  | 'text-reveal'
  | 'geometric-patterns'
  | 'gradient-loop';

const templates: Record<RemotionTemplateType, string> = {
  'particle-animation': `import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  angle: number;
  hue: number;
}

const PARTICLE_COUNT = 80;
const DURATION = 150;

function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 6,
      speed: 0.3 + Math.random() * 1.2,
      angle: Math.random() * Math.PI * 2,
      hue: 200 + Math.random() * 160,
    });
  }
  return particles;
}

const particles = generateParticles();

export const ParticleAnimation: React.FC = () => {
  const frame = useCurrentFrame();

  const rotation = interpolate(frame, [0, DURATION], [0, 360], {
    extrapolateRight: 'clamp',
  });

  const globalOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a1a',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          opacity: globalOpacity,
        }}
      >
        {particles.map((p, i) => {
          const drift = frame * p.speed;
          const px = p.x + Math.cos(p.angle + drift * 0.02) * 8;
          const py = p.y + Math.sin(p.angle + drift * 0.02) * 8;
          const pulse = interpolate(
            frame % 60,
            [0, 30, 60],
            [p.size * 0.7, p.size * 1.3, p.size * 0.7]
          );
          const alpha = interpolate(
            frame,
            [i * 1.5, i * 1.5 + 20],
            [0, 0.4 + Math.random() * 0.4],
            { extrapolateRight: 'clamp' }
          );

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: \`\${px}%\`,
                top: \`\${py}%\`,
                width: pulse,
                height: pulse,
                borderRadius: '50%',
                backgroundColor: \`hsla(\${p.hue + frame * 0.5}, 80%, 65%, \${alpha})\`,
                boxShadow: \`0 0 \${pulse * 2}px hsla(\${p.hue}, 90%, 60%, \${alpha * 0.6})\`,
                transform: \`rotate(\${rotation * p.speed}deg)\`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
`,

  'text-reveal': `import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill, spring } from 'remotion';

const TEXT_LINES = [
  'Emerging from silence',
  'Letters find their voice',
  'One character at a time',
  'Until the story is whole',
];

const FONT_SIZE = 52;
const LINE_DELAY = 18;

export const TextReveal: React.FC = () => {
  const frame = useCurrentFrame();

  const { fps } = { fps: 30 };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0d0d0d',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: "'Georgia', serif",
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {TEXT_LINES.map((line, lineIdx) => {
          const lineStart = lineIdx * LINE_DELAY;
          const lineProgress = interpolate(
            frame - lineStart,
            [0, 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          const lineY = interpolate(lineProgress, [0, 1], [30, 0]);
          const lineOpacity = lineProgress;

          const scaleSpring = spring({
            frame: frame - lineStart,
            fps,
            config: { damping: 12, stiffness: 80, mass: 0.8 },
          });

          return (
            <div
              key={lineIdx}
              style={{
                display: 'flex',
                gap: 2,
                transform: \`translateY(\${lineY}px) scale(\${scaleSpring})\`,
                opacity: lineOpacity,
              }}
            >
              {line.split('').map((char, charIdx) => {
                const charStart = lineStart + charIdx * 1.5;
                const charProgress = interpolate(
                  frame - charStart,
                  [0, 8],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                );

                const charY = interpolate(charProgress, [0, 1], [20, 0]);
                const charOpacity = charProgress;
                const charScale = interpolate(charProgress, [0, 0.5, 1], [0.5, 1.2, 1]);

                const hue = 45 + charIdx * 8 + lineIdx * 20;

                return (
                  <span
                    key={charIdx}
                    style={{
                      fontSize: FONT_SIZE,
                      color: \`hsl(\${hue}, 70%, 75%)\`,
                      opacity: charOpacity,
                      transform: \`translateY(\${charY}px) scale(\${charScale})\`,
                      display: 'inline-block',
                      textShadow: \`0 0 20px hsla(\${hue}, 80%, 60%, 0.4)\`,
                      fontWeight: 300,
                      letterSpacing: 2,
                    }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
`,

  'geometric-patterns': `import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

const GRID_SIZE = 6;
const CELL_SIZE = 80;
const GAP = 12;
const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a8e6cf'];

export const GeometricPatterns: React.FC = () => {
  const frame = useCurrentFrame();

  const globalRotation = interpolate(frame, [0, 150], [0, 180], {
    extrapolateRight: 'clamp',
  });

  const breathScale = interpolate(
    frame,
    [0, 40, 80, 120, 150],
    [0.9, 1.05, 0.95, 1.02, 0.9]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#111118',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: \`repeat(\${GRID_SIZE}, \${CELL_SIZE}px)\`,
          gap: GAP,
          transform: \`rotate(\${globalRotation}deg) scale(\${breathScale})\`,
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
          const row = Math.floor(idx / GRID_SIZE);
          const col = idx % GRID_SIZE;
          const distFromCenter = Math.sqrt(
            Math.pow(row - GRID_SIZE / 2, 2) +
            Math.pow(col - GRID_SIZE / 2, 2)
          );

          const phaseOffset = distFromCenter * 8;
          const shapeRotation = interpolate(
            frame,
            [0 + phaseOffset, 60 + phaseOffset],
            [0, 360],
            { extrapolateRight: 'clamp' }
          );

          const shapeScale = interpolate(
            (frame + phaseOffset) % 80,
            [0, 40, 80],
            [0.6, 1.0, 0.6]
          );

          const colorIdx = (row + col + Math.floor(frame / 20)) % COLORS.length;
          const opacity = interpolate(
            frame,
            [phaseOffset, phaseOffset + 20],
            [0, 0.85],
            { extrapolateRight: 'clamp' }
          );

          const isCircle = (row + col) % 2 === 0;
          const borderWidth = 2 + Math.sin(frame * 0.05 + idx) * 1;

          return (
            <div
              key={idx}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: isCircle ? '50%' : '4px',
                border: \`\${borderWidth}px solid \${COLORS[colorIdx]}\`,
                backgroundColor: \`\${COLORS[colorIdx]}22\`,
                transform: \`rotate(\${shapeRotation}deg) scale(\${shapeScale})\`,
                opacity,
                boxShadow: \`0 0 \${12 + shapeScale * 8}px \${COLORS[colorIdx]}33, inset 0 0 \${shapeScale * 10}px \${COLORS[colorIdx]}11\`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
`,

  'gradient-loop': `import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

const PALETTE = [
  { r: 255, g: 94, b: 98 },
  { r: 255, g: 195, b: 113 },
  { r: 62, g: 207, b: 207 },
  { r: 131, g: 94, b: 235 },
  { r: 72, g: 199, b: 142 },
];

function lerpColor(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
): string {
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return \`rgb(\${r}, \${g}, \${bl})\`;
}

export const GradientLoop: React.FC = () => {
  const frame = useCurrentFrame();

  const cycleDuration = 90;
  const t = (frame % cycleDuration) / cycleDuration;

  const colorIdx1 = Math.floor(t * PALETTE.length) % PALETTE.length;
  const colorIdx2 = (colorIdx1 + 1) % PALETTE.length;
  const colorIdx3 = (colorIdx1 + 2) % PALETTE.length;
  const colorIdx4 = (colorIdx1 + 3) % PALETTE.length;

  const blendT = (t * PALETTE.length) % 1;

  const topLeft = lerpColor(PALETTE[colorIdx1], PALETTE[colorIdx2], blendT);
  const topRight = lerpColor(PALETTE[colorIdx2], PALETTE[colorIdx3], blendT);
  const bottomLeft = lerpColor(PALETTE[colorIdx3], PALETTE[colorIdx4], blendT);
  const bottomRight = lerpColor(PALETTE[colorIdx4], PALETTE[colorIdx1], blendT);

  const angle = interpolate(frame, [0, 150], [135, 495], {
    extrapolateRight: 'clamp',
  });

  const pulseOpacity = interpolate(
    frame % 60,
    [0, 30, 60],
    [0.3, 0.6, 0.3]
  );

  const grainOffset = interpolate(frame, [0, 150], [0, 1000], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: \`linear-gradient(\${angle}deg, \${topLeft}, \${topRight}, \${bottomLeft}, \${bottomRight})\`,
        backgroundSize: '300% 300%',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: '120%',
          height: '120%',
          background: \`radial-gradient(circle at \${30 + Math.sin(frame * 0.03) * 20}% \${40 + Math.cos(frame * 0.04) * 20}%, rgba(255,255,255,\${pulseOpacity}), transparent 60%)\`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: \`radial-gradient(circle at \${70 + Math.cos(frame * 0.02) * 15}% \${60 + Math.sin(frame * 0.05) * 15}%, rgba(0,0,0,\${pulseOpacity * 0.5}), transparent 50%)\`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.08,
          backgroundImage: \`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")\`,
          transform: \`translate(\${grainOffset % 50 - 25}px, \${(grainOffset * 0.7) % 50 - 25}px)\`,
        }}
      />
    </AbsoluteFill>
  );
};
`,
};

/**
 * Select a Remotion template by prompt keywords.
 */
export function selectRemotionTemplate(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (/particle|galaxy|star|dust|float|orbit|sparkle/.test(lower))
    return templates['particle-animation'];
  if (/text|typo|letter|word|reveal|title|caption|headline/.test(lower))
    return templates['text-reveal'];
  if (/geometric|shape|pattern|grid|circle|square|polygon|hexagon/.test(lower))
    return templates['geometric-patterns'];
  if (/gradient|color|blend|smooth|transition|ambient/.test(lower))
    return templates['gradient-loop'];

  return templates['gradient-loop']; // default
}

export { templates };
