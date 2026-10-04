import { AbsoluteFill, useVideoConfig, useCurrentFrame, Audio, Sequence, spring } from 'remotion';

export const DevSprintReel = ({ hook, scriptBody, callToAction, onScreenText, audioUrl }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  const textScale = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#020617',
        color: 'white',
        fontFamily: '"IBM Plex Sans", "Inter", system-ui, sans-serif',
        width: '100%',
        height: '100%',
      }}
    >

      {/* Subtle animated gradient background */}
      <AbsoluteFill style={{ opacity: 0.08 }}>
        <div style={{
          width: '200%',
          height: '200%',
          background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #d946ef 100%)',
          animation: `rotate ${30 * fps} frames linear infinite`,
          transformOrigin: 'center center',
        }}>
          <style jsx global>{`
            @keyframes rotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </AbsoluteFill>

      {/* TTS Audio Track */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Content Layer */}
      <AbsoluteFill style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 60px',
        textAlign: 'center'
      }}>

        {/* Progress bar at top */}
        <div style={{
          position: 'absolute',
          top: '40px',
          left: '60px',
          right: '60px',
          height: '4px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${(frame / (fps * 60)) * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #0ea5e9, #6366f1, #d946ef)',
            borderRadius: '2px',
          }} />
        </div>

        {/* Hook - First 5 seconds (0-150 frames) */}
        <Sequence from={0} durationInFrames={fps * 5}>
          <div style={{
            transform: `scale(${textScale})`,
            opacity: spring({ frame, fps, config: { damping: 15, stiffness: 120 } }),
          }}>
            <h1 style={{
              fontSize: '72px',
              fontWeight: '800',
              lineHeight: '1.1',
              color: '#f8fafc',
              textShadow: '0 4px 32px rgba(14, 165, 233, 0.4)',
              margin: '0 0 24px 0',
              maxWidth: '900px',
            }}>
              {hook}
            </h1>
          </div>
        </Sequence>

        {/* Main Script Body - 5s to 25s (150-750 frames) */}
        <Sequence from={fps * 5} durationInFrames={fps * 20}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            width: '100%',
            maxWidth: '900px',
          }}>
            <p style={{
              fontSize: '48px',
              color: '#e2e8f0',
              lineHeight: '1.5',
              fontWeight: '500',
              textShadow: '0 2px 16px rgba(0,0,0,0.5)',
              margin: '0 0 48px 0',
              letterSpacing: '0.02em',
            }}>
              {scriptBody}
            </p>

            {/* Keyword badges */}
            <div style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginTop: '32px',
            }}>
              {onScreenText.map((text, i) => (
                <span
                  key={i}
                  style={{
                    padding: '16px 36px',
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    borderRadius: '100px',
                    fontSize: '36px',
                    fontWeight: '600',
                    color: '#0ea5e9',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {text}
                </span>
              ))}
            </div>
          </div>
        </Sequence>

        {/* Call to Action - Last 5 seconds (750-900 frames) */}
        <Sequence from={fps * 25} durationInFrames={fps * 5}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            transform: `scale(${spring({ frame: frame - fps * 25, fps, config: { damping: 12, stiffness: 200 })})`,
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              color: 'white',
              padding: '28px 56px',
              borderRadius: '100px',
              fontSize: '52px',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 0 60px rgba(14, 165, 233, 0.6), 0 8px 32px rgba(0,0,0,0.4)',
            }}>
              {callToAction}
            </div>
          </div>
        </Sequence>

        {/* Watermark */}
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(148, 163, 184, 0.6)',
          fontSize: '24px',
          fontWeight: '500',
          fontFamily: '"IBM Plex Sans", sans-serif',
        }}>
          DevSprint  •  Learn. Build. Scale.
        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};