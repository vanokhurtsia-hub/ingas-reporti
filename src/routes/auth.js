const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'შესვლა' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.flash('error', 'შეავსეთ ყველა ველი');
    return res.redirect('/auth/login');
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    req.flash('error', 'არასწორი ელ-ფოსტა ან პაროლი');
    return res.redirect('/auth/login');
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.role = user.role;
  res.redirect('/dashboard');
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'რეგისტრაცია' });
});

router.post('/register', (req, res) => {
  const { name, email, password, confirm_password } = req.body;

  if (!name || !email || !password || !confirm_password) {
    req.flash('error', 'შეავსეთ ყველა ველი');
    return res.redirect('/auth/register');
  }
  if (password !== confirm_password) {
    req.flash('error', 'პაროლები არ ემთხვევა');
    return res.redirect('/auth/register');
  }
  if (password.length < 6) {
    req.flash('error', 'პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს');
    return res.redirect('/auth/register');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    req.flash('error', 'ეს ელ-ფოსტა უკვე რეგისტრირებულია');
    return res.redirect('/auth/register');
  }

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  const hash = bcrypt.hashSync(password, 10);
  // First registered user becomes admin
  const role = userCount.c === 0 ? 'admin' : 'employee';

  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), email.trim().toLowerCase(), hash, role);

  req.session.userId = result.lastInsertRowid;
  req.session.userName = name.trim();
  req.session.role = role;
  req.flash('success', 'მოგესალმებით! გთხოვთ შეავსოთ პროფილი');
  res.redirect('/profile');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
