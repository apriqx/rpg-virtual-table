const { prisma } = require('../config/database');

function filterTokensForPlayer(tokens, userId) {
  return tokens.filter((token) => {
    if (!token.visible) return false;
    if (token.layer === 5) return false;
    const perm = token.permissions.find((p) => p.userId === userId);
    if (perm && !perm.canView) return false;
    if (!perm && token.permissions.length > 0) return true;
    if (token.permissions.length === 0) return true;
    return true;
  });
}

async function createToken(req, res) {
  try {
    const { mapId } = req.params;
    const { name, imageUrl, type, x, y, width, height, rotation, layer, visible, locked, ownerId } = req.body;

    const token = await prisma.token.create({
      data: {
        mapId,
        name,
        imageUrl: imageUrl || null,
        type: type || 'character',
        x: parseFloat(x) || 0,
        y: parseFloat(y) || 0,
        width: parseFloat(width) || 40,
        height: parseFloat(height) || 40,
        rotation: parseFloat(rotation) || 0,
        layer: parseInt(layer, 10) || 2,
        visible: visible !== undefined ? visible : true,
        locked: locked !== undefined ? locked : false,
        ownerId: ownerId || null,
      },
    });

    res.status(201).json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create token' });
  }
}

async function getTokens(req, res) {
  try {
    const { mapId } = req.params;

    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId: req.params.tableId, userId: req.user.id } },
      select: { role: true },
    });

    const isPrivileged = req.user.role === 'ADMIN' || (membership && membership.role === 'MASTER');

    const tokens = await prisma.token.findMany({
      where: { mapId },
      include: { permissions: true, owner: { select: { id: true, username: true } } },
    });

    if (isPrivileged) {
      return res.json(tokens);
    }

    res.json(filterTokensForPlayer(tokens, req.user.id));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
}

async function updateToken(req, res) {
  try {
    const { tokenId } = req.params;
    const { name, imageUrl, type, x, y, width, height, rotation, visible, locked, layer } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (type !== undefined) data.type = type;
    if (x !== undefined) data.x = parseFloat(x);
    if (y !== undefined) data.y = parseFloat(y);
    if (width !== undefined) data.width = parseFloat(width);
    if (height !== undefined) data.height = parseFloat(height);
    if (rotation !== undefined) data.rotation = parseFloat(rotation);
    if (visible !== undefined) data.visible = visible;
    if (locked !== undefined) data.locked = locked;
    if (layer !== undefined) data.layer = parseInt(layer, 10);

    const token = await prisma.token.update({
      where: { id: tokenId },
      data,
    });

    res.json(token);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update token' });
  }
}

async function deleteToken(req, res) {
  try {
    const { tokenId } = req.params;

    await prisma.token.delete({ where: { id: tokenId } });
    res.json({ message: 'Token deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete token' });
  }
}

async function setTokenPermissions(req, res) {
  try {
    const { tokenId } = req.params;
    const { permissions } = req.body;

    const existingPermissions = await prisma.tokenPermission.findMany({
      where: { tokenId },
    });

    const incomingUserIds = permissions.map((p) => p.userId);
    const existingUserIds = existingPermissions.map((p) => p.userId);

    const toDelete = existingUserIds.filter((id) => !incomingUserIds.includes(id));

    if (toDelete.length > 0) {
      await prisma.tokenPermission.deleteMany({
        where: { tokenId, userId: { in: toDelete } },
      });
    }

    for (const perm of permissions) {
      await prisma.tokenPermission.upsert({
        where: { tokenId_userId: { tokenId, userId: perm.userId } },
        update: {
          canView: perm.canView !== undefined ? perm.canView : true,
          canMove: perm.canMove || false,
          canResize: perm.canResize || false,
          canDelete: perm.canDelete || false,
        },
        create: {
          tokenId,
          userId: perm.userId,
          canView: perm.canView !== undefined ? perm.canView : true,
          canMove: perm.canMove || false,
          canResize: perm.canResize || false,
          canDelete: perm.canDelete || false,
        },
      });
    }

    const result = await prisma.tokenPermission.findMany({
      where: { tokenId },
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to set token permissions' });
  }
}

async function getTokenPermissions(req, res) {
  try {
    const { tokenId } = req.params;

    const permissions = await prisma.tokenPermission.findMany({
      where: { tokenId },
    });

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch token permissions' });
  }
}

module.exports = {
  createToken, getTokens, updateToken, deleteToken,
  setTokenPermissions, getTokenPermissions,
};