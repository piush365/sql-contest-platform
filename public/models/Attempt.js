const mongoose = require('mongoose');

module.exports = mongoose.model('Attempt', new mongoose.Schema({
  sessionId: mongoose.Schema.Types.ObjectId,
  questionNumber: Number,
  query: String,
  isCorrect: Boolean,
  timeTaken: Number,
  submittedAt: { type: Date, default: Date.now }
}));
