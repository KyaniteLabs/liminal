import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingComposition: React.FC = ({fps, durationInFrames, width, height}) => {
  const frame = useCurrentFrame();
  const text = "Hello, Remotion!";
  const textArray = text.split(" ");
  const textLength = textArray.length;

  const animation = interpolate(
    frame,
    {
      textDisplayed: 0,
      textLength: textLength
    },
    {
      textDisplayed: frame % textLength,
      textLength: textLength
    }
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#000', width, height}}>
      <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: '60px'}}>
        {interpolate(
          animation.textDisplayed,
          {
            start: 0,
            end: textLength - 1,
            key: animation.textDisplayed,
            config: [0, 1]
          },
          (value) => textArray[value]
        )}
      </div>
    </AbsoluteFill>
  );
};