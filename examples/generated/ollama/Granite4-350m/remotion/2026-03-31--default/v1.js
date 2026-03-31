import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';

export const MyComposition: React.FC = () => {
  // animation logic here

  return (
    <AbsoluteFill style={{backgroundColor: (frame % 255 === 0 ? '#000' : frame)}}>
      {/* visual elements */}
    </AbsoluteFill>
  );
};