import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const SimpleBlueCircle: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Animate scale using a spring effect
  const scale = spring({
    frame,
    fps: 30,
    mass: 1,
    tension: 200,
    friction: 15
  });
  
  // Move the circle horizontally across the screen
  const xPosition = interpolate(frame, [0, 150], [-200, 1920 + 200]);
  
  return (
    <AbsoluteFill style={{backgroundColor: '#1a1a1a'}}>
      <div 
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          backgroundColor: '#3b82e6',
          borderRadius: '50%',
          transform: `translate(${xPosition}px, 440px) scale(${scale})`,
          transformOrigin: 'center center'
        }}
      />
    </AbsoluteFill>
  );
};