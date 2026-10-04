import { Composition } from 'remotion';
import { DevSprintReel } from './DevSprintReel';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="DevSprintReel"
        component={DevSprintReel}
        durationInFrames={1800} // 60 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          hook: "Stop skipping tech concepts! Let's break this down in 60 seconds.",
          scriptBody: "In this DevSprint short, we break down complex backend architecture using real-world analogies.",
          callToAction: "Follow DevSprint for daily tech tips!",
          onScreenText: ["backend", "architecture", "scalability"],
          audioUrl: "",
        }}
      />
    </>
  );
};
