// server.js - Node.js Backend for SQL Contest Platform
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite Database
const db = new sqlite3.Database('./contest.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Create database tables
function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS contest_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id INTEGER,
            session_token TEXT UNIQUE,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            total_score INTEGER DEFAULT 0,
            questions_completed INTEGER DEFAULT 0,
            time_taken INTEGER,
            accuracy REAL,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (participant_id) REFERENCES participants(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS question_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            question_number INTEGER,
            query_submitted TEXT,
            is_correct BOOLEAN,
            attempts INTEGER DEFAULT 1,
            time_taken INTEGER,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES contest_sessions(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            participant_id INTEGER,
            session_id INTEGER,
            score INTEGER,
            time_taken INTEGER,
            accuracy REAL,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (participant_id) REFERENCES participants(id),
            FOREIGN KEY (session_id) REFERENCES contest_sessions(id)
        )
    `);

    console.log('Database tables initialized');
}

// Generate unique session token
function generateSessionToken() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// API Routes

// 1. Start Contest - Register participant and create session
app.post('/api/contest/start', (req, res) => {
    const { name, email } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    // Insert or get participant
    db.run(
        'INSERT OR IGNORE INTO participants (name, email) VALUES (?, ?)',
        [name, email],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            // Get participant ID
            db.get(
                'SELECT id FROM participants WHERE name = ? AND email = ?',
                [name, email],
                (err, participant) => {
                    if (err || !participant) {
                        return res.status(500).json({ error: 'Failed to create participant' });
                    }

                    // Create session
                    const sessionToken = generateSessionToken();
                    db.run(
                        'INSERT INTO contest_sessions (participant_id, session_token) VALUES (?, ?)',
                        [participant.id, sessionToken],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Failed to create session' });
                            }

                            res.json({
                                success: true,
                                sessionToken: sessionToken,
                                sessionId: this.lastID,
                                participantId: participant.id,
                                message: 'Contest started successfully'
                            });
                        }
                    );
                }
            );
        }
    );
});

// 2. Submit Answer
app.post('/api/contest/submit', (req, res) => {
    const { sessionToken, questionNumber, query, isCorrect, timeTaken } = req.body;

    if (!sessionToken || !questionNumber || !query) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get session
    db.get(
        'SELECT id, total_score, questions_completed FROM contest_sessions WHERE session_token = ? AND status = "active"',
        [sessionToken],
        (err, session) => {
            if (err || !session) {
                return res.status(404).json({ error: 'Invalid or expired session' });
            }

            // Check if question already answered correctly
            db.get(
                'SELECT id, is_correct FROM question_attempts WHERE session_id = ? AND question_number = ? AND is_correct = 1',
                [session.id, questionNumber],
                (err, existingAttempt) => {
                    if (existingAttempt) {
                        return res.json({
                            success: true,
                            message: 'Question already completed',
                            alreadyCompleted: true
                        });
                    }

                    // Insert attempt
                    db.run(
                        'INSERT INTO question_attempts (session_id, question_number, query_submitted, is_correct, time_taken) VALUES (?, ?, ?, ?, ?)',
                        [session.id, questionNumber, query, isCorrect ? 1 : 0, timeTaken],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: 'Failed to save attempt' });
                            }

                            // Update session if correct
                            if (isCorrect) {
                                const newScore = session.total_score + 10;
                                const newCompleted = session.questions_completed + 1;

                                db.run(
                                    'UPDATE contest_sessions SET total_score = ?, questions_completed = ? WHERE id = ?',
                                    [newScore, newCompleted, session.id],
                                    (err) => {
                                        if (err) {
                                            return res.status(500).json({ error: 'Failed to update session' });
                                        }

                                        res.json({
                                            success: true,
                                            message: 'Answer submitted successfully',
                                            score: newScore,
                                            questionsCompleted: newCompleted
                                        });
                                    }
                                );
                            } else {
                                res.json({
                                    success: true,
                                    message: 'Answer submitted',
                                    score: session.total_score,
                                    questionsCompleted: session.questions_completed
                                });
                            }
                        }
                    );
                }
            );
        }
    );
});

// 3. Get Session Progress
app.get('/api/contest/progress/:sessionToken', (req, res) => {
    const { sessionToken } = req.params;

    db.get(
        'SELECT * FROM contest_sessions WHERE session_token = ?',
        [sessionToken],
        (err, session) => {
            if (err || !session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            // Get all attempts for this session
            db.all(
                'SELECT * FROM question_attempts WHERE session_id = ? ORDER BY submitted_at DESC',
                [session.id],
                (err, attempts) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to fetch attempts' });
                    }

                    // Calculate accuracy
                    const totalAttempts = attempts.length;
                    const correctAttempts = attempts.filter(a => a.is_correct).length;
                    const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts * 100).toFixed(1) : 0;

                    res.json({
                        success: true,
                        session: {
                            ...session,
                            accuracy: accuracy
                        },
                        attempts: attempts,
                        completedQuestions: attempts
                            .filter(a => a.is_correct)
                            .map(a => a.question_number)
                    });
                }
            );
        }
    );
});

// 4. End Contest
app.post('/api/contest/end', (req, res) => {
    const { sessionToken, timeTaken, accuracy } = req.body;

    if (!sessionToken) {
        return res.status(400).json({ error: 'Session token required' });
    }

    db.get(
        'SELECT cs.*, p.id as participant_id FROM contest_sessions cs JOIN participants p ON cs.participant_id = p.id WHERE cs.session_token = ?',
        [sessionToken],
        (err, session) => {
            if (err || !session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            // Update session
            db.run(
                'UPDATE contest_sessions SET end_time = CURRENT_TIMESTAMP, time_taken = ?, accuracy = ?, status = "completed" WHERE session_token = ?',
                [timeTaken, accuracy, sessionToken],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to end contest' });
                    }

                    // Add to leaderboard
                    db.run(
                        'INSERT INTO leaderboard (participant_id, session_id, score, time_taken, accuracy) VALUES (?, ?, ?, ?, ?)',
                        [session.participant_id, session.id, session.total_score, timeTaken, accuracy],
                        (err) => {
                            if (err) {
                                console.error('Failed to add to leaderboard:', err);
                            }

                            res.json({
                                success: true,
                                message: 'Contest ended successfully',
                                finalScore: session.total_score
                            });
                        }
                    );
                }
            );
        }
    );
});

// 5. Get Leaderboard
app.get('/api/leaderboard', (req, res) => {
    const limit = req.query.limit || 10;

    db.all(
        `SELECT 
            l.score, 
            l.time_taken, 
            l.accuracy, 
            l.completed_at,
            p.name,
            p.email
         FROM leaderboard l
         JOIN participants p ON l.participant_id = p.id
         ORDER BY l.score DESC, l.time_taken ASC
         LIMIT ?`,
        [limit],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch leaderboard' });
            }

            res.json({
                success: true,
                leaderboard: rows.map((row, index) => ({
                    rank: index + 1,
                    ...row
                }))
            });
        }
    );
});

// 6. Get Live Stats (active participants)
app.get('/api/stats/live', (req, res) => {
    db.all(
        `SELECT COUNT(*) as active_participants FROM contest_sessions WHERE status = 'active'`,
        (err, activeResult) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch stats' });
            }

            db.all(
                `SELECT COUNT(*) as total_sessions FROM contest_sessions`,
                (err, totalResult) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to fetch stats' });
                    }

                    db.all(
                        `SELECT AVG(total_score) as avg_score FROM contest_sessions WHERE status = 'completed'`,
                        (err, avgResult) => {
                            if (err) {
                                return res.status(500).json({ error: 'Failed to fetch stats' });
                            }

                            res.json({
                                success: true,
                                stats: {
                                    activeParticipants: activeResult[0].active_participants,
                                    totalSessions: totalResult[0].total_sessions,
                                    averageScore: avgResult[0].avg_score || 0
                                }
                            });
                        }
                    );
                }
            );
        }
    );
});

// 7. Get Participant's Past Sessions
app.get('/api/participant/:email/sessions', (req, res) => {
    const { email } = req.params;

    db.all(
        `SELECT cs.* 
         FROM contest_sessions cs
         JOIN participants p ON cs.participant_id = p.id
         WHERE p.email = ?
         ORDER BY cs.start_time DESC`,
        [email],
        (err, sessions) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch sessions' });
            }

            res.json({
                success: true,
                sessions: sessions
            });
        }
    );
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SQL Contest Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: contest.db`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});