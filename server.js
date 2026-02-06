// server.js - MongoDB Backend for SQL Contest Platform (Node 24+)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Middleware
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/* =========================
   MongoDB Connection
   (NO deprecated options)
========================= */
mongoose.connect('mongodb://127.0.0.1:27017/sql_contest');

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
   Helper
========================= */
function generateSessionToken() {
  return 'session_' + Date.now() + Math.random().toString(36).slice(2);
}

/* =========================
   API ROUTES
========================= */

/* 1️⃣ Start Contest */
app.post('/api/contest/start', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    let participant = await Participant.findOne({ email });
    if (!participant) {
      participant = await Participant.create({ name, email });
    }

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

/* 2️⃣ Submit Answer */
app.post('/api/contest/submit', async (req, res) => {
  try {
    const { sessionToken, questionNumber, query, isCorrect, timeTaken } = req.body;

    if (!sessionToken || !questionNumber || !query) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const session = await Session.findOne({ sessionToken, status: 'active' });
    if (!session) {
      return res.status(404).json({ error: 'Invalid or expired session' });
    }

    const alreadySolved = await Attempt.findOne({
      sessionId: session._id,
      questionNumber,
      isCorrect: true
    });

    if (alreadySolved) {
      return res.json({ success: true, alreadyCompleted: true });
    }

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
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

/* 3️⃣ Session Progress */
app.get('/api/contest/progress/:sessionToken', async (req, res) => {
  try {
    const session = await Session.findOne({ sessionToken: req.params.sessionToken });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const attempts = await Attempt.find({ sessionId: session._id });

    const accuracy = attempts.length
      ? ((attempts.filter(a => a.isCorrect).length / attempts.length) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      session: { ...session.toObject(), accuracy },
      completedQuestions: attempts
        .filter(a => a.isCorrect)
        .map(a => a.questionNumber)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

/* 4️⃣ End Contest */
app.post('/api/contest/end', async (req, res) => {
  try {
    const { sessionToken, timeTaken, accuracy } = req.body;

    const session = await Session.findOne({ sessionToken });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const participant = await Participant.findById(session.participantId);

    await Session.updateOne(
      { _id: session._id },
      {
        status: 'completed',
        endTime: new Date(),
        timeTaken,
        accuracy
      }
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to end contest' });
  }
});

/* 5️⃣ Leaderboard */
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const rows = await Leaderboard.find()
      .sort({ score: -1, timeTaken: 1 })
      .limit(limit);

    res.json({
      success: true,
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        ...r.toObject()
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/* 6️⃣ Live Stats */
app.get('/api/stats/live', async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/* 7️⃣ Participant Sessions */
app.get('/api/participant/:email/sessions', async (req, res) => {
  try {
    const participant = await Participant.findOne({ email: req.params.email });
    if (!participant) return res.json({ success: true, sessions: [] });

    const sessions = await Session.find({ participantId: participant._id })
      .sort({ startTime: -1 });

    res.json({ success: true, sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/* Health Check */
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

/* =========================
   Start Server
========================= */
app.listen(PORT, () => {
  console.log(`🚀 SQL Contest Server running on http://localhost:${PORT}`);
});
