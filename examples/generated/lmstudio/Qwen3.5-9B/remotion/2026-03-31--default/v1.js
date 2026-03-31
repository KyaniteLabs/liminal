import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { Text, useCurrentFrame, interpolate } from 'remotion';

export const TypingComposition: React.FC = () => {
  const frame = useCurrentFrame();

  // Define text and timing constants
  const mainText = "Hello World";
  const subText = "Welcome to Remotion";
  
  // Duration in frames (30fps)
  const totalDuration = 150;
  const typingSpeed = 2.5; // frames per character
  const pauseAfterTyping = 20;
  const fadeStartFrame = 60;
  const fadeEndFrame = 90;

  // Calculate text length and cursor position
  const textLength = mainText.length;
  const currentCharIndex = Math.min(
    Math.floor(frame / typingSpeed),
    textLength - 1
  );

  // Cursor blink animation (5% duty cycle)
  const cursorOpacity = interpolate(
    frame % 20,
    [0, 10],
    [1, 0]
  );

  // Subtitle fade in/out logic
  const subTextVisible = frame >= fadeStartFrame && frame <= fadeEndFrame;
  
  const subTextOpacity = interpolate(
    frame - fadeStartFrame,
    [0, 30],
    [0, 1]
  );

  // Background color transition (dark blue to black)
  const bgColorAlpha = interpolate(
    frame / totalDuration,
    [0.2, 0.5],
    [0.9, 0]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(10, 30, 65, ${bgColorAlpha})` }}>
      {/* Main Typing Text */}
      <Text
        x={200}
        y={400}
        fontSize={72}
        fontWeight="bold"
        color="#FFFFFF"
        lineHeight={1.2}
        textOverflow="ellipsis"
        style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}
      >
        {mainText.slice(0, currentCharIndex + 1)}
        <span
          style={{ display: 'inline-block', width: '2px', height: '80%', verticalAlign: 'bottom', marginLeft: '1px' }}
          opacity={cursorOpacity}
        />
      </Text>

      {/* Subtitle */}
      {subTextVisible && (
        <Text
          x={200}
          y={650}
          fontSize={36}
          color="#A0C4FF"
          lineHeight={1.4}
          style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}
        >
          {subText}
        </Text>
      )}

      {/* Decorative elements */}
      <Img 
        src="https://placehold.co/20x1" 
        x={50} 
        y={950} 
        height={3} 
        style={{ opacity: 0.3 }} 
      />
      <Img 
        src="https://placehold.co/20x1" 
        x={1700} 
        y={950} 
        height={3} 
        style={{ opacity: 0.3 }} 
      />
    </AbsoluteFill>
  );
};