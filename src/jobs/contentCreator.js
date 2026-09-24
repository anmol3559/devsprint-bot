// src/jobs/contentCreator.js
const cron = require('node-cron');
const { TOPICS } = require('../config/topics');
const { generateDSAScript } = require('../generators/dsaScriptGen');
const { generateCodeCardImage } = require('../generators/cardImageGen');
const Post = require('../models/Post');

async function generateNextDailyPost() {
  try {
    console.log('[Content Creator] Finding next topic for daily post...');

    // 1. Fetch recent posts to avoid duplicate topics
    const recentPosts = await Post.find().sort({ createdAt: -1 }).limit(25);
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

    // 4. Generate Code Card Image
    console.log('[Content Creator] Generating code card...');
    const imageUrl = await generateCodeCardImage(
      cleanCode,
      `${selectedTopic.topic} - C++ Optimal`
    );

    // 5. Format Caption
    const caption = `${aiData.title}\n\n${aiData.description}\n\n💡 Optimal Strategy:\n${aiData.videoScript?.logicBreakdown || ''}\n\n#cpp #datastructures #leetcode #coding #softwareengineering`;

    // 6. Queue Post into MongoDB
    const newPost = await Post.create({
      imageUrl,
      caption,
      scheduledFor: new Date(),
      status: 'PENDING',
    });

    console.log(`[Content Creator] ✅ Post generated and saved with ID: ${newPost._id}`);
    return newPost;
  } catch (error) {
    console.error('[Content Creator] ❌ Error generating daily post:', error.message);
    throw error;
  }
}

function startDailyContentJob() {
  // Roz subah 9:30 AM IST pe chalega: '30 9 * * *'
  cron.schedule('30 9 * * *', async () => {
    console.log('[CRON] Running scheduled daily content creator job...');
    await generateNextDailyPost();
  });

  console.log('🚀 Daily Content Creator job scheduled (Everyday at 9:30 AM).');
}

module.exports = { startDailyContentJob, generateNextDailyPost };