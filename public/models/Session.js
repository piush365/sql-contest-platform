const mongoose = require('mongoose');

module.exports = mongoose.model('Session', new mongoose.Schema({
  participantId: mongoose.Schema.Types.ObjectId,
  sessionToken: { type: String, unique: true },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  totalScore: { type: Number, default: 0 },
  questionsCompleted: { type: Number, default: 0 },
  timeTaken: Number,
  accuracy: Number,
  status: { type: String, default: 'active' }
}));
