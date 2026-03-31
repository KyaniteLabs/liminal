import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill, spring} from 'remotion';

export const TypingSubtitle = ({fps, durationInFrames, width, height}: {fps: number; durationInFrames: number; width: number; height: number}) => {
  const frame = useCurrentFrame();
  const text = "Hello, this is a typing animation with a subtitle.";
  const textLength = text.length;

  const cursorBlink = interpolate(frame, [0, durationInFrames], [false, true], {duration: 50});
  const subtitleFadeIn = interpolate(frame, [0, durationInFrames], [0, 1], {duration: 75});

  return (
    <AbsoluteFill style={{backgroundColor: '#000', width, height}}>
      <Video
        src="https://www.sample-video.com/zcat/sample-video-1280x720.mp4" // Replace with your video source
        style={{display: 'flex', alignItems: 'center', justifyContent: 'center', width, height}}
      />
      <Text
        style={{color: '#fff', fontSize: '32px', position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', opacity: 1}}
        animate={interpolate(frame, [0, durationInFrames], [0, 1], {duration: 150})}
      />
      {cursorBlink && <Text style={{color: '#fff', fontSize: '24px', position: 'absolute', top: '50%', left: '50%', transform: 'translateX(-50%)', opacity: 1}} />}
      <Text
        style={{color: '#fff', fontSize: '20px', position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', opacity: 1}}
        animate={interpolate(frame, [0, durationInFrames], [0, 1], {duration: 150})}
      />
    </AbsoluteFill>
  );
};