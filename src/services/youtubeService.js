// src/services/youtubeService.js
const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

// OAuth2 Client Setup
const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
);

// Ye function future mein tera generated video upload karega
const uploadToYouTube = async (videoFilePath, scriptData) => {
    try {
        // Token set karna (Tu baad mein DB ya file se token yahan pass karega)
        oauth2Client.setCredentials({
            refresh_token: process.env.YOUTUBE_REFRESH_TOKEN
        });

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        console.log("📤 Uploading to YouTube Shorts...");

        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: scriptData.title,
                    description: scriptData.description,
                    tags: scriptData.tags,
                    categoryId: '27', // Education category
                },
                status: {
                    privacyStatus: 'private', // Shuru mein private rakhenge testing ke liye
                    selfDeclaredMadeForKids: false,
                },
            },
            media: {
                body: fs.createReadStream(videoFilePath),
            },
        });

        console.log(`✅ YouTube Upload Success! Video URL: https://youtu.be/${response.data.id}`);
        return response.data;
    } catch (error) {
        console.error("❌ YouTube Upload Failed:", error.message);
        throw error;
    }
};

module.exports = { uploadToYouTube };