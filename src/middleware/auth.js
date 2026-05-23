function requireLogin(req, res, next) {
  if (!req.session.userId) {
    req.flash('error', 'გთხოვთ, ჯერ შეხვიდეთ სისტემაში');
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    req.flash('error', 'გთხოვთ, ჯერ შეხვიდეთ სისტემაში');
    return res.redirect('/auth/login');
  }
  if (req.session.role !== 'admin') {
    req.flash('error', 'წვდომა აკრძალულია');
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
