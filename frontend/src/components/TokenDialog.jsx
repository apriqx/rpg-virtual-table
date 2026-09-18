import { useState, useEffect } from 'react';
import api, { resolveUrl } from '../services/api';

export default function TokenDialog({ open, onClose, onSubmit, members, tableId, token }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('character');
  const [imageUrl, setImageUrl] = useState('');
  const [width, setWidth] = useState(40);
  const [height, setHeight] = useState(40);
  const [layer, setLayer] = useState(2);
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [lightRadius, setLightRadius] = useState(0);
  const [ownerId, setOwnerId] = useState('');
  const [characterId, setCharacterId] = useState('');
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
    if (token) {
      setName(token.name || ''); setType(token.type || 'character'); setImageUrl(token.imageUrl || ''); setWidth(token.width || 40); setHeight(token.height || 40); setLayer(token.layer || 2); setVisible(token.visible !== false); setLocked(token.locked === true); setSnapToGrid(token.snapToGrid !== false); setLightRadius(token.lightRadius || 0); setOwnerId(token.ownerId || ''); setCharacterId(token.characterId || '');
    } else {
      setName(''); setType('character'); setImageUrl(''); setWidth(40); setHeight(40); setLayer(2); setVisible(true); setLocked(false); setSnapToGrid(true); setLightRadius(0); setOwnerId(''); setCharacterId('');
    }
  }, [open, token]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ name, type, imageUrl: imageUrl || null, width, height, layer, visible, locked, snapToGrid, lightRadius: Number(lightRadius) || 0, ownerId: ownerId || null, characterId: characterId || null });
    if (!token) { setName(''); setType('character'); setImageUrl(''); setWidth(40); setHeight(40); setLayer(2); setVisible(true); setLocked(false); setSnapToGrid(true); setLightRadius(0); setOwnerId(''); setCharacterId(''); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{token ? 'Editar Token' : 'Novo Token'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Nome</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="form-group"><label>Tipo</label><select value={type} onChange={(e) => setType(e.target.value)}><option value="character">Personagem</option><option value="npc">NPC</option><option value="monster">Monstro</option><option value="object">Objeto</option><option value="marker">Marcador</option></select></div>
          <div className="form-group"><label>Ficha</label><select value={characterId} onChange={(e) => setCharacterId(e.target.value)}><option value="">Nenhuma</option>{characters.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
          <div className="form-group"><label>Imagem (arquivo ou URL)</label><input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} /><input type="url" placeholder="https://exemplo.com/imagem.png" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} /><small style={{ color: '#aaa' }}>{uploading ? 'Enviando arquivo...' : 'Envie um arquivo ou cole o link de uma imagem hospedada.'}</small>{imageUrl && <img src={resolveUrl(imageUrl)} alt="preview" style={{ maxWidth: '100%', maxHeight: 120, marginTop: 6, borderRadius: 4, display: 'block' }} />}</div>
          <div className="form-group"><label>Largura (px)</label><input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} min={10} /></div>
          <div className="form-group"><label>Altura (px)</label><input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} min={10} /></div>
          <div className="form-group"><label>Camada</label><select value={layer} onChange={(e) => setLayer(Number(e.target.value))}><option value={2}>Personagens / Objetos</option><option value={5}>Camada do Mestre</option></select></div>
          <div className="form-group"><label>Raio de luz (px, 0 = sem luz)</label><input type="number" value={lightRadius} onChange={(e) => setLightRadius(Number(e.target.value))} min={0} max={500} /><small style={{ color: '#aaa' }}>Ilumina a neblina ao redor do token (apenas com Masquerade OFF).</small></div>
          <div className="form-group"><label><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visivel para jogadores</label></div>
          <div className="form-group"><label><input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> Travado (nao pode ser movido)</label></div>
          <div className="form-group"><label><input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} /> Encaixar na grade ao mover</label></div>
          <div className="form-group"><label>Dono</label><select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}><option value="">Nenhum</option>{members.map((m) => { const u = m.user || m; return <option key={u.id} value={u.id}>{u.username}</option>; })}</select></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">{token ? 'Salvar' : 'Criar'}</button></div>
        </form>
      </div>
    </div>
  );
}