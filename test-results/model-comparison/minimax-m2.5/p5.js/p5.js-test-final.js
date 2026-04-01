import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const BlueCircleAnimation: React.FC = () => {
  const frame = useCurrentFrame();

  const circleOpacity = interpolate(frame, [0, 30, 120, 150], [0, 1, 1, 0]);
  const circleScale = spring({frame, fps: 30, from: 0, to: 1, config: {damping: 10}});
  const circleY = interpolate(frame, [0, 150], [100, 540]);

  return (
    <AbsoluteFill style={{backgroundColor: '#0a0a1a'}}>
      <div
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: '#3b82f6',
          left: 860,
          top: circleY,
          transform: `scale(${circleScale})`,
          opacity: circleOpacity,
          boxShadow: '0 0 60px rgba(59, 130, 246, 0.6)',
        }}
      />
    </AbsoluteFill>
  );
};