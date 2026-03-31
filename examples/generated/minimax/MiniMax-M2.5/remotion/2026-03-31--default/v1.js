import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingWithSubtitle: React.FC = () => {
  const frame = useCurrentFrame();
  
  const mainText = "Hello, World!";
  const subtitle = "Welcome to Remotion";
  
  const typingEndFrame = 60;
  const subtitleStartFrame = 70;
  
  const visibleCharCount = interpolate(
    frame,
    [0, typingEndFrame],
    [0, mainText.length],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  
  const cursorOpacity = interpolate(
    frame % 30,
    [0, 15, 30],
    [1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  
  const subtitleOpacity = interpolate(
    frame,
    [subtitleStartFrame, subtitleStartFrame + 30],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  
  const displayedText = mainText.slice(0, Math.floor(visibleCharCount));
  
  return (
    <AbsoluteFill style={{backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center'}}>
      <div style={{flexDirection: 'row', alignItems: 'center'}}>
        <span style={{fontFamily: 'monospace', fontSize: 64, color: '#00ff88', fontWeight: 'bold'}}>
          {displayedText}
        </span>
        <span style={{
          width: 4,
          height: 64,
          backgroundColor: '#00ff88',
          marginLeft: 4,
          opacity: cursorOpacity
        }} />
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: 150,
        opacity: subtitleOpacity
      }}>
        <span style={{fontFamily: 'sans-serif', fontSize: 36, color: '#ffffff'}}>
          {subtitle}
        </span>
      </div>
    </AbsoluteFill>
  );
};