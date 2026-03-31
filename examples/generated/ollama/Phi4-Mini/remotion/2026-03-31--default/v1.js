import {useCurrentFrame, spring} from 'remotion';
import TextTypedOut from './TextTypedOut'; // Import your custom React component for the typewriter animation
import SubtextFadeIn from './SubtextFadeIn';  // Import your custom React component for subtitle fade-in

export const MyComposition: React.FC<{}> = ({durationInFrames}) => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill>
      {/* Typewriter animation with cursor blink */}
      <TextTypedOut
        frame={frame}
        text="Your custom message here"
        typingSpeed={40} // Customize the speed of words being typed out
        onComplete={() => {}}
      />
      
      {/* Subtext fading in after typewriting completes */}
      <SubtextFadeIn
        keyframes={{0: 'opacity: 1;'}}
        duration={durationInFrames}
        fps={30}
        text="Your subtitle here"
      />
    </AbsoluteFill>
  );
};