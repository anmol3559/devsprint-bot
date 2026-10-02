// src/services/instagramService.js
const axios = require('axios');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function publishToInstagram(imageUrl, caption) {
  const accountId = process.env.INSTA_ACCOUNT_ID;
  const accessToken = process.env.INSTA_ACCESS_TOKEN;

  if (!accountId || !accessToken) {
    throw new Error('INSTA_ACCOUNT_ID or INSTA_ACCESS_TOKEN is missing in .env');
  }

  try {
    // --- NEW FIX: CDN Propagation Delay & Cache Warmup ---
    console.log(`[Instagram API] Warming up Cloudinary image cache...`);
    try {
      // Ek self-ping karte hain taaki Cloudinary image ko process karke cache me daal de
      await axios.get(imageUrl); 
    } catch (pingError) {
      // Ignore ping errors, just let it process
    }
    
    console.log('[Instagram API] Waiting 8 seconds for global CDN propagation...');
    await sleep(8000); 
    // -------------------------------------------------------

    // 1. Create Media Container
    console.log('[Instagram API] Creating media container...');
    const containerRes = await axios.post(
      `https://graph.facebook.com/v19.0/${accountId}/media`,
      null,
      {
        params: {
          image_url: imageUrl,
          caption: caption,
          access_token: accessToken,
        },
      }
    );

    const creationId = containerRes.data.id;
    console.log(`[Instagram API] Container created: ${creationId}`);

    // Wait 5 seconds for Meta to internally process the fetched image
    console.log('[Instagram API] Waiting 5 seconds for Meta internal processing...');
    await sleep(5000);

    // 2. Publish Media
    console.log('[Instagram API] Publishing post...');
    const publishRes = await axios.post(
      `https://graph.facebook.com/v19.0/${accountId}/media_publish`,
      null,
      {
        params: {
          creation_id: creationId,
          access_token: accessToken,
        },
      }
    );

    console.log(`[Instagram API] Published successfully: ${publishRes.data.id}`);
    return { success: true, postId: publishRes.data.id };
  } catch (error) {
    const errorDetails = error.response?.data?.error || error.message;
    console.error('Instagram Publish Error:', errorDetails);
    throw error;
  }
}

module.exports = { publishToInstagram };