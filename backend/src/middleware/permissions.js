const { prisma } = require('../config/database');

async function requireMaster(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();
    const { tableId } = req.params;
    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: req.user.id } },
    });
    if (!membership || membership.role !== 'MASTER') {
      return res.status(403).json({ error: 'Acesso de mestre necessario' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar permissoes' });
  }
}

async function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso de administrador necessario' });
  }
  next();
}

async function canModifyToken(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();
    const { tableId, tokenId } = req.params;
    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: req.user.id } },
    });
    if (membership && membership.role === 'MASTER') return next();
    const permission = await prisma.tokenPermission.findUnique({
      where: { tokenId_userId: { tokenId, userId: req.user.id } },
    });
    if (!permission) {
      return res.status(403).json({ error: 'Sem permissao para modificar este token' });
    }
    if (req.method === 'DELETE') {
      if (!permission.canDelete) {
        return res.status(403).json({ error: 'Sem permissao para excluir este token' });
      }
      return next();
    }
    if (req.method === 'PUT') {
      const body = req.body;
      const keys = Object.keys(body);
      const ADMIN_FIELDS = ['type', 'characterId', 'ownerId', 'layer', 'visible', 'locked', 'snapToGrid', 'lightRadius', 'visionRadius'];
      if (keys.some((k) => ADMIN_FIELDS.includes(k))) {
        return res.status(403).json({ error: 'Campo administrativo do token: apenas o mestre pode alterar' });
      }
      const PLAYER_FIELDS = ['name', 'displayName', 'imageUrl', 'bars', 'statusMarkers', 'showName', 'opacity', 'rotation', 'x', 'y', 'width', 'height'];
      if (keys.some((k) => !PLAYER_FIELDS.includes(k))) {
        return res.status(403).json({ error: 'Campo de token desconhecido para jogador' });
      }
      const isOnlyPosition = keys.length > 0 && keys.every((k) => ['x', 'y'].includes(k));
      const isOnlySize = keys.length > 0 && keys.every((k) => ['width', 'height'].includes(k));
      if (isOnlyPosition && !permission.canMove) {
        return res.status(403).json({ error: 'Sem permissao para mover este token' });
      }
      if (isOnlySize && !permission.canResize) {
        return res.status(403).json({ error: 'Sem permissao para redimensionar este token' });
      }
      if (!isOnlyPosition && !isOnlySize && !permission.canMove) {
        return res.status(403).json({ error: 'Sem permissao para modificar este token' });
      }
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar permissoes do token' });
  }
}

async function isTableMember(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();
    const { tableId } = req.params;
    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId, userId: req.user.id } },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Voce nao e membro desta mesa' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar pertencimento a mesa' });
  }
}

module.exports = { requireMaster, requireAdmin, canModifyToken, isTableMember };