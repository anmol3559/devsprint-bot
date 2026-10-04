// testTTS.js
const { buildReelAssets } = require('./src/services/reelsAgent');

console.log("🚀 Starting the Reel Generation Test...");

buildReelAssets("Node.js Event Loop")
    .then((result) => {
        console.log("🎉 Test Successful! Yahan dekh tera data:");
        console.log(result);
    })
    .catch((error) => {
        console.error("❌ Test Failed:", error);
    });