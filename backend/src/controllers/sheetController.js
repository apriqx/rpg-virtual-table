const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

async function isUserMaster(tableId, userId) {
  const m = await prisma.tableMember.findUnique({ where: { tableId_userId: { tableId, userId } } });
  return m && m.role === 'MASTER';
}

// Itens 22-24: jogador recebe apenas folhas visiveis e SEM o comentario privado
const PLAYER_SHEET_FIELDS = { id: true, tableId: true, title: true, imageUrl: true, comments: true, visibleToPlayers: true, createdAt: true, updatedAt: true };

function sanitizeTitle(t) { return String(t || '').trim().slice(0, 120) || 'Folha sem titulo'; }
function sanitizeText(t) { return typeof t === 'string' ? t.slice(0, 20000) : ''; }
function sanitizeImageUrl(u) {
  if (typeof u !== 'string' || !u.trim()) return null;
  const s = u.trim().slice(0, 500);
  return /^https?:\/\//i.test(s) ? s : null;
}

async function getSheets(req, res) {
  try {
    const { tableId } = req.params;
    const isMaster = req.user.role === 'ADMIN' || (await isUserMaster(tableId, req.user.id));
    const sheets = isMaster
      ? await prisma.sheet.findMany({ where: { tableId }, orderBy: { createdAt: 'asc' } })
      : await prisma.sheet.findMany({ where: { tableId, visibleToPlayers: true }, select: PLAYER_SHEET_FIELDS, orderBy: { createdAt: 'asc' } });
    res.json(sheets);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar folhas' });
  }
}

async function createSheet(req, res) {
  try {
    const { tableId } = req.params;
    const { title, imageUrl, comments, masterNotes, visibleToPlayers } = req.body;
    const sheet = await prisma.sheet.create({
      data: {
        tableId,
        title: sanitizeTitle(title),
        imageUrl: sanitizeImageUrl(imageUrl),
        comments: sanitizeText(comments),
        masterNotes: sanitizeText(masterNotes),
        visibleToPlayers: visibleToPlayers === true,
      },
    });
    broadcastToTable(tableId, 'sheets:changed', { tableId });
    res.status(201).json(sheet);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar folha' });
  }
}

async function updateSheet(req, res) {
  try {
    const { sheetId, tableId } = req.params;
    const existing = await prisma.sheet.findUnique({ where: { id: sheetId } });
    if (!existing || existing.tableId !== tableId) return res.status(404).json({ error: 'Folha nao encontrada' });
    const { title, imageUrl, comments, masterNotes, visibleToPlayers } = req.body;
    const data = {};
    if (title !== undefined) data.title = sanitizeTitle(title);
    if (imageUrl !== undefined) data.imageUrl = sanitizeImageUrl(imageUrl);
    if (comments !== undefined) data.comments = sanitizeText(comments);
    if (masterNotes !== undefined) data.masterNotes = sanitizeText(masterNotes);
    if (visibleToPlayers !== undefined) data.visibleToPlayers = visibleToPlayers === true;
    const sheet = await prisma.sheet.update({ where: { id: sheetId }, data });
    broadcastToTable(tableId, 'sheets:changed', { tableId });
    res.json(sheet);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar folha' });
  }
}

async function deleteSheet(req, res) {
  try {
    const { sheetId, tableId } = req.params;
    const existing = await prisma.sheet.findUnique({ where: { id: sheetId } });
    if (!existing || existing.tableId !== tableId) return res.status(404).json({ error: 'Folha nao encontrada' });
    await prisma.sheet.delete({ where: { id: sheetId } });
    broadcastToTable(tableId, 'sheets:changed', { tableId });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir folha' });
  }
}

module.exports = { getSheets, createSheet, updateSheet, deleteSheet };
