const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

async function getFogRegions(req, res) {
  try {
    const { mapId } = req.params;
    const membership = await prisma.tableMember.findUnique({
      where: { tableId_userId: { tableId: req.params.tableId, userId: req.user.id } },
      select: { role: true },
    });
    const isMaster = membership && membership.role === 'MASTER';
    if (req.user.role === 'ADMIN' || isMaster) {
      const regions = await prisma.fogOfWarRegion.findMany({ where: { mapId } });
      return res.json(regions);
    }
    const regions = await prisma.fogOfWarRegion.findMany({ where: { mapId, revealed: true } });
    res.json(regions);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar regioes de neblina' });
  }
}

async function createFogRegion(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const { x, y, width, height, revealed, shape, points } = req.body;
    const finalShape = ['rect', 'circle', 'polygon'].includes(shape) ? shape : 'rect';
    const region = await prisma.fogOfWarRegion.create({
      data: {
        mapId,
        x: parseFloat(x), y: parseFloat(y),
        width: parseFloat(width), height: parseFloat(height),
        revealed: revealed !== undefined ? revealed : false,
        shape: finalShape,
        points: finalShape === 'polygon' && Array.isArray(points) && points.length >= 3 ? points : null,
      },
    });
    broadcastToTable(tableId, 'fog:updated', { mapId });
    res.status(201).json(region);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar regiao de neblina' });
  }
}

async function updateFogRegion(req, res) {
  try {
    const { fogId, tableId } = req.params;
    const { x, y, width, height, revealed, shape, points } = req.body;
    const data = {};
    if (x !== undefined) data.x = parseFloat(x);
    if (y !== undefined) data.y = parseFloat(y);
    if (width !== undefined) data.width = parseFloat(width);
    if (height !== undefined) data.height = parseFloat(height);
    if (revealed !== undefined) data.revealed = revealed;
    if (shape !== undefined && ['rect', 'circle', 'polygon'].includes(shape)) {
      data.shape = shape;
      if (shape !== 'polygon') data.points = null;
    }
    if (points !== undefined) data.points = Array.isArray(points) && points.length >= 3 ? points : null;
    const region = await prisma.fogOfWarRegion.update({ where: { id: fogId }, data });
    broadcastToTable(tableId, 'fog:updated', { mapId: region.mapId });
    res.json(region);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar regiao de neblina' });
  }
}

async function deleteFogRegion(req, res) {
  try {
    const { fogId, tableId } = req.params;
    const existing = await prisma.fogOfWarRegion.findUnique({ where: { id: fogId } });
    if (!existing) return res.status(404).json({ error: 'Regiao de neblina nao encontrada' });
    await prisma.fogOfWarRegion.delete({ where: { id: fogId } });
    broadcastToTable(tableId, 'fog:updated', { mapId: existing.mapId });
    res.json({ message: 'Regiao de neblina excluida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir regiao de neblina' });
  }
}

async function batchUpdateFog(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const regions = Array.isArray(req.body) ? req.body : req.body?.regions || [];
    await prisma.$transaction(async (tx) => {
      await tx.fogOfWarRegion.deleteMany({ where: { mapId } });
      if (regions.length > 0) {
        await tx.fogOfWarRegion.createMany({
          data: regions.map((r) => {
            const sh = ['rect', 'circle', 'polygon'].includes(r.shape) ? r.shape : 'rect';
            return {
              mapId,
              x: parseFloat(r.x), y: parseFloat(r.y),
              width: parseFloat(r.width), height: parseFloat(r.height),
              revealed: r.revealed !== undefined ? r.revealed : false,
              shape: sh,
              points: sh === 'polygon' && Array.isArray(r.points) && r.points.length >= 3 ? r.points : null,
            };
          }),
        });
      }
    });
    broadcastToTable(tableId, 'fog:updated', { mapId });
    const result = await prisma.fogOfWarRegion.findMany({ where: { mapId } });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar neblina' });
  }
}

module.exports = { getFogRegions, createFogRegion, updateFogRegion, deleteFogRegion, batchUpdateFog };