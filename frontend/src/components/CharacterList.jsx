import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { defaultDnd5eData } from './Dnd5eSheetBody';

export default function CharacterList({ tableId, userId, isMaster, onClose, onSelectCharacter, onDeleteCharacter }) {
  const [characters, setCharacters] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', system: 'dnd5e' });
  const [charToDelete, setCharToDelete] = useState(null);

  const load = useCallback(async () => {
    const data = await api.characters.getAll(tableId);
    setCharacters(Array.isArray(data) ? data : []);
  }, [tableId]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!form.name.trim()) return;
    try {
      const payload = { name: form.name.trim(), system: form.system };
      if (form.system === 'dnd5e') payload.data = defaultDnd5eData();
      const data = await api.characters.create(tableId, payload);
      setCharacters((prev) => [...prev, data]);
      setShowCreate(false);
      setForm({ name: '', system: 'dnd5e' });
    } catch (err) { alert(err.response?.data?.error || 'Erro ao criar ficha'); }
  }

  function confirmDelete(char) {
    setCharToDelete(char);
  }

  async function doDelete() {
    if (!charToDelete) return;
    try {
      await api.characters.remove(tableId, charToDelete.id);
      setCharacters((prev) => prev.filter((c) => c.id !== charToDelete.id));
      setCharToDelete(null);
    } catch { alert('Erro ao excluir ficha'); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Fichas de Personagem</h2>

        {!showCreate ? (
          <>
            {characters.map((c) => (
              <div key={c.id} className="char-list-item" onClick={() => onSelectCharacter?.(c)}>
                <div className="char-list-info">
                  <span className="char-list-name">{c.name}{c.system === 'dnd5e' && <span className="badge badge-master" style={{ marginLeft: 6, fontSize: 10 }}>D&D 5e</span>}</span>
                  {c.user && <span className="char-list-user">por {c.user.username}</span>}
                  {c.data?.hp?.max > 0 && (
                    <div className="char-list-hp-mini">
                      <div className="char-list-hp-mini-fill" style={{ width: Math.max(0, Math.min(100, ((c.data.hp.current + (c.data.hp.temp || 0)) / c.data.hp.max * 100))) + '%', backgroundColor: (c.data.hp.current + (c.data.hp.temp || 0)) / c.data.hp.max > 0.5 ? '#50fa7b' : '#ff5555' }} />
                      <span>{c.data.hp.current}/{c.data.hp.max}</span>
                    </div>
                  )}
                </div>
                <div className="char-list-actions">
                  {(c.userId === userId || isMaster) && (
                    <>
                      <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onSelectCharacter?.(c); }}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); confirmDelete(c); }}>×</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {characters.length === 0 && <div className="char-list-empty">Nenhuma ficha. Crie uma para vincular a tokens.</div>}
            <button className="btn btn-primary btn-block" onClick={() => setShowCreate(true)}>+ Nova Ficha</button>
          </>
        ) : (
          <div style={{ marginBottom: '12px' }}>
            <div className="form-group">
              <label>Nome</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do personagem" autoFocus />
            </div>
            <div className="form-group">
              <label>Sistema</label>
              <select value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })}>
                <option value="dnd5e">D&D 5e</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={create}>Criar</button>
            </div>
          </div>
        )}

        {charToDelete && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#2a1a1a', borderRadius: '6px' }}>
            <p style={{ marginBottom: '8px' }}>Excluir "{charToDelete.name}"?</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCharToDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={doDelete}>Excluir</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}