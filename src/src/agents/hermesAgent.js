// src/agents/hermesAgent.js
/**
 * HERMES AGENT - Autonomous Content Automation System
 *
 * Hermes is the brain of the DevSprint content pipeline. It autonomously:
 * 1. Monitors content queue and decides when to generate new content
 * 2. Triggers content generation based on schedule + queue state
 * 3. Publishes content to Instagram (images + reels) and YouTube (shorts)
 * 4. Handles retries, failures, and edge cases
 * 5. Maintains analytics for continuous improvement
 */

const cron = require('node-cron');
const Post = require('../models/Post');
const { generateNextDailyPost, generateBackendPost } = require('../jobs/contentCreator');
const { publishToInstagram } = require('../services/instagramService');
const { uploadToYouTube } = require('../services/youtubeService');

// Hermes configuration
const HERMES_CONFIG = {
  QUEUE_CHECK_INTERVAL: '*/5 * * * *',    // Check queue every 5 minutes
  GENERATION_TIMEOUT: 5 * 60 * 1000,        // 5 min for content generation
  PUBLISH_RETRY_DELAY: 10 * 60 * 1000,     // 10 min retry for failed posts
  MAX_RETRY_COUNT: 3,                      // Max publish retries per post
  DAILY_POST_LIMIT: 4,                      // Max posts per day
  MIN_QUEUE_SIZE: 1,                        // Keep at least this many pending posts
  PEAK_HOURS: [9, 10, 12, 17, 18, 19, 20], // Optimal posting hours (IST)
};

// Analytics tracking (in-memory; persist to MongoDB later)
const hermesAnalytics = {
  totalGenerated: 0,
  totalPublished: 0,
  totalFailed: 0,
  lastGeneration: null,
  lastPublish: null,
  recentFailures: [],
};

/**
 * Get current time in IST
 */
function getISTHour() {
  const istTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return istTime.getHours();
}

/**
 * Determine if it's a good time to publish (peak engagement hours)
 */
function isOptimalPublishTime() {
  const currentHour = getISTHour();
  return HERMES_CONFIG.PEAK_HOURS.includes(currentHour);
}

/**
 * Check if we've hit the daily post limit
 */
async function isDailyLimitReached() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await Post.countDocuments({
    createdAt: { $gte: today },
    status: { $in: ['PENDING', 'PUBLISHED'] },
  });
  return todayCount >= HERMES_CONFIG.DAILY_POST_LIMIT;
}

/**
 * Main Hermes decision-making function
 * Called periodically to make autonomous decisions
 */
async function hermesCycle() {
  try {
    console.log('\n[HERMES] 🔮 Autonomous cycle starting...');
    const timestamp = new Date().toISOString();
    console.log(`[HERMES] ${timestamp} - IST Hour: ${getISTHour()}`);

    // Get current queue state
    const pendingPosts = await Post.find({ status: 'PENDING' });
    const failedPosts = await Post.find({
      $or: [
        { instagramStatus: 'FAILED' },
        { youtubeStatus: 'FAILED' },
      ],
    });

    console.log(`[HERMES] Queue: ${pendingPosts.length} pending, ${failedPosts.length} failed`);

    // Decision 1: Should we generate new content?
    await hermesDecideContentGeneration(pendingPosts.length);

    // Decision 2: Should we retry failed posts?
    await hermesRetryFailedPosts(failedPosts);

    // Decision 3: Should we publish pending posts now?
    await hermesPublishPending(pendingPosts);

    // Log analytics
    hermesAnalytics.lastPublish = timestamp;
    console.log(`[HERMES] ✅ Cycle complete. Stats: ${JSON.stringify({
      generated: hermesAnalytics.totalGenerated,
      published: hermesAnalytics.totalPublished,
      failed: hermesAnalytics.totalFailed,
    })}\n`);

  } catch (err) {
    console.error('[HERMES] ❌ Cycle error:', err.message);
  }
}

