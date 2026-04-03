import {useCurrentFrame, spring} from 'remotion';
import React from 'react';

export const TypingTextAnimation = ({fps}) => {
  // Animation for the typewriter effect
  let animatedTypingSpeed;
  
  if (typeof window !== undefined) {
    return <></>;
  }

  AnimatedTypingEffect = () => (
    <p style={{
      position: 'absolute',
      top: `${interpolate(0, fps * frame / 100)}px`,
      whiteSpace: spring(frame),
      fontSize: interpolate(fps * frame % (fps * 10), 12) + "px",
      letterSpacing: `-${spring(frame)},${-2}vw`
    }}>
      TypingText
    </p>
  );
  
  return (
    <>
      {animatedTypingEffect()}
      {/* Add more text effects or elements here if needed */}
    </>
  )
};

export default {
  durationInFrames: 150,
  fps: Math.round(60),
  width: 1920 / fps * fps, // maintains aspect ratio
  height: 1080 / (fps), // maintains aspect ratio
}