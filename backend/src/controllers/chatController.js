const { prisma } = require('../config/database');
const { broadcastToTable, getIO } = require('../socket');

const MESSAGE_LIMIT = 100;

async function getMessages(req, res) {
  try {
    const { tableId } = req.params;
    const { before } = req.query;
    const where = {
      tableId,
      OR: [{ whisperTo: null }, { userId: req.user.id }, { whisperTo: req.user.id }],
    };
    if (before) {
      where.createdAt = { lt: new Date(before) };
    }
    const messages = await prisma.chatMessage.findMany({
      where,
      take: MESSAGE_LIMIT,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, userId: true, username: true, type: true,
        text: true, whisperTo: true, createdAt: true,
      },
    });
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
}

async function createMessage(req, res) {
  try {
    const { tableId } = req.params;
    const { type, text, whisperTo } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }
    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: req.user.id } },
      select: { role: true, muted: true },
    });
    const isMaster = membership && membership.role === 'MASTER';
    if (!isMaster && req.user.role !== 'ADMIN' && membership?.muted) {
      return res.status(403).json({ error: 'Voce foi silenciado pelo Mestre' });
    }
    const msgType = type || (isMaster ? 'master' : 'player');
    let finalText = text.trim();
    let whisperToId = whisperTo || null;
    if (finalText.startsWith('/w ')) {
      const parts = finalText.slice(3).split(' ');
      const targetName = parts[0];
      const msgContent = parts.slice(1).join(' ');
      if (!msgContent) {
        return res.status(400).json({ error: 'Formato: /w usuario mensagem' });
      }
      const targetUser = await prisma.user.findUnique({
        where: { username: targetName },
        select: { id: true },
      });
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuario nao encontrado' });
      }
      whisperToId = targetUser.id;
      finalText = msgContent;
    }
    if (finalText.startsWith('/r ')) {
      const rollExpr = finalText.slice(3).trim();
      const result = parseDiceRoll(rollExpr);
      const message = await prisma.chatMessage.create({
        data: {
          tableId,
          userId: req.user.id,
          username: req.user.username,
          type: 'dice',
          text: `${req.user.username} rolou ${rollExpr}: [${result.rolls.join(', ')}] = **${result.total}**`,
        },
        select: { id: true, userId: true, username: true, type: true, text: true, whisperTo: true, createdAt: true },
      });
      if (whisperToId) {
        getIO().to(`user:${req.user.id}`).to(`user:${whisperToId}`).emit('chat:whisper', { message, toUserId: req.user.id, fromUserId: whisperToId });
      } else {
        broadcastToTable(tableId, 'chat:message', { message });
      }
      return res.status(201).json(message);
    }
    if (finalText.startsWith('/narracao ')) {
      if (!isMaster && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas o mestre pode enviar narracoes' });
      }
      finalText = finalText.slice(10).trim();
      const message = await prisma.chatMessage.create({
        data: {
          tableId,
          userId: req.user.id,
          username: req.user.username,
          type: 'narrative',
          text: finalText,
        },
        select: { id: true, userId: true, username: true, type: true, text: true, whisperTo: true, createdAt: true },
      });
      broadcastToTable(tableId, 'chat:message', { message });
      return res.status(201).json(message);
    }
    const message = await prisma.chatMessage.create({
      data: {
        tableId,
        userId: req.user.id,
        username: req.user.username,
        type: msgType,
        text: finalText,
        whisperTo: whisperToId,
      },
      select: { id: true, userId: true, username: true, type: true, text: true, whisperTo: true, createdAt: true },
    });
    if (whisperToId) {
      getIO().to(`user:${req.user.id}`).to(`user:${whisperToId}`).emit('chat:whisper', { message, toUserId: req.user.id, fromUserId: whisperToId });
    } else {
      broadcastToTable(tableId, 'chat:message', { message });
    }
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
}

function parseDiceRoll(expr) {
  const clean = String(expr).toLowerCase().replace(/\s+/g, '');
  const tokenRe = /([+-]?)((\d*)d(\d+)(?:(kh|kl)(\d+))?|(\d+))/g;
  const parts = [];
  let total = 0;
  let matched = false;
  let m;
  while ((m = tokenRe.exec(clean)) !== null) {
    matched = true;
    const sign = m[1] === '-' ? -1 : 1;
    if (m[3] !== undefined) {
      const count = Math.max(1, Math.min(parseInt(m[3], 10) || 1, 100));
      const sides = Math.max(2, Math.min(parseInt(m[4], 10), 1000));
      const keepN = m[5] ? Math.max(1, Math.min(parseInt(m[6], 10) || 1, count)) : count;
      const dice = [];
      for (let i = 0; i < count; i++) dice.push(Math.floor(Math.random() * sides) + 1);
      const dropIdx = new Set();
      if (m[5]) {
        const order = dice.map((v, i) => [v, i]).sort((a, b) => (m[5] === 'kl' ? a[0] - b[0] : b[0] - a[0]));
        for (let i = keepN; i < order.length; i++) dropIdx.add(order[i][1]);
      }
      dice.forEach((v, i) => {
        if (dropIdx.has(i)) { parts.push(v + '\u2717'); return; }
        parts.push(String(v));
        total += sign * v;
      });
    } else {
      total += sign * parseInt(m[7], 10);
    }
  }
  if (!matched) {
    const num = parseInt(expr, 10);
    if (!isNaN(num)) return { rolls: [num], total: num };
    return { rolls: [1], total: 1 };
  }
  return { rolls: parts, total };
}

async function clearMessages(req, res) {
  try {
    const { tableId } = req.params;
    await prisma.chatMessage.deleteMany({ where: { tableId } });
    broadcastToTable(tableId, 'chat:cleared', {});
    res.json({ message: 'Historico de chat limpo' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao limpar chat' });
  }
}

module.exports = { getMessages, createMessage, clearMessages };