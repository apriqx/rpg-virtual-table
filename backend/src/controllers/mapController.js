const { prisma } = require('../config/database');
const { broadcastToTable } = require('../socket');
const { cloudinaryEnabled, uploadToCloudinary, removeLocalFile } = require('../utils/upload');

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

function getMediaType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['mp4', 'avi', 'webm', 'mov'].includes(ext)) return 'video';
  return 'image';
}

async function uploadMap(req, res) {
  try {
    const { tableId } = req.params;
    const { name, width, height, active, imageUrl } = req.body;
    let finalUrl = imageUrl || '';
    let mediaType = 'image';
    if (req.file) {
      mediaType = getMediaType(req.file.filename);
      if (cloudinaryEnabled) {
        try {
          const result = await uploadToCloudinary(req.file.path, req.file.originalname);
          finalUrl = result.secure_url;
        } catch (e) {
          console.error('Cloudinary upload falhou:', e.message);
          return res.status(500).json({ error: 'Erro no upload para a nuvem' });
        } finally {
          removeLocalFile(req.file.path);
        }
      } else {
        finalUrl = '/uploads/' + req.file.filename;
      }
    }
    else if (!finalUrl) { return res.status(400).json({ error: 'Envie um arquivo ou uma URL' }); }
    else { if (finalUrl.match(/\.(mp4|avi|webm|mov)(\?|$)/i)) mediaType = 'video'; }
    const setActive = active === 'true' || active === true;
    if (setActive) await prisma.map.updateMany({ where: { tableId, active: true }, data: { active: false } });
    const map = await prisma.map.create({ data: { tableId, name, imageUrl: finalUrl, mediaType, width: parseInt(width, 10) || 1920, height: parseInt(height, 10) || 1080, active: setActive } });
    broadcastToTable(tableId, 'map:created', { map });
    if (setActive) broadcastToTable(tableId, 'map:switched', { mapId: map.id, tableId });
    res.status(201).json({ map });
  } catch (error) { res.status(500).json({ error: 'Erro ao criar mapa' }); }
}

async function getMaps(req, res) {
  try {
    const { tableId } = req.params;
    const maps = await prisma.map.findMany({ where: { tableId }, select: { id: true, name: true, imageUrl: true, mediaType: true, width: true, height: true, active: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    res.json(maps);
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar mapas' }); }
}

async function getMap(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const membership = await prisma.tableMember.findUnique({ where: { tableId_userId: { tableId, userId: req.user.id } }, select: { role: true } });
    const isMaster = membership && membership.role === 'MASTER';
    const isPrivileged = req.user.role === 'ADMIN' || isMaster;
    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        tokens: { include: { permissions: true, owner: { select: { id: true, username: true } }, character: { select: { id: true, name: true, data: true } } } },
        gridConfig: true,
        fogRegions: true,
        drawings: true,
        annotations: true,
      },
    });
    if (!map) return res.status(404).json({ error: 'Mapa nao encontrado' });
    let result = { ...map };
    if (!isPrivileged) { result.tokens = filterTokensForPlayer(map.tokens, req.user.id); result.fogRegions = map.fogRegions.filter((r) => r.revealed); }
    res.json(result);
  } catch (error) { res.status(500).json({ error: 'Erro ao buscar mapa' }); }
}

async function updateMap(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const { name, active, width, height } = req.body;
    const data = {};
    if (name !== undefined && String(name).trim()) data.name = String(name).trim().slice(0, 100);
    if (width !== undefined && width !== '') { const w = parseInt(width, 10); if (w > 0) data.width = w; }
    if (height !== undefined && height !== '') { const h = parseInt(height, 10); if (h > 0) data.height = h; }
    if (req.file) {
      if (cloudinaryEnabled) {
        try {
          const result = await uploadToCloudinary(req.file.path, req.file.originalname);
          data.imageUrl = result.secure_url;
        } catch (e) {
          console.error('Cloudinary upload falhou:', e.message);
          return res.status(500).json({ error: 'Erro no upload para a nuvem' });
        } finally {
          removeLocalFile(req.file.path);
        }
      } else {
        data.imageUrl = '/uploads/' + req.file.filename;
      }
      data.mediaType = getMediaType(req.file.filename);
    }
    if (active !== undefined) {
      const setActive = active === 'true' || active === true;
      if (setActive) { const map = await prisma.map.findUnique({ where: { id: mapId } }); if (map) await prisma.map.updateMany({ where: { tableId: map.tableId, active: true }, data: { active: false } }); }
      data.active = setActive;
    }
    const map = await prisma.map.update({ where: { id: mapId }, data });
    broadcastToTable(tableId, 'map:updated', { map });
    if (data.active) broadcastToTable(tableId, 'map:switched', { mapId: map.id, tableId });
    res.json(map);
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar mapa' }); }
}

async function duplicateMap(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const src = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        tokens: { include: { permissions: true } },
        gridConfig: true,
        fogRegions: true,
        drawings: true,
        annotations: true,
      },
    });
    if (!src || src.tableId !== tableId) return res.status(404).json({ error: 'Mapa nao encontrado' });
    const copy = await prisma.$transaction(async (tx) => {
      const map = await tx.map.create({
        data: {
          tableId, name: (src.name + ' (copia)').slice(0, 100), imageUrl: src.imageUrl,
          bgImageUrl: src.bgImageUrl, fgImageUrl: src.fgImageUrl, mediaType: src.mediaType,
          width: src.width, height: src.height, active: false,
        },
      });
      for (const t of src.tokens) {
        const { id, mapId: _m, permissions, ...tdata } = t;
        const nt = await tx.token.create({ data: { ...tdata, mapId: map.id } });
        for (const p of permissions) {
          const { id: _pi, tokenId: _ti, ...pdata } = p;
          await tx.tokenPermission.create({ data: { ...pdata, tokenId: nt.id } });
        }
      }
      if (src.gridConfig) {
        const { id, mapId: _g, ...g } = src.gridConfig;
        await tx.gridConfig.create({ data: { ...g, mapId: map.id } });
      }
      for (const f of src.fogRegions) {
        const { id, mapId: _f, ...fr } = f;
        await tx.fogRegion.create({ data: { ...fr, mapId: map.id } });
      }
      for (const d of src.drawings) {
        const { id, mapId: _d, ...dr } = d;
        await tx.drawing.create({ data: { ...dr, mapId: map.id } });
      }
      for (const a of src.annotations) {
        const { id, mapId: _a, ...an } = a;
        await tx.annotation.create({ data: { ...an, mapId: map.id } });
      }
      return tx.map.findUnique({ where: { id: map.id } });
    });
    broadcastToTable(tableId, 'map:created', { map: copy });
    res.status(201).json({ map: copy });
  } catch (error) { console.error('Erro ao duplicar mapa:', error); res.status(500).json({ error: 'Erro ao duplicar mapa' }); }
}

async function deleteMap(req, res) {
  try {
    const { mapId, tableId } = req.params;
    const affected = await prisma.tableMember.findMany({ where: { tableId, activeMapId: mapId } });
    await prisma.map.delete({ where: { id: mapId } });
    for (const am of affected) {
      await prisma.tableMember.update({ where: { id: am.id }, data: { activeMapId: null } });
      broadcastToTable(tableId, 'member:map', { userId: am.userId, mapId: null });
    }
    broadcastToTable(tableId, 'map:deleted', { mapId, tableId });
    res.json({ message: 'Mapa excluido' });
  } catch (error) { res.status(500).json({ error: 'Erro ao excluir mapa' }); }
}

module.exports = { uploadMap, getMaps, getMap, updateMap, duplicateMap, deleteMap };