import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const BlueCircle: React.FC = () => {
  const frame = useCurrentFrame();
  
  const scale = spring({frame, fps: 30, from: 0, to: 1});
  const opacity = interpolate(frame, [0, 30], [0, 1]);
  const yOffset = interpolate(frame, [0, 30], [50, 0]);
  
  return (
    <AbsoluteFill style={{backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{
        width: 200,
        height: 200,
        borderRadius: '50%',
        backgroundColor: '#4d94ff',
        transform: `scale(${scale}) translateY(${yOffset}px)`,
        opacity,
        boxShadow: '0 0 40px rgba(77, 148, 255, 0.6)'
      }} />
    </AbsoluteFill>
  );
};