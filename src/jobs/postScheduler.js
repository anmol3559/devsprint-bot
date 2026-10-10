const cron = require('node-cron');
const Post = require('../models/Post');
const { publishToInstagram } = require('../services/instagramService');

const startPostScheduler = () => {
  // Har 2 minute mein check karega: '*/2 * * * *'
  cron.schedule('*/2 * * * *', async () => {
    try {
      // Get posts that still have pending work on Instagram
      const post = await Post.findOne({
        instagramStatus: 'PENDING',
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

      // Check if Instagram is done
      const igDone = ['PUBLISHED', 'FAILED', 'SKIPPED'].includes(post.instagramStatus);

      if (igDone) {
        post.publishedAt = new Date();
        // Overall status
        if (post.instagramStatus === 'FAILED') {
          post.status = 'FAILED';
        } else {
          post.status = 'PUBLISHED';
        }
        console.log(`[CRON] Post ${post.status} - Instagram: ${post.instagramStatus}`);
      } else {
        // Still pending, keep status PENDING so it gets retried
        post.publishedAt = null;
        console.log(`[CRON] Post still pending - Instagram: ${post.instagramStatus}`);
      }

      await post.save();

    } catch (err) {
      console.error('[CRON] Critical scheduler error:', err.message);
    }
  });

  console.log('🚀 Media Scheduler initialized (Instagram only).');
};

module.exports = { startPostScheduler };