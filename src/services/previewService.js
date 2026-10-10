const path = require('path');
const fs = require('fs');
const { TOPICS } = require('../config/topics');
const { generateDSAScript } = require('../generators/dsaScriptGen');
const { generateCodeCardImage } = require('../generators/cardImageGen');
const logger = require('../utils/logger');

/**
 * Generate a preview post WITHOUT saving to database
 * Runs: Gemini → Code Card Image (Instagram-ready)
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
    videoPath: null,  // No video generation
    errorLog: null,
  };

  try {
    // Step 1: Generate content via Groq/Gemini
    const aiData = await generateDSAScript(
      selectedTopic.topic,
      selectedTopic.difficulty,
      selectedTopic.pattern
    );
    result.title = aiData.title;
    result.description = aiData.description;
    logger.info('[Preview] Content generated', { title: result.title });

    // Step 2: Extract clean C++ code
    const rawCode = aiData.codeVisual || '';
    const codeMatch = rawCode.match(/(?:vector|int|bool|void)\s+[\s\S]*?\n\}/);
    const cleanCode = codeMatch ? codeMatch[0] : rawCode;
    result.codeSnippet = cleanCode;

    // Step 3: Generate code card image (Instagram post)
    logger.info('[Preview] Generating image...');
    result.imageUrl = await generateCodeCardImage(cleanCode, `${selectedTopic.topic} - C++ Optimal`);
    logger.info('[Preview] Image generated', { imageUrl: result.imageUrl });

  } catch (imgErr) {
    logger.error('[Preview] Image generation failed', { error: imgErr.message });
    result.errorLog = imgErr.message;
  }

  result.latencyMs = Date.now() - start;
  logger.info('[Preview] Generation complete', { latencyMs: result.latencyMs });

  return result;
}

module.exports = { generatePreview };