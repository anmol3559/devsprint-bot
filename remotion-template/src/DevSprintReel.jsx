import { AbsoluteFill, useVideoConfig, useCurrentFrame, Audio, Sequence, spring, Video } from 'remotion';

export const DevSprintReel = ({ hook, scriptBody, callToAction, onScreenText, audioUrl }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  
  const textScale = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#020617',
        color: 'white',
        fontFamily: 'sans-serif'
      }}
    >
      
      {/* 1. Background Video Layer (B-Roll) */}
      <AbsoluteFill style={{ opacity: 0.3 }}>
        <Video 
          src="https://www.w3schools.com/html/mov_bbb.mp4" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          muted 
        />
      </AbsoluteFill>

      {/* 2. Dynamic TTS Audio Track */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* 3. Text Overlay Layer */}
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', textAlign: 'center' }}>
        
        {/* Hook - Pehle 5 seconds */}
        <Sequence from={0} durationInFrames={fps * 5}>
          <h1 style={{ 
            transform: `scale(${textScale})`, 
            fontSize: '80px', 
            fontWeight: 'bold',
            color: '#60A5FA', // Blue accent
            textShadow: '0px 10px 20px rgba(0,0,0,0.8)'
          }}>
            {hook}
          </h1>
        </Sequence>

        {/* Main Script Body & Badges - 5s to 25s */}
        <Sequence from={fps * 5} durationInFrames={fps * 20}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ fontSize: '55px', color: '#E2E8F0', lineHeight: '1.4', fontWeight: '500', textShadow: '0px 5px 15px rgba(0,0,0,0.8)' }}>
              {scriptBody}
            </p>
            
            <div style={{ display: 'flex', gap: '20px', marginTop: '60px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {onScreenText.map((text, i) => (
                <span key={i} style={{ 
                  padding: '20px 40px', 
                  backgroundColor: 'rgba(255,255,255,0.1)', 
                  borderRadius: '50px', 
                  fontSize: '45px', 
                  fontWeight: '600',
                  border: '2px solid rgba(255,255,255,0.2)'
                }}>
                  {text}
                </span>
              ))}
            </div>
          </div>
        </Sequence>

        {/* Call to Action - Last 5 seconds */}
        <Sequence from={fps * 25} durationInFrames={fps * 5}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ 
              backgroundColor: '#2563EB', 
              color: 'white', 
              padding: '30px 60px', 
              borderRadius: '40px', 
              fontSize: '60px', 
              fontWeight: '900',
              textTransform: 'uppercase',
              boxShadow: '0 0 50px rgba(37,99,235,0.8)'
            }}>
              {callToAction}
            </div>
          </div>
        </Sequence>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};