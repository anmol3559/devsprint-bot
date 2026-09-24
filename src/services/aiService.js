// src/services/aiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// JSON mode enabled for strict, parseable outputs
const model = genAI.getGenerativeModel({ 
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
});

const generateAIContent = async (prompt) => {
    try {
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("AI Generation Failed:", error.message);
        throw error;
    }
};

module.exports = { generateAIContent };