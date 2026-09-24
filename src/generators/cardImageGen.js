// src/generators/cardImageGen.js
const axios = require('axios');
const { uploadToCloudinary } = require('../services/imageService');

async function generateCodeCardImage(codeSnippet, title = 'DevSprint DSA Tip') {
  try {
    // Carbon-style high quality image API
    const response = await axios.post(
      'https://carbonara.solopov.dev/api/cook',
      {
        code: `// ${title}\n\n${codeSnippet}`,
        backgroundColor: '#0f172a', // Dark slate background
        theme: 'dracula',
        language: 'cpp',
        dropShadow: true,
        windowControls: true,
        paddingVertical: '40px',
        paddingHorizontal: '40px',
      },
      { responseType: 'arraybuffer' }
    );

    // Convert binary buffer to base64 for Cloudinary upload
    const base64Image = `data:image/png;base64,${Buffer.from(response.data).toString('base64')}`;
    
    console.log('[Image Generator] Uploading card to Cloudinary...');
    const publicUrl = await uploadToCloudinary(base64Image);
    console.log('[Image Generator] Public URL ready:', publicUrl);

    return publicUrl;
  } catch (error) {
    console.error('Error generating code card image:', error.message);
    throw error;
  }
}

module.exports = { generateCodeCardImage };