// src/generators/cardImageGen.js
const axios = require('axios');
const { uploadToCloudinary } = require('../services/imageService');

// Primary Carbon API endpoint
const CARBON_API_URL = 'https://carbonara.solopov.dev/api/cook';

// Fallback endpoints in case primary is down
const FALLBACK_API_URLS = [
  'https://carbonara.vercel.app/api/cook',
  'https://carbon.now.sh/api/cook'
];

async function generateCodeCardImage(codeSnippet, title = 'DevSprint DSA Tip') {
  const payload = {
    code: `// ${title}\n\n${codeSnippet}`,
    backgroundColor: '#0f172a',
    theme: 'dracula',
    language: 'cpp',
    dropShadow: true,
    windowControls: true,
    paddingVertical: '40px',
    paddingHorizontal: '40px',
  };

  // Try primary endpoint first, then fallbacks
  const endpoints = [CARBON_API_URL, ...FALLBACK_API_URLS];

  for (const endpoint of endpoints) {
    try {
      console.log(`[Image Generator] Trying endpoint: ${endpoint}`);
      const response = await axios.post(endpoint, payload, {
        responseType: 'arraybuffer',
        timeout: 15000
      });

      const base64Image = `data:image/png;base64,${Buffer.from(response.data).toString('base64')}`;

      console.log('[Image Generator] Uploading card to Cloudinary...');
      const publicUrl = await uploadToCloudinary(base64Image);
      console.log('[Image Generator] Public URL ready:', publicUrl);

      return publicUrl;
    } catch (error) {
      console.log(`[Image Generator] Endpoint ${endpoint} failed: ${error.message}`);
      continue; // Try next fallback
    }
  }

  // All endpoints failed - throw final error
  console.error('[Image Generator] ❌ All image generation endpoints failed');
  throw new Error('Failed to generate code card image: All endpoints unavailable (likely 502 from Carbon API)');
}

module.exports = { generateCodeCardImage };