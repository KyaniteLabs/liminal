import { Composition, useCurrentFrame, Dimensions } from 'remotion';
import React, { useState, useEffect, useCallback } from 'react';
import { styled, motion } from 'styled-components';

// --- Constants ---
const TYPING_DURATION = 3 * 1000; // 3 seconds
const SUBTITLE_DELAY = 1000; // 1 second after typing finishes
const FRAME_RATE = 30;

// --- Styled Components ---
const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 40px;
`;

const TypedText = styled.h1`
  font-size: 4rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 20px;
`;

const Cursor = styled.span`
  display: inline-block;
  width: 0.5em;
  height: 1.2em;
  background-color: #333;
  animation: blink 1s step-end infinite;
  /* CSS keyframes for blinking */
  animation-name: blink;
  animation-duration: 1s;
  animation-timing-function: step-end;
  animation-iteration-count: infinite;
`;

const Subtitle = styled.p`
  font-size: 1.8rem;
  font-weight: 300;
  color: #666;
  opacity: 0;
  transition: opacity 0.8s ease-in-out;
`;

// --- Component ---

const TypingAnimation = () => {
  const frame = useCurrentFrame();
  const totalFrames = (1000 / FRAME_RATE) * 5; // Adjust total frames if needed

  const fullText = "Remotion Animations are Fun!";
  const subtitleText = "Generated using React and Framer Motion principles.";

  // 1. Typing Logic
  // Determine the current character index based on time
  const typedChars = Math.min(
    fullText.length,
    Math.floor((frame / FRAME_RATE) / 1000 * TYPING_DURATION)
  );
  
  const displayedText = fullText.substring(0, typedChars);

  // 2. Cursor Blink Logic
  // Blink the cursor if the typing is active
  const isTyping = frame < (TYPING_DURATION / (1000 / FRAME_RATE));
  const blinkOpacity = Math.abs(
    Math.sin(frame / 20) * 0.5 + 0.5
  );

  // 3. Subtitle Fade-in Logic
  // The subtitle starts fading in after the typing duration + a small delay
  const subtitleStartFrame = (TYPING_DURATION + SUBTITLE_DELAY) / (1000 / FRAME_RATE);
  const subtitleOpacity = Math.min(
    1,
    Math.max(0, (frame - subtitleStartFrame) / (1000 / FRAME_RATE) / 5) // Fades over 5 seconds
  );


  return (
    <Container>
      {/* Typed Text Component */}
      <TypedText>{displayedText}</TypedText>
      
      {/* Cursor */}
      <Cursor 
        style={{ opacity: isTyping ? blinkOpacity : 0 }} 
      />

      {/* Subtitle */}
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: subtitleOpacity }}
        style={{ opacity: subtitleOpacity }}
      >
        {subtitleText}
      </motion.p>
    </Container>
  );
};

// --- Remotion Composition ---

export const AnimatedVideo = () => {
  // Set duration to ensure all animations play out (e.g., 10 seconds)
  const durationInFrames = Math.ceil(10 * (1000 / FRAME_RATE));

  return (
    <Composition
      id="TypingAnimation"
      component={TypingAnimation}
      duration={10000} // 10 seconds
      fps={FRAME_RATE}
      width={1920}
      height={1080}
    />
  );
};