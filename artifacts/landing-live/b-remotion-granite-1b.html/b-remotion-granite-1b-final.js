import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingTextComposition: React.FC = ({fps, durationInFrames, width, height}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}} duration={durationInFrames}>
      <div>
        <h1>{'Typing Text Animation'}</h1>
        {frame.value < durationInFrames && (
          <span
            style={{
              fontSize: interpolate(
                frame,
                [0, durationInFrames],
                [
                  {
                    fontSize: '24px',
                  },
                  {
                    fontSize: '48px',
                  },
                ],
              ),
            }}
          >
            {`Frame ${frame.value}`}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};