const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token nao fornecido'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, username: true, role: true },
      });
      if (!user) return next(new Error('Usuario nao encontrado'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Token invalido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket conectado: ${socket.user.username} (${socket.user.id})`);
    socket.join(`user:${socket.user.id}`);

    socket.on('join:table', async (tableId) => {
      const membership = await prisma.tableMember.findUnique({
        where: { tableId_userId: { tableId, userId: socket.user.id } },
      });
      if (!membership && socket.user.role !== 'ADMIN') return;
      socket.join(`table:${tableId}`);
      socket.currentTable = tableId;
      const online = Array.from(io.sockets.adapter.rooms.get(`table:${tableId}`) || [])
        .filter((id) => id !== socket.id)
        .map((id) => {
          const s = io.sockets.sockets.get(id);
          return s?.user ? { userId: s.user.id, username: s.user.username } : null;
        })
        .filter(Boolean);
      socket.emit('online:users', online);
      socket.to(`table:${tableId}`).emit('user:joined', {
        userId: socket.user.id, username: socket.user.username,
      });
      const sysMsg = await prisma.chatMessage.create({
        data: { tableId, userId: socket.user.id, username: socket.user.username, type: 'system', text: `${socket.user.username} entrou na mesa` },
        select: { id: true, userId: true, username: true, type: true, text: true, whisperTo: true, createdAt: true },
      });
      socket.to(`table:${tableId}`).emit('chat:message', { message: sysMsg });
    });

    socket.on('leave:table', async (tableId) => {
      socket.leave(`table:${tableId}`);
      socket.to(`table:${tableId}`).emit('user:left', { userId: socket.user.id, username: socket.user.username });
      const sysMsg = await prisma.chatMessage.create({
        data: { tableId, userId: socket.user.id, username: socket.user.username, type: 'system', text: `${socket.user.username} saiu da mesa` },
        select: { id: true, userId: true, username: true, type: true, text: true, whisperTo: true, createdAt: true },
      });
      socket.to(`table:${tableId}`).emit('chat:message', { message: sysMsg });
      socket.currentTable = null;
    });

    socket.on('initiative:update', (tableId, data) => {
      socket.to(`table:${tableId}`).emit('initiative:updated', data);
    });

    socket.on('sound:play', (tableId, name) => {
      if (socket.currentTable !== tableId) return;
      if (typeof name !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(name)) return;
      socket.to(`table:${tableId}`).emit('sound:play', { name });
    });

    socket.on('disconnect', async () => {
      if (socket.currentTable) {
        socket.to(`table:${socket.currentTable}`).emit('user:left', { userId: socket.user.id, username: socket.user.username });
        try {
          const sysMsg = await prisma.chatMessage.create({
            data: { tableId: socket.currentTable, userId: socket.user.id, username: socket.user.username, type: 'system', text: `${socket.user.username} desconectou` },
            select: { id: true, userId: true, username: true, type: true, text: true, whisperTo: true, createdAt: true },
          });
          io.to(`table:${socket.currentTable}`).emit('chat:message', { message: sysMsg });
        } catch (e) {}
      }
      console.log(`Socket desconectado: ${socket.user.username}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io nao foi inicializado');
  return io;
}

function broadcastToTable(tableId, event, data) {
  if (!io) return;
  io.to(`table:${tableId}`).emit(event, data);
}

module.exports = { initSocket, getIO, broadcastToTable };