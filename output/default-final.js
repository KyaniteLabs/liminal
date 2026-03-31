import React, {useMemo} from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

const HydraComposition: React.FC = () => {
  const frame = useCurrentFrame();

  const colorShift = (hue: number, saturation: number, lightness: number) => {
    return `hsl(${hue + frame * 2}, ${saturation}%, ${lightness}%)`;
  };

  const pattern1Rotation = interpolate(frame, [0, 150], [0, 720]);
  const pattern2Rotation = interpolate(frame, [0, 150], [0, -540]);

  const wave1 = Math.sin(frame * 0.1) * 50;
  const wave2 = Math.cos(frame * 0.08) * 80;
  const wave3 = Math.sin(frame * 0.05) * 100;

  const feedbackOffset = useMemo(() => ({
    x: Math.sin(frame * 0.03) * 100,
    y: Math.cos(frame * 0.04) * 80,
  }), [frame]);

  return (
    <AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
      {/* Base gradient layer */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: `radial-gradient(circle at 50% 50%, 
          ${colorShift(200, 80, 30)}, 
          ${colorShift(280, 90, 20)}, 
          ${colorShift(320, 85, 15)})`,
        opacity: 0.6,
      }} />

      {/* Feedback layer 1 - offset circles */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `translate(${feedbackOffset.x}px, ${feedbackOffset.y}px)`,
        opacity: 0.4,
        mixBlendMode: 'screen',
      }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${30 + i * 10}%`,
            top: `${20 + i * 8}%`,
            width: `${200 + i * 50}px`,
            height: `${200 + i * 50}px`,
            borderRadius: '50%',
            border: `${3 + i}px solid ${colorShift(i * 45, 100, 60)}`,
            boxShadow: `0 0 ${30 + i * 10}px ${colorShift(i * 45, 100, 50)}`,
          }} />
        ))}
      </div>

      {/* Geometric grid pattern */}
      <div style={{
        position: 'absolute',
        width: '200%',
        height: '200%',
        left: '-50%',
        top: '-50%',
        transform: `rotate(${pattern1Rotation}deg) scale(${1 + Math.sin(frame * 0.05) * 0.3})`,
        opacity: 0.3,
      }}>
        {[...Array(20)].map((_, row) =>
          [...Array(20)].map((_, col) => (
            <div key={`${row}-${col}`} style={{
              position: 'absolute',
              left: `${col * 5}%`,
              top: `${row * 5}%`,
              width: '4%',
              height: '4%',
              backgroundColor: colorShift(row * 18 + col * 18, 100, 50),
              transform: `rotate(${frame * (row + col) * 0.5}deg)`,
              opacity: 0.6,
            }} />
          ))
        )}
      </div>

      {/* Rotating geometric shapes */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `rotate(${pattern2Rotation}deg)`,
      }}>
        {/* Triangle pattern */}
        {[...Array(6)].map((_, i) => (
          <div key={`tri-${i}`} style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 0,
            height: 0,
            borderLeft: `${150 + i * 30}px solid transparent`,
            borderRight: `${150 + i * 30}px solid transparent`,
            borderBottom: `${250 + i * 50}px solid ${colorShift(i * 60 + frame * 3, 100, 60)}`,
            transform: `translate(-50%, -50%) rotate(${i * 30}deg)`,
            opacity: 0.4,
          }} />
        ))}
      </div>

      {/* Wave distortion layer */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `translateY(${wave1}px) scaleY(${1 + Math.sin(frame * 0.1) * 0.1})`,
      }}>
        {[...Array(12)].map((_, i) => (
          <div key={`wave-${i}`} style={{
            position: 'absolute',
            left: 0,
            top: `${8 * i}%`,
            width: '100%',
            height: '2px',
            background: `linear-gradient(90deg, 
              transparent, 
              ${colorShift(i * 30, 100, 70)}, 
              ${colorShift(i * 30 + 60, 100, 50)}, 
              transparent)`,
            transform: `skewX(${Math.sin(frame * 0.1 + i) * 20}deg)`,
            opacity: 0.5,
          }} />
        ))}
      </div>

      {/* Concentric circles with pulse */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {[...Array(15)].map((_, i) => {
          const scale = interpolate(frame, [0, 150], [0.5, 2]) + i * 0.15;
          const pulse = Math.sin(frame * 0.1 + i * 0.5) * 20;
          return (
            <div key={`circle-${i}`} style={{
              position: 'absolute',
              width: `${100 + i * 60 + pulse}px`,
              height: `${100 + i * 60 + pulse}px`,
              borderRadius: '50%',
              border: `${2}px solid ${colorShift(i * 24 + frame * 2, 100, 60)}`,
              opacity: 0.6 - i * 0.03,
            }} />
          );
        })}
      </div>

      {/* Color bars with shift */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        transform: `translateX(${wave2}px) rotate(${wave3}deg)`,
      }}>
        {[...Array(12)].map((_, i) => (
          <div key={`bar-${i}`} style={{
            flex: 1,
            background: `linear-gradient(180deg, 
              ${colorShift(i * 30, 100, 70)}, 
              ${colorShift(i * 30 + 180, 100, 40)})`,
            margin: '2px',
            transform: `scaleY(${0.8 + Math.sin(frame * 0.08 + i * 0.3) * 0.3})`,
          }} />
        ))}
      </div>

      {/* Overlay noise pattern */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0.1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />

      {/* Central glow */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: `${300 + Math.sin(frame * 0.1) * 100}px`,
        height: `${300 + Math.sin(frame * 0.1) * 100}px`,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, 
          ${colorShift(frame * 2, 100, 80)} 0%, 
          transparent 70%)`,
        opacity: 0.8,
      }} />

      {/* Scrolling texture */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '200%',
        top: `${(frame * 5) % 100 - 50}%`,
        opacity: 0.2,
        transform: `scale(${1 + Math.sin(frame * 0.03) * 0.2})`,
      }}>
        {[...Array(30)].map((_, i) => (
          <div key={`scroll-${i}`} style={{
            position: 'absolute',
            left: `${3 * i}%`,
            top: `${5 * i}%`,
            width: '2px',
            height: '100px',
            background: `linear-gradient(180deg, 
              transparent, 
              ${colorShift(i * 12 + frame, 100, 70)}, 
              transparent)`,
          }} />
        ))}
      </div>

      {/* Kaleidoscope effect */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `rotate(${frame * 0.5}deg)`,
      }}>
        {[...Array(8)].map((_, i) => (
          <div key={`kaleido-${i}`} style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '300px',
            height: '4px',
            background: `linear-gradient(90deg, 
              ${colorShift(i * 45 + frame * 3, 100, 60)}, 
              transparent)`,
            transformOrigin: 'left center',
            transform: `translate(0, -50%) rotate(${i * 45}deg)`,
            opacity: 0.7,
          }} />
        ))}
      </div>

      {/* Vignette overlay */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)',
        pointerEvents: 'none',
      }} />
    </AbsoluteFill>
  );
};

export const HydraComposition;