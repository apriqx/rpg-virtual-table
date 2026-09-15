const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Token nao fornecido' });
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, email: true, username: true, role: true } });
    if (!user) return res.status(401).json({ error: 'Usuario nao encontrado' });
    req.user = user;
    next();
  } catch (error) { return res.status(401).json({ error: 'Token invalido' }); }
}

module.exports = auth;
module.exports.generateToken = generateToken;