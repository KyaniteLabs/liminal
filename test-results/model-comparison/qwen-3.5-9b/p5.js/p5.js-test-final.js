import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { AbsoluteFill } from '@remotion/player';

export const BlueCircleAnimation: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a202c' }}>
      {/* Center the circle */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          backgroundColor: '#3182ce', // Tailwind blue-500 equivalent
        }}
      >
        {/* Inner glow effect */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 70%)`,
          }}
        />

        {/* Animated border */}
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            right: '-4px',
            bottom: '-4px',
            borderRadius: '50%',
            background: `linear-gradient(
              45deg,
              #3182ce 25%,
              #63b3ed 50%,
              #4299e1 75%
            )`,
            opacity: interpolate(frame, [0, 60, 120], [0.8, 1.0, 0.8]),
          }}
        />

        {/* Pulsing core */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${interpolate(frame, [0, 60, 120], [1.0, 1.2, 1.0])})`,
            width: '340px',
            height: '340px',
            borderRadius: '50%',
            backgroundColor: '#fff',
            opacity: interpolate(frame, [0, 60], [0, 0.8]),
          }}
        />

        {/* Text in center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${interpolate(frame, [0, 30], [1.0, 1.1])})`,
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#fff',
            textAlign: 'center' as const,
            textTransform: 'uppercase' as const,
            letterSpacing: '4px',
          }}
        >
          Motion
        </div>
      </div>
    </AbsoluteFill>
  );
};