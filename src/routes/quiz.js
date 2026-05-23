const express = require('express');
const db = require('../database/db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.post('/answer', requireLogin, (req, res) => {
  const { daily_quiz_id, option_id } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  const daily = db.prepare('SELECT * FROM daily_quizzes WHERE id = ? AND quiz_date = ?').get(daily_quiz_id, today);
  if (!daily) {
    req.flash('error', 'ვიქტორინა ვერ მოიძებნა');
    return res.redirect('/dashboard');
  }

  const alreadyAnswered = db.prepare('SELECT id FROM quiz_answers WHERE user_id = ? AND daily_quiz_id = ?').get(req.session.userId, daily_quiz_id);
  if (alreadyAnswered) {
    req.flash('error', 'თქვენ უკვე უპასუხეთ დღევანდელ კითხვას');
    return res.redirect('/dashboard');
  }

  const option = db.prepare('SELECT * FROM quiz_options WHERE id = ? AND question_id = ?').get(option_id, daily.question_id);
  if (!option) {
    req.flash('error', 'არასწორი პასუხი');
    return res.redirect('/dashboard');
  }

  db.prepare('INSERT INTO quiz_answers (user_id, daily_quiz_id, selected_option_id, is_correct) VALUES (?, ?, ?, ?)').run(
    req.session.userId, daily_quiz_id, option_id, option.is_correct
  );

  if (option.is_correct) {
    req.flash('success', '🎉 სწორია! +1 ქულა');
  } else {
    req.flash('error', '❌ სამწუხაროდ, არასწორი პასუხი');
  }
  res.redirect('/dashboard');
});

module.exports = router;
