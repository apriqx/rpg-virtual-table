const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

const DEFAULT_DATA = { hp: { current: 0, max: 0, temp: 0 }, stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, combat: { ac: 10, speed: 30, proficiency: 0 }, notes: '', custom: {} };

async function getCharacters(req, res) {
  try {
    const { tableId } = req.params;
    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: req.user.id } },
    });
    const isMaster = req.user.role === 'ADMIN' || membership?.role === 'MASTER';
    let where = { tableId };
    if (!isMaster) where.userId = req.user.id;
    const characters = await prisma.character.findMany({
      where,
      include: {
        user: { select: { id: true, username: true } },
        _count: { select: { tokens: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar fichas' });
  }
}

async function getCharacter(req, res) {
  try {
    const { characterId } = req.params;
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { user: { select: { id: true, username: true } } },
    });
    if (!character) return res.status(404).json({ error: 'Ficha nao encontrada' });
    res.json(character);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar ficha' });
  }
}

async function createCharacter(req, res) {
  try {
    const { tableId } = req.params;
    const { name, system, data } = req.body;
    const character = await prisma.character.create({
      data: {
        tableId,
        userId: req.user.id,
        name: name || 'Sem nome',
        system: system || 'custom',
        data: data || DEFAULT_DATA,
      },
      include: { user: { select: { id: true, username: true } } },
    });
    broadcastToTable(tableId, 'character:created', { character });
    res.status(201).json(character);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar ficha' });
  }
}

async function updateCharacter(req, res) {
  try {
    const { characterId, tableId } = req.params;
    const { name, system, data } = req.body;
    const existing = await prisma.character.findUnique({ where: { id: characterId } });
    if (!existing) return res.status(404).json({ error: 'Ficha nao encontrada' });
    let isMaster = req.user.role === 'ADMIN';
    if (!isMaster) {
      const membership = await prisma.tableMember.findUnique({
        where: { tableId_userId: { tableId, userId: req.user.id } },
      });
      isMaster = membership?.role === 'MASTER';
    }
    if (existing.userId !== req.user.id && !isMaster) {
      return res.status(403).json({ error: 'Sem permissao para editar esta ficha' });
    }
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (system !== undefined) updateData.system = system;
    if (data !== undefined) updateData.data = data;
    const character = await prisma.character.update({
      where: { id: characterId },
      data: updateData,
      include: { user: { select: { id: true, username: true } } },
    });
    broadcastToTable(tableId, 'character:updated', { character });
    res.json(character);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar ficha' });
  }
}

async function deleteCharacter(req, res) {
  try {
    const { characterId, tableId } = req.params;
    const existing = await prisma.character.findUnique({ where: { id: characterId } });
    if (!existing) return res.status(404).json({ error: 'Ficha nao encontrada' });
    let isMaster = req.user.role === 'ADMIN';
    if (!isMaster) {
      const membership = await prisma.tableMember.findUnique({
        where: { tableId_userId: { tableId, userId: req.user.id } },
      });
      isMaster = membership?.role === 'MASTER';
    }
    if (existing.userId !== req.user.id && !isMaster) {
      return res.status(403).json({ error: 'Sem permissao para excluir esta ficha' });
    }
    await prisma.character.delete({ where: { id: characterId } });
    broadcastToTable(tableId, 'character:deleted', { characterId });
    res.json({ message: 'Ficha excluida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir ficha' });
  }
}

module.exports = { getCharacters, getCharacter, createCharacter, updateCharacter, deleteCharacter };