import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingTextComposition: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Configuration
  const fps = 30;
  const durationInFrames = 150;
  const width = 1920;
  const height = 1080;
  
  // Typing animation parameters
  const typingStartFrame = 0;
  const typingEndFrame = 60; // Typing finishes at frame 60
  
  // Calculate current text to show (typing effect)
  const fullText = "The Remotion Composition";
  const subtitleText = "Creating beautiful motion graphics with React";
  
  // Determine how many characters to show based on current frame
  const visibleChars = Math.min(
    fullText.length,
    Math.floor((frame - typingStartFrame) / 2) // Typing speed: 2 frames per character
  );
  
  const displayedText = fullText.substring(0, visibleChars);
  
  // Cursor blinking animation (visible when typing or just after)
  const cursorVisible = 
    frame < typingEndFrame || 
    (frame >= typingEndFrame && frame < typingEndFrame + 15 && Math.floor(frame / 5) % 2 === 0);
  
  // Opacity for subtitle fade-in
  // Start fading in at frame 70, complete by frame 100
  const subtitleOpacity = interpolate(
    frame,
    [70, 100],
    [0, 1]
  );
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {/* Main text with typing animation */}
      <div 
        style={{
          position: 'absolute',
          top: '45%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '80px',
          color: '#ffffff',
          fontFamily: "'Courier New', monospace",
          whiteSpace: 'nowrap'
        }}
      >
        {displayedText}
        <span style={{ 
          opacity: cursorVisible ? 1 : 0,
          marginLeft: '5px',
          animation: 'blink 1s infinite' 
        }}>
          |
        </span>
      </div>
      
      {/* Subtitle with fade-in effect */}
      <div 
        style={{
          position: 'absolute',
          top: '60%',
          left: '50%',
          transform: `translate(-50%, -50%) translateY(${interpolate(frame, [70, 100], [20, 0])}px)`,
          fontSize: '48px',
          color: '#a0c9ff',
          fontFamily: "'Segoe UI', sans-serif",
          opacity: subtitleOpacity,
          whiteSpace: 'nowrap'
        }}
      >
        {subtitleText}
      </div>
    </AbsoluteFill>
  );
};