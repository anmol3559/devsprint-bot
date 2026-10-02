const cron = require('node-cron');
const Post = require('../models/Post');
const { publishToInstagram } = require('../services/instagramService');
const { uploadToYouTube } = require('../services/youtubeService');

const startPostScheduler = () => {
  // Har 2 minute mein check karega: '*/2 * * * *'
  cron.schedule('*/2 * * * *', async () => {
    try {
      // Get posts that still have pending work on any platform
      const post = await Post.findOne({
        $or: [
          { instagramStatus: 'PENDING' },
          { youtubeStatus: 'PENDING' }
        ],
        scheduledFor: { $lte: new Date() }
      }).sort({ scheduledFor: 1 });

      if (!post) {
        return;
      }

      let hasError = false;
      let allDone = true;

      console.log(`\n[CRON] Processing post: ${post._id}`);

      // --- Publish to Instagram (if image available) ---
      if (post.instagramStatus === 'PENDING' && post.imageUrl) {
        try {
          const igRes = await publishToInstagram(post.imageUrl, post.caption);
          post.instagramPostId = igRes.postId;
          post.instagramStatus = 'PUBLISHED';
          console.log(`[CRON] Post live on Instagram! Post ID: ${igRes.postId}`);
        } catch (igErr) {
          hasError = true;
          post.instagramStatus = 'FAILED';
          post.errorLog = (post.errorLog || '') + `\n[Instagram] ${igErr.response?.data?.error?.message || igErr.message}`;
          console.error('[CRON] Instagram publish failed:', igErr.message);
        }
      } else if (post.instagramStatus === 'PENDING' && !post.imageUrl) {
        // No image to publish - skip
        post.instagramStatus = 'SKIPPED';
        console.log('[CRON] No image available, skipping Instagram.');
      }

      // --- Publish to YouTube (if video available) ---
      if (post.youtubeStatus === 'PENDING' && post.videoPath) {
        try {
          const ytRes = await uploadToYouTube(post.videoPath, {
            title: post.title || post.caption.substring(0, 100),
            description: post.caption,
            tags: post.tags || []
          });
          post.youtubeVideoId = ytRes.id;
          post.youtubeStatus = 'PUBLISHED';
          console.log(`[CRON] Post live on YouTube! Video ID: ${ytRes.id}`);
        } catch (ytErr) {
          hasError = true;
          post.youtubeStatus = 'FAILED';
          post.errorLog = (post.errorLog || '') + `\n[YouTube] ${ytErr.message}`;
          console.error('[CRON] YouTube upload failed:', ytErr.message);
        }
      } else if (post.youtubeStatus === 'PENDING' && !post.videoPath) {
        // No video to publish - skip
        post.youtubeStatus = 'SKIPPED';
        console.log('[CRON] No video available, skipping YouTube.');
      }

      // Check if all platforms are done
      const igDone = ['PUBLISHED', 'FAILED', 'SKIPPED'].includes(post.instagramStatus);
      const ytDone = ['PUBLISHED', 'FAILED', 'SKIPPED'].includes(post.youtubeStatus);

      if (igDone && ytDone) {
        post.publishedAt = new Date();
        // Overall status is FAILED only if both failed; otherwise PUBLISHED
        if (post.instagramStatus === 'FAILED' && post.youtubeStatus === 'FAILED') {
          post.status = 'FAILED';
        } else {
          post.status = 'PUBLISHED';
        }
        console.log(`[CRON] Post ${post.status} - Instagram: ${post.instagramStatus}, YouTube: ${post.youtubeStatus}`);
      } else {
        // Still pending on some platform, keep status PENDING so it gets retried
        post.publishedAt = null;
        console.log(`[CRON] Post still pending - Instagram: ${post.instagramStatus}, YouTube: ${post.youtubeStatus}`);
      }

      await post.save();

    } catch (err) {
      console.error('[CRON] Critical scheduler error:', err.message);
    }
  });

  console.log('🚀 Media Scheduler initialized (Instagram + YouTube with per-platform status).');
};

module.exports = { startPostScheduler };
