import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const SimpleBlueCircle: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Animation parameters
  const fps = 30;
  const durationInFrames = 150;
  
  // Scale animation using spring physics
  const scale = spring({
    frame,
    fps,
    config: {m: 1, b: 10, k: 200}
  });
  
  // Opacity fade in/out
  const opacity = interpolate(frame, [0, 15, 135, 150], [0, 1, 1, 0]);
  
  // Horizontal movement (left to right)
  const xPosition = interpolate(frame, [0, durationInFrames], [-200, 200]);
  
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <div
        style={{
          width: 150,
          height: 150,
          backgroundColor: '#0066cc',
          borderRadius: '50%',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translateX(${xPosition}px) scale(${scale})`,
          opacity,
          boxShadow: '0 0 30px rgba(0,102,204,0.6)'
        }}
      />
    </AbsoluteFill>
  );
};