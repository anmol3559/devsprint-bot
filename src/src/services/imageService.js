// src/services/imageService.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: String(process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: String(process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: String(process.env.CLOUDINARY_API_SECRET || '').trim(),
  secure: true,
});

async function uploadToCloudinary(filePathOrBase64) {
  try {
    const result = await cloudinary.uploader.upload(filePathOrBase64, {
      folder: 'devsprint_posts',
      resource_type: 'image',
      format: 'jpg', // Force JPG format for Meta API
      transformation: [
        {
          width: 1080,
          height: 1080,
          crop: 'pad', // Code card ko stretch kiye bina dark background se 1:1 square banayega
          background: '#0f172a', // Dracula background color match
        },
      ],
    });
    return result.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Failed:', error.message || error);
    throw error;
  }
}

module.exports = { uploadToCloudinary };