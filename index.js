// index.js
require('dotenv').config();
const mongoose = require('mongoose');
const { startPostScheduler } = require('./src/jobs/postScheduler');
const { startDailyContentJob, generateNextDailyPost } = require('./src/jobs/contentCreator');

const startDevSprintEngine = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully.");

    // 1. Post Publishing Scheduler (Checks DB queue and publishes to Instagram)
    startPostScheduler();

    // 2. Daily Content Creation Cron Job (Generates new posts automatically)
    startDailyContentJob();

    // Agar queue mein koi pending post nahi hai toh start hote hi ek create kar lo
    const Post = require('./src/models/Post');
    const pendingCount = await Post.countDocuments({ status: 'PENDING' });
    
    if (pendingCount === 0) {
      console.log("⚡ Queue is empty. Generating an initial post right away...");
      await generateNextDailyPost();
    } else {
      console.log(`ℹ️ Queue already has ${pendingCount} pending post(s).`);
    }

  } catch (err) {
    console.error("Engine failure:", err.message);
  }
};

startDevSprintEngine();