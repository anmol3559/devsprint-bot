// src/services/videoStitcher.js
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Check if Remotion is available
let remotionAvailable = false;
let bundle, renderMedia, selectComposition;

try {
    bundle = require('@remotion/bundler').bundle;
    renderMedia = require('@remotion/renderer').renderMedia;
    selectComposition = require('@remotion/renderer').selectComposition;
    remotionAvailable = true;
    logger.info('🎬 Remotion rendering available');
} catch (e) {
    logger.warn('⚠️ Remotion not fully installed - video generation will be skipped. Install with: npm install @remotion/bundler @remotion/renderer remotion', { error: e.message });
}

/**
 * Render a reel using Remotion
 * @param {object} reelData - Reel script data from Groq
 * @param {string} audioFilePath - Path to the generated audio file
 * @returns {Promise<string|null>} Path to rendered MP4, or null if skipped
 */
async function renderReel(reelData, audioFilePath) {
    if (!remotionAvailable) {
        logger.warn('Video rendering skipped - Remotion packages not installed');
        return null;
    }

    if (!audioFilePath || !fs.existsSync(audioFilePath)) {
        logger.warn('No valid audio file found, skipping video generation', { audioFilePath: audioFilePath || 'null' });
        return null;
    }

    logger.info('🎬 Starting Remotion render process...', { audioFile: audioFilePath });

    const remotionProjectPath = path.join(__dirname, '../../remotion-template');
    const compositionId = 'DevSprintReel';

    try {
        logger.info('📦 Bundling video template...');
        const bundleLocation = await bundle(remotionProjectPath, (progress) => {
            logger.debug('Bundling progress', { progress });
        });
        logger.info('📦 Bundle complete', { bundleLocation });

        const inputProps = {
            hook: reelData.hook,
            scriptBody: reelData.scriptBody,
            callToAction: reelData.callToAction,
            onScreenText: reelData.onScreenText || [],
            audioUrl: audioFilePath,
        };

        logger.info('🔍 Selecting composition...');
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: compositionId,
            inputProps,
        });
        logger.info('🔍 Composition selected', { fps: composition.fps, duration: composition.durationInFrames });

        const outputDir = path.join(__dirname, '../../output/videos');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputLocation = path.join(outputDir, `final_reel_${Date.now()}.mp4`);
        logger.info('🚀 Rendering MP4', { outputLocation, durationSec: composition.durationInFrames / composition.fps });

        const renderResult = await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation,
            inputProps,
            onProgress: ({ progress }) => {
                logger.debug('Render progress', { percent: Math.round(progress * 100) });
            },
        });

        logger.info('✅ Video successfully rendered', { outputLocation, size: renderResult?.size });

        // Verify file exists
        if (fs.existsSync(outputLocation)) {
            const stats = fs.statSync(outputLocation);
            logger.info('✅ Video file verified', { sizeBytes: stats.size, sizeMB: Math.round(stats.size / 1024 / 1022 * 100) / 100 });
            return outputLocation;
        } else {
            logger.error('❌ Render finished but output file not found', { expectedPath: outputLocation });
            return null;
        }

    } catch (error) {
        logger.error('❌ Remotion render failed', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            details: error.details || error.cause || 'no extra details'
        });
        return null;
    }
}

module.exports = { renderReel, remotionAvailable };
