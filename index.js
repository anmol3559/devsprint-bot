// Entry point - unchanged
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { generateNextDailyPost } = require('./src/jobs/contentCreator');
const { startHermesAgent } = require('./src/agents/hermesAgent');
const Post = require('./src/models/Post');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple health check endpoint
app.get('/', (req, res) => {
  res.send('DevSprint AI Pipeline is running 24/7 🚀');
});

const startDevSprintEngine = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully.");

    // Hermes Agent - The autonomous brain of DevSprint AI
    startHermesAgent();

    // Initial queue check
    const pendingCount = await Post.countDocuments({ status: 'PENDING' });
    if (pendingCount === 0) {
      console.log("⚡ Queue is empty. Generating an initial post right away...");
      try {
        await generateNextDailyPost();
      } catch (genErr) {
        console.error("⚡ Initial post generation failed:", genErr.message);
      }
    } else {
      console.log(`ℹ️ Queue already has ${pendingCount} pending post(s).`);
    }

  } catch (err) {
    console.error("Engine failure:", err.message);
  }
};

app.listen(PORT, () => {
  console.log(`🌍 Server is listening on port ${PORT}`);
  startDevSprintEngine();
});