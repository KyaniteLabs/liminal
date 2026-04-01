import React from 'react';
import {useCurrentFrame, interpolate, spring, AbsoluteFill} from 'remotion';

export const BlueCircle: React.FC = () => {
  const frame = useCurrentFrame();
  
  const scale = spring({frame, fps: 30, from: 0, to: 1, config: {damping: 12}});
  
  const yOffset = interpolate(frame, [0, 150], [0, -50], {extrapolateClamp: true});
  
  const opacity = interpolate(frame, [0, 10, 140, 150], [0, 1, 1, 0], {extrapolateClamp: true});
  
  return (
    <AbsoluteFill style={{backgroundColor: '#0a0a1a', justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: '#3b82f6',
          transform: `scale(${scale}) translateY(${yOffset}px)`,
          opacity,
          boxShadow: '0 0 60px rgba(59, 130, 246, 0.5)',
        }}
      />
    </AbsoluteFill>
  );
};