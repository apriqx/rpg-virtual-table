const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

async function createTable(req, res) {
  try {
    const { name, description } = req.body;
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) return res.status(400).json({ error: 'Nome da mesa e obrigatorio' });
    if (cleanName.length > 100) return res.status(400).json({ error: 'Nome da mesa muito longo (max 100)' });
    const table = await prisma.table.create({
      data: {
        name: cleanName,
        description: typeof description === 'string' && description.trim() ? description.trim().slice(0, 500) : null,
        ownerId: req.user.id,
        members: { create: { userId: req.user.id, role: 'MASTER' } },
      },
    });
    res.status(201).json(table);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar mesa' });
  }
}

async function getTables(req, res) {
  try {
    if (req.user.role === 'ADMIN') {
      const all = await prisma.table.findMany({ include: { _count: { select: { members: true } } } });
      return res.json(all.map((t) => ({ ...t, memberCount: t._count.members })));
    }
    const memberships = await prisma.tableMember.findMany({
      where: { userId: req.user.id },
      include: { table: { include: { _count: { select: { members: true } } } } },
    });
    const tables = memberships.map((m) => ({
      ...m.table,
      memberCount: m.table._count.members,
      myRole: m.role,
    }));
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar mesas' });
  }
}

async function getTable(req, res) {
  try {
    const { tableId } = req.params;
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        members: { include: { user: { select: { id: true, username: true } } } },
        maps: { include: { _count: { select: { tokens: true } } } },
      },
    });
    if (!table) return res.status(404).json({ error: 'Mesa nao encontrada' });
    const { members, maps, ...tableData } = table;
    res.json({ table: tableData, members, maps });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar mesa' });
  }
}

async function updateTable(req, res) {
  try {
    const { tableId } = req.params;
    const { name, description, masquerade } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (masquerade !== undefined) data.masquerade = masquerade;
    const table = await prisma.table.update({ where: { id: tableId }, data });
    broadcastToTable(tableId, 'table:updated', { table });
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar mesa' });
  }
}

async function deleteTable(req, res) {
  try {
    const { tableId } = req.params;
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) return res.status(404).json({ error: 'Mesa nao encontrada' });
    if (req.user.role !== 'ADMIN' && table.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Apenas o dono da mesa ou admin pode exclui-la' });
    }
    await prisma.table.delete({ where: { id: tableId } });
    res.json({ message: 'Mesa excluida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir mesa' });
  }
}

async function addMember(req, res) {
  try {
    const { tableId } = req.params;
    const { userId, username, role } = req.body;
    let targetUserId = userId;
    if (!targetUserId && username) {
      const targetUser = await prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (!targetUser) return res.status(404).json({ error: 'Usuario nao encontrado' });
      targetUserId = targetUser.id;
    }
    if (!targetUserId) return res.status(400).json({ error: 'userId ou username obrigatorio' });
    const existing = await prisma.tableMember.findUnique({ where: { tableId_userId: { tableId, userId: targetUserId } } });
    if (existing) return res.status(400).json({ error: 'Usuario ja e membro desta mesa' });
    const member = await prisma.tableMember.create({
      data: { tableId, userId: targetUserId, role: role || 'PLAYER' },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    broadcastToTable(tableId, 'members:updated', { tableId });
    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar membro' });
  }
}

async function removeMember(req, res) {
  try {
    const { tableId, userId } = req.params;
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) return res.status(404).json({ error: 'Mesa nao encontrada' });
    if (table.ownerId === userId) return res.status(400).json({ error: 'Nao e possivel remover o dono da mesa' });
    const member = await prisma.tableMember.findUnique({ where: { tableId_userId: { tableId, userId } } });
    if (!member) return res.status(404).json({ error: 'Membro nao encontrado' });
    if (member.role === 'MASTER') return res.status(400).json({ error: 'Nao e possivel remover um mestre' });
    await prisma.tableMember.delete({ where: { tableId_userId: { tableId, userId } } });
    broadcastToTable(tableId, 'members:updated', { tableId });
    res.json({ message: 'Membro removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover membro' });
  }
}

async function updateMemberRole(req, res) {
  try {
    const { tableId, userId } = req.params;
    const { role } = req.body;
    if (!['PLAYER', 'MASTER'].includes(role)) return res.status(400).json({ error: 'Cargo invalido' });
    const table = await prisma.table.findUnique({ where: { id: tableId } });
    if (!table) return res.status(404).json({ error: 'Mesa nao encontrada' });
    if (table.ownerId === userId && role !== 'MASTER') {
      return res.status(400).json({ error: 'O dono da mesa deve permanecer mestre' });
    }
    const member = await prisma.tableMember.update({
      where: { tableId_userId: { tableId, userId } },
      data: { role },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    broadcastToTable(tableId, 'members:updated', { tableId });
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar cargo do membro' });
  }
}

async function muteMember(req, res) {
  try {
    const { tableId, userId } = req.params;
    const { muted } = req.body;
    const member = await prisma.tableMember.update({
      where: { tableId_userId: { tableId, userId } },
      data: { muted: muted !== undefined ? muted : true },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    broadcastToTable(tableId, 'member:muted', { userId, muted: member.muted });
    res.json(member);
  } catch (error) { res.status(500).json({ error: 'Erro ao alterar mute' }); }
}

async function spotlight(req, res) {
  try {
    const { tableId } = req.params;
    const { tokenId, x, y } = req.body;
    broadcastToTable(tableId, 'spotlight', { tokenId: tokenId || null, x: parseFloat(x) || null, y: parseFloat(y) || null });
    res.json({ message: 'Spotlight enviado' });
  } catch (error) { res.status(500).json({ error: 'Erro ao enviar spotlight' }); }
}

module.exports = {
  createTable, getTables, getTable, updateTable, deleteTable,
  addMember, removeMember, updateMemberRole, muteMember, spotlight,
};