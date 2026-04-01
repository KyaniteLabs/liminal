import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const SimpleBlueCircle: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = 30;
  
  // Calculate scale using a spring animation that starts at frame 0
  const scale = spring({ 
    frame, 
    fps,
    stiffness: 150,
    damping: 20,
    mass: 1
  });
  
  // Calculate horizontal position to move the circle from left to right
  const xPosition = interpolate(frame, [0, 150], [-300, 1920 + 300]);
  
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: `${xPosition}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
          width: 200,
          height: 200,
          backgroundColor: '#3b82f6',
          borderRadius: '50%'
        }}
      />
    </AbsoluteFill>
  );
};