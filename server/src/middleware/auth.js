import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = (header.startsWith('Bearer ') ? header.slice(7) : null) || req.query.token || null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: token tidak ditemukan' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change-me-in-production');
    req.user = { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: token tidak valid atau kedaluwarsa' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: hanya role ' + roles.join('/') });
    }
    return next();
  };
}
