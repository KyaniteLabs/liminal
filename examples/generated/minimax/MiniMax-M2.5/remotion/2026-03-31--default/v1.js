import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingTextWithSubtitle: React.FC = () => {
  const frame = useCurrentFrame();
  
  const fullText = "Hello, World!";
  const subtitleText = "Welcome to Remotion";
  
  const typingSpeed = 5;
  const charsToShow = interpolate(frame, [0, fullText.length * typingSpeed], [0, fullText.length], {
    extrapolateRight: 'clamp',
  });
  const displayedText = fullText.substring(0, Math.floor(charsToShow));
  
  const cursorBlink = Math.floor(frame / 15) % 2 === 0 ? 1 : 0;
  
  const typingCompleteFrame = fullText.length * typingSpeed;
  
  const subtitleOpacity = interpolate(
    frame,
    [typingCompleteFrame + 20, typingCompleteFrame + 70],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  return (
    <AbsoluteFill style={{backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 80,
        color: '#00ff88',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
      }}>
        {displayedText}
        <span style={{
          opacity: cursorBlink,
          backgroundColor: '#00ff88',
          marginLeft: 4,
          width: 6,
          height: 80,
          display: 'inline-block',
        }} />
      </div>
      
      <div style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: 36,
        color: '#ffffff',
        marginTop: 50,
        opacity: subtitleOpacity,
        letterSpacing: 2,
      }}>
        {subtitleText}
      </div>
    </AbsoluteFill>
  );
};