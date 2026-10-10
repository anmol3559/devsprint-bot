// Entry point - DevSprint AI Pipeline
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { startHermesAgent } = require('./src/agents/hermesAgent');
const Post = require('./src/models/Post');
const { generatePreview } = require('./src/services/previewService');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || process.env.RENDER_PORT || 10000;

// Parse JSON bodies
app.use(express.json());

// Health check endpoints
app.get('/', (req, res) => {
  res.send('DevSprint AI Pipeline is running 24/7 🚀');
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'devsprint-backend' });
});

// Preview endpoint - generate content without posting (Instagram image only)
app.get('/preview', async (req, res) => {
  try {
    const topic = req.query.topic || null;
    logger.info('[Preview API] Preview requested', { topic: req.query.topic || 'random' });

    const preview = await generatePreview(topic);

    res.json({
      success: true,
      topic: preview.topic,
      title: preview.title,
      imageUrl: preview.imageUrl,
      codeSnippet: preview.codeSnippet,
      latencyMs: preview.latencyMs,
      errorLog: preview.errorLog,
    });
  } catch (err) {
    logger.error('[Preview API] Failed', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

const startDevSprintEngine = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully.");

    // Hermes Agent handles ALL content generation, retry, and publishing
    startHermesAgent();

    // Log initial queue state
    const pendingCount = await Post.countDocuments({ status: 'PENDING' });
    console.log(`ℹ️ Initial queue check: ${pendingCount} pending post(s). Hermes will auto-generate if empty.`);

  } catch (err) {
    console.error("Engine failure:", err.message);
    // Keep server running even if DB fails, so health check still responds
    app.get('/health', (req, res) => {
      res.status(503).json({ status: 'unhealthy', error: err.message });
    });
  }
};

app.listen(PORT, () => {
  console.log(`🌍 Server is listening on port ${PORT}`);
  startDevSprintEngine();
});