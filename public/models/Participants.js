const mongoose = require('mongoose');

module.exports = mongoose.model('Participant', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
}));
