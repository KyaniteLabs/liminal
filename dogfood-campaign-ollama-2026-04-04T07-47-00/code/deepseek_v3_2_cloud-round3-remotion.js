import { Composition, useCurrentFrame, waitFor } from 'remotion';
import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';

// --- Constants ---
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const TYPING_DURATION_FRAMES = 30 * 10; // 10 seconds for typing
const FADE_IN_DURATION_FRAMES = 30; // 1 second for fade

// --- Styled Components ---
const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-color: #121212;
  color: white;
  font-family: 'Arial', sans-serif;
  padding: 40px;
`;

const TypingText = styled.h1`
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 20px;
  white-space: pre; /* Important for preserving spaces/newlines */
`;

const Cursor = styled.span`
  display: inline-block;
  width: 0.15em;
  height: 1.2em;
  background-color: white;
  margin-left: 4px;
  animation: blink 1s step-end infinite;
`;

const Subtitle = styled.p`
  font-size: 1.8rem;
  opacity: ${props => props.opacity};
  transition: opacity 0.5s ease-out;
  color: #b0b0b0;
`;

// --- Component ---

const MyVideo = () => {
  const frame = useCurrentFrame();
  const [displayedText, setDisplayedText] = useState('');

  const fullText = "Welcome to Remotion!";
  const subtitleText = "Animation timing made simple.";

  // 1. Handle Typing Animation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let currentDisplay = '';

    const typeWriter = setInterval(() => {
      if (currentDisplay.length < fullText.length) {
        currentDisplay = fullText.substring(0, currentDisplay.length + 1);
        setDisplayedText(currentDisplay);
      } else {
        clearInterval(typeWriter);
      }
    }, 100); // Adjust speed (ms)

    return () => {
      if (typeWriter) clearInterval(typeWriter);
    };
  }, []);


  // Determine the current state of the subtitle opacity
  const subtitleOpacity = useMemo(() => {
    // Subtitle starts fading in after typing is complete (TYPING_DURATION_FRAMES)
    if (frame > TYPING_DURATION_FRAMES) {
      // Calculate opacity based on how far past the transition start we are
      const elapsed = frame - TYPING_DURATION_FRAMES;
      const progress = Math.min(1, elapsed / FADE_IN_DURATION_FRAMES);
      return progress;
    }
    return 0;
  }, [frame]);


  // Calculate the cursor length based on the current frame and displayed text length
  const cursorLength = useMemo(() => {
    if (frame < TYPING_DURATION_FRAMES) {
      // Cursor is visible and blinking during the typing phase
      return (displayedText.length + 1) > 0 ? displayedText.length + 1 : 1;
    }
    return 0; // Hide cursor after typing is finished
  }, [displayedText, frame]);


  return (
    <Container>
      {/* Typing Text */}
      <TypingText>
        {displayedText}{' '}
        {/* The blinking cursor */}
        <Cursor style={{ visibility: cursorLength > 0 ? 'visible' : 'hidden' }} />
      </TypingText>

      {/* Subtitle */}
      <Subtitle opacity={subtitleOpacity}>
        {subtitleText}
      </Subtitle>
    </Container>
  );
};

// Wrap the component in the Composition provider
export const RemotionRoot = () => {
  return (
    <Composition
      id="TypingFadeVideo"
      component={MyVideo}
      durationInFrames={TYPING_DURATION_FRAMES + FADE_IN_DURATION_FRAMES + 60} // Total time: Typing + Fade + Buffer
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
  );
};

// Optional: Include the keyframe animation for the cursor blink
// Note: In a real setup, this CSS would be global or imported.
const GlobalStyles = () => (
    <style global jsx>{`
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
    `}</style>
);

// To make this runnable in a single file environment, we'll export the root component
export default function App() {
    return (
        <>
            <GlobalStyles />
            <RemotionRoot />
        </>
    );
}