import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const BlueCircleAnimation: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Animation parameters
  const durationInFrames = 150; // 5 seconds at 30fps
  const radiusStart = 20;
  const radiusEnd = 80;
  const opacityStart = 0.3;
  const opacityEnd = 1;
  const rotationSpeed = 60;
  
  // Calculate animation values based on frame number
  const progress = interpolate(frame, [0, durationInFrames], [0, 1]);
  
  const radius = spring(interpolate(frame, [0, durationInFrames], [radiusStart, radiusEnd]), {damping: 25});
  const opacity = interpolate(progress, [0, 1], [opacityStart, opacityEnd]);
  const rotation = (frame * rotationSpeed) % 360;
  
  return (
    <AbsoluteFill style={{backgroundColor: '#0a0e17'}}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: radius + 'px',
          height: radius + 'px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at center, #3b82f6 0%, #1d4ed8 100%)',
          boxShadow: `0 ${radius / 4}px ${radius / 2}px rgba(59, 130, 246, 0.5), inset 0 ${-radius / 10}px ${radius / 5}px rgba(59, 130, 246, 0.3)`,
          opacity: opacity,
          transformOrigin: 'center center',
          animation: `none`, // Animation handled via Remotion's frame-based timing
          willChange: 'transform'
        }}
      >
        {/* Inner highlight for depth */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: radius * 0.3 + 'px',
            height: radius * 0.3 + 'px',
            borderRadius: '50%',
            background: '#60a5fa',
            opacity: 0.4,
            transformOrigin: 'center center'
          }}
        />
      </div>
      
      {/* Subtle grid pattern in background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `radial-gradient(#1f2937 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          opacity: 0.1
        }}
      />
    </AbsoluteFill>
  );
};