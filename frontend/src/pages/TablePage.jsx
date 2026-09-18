import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { connectSocket, disconnectSocket, onSocket, emitSocket } from '../services/socket';
const MapCanvas = lazy(() => import('../components/MapCanvas'));
import Toolbar from '../components/Toolbar';
import TokenDialog from '../components/TokenDialog';
import GridSettings from '../components/GridSettings';
import PermissionDialog from '../components/PermissionDialog';
import FogControls from '../components/FogControls';
import ChatPanel from '../components/ChatPanel';
import DiceRoller from '../components/DiceRoller';
import InitiativeTracker from '../components/InitiativeTracker';
import Soundboard, { playSound, isSoundMuted } from '../components/Soundboard';
import CharacterList from '../components/CharacterList';
import CharacterSheet from '../components/CharacterSheet';

const DEFAULT_GRID = {
  cellSize: 50, physicalSize: 1.5, visible: true,
  lineThickness: 1, lineOpacity: 0.3, offsetX: 0, offsetY: 0, snapToGrid: false,
};

export default function TablePage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const stageRef = useRef(null);
  const importFileRef = useRef(null);

  const [table, setTable] = useState(null);
  const [maps, setMaps] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeMap, setActiveMap] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [gridConfig, setGridConfig] = useState(DEFAULT_GRID);
  const [fogRegions, setFogRegions] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTool, setCurrentTool] = useState('select');
  const [selectedToken, setSelectedToken] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showChat, setShowChat] = useState(true);
  const showChatRef = useRef(true);
  const [unreadChat, setUnreadChat] = useState(0);
  const [whisperTarget, setWhisperTarget] = useState(null);
  const [activeCombatTokenId, setActiveCombatTokenId] = useState(null);

  function toggleChat() {
    const next = !showChatRef.current;
    showChatRef.current = next;
    setShowChat(next);
    if (next) setUnreadChat(0);
  }

  function handleWhisper(targetName) {
    setWhisperTarget(targetName);
    if (!showChatRef.current) toggleChat();
  }
  const [showDice, setShowDice] = useState(false);
  const [showCharList, setShowCharList] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [drawColor, setDrawColor] = useState('#e94560');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [showGridModal, setShowGridModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingMap, setEditingMap] = useState(null);
  const [editMapForm, setEditMapForm] = useState({ name: '', width: 1920, height: 1080 });
  const [editMapFile, setEditMapFile] = useState(null);
  const [tokenClickPos, setTokenClickPos] = useState(null);

  const [uploadForm, setUploadForm] = useState({ name: '', width: 1920, height: 1080, imageUrl: '' });
  const [mapFile, setMapFile] = useState(null);
  const [addMemberForm, setAddMemberForm] = useState({ username: '', role: 'PLAYER' });
  const [brushSize, setBrushSize] = useState(50);

  const isMaster = user.role === 'ADMIN' || members.some(
    (m) => (m.userId === user.id || m.user?.id === user.id) && m.role === 'MASTER'
  );
  const masquerade = table?.masquerade || false;
  const isMuted = members.find((m) => (m.userId === user.id || m.user?.id === user.id))?.muted || false;

  const loadTable = useCallback(async () => {
    try {
      const data = await api.tables.getOne(tableId);
      setTable(data.table); setMembers(data.members || []); setMaps(data.maps || []);
      const active = (data.maps || []).find((m) => m.active) || (data.maps || [])[0];
      if (active) { setActiveMap(active); await loadMapData(active.id); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [tableId]);

  const loadMapData = useCallback(async (mapId) => {
    try {
      const [mapData, gridData, fogData] = await Promise.all([
        api.maps.getOne(tableId, mapId),
        api.grid.get(tableId, mapId).catch(() => ({ gridConfig: DEFAULT_GRID })),
        api.fog.getAll(tableId, mapId).catch(() => []),
      ]);
      setTokens(mapData.tokens || []);
      setGridConfig(gridData.gridConfig || DEFAULT_GRID);
      setFogRegions(Array.isArray(fogData) ? fogData : fogData.fogRegions || []);
      setDrawings(mapData.drawings || []);
      setAnnotations(mapData.annotations || []);
    } catch (err) { console.error(err); }
  }, [tableId]);

  useEffect(() => {
    loadTable();
    const token = localStorage.getItem('token');
    if (token) { connectSocket(token); setTimeout(() => emitSocket('join:table', tableId), 500); }
    return () => { emitSocket('leave:table', tableId); disconnectSocket(); };
  }, [tableId]);

  useEffect(() => {
    const c = [];
    c.push(onSocket('token:created', ({ token }) => setTokens((p) => p.some((t) => t.id === token.id) ? p : [...p, token])));
    c.push(onSocket('token:updated', ({ token }) => setTokens((p) => p.map((t) => t.id === token.id ? { ...t, ...token } : t))));
    c.push(onSocket('token:deleted', ({ tokenId }) => { setTokens((p) => p.filter((t) => t.id !== tokenId)); setSelectedToken((s) => s?.id === tokenId ? null : s); }));
    c.push(onSocket('token:permissions', ({ tokenId, permissions }) => setTokens((p) => p.map((t) => t.id === tokenId ? { ...t, permissions } : t))));
    c.push(onSocket('fog:updated', async ({ mapId }) => { if (activeMap?.id === mapId) { const d = await api.fog.getAll(tableId, mapId).catch(() => []); setFogRegions(Array.isArray(d) ? d : d.fogRegions || []); } }));
    c.push(onSocket('grid:updated', ({ mapId, gridConfig: gc }) => { if (activeMap?.id === mapId) setGridConfig(gc); }));
    c.push(onSocket('map:created', ({ map }) => setMaps((p) => p.some((m) => m.id === map.id) ? p : [...p, map])));
    c.push(onSocket('map:updated', ({ map }) => { setMaps((p) => p.map((m) => m.id === map.id ? { ...m, ...map } : m)); if (activeMap?.id === map.id) setActiveMap((p) => p ? { ...p, ...map } : p); }));
    c.push(onSocket('map:deleted', ({ mapId: did }) => { setMaps((p) => p.filter((m) => m.id !== did)); if (activeMap?.id === did) { const n = maps.find((m) => m.id !== did); setActiveMap(n || null); if (!n) { setTokens([]); setFogRegions([]); setDrawings([]); setAnnotations([]); } } }));
    c.push(onSocket('map:switched', async ({ mapId }) => { setMaps((p) => p.map((m) => ({ ...m, active: m.id === mapId }))); const mo = maps.find((m) => m.id === mapId); if (mo) setActiveMap({ ...mo, active: true }); setSelectedToken(null); await loadMapData(mapId); }));
    c.push(onSocket('members:updated', async () => { try { const d = await api.tables.getOne(tableId); setMembers(d.members || []); } catch {} }));
    c.push(onSocket('user:joined', ({ userId, username }) => setOnlineUsers((p) => p.some((u) => u.userId === userId) ? p : [...p, { userId, username }])));
    c.push(onSocket('user:left', ({ userId }) => setOnlineUsers((p) => p.filter((u) => u.userId !== userId))));
    c.push(onSocket('online:users', (users) => setOnlineUsers(users)));
    c.push(onSocket('chat:message', () => { if (!showChatRef.current) setUnreadChat((n) => n + 1); }));
    c.push(onSocket('chat:whisper', () => { if (!showChatRef.current) setUnreadChat((n) => n + 1); }));
    c.push(onSocket('chat:cleared', () => {}));
    c.push(onSocket('character:created', ({ character }) => setCharacters((p) => p.some((c) => c.id === character.id) ? p : [...p, character])));
    c.push(onSocket('character:updated', ({ character }) => { setCharacters((p) => p.map((c) => c.id === character.id ? { ...c, ...character } : c)); if (selectedCharacter?.id === character.id) setSelectedCharacter((s) => s ? { ...s, ...character } : s); setTokens((p) => p.map((t) => t.characterId === character.id ? { ...t, character } : t)); }));
    c.push(onSocket('character:deleted', ({ characterId: cid }) => { setCharacters((p) => p.filter((c) => c.id !== cid)); if (selectedCharacter?.id === cid) setSelectedCharacter(null); }));
    c.push(onSocket('drawing:created', ({ drawing }) => setDrawings((p) => [...p, drawing])));
    c.push(onSocket('drawing:deleted', ({ drawingId }) => setDrawings((p) => p.filter((d) => d.id !== drawingId))));
    c.push(onSocket('drawings:cleared', () => setDrawings([])));
    c.push(onSocket('annotation:created', ({ annotation }) => setAnnotations((p) => [...p, annotation])));
    c.push(onSocket('annotation:updated', ({ annotation }) => setAnnotations((p) => p.map((a) => a.id === annotation.id ? { ...a, ...annotation } : a))));
    c.push(onSocket('annotation:deleted', ({ annotationId }) => setAnnotations((p) => p.filter((a) => a.id !== annotationId))));
    c.push(onSocket('table:updated', ({ table: t }) => { setTable((p) => p ? { ...p, ...t } : p); }));
    c.push(onSocket('initiative:updated', (data) => {
      const entry = (data.list || [])[data.currentIdx];
      setActiveCombatTokenId(entry && tokens.some((t) => t.id === entry.id) ? entry.id : null);
    }));
    c.push(onSocket('sound:play', ({ name }) => { if (!isSoundMuted()) playSound(name); }));
    c.push(onSocket('member:muted', ({ userId, muted }) => { setMembers((p) => p.map((m) => (m.userId === userId || m.user?.id === userId) ? { ...m, muted } : m)); }));
    c.push(onSocket('spotlight', async ({ tokenId, x, y }) => {
      if (x != null && y != null) { const stage = stageRef.current; if (stage) { const w = stage.width(); const h = stage.height(); stage.position({ x: w / 2 - x * stage.scaleX(), y: h / 2 - y * stage.scaleY() }); stage.batchDraw(); } }
      else if (tokenId) { const t = tokens.find((t) => t.id === tokenId); if (t) { const stage = stageRef.current; if (stage) { const w = stage.width(); const h = stage.height(); stage.position({ x: w / 2 - (t.x + t.width / 2) * stage.scaleX(), y: h / 2 - (t.y + t.height / 2) * stage.scaleY() }); stage.batchDraw(); } } }
    }));
    return () => c.forEach((f) => f());
  }, [tableId, activeMap?.id, maps, loadMapData, selectedCharacter?.id, tokens]);

  async function handleSwitchMap(mapId) {
    if (isMaster && activeMap) await api.maps.update(tableId, activeMap.id, { active: false });
    await api.maps.update(tableId, mapId, { active: true });
    const u = maps.map((m) => ({ ...m, active: m.id === mapId })); setMaps(u); setActiveMap(u.find((m) => m.id === mapId)); setSelectedToken(null); await loadMapData(mapId);
  }

  async function handleUploadMap(e) {
    e.preventDefault(); if (!mapFile && !uploadForm.imageUrl.trim()) { alert('Envie um arquivo ou cole a URL do mapa'); return; }
    try {
      const fd = new FormData(); fd.append('name', uploadForm.name); if (mapFile) { fd.append('image', mapFile); } else { fd.append('imageUrl', uploadForm.imageUrl.trim()); } fd.append('width', uploadForm.width); fd.append('height', uploadForm.height); fd.append('active', maps.length === 0 ? 'true' : 'false');
      const d = await api.maps.create(tableId, fd); const nm = [...maps, d.map]; setMaps(nm);
      if (nm.length === 1) { setActiveMap(d.map); await loadMapData(d.map.id); }
      setShowUploadModal(false); setUploadForm({ name: '', width: 1920, height: 1080, imageUrl: '' }); setMapFile(null);
    } catch (err) { alert('Erro ao adicionar mapa: ' + (err.response?.data?.error || err.message)); }
  }

  async function handleDeleteMap(mapId) {
    if (!window.confirm('Excluir este mapa?')) return;
    try {
      await api.maps.remove(tableId, mapId); const nm = maps.filter((m) => m.id !== mapId); setMaps(nm);
      if (activeMap?.id === mapId) { const n = nm[0] || null; setActiveMap(n); if (n) { await api.maps.update(tableId, n.id, { active: true }); await loadMapData(n.id); } else { setTokens([]); setFogRegions([]); setDrawings([]); setAnnotations([]); } }
    } catch { alert('Erro ao excluir mapa'); }
  }

  function openEditMap(m) {
    setEditingMap(m);
    setEditMapForm({ name: m.name, width: m.width, height: m.height });
    setEditMapFile(null);
  }

  async function handleDuplicateMap(mapId) {
    const src = maps.find((m) => m.id === mapId);
    if (!window.confirm('Duplicar o mapa "' + (src ? src.name : '') + '" com todos os tokens, neblina e desenhos?')) return;
    try {
      const d = await api.maps.duplicate(tableId, mapId);
      setMaps((p) => (p.some((m) => m.id === d.map.id) ? p : [...p, d.map]));
    } catch { alert('Erro ao duplicar mapa'); }
  }

  async function handleUpdateMap(e) {
    e.preventDefault();
    try {
      let updated;
      if (editMapFile) {
        const fd = new FormData();
        fd.append('name', editMapForm.name);
        fd.append('width', editMapForm.width);
        fd.append('height', editMapForm.height);
        fd.append('image', editMapFile);
        updated = await api.maps.update(tableId, editingMap.id, fd);
      } else {
        updated = await api.maps.update(tableId, editingMap.id, { name: editMapForm.name, width: Number(editMapForm.width), height: Number(editMapForm.height) });
      }
      setMaps((p) => p.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      if (activeMap?.id === updated.id) setActiveMap((p) => ({ ...p, ...updated }));
      setEditingMap(null);
    } catch { alert('Erro ao salvar mapa'); }
  }

  async function handleTokenMove(tokenId, x, y) {
    setTokens((p) => p.map((t) => t.id === tokenId ? { ...t, x, y } : t));
    try { await api.tokens.update(tableId, activeMap.id, tokenId, { x, y }); } catch { loadMapData(activeMap.id); }
  }

  async function handleFogUpdate(nr) {
    setFogRegions(nr);
    try { await api.fog.batchUpdate(tableId, activeMap.id, nr.map((r) => ({ id: r.id, x: r.x, y: r.y, width: r.width, height: r.height, revealed: r.revealed }))); } catch { loadMapData(activeMap.id); }
  }

  function handleAddToken(x, y) { setTokenClickPos({ x, y }); setEditingToken(null); setShowTokenModal(true); }

  function handleEditToken() {
    if (!selectedToken) { alert('Selecione um token primeiro (ferramenta Selecionar)'); return; }
    setTokenClickPos(null); setEditingToken(selectedToken); setShowTokenModal(true);
  }

  async function handleTokenSubmit(fd) {
    try {
      if (editingToken) {
        const d = await api.tokens.update(tableId, activeMap.id, editingToken.id, { name: fd.name, type: fd.type, imageUrl: fd.imageUrl || null, width: Number(fd.width), height: Number(fd.height), layer: Number(fd.layer), visible: fd.visible, lightRadius: Number(fd.lightRadius) || 0, ownerId: fd.ownerId || null, characterId: fd.characterId || null });
        setTokens((p) => p.map((t) => (t.id === d.id ? d : t))); setSelectedToken(d);
      } else {
        const d = await api.tokens.create(tableId, activeMap.id, { name: fd.name, type: fd.type, imageUrl: fd.imageUrl || null, x: tokenClickPos?.x || 0, y: tokenClickPos?.y || 0, width: Number(fd.width), height: Number(fd.height), layer: Number(fd.layer), visible: fd.visible, lightRadius: Number(fd.lightRadius) || 0, ownerId: fd.ownerId || null, characterId: fd.characterId || null });
        setTokens((p) => [...p, d.token]);
      }
      setShowTokenModal(false); setTokenClickPos(null); setEditingToken(null);
    } catch { alert(editingToken ? 'Erro ao salvar token' : 'Erro ao criar token'); }
  }

  async function handleToggleGrid() { const nc = { ...gridConfig, visible: !gridConfig.visible }; setGridConfig(nc); try { await api.grid.update(tableId, activeMap.id, nc); } catch {} }
  async function handleSaveGrid(nc) { setGridConfig(nc); try { await api.grid.update(tableId, activeMap.id, nc); setShowGridModal(false); } catch { alert('Erro ao salvar grade'); } }

  function handleTokenSelect(tokenId) {
    const t = tokens.find((t) => t.id === tokenId); if (!t) return; setSelectedToken(t);
    if (t.character) setSelectedCharacter(t.character);
    if (isMaster && currentTool === 'select') setShowPermModal(true);
  }

  async function handleSavePermissions(p) { try { await api.tokens.setPermissions(tableId, activeMap.id, selectedToken.id, p); await loadMapData(activeMap.id); setShowPermModal(false); setSelectedToken(null); } catch { alert('Erro ao salvar permissoes'); } }

  async function handleDeleteToken() {
    if (!selectedToken) { alert('Selecione um token primeiro'); return; }
    if (!window.confirm('Excluir o token "' + selectedToken.name + '"?')) return;
    try { await api.tokens.remove(tableId, activeMap.id, selectedToken.id); setTokens((p) => p.filter((t) => t.id !== selectedToken.id)); setSelectedToken(null); setShowPermModal(false); } catch { alert('Erro ao excluir token'); }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    try { await api.tables.addMember(tableId, addMemberForm.username, addMemberForm.role); setShowAddMemberModal(false); setAddMemberForm({ username: '', role: 'PLAYER' }); loadTable(); } catch (err) { alert(err.response?.data?.error || 'Erro ao adicionar membro'); }
  }
  async function handleRemoveMember(uid) { if (!window.confirm('Remover este membro?')) return; try { await api.tables.removeMember(tableId, uid); loadTable(); } catch { alert('Erro ao remover membro'); } }
  async function handleRoleChange(uid, r) { try { await api.tables.updateMemberRole(tableId, uid, r); loadTable(); } catch { alert('Erro ao alterar cargo'); } }
  async function handleRevealAll() { if (!activeMap) return; const r = [{ x: 0, y: 0, width: activeMap.width, height: activeMap.height, revealed: true }]; setFogRegions(r); try { await api.fog.batchUpdate(tableId, activeMap.id, r); } catch {} }
  async function handleHideAll() { if (!activeMap) return; setFogRegions([]); try { await api.fog.batchUpdate(tableId, activeMap.id, []); } catch {} }

  async function handleDrawingCreated(data) {
    try { const d = await api.drawings.create(tableId, activeMap.id, data); setDrawings((p) => [...p, d]); } catch {}
  }

  async function handleAnnotationCreated(data) {
    try { const a = await api.annotations.create(tableId, activeMap.id, data); setAnnotations((p) => [...p, a]); } catch {}
  }

  async function handleDrawingDeleted(drawingId) {
    try { await api.drawings.remove(tableId, activeMap.id, drawingId); } catch {}
  }

  async function handleAnnotationDeleted(annotationId) {
    try { await api.annotations.remove(tableId, activeMap.id, annotationId); } catch {}
  }

  async function handleAnnotationUpdated(annotationId, data) {
    try { await api.annotations.update(tableId, activeMap.id, annotationId, data); } catch {}
  }

  async function handleClearDrawings() {
    try { await api.drawings.clear(tableId, activeMap.id); } catch {}
  }

  function handleSelectCharacter(char) { setSelectedCharacter(char); }

  async function handleToggleMasquerade() {
    try { await api.tables.update(tableId, { masquerade: !masquerade }); setTable((p) => p ? { ...p, masquerade: !p.masquerade } : p); } catch {}
  }

  async function handleExportBackup() {
    try {
      const data = await api.tables.exportTable(tableId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup-' + ((table && table.name) || 'mesa').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') + '-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { alert('Erro ao exportar backup'); }
  }

  async function handleImportBackup(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
    if (!window.confirm('Importar este backup? Novos mapas, personagens e tokens serao criados (nada sera apagado).')) return;
    try {
      const data = JSON.parse(await file.text());
      const r = await api.tables.importTable(tableId, data);
      alert('Backup importado: ' + r.mapCount + ' mapas, ' + r.tokenCount + ' tokens, ' + r.characterCount + ' personagens.');
      const mapsData = await api.maps.getAll(tableId); setMaps(Array.isArray(mapsData) ? mapsData : []);
      const chars = await api.characters.getAll(tableId); setCharacters(Array.isArray(chars) ? chars : []);
    } catch { alert('Erro ao importar backup (arquivo invalido?)'); }
  }

  async function handleMuteMember(uid, muted) {
    try { await api.tables.muteMember(tableId, uid, muted); setMembers((p) => p.map((m) => (m.userId === uid || m.user?.id === uid) ? { ...m, muted } : m)); } catch {}
  }

  async function handleSpotlight(uid) {
    const member = members.find((m) => m.userId === uid || m.user?.id === uid);
    if (!member) return;
    const token = tokens.find((t) => t.ownerId === uid && t.characterId);
    if (token) { try { await api.tables.spotlight(tableId, token.id, token.x + token.width / 2, token.y + token.height / 2); } catch {} }
    else { try { await api.tables.spotlight(tableId, null, 0, 0); } catch {} }
  }

  const canMoveToken = useCallback((token) => {
    if (isMaster) return true; if (token.locked) return false;
    if (token.permissions?.length > 0) { const p = token.permissions.find((p) => p.userId === user.id); return p ? p.canMove : false; }
    return true;
  }, [isMaster, user.id]);

  if (loading) return <div className="loading">Carregando...</div>;

  const visibleTokens = tokens.filter((t) => {
    if (!isMaster && t.layer === 5) return false; if (!isMaster && !t.visible) return false;
    if (!isMaster && t.permissions?.length > 0) { const p = t.permissions.find((p) => p.userId === user.id); if (!p || !p.canView) return false; }
    return true;
  });

  return (
    <div className="table-page">
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="btn btn-secondary btn-block back-btn" onClick={() => navigate('/')}>← Voltar</button>
          <h2>{table?.name || 'Mesa'}</h2>
          {onlineUsers.length > 0 && <div style={{ fontSize: '11px', color: '#8be9fd', marginTop: '4px' }}>Online: {onlineUsers.map((u) => u.username).join(', ')}</div>}
        </div>
        <h3>Mapas</h3>
        {maps.map((m) => (<div key={m.id} className={'map-item ' + (activeMap?.id === m.id ? 'active-map' : '')} onClick={() => handleSwitchMap(m.id)}><span className="map-name">{m.name}</span>{isMaster && <span className="map-actions" onClick={(e) => e.stopPropagation()}><button className="map-act" title="Editar" onClick={() => openEditMap(m)}>✏️</button><button className="map-act" title="Duplicar" onClick={() => handleDuplicateMap(m.id)}>📑</button><button className="map-act map-delete" title="Excluir" onClick={() => handleDeleteMap(m.id)}>🗑️</button></span>}</div>))}
        {isMaster && <div className="sidebar-actions"><button className="btn btn-sm btn-primary" onClick={() => setShowUploadModal(true)}>+ Mapa</button></div>}
        <h3>Membros</h3>
        {members.map((m) => {
          const mu = m.user || m;
          const io = onlineUsers.some((u) => u.userId === (mu.id || m.userId));
          return (
            <div key={mu.id || m.userId} className="member-item">
              <span className="member-name">{io && <span style={{ color: '#50fa7b', marginRight: '4px' }}>●</span>}{mu.username}{m.muted && <span style={{ color: '#ff5555', marginLeft: '4px' }} title="Silenciado">🔇</span>}</span>
              <div className="member-actions">
                <span className={'badge ' + (m.role === 'MASTER' ? 'badge-master' : 'badge-player')}>{m.role}</span>
                {mu.id !== user.id && <button className="btn btn-sm" title="Sussurrar" onClick={() => handleWhisper(mu.username)}>✉</button>}
                {isMaster && mu.id !== user.id && m.role !== 'MASTER' && (
                  <>
                    <button className="btn btn-sm" title={m.muted ? 'Desmutar' : 'Mutar'} onClick={() => handleMuteMember(mu.id, !m.muted)}>{m.muted ? '🔊' : '🔇'}</button>
                    <button className="btn btn-sm" title="Spotlight" onClick={() => handleSpotlight(mu.id)}>🔍</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleRemoveMember(mu.id)}>×</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {isMaster && <div className="sidebar-actions"><button className="btn btn-sm btn-primary" onClick={() => setShowAddMemberModal(true)}>+ Membro</button></div>}
        <div style={{ marginTop: '12px' }}><button className="btn btn-sm btn-primary btn-block" onClick={() => setShowCharList(true)}>Fichas de Personagem</button></div>
        {isMaster && (
          <div className="sidebar-actions" style={{ marginTop: '8px' }}>
            <button className={'btn btn-sm btn-block ' + (masquerade ? 'btn-primary' : 'btn-secondary')} onClick={handleToggleMasquerade}>Masquerade {masquerade ? 'ON' : 'OFF'}</button>
          </div>
        )}
        {isMaster && (
          <div className="sidebar-actions" style={{ marginTop: '8px' }}>
            <button className="btn btn-sm btn-secondary btn-block" onClick={handleExportBackup}>Exportar Backup</button>
            <button className="btn btn-sm btn-secondary btn-block" onClick={() => importFileRef.current && importFileRef.current.click()}>Importar Backup</button>
            <input ref={importFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportBackup} />
          </div>
        )}
      </div>

      <div className="canvas-container">
        {isMaster && <Toolbar currentTool={currentTool} onToolChange={setCurrentTool} isMaster={isMaster} gridVisible={gridConfig.visible} onToggleGrid={handleToggleGrid} onOpenGridSettings={() => setShowGridModal(true)} onOpenTokenDialog={() => { setTokenClickPos({ x: 100, y: 100 }); setEditingToken(null); setShowTokenModal(true); }} onEditToken={handleEditToken} onDeleteToken={handleDeleteToken} onClearDrawings={handleClearDrawings} drawColor={drawColor} onDrawColorChange={setDrawColor} />}
        {(currentTool === 'fogReveal' || currentTool === 'fogHide') && isMaster && <FogControls brushSize={brushSize} onBrushSizeChange={setBrushSize} onRevealAll={handleRevealAll} onHideAll={handleHideAll} />}
        <div className="tools-row">
          <DiceRoller tableId={tableId} onClose={showDice ? () => setShowDice(false) : undefined} />
          <button className={'btn btn-sm ' + (showDice ? 'btn-primary' : '')} onClick={() => setShowDice(!showDice)}>{showDice ? '▲ Dados' : '▼ Dados'}</button>
          <InitiativeTracker tableId={tableId} tokens={visibleTokens} members={members} isMaster={isMaster} username={user.username} />
          <Soundboard tableId={tableId} isMaster={isMaster} />
        </div>
        {activeMap ? (
          <Suspense fallback={<div className="loading">Carregando mapa...</div>}>
            <MapCanvas map={activeMap} tokens={visibleTokens} gridConfig={gridConfig} fogRegions={fogRegions} drawings={drawings} annotations={annotations} isMaster={isMaster} currentTool={currentTool} onTokenMove={handleTokenMove} onFogUpdate={handleFogUpdate} onAddToken={handleAddToken} onTokenSelect={handleTokenSelect} stageRef={stageRef} brushSize={brushSize} canMoveToken={canMoveToken} masquerade={masquerade} drawColor={drawColor} onDrawingCreated={handleDrawingCreated} onAnnotationCreated={handleAnnotationCreated} onDrawingDeleted={handleDrawingDeleted} onAnnotationDeleted={handleAnnotationDeleted} onAnnotationUpdated={handleAnnotationUpdated} activeTokenId={activeCombatTokenId} tableId={tableId} />
          </Suspense>
        ) : <div className="empty-state">{isMaster ? 'Envie um mapa para comecar' : 'Nenhum mapa disponivel'}</div>}
      </div>

      <div className={'chat-container ' + (showChat ? 'chat-open' : 'chat-closed')}>
        <button className="chat-toggle" onClick={toggleChat}>{showChat ? '▶' : '◀ Chat'}{!showChat && unreadChat > 0 && <span className="chat-badge">{unreadChat > 99 ? '99+' : unreadChat}</span>}</button>
        {showChat && <ChatPanel tableId={tableId} userId={user.id} username={user.username} isMaster={isMaster} isMuted={isMuted} whisperTarget={whisperTarget} onWhisperDone={() => setWhisperTarget(null)} />}
      </div>

      {showUploadModal && (<div className="modal-overlay" onClick={() => { setShowUploadModal(false); setMapFile(null); }}><div className="modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => { setShowUploadModal(false); setMapFile(null); }}>×</button><h2>Adicionar Mapa</h2><form onSubmit={handleUploadMap}><div className="form-group"><label>Nome</label><input value={uploadForm.name} onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })} required /></div><div className="form-group"><label>Arquivo do mapa</label><input type="file" accept="image/*,video/*" onChange={(e) => setMapFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} /><small style={{ color: '#aaa' }}>Imagens (JPG, PNG, WebP) ou videos (MP4, WebM) - ate 50MB</small></div><div className="form-group"><label>URL do mapa (se nao enviar arquivo)</label><input type="url" placeholder="https://exemplo.com/mapa.jpg" value={uploadForm.imageUrl} onChange={(e) => setUploadForm({ ...uploadForm, imageUrl: e.target.value })} /></div><div className="form-group"><label>Largura (px)</label><input type="number" value={uploadForm.width} onChange={(e) => setUploadForm({ ...uploadForm, width: Number(e.target.value) })} min={100} /></div><div className="form-group"><label>Altura (px)</label><input type="number" value={uploadForm.height} onChange={(e) => setUploadForm({ ...uploadForm, height: Number(e.target.value) })} min={100} /></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => { setShowUploadModal(false); setMapFile(null); }}>Cancelar</button><button type="submit" className="btn btn-primary">Adicionar</button></div></form></div></div>)}
      {editingMap && (<div className="modal-overlay" onClick={() => setEditingMap(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setEditingMap(null)}>×</button><h2>Editar Mapa</h2><form onSubmit={handleUpdateMap}><div className="form-group"><label>Nome</label><input value={editMapForm.name} onChange={(e) => setEditMapForm({ ...editMapForm, name: e.target.value })} required /></div><div className="form-group"><label>Substituir imagem/video (opcional)</label><input type="file" accept="image/*,video/*" onChange={(e) => setEditMapFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} /><small style={{ color: '#aaa' }}>Deixe vazio para manter a imagem atual</small></div><div className="form-group" style={{ display: 'flex', gap: '10px' }}><div style={{ flex: 1 }}><label>Largura (px)</label><input type="number" value={editMapForm.width} onChange={(e) => setEditMapForm({ ...editMapForm, width: e.target.value })} min={100} /></div><div style={{ flex: 1 }}><label>Altura (px)</label><input type="number" value={editMapForm.height} onChange={(e) => setEditMapForm({ ...editMapForm, height: e.target.value })} min={100} /></div></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setEditingMap(null)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div></form></div></div>)}
      {showTokenModal && <TokenDialog open={showTokenModal} onClose={() => { setShowTokenModal(false); setTokenClickPos(null); setEditingToken(null); }} onSubmit={handleTokenSubmit} members={members} tableId={tableId} token={editingToken} />}
      {showGridModal && <GridSettings open={showGridModal} onClose={() => setShowGridModal(false)} config={gridConfig} onSave={handleSaveGrid} />}
      {showPermModal && selectedToken && <PermissionDialog open={showPermModal} onClose={() => { setShowPermModal(false); setSelectedToken(null); }} token={selectedToken} members={members} tableId={tableId} mapId={activeMap.id} onSave={handleSavePermissions} />}
      {showAddMemberModal && (<div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setShowAddMemberModal(false)}>×</button><h2>Adicionar Membro</h2><form onSubmit={handleAddMember}><div className="form-group"><label>Nome de usuario</label><input value={addMemberForm.username} onChange={(e) => setAddMemberForm({ ...addMemberForm, username: e.target.value })} required /></div><div className="form-group"><label>Cargo</label><select value={addMemberForm.role} onChange={(e) => setAddMemberForm({ ...addMemberForm, role: e.target.value })}><option value="PLAYER">Jogador</option><option value="MASTER">Mestre</option></select></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowAddMemberModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Adicionar</button></div></form></div></div>)}
      {showCharList && <CharacterList tableId={tableId} userId={user.id} isMaster={isMaster} onClose={() => setShowCharList(false)} onSelectCharacter={handleSelectCharacter} />}
      {selectedCharacter && <CharacterSheet character={selectedCharacter} tableId={tableId} onClose={() => setSelectedCharacter(null)} isOwner={selectedCharacter.userId === user.id} isMaster={isMaster} />}
    </div>
  );
}