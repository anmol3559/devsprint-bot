// src/pipeline/createPost.js
const { generateDSAScript } = require('../generators/dsaScriptGen');
const { generateCodeCardImage } = require('../generators/cardImageGen');
const { buildReelAssets } = require('../services/reelsAgent');
const { renderReel } = require('../services/videoStitcher');
const Post = require('../models/Post');

async function createAutomatedPost(topic = "Two Sum", difficulty = "Easy", pattern = "Hash Map") {
  try {
    console.log(`[Pipeline] Generating AI content for: ${topic}...`);
    const aiData = await generateDSAScript(topic, difficulty, pattern);

    // Extract C++ code from videoScript.codeVisual
    const rawVisual = aiData.videoScript?.codeVisual || "";
    // Clean string if it contains extra labels
    const codeMatch = rawVisual.match(/vector<[\s\S]*?\n\}/) || [rawVisual];
    const codeToRender = codeMatch[0] || rawVisual;

    console.log('[Pipeline] Generating code card image via Cloudinary...');
    const imageUrl = await generateCodeCardImage(codeToRender, `${topic} (${difficulty})`);

    // Generate video for YouTube (optional)
    let videoPath = null;
    try {
      console.log('[Pipeline] Generating video via Remotion...');
      const reelData = await buildReelAssets(topic);
      if (reelData && reelData.audioFilePath) {
        videoPath = await renderReel(reelData.reelData, reelData.audioFilePath);
      }
    } catch (err) {
      console.error('[Pipeline] Video generation skipped:', err.message);
    }

    // Caption formatting
    const caption = `${aiData.title}\n\n${aiData.description}\n\n💡 Logic: ${aiData.videoScript?.logicBreakdown || ''}`;

    // Save to DB queue as PENDING
    const post = await Post.create({
      imageUrl: imageUrl,
      videoPath,
      title: aiData.title,
      caption: caption,
      tags: aiData.tags || [],
      scheduledFor: new Date(), // Immediate eligible
      status: 'PENDING',
    });

    console.log(`✅ Post queued successfully in DB! Post ID: ${post._id}`);
    return post;
  } catch (error) {
    console.error('❌ Failed to create automated post:', error.message);
    throw error;
  }
}

module.exports = { createAutomatedPost };