import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { defaultDnd5eData } from './Dnd5eSheetBody';

const SECTIONS = [
  { kind: 'pc', title: 'Ficha de Personagens', btn: '+ Personagem' },
  { kind: 'npc', title: 'Ficha de NPCs', btn: '+ NPC' },
  { kind: 'monster', title: 'Ficha de Monstros', btn: '+ Monstro' },
];

export default function CharacterList({ tableId, userId, isMaster, onClose, onSelectCharacter, onDeleteCharacter }) {
  const [characters, setCharacters] = useState([]);
  const [showCreate, setShowCreate] = useState(null);
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
      const payload = { name: form.name.trim(), system: form.system, kind: showCreate };
      if (form.system === 'dnd5e') payload.data = defaultDnd5eData();
      const data = await api.characters.create(tableId, payload);
      setCharacters((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
      setShowCreate(null);
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

  const canOpen = (c) => c.userId === userId || isMaster || (c.permissions || []).some((p) => p.userId === userId && (p.canView || p.canControl));
  const canEdit = (c) => c.userId === userId || isMaster || (c.permissions || []).some((p) => p.userId === userId && p.canControl);

  function renderItem(c) {
    return (
      <div key={c.id} className="char-list-item" onClick={() => canOpen(c) && onSelectCharacter?.(c)}>
        <div className="char-list-info">
          <span className="char-list-name">{c.name}{c.system === 'dnd5e' && <span className="badge badge-master" style={{ marginLeft: 6, fontSize: 10 }}>D&D 5e</span>}{(c.permissions || []).some((p) => p.userId === userId) && <span className="badge badge-player" style={{ marginLeft: 6, fontSize: 10 }}>compartilhada</span>}</span>
          {c.user && <span className="char-list-user">por {c.user.username}</span>}
          {c.data?.hp?.max > 0 && (
            <div className="char-list-hp-mini">
              <div className="char-list-hp-mini-fill" style={{ width: Math.max(0, Math.min(100, ((c.data.hp.current + (c.data.hp.temp || 0)) / c.data.hp.max * 100))) + '%', backgroundColor: (c.data.hp.current + (c.data.hp.temp || 0)) / c.data.hp.max > 0.5 ? '#50fa7b' : '#ff5555' }} />
              <span>{c.data.hp.current}/{c.data.hp.max}</span>
            </div>
          )}
        </div>
        <div className="char-list-actions">
          {canEdit(c) && (
            <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onSelectCharacter?.(c); }}>Abrir</button>
          )}
          {(c.userId === userId || isMaster) && (
            <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); confirmDelete(c); }}>×</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Fichas</h2>

        {SECTIONS.map((sec) => {
          const list = characters.filter((c) => (c.kind || 'pc') === sec.kind);
          return (
            <div key={sec.kind} className="char-section">
              <div className="char-section-header">
                <h3>{sec.title}</h3>
                {(sec.kind === 'pc' || isMaster) && (
                  <button className="btn btn-sm btn-primary" onClick={() => { setForm({ name: '', system: 'dnd5e' }); setShowCreate(sec.kind); }}>+ Ficha</button>
                )}
              </div>
              {list.map(renderItem)}
              {list.length === 0 && <div className="char-list-empty">{sec.kind === 'pc' ? 'Nenhuma ficha de personagem.' : (isMaster ? 'Nenhuma ficha aqui ainda.' : 'Sem fichas compartilhadas com voce.')}</div>}
            </div>
          );
        })}

        {showCreate && (
          <div style={{ marginTop: '12px', padding: '12px', background: '#1a1a2e', borderRadius: '6px' }}>
            <div className="form-group">
              <label>Nome</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={showCreate === 'monster' ? 'Nome do monstro' : showCreate === 'npc' ? 'Nome do NPC' : 'Nome do personagem'} autoFocus />
            </div>
            <div className="form-group">
              <label>Sistema</label>
              <select value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })}>
                <option value="dnd5e">D&D 5e</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(null)}>Cancelar</button>
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
