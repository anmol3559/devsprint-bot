// src/services/videoStitcher.js
const path = require('path');

// Check if Remotion is available - if not, gracefully skip video generation
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
 * Render a reel using Remotion - falls back gracefully if Remotion is not installed
 */
async function renderReel(reelData, audioFilePath) {
    if (!remotionAvailable) {
        console.log("⚠️ Video rendering skipped - Remotion packages not installed");
        return null;
    }

    console.log("🎬 Starting Remotion render process...");

    // Remotion React project path
    const remotionProjectPath = path.join(__dirname, '../../remotion-template');
    const compositionId = 'DevSprintReel';

    try {
        // Bundle the React project
        console.log("📦 Bundling video template...");
        const bundleLocation = await bundle(remotionProjectPath, () =>
            console.log("   Bundling in progress...")
        );

        // Input properties for the React component
        const inputProps = {
            hook: reelData.hook,
            scriptBody: reelData.scriptBody,
            callToAction: reelData.callToAction,
            onScreenText: reelData.onScreenText || [],
            audioUrl: audioFilePath ? 'file://' + path.resolve(audioFilePath) : ''
        };

        // Get composition details
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: compositionId,
            inputProps,
        });

        // Render the MP4
        const outputLocation = path.join(__dirname, `../../output/videos/final_reel_${Date.now()}.mp4`);
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