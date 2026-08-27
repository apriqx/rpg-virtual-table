const { prisma } = require('../config/database');

async function requireMaster(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const { tableId } = req.params;
    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: req.user.id } },
    });

    if (!membership || membership.role !== 'MASTER') {
      return res.status(403).json({ error: 'Master access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to check permissions' });
  }
}

async function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function canModifyToken(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const { tableId, tokenId } = req.params;

    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: req.user.id } },
    });

    if (membership && membership.role === 'MASTER') {
      return next();
    }

    const permission = await prisma.tokenPermission.findUnique({
      where: { tokenId_userId: { tokenId, userId: req.user.id } },
    });

    if (!permission) {
      return res.status(403).json({ error: 'No permission to modify this token' });
    }

    if (req.method === 'DELETE' && !permission.canDelete) {
      return res.status(403).json({ error: 'No permission to delete this token' });
    }

    if (!permission.canMove) {
      return res.status(403).json({ error: 'No permission to modify this token' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to check token permissions' });
  }
}

async function isTableMember(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const { tableId } = req.params;
    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: req.user.id } },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this table' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to check membership' });
  }
}

module.exports = { requireMaster, requireAdmin, canModifyToken, isTableMember };