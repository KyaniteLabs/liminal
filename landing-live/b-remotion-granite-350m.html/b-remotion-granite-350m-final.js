import React from 'react';
const renderText = (text, delay) => {
  return (
    <div style={{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
      <p style={{color: '#fff', fontSize: '1rem', padding: '2px'}}>
        {text}
      </p>
      <TextDelay
        text={text}
        delay={delay}
        duration={150}
        fps={30}
      />
    </div>
  );
};
import {useCurrentFrame, interpolate} from 'remotion';

const MyComposition = () => {
  const frame = useCurrentFrame();
  return (
    <AnimatedVideo
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        backgroundColor: '#fff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: '50%',
      }}
    >
      <Video
        src="https://example.com/text-animation.mp4"
        frame={frame}
        fps={30}
      />
      {renderText('Type your message here', 1000)}
    </AnimatedVideo>
  );
};