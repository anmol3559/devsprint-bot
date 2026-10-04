// src/agents/hermesAgent.js
/**
 * HERMES AGENT - Autonomous Content Automation System
 *
 * Hermes is the brain of the DevSprint content pipeline. It autonomously:
 * 1. Monitors content queue and decides when to generate new content
 * 2. Triggers content generation based on queue state
 * 3. Publishes content to Instagram + YouTube during peak hours ONLY
 * 4. Handles retries, failures, and edge cases
 * 5. Prevents duplicate posts via immediate status locking
 */

const cron = require('node-cron');
const Post = require('../models/Post');
const { generateNextDailyPost, generateBackendPost } = require('../jobs/contentCreator');
const { publishToInstagram } = require('../services/instagramService');
const { uploadToYouTube } = require('../services/youtubeService');
const logger = require('../utils/logger');

// Hermes configuration
const HERMES_CONFIG = {
  QUEUE_CHECK_INTERVAL: '*/5 * * * *',    // Check queue every 5 minutes
  PUBLISH_RETRY_DELAY: 10 * 60 * 1000,     // 10 min retry for failed posts
  MAX_RETRY_COUNT: 3,                       // Max publish retries per post
  DAILY_POST_LIMIT: 6,                      // Max posts per day (Instagram limit)
  PEAK_HOURS: [9, 10, 12, 17, 18, 19, 20], // Optimal posting hours (IST)
};

// Analytics tracking
const hermesAnalytics = {
  totalGenerated: 0,
  totalPublished: 0,
  totalFailed: 0,
  lastGeneration: null,
  lastPublish: null,
  recentFailures: [],
  byType: {
    dsa: { generated: 0, published: 0, failed: 0 },
    backend: { generated: 0, published: 0, failed: 0 },
  },
  apiMetrics: {
    gemini: { calls: 0, errors: 0, totalLatencyMs: 0 },
    instagram: { calls: 0, errors: 0, totalLatencyMs: 0 },
  },
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
  return HERMES_CONFIG.PEAK_HOURS.includes(getISTHour());
}

/**
 * Check if we've hit the daily post limit
 */
async function isDailyLimitReached() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await Post.countDocuments({
    createdAt: { $gte: today },
  });
  return todayCount >= HERMES_CONFIG.DAILY_POST_LIMIT;
}

/**
 * Decision 1: Content Generation
 * Generate new content ONLY if queue is empty and we're under daily limit.
 * This prevents duplicate posts because we never generate when something is pending.
 */
