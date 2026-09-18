const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');

const TOKEN_INCLUDE = { permissions: true, owner: { select: { id: true, username: true } }, character: { select: { id: true, name: true, data: true } } };

function sanitizeBars(bars) {
  if (!Array.isArray(bars)) return null;
  return bars.slice(0, 3).map((b) => (b && typeof b === 'object' ? {
    label: String(b.label || '').slice(0, 20),
    current: Number(b.current) || 0,
    max: Number(b.max) || 0,
    visible: b.visible !== false,
    color: typeof b.color === 'string' ? b.color.slice(0, 9) : '#50fa7b',
  } : null));
}

function sanitizeMarkers(markers) {
  if (!Array.isArray(markers)) return null;
  return [...new Set(markers.filter((m) => typeof m === 'string' && m.length <= 24).map((m) => m))].slice(0, 20);
}

function filterTokensForPlayer(tokens, userId) {
  return tokens.filter((token) => {
    if (!token.visible) return false;
    if (token.layer === 5) return false;
    if (token.permissions.length === 0) return true;
    const perm = token.permissions.find((p) => p.userId === userId);
    if (!perm) return false;
    return perm.canView;
  });
}
async function createToken(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const { name, imageUrl, type, x, y, width, height, rotation, layer, visible, locked, snapToGrid, ownerId, characterId, lightRadius, visionRadius, displayName, showName, opacity, bars, statusMarkers } = req.body;
    const token = await prisma.token.create({
      data: { mapId, name, imageUrl: imageUrl || null, type: type || 'character', x: parseFloat(x) || 0, y: parseFloat(y) || 0, width: parseFloat(width) || 40, height: parseFloat(height) || 40, rotation: parseFloat(rotation) || 0, layer: parseInt(layer, 10) || 2, visible: visible !== undefined ? visible : true, locked: locked !== undefined ? locked : false, snapToGrid: snapToGrid !== undefined ? snapToGrid : true, ownerId: ownerId || null, characterId: characterId || null, lightRadius: Math.max(0, parseFloat(lightRadius) || 0), visionRadius: Math.max(0, parseFloat(visionRadius) || 0), displayName: displayName ? String(displayName).slice(0, 60) : null, showName: showName !== undefined ? showName : true, opacity: Math.min(1, Math.max(0.1, opacity === undefined ? 1 : parseFloat(opacity) || 1)), bars: sanitizeBars(bars), statusMarkers: sanitizeMarkers(statusMarkers) },
      include: TOKEN_INCLUDE,
    });
    broadcastToTable(tableId, 'token:created', { token, mapId });
    res.status(201).json({ token });
  } catch (error) { res.status(500).json({ error: 'Erro ao criar token' }); }
}

