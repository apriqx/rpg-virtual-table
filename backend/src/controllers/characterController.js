const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

const DEFAULT_DATA = { hp: { current: 0, max: 0, temp: 0 }, stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, combat: { ac: 10, speed: 30, proficiency: 0 }, notes: '', custom: {} };
const KINDS = ['pc', 'npc', 'monster'];

async function isUserMaster(tableId, userId) {
  if (!userId) return false;
  const membership = await prisma.tableMember.findUnique({
    where: { tableId_userId: { tableId, userId } },
    select: { role: true },
  });
  return membership?.role === 'MASTER';
}

const CHAR_INCLUDE = {
  user: { select: { id: true, username: true } },
  permissions: true,
  _count: { select: { tokens: true } },
};

async function getCharacters(req, res) {
  try {
    const { tableId } = req.params;
    const isMaster = req.user.role === 'ADMIN' || (await isUserMaster(tableId, req.user.id));
    const where = isMaster ? { tableId } : {
      tableId,
      OR: [
        { userId: req.user.id },
        { permissions: { some: { userId: req.user.id, canView: true } } },
      ],
    };
    const characters = await prisma.character.findMany({ where, include: CHAR_INCLUDE, orderBy: { createdAt: 'asc' } });
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar fichas' });
  }
}

async function getCharacter(req, res) {
  try {
    const { characterId, tableId } = req.params;
    const character = await prisma.character.findUnique({ where: { id: characterId }, include: CHAR_INCLUDE });
    if (!character) return res.status(404).json({ error: 'Ficha nao encontrada' });
    const isMaster = req.user.role === 'ADMIN' || (await isUserMaster(tableId, req.user.id));
    if (!isMaster && character.userId !== req.user.id) {
      const perm = character.permissions.find((p) => p.userId === req.user.id);
      if (!perm || !perm.canView) return res.status(403).json({ error: 'Sem permissao para ver esta ficha' });
    }
    res.json(character);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar ficha' });
  }
}

async function createCharacter(req, res) {
  try {
    const { tableId } = req.params;
    const { name, system, data, kind, userId } = req.body;
    const isMaster = req.user.role === 'ADMIN' || (await isUserMaster(tableId, req.user.id));
    if (kind !== undefined && !KINDS.includes(kind)) return res.status(400).json({ error: 'Tipo invalido (pc, npc ou monster)' });
    const finalKind = KINDS.includes(kind) ? kind : 'pc';
    if (finalKind !== 'pc' && !isMaster) return res.status(403).json({ error: 'Apenas o mestre cria fichas de NPC ou Monstro' });
    const ownerId = isMaster && typeof userId === 'string' && userId ? userId : req.user.id;
    const character = await prisma.character.create({
      data: {
        tableId,
        userId: ownerId,
        name: name || 'Sem nome',
        system: system || 'custom',
        kind: finalKind,
        data: data || DEFAULT_DATA,
      },
      include: CHAR_INCLUDE,
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
    const { name, system, data, kind } = req.body;
    const existing = await prisma.character.findUnique({ where: { id: characterId }, include: { permissions: true } });
    if (!existing) return res.status(404).json({ error: 'Ficha nao encontrada' });
    const isMaster = req.user.role === 'ADMIN' || (await isUserMaster(tableId, req.user.id));
    let allowed = isMaster || existing.userId === req.user.id;
    if (!allowed) {
      const perm = existing.permissions.find((p) => p.userId === req.user.id);
      allowed = Boolean(perm && perm.canControl);
    }
    if (!allowed) return res.status(403).json({ error: 'Sem permissao para editar esta ficha' });
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (system !== undefined) updateData.system = system;
    if (data !== undefined) updateData.data = data;
    if (kind !== undefined && KINDS.includes(kind) && isMaster) updateData.kind = kind;
    const character = await prisma.character.update({ where: { id: characterId }, data: updateData, include: CHAR_INCLUDE });
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
    const isMaster = req.user.role === 'ADMIN' || (await isUserMaster(tableId, req.user.id));
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

async function setCharacterPermissions(req, res) {
  try {
    const { characterId, tableId } = req.params;
    const { permissions } = req.body;
    const existing = await prisma.character.findUnique({ where: { id: characterId } });
    if (!existing || existing.tableId !== tableId) return res.status(404).json({ error: 'Ficha nao encontrada' });
    const isMaster = req.user.role === 'ADMIN' || (await isUserMaster(tableId, req.user.id));
    if (!isMaster && existing.userId !== req.user.id) return res.status(403).json({ error: 'Apenas o dono da ficha ou o mestre podem gerenciar o compartilhamento' });
    const list = Array.isArray(permissions) ? permissions : [];
    await prisma.$transaction([
      prisma.characterPermission.deleteMany({ where: { characterId } }),
      ...list
        .filter((p) => p && typeof p.userId === 'string')
        .map((p) => prisma.characterPermission.create({
          data: { characterId, userId: p.userId, canView: p.canView !== false, canControl: p.canControl === true },
        })),
    ]);
    const character = await prisma.character.findUnique({ where: { id: characterId }, include: CHAR_INCLUDE });
    broadcastToTable(tableId, 'character:updated', { character });
    res.json(character);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar permissoes da ficha' });
  }
}

async function getCharacterPermissions(req, res) {
  try {
    const { characterId } = req.params;
    const list = await prisma.characterPermission.findMany({ where: { characterId } });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar permissoes da ficha' });
  }
}

module.exports = { getCharacters, getCharacter, createCharacter, updateCharacter, deleteCharacter, setCharacterPermissions, getCharacterPermissions };
