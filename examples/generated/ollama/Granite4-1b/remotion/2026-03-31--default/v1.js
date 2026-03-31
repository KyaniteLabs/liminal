import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingTextWithSubtitle = (props) => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <video 
        src="typing_video.mp4" 
        loop
        playsInline
      />
      
      <div>
        <h1>Typing Animation</h1>
      </div>

      <div>
        <p id="subtitle">Subtitle Text</p>
      </div>
    </AbsoluteFill>
  );
};