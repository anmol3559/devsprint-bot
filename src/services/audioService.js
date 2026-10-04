const axios = require('axios');
const fs = require('fs');
const path = require('path');

const HF_TOKEN = process.env.HF_TOKEN;

// Use a proper TTS model endpoint - try multiple options
const VOICE_AI_URLS = [
  'https://api-inference.huggingface.co/models/facebook/wav2vec2-ljspeech-distilled',
  'https://api-inference.huggingface.co/models/facebook/mms-tts-eng',
  'https://api-inference.huggingface.co/models/facebook/fastspeech2-ljspeech',
];

async function generateAudioFromText(text, filename) {
    if (!HF_TOKEN) {
        throw new Error('HF_TOKEN (HuggingFace API token) is required for TTS audio generation');
    }

    console.log(`🎙️ Generating TTS audio via HuggingFace Inference API...`);

    const outputDir = path.join(__dirname, '../../output/audios');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const finalFilename = filename.replace('.mp3', '.wav');
    const outputPath = path.join(outputDir, finalFilename);

    let lastError;
    for (const url of VOICE_AI_URLS) {
        try {
            console.log(`   Trying HF endpoint: ${url}`);
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
                    console.log(`✅ Audio saved at: ${outputPath}`);
                    resolve(outputPath);
                });
                writer.on('error', (err) => reject(err));
            });

        } catch (error) {
            lastError = error;
            console.log(`⚠️ Endpoint failed: ${url} - ${error.message}`);
        }
    }
    throw new Error(`All HuggingFace endpoints failed: ${lastError?.message || 'Unknown error'}`);
}

module.exports = { generateAudioFromText };
