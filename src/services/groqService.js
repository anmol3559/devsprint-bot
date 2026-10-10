const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
];

async function generateContentViaGroq(prompt, purpose = 'general') {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const systemPrompts = {
    dsa_script: `You are an expert C++ competitive programmer and technical content creator. Always return valid JSON.`,
    backend_script: `You are an expert software architect and backend engineer. Always return valid JSON.`,
    general: `You are a helpful technical assistant. Always return valid JSON.`,
  };

  let lastError;
  for (const model of GROQ_MODELS) {
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: systemPrompts[purpose] || systemPrompts.general },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
          timeout: 30000,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const text = response.data.choices[0].message.content.trim();
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      const errMsg = error.response?.data?.error?.message || error.message;
      console.log(`[Groq Service] Model ${model} failed:`, errMsg);

      // Don't retry on auth/quota errors
      if (error.response?.status === 401 || error.response?.status === 429) {
        throw new Error(`Groq API auth/quota error: ${errMsg}`);
      }
    }
  }

  throw new Error(`All Groq models failed: ${lastError?.response?.data?.error?.message || lastError?.message}`);
}

module.exports = { generateContentViaGroq };