import React from 'react';
import {useCurrentFrame, interpolate, spring, AbsoluteFill} from 'remotion';

export const SimpleBlueCircle: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Calculate position using spring physics for a bouncing effect
  const yPosition = spring({
    frame,
    fps: 30,
    durationInFrames: 150,
    mass: 1,
    tension: 200,
    friction: 40,
    from: -200,
    to: 0
  });

  // Scale animation with spring effect
  const scale = spring({
    frame,
    fps: 30,
    durationInFrames: 150,
    mass: 1,
    tension: 300,
    friction: 30,
    from: 0.2,
    to: 1
  });

  // Rotation animation using linear interpolation
  const rotation = interpolate(
    frame,
    [0, 150],
    [0, 720]
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <div 
        style={{
          width: 300,
          height: 300,
          backgroundColor: '#0066cc',
          borderRadius: '50%',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translateY(${yPosition}px) scale(${scale}) rotate(${rotation}deg)`,
          boxShadow: '0 10px 40px rgba(0, 102, 204, 0.6)',
        }}
      />
    </AbsoluteFill>
  );
};