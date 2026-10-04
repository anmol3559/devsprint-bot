const axios = require('axios');
const fs = require('fs');
const path = require('path');

const HF_TOKEN = process.env.HF_TOKEN;
// Try both endpoints for redundancy
const VOICE_AI_URLS = [
  'https://api-inference.huggingface.co/models/Qwen/Qwen3-TTS',
  'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Chat'
];
let VOICE_AI_URL = VOICE_AI_URLS[0];

async function generateAudioFromText(text, filename) {
    console.log(`🎙️ Qwen3-TTS AI voiceover generate kar raha hai...`);
    
    const outputDir = path.join(__dirname, '../../output/audios');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Hugging Face standard .wav format deta hai
    const finalFilename = filename.replace('.mp3', '.wav');
    const outputPath = path.join(outputDir, finalFilename);

    // Try multiple HF endpoints if one fails
    let lastError;
    for (const url of VOICE_AI_URLS) {
        try {
            const response = await axios({
                method: 'POST',
                url,
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                data: { inputs: text },
                responseType: 'stream',
                timeout: 15000
            });

            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`✅ Audio saved successfully at: ${outputPath}`);
                    resolve(outputPath);
                });
                writer.on('error', (err) => reject(err));
            });

        } catch (error) {
            lastError = error;
            console.log(`⚠️ Trying next endpoint:`, url);
        }
    }
    throw new Error(`All Hugging Face endpoints failed: ${lastError?.message || 'Unknown error'}`);
}

module.exports = { generateAudioFromText };