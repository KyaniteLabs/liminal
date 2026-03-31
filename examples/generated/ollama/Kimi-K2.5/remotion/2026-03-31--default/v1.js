import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingTextComposition: React.FC = () => {
  const frame = useCurrentFrame();
  
  const mainText = "Welcome to Remotion";
  const subtitleText = "Programmatic video generation";
  
  const typingProgress = interpolate(frame, [0, 90], [0, mainText.length], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const charactersToShow = Math.floor(typingProgress);
  const displayedText = mainText.slice(0, charactersToShow);
  
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;
  
  const subtitleOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace'
    }}>
      <div style={{
        fontSize: '64px',
        color: '#ffffff',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center'
      }}>
        <span>{displayedText}</span>
        <span style={{
          width: '3px',
          height: '64px',
          backgroundColor: '#4ade80',
          marginLeft: '8px',
          opacity: cursorVisible ? 1 : 0
        }} />
      </div>
      
      <div style={{
        fontSize: '32px',
        color: '#a0a0a0',
        marginTop: '40px',
        opacity: subtitleOpacity,
        fontWeight: 'normal',
        letterSpacing: '2px'
      }}>
        {subtitleText}
      </div>
    </AbsoluteFill>
  );
};