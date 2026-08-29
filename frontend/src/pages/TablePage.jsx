import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import MapCanvas from '../components/MapCanvas';
import Toolbar from '../components/Toolbar';
import TokenDialog from '../components/TokenDialog';
import GridSettings from '../components/GridSettings';
import PermissionDialog from '../components/PermissionDialog';
import FogControls from '../components/FogControls';

const DEFAULT_GRID = {
  cellSize: 50,
  physicalSize: 1.5,
  visible: true,
  lineThickness: 1,
  lineOpacity: 0.3,
  offsetX: 0,
  offsetY: 0,
  snapToGrid: false,
};

export default function TablePage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const stageRef = useRef(null);

  const [table, setTable] = useState(null);
  const [maps, setMaps] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeMap, setActiveMap] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [gridConfig, setGridConfig] = useState(DEFAULT_GRID);
  const [fogRegions, setFogRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTool, setCurrentTool] = useState('select');
  const [selectedToken, setSelectedToken] = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showGridModal, setShowGridModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [tokenClickPos, setTokenClickPos] = useState(null);

  const [uploadForm, setUploadForm] = useState({ name: '', width: 1920, height: 1080, imageUrl: '' });
  const [addMemberForm, setAddMemberForm] = useState({ username: '', role: 'PLAYER' });
  const [brushSize, setBrushSize] = useState(50);

  const isMaster = user.role === 'ADMIN' || table?.members?.some(
    (m) => (m.userId === user.id || m.user?.id === user.id) && m.role === 'MASTER'
  );

  const loadTable = useCallback(async () => {
    try {
      const data = await api.tables.getOne(tableId);
      setTable(data.table);
      setMembers(data.members || []);
      setMaps(data.maps || []);
      const active = (data.maps || []).find((m) => m.active) || (data.maps || [])[0];
      if (active) {
        setActiveMap(active);
        await loadMapData(active.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    } catch (err) {
      console.error(err);
    }
  }, [tableId]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  async function handleSwitchMap(mapId) {
    if (isMaster && activeMap) {
      await api.maps.update(tableId, activeMap.id, { active: false });
    }
    await api.maps.update(tableId, mapId, { active: true });
    const updatedMaps = maps.map((m) => ({ ...m, active: m.id === mapId }));
    setMaps(updatedMaps);
    const newActive = updatedMaps.find((m) => m.id === mapId);
    setActiveMap(newActive);
    setSelectedToken(null);
    await loadMapData(mapId);
  }

  async function handleUploadMap(e) {
    e.preventDefault();
    if (!uploadForm.imageUrl.trim()) {
      alert('Cole a URL do mapa');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('name', uploadForm.name);
      formData.append('imageUrl', uploadForm.imageUrl.trim());
      formData.append('width', uploadForm.width);
      formData.append('height', uploadForm.height);
      formData.append('active', maps.length === 0 ? 'true' : 'false');
      const data = await api.maps.create(tableId, formData);
      const newMaps = [...maps, data.map];
      setMaps(newMaps);
      if (newMaps.length === 1) {
        setActiveMap(data.map);
        await loadMapData(data.map.id);
      }
      setShowUploadModal(false);
      setUploadForm({ name: '', width: 1920, height: 1080, imageUrl: '' });
    } catch (err) {
      alert('Erro ao adicionar mapa: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleDeleteMap(mapId) {
    if (!window.confirm('Excluir este mapa?')) return;
    try {
      await api.maps.remove(tableId, mapId);
      const newMaps = maps.filter((m) => m.id !== mapId);
      setMaps(newMaps);
      if (activeMap?.id === mapId) {
        const next = newMaps[0] || null;
        setActiveMap(next);
        if (next) {
          await api.maps.update(tableId, next.id, { active: true });
          await loadMapData(next.id);
        } else {
          setTokens([]);
          setFogRegions([]);
        }
      }
    } catch {
      alert('Erro ao excluir mapa');
    }
  }

  async function handleTokenMove(tokenId, x, y) {
    setTokens((prev) => prev.map((t) => (t.id === tokenId ? { ...t, x, y } : t)));
    try {
      await api.tokens.update(tableId, activeMap.id, tokenId, { x, y });
    } catch (err) {
      console.error(err);
      loadMapData(activeMap.id);
    }
  }

  async function handleFogUpdate(newRegions) {
    setFogRegions(newRegions);
    try {
      const toSend = newRegions.map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        revealed: r.revealed,
      }));
      await api.fog.batchUpdate(tableId, activeMap.id, toSend);
    } catch (err) {
      console.error(err);
      loadMapData(activeMap.id);
    }
  }

  async function handleAddToken(x, y) {
    setTokenClickPos({ x, y });
    setShowTokenModal(true);
  }

  async function handleTokenSubmit(formData) {
    try {
      const tokenData = {
        name: formData.name,
        type: formData.type,
        imageUrl: formData.imageUrl || null,
        x: tokenClickPos?.x || 0,
        y: tokenClickPos?.y || 0,
        width: Number(formData.width),
        height: Number(formData.height),
        layer: Number(formData.layer),
        visible: formData.visible,
        ownerId: formData.ownerId || null,
      };
      const data = await api.tokens.create(tableId, activeMap.id, tokenData);
      setTokens((prev) => [...prev, data.token]);
      setShowTokenModal(false);
      setTokenClickPos(null);
    } catch (err) {
      alert('Erro ao criar token');
    }
  }

  async function handleToggleGrid() {
    const newConfig = { ...gridConfig, visible: !gridConfig.visible };
    setGridConfig(newConfig);
    try {
      await api.grid.update(tableId, activeMap.id, newConfig);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveGrid(newConfig) {
    setGridConfig(newConfig);
    try {
      await api.grid.update(tableId, activeMap.id, newConfig);
      setShowGridModal(false);
    } catch (err) {
      alert('Erro ao salvar grade');
    }
  }

  function handleTokenSelect(tokenId) {
    if (!isMaster) return;
    const token = tokens.find((t) => t.id === tokenId);
    if (token) {
      setSelectedToken(token);
      setShowPermModal(true);
    }
  }

  async function handleSavePermissions(permissions) {
    try {
      await api.tokens.setPermissions(tableId, activeMap.id, selectedToken.id, permissions);
      setShowPermModal(false);
      setSelectedToken(null);
    } catch (err) {
      alert('Erro ao salvar permissoes');
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    try {
      await api.tables.addMember(tableId, addMemberForm.username, addMemberForm.role);
      setShowAddMemberModal(false);
      setAddMemberForm({ username: '', role: 'PLAYER' });
      loadTable();
    } catch (err) {
      alert(err.response?.data?.message || 'Erro ao adicionar membro');
    }
  }

  async function handleRemoveMember(userId) {
    if (!window.confirm('Remover este membro?')) return;
    try {
      await api.tables.removeMember(tableId, userId);
      loadTable();
    } catch {
      alert('Erro ao remover membro');
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await api.tables.updateMemberRole(tableId, userId, newRole);
      loadTable();
    } catch {
      alert('Erro ao alterar cargo');
    }
  }

  async function handleRevealAll() {
    if (!activeMap) return;
    const newRegions = [{ x: 0, y: 0, width: activeMap.width, height: activeMap.height, revealed: true }];
    setFogRegions(newRegions);
    try {
      await api.fog.batchUpdate(tableId, activeMap.id, newRegions);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleHideAll() {
    if (!activeMap) return;
    setFogRegions([]);
    try {
      await api.fog.batchUpdate(tableId, activeMap.id, []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteToken() {
    if (!selectedToken || !window.confirm('Excluir este token?')) return;
    try {
      await api.tokens.remove(tableId, activeMap.id, selectedToken.id);
      setTokens((prev) => prev.filter((t) => t.id !== selectedToken.id));
      setSelectedToken(null);
      setShowPermModal(false);
    } catch {
      alert('Erro ao excluir token');
    }
  }

  if (loading) return <div className="loading">Carregando...</div>;

  const visibleTokens = tokens.filter((t) => {
    if (!isMaster && t.layer === 5) return false;
    if (!isMaster && !t.visible) return false;
    return true;
  });

  return (
    <div className="table-page">
      <div className="sidebar">
        <div className="sidebar-header">
          <button className="btn btn-secondary btn-block back-btn" onClick={() => navigate('/')}>
            ← Voltar
          </button>
          <h2>{table?.name || 'Mesa'}</h2>
        </div>

        <h3>Mapas</h3>
        {maps.map((m) => (
          <div
            key={m.id}
            className={`map-item ${activeMap?.id === m.id ? 'active-map' : ''}`}
            onClick={() => handleSwitchMap(m.id)}
          >
            <span className="map-name">{m.name}</span>
            {isMaster && (
              <button className="map-delete" onClick={(e) => { e.stopPropagation(); handleDeleteMap(m.id); }}>×</button>
            )}
          </div>
        ))}
        {isMaster && (
          <div className="sidebar-actions">
            <button className="btn btn-sm btn-primary" onClick={() => setShowUploadModal(true)}>+ Mapa</button>
          </div>
        )}

        <h3>Membros</h3>
        {members.map((m) => {
          const memberUser = m.user || m;
          const memberRole = m.role;
          return (
            <div key={memberUser.id || m.userId} className="member-item">
              <span className="member-name">{memberUser.username}</span>
              <div className="member-actions">
                <span className={`badge ${memberRole === 'MASTER' ? 'badge-master' : 'badge-player'}`}>
                  {memberRole}
                </span>
                {isMaster && memberUser.id !== user.id && memberRole !== 'MASTER' && (
                  <button className="btn btn-sm btn-danger" onClick={() => handleRemoveMember(memberUser.id)}>×</button>
                )}
              </div>
            </div>
          );
        })}
        {isMaster && (
          <div className="sidebar-actions">
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddMemberModal(true)}>+ Membro</button>
          </div>
        )}
      </div>

      <div className="canvas-container">
        {isMaster && (
          <Toolbar
            currentTool={currentTool}
            onToolChange={setCurrentTool}
            isMaster={isMaster}
            gridVisible={gridConfig.visible}
            onToggleGrid={handleToggleGrid}
            onOpenGridSettings={() => setShowGridModal(true)}
            onOpenTokenDialog={() => { setTokenClickPos({ x: 100, y: 100 }); setShowTokenModal(true); }}
            onDeleteToken={handleDeleteToken}
          />
        )}
        {(currentTool === 'fogReveal' || currentTool === 'fogHide') && isMaster && (
          <FogControls
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            onRevealAll={handleRevealAll}
            onHideAll={handleHideAll}
          />
        )}
        {activeMap ? (
          <MapCanvas
            map={activeMap}
            tokens={visibleTokens}
            gridConfig={gridConfig}
            fogRegions={fogRegions}
            isMaster={isMaster}
            currentTool={currentTool}
            onTokenMove={handleTokenMove}
            onFogUpdate={handleFogUpdate}
            onAddToken={handleAddToken}
            onTokenSelect={handleTokenSelect}
            stageRef={stageRef}
            brushSize={brushSize}
          />
        ) : (
          <div className="empty-state">
            {isMaster ? 'Envie um mapa para comecar' : 'Nenhum mapa disponivel'}
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            <h2>Adicionar Mapa</h2>
            <form onSubmit={handleUploadMap}>
              <div className="form-group">
                <label>Nome</label>
                <input value={uploadForm.name} onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>URL do mapa (imagem ou video)</label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/mapa.jpg"
                  value={uploadForm.imageUrl}
                  onChange={(e) => setUploadForm({ ...uploadForm, imageUrl: e.target.value })}
                  required
                />
                <small style={{ color: '#aaa' }}>Imagens (JPG, PNG, WebP) ou videos (MP4, AVI) hospedados em qualquer servico</small>
              </div>
              <div className="form-group">
                <label>Largura (px)</label>
                <input type="number" value={uploadForm.width} onChange={(e) => setUploadForm({ ...uploadForm, width: Number(e.target.value) })} min={100} />
              </div>
              <div className="form-group">
                <label>Altura (px)</label>
                <input type="number" value={uploadForm.height} onChange={(e) => setUploadForm({ ...uploadForm, height: Number(e.target.value) })} min={100} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTokenModal && (
        <TokenDialog
          open={showTokenModal}
          onClose={() => { setShowTokenModal(false); setTokenClickPos(null); }}
          onSubmit={handleTokenSubmit}
          members={members}
        />
      )}

      {showGridModal && (
        <GridSettings
          open={showGridModal}
          onClose={() => setShowGridModal(false)}
          config={gridConfig}
          onSave={handleSaveGrid}
        />
      )}

      {showPermModal && selectedToken && (
        <PermissionDialog
          open={showPermModal}
          onClose={() => { setShowPermModal(false); setSelectedToken(null); }}
          token={selectedToken}
          members={members}
          tableId={tableId}
          mapId={activeMap.id}
          onSave={handleSavePermissions}
        />
      )}

      {showAddMemberModal && (
        <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddMemberModal(false)}>×</button>
            <h2>Adicionar Membro</h2>
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label>Nome de usuario</label>
                <input
                  value={addMemberForm.username}
                  onChange={(e) => setAddMemberForm({ ...addMemberForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Cargo</label>
                <select
                  value={addMemberForm.role}
                  onChange={(e) => setAddMemberForm({ ...addMemberForm, role: e.target.value })}
                >
                  <option value="PLAYER">Jogador</option>
                  <option value="MASTER">Mestre</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMemberModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
