const axios = require('axios');
const path = require('path');
const { generateAudioFromText } = require('./audioService');

// Use environment variable for Groq API key (add GROQ_API_KEY to .env)
const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function buildReelAssets(topic) {
    console.log(`🧠 Groq AI (Llama-3) is writing the script for: ${topic}...`);
    
    const systemPrompt = `You are a Tech Content Creator. Write a 30-second Instagram Reel script about "${topic}".
You MUST return ONLY a valid JSON object. No markdown, no extra text.
Format:
{
  "hook": "Catchy short opening sentence",
  "scriptBody": "Main technical explanation (max 2 sentences)",
  "callToAction": "Follow DevSprint for daily tech tips!",
  "onScreenText": ["Keyword1", "Keyword2", "Keyword3"]
}`;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'openai/gpt-oss-20b', 
            messages: [{ role: 'user', content: systemPrompt }],
            temperature: 0.7,
            response_format: { type: "json_object" } // Groq ko strictly JSON dene ke liye force karta hai
        }, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = response.data.choices[0].message.content.trim();
        const reelData = JSON.parse(responseText);
        
        console.log("✅ Script Ready:\n", reelData);
        
        // Audio wale function ko bulana
        const fullScript = `${reelData.hook} ${reelData.scriptBody} ${reelData.callToAction}`;
        const audioFilename = `reel_audio_${Date.now()}.mp3`; 
        
        const audioFilePath = await generateAudioFromText(fullScript, audioFilename);
        return { reelData, audioFilePath };

    } catch (error) {
        console.error("❌ Groq AI failed:", error.response ? error.response.data : error.message);
        // throw error;
    }
}

module.exports = { buildReelAssets };