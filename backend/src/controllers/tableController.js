const { prisma } = require('../config/database');

async function createTable(req, res) {
  try {
    const { name, description } = req.body;

    const table = await prisma.table.create({
      data: {
        name,
        description: description || null,
        ownerId: req.user.id,
        members: {
          create: {
            userId: req.user.id,
            role: 'MASTER',
          },
        },
      },
    });

    res.status(201).json(table);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create table' });
  }
}

async function getTables(req, res) {
  try {
    const memberships = await prisma.tableMember.findMany({
      where: { userId: req.user.id },
      include: {
        table: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
    });

    const tables = memberships.map((m) => ({
      ...m.table,
      memberCount: m.table._count.members,
    }));

    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
}

async function getTable(req, res) {
  try {
    const { tableId } = req.params;

    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, email: true } },
          },
        },
        maps: {
          include: {
            _count: { select: { tokens: true } },
          },
        },
      },
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const { members, maps, ...tableData } = table;
    res.json({ table: tableData, members, maps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch table' });
  }
}

async function updateTable(req, res) {
  try {
    const { tableId } = req.params;
    const { name, description } = req.body;

    const table = await prisma.table.update({
      where: { id: tableId },
      data: { name, description },
    });

    res.json(table);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table' });
  }
}

async function deleteTable(req, res) {
  try {
    const { tableId } = req.params;

    const table = await prisma.table.findUnique({ where: { id: tableId } });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (req.user.role !== 'ADMIN' && table.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the table owner or admin can delete this table' });
    }

    await prisma.table.delete({ where: { id: tableId } });
    res.json({ message: 'Table deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
}

async function addMember(req, res) {
  try {
    const { tableId } = req.params;
    const { userId, username, role } = req.body;

    let targetUserId = userId;
    if (!targetUserId && username) {
      const targetUser = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuario nao encontrado' });
      }
      targetUserId = targetUser.id;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'userId ou username obrigatorio' });
    }

    const existing = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: targetUserId } },
    });

    if (existing) {
      return res.status(400).json({ error: 'Usuario ja e membro desta mesa' });
    }

    const member = await prisma.tableMember.create({
      data: { tableId, userId: targetUserId, role: role || 'PLAYER' },
      include: { user: { select: { id: true, username: true, email: true } } },
    });

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
}

async function removeMember(req, res) {
  try {
    const { tableId, userId } = req.params;

    const table = await prisma.table.findUnique({ where: { id: tableId } });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    if (table.ownerId === userId) {
      return res.status(400).json({ error: 'Cannot remove the table owner' });
    }

    const member = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId } },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role === 'MASTER') {
      return res.status(400).json({ error: 'Cannot remove a master member' });
    }

    await prisma.tableMember.delete({
      where: { tableId_userId: { tableId, userId } },
    });

    res.json({ message: 'Member removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
}

async function updateMemberRole(req, res) {
  try {
    const { tableId, userId } = req.params;
    const { role } = req.body;

    const member = await prisma.tableMember.update({
      where: { tableId_userId: { tableId, userId } },
      data: { role },
      include: { user: { select: { id: true, username: true, email: true } } },
    });

    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member role' });
  }
}

module.exports = {
  createTable, getTables, getTable, updateTable, deleteTable,
  addMember, removeMember, updateMemberRole,
};