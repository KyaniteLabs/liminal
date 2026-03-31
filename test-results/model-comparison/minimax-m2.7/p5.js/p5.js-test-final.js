import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const BlueCircle: React.FC<{fps: number; durationInFrames: number; width: number; height: number}> = () => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, 40, 80, 120, 150], [0, 1.2, 0.8, 1.1, 0], {
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [0, 20, 130, 150], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  const yOffset = interpolate(frame, [0, 60, 150], [100, 0, -50], {
    extrapolateRight: 'clamp',
  });

  const glowIntensity = interpolate(frame, [0, 75, 150], [0, 30, 0], {
    extrapolateRight: 'clamp',
  });

  const circleSize = 300;

  return (
    <AbsoluteFill style={{backgroundColor: '#0a0a1a', justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          position: 'absolute',
          transform: `translateY(${yOffset}px) scale(${scale})`,
          opacity: opacity,
          width: circleSize,
          height: circleSize,
          borderRadius: '50%',
          backgroundColor: '#1e90ff',
          boxShadow: `
            0 0 ${20 + glowIntensity}px #1e90ff,
            0 0 ${40 + glowIntensity * 2}px #1e90ff,
            0 0 ${60 + glowIntensity * 3}px rgba(30, 144, 255, 0.5)
          `,
        }}
      />
      <div
        style={{
          position: 'absolute',
          transform: `translateY(${yOffset}px) scale(${scale * 0.7})`,
          opacity: opacity * 0.3,
          width: circleSize,
          height: circleSize,
          borderRadius: '50%',
          backgroundColor: '#87ceeb',
        }}
      />
    </AbsoluteFill>
  );
};