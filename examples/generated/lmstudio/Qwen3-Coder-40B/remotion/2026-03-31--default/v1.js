import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const TypingTextComposition: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Define timing parameters
  const typingDuration = 60; // frames for typing animation
  const pauseAfterTyping = 20; // frames before subtitle appears
  const fadeInStart = typingDuration + pauseAfterTyping;
  const fadeInDuration = 30; // frames for subtitle fade-in
  
  // Text content
  const mainText = "Hello Remotion";
  const subText = "A new way to create motion graphics";

  // Calculate which characters should be visible (typing effect)
  const getVisibleChars = () => {
    const progress = Math.min(frame / typingDuration, 1);
    const charCount = Math.floor(progress * mainText.length);
    return mainText.substring(0, charCount);
  };

  // Cursor blinking animation
  const cursorOpacity = interpolate(frame, [0, typingDuration], [1, 0], {
    easing: 'easeIn',
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  // Subtitle opacity (fade in after typing completes)
  const subtitleOpacity = interpolate(
    frame,
    [fadeInStart, fadeInStart + fadeInDuration],
    [0, 1],
    {
      easing: 'easeOut',
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp'
    }
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#0a0a12'}}>
      <div 
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: '"Courier New", monospace,
font-family: "Courier New", monospace;',
          fontSize: 96,
          fontWeight: 'bold',
          color: '#ffffff'
        }}
      >
        <span>
          {getVisibleChars()}
          <span 
            style={{
              opacity: cursorOpacity
            }}
          >
            |
          </span>
        </span>
      </div>

      <div 
        style={{
          position: 'absolute',
          top: '60%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: '"Helvetica", sans-serif',
          fontSize: 48,
          color: '#e0e0f0',
          opacity: subtitleOpacity
        }}
      >
        {subText}
      </div>
    </AbsoluteFill>
  );
};