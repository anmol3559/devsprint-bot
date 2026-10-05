// src/services/previewService.js
const path = require('path');
const fs = require('fs');
const { TOPICS } = require('../config/topics');
const { generateDSAScript } = require('../generators/dsaScriptGen');
const { generateCodeCardImage } = require('../generators/cardImageGen');
const { renderReel } = require('./videoStitcher');
const { buildReelAssets } = require('./reelsAgent');
const logger = require('../utils/logger');

/**
 * Generate a preview post WITHOUT saving to database
 * Runs the full pipeline: Gemini → Image → Groq → HF TTS → Remotion MP4
 * Returns file paths for user to review before publishing
 */
async function generatePreview(topicName = null) {
  const start = Date.now();
  logger.info('[Preview] Starting preview generation', { topic: topicName });

  // Pick topic
  const selectedTopic = topicName
    ? { topic: topicName, difficulty: 'Medium', pattern: 'Greedy' }
    : TOPICS[Math.floor(Math.random() * TOPICS.length)];

  logger.info('[Preview] Selected topic', {
    topic: selectedTopic.topic,
    difficulty: selectedTopic.difficulty,
    pattern: selectedTopic.pattern,
  });

  const result = {
    topic: selectedTopic.topic,
    title: null,
    imageUrl: null,
    videoPath: null,
    errorLog: null,
  };

  try {
    // Step 1: Generate content via Gemini
    const aiData = await generateDSAScript(
      selectedTopic.topic,
      selectedTopic.difficulty,
      selectedTopic.pattern
    );
    result.title = aiData.title;
    result.description = aiData.description;
    logger.info('[Preview] Gemini content generated', { title: result.title });

    // Step 2: Extract clean C++ code
    const rawCode = aiData.codeVisual || '';
    const codeMatch = rawCode.match(/(?:vector|int|bool|void)\s+[\s\S]*?\n\}/);
    const cleanCode = codeMatch ? codeMatch[0] : rawCode;
    result.codeSnippet = cleanCode;

    // Step 3: Generate code card image
    logger.info('[Preview] Generating image...');
    result.imageUrl = await generateCodeCardImage(cleanCode, `${selectedTopic.topic} - C++ Optimal`);
    logger.info('[Preview] Image generated', { imageUrl: result.imageUrl });

  } catch (imgErr) {
    logger.error('[Preview] Image generation failed', { error: imgErr.message });
    result.errorLog = imgErr.message;
  }

  try {
    // Step 4: Generate video via Groq → HF TTS → Remotion
    logger.info('[Preview] Generating video...');
    const reelData = await buildReelAssets(selectedTopic.topic);
    if (reelData && reelData.audioFilePath) {
      result.videoPath = await renderReel(reelData.reelData, reelData.audioFilePath);
      result.hook = reelData.reelData.hook;
      result.scriptBody = reelData.reelData.scriptBody;
      result.onScreenText = reelData.reelData.onScreenText;
      logger.info('[Preview] Video generated', { videoPath: result.videoPath });
    } else {
      result.errorLog = (result.errorLog || '') + '\nVideo: No audio data returned by TTS';
      logger.warn('[Preview] No video audio generated');
    }
  } catch (videoErr) {
    logger.error('[Preview] Video generation failed', { error: videoErr.message });
    result.errorLog = (result.errorLog || '') + `\nVideo: ${videoErr.message}`;
  }

  result.latencyMs = Date.now() - start;
  logger.info('[Preview] Generation complete', { latencyMs: result.latencyMs });

  return result;
}

/**
 * Serve the video file from disk via Express static
 */
function getVideoStaticPath() {
  return path.join(__dirname, '../../output/videos');
}

module.exports = { generatePreview, getVideoStaticPath };
