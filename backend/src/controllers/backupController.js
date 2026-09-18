const { prisma } = require('../config/database');

function pick(obj, keys) { const o = {}; for (const k of keys) o[k] = obj[k]; return o; }
function num(v, d) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
function clampStr(v, max) { return v == null ? null : String(v).slice(0, max); }

const MAP_COLUMNS = ['name', 'imageUrl', 'bgImageUrl', 'fgImageUrl', 'mediaType', 'darkMode', 'width', 'height'];
const GRID_COLUMNS = ['cellSize', 'physicalSize', 'visible', 'lineThickness', 'lineOpacity', 'offsetX', 'offsetY', 'snapToGrid'];
const TOKEN_COLUMNS = ['name', 'imageUrl', 'type', 'x', 'y', 'width', 'height', 'rotation', 'layer', 'visible', 'locked', 'snapToGrid', 'lightRadius', 'visionRadius', 'displayName', 'showName', 'opacity'];

async function exportTable(req, res) {
  try {
    const { tableId } = req.params;
    const table = await prisma.table.findUnique({ where: { id: tableId }, select: { name: true, masquerade: true } });
    if (!table) return res.status(404).json({ error: 'Mesa nao encontrada' });
    const characters = await prisma.character.findMany({ where: { tableId }, include: { user: { select: { username: true } } }, orderBy: { createdAt: 'asc' } });
    const maps = await prisma.map.findMany({
      where: { tableId },
      include: { gridConfig: true, fogRegions: true, drawings: true, annotations: true, tokens: { include: { permissions: { include: { user: { select: { username: true } } } }, owner: { select: { username: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const charIndex = new Map(characters.map((c, i) => [c.id, i]));
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      table: { name: table.name, masquerade: table.masquerade },
      characters: characters.map((c) => ({ name: c.name, system: c.system, data: c.data, ownerUsername: c.user ? c.user.username : null })),
      maps: maps.map((m) => ({
        ...pick(m, MAP_COLUMNS),
        gridConfig: m.gridConfig ? pick(m.gridConfig, GRID_COLUMNS) : null,
        fogRegions: m.fogRegions.map((f) => pick(f, ['x', 'y', 'width', 'height', 'revealed', 'shape', 'points'])),
        drawings: m.drawings.map((d) => pick(d, ['color', 'lineWidth', 'points', 'layer'])),
        annotations: m.annotations.map((a) => pick(a, ['text', 'x', 'y', 'color', 'fontSize'])),
        tokens: m.tokens.map((t) => ({
          ...pick(t, TOKEN_COLUMNS),
          bars: t.bars === null || t.bars === undefined ? null : JSON.parse(JSON.stringify(t.bars)),
          statusMarkers: t.statusMarkers === null || t.statusMarkers === undefined ? null : JSON.parse(JSON.stringify(t.statusMarkers)),
          ownerUsername: t.owner ? t.owner.username : null,
          characterIndex: t.characterId != null && charIndex.has(t.characterId) ? charIndex.get(t.characterId) : null,
          permissions: t.permissions.map((p) => ({ username: p.user ? p.user.username : null, canView: p.canView, canMove: p.canMove, canResize: p.canResize, canDelete: p.canDelete })).filter((p) => p.username),
        })),
      })),
    });
  } catch (error) { console.error('exportTable:', error); res.status(500).json({ error: 'Erro ao exportar mesa' }); }
}

async function importTable(req, res) {
  try {
    const { tableId } = req.params;
    const body = req.body;
    if (!body || body.version !== 1 || !Array.isArray(body.maps)) return res.status(400).json({ error: 'Arquivo de backup invalido' });
    const users = await prisma.user.findMany({ select: { id: true, username: true } });
    const userByName = new Map(users.map((u) => [u.username, u.id]));
    const masterId = req.user.id;
    const uid = (username) => (username && userByName.get(username)) || masterId;
    const result = await prisma.$transaction(async (tx) => {
      const charIds = [];
      for (const c of (body.characters || [])) {
        if (!c || !c.name) continue;
        const created = await tx.character.create({ data: { tableId, name: clampStr(c.name, 100), system: c.system || 'custom', data: c.data ?? {}, userId: uid(c.ownerUsername) } });
        charIds.push(created.id);
      }
      let mapCount = 0; let tokenCount = 0;
      for (const m of body.maps) {
        if (!m || !m.name || !m.imageUrl) continue;
        const map = await tx.map.create({
          data: { tableId, name: clampStr(m.name, 100), imageUrl: m.imageUrl, bgImageUrl: m.bgImageUrl || null, fgImageUrl: m.fgImageUrl || null, mediaType: m.mediaType === 'video' ? 'video' : 'image', darkMode: m.darkMode === true, width: parseInt(m.width, 10) || 1920, height: parseInt(m.height, 10) || 1080, active: false },
        });
        mapCount++;
        if (m.gridConfig) {
          const g = m.gridConfig;
          await tx.gridConfig.create({ data: { mapId: map.id, cellSize: num(g.cellSize, 40), physicalSize: num(g.physicalSize, 1.5), visible: g.visible !== false, lineThickness: num(g.lineThickness, 1), lineOpacity: num(g.lineOpacity, 0.5), offsetX: num(g.offsetX, 0), offsetY: num(g.offsetY, 0), snapToGrid: g.snapToGrid === true } });
        }
        for (const f of (m.fogRegions || [])) {
          if ([f.x, f.y, f.width, f.height].every((v) => typeof v === 'number' && Number.isFinite(v))) await tx.fogOfWarRegion.create({ data: { mapId: map.id, x: f.x, y: f.y, width: f.width, height: f.height, revealed: f.revealed === true, shape: ['rect', 'circle', 'polygon'].includes(f.shape) ? f.shape : 'rect', points: Array.isArray(f.points) ? f.points : null } });
        }
        for (const d of (m.drawings || [])) {
          if (Array.isArray(d.points)) await tx.drawing.create({ data: { mapId: map.id, color: d.color || '#e94560', lineWidth: num(d.lineWidth, 3), points: d.points, layer: parseInt(d.layer, 10) || 0 } });
        }
        for (const a of (m.annotations || [])) {
          if (a && a.text != null) await tx.annotation.create({ data: { mapId: map.id, text: clampStr(a.text, 500), x: num(a.x, 0), y: num(a.y, 0), color: a.color || '#ffffff', fontSize: parseInt(a.fontSize, 10) || 16 } });
        }
        for (const t of (m.tokens || [])) {
          if (!t || !t.name) continue;
          const token = await tx.token.create({
            data: { mapId: map.id, name: clampStr(t.name, 100), imageUrl: t.imageUrl || null, type: t.type || 'character', x: num(t.x, 0), y: num(t.y, 0), width: num(t.width, 40), height: num(t.height, 40), rotation: num(t.rotation, 0), layer: parseInt(t.layer, 10) || 2, visible: t.visible !== false, locked: t.locked === true, snapToGrid: t.snapToGrid !== false, lightRadius: num(t.lightRadius, 0), visionRadius: num(t.visionRadius, 0), displayName: clampStr(t.displayName, 60), showName: t.showName !== false, opacity: Math.min(1, Math.max(0.1, num(t.opacity, 1))), bars: Array.isArray(t.bars) ? t.bars : null, statusMarkers: Array.isArray(t.statusMarkers) ? t.statusMarkers : null, ownerId: t.ownerUsername ? userByName.get(t.ownerUsername) || null : null, characterId: typeof t.characterIndex === 'number' && charIds[t.characterIndex] ? charIds[t.characterIndex] : null },
          });
          tokenCount++;
          for (const p of (t.permissions || [])) {
            const puid = p && p.username ? userByName.get(p.username) : null;
            if (puid) await tx.tokenPermission.create({ data: { tokenId: token.id, userId: puid, canView: p.canView !== false, canMove: p.canMove === true, canResize: p.canResize === true, canDelete: p.canDelete === true } });
          }
        }
      }
      return { mapCount, tokenCount, characterCount: charIds.length };
    });
    res.status(201).json({ message: 'Backup importado', ...result });
  } catch (error) { console.error('importTable:', error); res.status(500).json({ error: 'Erro ao importar backup' }); }
}

module.exports = { exportTable, importTable };
