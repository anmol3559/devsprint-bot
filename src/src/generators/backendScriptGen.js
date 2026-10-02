// src/generators/backendScriptGen.js
const { generateAIContent } = require('../services/aiService');

const generateBackendScript = async (concept, analogy) => {
    if (!concept || !analogy) {
        throw new Error("Missing concept or analogy.");
    }

    // Directing AI to return exact JSON keys for backend explanation
    const prompt = `
    Act as a Principal Systems Architect. Write content for a 60-second YouTube Short explaining the backend concept "${concept}" using the analogy of "${analogy}".
    Return ONLY a JSON object with these exact keys:
    - technicalDeepDive: A 2-sentence technical explanation of how ${concept} works under the hood, using proper engineering terminology.
    - useCase: A 1-sentence real-world example of a large tech company using this pattern and why.
    `;

    const aiData = await generateAIContent(prompt);

    return {
        title: `How ${concept} ACTUALLY Works 🤯 Explained in 60s | DevSprint`,
        description: `Ever wondered how ${concept} handles massive scale? We break it down using a simple real-world analogy. 💻⚡\n\n📌 Subscribe to @devsprint00 to master Full Stack Architecture!\n\n#backend #nodejs #systemdesign #softwaredeveloper #devsprint`,
        tags: ["Backend Development", "System Design", concept, "Web Architecture", "DevSprint"],
        videoScript: {
            hook: `(0-5s): "You use ${concept} every day, but do you actually know how it works under the hood?"`,
            analogyIntro: `(5-20s): "Think of it like ${analogy}. When a request comes in, it doesn't just wait in line."`,
            technicalDeepDive: `(20-40s): "${aiData.technicalDeepDive}"`,
            useCase: `(40-50s): "${aiData.useCase}"`,
            callToAction: `(50-60s): "Want to build scalable systems like this? Hit subscribe to DevSprint and check out my full architecture breakdowns!"`
        }
    };
};

module.exports = { generateBackendScript };