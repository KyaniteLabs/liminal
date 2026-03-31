import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const TypingSubtitle = ({fps, durationInFrames, width, height}) => {
  const frame = useCurrentFrame();
  const text = "Hello, this is a typing animation with a subtitle!";
  const textSegments = text.split(/\s+/);
  const typingSpeed = 0.03;
  const cursorBlinkInterval = 0.5;

  const typedText = textSegments.map((segment, index) => (
    <span key={index} style={{
      fontSize: '32px',
      color: '#fff',
      opacity: interpolate(frame, [0, durationInFrames - 1], [0, 1]),
       wordArray: segment,
      animationDuration: typingSpeed,
    }}>
      {segment}
    </span>
  )).reduce((acc, curr) => acc + curr, null);

  const cursorStyle = interpolate({
    frame: frame,
    fps: fps,
  }, [0, durationInFrames - 1], [0, 1]);

  const cursorPosition = interpolate(frame, [0, durationInFrames - 1], [0, 1]) * 1920;

  return (
    <AbsoluteFill style={{backgroundColor: '#000', width, height}}>
      {typedText}
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '64px',
          color: '#fff',
          animationDuration: typingSpeed,
        }}
      >
        {cursorStyle > 0.5 ? '•' : ''}
      </span>
    </AbsoluteFill>
  );
};