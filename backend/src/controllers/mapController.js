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

async function uploadMap(req, res) {
  try {
    const { tableId } = req.params;
    const { name, width, height, active } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const setActive = active === 'true' || active === true;

    if (setActive) {
      await prisma.map.updateMany({
        where: { tableId, active: true },
        data: { active: false },
      });
    }

    const map = await prisma.map.create({
      data: {
        tableId,
        name,
        imageUrl,
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        active: setActive,
      },
    });

    res.status(201).json({ map });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload map' });
  }
}

async function getMaps(req, res) {
  try {
    const { tableId } = req.params;

    const maps = await prisma.map.findMany({
      where: { tableId },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        width: true,
        height: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(maps);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
}

async function getMap(req, res) {
  try {
    const { mapId } = req.params;
    const isMasterOrAdmin = req.user.role === 'ADMIN' || req.user.role === 'MASTER';

    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId: req.params.tableId, userId: req.user.id } },
      select: { role: true },
    });

    const isMaster = membership && membership.role === 'MASTER';
    const isPrivileged = req.user.role === 'ADMIN' || isMaster;

    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        tokens: { include: { permissions: true, owner: { select: { id: true, username: true } } } },
        gridConfig: true,
        fogRegions: true,
      },
    });

    if (!map) {
      return res.status(404).json({ error: 'Map not found' });
    }

    let result = { ...map };

    if (!isPrivileged) {
      result.tokens = filterTokensForPlayer(map.tokens, req.user.id);
      result.fogRegions = map.fogRegions.filter((r) => r.revealed);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch map' });
  }
}

async function updateMap(req, res) {
  try {
    const { mapId } = req.params;
    const { name, active } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;

    if (active !== undefined) {
      const setActive = active === 'true' || active === true;
      if (setActive) {
        const map = await prisma.map.findUnique({ where: { id: mapId } });
        if (map) {
          await prisma.map.updateMany({
            where: { tableId: map.tableId, active: true },
            data: { active: false },
          });
        }
      }
      data.active = setActive;
    }

    const map = await prisma.map.update({
      where: { id: mapId },
      data,
    });

    res.json(map);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update map' });
  }
}

async function deleteMap(req, res) {
  try {
    const { mapId } = req.params;

    await prisma.map.delete({ where: { id: mapId } });
    res.json({ message: 'Map deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete map' });
  }
}

module.exports = { uploadMap, getMaps, getMap, updateMap, deleteMap };