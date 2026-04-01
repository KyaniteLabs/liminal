import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Video } from 'remotion';

export const BlueCircleAnimation: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#051e3e' }}>
      {/* Centered blue circle container */}
      <div
        style={{
          width: '80%',
          height: '80%',
          position: 'absolute',
          top: '10%',
          left: '10%',
          right: '10%',
          bottom: '10%',
          margin: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: `${interpolate(
              frame,
              [0, 75],
              ['30%', '60%']
            )}vw`,
            height: `${interpolate(
              frame,
              [0, 75],
              ['30%', '60%']
            )}vh`,
            backgroundColor: '#1e90ff',
            borderRadius: '50%',
            boxShadow: `0 0 ${interpolate(
              frame,
              [0, 75],
              ['20px', '80px']
            )} #64b5f6`
          }}
        />

        {/* Inner glowing orb */}
        <div
          style={{
            width: `${interpolate(
              frame,
              [0, 100],
              ['10%', '30%']
            )}vw`,
            height: `${interpolate(
              frame,
              [0, 100],
              ['10%', '30%']
            )}vh`,
            backgroundColor: '#87ceeb',
            borderRadius: '50%',
            position: 'absolute',
            top: '-20px',
            left: '-20px'
          }}
        />

        {/* Rotating ring */}
        <div
          style={{
            width: `${interpolate(
              frame,
              [0, 50],
              ['40%', '80%']
            )}vw`,
            height: `${interpolate(
              frame,
              [0, 50],
              ['40%', '80%']
            )}vh`,
            border: `2px solid #1e90ff`,
            borderRadius: '50%',
            position: 'absolute',
            animation: `spin ${interpolate(
              frame,
              [0, 75],
              ['8s', '3s']
            )} linear infinite`
          }}
        />

        {/* Text overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: `${interpolate(
              frame,
              [0, 50],
              ['10%', '-2%']
            )}`,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: `${interpolate(
              frame,
              [0, 75],
              ['3rem', '6rem']
            )}px`,
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            textShadow: `0 2px ${interpolate(
              frame,
              [0, 75],
              ['10px', '40px']
            )} #64b5f6`
          }}
        >
          BLUE CIRCLE
        </div>

        {/* Floating particles */}
        <div
          style={{
            position: 'absolute',
            top: `${interpolate(
              frame,
              [0, 100],
              ['20%', '80%']
            )}%`,
            left: `${interpolate(
              frame,
              [0, 50],
              ['30%', '70%']
            )}%`,
            width: `${interpolate(
              frame,
              [0, 100],
              ['8px', '24px']
            )}`,
            height: `${interpolate(
              frame,
              [0, 100],
              ['8px', '24px']
            )}`,
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            opacity: interpolate(
              frame,
              [0, 75],
              [0.3, 0.8]
            ),
            animation: `float ${interpolate(
              frame,
              [0, 50],
              ['4s', '6s']
            )} ease-in-out infinite alternate`
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: `${interpolate(
              frame,
              [0, 100],
              ['70%', '30%']
            )}%`,
            left: `${interpolate(
              frame,
              [0, 50],
              ['60%', '40%']
            )}%`,
            width: `${interpolate(
              frame,
              [0, 100],
              ['8px', '24px']
            )}`,
            height: `${interpolate(
              frame,
              [0, 100],
              ['8px', '24px']
            )}`,
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            opacity: interpolate(
              frame,
              [0, 75],
              [0.3, 0.8]
            ),
            animation: `float ${interpolate(
              frame,
              [0, 50],
              ['6s', '9s']
            )} ease-in-out infinite alternate`
          }}
        />

        <style>
          {`
            @keyframes spin {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
            @keyframes float {
              0% {
                transform: translateY(0px) translateX(0px);
              }
              100% {
                transform: translateY(-20px) translateX(20px);
              }
            }
          `}
        </style>
      </div>
    </AbsoluteFill>
  );
};