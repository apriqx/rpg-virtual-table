require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { prisma, connectDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const tableRoutes = require('./routes/tables');
const mapRoutes = require('./routes/maps');
const tokenRoutes = require('./routes/tokens');
const gridRoutes = require('./routes/grid');
const fogRoutes = require('./routes/fog');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/tables', mapRoutes);
app.use('/api/tables', tokenRoutes);
app.use('/api/tables', gridRoutes);
app.use('/api/tables', fogRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});