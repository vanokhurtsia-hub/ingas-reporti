const express = require('express');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Admin panel home
router.get('/', requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get();
  const totalQuestions = db.prepare('SELECT COUNT(*) as c FROM quiz_questions').get();
  const todayQuiz = db.prepare(`
    SELECT dq.*, qq.question_text FROM daily_quizzes dq
    JOIN quiz_questions qq ON qq.id = dq.question_id
    WHERE dq.quiz_date = ?
  `).get(today);
  const todayAnswers = todayQuiz
    ? db.prepare('SELECT COUNT(*) as c FROM quiz_answers WHERE daily_quiz_id = ?').get(todayQuiz.id)
    : { c: 0 };

  res.render('admin/panel', {
    title: 'ადმინ პანელი',
    totalUsers: totalUsers.c,
    totalQuestions: totalQuestions.c,
    todayQuiz,
    todayAnswers: todayAnswers.c,
    today,
  });
});

// List all quiz questions
router.get('/questions', requireAdmin, (req, res) => {
  const questions = db.prepare(`
    SELECT qq.*, u.name as creator_name,
      (SELECT COUNT(*) FROM quiz_options WHERE question_id = qq.id) as option_count
    FROM quiz_questions qq
    JOIN users u ON u.id = qq.created_by
    ORDER BY qq.created_at DESC
  `).all();

  res.render('admin/questions', { title: 'კითხვების მართვა', questions });
});

// Create question form
router.get('/questions/new', requireAdmin, (req, res) => {
  res.render('admin/question-form', { title: 'ახალი კითხვა', question: null, options: [] });
});

// Create question
router.post('/questions', requireAdmin, (req, res) => {
  const { question_text, options, correct_option } = req.body;

  if (!question_text || !options || options.filter(o => o.trim()).length < 2) {
    req.flash('error', 'კითხვა და მინიმუმ 2 პასუხი სავალდებულოა');
    return res.redirect('/admin/questions/new');
  }

  const correctIdx = parseInt(correct_option);
  const validOptions = options.filter(o => o.trim());

  const insertQ = db.prepare('INSERT INTO quiz_questions (question_text, created_by) VALUES (?, ?)');
  const insertO = db.prepare('INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES (?, ?, ?)');

  const run = db.transaction(() => {
    const q = insertQ.run(question_text.trim(), req.session.userId);
    for (let i = 0; i < validOptions.length; i++) {
      insertO.run(q.lastInsertRowid, validOptions[i].trim(), i === correctIdx ? 1 : 0);
    }
  });
  run();

  req.flash('success', 'კითხვა წარმატებით შეიქმნა!');
  res.redirect('/admin/questions');
});

// Edit question form
router.get('/questions/:id/edit', requireAdmin, (req, res) => {
  const question = db.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(req.params.id);
  if (!question) return res.redirect('/admin/questions');
  const options = db.prepare('SELECT * FROM quiz_options WHERE question_id = ?').all(question.id);
  res.render('admin/question-form', { title: 'კითხვის რედაქტირება', question, options });
});

// Update question
router.post('/questions/:id', requireAdmin, (req, res) => {
  const { question_text, options, correct_option } = req.body;
  const qId = req.params.id;

  const question = db.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(qId);
  if (!question) return res.redirect('/admin/questions');

  const validOptions = options.filter(o => o.trim());
  const correctIdx = parseInt(correct_option);

  const run = db.transaction(() => {
    db.prepare('UPDATE quiz_questions SET question_text = ? WHERE id = ?').run(question_text.trim(), qId);
    db.prepare('DELETE FROM quiz_options WHERE question_id = ?').run(qId);
    const insertO = db.prepare('INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES (?, ?, ?)');
    for (let i = 0; i < validOptions.length; i++) {
      insertO.run(qId, validOptions[i].trim(), i === correctIdx ? 1 : 0);
    }
  });
  run();

  req.flash('success', 'კითხვა განახლდა!');
  res.redirect('/admin/questions');
});

// Delete question
router.post('/questions/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM quiz_questions WHERE id = ?').run(req.params.id);
  req.flash('success', 'კითხვა წაიშალა');
  res.redirect('/admin/questions');
});

// Set daily quiz
router.get('/daily', requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const questions = db.prepare(`
    SELECT qq.* FROM quiz_questions qq
    ORDER BY qq.created_at DESC
  `).all();
  const current = db.prepare(`
    SELECT dq.*, qq.question_text FROM daily_quizzes dq
    JOIN quiz_questions qq ON qq.id = dq.question_id
    WHERE dq.quiz_date = ?
  `).get(today);

  res.render('admin/daily', { title: 'დღის კითხვა', questions, current, today });
});

