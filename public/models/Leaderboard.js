const mongoose = require('mongoose');

module.exports = mongoose.model('Leaderboard', new mongoose.Schema({
  participantId: mongoose.Schema.Types.ObjectId,
  name: String,
  email: String,
  score: Number,
  timeTaken: Number,
  accuracy: Number,
  completedAt: { type: Date, default: Date.now }
}));
