// src/models/Post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      default: null,
    },
    caption: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
    },
    instagramStatus: {
      type: String,
      enum: ['PENDING', 'PUBLISHED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    youtubeStatus: {
      type: String,
      enum: ['PENDING', 'PUBLISHED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    instagramPostId: {
      type: String,
      default: null,
    },
    youtubeVideoId: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: ['dsa', 'backend'],
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    title: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    videoPath: {
      type: String,
      default: null,
    },
    scheduledFor: {
      type: Date,
      default: Date.now,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    errorLog: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Post', postSchema);