import React from 'react';
import { Composition, TimeValue, useCurrentFrame } from 'remotion';

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;

// --- Constants ---
const TYPING_DURATION_FRAMES = 180; // 6 seconds at 30fps
const SUBTITLE_DELAY_FRAMES = 60; // Start fade-in after 2 seconds

// --- Components ---

interface TypingTextProps {
    text: string;
    typingDuration: number;
}

const TypingText: React.FC<TypingTextProps> = ({ text, typingDuration }) => {
    const frame = useCurrentFrame();

    // Calculate how many characters should be visible
    const visibleChars = Math.min(text.length, frame / 3); // Typing speed: 3 chars/sec
    const displayedText = text.substring(0, visibleChars);

    // Cursor blink logic (using sin wave for smooth blink)
    // Cycle between opacity 0 and 1
    const cursorOpacity = Math.abs(Math.sin(frame * 0.2)) * 0.8 + 0.2; // Cycles between 0.2 and 1.0

    return (
        <div style={{ fontSize: '4rem', fontWeight: 'bold', fontFamily: 'monospace', display: 'flex', alignItems: 'baseline' }}>
            {/* Typing Effect */}
            <span style={{ color: '#FFD700' }}>{displayedText}</span>
            
            {/* Cursor */}
            <span 
                style={{ 
                    marginLeft: '5px', 
                    fontSize: '4rem', 
                    color: '#FFD700', 
                    opacity: cursorOpacity,
                    animation: 'blink 1s step-end infinite' // Basic CSS animation for blink
                }}
            >
                |
            </span>
            
            {/* Injecting a keyframe animation style for the cursor blink */}
            <style jsx global>{`
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    );
};

interface SubtitleProps {
    text: string;
    delayFrames: number;
}

const Subtitle: React.FC<SubtitleProps> = ({ text, delayFrames }) => {
    const frame = useCurrentFrame();

    // Calculate fade progress: 0 (before delay) -> 1 (after fade completes)
    const fadeProgress = Math.max(0, Math.min(1, (frame - delayFrames) / 60)); 
    
    return (
        <div 
            style={{ 
                position: 'absolute', 
                bottom: '10%', 
                left: '5%', 
                fontSize: '2rem', 
                color: '#FFFFFF', 
                opacity: fadeProgress, // Controlled by Remotion frame count
                transform: `translateY(${100 - fadeProgress * 100}%)`, // Optional: slight fade-up effect
                transformOrigin: 'bottom'
            }}
        >
            {text}
        </div>
    );
};

// --- Main Component ---

export const AnimatedTypingVideo: React.FC = () => {
    const mainText = "Hello, Remotion!";
    const subText = "Video generation is fun and fast.";

    return (
        <div 
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                height: '100%', 
                width: '100%', 
                padding: '5%',
                backgroundColor: '#1a1a2e' // Dark background
            }}
        >
            {/* Main Typing Text */}
            <div style={{ width: '100%', maxWidth: '700px' }}>
                <TypingText 
                    text={mainText} 
                    typingDuration={TYPING_DURATION_FRAMES} 
                />
            </div>
            
            {/* Subtitle Fade In */}
            <div style={{ width: '100%', maxWidth: '700px', height: '100px' }}>
                <Subtitle 
                    text={subText} 
                    delayFrames={TYPING_DURATION_FRAMES + 60} // Wait for typing to finish + buffer
                />
            </div>
        </div>
    );
};

// --- Composition Wrapper ---

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="AnimatedTypingVideo"
            component={AnimatedTypingVideo}
            durationInFrames={300} // Total duration: 10 seconds (300 frames)
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
        />
    );
};

// To run this, you would typically export RemotionRoot and use it in your main App.tsx
// For standalone testing, we export the component structure:
// export default RemotionRoot;