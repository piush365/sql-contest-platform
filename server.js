// server.js - SQL Contest Platform (MongoDB Atlas, Render-safe)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================
   Middleware
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/* =========================
   MongoDB Connection
========================= */
mongoose.set('bufferCommands', false);

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sql_contest';

mongoose.connect(MONGO_URI);

mongoose.connection.once('open', () => {
  console.log('✅ MongoDB connected');
});

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB error:', err);
});

/* =========================
   Schemas & Models
========================= */
const ParticipantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const SessionSchema = new mongoose.Schema({
  participantId: mongoose.Schema.Types.ObjectId,
  sessionToken: { type: String, unique: true },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  totalScore: { type: Number, default: 0 },
  questionsCompleted: { type: Number, default: 0 },
  timeTaken: Number,
  accuracy: Number,
  status: { type: String, default: 'active' }
});

const AttemptSchema = new mongoose.Schema({
  sessionId: mongoose.Schema.Types.ObjectId,
  questionNumber: Number,
  query: String,
  isCorrect: Boolean,
  timeTaken: Number,
  submittedAt: { type: Date, default: Date.now }
});

const LeaderboardSchema = new mongoose.Schema({
  participantId: mongoose.Schema.Types.ObjectId,
  name: String,
  email: String,
  score: Number,
  timeTaken: Number,
  accuracy: Number,
  completedAt: { type: Date, default: Date.now }
});

const Participant = mongoose.model('Participant', ParticipantSchema);
const Session = mongoose.model('Session', SessionSchema);
const Attempt = mongoose.model('Attempt', AttemptSchema);
const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);

/* =========================
   Helpers
========================= */
function generateSessionToken() {
  return 'session_' + Date.now() + Math.random().toString(36).slice(2);
}

/* =========================
   API ROUTES
========================= */

/* Start Contest */
app.post('/api/contest/start', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    let participant = await Participant.findOne({ email });
    if (!participant) participant = await Participant.create({ name, email });

    const session = await Session.create({
      participantId: participant._id,
      sessionToken: generateSessionToken()
    });

    res.json({
      success: true,
      sessionToken: session.sessionToken,
      sessionId: session._id,
      participantId: participant._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start contest' });
  }
});

/* Submit Answer */
app.post('/api/contest/submit', async (req, res) => {
  try {
    const { sessionToken, questionNumber, query, isCorrect, timeTaken } = req.body;

    const session = await Session.findOne({ sessionToken, status: 'active' });
    if (!session) return res.status(404).json({ error: 'Invalid session' });

    const solved = await Attempt.findOne({
      sessionId: session._id,
      questionNumber,
      isCorrect: true
    });

    if (solved) return res.json({ success: true, alreadyCompleted: true });

    await Attempt.create({
      sessionId: session._id,
      questionNumber,
      query,
      isCorrect,
      timeTaken
    });

    if (isCorrect) {
      await Session.updateOne(
        { _id: session._id },
        { $inc: { totalScore: 10, questionsCompleted: 1 } }
      );
    }

    const updated = await Session.findById(session._id);

    res.json({
      success: true,
      score: updated.totalScore,
      questionsCompleted: updated.questionsCompleted
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submit failed' });
  }
});

/* Progress */
app.get('/api/contest/progress/:sessionToken', async (req, res) => {
  const session = await Session.findOne({ sessionToken: req.params.sessionToken });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const attempts = await Attempt.find({ sessionId: session._id });

  const accuracy = attempts.length
    ? ((attempts.filter(a => a.isCorrect).length / attempts.length) * 100).toFixed(1)
    : 0;

  res.json({
    success: true,
    session: { ...session.toObject(), accuracy },
    completedQuestions: attempts.filter(a => a.isCorrect).map(a => a.questionNumber)
  });
});

/* End Contest */
app.post('/api/contest/end', async (req, res) => {
  const { sessionToken, timeTaken, accuracy } = req.body;

  const session = await Session.findOne({ sessionToken });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const participant = await Participant.findById(session.participantId);

  await Session.updateOne(
    { _id: session._id },
    { status: 'completed', endTime: new Date(), timeTaken, accuracy }
  );

  await Leaderboard.create({
    participantId: participant._id,
    name: participant.name,
    email: participant.email,
    score: session.totalScore,
    timeTaken,
    accuracy
  });

  res.json({ success: true, finalScore: session.totalScore });
});

/* Leaderboard */
app.get('/api/leaderboard', async (req, res) => {
  const limit = Number(req.query.limit) || 10;

  const rows = await Leaderboard.find()
    .sort({ score: -1, timeTaken: 1 })
    .limit(limit);

  res.json({
    success: true,
    leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r.toObject() }))
  });
});

/* Live Stats */
app.get('/api/stats/live', async (req, res) => {
  const activeParticipants = await Session.countDocuments({ status: 'active' });
  const totalSessions = await Session.countDocuments();

  const avg = await Session.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, avgScore: { $avg: '$totalScore' } } }
  ]);

  res.json({
    success: true,
    stats: {
      activeParticipants,
      totalSessions,
      averageScore: avg[0]?.avgScore || 0
    }
  });
});

/* Health */
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

/* Start Server */
app.listen(PORT, () => {
  console.log(`🚀 SQL Contest Server running on http://localhost:${PORT}`);
});
