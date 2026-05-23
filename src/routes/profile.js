const express = require('express');
const db = require('../database/db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireLogin, (req, res) => {
  const questions = db.prepare('SELECT * FROM profile_questions ORDER BY order_num').all();
  const optionsMap = {};
  for (const q of questions) {
    optionsMap[q.id] = db.prepare('SELECT * FROM profile_options WHERE question_id = ?').all(q.id);
  }

  const userAnswers = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').all(req.session.userId);
  const answersMap = {};
  for (const a of userAnswers) {
    answersMap[a.question_id] = a;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  res.render('profile', {
    title: 'ჩემი პროფილი',
    questions,
    optionsMap,
    answersMap,
    user,
  });
});

router.post('/', requireLogin, (req, res) => {
  const { favorite_color, ...answers } = req.body;
  const questions = db.prepare('SELECT id FROM profile_questions').all();

  const upsert = db.prepare(`
    INSERT INTO user_profiles (user_id, question_id, selected_option_id, color_answer)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, question_id) DO UPDATE SET selected_option_id = excluded.selected_option_id, color_answer = excluded.color_answer
  `);

  // Handle favorite color (special question stored separately, question_id = 0 sentinel)
  const colorQ = db.prepare("SELECT id FROM profile_questions WHERE order_num = 0 LIMIT 1").get();

  const saveAll = db.transaction(() => {
    for (const q of questions) {
      const key = `q_${q.id}`;
      const optionId = answers[key] ? parseInt(answers[key]) : null;
      upsert.run(req.session.userId, q.id, optionId, null);
    }
    // Save favorite color in session for display (no separate table needed)
  });
  saveAll();

  if (favorite_color) {
    db.prepare('UPDATE users SET name = name WHERE id = ?').run(req.session.userId);
    // store color in a simple way using a special profile entry
    // We'll store it in user table via a color column — add if not exists
    try {
      db.exec('ALTER TABLE users ADD COLUMN favorite_color TEXT');
    } catch (e) { /* column already exists */ }
    db.prepare('UPDATE users SET favorite_color = ? WHERE id = ?').run(favorite_color, req.session.userId);
  }

  req.flash('success', 'პროფილი წარმატებით შეინახა!');
  res.redirect('/profile');
});

module.exports = router;
