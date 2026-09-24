const cron = require('node-cron');
const Post = require('../models/Post');
const { publishToInstagram } = require('../services/instagramService');

const startPostScheduler = () => {
  // Har 2 minute mein check karega: '*/2 * * * *'
  // Daily subah 10:00 AM ke liye: '0 10 * * *'
  cron.schedule('*/2 * * * *', async () => {
    try {
      const post = await Post.findOne({
        status: 'PENDING',
        scheduledFor: { $lte: new Date() }
      }).sort({ scheduledFor: 1 });

      if (!post) {
        return;
      }

      console.log(`\n[CRON] Publishing scheduled post: ${post._id}`);

      const res = await publishToInstagram(post.imageUrl, post.caption);

      post.status = 'PUBLISHED';
      post.instagramPostId = res.postId;
      post.publishedAt = new Date();
      await post.save();

      console.log(`[CRON] Post live on Instagram! Post ID: ${res.postId}`);
    } catch (err) {
      console.error('[CRON] Failed to publish post:', err.message);

      const failedPost = await Post.findOne({
        status: 'PENDING',
        scheduledFor: { $lte: new Date() }
      });

      if (failedPost) {
        failedPost.status = 'FAILED';
        failedPost.errorLog = err.response?.data?.error?.message || err.message;
        await failedPost.save();
      }
    }
  });

  console.log('🚀 Instagram Post Scheduler initialized.');
};

module.exports = { startPostScheduler };