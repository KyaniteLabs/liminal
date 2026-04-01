import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const BlueCircleAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  
  const scale = interpolate(
    frame,
    [0, 30, 60, 90, 120, 150],
    [0.3, 1.2, 0.8, 1.1, 0.9, 1]
  );
  
  const yOffset = interpolate(
    frame,
    [0, 75, 150],
    [-50, 50, -50]
  );
  
  const opacity = interpolate(
    frame,
    [0, 15, 135, 150],
    [0, 1, 1, 0]
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: '50%',
          backgroundColor: '#4a90e2',
          transform: `scale(${scale}) translateY(${yOffset}px)`,
          opacity: opacity,
          boxShadow: '0 0 60px rgba(74, 144, 226, 0.6)',
        }}
      />
    </AbsoluteFill>
  );
};