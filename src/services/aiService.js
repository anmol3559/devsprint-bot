// src/services/aiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// JSON mode enabled for strict, parseable outputs
const model = genAI.getGenerativeModel({ 
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    generationConfig: { responseMimeType: "application/json" }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateAIContent = async (prompt, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            return JSON.parse(result.response.text());
        } catch (error) {
            const isRetryable = error.message?.includes('503') ||
                                error.message?.includes('429') ||
                                error.message?.includes('Service Unavailable') ||
                                error.message?.includes('quota');

            if (attempt < maxRetries && isRetryable) {
                const delay = Math.min(5000 * attempt, 15000); // 5s, 10s, 15s
                console.log(`[AI Service] Retryable error, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
                await sleep(delay);
                continue;
            }

            console.error("AI Generation Failed:", error.message);
            throw error;
        }
    }
};

module.exports = { generateAIContent };