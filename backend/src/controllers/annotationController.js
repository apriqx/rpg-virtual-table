const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

async function getAnnotations(req, res) {
  try {
    const { mapId } = req.params;
    const annotations = await prisma.annotation.findMany({ where: { mapId }, orderBy: { createdAt: 'asc' } });
    res.json(annotations);
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar anotacoes' }); }
}

async function createAnnotation(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const { text, x, y, color, fontSize } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Texto obrigatorio' });
    const annotation = await prisma.annotation.create({
      data: { mapId, text: text.trim(), x: parseFloat(x) || 0, y: parseFloat(y) || 0, color: color || '#ffffff', fontSize: parseInt(fontSize, 10) || 16 },
    });
    broadcastToTable(tableId, 'annotation:created', { annotation, mapId });
    res.status(201).json(annotation);
  } catch (error) { res.status(500).json({ error: 'Erro ao criar anotacao' }); }
}

async function updateAnnotation(req, res) {
  try {
    const { annotationId, tableId } = req.params;
    const { text, x, y, color, fontSize } = req.body;
    const data = {};
    if (text !== undefined) data.text = text;
    if (x !== undefined) data.x = parseFloat(x);
    if (y !== undefined) data.y = parseFloat(y);
    if (color !== undefined) data.color = color;
    if (fontSize !== undefined) data.fontSize = parseInt(fontSize, 10);
    const annotation = await prisma.annotation.update({ where: { id: annotationId }, data });
    broadcastToTable(tableId, 'annotation:updated', { annotation, mapId: req.params.mapId });
    res.json(annotation);
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar anotacao' }); }
}

async function deleteAnnotation(req, res) {
  try {
    const { annotationId, tableId } = req.params;
    await prisma.annotation.delete({ where: { id: annotationId } });
    broadcastToTable(tableId, 'annotation:deleted', { annotationId, mapId: req.params.mapId });
    res.json({ message: 'Anotacao excluida' });
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir anotacao' }); }
}

module.exports = { getAnnotations, createAnnotation, updateAnnotation, deleteAnnotation };