async function getTokens(req, res) {
  try {
    const { mapId } = req.params;
    const membership = await prisma.tableMember.findUnique({ where: { tableId_userId: { tableId: req.params.tableId, userId: req.user.id } }, select: { role: true } });
    const isPrivileged = req.user.role === 'ADMIN' || (membership && membership.role === 'MASTER');
    const tokens = await prisma.token.findMany({ where: { mapId }, include: { permissions: true, owner: { select: { id: true, username: true } }, character: { select: { id: true, name: true, data: true } } } });
    if (isPrivileged) return res.json(tokens);
    res.json(filterTokensForPlayer(tokens, req.user.id));
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar tokens' }); }
}

const TOKEN_ADMIN_FIELDS = ['type', 'characterId', 'ownerId', 'layer', 'visible', 'locked', 'snapToGrid', 'lightRadius', 'visionRadius'];

async function updateToken(req, res) {
  try {
    const { tokenId, mapId, tableId } = req.params;
    const membership = await prisma.tableMember.findUnique({ where: { tableId_userId: { tableId, userId: req.user.id } }, select: { role: true } });
    const isMaster = req.user.role === 'ADMIN' || (membership && membership.role === 'MASTER');
    const bodyKeys = Object.keys(req.body || {});
    if (!isMaster && bodyKeys.some((k) => TOKEN_ADMIN_FIELDS.includes(k))) {
      return res.status(403).json({ error: 'Campo administrativo do token: apenas o mestre pode alterar' });
    }
    const { name, imageUrl, type, x, y, width, height, rotation, visible, locked, snapToGrid, layer, characterId, ownerId, displayName, showName, opacity, bars, statusMarkers } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (ownerId !== undefined) data.ownerId = ownerId || null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (type !== undefined) data.type = type;
    if (x !== undefined) data.x = parseFloat(x);
    if (y !== undefined) data.y = parseFloat(y);
    if (width !== undefined) data.width = parseFloat(width);
    if (height !== undefined) data.height = parseFloat(height);
    if (rotation !== undefined) data.rotation = parseFloat(rotation);
    if (visible !== undefined) data.visible = visible;
    if (locked !== undefined) data.locked = locked;
    if (snapToGrid !== undefined) data.snapToGrid = snapToGrid;
    if (layer !== undefined) data.layer = parseInt(layer, 10);
    if (characterId !== undefined) data.characterId = characterId;
    if (displayName !== undefined) data.displayName = displayName ? String(displayName).slice(0, 60) : null;
    if (showName !== undefined) data.showName = showName;
    if (opacity !== undefined) data.opacity = Math.min(1, Math.max(0.1, parseFloat(opacity) || 1));
    if (bars !== undefined) data.bars = sanitizeBars(bars);
    if (statusMarkers !== undefined) data.statusMarkers = sanitizeMarkers(statusMarkers);
    if (req.body.lightRadius !== undefined) data.lightRadius = Math.max(0, parseFloat(req.body.lightRadius) || 0);
    if (req.body.visionRadius !== undefined) data.visionRadius = Math.max(0, parseFloat(req.body.visionRadius) || 0);
    const token = await prisma.token.update({ where: { id: tokenId }, data, include: { permissions: true, owner: { select: { id: true, username: true } }, character: { select: { id: true, name: true, data: true } } } });
    broadcastToTable(tableId, 'token:updated', { token, mapId });
    res.json(token);
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar token' }); }
}

async function deleteToken(req, res) {
  try {
    const { tokenId, mapId, tableId } = req.params;
    await prisma.token.delete({ where: { id: tokenId } });
    broadcastToTable(tableId, 'token:deleted', { tokenId, mapId });
    res.json({ message: 'Token excluido' });
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir token' }); }
}

async function setTokenPermissions(req, res) {
  try {
    const { tokenId, mapId, tableId } = req.params;
    const { permissions } = req.body;
    const existing = await prisma.tokenPermission.findMany({ where: { tokenId } });
    const inIds = permissions.map((p) => p.userId);
    const exIds = existing.map((p) => p.userId);
    const del = exIds.filter((id) => !inIds.includes(id));
    if (del.length > 0) await prisma.tokenPermission.deleteMany({ where: { tokenId, userId: { in: del } } });
    for (const perm of permissions) {
      await prisma.tokenPermission.upsert({ where: { tokenId_userId: { tokenId, userId: perm.userId } }, update: { canView: perm.canView !== undefined ? perm.canView : true, canMove: perm.canMove || false, canResize: perm.canResize || false, canDelete: perm.canDelete || false }, create: { tokenId, userId: perm.userId, canView: perm.canView !== undefined ? perm.canView : true, canMove: perm.canMove || false, canResize: perm.canResize || false, canDelete: perm.canDelete || false } });
    }
    const result = await prisma.tokenPermission.findMany({ where: { tokenId } });
    broadcastToTable(tableId, 'token:permissions', { tokenId, mapId, permissions: result });
    res.json(result);
  } catch (error) { res.status(500).json({ error: 'Erro ao salvar permissoes' }); }
}

async function getTokenPermissions(req, res) {
  try {
    const { tokenId } = req.params;
    const permissions = await prisma.tokenPermission.findMany({ where: { tokenId } });
    res.json(permissions);
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar permissoes' }); }
}

async function duplicateToken(req, res) {
  try {
    const { tokenId, mapId, tableId } = req.params;
    const original = await prisma.token.findUnique({ where: { id: tokenId }, include: { permissions: true } });
    if (!original) return res.status(404).json({ error: 'Token nao encontrado' });
    const { name, x, y } = req.body || {};
    const token = await prisma.token.create({
      data: {
        mapId,
        name: (name && String(name).trim()) || original.name + ' (copia)',
        imageUrl: original.imageUrl, type: original.type,
        x: x !== undefined ? parseFloat(x) || 0 : original.x + 20, y: y !== undefined ? parseFloat(y) || 0 : original.y + 20,
        width: original.width, height: original.height, rotation: original.rotation, layer: original.layer,
        visible: original.visible, locked: false, snapToGrid: original.snapToGrid,
        lightRadius: original.lightRadius, visionRadius: original.visionRadius,
        displayName: original.displayName, showName: original.showName, opacity: original.opacity,
        bars: original.bars === null || original.bars === undefined ? null : JSON.parse(JSON.stringify(original.bars)),
        statusMarkers: original.statusMarkers === null || original.statusMarkers === undefined ? null : JSON.parse(JSON.stringify(original.statusMarkers)),
        ownerId: original.ownerId, characterId: original.characterId,
      },
      include: TOKEN_INCLUDE,
    });
    if (original.permissions.length > 0) {
      await prisma.tokenPermission.createMany({ data: original.permissions.map((p) => ({ tokenId: token.id, userId: p.userId, canView: p.canView, canMove: p.canMove, canResize: p.canResize, canDelete: p.canDelete })) });
    }
    const full = await prisma.token.findUnique({ where: { id: token.id }, include: TOKEN_INCLUDE });
    broadcastToTable(tableId, 'token:created', { token: full, mapId });
    res.status(201).json({ token: full });
  } catch (error) { res.status(500).json({ error: 'Erro ao duplicar token' }); }
}

module.exports = { createToken, getTokens, updateToken, deleteToken, duplicateToken, setTokenPermissions, getTokenPermissions };