const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getMe);

router.get('/seed-admin', async (req, res) => {
  try {
    const existing = await prisma.user.findUnique({ where: { email: 'admin@rpgtable.com' } });
    if (existing) return res.json({ message: 'Admin ja existe' });
    const hash = await bcrypt.hash('admin123', 10);
    const user = await prisma.user.create({
      data: { email: 'admin@rpgtable.com', username: 'admin', passwordHash: hash, role: 'ADMIN' },
      select: { id: true, email: true, username: true, role: true },
    });
    res.json({ message: 'Admin criado', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
