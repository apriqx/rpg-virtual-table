require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { prisma, connectDatabase } = require('./config/database');
const { uploadDir } = require('./utils/upload');
const { initSocket } = require('./socket');

const authRoutes = require('./routes/auth');
const tableRoutes = require('./routes/tables');
const mapRoutes = require('./routes/maps');
const tokenRoutes = require('./routes/tokens');
const gridRoutes = require('./routes/grid');
const fogRoutes = require('./routes/fog');
const chatRoutes = require('./routes/chat');
const characterRoutes = require('./routes/characters');
const drawingRoutes = require('./routes/drawings');
const annotationRoutes = require('./routes/annotations');
const uploadRoutes = require('./routes/uploads');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

initSocket(server);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: 'draft-7', legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/tables', mapRoutes);
app.use('/api/tables', tokenRoutes);
app.use('/api/tables', gridRoutes);
app.use('/api/tables', fogRoutes);
app.use('/api/tables', chatRoutes);
app.use('/api/tables', characterRoutes);
app.use('/api/tables', drawingRoutes);
app.use('/api/tables', annotationRoutes);
app.use('/api/uploads', uploadRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Arquivo muito grande (maximo 50MB)' });
    return res.status(400).json({ error: 'Erro no upload: ' + err.message });
  }
  if (err.message && (err.message.includes('permitidos') || err.message.includes('Apenas'))) return res.status(400).json({ error: err.message });
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET nao definido. Configure a variavel de ambiente ou o arquivo .env antes de iniciar.');
    process.exit(1);
  }
  await connectDatabase();
  server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
}

start().catch((err) => { console.error('Failed to start server:', err); process.exit(1); });

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });