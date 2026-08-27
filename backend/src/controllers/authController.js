const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { generateToken } = require('../middleware/auth');

async function register(req, res) {
  try {
    const { email, username, password } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      if (existing.email === email) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      return res.status(400).json({ error: 'Username already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, username, passwordHash, role: 'PLAYER' },
      select: { id: true, email: true, username: true, role: true, createdAt: true, updatedAt: true },
    });

    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { passwordHash, ...userWithoutPassword } = user;
    const token = generateToken(user);
    res.status(200).json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
}

async function getMe(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, getMe };