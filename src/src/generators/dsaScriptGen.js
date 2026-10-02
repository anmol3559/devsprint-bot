// src/generators/dsaScriptGen.js
const { generateAIContent } = require('../services/aiService');

const generateDSAScript = async (problemName, difficulty, topic) => {
    if (!problemName || !difficulty || !topic) {
        throw new Error("Missing required parameters.");
    }

    // Directing AI to return exact JSON keys
    const prompt = `
    Act as an expert C++ competitive programmer. Write content for a 60-second YouTube Short explaining the problem "${problemName}" (Topic: ${topic}).
    Return ONLY a JSON object with these exact keys:
    - problemStatement: A 1-sentence simple explanation of the problem goal.
    - logicBreakdown: A 2-sentence explanation of the optimal algorithm and its time complexity.
    - codeVisual: A short, extremely clean C++ code snippet showing just the core logic function.
    `;

    const aiData = await generateAIContent(prompt);

    return {
        title: `Crack ${problemName} in 60 Seconds! 🚀 C++ ${topic} | DevSprint`,
        description: `Struggling with ${problemName}? Here is the optimal C++ solution explained in under a minute! 👇\n\n📌 Subscribe to @devsprint00 for daily coding concepts & backend architectures!\n\n#cpp #datastructures #leetcode #coding #softwareengineering`,
        tags: ["C++", "DSA", "LeetCode", problemName, "Coding Interview", "DevSprint"],
        videoScript: {
            hook: `(0-5s): "Stop skipping ${topic} problems! Let's crack ${problemName} in exactly 60 seconds."`,
            problemStatement: `(5-15s): "${aiData.problemStatement}"`,
            logicBreakdown: `(15-35s): "${aiData.logicBreakdown}"`,
            codeVisual: `(35-50s): "[Show this C++ code on screen]:\n${aiData.codeVisual}"`,
            callToAction: `(50-60s): "Drop a 🔥 in the comments if you understood this, and subscribe to DevSprint!"`
        }
    };
};

module.exports = { generateDSAScript };