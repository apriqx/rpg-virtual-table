import { useState } from 'react';

export default function TokenDialog({ open, onClose, onSubmit, members }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('character');
  const [imageFile, setImageFile] = useState(null);
  const [width, setWidth] = useState(40);
  const [height, setHeight] = useState(40);
  const [layer, setLayer] = useState(2);
  const [visible, setVisible] = useState(true);
  const [ownerId, setOwnerId] = useState('');

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ name, type, imageFile, width, height, layer, visible, ownerId: ownerId || null });
    setName('');
    setType('character');
    setImageFile(null);
    setWidth(40);
    setHeight(40);
    setLayer(2);
    setVisible(true);
    setOwnerId('');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Novo Token</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="character">Personagem</option>
              <option value="npc">NPC</option>
              <option value="monster">Monstro</option>
              <option value="object">Objeto</option>
              <option value="marker">Marcador</option>
            </select>
          </div>
          <div className="form-group">
            <label>Imagem (opcional)</label>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0] || null)} />
          </div>
          <div className="form-group">
            <label>Largura (px)</label>
            <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} min={10} />
          </div>
          <div className="form-group">
            <label>Altura (px)</label>
            <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} min={10} />
          </div>
          <div className="form-group">
            <label>Camada</label>
            <select value={layer} onChange={(e) => setLayer(Number(e.target.value))}>
              <option value={2}>Personagens / Objetos</option>
              <option value={5}>Camada do Mestre</option>
            </select>
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              Visivel para jogadores
            </label>
          </div>
          <div className="form-group">
            <label>Dono</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Nenhum</option>
              {members.map((m) => {
                const u = m.user || m;
                return <option key={u.id} value={u.id}>{u.username}</option>;
              })}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Criar</button>
          </div>
        </form>
      </div>
    </div>
  );
}