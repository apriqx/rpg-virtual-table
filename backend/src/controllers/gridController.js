const { prisma } = require('../config/database');

async function getGridConfig(req, res) {
  try {
    const { mapId } = req.params;

    const config = await prisma.gridConfig.findUnique({
      where: { mapId },
    });

    if (!config) {
      return res.json({ gridConfig: {
        cellSize: 40,
        physicalSize: 1.5,
        visible: true,
        lineThickness: 1,
        lineOpacity: 0.5,
        offsetX: 0,
        offsetY: 0,
        snapToGrid: false,
      }});
    }

    res.json({ gridConfig: config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch grid config' });
  }
}

async function updateGridConfig(req, res) {
  try {
    const { mapId } = req.params;
    const { cellSize, physicalSize, visible, lineThickness, lineOpacity, offsetX, offsetY, snapToGrid } = req.body;

    const config = await prisma.gridConfig.upsert({
      where: { mapId },
      update: {
        cellSize: cellSize !== undefined ? parseFloat(cellSize) : undefined,
        physicalSize: physicalSize !== undefined ? parseFloat(physicalSize) : undefined,
        visible: visible !== undefined ? visible : undefined,
        lineThickness: lineThickness !== undefined ? parseFloat(lineThickness) : undefined,
        lineOpacity: lineOpacity !== undefined ? parseFloat(lineOpacity) : undefined,
        offsetX: offsetX !== undefined ? parseFloat(offsetX) : undefined,
        offsetY: offsetY !== undefined ? parseFloat(offsetY) : undefined,
        snapToGrid: snapToGrid !== undefined ? snapToGrid : undefined,
      },
      create: {
        mapId,
        cellSize: parseFloat(cellSize) || 40,
        physicalSize: parseFloat(physicalSize) || 1.5,
        visible: visible !== undefined ? visible : true,
        lineThickness: parseFloat(lineThickness) || 1,
        lineOpacity: parseFloat(lineOpacity) || 0.5,
        offsetX: parseFloat(offsetX) || 0,
        offsetY: parseFloat(offsetY) || 0,
        snapToGrid: snapToGrid !== undefined ? snapToGrid : false,
      },
    });

    res.json({ gridConfig: config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update grid config' });
  }
}

module.exports = { getGridConfig, updateGridConfig };