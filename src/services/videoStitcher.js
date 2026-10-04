// src/services/videoStitcher.js
const path = require('path');
const fs = require('fs');

// Check if Remotion is available
let remotionAvailable = false;
let bundle, renderMedia, selectComposition;

try {
    bundle = require('@remotion/bundler').bundle;
    renderMedia = require('@remotion/renderer').renderMedia;
    selectComposition = require('@remotion/renderer').selectComposition;
    remotionAvailable = true;
    console.log("🎬 Remotion rendering available");
} catch (e) {
    console.log("⚠️ Remotion not fully installed - video generation will be skipped. Install with: npm install @remotion/bundler @remotion/renderer remotion");
}

/**
 * Render a reel using Remotion
 * @param {object} reelData - Reel script data from Groq
 * @param {string} audioFilePath - Path to the generated WAV audio file
 * @returns {Promise<string|null>} Path to rendered MP4, or null if skipped
 */
async function renderReel(reelData, audioFilePath) {
    if (!remotionAvailable) {
        console.log("⚠️ Video rendering skipped - Remotion packages not installed");
        return null;
    }

    if (!audioFilePath || !fs.existsSync(audioFilePath)) {
        console.log("⚠️ No valid audio file found, skipping video generation");
        return null;
    }

    console.log("🎬 Starting Remotion render process...");

    const remotionProjectPath = path.join(__dirname, '../../remotion-template');
    const compositionId = 'DevSprintReel';

    try {
        console.log("📦 Bundling video template...");
        const bundleLocation = await bundle(remotionProjectPath, () =>
            console.log("   Bundling in progress...")
        );

        const inputProps = {
            hook: reelData.hook,
            scriptBody: reelData.scriptBody,
            callToAction: reelData.callToAction,
            onScreenText: reelData.onScreenText || [],
            audioUrl: audioFilePath,
        };

        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: compositionId,
            inputProps,
        });

        const outputDir = path.join(__dirname, '../../output/videos');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputLocation = path.join(outputDir, `final_reel_${Date.now()}.mp4`);
        console.log(`🚀 Rendering MP4 to ${outputLocation}. This might take a minute...`);

        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation,
            inputProps,
        });

        console.log(`✅ Video successfully rendered at: ${outputLocation}`);
        return outputLocation;

    } catch (error) {
        console.error("❌ Remotion render failed:", error.message);
        return null;
    }
}

module.exports = { renderReel, remotionAvailable };
