const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

async function getDrawings(req, res) {
  try {
    const { mapId } = req.params;
    const drawings = await prisma.drawing.findMany({ where: { mapId }, orderBy: { createdAt: 'asc' } });
    res.json(drawings);
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar desenhos' }); }
}

async function createDrawing(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const { color, lineWidth, points, layer } = req.body;
    const drawing = await prisma.drawing.create({
      data: { mapId, color: color || '#e94560', lineWidth: parseFloat(lineWidth) || 3, points, layer: parseInt(layer, 10) || 0 },
    });
    broadcastToTable(tableId, 'drawing:created', { drawing, mapId });
    res.status(201).json(drawing);
  } catch (error) { res.status(500).json({ error: 'Erro ao salvar desenho' }); }
}

async function deleteDrawing(req, res) {
  try {
    const { drawingId, tableId } = req.params;
    await prisma.drawing.delete({ where: { id: drawingId } });
    broadcastToTable(tableId, 'drawing:deleted', { drawingId });
    res.json({ message: 'Desenho excluido' });
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir desenho' }); }
}

async function clearDrawings(req, res) {
  try {
    const { mapId, tableId } = req.params;
    await prisma.drawing.deleteMany({ where: { mapId } });
    broadcastToTable(tableId, 'drawings:cleared', { mapId });
    res.json({ message: 'Desenhos limpos' });
  } catch (error) { res.status(500).json({ error: 'Erro ao limpar desenhos' }); }
}

module.exports = { getDrawings, createDrawing, deleteDrawing, clearDrawings };