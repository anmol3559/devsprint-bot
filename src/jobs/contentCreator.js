// src/jobs/contentCreator.js
const { TOPICS } = require('../config/topics');
const { generateDSAScript } = require('../generators/dsaScriptGen');
const { generateBackendScript } = require('../generators/backendScriptGen');
const { generateCodeCardImage } = require('../generators/cardImageGen');
const Post = require('../models/Post');
const logger = require('../utils/logger');

const BACKEND_CONCEPTS = [
  { concept: "Redis Caching Strategy", analogy: "a high-speed desk drawer" },
  { concept: "BullMQ Background Jobs", analogy: "a kitchen order queue" },
  { concept: "Node.js Event Loop", analogy: "a single-threaded restaurant waiter" },
  { concept: "Load Balancer", analogy: "a traffic cop at a busy intersection" },
  { concept: "Microservices Architecture", analogy: "a city with specialized departments" },
];

async function generateNextDailyPost() {
  try {
    logger.info('[Content Creator] Finding next topic for daily post...');

    // 1. Fetch recent posts to avoid duplicate topics
    const recentPosts = await Post.find().sort({ createdAt: -1 }).limit(25).catch(err => {
      logger.error('[Content Creator] Failed to fetch recent posts', { error: err.message });
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

    logger.info('[Content Creator] Selected Topic', {
      topic: selectedTopic.topic,
      difficulty: selectedTopic.difficulty,
      pattern: selectedTopic.pattern,
    });

    // 3. Generate Content via Groq/Gemini
    const aiData = await generateDSAScript(
      selectedTopic.topic,
      selectedTopic.difficulty,
      selectedTopic.pattern
    );

    // Extract C++ code - use raw codeVisual
    const rawCode = aiData.codeVisual || '';
    const codeMatch = rawCode.match(
      /(?:vector|int|bool|void)\s+[\s\S]*?\n\}/
    );
    const cleanCode = codeMatch ? codeMatch[0] : rawCode;

    // 4. Generate Code Card Image (for Instagram)
    logger.info('[Content Creator] Generating code card image...');
    const imageUrl = await generateCodeCardImage(
      cleanCode,
      `${selectedTopic.topic} - C++ Optimal`
    );
    logger.info('[Content Creator] Image generated', { hasImage: !!imageUrl });

    // 5. Format Caption & Tags
    const caption = `${aiData.title}\n\n${aiData.description}\n\n💡 Optimal Strategy:\n${aiData.videoScript?.logicBreakdown || ''}\n\n#cpp #datastructures #leetcode #coding #softwareengineering`;

    // 6. Queue Post into MongoDB - Instagram only (no video/YouTube)
    try {
      const newPost = await Post.create({
        imageUrl,
        videoPath: null,
        title: aiData.title,
        caption,
        tags: aiData.tags || [],
        scheduledFor: new Date(),
        status: 'PENDING',
        instagramStatus: imageUrl ? 'PENDING' : 'SKIPPED',
        youtubeStatus: 'SKIPPED', // No YouTube posting
        type: 'dsa',
        errorLog: imageUrl ? null : 'Image generation failed',
      });

      logger.info('[Content Creator] Post generated and saved', {
        postId: newPost._id,
        hasImage: !!newPost.imageUrl,
      });
      return newPost;
    } catch (dbErr) {
      logger.error('[Content Creator] Failed to save post to database', { error: dbErr.message });
      throw dbErr;
    }
  } catch (error) {
    logger.error('[Content Creator] Error generating daily post', { error: error.message });
    throw error;
  }
}

async function generateBackendPost() {
  try {
    logger.info('[Content Creator] Generating backend architecture post...');

    const concept = BACKEND_CONCEPTS[Math.floor(Math.random() * BACKEND_CONCEPTS.length)];

    const aiData = await generateBackendScript(concept.concept, concept.analogy);

    // Format caption
    const caption = `${aiData.title}\n\n${aiData.description}\n\n💡 Technical Deep Dive:\n${aiData.videoScript?.technicalDeepDive || ''}\n\n${aiData.videoScript?.useCase || ''}\n\n#backend #nodejs #systemdesign #devsprint`;

    // 4. Generate Code Card Image (for Instagram)
    let imageUrl = null;
    if (aiData.codeVisual) {
      logger.info('[Content Creator] Generating backend architecture image...');
      try {
        imageUrl = await generateCodeCardImage(
          aiData.codeVisual,
          `${concept.concept} - Architecture`
        );
        logger.info('[Content Creator] Backend image generated');
      } catch (imgErr) {
        logger.error('[Content Creator] Backend image generation failed', { error: imgErr.message });
        imageUrl = null;
      }
    }

    // Queue post - Instagram only
    try {
      const newPost = await Post.create({
        imageUrl,
        videoPath: null,
        title: aiData.title,
        caption,
        tags: aiData.tags || [],
        scheduledFor: new Date(),
        status: 'PENDING',
        instagramStatus: imageUrl ? 'PENDING' : 'SKIPPED',
        youtubeStatus: 'SKIPPED',
        type: 'backend',
      });

      logger.info('[Content Creator] Backend post queued', { postId: newPost._id, hasImage: !!imageUrl });
      return newPost;
    } catch (dbErr) {
      logger.error('[Content Creator] Failed to save backend post to database', { error: dbErr.message });
      throw dbErr;
    }
  } catch (error) {
    logger.error('[Content Creator] Error generating backend post', { error: error.message });
    throw error;
  }
}

// Content creation is fully managed by Hermes Agent
// Hermes decides when to generate based on queue state, peak hours, and daily limits
module.exports = { generateNextDailyPost, generateBackendPost };