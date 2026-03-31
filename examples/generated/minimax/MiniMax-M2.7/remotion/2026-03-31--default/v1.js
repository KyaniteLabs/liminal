import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const TypingTextComposition: React.FC<{fps: number; durationInFrames: number; width: number; height: number}> = ({fps = 30, width = 1920, height = 1080}) => {
  const frame = useCurrentFrame();

  const mainText = "Hello, welcome to my video!";
  const subtitle = "This is a subtitle that fades in smoothly after the typing effect.";

  const typingSpeed = 3;
  const cursorBlinkSpeed = 12;
  const totalTypingFrames = mainText.length * typingSpeed;
  const subtitleFadeStart = totalTypingFrames + 20;
  const subtitleFadeDuration = 25;

  const charsToShow = Math.min(Math.floor(frame / typingSpeed), mainText.length);
  const displayedText = mainText.slice(0, charsToShow);

  const isTyping = frame < totalTypingFrames;
  const isTypingComplete = frame >= totalTypingFrames;

  const cursorBlink = interpolate(frame % cursorBlinkSpeed, [0, cursorBlinkSpeed / 2, cursorBlinkSpeed], [1, 0, 1]);
  const cursorOpacity = isTypingComplete ? cursorBlink : (isTyping ? 1 : 0);

  const subtitleOpacity = interpolate(
    frame,
    [subtitleFadeStart, subtitleFadeStart + subtitleFadeDuration],
    [0, 1],
    {extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0f0f1a',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column'
    }}>
      <div style={{
        fontSize: '72px',
        color: '#ffffff',
        fontFamily: 'Courier New, monospace',
        fontWeight: 'bold',
        letterSpacing: '2px',
        textShadow: '0 0 20px rgba(100, 200, 255, 0.3)'
      }}>
        {displayedText}
        <span style={{
          opacity: cursorOpacity,
          color: '#00ffcc',
          marginLeft: '2px',
          fontWeight: 'normal'
        }}>|</span>
      </div>

      {isTypingComplete && (
        <div style={{
          fontSize: '28px',
          color: '#8888aa',
          marginTop: '40px',
          fontFamily: 'Arial, sans-serif',
          opacity: subtitleOpacity,
          textAlign: 'center',
          paddingHorizontal: '40px'
        }}>
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};