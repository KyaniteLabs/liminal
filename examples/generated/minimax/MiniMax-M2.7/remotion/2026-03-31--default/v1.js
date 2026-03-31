import React from 'react';
import { useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';

export const TypingText: React.FC = () => {
  const frame = useCurrentFrame();

  const mainText = "Hello, World!";
  const subtitleText = "Welcome to Remotion animations";

  const typingSpeed = 3;
  const typingDuration = mainText.length * typingSpeed;
  const subtitleDelay = 45;
  const subtitleStartFrame = typingDuration + subtitleDelay;

  const charsToShow = interpolate(frame, [0, typingDuration], [0, mainText.length], {
    extrapolateRight: 'clamp',
  });

  const displayedText = mainText.substring(0, charsToShow);
  const cursorVisible = Math.floor(frame / 10) % 2 === 0;

  const subtitleOpacity = interpolate(
    frame,
    [subtitleStartFrame, subtitleStartFrame + 30],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const mainTextOpacity = interpolate(
    frame,
    [subtitleStartFrame - 15, subtitleStartFrame + 15],
    [1, 0],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: mainTextOpacity,
        }}
      >
        <span
          style={{
            fontSize: '96px',
            fontFamily: 'monospace',
            color: '#ffffff',
            fontWeight: 'bold',
          }}
        >
          {displayedText}
        </span>
        <span
          style={{
            fontSize: '96px',
            fontFamily: 'monospace',
            color: cursorVisible ? '#00ff88' : 'transparent',
            transition: 'color 0.1s',
          }}
        >
          |
        </span>
      </div>

      <div
        style={{
          fontSize: '48px',
          color: '#888888',
          marginTop: '40px',
          opacity: subtitleOpacity,
        }}
      >
        {subtitleText}
      </div>
    </AbsoluteFill>
  );
};