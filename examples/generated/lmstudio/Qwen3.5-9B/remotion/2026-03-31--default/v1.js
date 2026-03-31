import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

// Helper to create a blinking cursor effect
const Cursor = ({ frame }: { frame: number }) => {
  const opacity = interpolate(frame, [0, 1], [0, 1]);
  return (
    <div style={{ position: 'absolute', right: 0, top: 42, width: 3, height: 36, backgroundColor: '#fff', opacity }} />
  );
};

// Helper for the subtitle fade-in
const Subtitle = ({ frame }: { frame: number }) => {
  const opacity = interpolate(frame, [150, 175], [0, 1]);
  return (
    <div style={{ 
      position: 'absolute', bottom: 80, left: 0, right: 0, textAlign: 'center', color: '#ccc', fontSize: 24, fontWeight: 600, opacity, lineHeight: 1.4 
    }}>
      "The future belongs to those who believe in the beauty of their dreams."
    </div>
  );
};

export const TypingTextComposition: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Text parts to type out sequentially
  const textParts = [
    "Design is",
    "the art of",
    "solving problems.",
    "Good design makes life better."
  ];

  // Calculate which part we should be typing based on frame count (approx 30 frames per word)
  const currentPartIndex = Math.min(textParts.length - 1, Math.floor(frame / 30));
  
  // Get the text up to and including the current character of the current word
  let displayText = "";
  
  if (currentPartIndex < textParts.length) {
    const currentWord = textParts[currentPartIndex];
    const charsToType = Math.min(currentWord.length, frame % 30);
    displayText = currentWord.substring(0, charsToType);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e', position: 'relative' }}>
      {/* Main Typing Text */}
      <div 
        style={{ 
          position: 'absolute', top: 480, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', color: '#fff', fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.2,
          textShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        {displayText}
      </div>

      {/* Cursor */}
      <Cursor frame={frame} />

      {/* Subtitle Fade In */}
      <Subtitle frame={frame} />
    </AbsoluteFill>
  );
};