async function hermesDecideContentGeneration(pendingCount) {
  // CRITICAL: If ANY post is pending, do NOT generate new ones
  // This prevents duplicate content from being queued
  if (pendingCount > 0) {
    logger.info('Queue has pending posts, skipping generation to prevent duplicates', {
      pendingCount,
    });
    return;
  }

  const underLimit = !(await isDailyLimitReached());
  if (!underLimit) {
    logger.info('Daily limit reached, skipping generation', { pendingCount });
    return;
  }

  logger.info('Queue empty, generating new content', { pendingCount });
  const genStart = Date.now();

  try {
    // Alternate between DSA and Backend posts using the type field
    const recentPosts = await Post.find({}).sort({ createdAt: -1 }).limit(1);
    const lastWasBackend = recentPosts.length > 0 && recentPosts[0].type === 'backend';

    if (lastWasBackend) {
      const post = await generateNextDailyPost();
      logger.postEvent('generated', post._id, {
        type: 'dsa',
        title: post.title,
        latencyMs: Date.now() - genStart,
      });
      hermesAnalytics.totalGenerated++;
      hermesAnalytics.byType.dsa.generated++;
    } else {
      const post = await generateBackendPost();
      logger.postEvent('generated', post._id, {
        type: 'backend',
        title: post.title,
        latencyMs: Date.now() - genStart,
      });
      hermesAnalytics.totalGenerated++;
      hermesAnalytics.byType.backend.generated++;
    }
    hermesAnalytics.lastGeneration = new Date().toISOString();
  } catch (genErr) {
    logger.error('Content generation failed', {
      error: genErr.message,
      latencyMs: Date.now() - genStart,
    });
    hermesAnalytics.totalFailed++;
    hermesAnalytics.recentFailures.push({
      type: 'generation',
      error: genErr.message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Decision 2: Retry Failed Posts
 * Automatically retry posts that failed to publish, with a cap on retries
 */
async function hermesRetryFailedPosts(failedPosts) {
  const now = Date.now();
  const retryable = failedPosts.filter(post => {
    const lastAttempt = post.updatedAt ? new Date(post.updatedAt).getTime() : 0;
    const retryCount = post.retryCount || 0;
    return (now - lastAttempt) > HERMES_CONFIG.PUBLISH_RETRY_DELAY && retryCount < HERMES_CONFIG.MAX_RETRY_COUNT;
  });

  if (retryable.length === 0) {
    logger.info('No posts ready for retry', { totalFailed: failedPosts.length });
    return;
  }

  logger.info('Retrying failed posts', { count: retryable.length, totalFailed: failedPosts.length });

  for (const post of retryable) {
    try {
      const retryDetails = {};
      post.retryCount = (post.retryCount || 0) + 1;

      if (post.instagramStatus === 'FAILED' && post.imageUrl) {
        post.instagramStatus = 'PENDING';
        retryDetails.instagram = `retry #${post.retryCount}`;
      }
      if (post.youtubeStatus === 'FAILED' && post.videoPath) {
        post.youtubeStatus = 'PENDING';
        retryDetails.youtube = `retry #${post.retryCount}`;
      }
      await post.save();
      logger.postEvent('retry_scheduled', post._id, { ...retryDetails, retryCount: post.retryCount });
    } catch (retryErr) {
      logger.error('Post retry failed', {
        postId: post._id?.toString(),
        error: retryErr.message,
      });
    }
  }
}

/**
 * Decision 3: Publish Pending Posts
 * Publish ONLY during peak hours. Uses a lock to prevent double-publishing.
 */
let publishLock = false; // Simple in-memory lock to prevent concurrent publishing

async function hermesPublishPending(pendingPosts) {
  // Prevent concurrent publishing - if another cycle is already publishing, skip
  if (publishLock) {
    logger.warn('Publish already in progress, skipping this cycle');
    return;
  }

  // Filter to only posts ready to publish
  const publishable = pendingPosts.filter(post => {
    const isScheduled = post.scheduledFor <= new Date();
    const hasContent = post.imageUrl || post.videoPath;
    // Only PENDING platforms can be published
    const hasPendingPlatform = post.instagramStatus === 'PENDING' || post.youtubeStatus === 'PENDING';
    return isScheduled && hasContent && hasPendingPlatform;
  });

  if (publishable.length === 0) {
    logger.info('No posts ready to publish now', { pendingCount: pendingPosts.length });
    return;
  }

  // Only publish during peak hours
  if (!isOptimalPublishTime()) {
    logger.info('Not peak hours, will publish during peak hours', {
      currentISTHour: getISTHour(),
      readyToPublish: publishable.length,
    });
    return;
  }

  // Lock the publish operation
  publishLock = true;
  logger.info('Publishing posts during peak hours', { count: publishable.length });

  try {
    for (const post of publishable) {
      const publishStart = Date.now();
      const apiMetrics = { instagramLatency: 0, youtubeLatency: 0 };

      // Publish to Instagram
      if (post.instagramStatus === 'PENDING' && post.imageUrl) {
        const igStart = Date.now();
        // Lock the post FIRST so a crash/restart cannot re-publish it (prevents duplicates)
        post.instagramStatus = 'PUBLISHED';
        try {
          const igRes = await publishToInstagram(post.imageUrl, post.caption);
          post.instagramPostId = igRes.postId;
          hermesAnalytics.totalPublished++;
          hermesAnalytics.byType[post.type || 'dsa'].published++;
          apiMetrics.instagramLatency = Date.now() - igStart;
          hermesAnalytics.apiMetrics.instagram.calls++;
          hermesAnalytics.apiMetrics.instagram.totalLatencyMs += apiMetrics.instagramLatency;
          await post.save(); // persist IMMEDIATELY to prevent duplicate on restart
          logger.postEvent('instagram_published', post._id, { postId: igRes.postId, latencyMs: apiMetrics.instagramLatency });
        } catch (igErr) {
          post.instagramStatus = 'FAILED';
          post.errorLog = (post.errorLog || '') + `\n[Instagram] ${igErr.message}`;
          hermesAnalytics.totalFailed++;
          apiMetrics.instagramLatency = Date.now() - igStart;
          hermesAnalytics.apiMetrics.instagram.calls++;
          hermesAnalytics.apiMetrics.instagram.errors++;
          await post.save();
          logger.postEvent('instagram_failed', post._id, { error: igErr.message, latencyMs: apiMetrics.instagramLatency });
        }
      }

      // Handle stale posts: if PENDING but no content, mark as SKIPPED so queue clears
      if (post.instagramStatus === 'PENDING' && !post.imageUrl) {
        post.instagramStatus = 'SKIPPED';
        logger.warn('Stale post: Instagram PENDING but no imageUrl, marking SKIPPED', { postId: post._id });
      }
      if (post.youtubeStatus === 'PENDING' && !post.videoPath) {
        post.youtubeStatus = 'SKIPPED';
        logger.warn('Stale post: YouTube PENDING but no videoPath, marking SKIPPED', { postId: post._id });
      }

      // Publish to Instagram
      if (post.instagramStatus === 'PENDING' && post.imageUrl) {
        const ytStart = Date.now();
        post.youtubeStatus = 'PUBLISHED';
        try {
          const ytRes = await uploadToYouTube(post.videoPath, {
            title: post.title || post.caption.substring(0, 100),
            description: post.caption,
            tags: post.tags || [],
          });
          post.youtubeVideoId = ytRes.id;
          hermesAnalytics.totalPublished++;
          apiMetrics.youtubeLatency = Date.now() - ytStart;
          hermesAnalytics.apiMetrics.youtube.calls++;
          hermesAnalytics.apiMetrics.youtube.totalLatencyMs += apiMetrics.youtubeLatency;
          await post.save();
          logger.postEvent('youtube_published', post._id, { videoId: ytRes.id, latencyMs: apiMetrics.youtubeLatency });
        } catch (ytErr) {
          post.youtubeStatus = 'FAILED';
          post.errorLog = (post.errorLog || '') + `\n[YouTube] ${ytErr.message}`;
          hermesAnalytics.totalFailed++;
          apiMetrics.youtubeLatency = Date.now() - ytStart;
          hermesAnalytics.apiMetrics.youtube.calls++;
          hermesAnalytics.apiMetrics.youtube.errors++;
          await post.save();
          logger.postEvent('youtube_failed', post._id, { error: ytErr.message, latencyMs: apiMetrics.youtubeLatency });
        }
      }

      // Mark as complete if both platforms done
      const igDone = ['PUBLISHED', 'FAILED', 'SKIPPED'].includes(post.instagramStatus);
      const ytDone = ['PUBLISHED', 'FAILED', 'SKIPPED'].includes(post.youtubeStatus);
      if (igDone && ytDone) {
        post.publishedAt = new Date();
        post.status = 'PUBLISHED';
      }

      await post.save();
      hermesAnalytics.lastPublish = new Date().toISOString();
      logger.postEvent('post_cycle_complete', post._id, {
        totalLatencyMs: Date.now() - publishStart,
        ...apiMetrics,
      });
    }
  } finally {
    publishLock = false;
  }
}

/**
 * Main Hermes decision-making function
 * Called periodically to make autonomous decisions
 */
async function hermesCycle() {
  const cycleStart = Date.now();
  logger.info('Autonomous cycle starting', {
    istHour: getISTHour(),
    isPeakTime: isOptimalPublishTime(),
  });

  try {
    // Get current queue state
    const pendingPosts = await Post.find({ status: 'PENDING' });
    const failedPosts = await Post.find({
      $or: [
        { instagramStatus: 'FAILED' },
        { youtubeStatus: 'FAILED' },
      ],
    });

    logger.info('Queue state retrieved', {
      pendingCount: pendingPosts.length,
      failedCount: failedPosts.length,
    });

    // Decision 1: Should we generate new content?
    await hermesDecideContentGeneration(pendingPosts.length);

    // Decision 2: Should we retry failed posts?
    await hermesRetryFailedPosts(failedPosts);

    // Decision 3: Should we publish pending posts now?
    await hermesPublishPending(pendingPosts);

    const cycleLatency = Date.now() - cycleStart;
    logger.info('Cycle complete', {
      stats: {
        generated: hermesAnalytics.totalGenerated,
        published: hermesAnalytics.totalPublished,
        failed: hermesAnalytics.totalFailed,
      },
      latencyMs: cycleLatency,
    });
  } catch (err) {
    logger.error('Cycle error', { error: err.message, stack: err.stack });
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
  console.log('🔄 Failed post retries: auto (10 min delay, max ' + HERMES_CONFIG.MAX_RETRY_COUNT + ' retries)');
  console.log('🎯 Optimal publishing: peak hours only');
  console.log('📈 Daily limit: ' + HERMES_CONFIG.DAILY_POST_LIMIT + ' posts');
  console.log('─────────────────────────────────────────');

  // Main autonomous cycle - runs every 5 minutes
  // This single cron handles generation, retry, AND publishing
  cron.schedule(HERMES_CONFIG.QUEUE_CHECK_INTERVAL, hermesCycle);

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
    hermesAnalytics.totalGenerated = 0;
    hermesAnalytics.totalPublished = 0;
    hermesAnalytics.totalFailed = 0;
    hermesAnalytics.recentFailures = [];
  });

  // Run initial cycle immediately on startup (delay 30s to let server warm up)
  setTimeout(() => {
    logger.info('Initial Hermes cycle triggered on startup');
    hermesCycle();
  }, 30000);

  console.log('✅ HERMES AGENT ONLINE - Autonomous content automation active\n');
}

module.exports = {
  startHermesAgent,
  hermesCycle,
  hermesAnalytics,
  HERMES_CONFIG,
};
