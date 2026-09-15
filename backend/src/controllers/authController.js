const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { generateToken } = require('../middleware/auth');

const DUMMY_HASH = bcrypt.hashSync('timing-mitigation-dummy', 10);

async function register(req, res) {
  try {
    const { email, username, password } = req.body;
    if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Dados invalidos' });
    }
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Email invalido' });
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return res.status(400).json({ error: 'Nome de usuario deve ter entre 3 e 30 caracteres' });
    }
    if (password.length < 6 || password.length > 100) {
      return res.status(400).json({ error: 'Senha deve ter entre 6 e 100 caracteres' });
    }
    const existing = await prisma.user.findFirst({ where: { OR: [{ email: cleanEmail }, { username: cleanUsername }] } });
    if (existing) {
      if (existing.email === cleanEmail) return res.status(400).json({ error: 'Email ja esta em uso' });
      return res.status(400).json({ error: 'Nome de usuario ja esta em uso' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: cleanEmail, username: cleanUsername, passwordHash, role: 'PLAYER' },
      select: { id: true, email: true, username: true, role: true, createdAt: true, updatedAt: true },
    });
    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Dados invalidos' });
    }
    const user = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }
    const { passwordHash, ...userWithoutPassword } = user;
    const token = generateToken(user);
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
}

async function getMe(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, getMe };