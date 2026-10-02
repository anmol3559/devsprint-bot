// src/jobs/contentCreator.js
const cron = require('node-cron');
const { TOPICS } = require('../config/topics');
const { generateDSAScript } = require('../generators/dsaScriptGen');
const { generateBackendScript } = require('../generators/backendScriptGen');
const { generateCodeCardImage } = require('../generators/cardImageGen');
const { renderReel } = require('../services/videoStitcher');
const { buildReelAssets } = require('../services/reelsAgent');
const Post = require('../models/Post');

const BACKEND_CONCEPTS = [
  { concept: "Redis Caching Strategy", analogy: "a high-speed desk drawer" },
  { concept: "BullMQ Background Jobs", analogy: "a kitchen order queue" },
  { concept: "Node.js Event Loop", analogy: "a single-threaded restaurant waiter" },
  { concept: "Load Balancer", analogy: "a traffic cop at a busy intersection" },
  { concept: "Microservices Architecture", analogy: "a city with specialized departments" },
];

async function generateNextDailyPost() {
  try {
    console.log('[Content Creator] Finding next topic for daily post...');

    // 1. Fetch recent posts to avoid duplicate topics
    const recentPosts = await Post.find().sort({ createdAt: -1 }).limit(25).catch(err => {
      console.error('[Content Creator] Failed to fetch recent posts:', err.message);
      return [];
    });
    const recentCaptions = recentPosts.map((p) => p.caption || '');

    // 2. Filter topics that haven't been posted recently
    const unpostedTopics = TOPICS.filter(
      (t) => !recentCaptions.some((caption) => caption.includes(t.topic))
    );

    // Pick from unposted; fallback to random if all were used
    const selectedTopic =
      unpostedTopics.length > 0
        ? unpostedTopics[Math.floor(Math.random() * unpostedTopics.length)]
        : TOPICS[Math.floor(Math.random() * TOPICS.length)];

    console.log(
      `[Content Creator] Selected Topic: ${selectedTopic.topic} (${selectedTopic.difficulty} - ${selectedTopic.pattern})`
    );

    // 3. Generate Content via Gemini AI
    const aiData = await generateDSAScript(
      selectedTopic.topic,
      selectedTopic.difficulty,
      selectedTopic.pattern
    );

    // Extract C++ code
    const rawCode = aiData.videoScript?.codeVisual || '';
    const codeMatch = rawCode.match(
      /vector<[\s\S]*?\n\}|int\s+[\s\S]*?\n\}|bool\s+[\s\S]*?\n\}|void\s+[\s\S]*?\n\}/
    ) || [rawCode];
    const cleanCode = codeMatch[0] || rawCode;

    // 4. Generate Code Card Image (for Instagram)
    console.log('[Content Creator] Generating code card image...');
    const imageUrl = await generateCodeCardImage(
      cleanCode,
      `${selectedTopic.topic} - C++ Optimal`
    );

    // 4b. Generate Video (for YouTube Shorts) - optional, may fail
    let videoPath = null;
    try {
      console.log('[Content Creator] Generating video via Remotion...');
      const reelData = await buildReelAssets(selectedTopic.topic);
      if (reelData && reelData.audioFilePath) {
        videoPath = await renderReel(reelData.reelData, reelData.audioFilePath);
        console.log('[Content Creator] Video generated:', videoPath);
      }
    } catch (videoErr) {
      console.error('[Content Creator] Video generation failed (skipping YouTube upload):', videoErr.message);
      videoPath = null;
    }

    // 5. Format Caption & Tags
    const caption = `${aiData.title}\n\n${aiData.description}\n\n💡 Optimal Strategy:\n${aiData.videoScript?.logicBreakdown || ''}\n\n#cpp #datastructures #leetcode #coding #softwareengineering`;

    // 6. Queue Post into MongoDB
    try {
      const newPost = await Post.create({
        imageUrl,
        videoPath,
        title: aiData.title,
        caption,
        tags: aiData.tags || [],
        scheduledFor: new Date(),
        status: 'PENDING',
        instagramStatus: 'PENDING',
        youtubeStatus: 'PENDING',
      });

      console.log(`[Content Creator] ✅ Post generated and saved with ID: ${newPost._id}`);
      console.log(`[Content Creator] Instagram image: ${!!newPost.imageUrl}, YouTube video: ${!!newPost.videoPath}`);
      return newPost;
    } catch (dbErr) {
      console.error('[Content Creator] ❌ Failed to save post to database:', dbErr.message);
      throw dbErr;
    }
  } catch (error) {
    console.error('[Content Creator] ❌ Error generating daily post:', error.message);
    throw error;
  }
}

async function generateBackendPost() {
  try {
    console.log('[Content Creator] Generating backend architecture post...');

    const concept = BACKEND_CONCEPTS[Math.floor(Math.random() * BACKEND_CONCEPTS.length)];

    const aiData = await generateBackendScript(concept.concept, concept.analogy);

    // Format caption
    const caption = `${aiData.title}\n\n${aiData.description}\n\n💡 Technical Deep Dive:\n${aiData.videoScript?.technicalDeepDive || ''}\n\n${aiData.videoScript?.useCase || ''}\n\n#backend #nodejs #systemdesign #devsprint`;

    // Queue post (image-only for architecture, video can be added later)
    try {
      const newPost = await Post.create({
        imageUrl: null, // Backend posts start with video only
        videoPath: null,
        title: aiData.title,
        caption,
        tags: aiData.tags || [],
        scheduledFor: new Date(),
        status: 'PENDING',
        instagramStatus: 'SKIPPED', // No image, so skip Instagram
        youtubeStatus: 'PENDING',
      });

      console.log(`[Content Creator] ✅ Backend post queued with ID: ${newPost._id}`);
      return newPost;
    } catch (dbErr) {
      console.error('[Content Creator] ❌ Failed to save backend post to database:', dbErr.message);
      throw dbErr;
    }
  } catch (error) {
    console.error('[Content Creator] ❌ Error generating backend post:', error.message);
    throw error;
  }
}

function startDailyContentJob() {
  // Every day at 9:30 AM IST - DSA post
  cron.schedule('30 9 * * *', async () => {
    console.log('[CRON] Running scheduled DSA content creator job...');
    await generateNextDailyPost();
  });

  // Every day at 10:00 AM IST - Backend Architecture post
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Running scheduled backend content creator job...');
    await generateBackendPost();
  });

  console.log('🚀 Daily Content Creator jobs scheduled (DSA @ 9:30 AM, Backend @ 10:00 AM IST).');
}

module.exports = { startDailyContentJob, generateNextDailyPost, generateBackendPost };