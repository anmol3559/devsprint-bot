import { Composition } from 'remotion';
import { DevSprintReel } from './DevSprintReel';
import './style.css'; // Yahan tera Tailwind CSS import hoga

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
          hook: "Stop scrolling, dev! Ye API trick tujhe nahi pata hogi.",
          scriptBody: "MongoDB aggregations ko 10x fast karne ke liye indexing use karo. Backend architecture mein local agents integrate karna seekho.",
          callToAction: "Follow DevSprint for daily tech tips!",
          onScreenText: ["MongoDB", "Backend", "AI Agents"],
          audioUrl: "" // Backend se path yahan pass hoga
        }}
      />
    </>
  );
};