/**
 * Decision 1: Content Generation
 * Generate new content if queue is low and we're under daily limit
 */
async function hermesDecideContentGeneration(pendingCount) {
  const underLimit = !(await isDailyLimitReached());
  const queueLow = pendingCount < HERMES_CONFIG.MIN_QUEUE_SIZE;

  if (!underLimit) {
    console.log('[HERMES] Daily limit reached, skipping generation.');
    return;
  }

  if (queueLow) {
    console.log(`[HERMES] Queue low (${pendingCount}), generating new content...`);
    try {
      // Alternate between DSA and Backend posts
      const recentPosts = await Post.find({}).sort({ createdAt: -1 }).limit(1);
      const lastWasBackend = recentPosts.length > 0 &&
        recentPosts[0].title &&
        recentPosts[0].title.includes('How ');

      if (lastWasBackend) {
        await generateNextDailyPost();
        console.log('[HERMES] DSA post generated');
      } else {
        await generateBackendPost();
        console.log('[HERMES] Backend post generated');
      }
      hermesAnalytics.totalGenerated++;
    } catch (genErr) {
      console.error('[HERMES] Generation failed:', genErr.message);
      hermesAnalytics.recentFailures.push({
        type: 'generation',
        error: genErr.message,
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    console.log(`[HERMES] Queue healthy (${pendingCount} pending), no generation needed.`);
  }
}

/**
 * Decision 2: Retry Failed Posts
 * Automatically retry posts that failed to publish
 */
async function hermesRetryFailedPosts(failedPosts) {
  const now = Date.now();
  const retryable = failedPosts.filter(post => {
    // Only retry if last attempt was more than 10 minutes ago
    const lastAttempt = post.updatedAt ? new Date(post.updatedAt).getTime() : 0;
    return (now - lastAttempt) > HERMES_CONFIG.PUBLISH_RETRY_DELAY;
  });

  if (retryable.length === 0) {
    console.log('[HERMES] No posts ready for retry.');
    return;
  }

  console.log(`[HERMES] Retrying ${retryable.length} failed post(s)...`);

  for (const post of retryable) {
    try {
      // Reset status for retry
      if (post.instagramStatus === 'FAILED' && post.imageUrl) {
        post.instagramStatus = 'PENDING';
        console.log(`[HERMES] Retrying Instagram post: ${post._id}`);
      }
      if (post.youtubeStatus === 'FAILED' && post.videoPath) {
        post.youtubeStatus = 'PENDING';
        console.log(`[HERMES] Retrying YouTube post: ${post._id}`);
      }
      await post.save();
    } catch (retryErr) {
      console.error(`[HERMES] Retry failed for ${post._id}:`, retryErr.message);
    }
  }
}

/**
 * Decision 3: Publish Pending Posts
 * Publish posts when optimal time is reached
 */
async function hermesPublishPending(pendingPosts) {
  const publishable = pendingPosts.filter(post => {
    const isScheduled = post.scheduledFor <= new Date();
    const hasContent = post.imageUrl || post.videoPath;
    return isScheduled && hasContent;
  });

  if (publishable.length === 0) {
    console.log('[HERMES] No posts ready to publish now.');
    return;
  }

  // If it's peak hours, publish; otherwise wait
  if (!isOptimalPublishTime()) {
    console.log(`[HERMES] Not peak hours (now: ${getISTHour()} IST), will publish during peak hours.`);
    return;
  }

  console.log(`[HERMES] Publishing ${publishable.length} post(s) during peak hours...`);

  for (const post of publishable) {
    try {
      // Publish to Instagram
      if (post.instagramStatus === 'PENDING' && post.imageUrl) {
        try {
          const igRes = await publishToInstagram(post.imageUrl, post.caption);
          post.instagramPostId = igRes.postId;
          post.instagramStatus = 'PUBLISHED';
          hermesAnalytics.totalPublished++;
          console.log(`[HERMES] ✅ Instagram published: ${igRes.postId}`);
        } catch (igErr) {
          post.instagramStatus = 'FAILED';
          post.errorLog = (post.errorLog || '') + `\n[Instagram] ${igErr.message}`;
          hermesAnalytics.totalFailed++;
          console.error(`[HERMES] ❌ Instagram failed: ${igErr.message}`);
        }
      }

      // Publish to YouTube
      if (post.youtubeStatus === 'PENDING' && post.videoPath) {
        try {
          const ytRes = await uploadToYouTube(post.videoPath, {
            title: post.title || post.caption.substring(0, 100),
            description: post.caption,
            tags: post.tags || [],
          });
          post.youtubeVideoId = ytRes.id;
          post.youtubeStatus = 'PUBLISHED';
          hermesAnalytics.totalPublished++;
          console.log(`[HERMES] ✅ YouTube published: ${ytRes.id}`);
        } catch (ytErr) {
          post.youtubeStatus = 'FAILED';
          post.errorLog = (post.errorLog || '') + `\n[YouTube] ${ytErr.message}`;
          hermesAnalytics.totalFailed++;
          console.error(`[HERMES] ❌ YouTube failed: ${ytErr.message}`);
        }
      }

      // Mark as complete if both done
      const igDone = ['PUBLISHED', 'FAILED', 'SKIPPED'].includes(post.instagramStatus);
      const ytDone = ['PUBLISHED', 'FAILED', 'SKIPPED'].includes(post.youtubeStatus);
      if (igDone && ytDone) {
        post.publishedAt = new Date();
        post.status = 'PUBLISHED';
      }

      await post.save();
    } catch (publishErr) {
      console.error(`[HERMES] Publish error for ${post._id}:`, publishErr.message);
    }
  }
}

/**
 * Start the Hermes Agent
 * Sets up all autonomous monitoring and decision-making
 */
function startHermesAgent() {
  console.log('\n🧠 HERMES AGENT INITIALIZING...');
  console.log('─────────────────────────────────────────');
  console.log('📊 Queue monitoring: every 5 min');
  console.log('🔄 Failed post retries: auto (10 min delay)');
  console.log('🎯 Optimal publishing: peak hours only');
  console.log('📈 Daily limit: ' + HERMES_CONFIG.DAILY_POST_LIMIT + ' posts');
  console.log('─────────────────────────────────────────');

  // Main autonomous cycle - runs every 5 minutes
  cron.schedule(HERMES_CONFIG.QUEUE_CHECK_INTERVAL, hermesCycle);

  // Peak hour publishing check - runs every 15 minutes during peak hours
  cron.schedule('*/15 * * * *', async () => {
    if (isOptimalPublishTime()) {
      const pending = await Post.find({
        status: 'PENDING',
        scheduledFor: { $lte: new Date() },
      });
      if (pending.length > 0) {
        console.log(`[HERMES] ⏰ Peak hour detected, ${pending.length} post(s) ready to publish`);
        await hermesPublishPending(pending);
      }
    }
  });

  // Daily analytics summary at midnight IST
  cron.schedule('0 0 * * *', async () => {
    console.log('\n[HERMES] 📊 DAILY ANALYTICS SUMMARY');
    const stats = {
      generated: hermesAnalytics.totalGenerated,
      published: hermesAnalytics.totalPublished,
      failed: hermesAnalytics.totalFailed,
      last24hFailures: hermesAnalytics.recentFailures.slice(-5),
    };
    console.log(JSON.stringify(stats, null, 2));
    // Reset daily counters
    hermesAnalytics.totalGenerated = 0;
    hermesAnalytics.totalPublished = 0;
    hermesAnalytics.totalFailed = 0;
    hermesAnalytics.recentFailures = [];
  });

  // Run initial cycle immediately on startup
  hermesCycle();

  console.log('✅ HERMES AGENT ONLINE - Autonomous content automation active\n');
}

module.exports = {
  startHermesAgent,
  hermesCycle,
  hermesAnalytics,
  HERMES_CONFIG,
};