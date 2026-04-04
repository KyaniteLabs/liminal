import React, { useEffect, useState } from "react";
import { Composition, useCurrentFrame, absolute, keyframes } from "remotion";

// --- Constants ---
const TYPING_TEXT = "Hello, Remotion!";
const SUBTITLE_TEXT = "Animating text and fading in a message.";
const TYPING_DURATION = 3000; // 3 seconds for typing
const SUBTITLE_FADE_START = 4000; // Start fading in 4 seconds
const TOTAL_DURATION = 6000; // Total runtime: 3s typing + 3s pause + 3s subtitle

// --- Components ---

/**
 * Component that handles the typing effect and cursor blinking.
 * @param {React.FC} props
 */
const TypingText = () => {
  const frame = useCurrentFrame();
  
  // Calculate the progress of typing (0 to 1) based on the current frame
  const progress = Math.min(1, frame / (TYPING_DURATION * 30)); // Assuming 30fps
  
  // Calculate how many characters should be visible
  const visibleChars = Math.floor(progress * TYPING_TEXT.length);
  
  // Determine the visible text
  const displayedText = TYPING_TEXT.substring(0, visibleChars);
  
  // Calculate cursor visibility (blinks every 50 frames)
  const cursorBlink = Math.floor(frame / 50) % 2 === 0;

  return (
    <div style={{ fontSize: 4rem, fontWeight: "bold", color: "#333" }}>
      {displayedText}
      {/* Cursor */}
      <span 
        style={{ 
          borderRight: "4px solid #333", 
          animation: cursorBlink ? "blink 0.5s step-end infinite" : "none",
          display: "inline-block",
          verticalAlign: "middle",
        }}
      ></span>
    </div>
  );
};

/**
 * Component that handles the fading in of the subtitle.
 * @param {React.FC} props
 */
const Subtitle = () => {
  const frame = useCurrentFrame();

  // Calculate opacity transition: 0 -> 1 between SUBTITLE_FADE_START and TOTAL_DURATION
  let opacity = 0;
  if (frame >= SUBTITLE_FADE_START && frame < TOTAL_DURATION) {
    const fadeProgress = (frame - SUBTITLE_FADE_START) / (TOTAL_DURATION - SUBTITLE_FADE_START);
    opacity = Math.min(1, fadeProgress);
  }

  return (
    <div 
      style={{ 
        position: "absolute", 
        bottom: 100, 
        left: 0, 
        right: 0, 
        fontSize: "2rem", 
        color: "#666",
        opacity: opacity, // Use calculated opacity
        transition: "opacity 0.3s ease-out"
      }}
    >
      {SUBTITLE_TEXT}
    </div>
  );
};


// --- Main Component ---

const AnimatedTypingVideo = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        height: "100%",
        padding: "50px",
        backgroundColor: "#f8f8f8",
        WebkitAnimation: {
            animation: "blink 0.5s step-end infinite",
            animationName: "blink",
            animationDuration: "0.5s",
            animationIterationCount: "infinite",
        }
      }}
    >
      {/* The Typing Text */}
      <TypingText />
      
      {/* The Subtitle */}
      <Subtitle />
    </div>
  );
};


// --- Composition ---

export const RemotionRoot = () => {
  return (
    <Composition
      id={`AnimatedTypingVideo`}
      component={AnimatedTypingVideo}
      durationInFrames={TOTAL_DURATION / 30} // Assuming 30 FPS
      width={1280}
      height={720}
    />
  );
};