router.post('/daily', requireAdmin, (req, res) => {
  const { question_id, quiz_date } = req.body;
  const date = quiz_date || new Date().toISOString().slice(0, 10);

  const existing = db.prepare('SELECT id FROM daily_quizzes WHERE quiz_date = ?').get(date);
  if (existing) {
    db.prepare('UPDATE daily_quizzes SET question_id = ? WHERE quiz_date = ?').run(question_id, date);
  } else {
    db.prepare('INSERT INTO daily_quizzes (question_id, quiz_date) VALUES (?, ?)').run(question_id, date);
  }

  req.flash('success', `${date} - ის კითხვა დაყენდა!`);
  res.redirect('/admin/daily');
});

// View results
router.get('/results', requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const dailyResults = db.prepare(`
    SELECT u.name, u.email, qa.is_correct, qo.option_text as chosen, qq.question_text
    FROM quiz_answers qa
    JOIN users u ON u.id = qa.user_id
    JOIN quiz_options qo ON qo.id = qa.selected_option_id
    JOIN daily_quizzes dq ON dq.id = qa.daily_quiz_id
    JOIN quiz_questions qq ON qq.id = dq.question_id
    WHERE dq.quiz_date = ?
    ORDER BY qa.is_correct DESC, qa.answered_at ASC
  `).all(today);

  const monthlyRanking = db.prepare(`
    SELECT u.name, u.email, SUM(qa.is_correct) as points, COUNT(qa.id) as answered
    FROM quiz_answers qa
    JOIN users u ON u.id = qa.user_id
    JOIN daily_quizzes dq ON dq.id = qa.daily_quiz_id
    WHERE dq.quiz_date >= ?
    GROUP BY u.id
    ORDER BY points DESC
  `).all(monthStart);

  const unansweredToday = db.prepare(`
    SELECT u.name, u.email FROM users u
    WHERE u.role = 'employee'
    AND u.id NOT IN (
      SELECT qa.user_id FROM quiz_answers qa
      JOIN daily_quizzes dq ON dq.id = qa.daily_quiz_id
      WHERE dq.quiz_date = ?
    )
  `).all(today);

  res.render('admin/results', {
    title: 'შედეგები',
    dailyResults,
    monthlyRanking,
    unansweredToday,
    today,
  });
});

// Manage users (promote to admin)
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at').all();
  res.render('admin/users', { title: 'მომხმარებლები', users });
});

router.post('/users/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'employee'].includes(role)) return res.redirect('/admin/users');
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  req.flash('success', 'როლი შეიცვალა');
  res.redirect('/admin/users');
});

// Profile questions management
router.get('/profile-questions', requireAdmin, (req, res) => {
  const questions = db.prepare('SELECT * FROM profile_questions ORDER BY order_num').all();
  const optionsMap = {};
  for (const q of questions) {
    optionsMap[q.id] = db.prepare('SELECT * FROM profile_options WHERE question_id = ?').all(q.id);
  }
  res.render('admin/profile-questions', { title: 'პროფილის კითხვები', questions, optionsMap });
});

router.post('/profile-questions', requireAdmin, (req, res) => {
  const { question_text, options } = req.body;
  const validOptions = options.filter(o => o.trim());
  if (!question_text || validOptions.length < 2) {
    req.flash('error', 'კითხვა და მინიმუმ 2 ვარიანტი სავალდებულოა');
    return res.redirect('/admin/profile-questions');
  }
  const maxOrder = db.prepare('SELECT MAX(order_num) as m FROM profile_questions').get();
  const run = db.transaction(() => {
    const q = db.prepare('INSERT INTO profile_questions (question_text, order_num) VALUES (?, ?)').run(question_text.trim(), (maxOrder.m || 0) + 1);
    for (const opt of validOptions) {
      db.prepare('INSERT INTO profile_options (question_id, option_text) VALUES (?, ?)').run(q.lastInsertRowid, opt.trim());
    }
  });
  run();
  req.flash('success', 'პროფილის კითხვა დაემატა!');
  res.redirect('/admin/profile-questions');
});

router.post('/profile-questions/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM profile_questions WHERE id = ?').run(req.params.id);
  req.flash('success', 'კითხვა წაიშალა');
  res.redirect('/admin/profile-questions');
});

module.exports = router;
