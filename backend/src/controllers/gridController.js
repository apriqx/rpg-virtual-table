const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

async function getGridConfig(req, res) {
  try {
    const { mapId } = req.params;
    const config = await prisma.gridConfig.findUnique({ where: { mapId } });
    if (!config) {
      return res.json({ gridConfig: {
        cellSize: 40, physicalSize: 1.5, visible: true,
        lineThickness: 1, lineOpacity: 0.5,
        offsetX: 0, offsetY: 0, snapToGrid: false,
      }});
    }
    res.json({ gridConfig: config });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configuracao da grade' });
  }
}

async function updateGridConfig(req, res) {
  try {
    const { mapId, tableId } = req.params;
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
    broadcastToTable(tableId, 'grid:updated', { mapId, gridConfig: config });
    res.json({ gridConfig: config });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar grade' });
  }
}

const DEFAULT_FOG = { enabled: true, color: '#000000', masterOpacity: 0.5, playerOpacity: 0 };

async function getFogConfig(req, res) {
  try {
    const { mapId } = req.params;
    const config = await prisma.fogConfig.findUnique({ where: { mapId } });
    if (!config) return res.json({ fogConfig: DEFAULT_FOG });
    res.json({ fogConfig: {
      enabled: config.enabled,
      color: config.color,
      masterOpacity: config.masterOpacity,
      playerOpacity: config.playerOpacity,
    } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configuracao da neblina' });
  }
}

// Item 23: exclusivo do mestre. Itens 16-21: cor + opacidades independentes por papel.
async function updateFogConfig(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const { enabled, color, masterOpacity, playerOpacity } = req.body;
    const data = {
      enabled: enabled !== undefined ? Boolean(enabled) : undefined,
      color: typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color.trim()) ? color.trim().slice(0, 9) : undefined,
      masterOpacity: masterOpacity !== undefined ? Math.max(0, Math.min(1, parseFloat(masterOpacity) || 0)) : undefined,
      playerOpacity: playerOpacity !== undefined ? Math.max(0, Math.min(1, parseFloat(playerOpacity) || 0)) : undefined,
    };
    const config = await prisma.fogConfig.upsert({
      where: { mapId },
      update: data,
      create: {
        mapId,
        enabled: data.enabled !== undefined ? data.enabled : DEFAULT_FOG.enabled,
        color: data.color !== undefined ? data.color : DEFAULT_FOG.color,
        masterOpacity: data.masterOpacity !== undefined ? data.masterOpacity : DEFAULT_FOG.masterOpacity,
        playerOpacity: data.playerOpacity !== undefined ? data.playerOpacity : DEFAULT_FOG.playerOpacity,
      },
    });
    // Item 25: sincroniza com todos sem recarregar
    broadcastToTable(tableId, 'fog:updated', { mapId, fogConfig: {
      enabled: config.enabled,
      color: config.color,
      masterOpacity: config.masterOpacity,
      playerOpacity: config.playerOpacity,
    } });
    res.json({ fogConfig: {
      enabled: config.enabled,
      color: config.color,
      masterOpacity: config.masterOpacity,
      playerOpacity: config.playerOpacity,
    } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar neblina' });
  }
}

module.exports = { getGridConfig, updateGridConfig, getFogConfig, updateFogConfig, DEFAULT_FOG };