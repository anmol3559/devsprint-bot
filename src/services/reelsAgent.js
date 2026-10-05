const axios = require('axios');
const path = require('path');
const { generateAudioFromText } = require('./audioService');
const logger = require('../utils/logger');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Try models in order - free tier models as of 2024
const GROQ_MODELS = [
  'llama-3.1-8b-instant',      // Fast, small Llama 3.1
  'gemma2-9b-it',               // Google's Gemma 2
  'mixtral-8x7b-32768',        // Mixtral (larger context)
];

async function buildReelAssets(topic) {
  logger.info('[Reels Agent] Writing script', { topic });

  const systemPrompt = `You are a Tech Content Creator. Write a 30-second Instagram Reel script about "${topic}".
You MUST return ONLY a valid JSON object. No markdown, no extra text.
Format:
{
  "hook": "Catchy short opening sentence",
  "scriptBody": "Main technical explanation (max 2 sentences)",
  "callToAction": "Follow DevSprint for daily tech tips!",
  "onScreenText": ["Keyword1", "Keyword2", "Keyword3"]
}`;

  let lastError;

  for (const model of GROQ_MODELS) {
    try {
      logger.debug('[Reels Agent] Trying model', { model });

      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Write a reel script about ${topic}` }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }, {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const responseText = response.data.choices[0].message.content.trim();
      const reelData = JSON.parse(responseText);

      logger.info('[Reels Agent] Script generated', { model, hook: reelData.hook });

      const fullScript = `${reelData.hook} ${reelData.scriptBody} ${reelData.callToAction}`;
      const audioFilename = `reel_audio_${Date.now()}.mp3`;

      const audioFilePath = await generateAudioFromText(fullScript, audioFilename);
      return { reelData, audioFilePath };

    } catch (error) {
      lastError = error;
      const errorDetails = error.response?.data || { message: error.message };
      logger.warn('[Reels Agent] Model failed, trying next', {
        model,
        error: errorDetails.error?.message || error.message
      });

      // If it's an auth/quota error, don't try other models
      if (error.response?.status === 401 || error.response?.status === 429) {
        break;
      }
      // Continue to next model
    }
  }

  // All models failed
  const errorDetails = lastError?.response?.data || { message: lastError?.message };
  logger.error('[Reels Agent] All Groq models failed', { error: errorDetails });
  throw new Error(`Groq API error (all models failed): ${JSON.stringify(errorDetails)}`);
}

module.exports = { buildReelAssets };