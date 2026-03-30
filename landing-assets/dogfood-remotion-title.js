const opacity = Math.max(0, Math.min(1, 1 - particleFrame / 100));
            
            return (
              <div
                key={p.id}
                style={{
                  position: 'absolute',
                  left: xOffset,
                  top: yOffset,
                  width: p.size,
                  height: p.size,
                  borderRadius: '50%',
                  backgroundColor: `hsl(${p.hue}, 70%, 60%)`,
                  opacity,
                }}
              />
            );
          })}
        </div>
        
        {/* Title Text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 10,
        }}>
          <div style={{
            fontSize: 120,
            fontFamily: 'Arial Black, sans-serif',
            fontWeight: 900,
            color: '#ffffff',
            textShadow: '0 0 60px rgba(100, 200, 255, 0.8), 0 0 120px rgba(100, 200, 255, 0.4)',
            letterSpacing: '0.1em',
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
          }}>
            DISSOLVE
          </div>
          <div style={{
            fontSize: 32,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 300,
            color: '#8a8a9a',
            letterSpacing: '0.5em',
            marginTop: 20,
            opacity: titleOpacity,
          }}>
            PARTICLE EFFECT
          </div>
        </div>
        
        {/* Glow overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10, 10, 18, 0.5) 100%)',
          pointerEvents: 'none',
        }} />
      </AbsoluteFill>
    );
  }
}

The animation reveals particles first, then the title text fades in with a subtle scale effect. After holding for a moment, both particles and text fade out together. A soft radial gradient overlay adds depth to the composition. , I need to reconsider the timing. The fade-in and fade-out should each span multiple frames for smoothness. Using an opacity interpolation from 0 to 1 over 30 frames works for the entrance, but I need to ensure the text remains fully visible during the middle section before fading out in the final 30 frames.

The structure should be: opacity builds from 0 to 1 between frames 0-30, stays at 1 from 30-90, then decreases back to 0 between frames 90-150. This creates a complete fade-in and fade-out cycle while maintaining full visibility during the hold period.

For the particle animation, I'll have them scatter outward from the center as the text fades out. I should also ensure proper TypeScript typing throughout. Here's the refined version: