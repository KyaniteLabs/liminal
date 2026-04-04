import { Composition, useCurrentFrame, waitFor } from 'remotion';
import React, { useState, useEffect } from 'react';

// --- Constants ---
const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const TYPING_DURATION = 2000; // 2 seconds for typing
const SUBTITLE_DELAY = 500; // Delay between typing end and subtitle start
const TOTAL_DURATION = TYPING_DURATION + SUBTITLE_DELAY + 1000; // Total duration

const TEXT_TO_TYPE = "Hello, I am typing out this message.";
const SUBTITLE_TEXT = "Welcome to your animated video.";

// Helper component for the typing effect
const TypingText = ({ text, duration, containerStyle }) => {
  const frame = useCurrentFrame();
  const charsTyped = Math.min(text.length, Math.floor(frame / (duration / text.length)));

  const displayedText = text.substring(0, charsTyped);

  // Cursor blinking logic
  const cursorVisible = (Math.floor(frame / 100) % 2) === 0;

  return (
    <div style={{ ...containerStyle, position: 'relative' }}>
      {/* Typed Text */}
      <span style={{ whiteSpace: 'pre-wrap', fontSize: '6rem', fontWeight: 'bold', color: '#333' }}>
        {displayedText}
      </span>
      {/* Cursor */}
      <span
        style={{
          display: 'inline-block',
          width: '0.1em',
          height: '1.2em',
          backgroundColor: '#333',
          marginLeft: '2px',
          animation: 'blink 1s linear infinite',
          opacity: cursorVisible ? 1 : 0,
        }}
      ></span>
      <style jsx="true">{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// Helper component for the fading subtitle
const Subtitle = ({ text, startFrame, endFrame }) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, Math.max(0, (frame - startFrame) / (endFrame - startFrame)));

  const opacity = Math.interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        opacity: opacity,
        fontSize: '2.5rem',
        fontWeight: '300',
        color: '#666',
        transform: `translateY(${Math.interpolate(progress, [0, 1], [20, 0])}px)`,
        transition: 'transform 0.3s, opacity 0.3s'
      }}
    >
      {text}
    </div>
  );
};

// Main Component
export const AnimatedTextVideo = () => {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '50px' }}>
      {/* Typed Text Area */}
      <div style={{ width: '80%', maxWidth: '1000px', marginBottom: '50px' }}>
        <TypingText
          text={TEXT_TO_TYPE}
          duration={TYPING_DURATION}
          containerStyle={{ minHeight: '3rem' }}
        />
      </div>

      {/* Subtitle Area */}
      <div style={{ width: '80%', maxWidth: '1000px' }}>
        <Subtitle
          text={SUBTITLE_TEXT}
          startFrame={TYPING_DURATION + SUBTITLE_DELAY}
          endFrame={TYPING_DURATION + SUBTITLE_DELAY + 1000}
        />
      </div>
    </div>
  );
};

// Export the Composition wrapper
export const RemotionRoot = () => (
  <>
    <Composition
      id={`animated-text-video`}
      component={AnimatedTextVideo}
      durationInFrames={Math.ceil(TOTAL_DURATION / 30)}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
  </>
);