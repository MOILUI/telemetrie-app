'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function makeAuth({ jwtSecret }) {
  function signToken(payload) {
    return jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
  }

  function verifyToken(token) {
    try { return jwt.verify(token, jwtSecret); } catch (_) { return null; }
  }

  async function hashPassword(plain) {
    return bcrypt.hash(plain, 10);
  }

  async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  }

  // Middleware Express : exige un JWT valide. Attache req.user.
  function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const queryToken = req.query.token;
    const token = bearer || queryToken;
    if (!token) return res.status(401).json({ error: 'Auth requise' });
    const user = verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Token invalide' });
    req.user = user;
    next();
  }

  // Réservé au superadmin global
  function requireSuperadmin(req, res, next) {
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Réservé au superadmin' });
    }
    next();
  }

  return { signToken, verifyToken, hashPassword, verifyPassword, requireAuth, requireSuperadmin };
}

module.exports = { makeAuth };
