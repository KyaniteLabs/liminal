import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

interface Props {
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
}

export const TypewriterWithSubtitle: React.FC<Props> = ({fps, durationInFrames, width, height}) => {
  const frame = useCurrentFrame();
  
  const mainText = "Welcome to Remotion";
  const subtitleText = "Create videos with React";
  const typingSpeed = 3;
  const typingEndFrame = mainText.length * typingSpeed;
  
  const charIndex = Math.floor(frame / typingSpeed);
  const displayedText = mainText.slice(0, Math.min(charIndex, mainText.length));
  
  const cursorVisible = Math.floor(frame / 10) % 2 === 0;
  
  const subtitleStartFrame = typingEndFrame + 20;
  const subtitleEndFrame = subtitleStartFrame + 30;
  
  const subtitleOpacity = interpolate(
    frame,
    [subtitleStartFrame, subtitleEndFrame],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  
  return (
    <AbsoluteFill style={{
      backgroundColor: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Consolas, Monaco, monospace'
    }}>
      <div style={{
        fontSize: 72,
        color: '#ffffff',
        fontWeight: 'bold',
        letterSpacing: '0.05em'
      }}>
        {displayedText}
        <span style={{
          opacity: cursorVisible ? 1 : 0,
          color: '#00ff41',
          marginLeft: 4
        }}>|</span>
      </div>
      <div style={{
        fontSize: 36,
        color: '#aaaaaa',
        marginTop: 32,
        opacity: subtitleOpacity,
        fontWeight: 300,
        letterSpacing: '0.02em'
      }}>
        {subtitleText}
      </div>
    </AbsoluteFill>
  );
};