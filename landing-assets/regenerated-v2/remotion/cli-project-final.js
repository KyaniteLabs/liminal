import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

const PARTICLE_COUNT = 50;

export const LiminalTitleSequence: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Title entrance animation
  const titleOpacity = interpolate(frame, [0, 20], [0, 1]);
  const titleScale = spring({
    frame,
    fps: 30,
    config: {stiffness: 250, damping: 25}
  });
  
  // Title movement
  const titleX = interpolate(frame, [0, 40], [-300, 0]);
  
  // Particle system
  const particles = Array.from({length: PARTICLE_COUNT}).map((_, i) => {
    const startX = Math.random() * 1920;
    const startY = Math.random() * 1080;
    const endX = Math.random() * 1920;
    const endY = Math.random() * 1080;
    const duration = 30 + Math.random() * 60;
    const delay = Math.random() * 40;
    
    const x = interpolate(
      frame,
      [delay, delay + duration],
      [startX, endX]
    );
    
    const y = interpolate(
      frame,
      [delay, delay + duration],
      [startY, endY]
    );
    
    const opacity = interpolate(frame, [0, 10, delay - 5, delay + duration], [0, 1, 1, 0]);
    
    return {
      x: isNaN(x) ? startX : x,
      y: isNaN(y) ? startY : y,
      opacity: isNaN(opacity) ? 0 : opacity
    };
  });

  // Title gradient animation
  const gradientOffset = interpolate(frame, [0, 120], [0, 1]);
  
  return (
    <AbsoluteFill style={{backgroundColor: '#0a0a0f'}}>
      {/* Background particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: 4,
            height: 4,
            backgroundColor: `hsl(${180 + Math.sin(frame * 0.05) * 60}, 70%, 60%)`,
            borderRadius: '50%',
            opacity: p.opacity,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      
      {/* Main Title Container */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          left: `calc(50% + ${titleX}px)`,
          transform: `translateX(-50%) scale(${titleScale})`,
          opacity: titleOpacity,
          textAlign: 'center'
        }}
      >
        <h1
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: '#fff',
            margin: 0,
            textTransform: 'uppercase',
            background: `linear-gradient(90deg, #ff6b00 ${gradientOffset * 50}%, #ffffff ${gradientOffset * 50 + 20}%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          LIMINAL
        </h1>
        
        {/* Title glow effect */}
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 300,
            height: 60,
            filter: 'blur(20px)',
            background: `linear-gradient(90deg, #ff6b00 ${gradientOffset * 50}%, #ffffff ${gradientOffset * 50 + 20}%)`,
            opacity: titleOpacity * 0.4,
            borderRadius: '10px'
          }}
        />
      </div>
      
      {/* Additional decorative elements */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 100,
          fontSize: 24,
          color: '#ffffff',
          opacity: interpolate(frame, [0, 30], [0, 1]),
          transform: `translateY(${interpolate(frame, [0, 60], [-50, 0])}px)`
        }}
      >
        REMOTION PRESENTATION
      </div>
      
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          right: 100,
          fontSize: 24,
          color: '#ffffff',
          opacity: interpolate(frame, [0, 30], [0, 1]),
          transform: `translateY(${interpolate(frame, [0, 60], [-50, 0])}px)`
        }}
      >
        VIDEO SEQUENCE
      </div>
      
      {/* Corner accents */}
      <div 
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          width: 120,
          height: 4,
          background: `linear-gradient(90deg, #ff6b00 ${gradientOffset * 100}%, transparent ${gradientOffset * 100 + 50}%)`,
          opacity: interpolate(frame, [0, 30], [0, 1])
        }}
      />
      
      <div 
        style={{
          position: 'absolute',
          top: 40,
          right: 40,
          width: 120,
          height: 4,
          background: `linear-gradient(90deg, transparent ${-gradientOffset * 100}%, #ff6b00 ${-gradientOffset * 100 + 50}%)`,
          opacity: interpolate(frame, [0, 30], [0, 1])
        }}
      />
      
      <div 
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          width: 120,
          height: 4,
          background: `linear-gradient(90deg, #ff6b00 ${gradientOffset * 100}%, transparent ${gradientOffset * 100 + 50}%)`,
          opacity: interpolate(frame, [0, 30], [0, 1])
        }}
      />
      
      <div 
        style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          width: 120,
          height: 4,
          background: `linear-gradient(90deg, transparent ${-gradientOffset * 100}%, #ff6b00 ${-gradientOffset * 100 + 50}%)`,
          opacity: interpolate(frame, [0, 30], [0, 1])
        }}
      />
      
      {/* Center glow pulse */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 400,
          background: `radial-gradient(circle, #ff6b00 ${interpolate(frame, [20, 60], [30, 10])}px, transparent ${interpolate(frame, [20, 60], [80, 40])}px)`,
          opacity: interpolate(frame, [0, 20, 60], [0, 0.3, 0]),
          filter: 'blur(40px)'
        }}
      />
    </AbsoluteFill>
  );
};