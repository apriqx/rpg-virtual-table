const { prisma } = require('../config/database');

async function getFogRegions(req, res) {
  try {
    const { mapId } = req.params;

    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId: req.params.tableId, userId: req.user.id } },
      select: { role: true },
    });

    const isMaster = membership && membership.role === 'MASTER';
    const isAdmin = req.user.role === 'ADMIN';

    if (isMaster || isAdmin) {
      const regions = await prisma.fogOfWarRegion.findMany({ where: { mapId } });
      return res.json(regions);
    }

    const regions = await prisma.fogOfWarRegion.findMany({
      where: { mapId, revealed: true },
    });

    res.json(regions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fog regions' });
  }
}

async function createFogRegion(req, res) {
  try {
    const { mapId } = req.params;
    const { x, y, width, height, revealed } = req.body;

    const region = await prisma.fogOfWarRegion.create({
      data: {
        mapId,
        x: parseFloat(x),
        y: parseFloat(y),
        width: parseFloat(width),
        height: parseFloat(height),
        revealed: revealed !== undefined ? revealed : false,
      },
    });

    res.status(201).json(region);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create fog region' });
  }
}

async function updateFogRegion(req, res) {
  try {
    const { fogId } = req.params;
    const { x, y, width, height, revealed } = req.body;

    const data = {};
    if (x !== undefined) data.x = parseFloat(x);
    if (y !== undefined) data.y = parseFloat(y);
    if (width !== undefined) data.width = parseFloat(width);
    if (height !== undefined) data.height = parseFloat(height);
    if (revealed !== undefined) data.revealed = revealed;

    const region = await prisma.fogOfWarRegion.update({
      where: { id: fogId },
      data,
    });

    res.json(region);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update fog region' });
  }
}

async function deleteFogRegion(req, res) {
  try {
    const { fogId } = req.params;

    await prisma.fogOfWarRegion.delete({ where: { id: fogId } });
    res.json({ message: 'Fog region deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete fog region' });
  }
}

async function batchUpdateFog(req, res) {
  try {
    const { mapId } = req.params;
    const { regions } = req.body || { regions: req.body };

    await prisma.$transaction(async (tx) => {
      await tx.fogOfWarRegion.deleteMany({ where: { mapId } });
      if (regions && regions.length > 0) {
        await tx.fogOfWarRegion.createMany({
          data: regions.map((r) => ({
            mapId,
            x: parseFloat(r.x),
            y: parseFloat(r.y),
            width: parseFloat(r.width),
            height: parseFloat(r.height),
            revealed: r.revealed !== undefined ? r.revealed : false,
          })),
        });
      }
    });

    const result = await prisma.fogOfWarRegion.findMany({ where: { mapId } });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to batch update fog regions' });
  }
}

module.exports = { getFogRegions, createFogRegion, updateFogRegion, deleteFogRegion, batchUpdateFog };