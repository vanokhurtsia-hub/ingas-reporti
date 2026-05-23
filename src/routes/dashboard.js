const express = require('express');
const db = require('../database/db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireLogin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const daily = db.prepare(`
    SELECT dq.id as daily_id, qq.question_text, dq.quiz_date
    FROM daily_quizzes dq
    JOIN quiz_questions qq ON qq.id = dq.question_id
    WHERE dq.quiz_date = ?
  `).get(today);

  let options = [];
  let userAnswer = null;
  let todayStats = null;

  if (daily) {
    options = db.prepare('SELECT * FROM quiz_options WHERE question_id = (SELECT question_id FROM daily_quizzes WHERE id = ?)').all(daily.daily_id);
    userAnswer = db.prepare('SELECT qa.*, qo.option_text, qo.is_correct FROM quiz_answers qa JOIN quiz_options qo ON qo.id = qa.selected_option_id WHERE qa.user_id = ? AND qa.daily_quiz_id = ?').get(req.session.userId, daily.daily_id);

    const totalAnswered = db.prepare('SELECT COUNT(*) as c FROM quiz_answers WHERE daily_quiz_id = ?').get(daily.daily_id);
    const correctAnswered = db.prepare('SELECT COUNT(*) as c FROM quiz_answers WHERE daily_quiz_id = ? AND is_correct = 1').get(daily.daily_id);
    todayStats = { total: totalAnswered.c, correct: correctAnswered.c };
  }

  // Daily leaderboard
  const dailyLeaderboard = db.prepare(`
    SELECT u.name, SUM(qa.is_correct) as points
    FROM quiz_answers qa
    JOIN users u ON u.id = qa.user_id
    JOIN daily_quizzes dq ON dq.id = qa.daily_quiz_id
    WHERE dq.quiz_date = ?
    GROUP BY u.id
    ORDER BY points DESC
    LIMIT 10
  `).all(today);

  // Monthly leaderboard
  const monthStart = today.slice(0, 7) + '-01';
  const monthlyLeaderboard = db.prepare(`
    SELECT u.name, SUM(qa.is_correct) as points
    FROM quiz_answers qa
    JOIN users u ON u.id = qa.user_id
    JOIN daily_quizzes dq ON dq.id = qa.daily_quiz_id
    WHERE dq.quiz_date >= ?
    GROUP BY u.id
    ORDER BY points DESC
    LIMIT 10
  `).all(monthStart);

  // User's monthly score
  const myMonthlyScore = db.prepare(`
    SELECT SUM(qa.is_correct) as points
    FROM quiz_answers qa
    JOIN daily_quizzes dq ON dq.id = qa.daily_quiz_id
    WHERE qa.user_id = ? AND dq.quiz_date >= ?
  `).get(req.session.userId, monthStart);

  res.render('dashboard', {
    title: 'მთავარი',
    daily,
    options,
    userAnswer,
    todayStats,
    dailyLeaderboard,
    monthlyLeaderboard,
    myMonthlyScore: myMonthlyScore?.points || 0,
    today,
  });
});

module.exports = router;
