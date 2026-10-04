const axios = require('axios');
const fs = require('fs');
const path = require('path');

const HF_TOKEN = process.env.HF_TOKEN;
const VOICE_AI_URL = 'https://api-inference.huggingface.co/models/Qwen/Qwen3-TTS';

async function generateAudioFromText(text, filename) {
    console.log(`🎙️ Qwen3-TTS AI voiceover generate kar raha hai...`);
    
    const outputDir = path.join(__dirname, '../../output/audios');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Hugging Face standard .wav format deta hai
    const finalFilename = filename.replace('.mp3', '.wav');
    const outputPath = path.join(outputDir, finalFilename);

    try {
        const response = await axios({
            method: 'POST',
            url: VOICE_AI_URL,
            headers: {
                'Authorization': `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: { inputs: text },
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✅ Qwen3 Audio saved successfully at: ${outputPath}`);
                resolve(outputPath);
            });
            writer.on('error', (err) => reject(err));
        });

    } catch (error) {
        console.error("❌ Qwen3 Audio AI failed:", error.response ? error.response.statusText : error.message);
        throw error;
    }
}

module.exports = { generateAudioFromText };