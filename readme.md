# SQL Contest Platform - Multi-User Edition

A professional, real-time SQL contest platform with backend server, database, and live leaderboard.

## 🌟 Features

### Multi-User Capabilities
- ✅ **Real-time Leaderboard** - See rankings update live
- ✅ **Session Management** - Unique session for each participant
- ✅ **Progress Tracking** - Save and resume contests
- ✅ **Live Statistics** - Active participants count and platform stats
- ✅ **Database Storage** - All data persisted in SQLite
- ✅ **REST API** - Clean API for scalability

### Contest Features
- 6 SQL Questions (CREATE, SELECT, AGGREGATE, GROUP BY, SUBQUERY, VIEW)
- 45-minute timer
- Automatic scoring (10 points per question)
- Accuracy tracking
- Real-time validation
- Live leaderboard with rankings

## 📁 Project Structure

```
sql-contest-platform/
├── server.js           # Node.js Express backend
├── package.json        # Dependencies
├── contest.db          # SQLite database (auto-created)
├── public/
│   └── index.html      # Frontend application
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Install Dependencies**
```bash
npm install
```

2. **Start the Server**
```bash
npm start
```

3. **Open in Browser**
```
http://localhost:3000
```

The server will automatically:
- Create the SQLite database
- Initialize all required tables
- Start listening on port 3000

## 🔧 Development Mode

For auto-restart on file changes:
```bash
npm run dev
```

## 📊 Database Schema

### Tables

#### `participants`
- `id` - Auto-increment primary key
- `name` - Participant's full name
- `email` - Unique email address
- `created_at` - Registration timestamp

#### `contest_sessions`
- `id` - Session ID
- `participant_id` - Foreign key to participants
- `session_token` - Unique session identifier
- `start_time` - When contest started
- `end_time` - When contest ended
- `total_score` - Current score (0-60)
- `questions_completed` - Number completed (0-6)
- `time_taken` - Total time in milliseconds
- `accuracy` - Percentage accuracy
- `status` - 'active' or 'completed'

#### `question_attempts`
- `id` - Attempt ID
- `session_id` - Foreign key to sessions
- `question_number` - Question 1-6
- `query_submitted` - SQL query text
- `is_correct` - Boolean
- `attempts` - Number of attempts
- `time_taken` - Time for this question
- `submitted_at` - Submission timestamp

#### `leaderboard`
- `id` - Entry ID
- `participant_id` - Foreign key
- `session_id` - Foreign key
- `score` - Final score
- `time_taken` - Total time
- `accuracy` - Final accuracy
- `completed_at` - Completion timestamp

## 🔌 API Endpoints

### Start Contest
```http
POST /api/contest/start
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

Response:
{
  "success": true,
  "sessionToken": "session_1234567890_abc123",
  "sessionId": 1,
  "participantId": 1
}
```

### Submit Answer
```http
POST /api/contest/submit
Content-Type: application/json

{
  "sessionToken": "session_1234567890_abc123",
  "questionNumber": 1,
  "query": "CREATE TABLE students...",
  "isCorrect": true,
  "timeTaken": 45000
}

Response:
{
  "success": true,
  "message": "Answer submitted successfully",
  "score": 10,
  "questionsCompleted": 1
}
```

### Get Progress
```http
GET /api/contest/progress/:sessionToken

Response:
{
  "success": true,
  "session": {
    "id": 1,
    "total_score": 30,
    "questions_completed": 3,
    "accuracy": "75.0"
  },
  "attempts": [...],
  "completedQuestions": [1, 2, 3]
}
```

### End Contest
```http
POST /api/contest/end
Content-Type: application/json

{
  "sessionToken": "session_1234567890_abc123",
  "timeTaken": 1800000,
  "accuracy": 83.3
}
```

### Get Leaderboard
```http
GET /api/leaderboard?limit=10

Response:
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "name": "John Doe",
      "score": 60,
      "time_taken": 1200000,
      "accuracy": 100
    },
    ...
  ]
}
```

### Get Live Stats
```http
GET /api/stats/live

Response:
{
  "success": true,
  "stats": {
    "activeParticipants": 5,
    "totalSessions": 42,
    "averageScore": 45.5
  }
}
```

## 🌐 Deployment Options

### Option 1: Traditional VPS (DigitalOcean, Linode, AWS EC2)

1. **Upload files to server**
```bash
scp -r * user@your-server.com:/var/www/sql-contest/
```

2. **SSH into server**
```bash
ssh user@your-server.com
cd /var/www/sql-contest
```

3. **Install dependencies and start**
```bash
npm install
npm start
```

4. **Use PM2 for process management** (recommended)
```bash
npm install -g pm2
pm2 start server.js --name "sql-contest"
pm2 save
pm2 startup
```

### Option 2: Heroku

1. **Create Heroku app**
```bash
heroku create sql-contest-platform
```

2. **Add Procfile**
```
web: node server.js
```

3. **Deploy**
```bash
git push heroku main
```

### Option 3: Railway / Render

1. Connect your GitHub repository
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Deploy!

### Option 4: Docker

1. **Create Dockerfile**
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

2. **Build and run**
```bash
docker build -t sql-contest .
docker run -p 3000:3000 sql-contest
```

## 🔒 Production Considerations

### Security
- Add environment variables for sensitive config
- Implement rate limiting
- Add input sanitization
- Use HTTPS
- Add authentication/authorization if needed

### Performance
- Add Redis for caching leaderboard
- Use connection pooling for database
- Implement CDN for static assets
- Add database indexes

### Monitoring
- Add error logging (Winston, Bunyan)
- Implement APM (New Relic, Datadog)
- Set up uptime monitoring

## 📝 Environment Variables

Create a `.env` file:
```env
PORT=3000
NODE_ENV=production
DATABASE_PATH=./contest.db
CORS_ORIGIN=https://your-domain.com
```

## 🧪 Testing

The platform includes automatic validation for all questions. Each query is checked for:
- Required SQL keywords
- Proper syntax structure
- Constraint definitions
- Aggregate functions
- Subquery structure
- View creation

## 🎯 Customization

### Add More Questions
Edit the `questions` array in `public/index.html` and add validation logic in `validateQuery()`.

### Change Time Limit
Modify `timeRemaining` variable (in seconds).

### Adjust Scoring
Change the points per question in the submit logic.

### Custom Styling
Update the CSS in `<style>` section of `index.html`.

## 📊 Analytics

The platform tracks:
- Total participants
- Average completion time
- Question difficulty (by success rate)
- Peak usage times
- Most common errors

Query the database directly for detailed analytics:
```sql
-- Average score by question
SELECT question_number, 
       AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) * 100 as success_rate
FROM question_attempts
GROUP BY question_number;

-- Top performers
SELECT p.name, l.score, l.time_taken
FROM leaderboard l
JOIN participants p ON l.participant_id = p.id
ORDER BY l.score DESC, l.time_taken ASC
LIMIT 10;
```

## 🐛 Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Ensure Node.js is installed: `node --version`
- Delete `node_modules` and run `npm install` again

### Database errors
- Delete `contest.db` to reset (will lose all data)
- Check file permissions
- Ensure SQLite3 is properly installed

### Frontend can't connect
- Verify server is running on port 3000
- Check browser console for CORS errors
- Update `API_BASE_URL` if server is on different port/domain

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for SQL education and assessment