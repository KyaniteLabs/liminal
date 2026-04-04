import { Composition, useCurrentFrame, useVideoConfig } from 'remotion';
import React, { useState, useEffect, useMemo } from 'react';

// --- Constants ---
const TEXT = "Hello, Remotion! This text is typing out.";
const SUBTITLE = "Animation complete. Enjoy the show.";
const TYPING_DURATION_FRAMES = 60; // 2 seconds at 30fps
const FADE_DURATION_FRAMES = 30; // 1 second

// --- Helper Components ---

/**
 * Component that handles the typing animation and cursor.
 * @param {number} currentFrame - The current frame number.
 * @param {string} text - The full text string.
 * @returns {JSX.Element}
 */
const TypingText = ({ currentFrame, text }) => {
  // Calculate how many characters should be visible based on time
  const visibleChars = Math.min(text.length, Math.floor(currentFrame / (TYPING_DURATION_FRAMES / text.length)));

  // The text displayed so far
  const displayedText = text.substring(0, visibleChars);

  // The cursor component
  const Cursor = () => (
    <span style={{
      animation: 'blink 1s step-end infinite',
      fontSize: '2em', // Matches the font size of the text
      marginLeft: '4px',
      display: 'inline-block',
    }}>
      |
    </span>
  );

  return (
    <div style={{ fontSize: '3.5em', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1 }}>
      {displayedText}
      <Cursor />
    </div>
  );
};

/**
 * Component that handles the fading subtitle.
 * @param {number} currentFrame - The current frame number.
 * @returns {JSX.Element}
 */
const Subtitle = ({ currentFrame }) => {
  // Determine if the fade-in sequence has started
  const triggerFrame = TYPING_DURATION_FRAMES + 10; 
  
  // Calculate opacity: starts at 0, reaches 1 over FADE_DURATION_FRAMES
  let opacity = 0;
  if (currentFrame > triggerFrame - FADE_DURATION_FRAMES) {
    const progress = Math.min(1, (currentFrame - (triggerFrame - FADE_DURATION_FRAMES)) / FADE_DURATION_FRAMES);
    opacity = progress;
  }

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '15%',
        left: '5%',
        fontSize: '2em',
        color: '#aaa',
        opacity: opacity,
        transition: 'opacity 0.1s', /* Ensure smooth React updates */
        pointerEvents: 'none',
        textAlign: 'center',
      }}
    >
      {SUBTITLE}
    </div>
  );
};


// --- Main Component ---

export const TypingVideo = () => {
  const frame = useCurrentFrame();

  return (
    <div 
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        backgroundColor: '#111',
        overflow: 'hidden',
        // Global keyframes for the cursor blink
        animation: `typing-animation ${TYPING_DURATION_FRAMES}frames linear forwards`,
      }}
    >
      <style jsx global>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
        @keyframes typing-animation {
            from { opacity: 1; }
        }
      `}</style>
      
      {/* Text Typing Area */}
      <div style={{ position: 'relative' }}>
        <TypingText currentFrame={frame} text={TEXT} />
      </div>

      {/* Subtitle Area */}
      <Subtitle currentFrame={frame} />
    </div>
  );
};

// --- Composition Wrapper ---

export const RemotionRoot = () => {
  const { width, height } = useVideoConfig();

  return (
    <Composition
      id="TypingVideo"
      component={TypingVideo}
      durationInFrames={TYPING_DURATION_FRAMES + FADE_DURATION_FRAMES + 30} // Ensure enough time for everything
      width={width}
      height={height}
    />
  );
};

// Export the Composition component for direct use in a Storybook/Remotion setup
// In practice, you would render <RemotionRoot />
// For the purpose of the code output, we keep the structure clean.
// We assume the user will call RemotionRoot() in their index.js
// If running locally, ensure your remotion.config.js points to this file.