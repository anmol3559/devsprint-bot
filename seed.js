// seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('./src/models/Post');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for Seeding...');

    const newPost = await Post.create({
      imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5',
      caption: 'Automated post queue testing from DevSprint backend! ⚡ #buildinpublic',
      scheduledFor: new Date(), // Abhi ke time ke hisaab se eligible
    });

    console.log('Pending post created in DB with ID:', newPost._id);
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err.message);
    process.exit(1);
  }
}

seed();