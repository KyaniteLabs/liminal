import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingAndSubtitleComposition: React.FC = ({fps, durationInFrames, width, height}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}} fps={fps} durationInFrames={durationInFrames}>
      <div className="typing">
        {frame.value.map((t) => (
          <span key={`${t}`} className={`text ${t}`}>
            {`Typing... Frame ${t}`}
          </span>
        ))}
      </div>

      <div className="cursor" style={{position: 'absolute', top: 0, left: 0, fontSize: '24px'}}>
        <span className="cursor-dot"></span>
      </div>

      <div className="subtitle">
        <p className="sub-title">Subtitle</p>
      </div>
    </AbsoluteFill>
  );
};