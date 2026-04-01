import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const BlueCircle: React.FC = () => {
  const frame = useCurrentFrame();

  const scale = spring({frame, fps: 30, config: {damping: 10, stiffness: 100}});

  const xPosition = interpolate(frame, [0, 75, 150], [0, 800, 0], {
    extrapolateRight: 'clamp',
  });

  const yPosition = interpolate(frame, [0, 75, 150], [0, -200, 0], {
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [0, 30, 120, 150], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  const circleSize = interpolate(scale, [0, 1], [50, 200]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: xPosition + 860,
          top: yPosition + 440,
          width: circleSize,
          height: circleSize,
          borderRadius: '50%',
          backgroundColor: '#4a90d9',
          boxShadow: '0 0 60px rgba(74, 144, 217, 0.6)',
          opacity: opacity,
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};