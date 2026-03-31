import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const TypingSubtitle = ({fps, durationInFrames, width, height}: {fps?: number, durationInFrames?: number, width?: number, height?: number}) => {
  const frame = useCurrentFrame();
  const text = "Hello, world! This is a typing animation with a subtitle.";
  const textSegments = text.split(" ");
  const typingSpeed = 0.03;
  const cursorBlinkInterval = 0.7;
  const subtitleFadeInDuration = 30;

  const typedText = textSegments.map((segment, index) => {
    const delay = typingSpeed * index;
    return (
      <span
        key={index}
        style={{
          fontSize: '32px',
          color: '#fff',
          opacity: interpolate(frame, [0, subtitleFadeInDuration], [0, 1]),
           wordArray: segment,
          transform: `translateY(${interpolate(frame, [0, subtitleFadeInDuration], [-50, 0])})`,
          transition: `transform 0.1s ease, opacity 0.1s ease`
        }}
      />
    );
  });

  const cursorStyle = interpolate(frame, [0, subtitleFadeInDuration], [0, 1], {
    cursorColor: '#fff',
    cursorSize: '8px',
    opacity: interpolate(frame, [0, subtitleFadeInDuration], [0, 1]),
    transform: `translateY(${interpolate(frame, [0, subtitleFadeInDuration], [-16, 0])})`
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#000', width, height}}>
      {typedText}
      <span style={cursorStyle}>|</span>
    </AbsoluteFill>
  );
};