import { useState, useEffect } from 'react';
import api, { resolveUrl } from '../services/api';
import { STATUS_MARKERS } from './tokenMarkers';

const BAR_COLORS = ['#50fa7b', '#ff5555', '#8be9fd', '#f1fa8c', '#bd93f9'];
const TABS = [
  { key: 'geral', label: 'Geral' },
  { key: 'status', label: 'Status' },
  { key: 'permissoes', label: 'Permissões' },
  { key: 'visual', label: 'Visual' },
  { key: 'visao', label: 'Visão' },
  { key: 'avancado', label: 'Avançado' },
];

function emptyBar(i) { return { label: `Barra ${i + 1}`, current: 0, max: 100, visible: true, color: BAR_COLORS[i % BAR_COLORS.length] }; }

function loadBars(token) {
  const arr = Array.isArray(token && token.bars) ? token.bars.slice(0, 3) : [];
  return [0, 1, 2].map((i) => (arr[i] ? { ...emptyBar(i), ...arr[i] } : null));
}

export default function TokenDialog({ open, onClose, onSubmit, members, tableId, token, cellSize = 50, onOpenPermissions }) {
  const [tab, setTab] = useState('geral');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState('character');
  const [imageUrl, setImageUrl] = useState('');
  const [width, setWidth] = useState(40);
  const [height, setHeight] = useState(40);
  const [rotation, setRotation] = useState(0);
  const [layer, setLayer] = useState(2);
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [lightRadius, setLightRadius] = useState(0);
  const [visionRadius, setVisionRadius] = useState(0);
  const [ownerId, setOwnerId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [showName, setShowName] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [bars, setBars] = useState([null, null, null]);
  const [markers, setMarkers] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    setUploading(true);
    try { const d = await api.uploads.create(file); setImageUrl(d.url); } catch { alert('Erro ao enviar imagem'); }
    setUploading(false); e.target.value = '';
  }

  useEffect(() => {
    if (open && tableId) {
      api.characters.getAll(tableId).then((d) => setCharacters(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [open, tableId]);

  useEffect(() => {
    if (!open) return;
    setTab('geral');
    if (token) {
      setName(token.name || ''); setDisplayName(token.displayName || ''); setType(token.type || 'character'); setImageUrl(token.imageUrl || ''); setWidth(token.width || 40); setHeight(token.height || 40); setRotation(token.rotation || 0); setLayer(token.layer || 2); setVisible(token.visible !== false); setLocked(token.locked === true); setSnapToGrid(token.snapToGrid !== false); setLightRadius(token.lightRadius || 0); setVisionRadius(token.visionRadius || 0); setOwnerId(token.ownerId || ''); setCharacterId(token.characterId || ''); setShowName(token.showName !== false); setOpacity(typeof token.opacity === 'number' ? token.opacity : 1); setBars(loadBars(token)); setMarkers(Array.isArray(token.statusMarkers) ? token.statusMarkers : []);
    } else {
      setName(''); setDisplayName(''); setType('character'); setImageUrl(''); setWidth(cellSize || 40); setHeight(cellSize || 40); setRotation(0); setLayer(2); setVisible(true); setLocked(false); setSnapToGrid(true); setLightRadius(0); setVisionRadius(0); setOwnerId(''); setCharacterId(''); setShowName(true); setOpacity(1); setBars([null, null, null]); setMarkers([]);
    }
  }, [open, token, cellSize]);

  if (!open) return null;

  function toggleMarker(key) { setMarkers((m) => (m.includes(key) ? m.filter((k) => k !== key) : [...m, key])); }
  function setBarSlot(i, patch) { setBars((b) => b.map((bar, idx) => (idx === i ? { ...emptyBar(i), ...bar, ...patch } : bar))); }
  function applySize(cells) { setWidth((cellSize || 50) * cells); setHeight((cellSize || 50) * cells); }

  function buildPayload() {
    return {
      name,
      displayName: displayName || null,
      type,
      imageUrl: imageUrl || null,
      width,
      height,
      rotation: Number(rotation) || 0,
      layer,
      visible,
      locked,
      snapToGrid,
      lightRadius: Number(lightRadius) || 0,
      visionRadius: Number(visionRadius) || 0,
      ownerId: ownerId || null,
      characterId: characterId || null,
      showName,
      opacity: Number(opacity) || 1,
      bars: bars.filter(Boolean),
      statusMarkers: markers,
    };
  }

  function resetForm() {
    setName(''); setDisplayName(''); setType('character'); setImageUrl(''); setWidth(cellSize || 40); setHeight(cellSize || 40); setRotation(0); setLayer(2); setVisible(true); setLocked(false); setSnapToGrid(true); setLightRadius(0); setVisionRadius(0); setOwnerId(''); setCharacterId(''); setShowName(true); setOpacity(1); setBars([null, null, null]); setMarkers([]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(buildPayload());
    if (!token) resetForm();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{token ? 'Editar Token' : 'Novo Token'}</h2>
        <div className="tab-nav">
          {TABS.map((t) => <button key={t.key} type="button" className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>
        <form onSubmit={handleSubmit}>
          {tab === 'geral' && (
            <>
              <div className="form-group"><label>Nome</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="form-group"><label>Nome de exibição (opcional)</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Deixe vazio para usar o nome" /><small style={{ color: '#aaa' }}>Jogadores veem este nome em vez do nome real.</small></div>
              <div className="form-group"><label>Tipo</label><select value={type} onChange={(e) => setType(e.target.value)}><option value="character">Personagem</option><option value="npc">NPC</option><option value="monster">Monstro</option><option value="object">Objeto</option><option value="marker">Marcador</option></select></div>
              <div className="form-group"><label>Ficha</label><select value={characterId} onChange={(e) => setCharacterId(e.target.value)}><option value="">Nenhuma</option>{characters.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
              <div className="form-group"><label>Imagem (arquivo ou URL)</label><input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} /><input type="url" placeholder="https://exemplo.com/imagem.png" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /><small style={{ color: '#aaa' }}>{uploading ? 'Enviando arquivo...' : 'Envie um arquivo ou cole o link de uma imagem hospedada.'}</small>{imageUrl && <img src={resolveUrl(imageUrl)} alt="preview" style={{ maxWidth: '100%', maxHeight: 120, marginTop: 6, borderRadius: 4, display: 'block' }} />}</div>
              <div className="form-group"><label>Tamanho</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4].map((n) => <button key={n} type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => applySize(n)}>{n}x{n}</button>)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} min={10} aria-label="Largura" />
                  <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} min={10} aria-label="Altura" />
                </div>
              </div>
              <div className="form-group"><label>Rotação (graus)</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[0, 45, 90, 180, 270].map((r) => <button key={r} type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12, background: Number(rotation) === r ? '#e94560' : undefined }} onClick={() => setRotation(r)}>{r}°</button>)}
                </div>
                <input type="number" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} min={0} max={359} style={{ marginTop: 6 }} />
              </div>
            </>
          )}
          {tab === 'status' && (
            <>
              <div className="form-group"><label>Barras de status (até 3)</label></div>
              {bars.map((bar, i) => (
                <div key={i} className="bar-slot">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={Boolean(bar)} onChange={(e) => setBars((b) => b.map((x, idx) => (idx === i ? (e.target.checked ? emptyBar(i) : null) : x)))} /> Barra {i + 1}
                  </label>
                  {bar && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 40px', gap: 6, marginTop: 6, alignItems: 'center' }}>
                      <input value={bar.label} onChange={(e) => setBarSlot(i, { label: e.target.value })} placeholder="Rótulo" />
                      <input type="number" value={bar.current} onChange={(e) => setBarSlot(i, { current: Number(e.target.value) })} title="Atual" />
                      <input type="number" value={bar.max} onChange={(e) => setBarSlot(i, { max: Number(e.target.value) })} title="Máximo" />
                      <input type="color" value={bar.color} onChange={(e) => setBarSlot(i, { color: e.target.value })} title="Cor" />
                    </div>
                  )}
                </div>
              ))}
              <div className="form-group" style={{ marginTop: 12 }}><label>Marcadores de condição</label>
                <div className="marker-grid">
                  {STATUS_MARKERS.map((m) => (
                    <button key={m.key} type="button" className={`marker-btn${markers.includes(m.key) ? ' active' : ''}`} onClick={() => toggleMarker(m.key)} title={m.label}>
                      <span className="marker-emoji">{m.emoji}</span><span className="marker-label">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {tab === 'permissoes' && (
            <>
              <div className="form-group"><label>Dono do token</label><select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}><option value="">Nenhum</option>{members.map((m) => { const u = m.user || m; return <option key={u.id} value={u.id}>{u.username}</option>; })}</select><small style={{ color: '#aaa' }}>O dono pode mover e editar este token.</small></div>
              {onOpenPermissions && token && (
                <div className="form-group">
                  <button type="button" className="btn btn-secondary" onClick={() => onOpenPermissions(token)}>👥 Permissões por membro</button>
                  <small style={{ color: '#aaa', display: 'block', marginTop: 4 }}>Defina ver, mover, redimensionar e excluir para cada membro.</small>
                </div>
              )}
            </>
          )}
          {tab === 'visual' && (
            <>
              <div className="form-group"><label><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Mostrar nome para jogadores</label><small style={{ color: '#aaa' }}>Se desmarcado, só o mestre vê o nome.</small></div>
              <div className="form-group"><label>Opacidade: {Math.round(opacity * 100)}%</label><input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></div>
              <div className="form-group"><label>Camada</label><select value={layer} onChange={(e) => setLayer(Number(e.target.value))}><option value={1}>Efeitos / Marcadores</option><option value={2}>Personagens / Objetos</option><option value={5}>Camada do Mestre</option></select><small style={{ color: '#aaa' }}>A camada do Mestre só é visível para você.</small></div>
            </>
          )}
          {tab === 'visao' && (
            <>
              <div className="form-group"><label>Raio de luz (px, 0 = sem luz)</label><input type="number" value={lightRadius} onChange={(e) => setLightRadius(Number(e.target.value))} min={0} max={500} /><small style={{ color: '#aaa' }}>Ilumina a neblina ao redor do token (apenas com Masquerade OFF).</small></div>
              <div className="form-group"><label>Raio de visão (pes, 0 = padrão)</label><input type="number" value={visionRadius} onChange={(e) => setVisionRadius(Number(e.target.value))} min={0} max={500} /><small style={{ color: '#aaa' }}>Área onde o token enxerga mesmo com neblina. Convertido com a grade atual (ex.: 9ft/célula).</small></div>
            </>
          )}
          {tab === 'avancado' && (
            <>
              <div className="form-group"><label><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visível para jogadores</label></div>
              <div className="form-group"><label><input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> Travado (não pode ser movido)</label></div>
              <div className="form-group"><label><input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} /> Encaixar na grade ao mover</label></div>
              {token && (
                <div className="form-group">
                  <small style={{ color: '#888', display: 'block' }}>ID: {token.id}</small>
                  <small style={{ color: '#888', display: 'block' }}>Posição: {Math.round(token.x)}, {Math.round(token.y)} px</small>
                </div>
              )}
            </>
          )}
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">{token ? 'Salvar' : 'Criar'}</button></div>
        </form>
      </div>
    </div>
  );
}
