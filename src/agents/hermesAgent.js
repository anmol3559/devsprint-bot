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
const logger = require('../utils/logger');

// Hermes configuration
const HERMES_CONFIG = {
  QUEUE_CHECK_INTERVAL: '*/5 * * * *',    // Check queue every 5 minutes
  GENERATION_TIMEOUT: 5 * 60 * 1000,        // 5 min for content generation
  PUBLISH_RETRY_DELAY: 10 * 60 * 1000,     // 10 min retry for failed posts
  MAX_RETRY_COUNT: 3,                      // Max publish retries per post
  DAILY_POST_LIMIT: 12,                      // Max posts per day
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
  // Track per-post-type analytics
  byType: {
    dsa: { generated: 0, published: 0, failed: 0 },
    backend: { generated: 0, published: 0, failed: 0 },
  },
  // API call metrics
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
    hermesAnalytics.lastPublish = new Date().toISOString();
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
 * Decision 1: Content Generation
 * Generate new content if queue is low and we're under daily limit
 */
async function hermesDecideContentGeneration(pendingCount) {
  const underLimit = !(await isDailyLimitReached());
  const queueLow = pendingCount < HERMES_CONFIG.MIN_QUEUE_SIZE;

  if (!underLimit) {
    logger.info('Daily limit reached, skipping generation', { pendingCount });
    return;
  }

  if (queueLow) {
    logger.info('Queue low, generating new content', { pendingCount });
    const genStart = Date.now();

    try {
      // Alternate between DSA and Backend posts
      const recentPosts = await Post.find({}).sort({ createdAt: -1 }).limit(1);
      const lastWasBackend = recentPosts.length > 0 &&
        recentPosts[0].title &&
        recentPosts[0].title.includes('How ');

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
  } else {
    logger.info('Queue healthy, no generation needed', { pendingCount });
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
    logger.info('No posts ready for retry', { totalFailed: failedPosts.length });
    return;
  }

  logger.info('Retrying failed posts', { count: retryable.length, totalFailed: failedPosts.length });

  for (const post of retryable) {
    try {
      const retryDetails = {};

      // Reset status for retry
      if (post.instagramStatus === 'FAILED' && post.imageUrl) {
        post.instagramStatus = 'PENDING';
        retryDetails.instagram = 'reset to PENDING';
      }
      if (post.youtubeStatus === 'FAILED' && post.videoPath) {
        post.youtubeStatus = 'PENDING';
        retryDetails.youtube = 'reset to PENDING';
      }
      await post.save();
      logger.postEvent('retry_scheduled', post._id, retryDetails);
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
 * Publish posts when optimal time is reached
 */
async function hermesPublishPending(pendingPosts) {
  // Deduplicate by postId - ensure each post is only processed once
  const seenIds = new Set();
  const publishable = pendingPosts.filter(post => {
    const postId = post._id.toString();
    if (seenIds.has(postId)) {
      logger.warn('Duplicate post detected and skipped', { postId });
      return false;
    }
    seenIds.add(postId);

    const isScheduled = post.scheduledFor <= new Date();
    const hasContent = post.imageUrl || post.videoPath;
    return isScheduled && hasContent;
  });

  if (publishable.length === 0) {
    logger.info('No posts ready to publish now', { pendingCount: pendingPosts.length });
    return;
  }

  // If it's peak hours, publish; otherwise wait
  if (!isOptimalPublishTime()) {
    logger.info('Not peak hours, will publish during peak hours', {
      currentISTHour: getISTHour(),
      readyToPublish: publishable.length,
    });
    return;
  }

  logger.info('Publishing posts during peak hours', { count: publishable.length });

  for (const post of publishable) {
    const publishStart = Date.now();

    try {
      // Track API calls
      const apiMetrics = { instagramLatency: 0, youtubeLatency: 0, instagramStatus: 'skipped', youtubeStatus: 'skipped' };

      // Publish to Instagram
      if (post.instagramStatus === 'PENDING' && post.imageUrl) {
        const igStart = Date.now();
        try {
          const igRes = await publishToInstagram(post.imageUrl, post.caption);
          post.instagramPostId = igRes.postId;
          post.instagramStatus = 'PUBLISHED';
          hermesAnalytics.totalPublished++;
          apiMetrics.instagramStatus = 'published';
          apiMetrics.instagramLatency = Date.now() - igStart;
          hermesAnalytics.apiMetrics.instagram.calls++;
          hermesAnalytics.apiMetrics.instagram.totalLatencyMs += apiMetrics.instagramLatency;
          logger.postEvent('instagram_published', post._id, { postId: igRes.postId, latencyMs: apiMetrics.instagramLatency });
        } catch (igErr) {
          post.instagramStatus = 'FAILED';
          post.errorLog = (post.errorLog || '') + `\n[Instagram] ${igErr.message}`;
          hermesAnalytics.totalFailed++;
          apiMetrics.instagramStatus = 'failed';
          apiMetrics.instagramLatency = Date.now() - igStart;
          hermesAnalytics.apiMetrics.instagram.calls++;
          hermesAnalytics.apiMetrics.instagram.errors++;
          hermesAnalytics.apiMetrics.instagram.totalLatencyMs += apiMetrics.instagramLatency;
          logger.postEvent('instagram_failed', post._id, { error: igErr.message, latencyMs: apiMetrics.instagramLatency });
        }
      }

      // Publish to YouTube
      if (post.youtubeStatus === 'PENDING' && post.videoPath) {
        const ytStart = Date.now();
        try {
          const ytRes = await uploadToYouTube(post.videoPath, {
            title: post.title || post.caption.substring(0, 100),
            description: post.caption,
            tags: post.tags || [],
          });
          post.youtubeVideoId = ytRes.id;
          post.youtubeStatus = 'PUBLISHED';
          hermesAnalytics.totalPublished++;
          apiMetrics.youtubeStatus = 'published';
          apiMetrics.youtubeLatency = Date.now() - ytStart;
          hermesAnalytics.apiMetrics.youtube.calls++;
          hermesAnalytics.apiMetrics.youtube.totalLatencyMs += apiMetrics.youtubeLatency;
          logger.postEvent('youtube_published', post._id, { videoId: ytRes.id, latencyMs: apiMetrics.youtubeLatency });
        } catch (ytErr) {
          post.youtubeStatus = 'FAILED';
          post.errorLog = (post.errorLog || '') + `\n[YouTube] ${ytErr.message}`;
          hermesAnalytics.totalFailed++;
          apiMetrics.youtubeStatus = 'failed';
          apiMetrics.youtubeLatency = Date.now() - ytStart;
          hermesAnalytics.apiMetrics.youtube.calls++;
          hermesAnalytics.apiMetrics.youtube.errors++;
          hermesAnalytics.apiMetrics.youtube.totalLatencyMs += apiMetrics.youtubeLatency;
          logger.postEvent('youtube_failed', post._id, { error: ytErr.message, latencyMs: apiMetrics.youtubeLatency });
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
      logger.postEvent('post_cycle_complete', post._id, {
        totalLatencyMs: Date.now() - publishStart,
        ...apiMetrics,
      });
    } catch (publishErr) {
      logger.postEvent('publish_error', post._id, {
        error: publishErr.message,
        totalLatencyMs: Date.now() - publishStart,
      });
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
        logger.info('Peak hour detected, publishing pending posts', { count: pending.length });
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