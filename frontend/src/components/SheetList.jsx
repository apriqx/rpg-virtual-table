// Itens 14-25/36: lista e edicao das Folhas do mestre
import { useState } from 'react';
import api, { resolveUrl } from '../services/api';

export default function SheetList({ tableId, sheets, isMaster, onChanged, onClose, onOpenSheet }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', imageUrl: '', comments: '', masterNotes: '', visibleToPlayers: false });
  const [saving, setSaving] = useState(false);

  function startCreate() {
    setEditing('new');
    setForm({ title: '', imageUrl: '', comments: '', masterNotes: '', visibleToPlayers: false });
  }

  function startEdit(sheet) {
    setEditing(sheet.id);
    setForm({
      title: sheet.title || '',
      imageUrl: sheet.imageUrl || '',
      comments: sheet.comments || '',
      masterNotes: sheet.masterNotes || '',
      visibleToPlayers: sheet.visibleToPlayers === true,
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === 'new') await api.sheets.create(tableId, form);
      else await api.sheets.update(tableId, editing, form);
      setEditing(null);
      onChanged?.();
    } catch { alert('Erro ao salvar folha'); }
    finally { setSaving(false); }
  }

  async function handleDelete(sheet) {
    if (!window.confirm(`Excluir a folha "${sheet.title}"?`)) return;
    try { await api.sheets.remove(tableId, sheet.id); if (editing === sheet.id) setEditing(null); onChanged?.(); }
    catch { alert('Erro ao excluir folha'); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflow: 'auto' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Folhas</h2>
        <p style={{ color: '#aaa', fontSize: 12, marginTop: -6 }}>
          {isMaster ? 'Documentos do mestre: mapas, retratos, notas de sessao. Marque "Visivel" para compartilhar com os jogadores.' : 'Documentos compartilhados pelo mestre.'}
        </p>

        {(sheets || []).length === 0 && !isMaster && <p style={{ color: '#777' }}>Nenhuma folha compartilhada ainda.</p>}
        {(sheets || []).length === 0 && isMaster && !editing && <p style={{ color: '#777' }}>Nenhuma folha ainda. Crie a primeira abaixo.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0' }}>
          {(sheets || []).map((sheet) => (
            <div key={sheet.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#1a1a2e', border: '1px solid #333', borderRadius: 4 }}>
              {sheet.imageUrl && <img src={resolveUrl(sheet.imageUrl)} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 3 }} onError={(ev) => { ev.target.style.display = 'none'; }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sheet.title}</div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {sheet.visibleToPlayers ? 'Visivel aos jogadores' : 'Privada'}
                  {sheet.masterNotes && isMaster ? ' - com notas privadas' : ''}
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => onOpenSheet?.(sheet)}>Abrir</button>
              {isMaster && <button className="btn btn-sm" onClick={() => startEdit(sheet)}>Editar</button>}
              {isMaster && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(sheet)}>Excluir</button>}
            </div>
          ))}
        </div>

        {isMaster && !editing && <button className="btn btn-primary" onClick={startCreate}>+ Nova Folha</button>}

        {isMaster && editing && (
          <form onSubmit={handleSave} style={{ borderTop: '1px solid #333', paddingTop: 10, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{editing === 'new' ? 'Nova Folha' : 'Editar Folha'}</h3>
            <div className="form-group">
              <label>Titulo</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required autoFocus />
            </div>
            <div className="form-group">
              <label>Imagem por URL</label>
              <input type="url" placeholder="https://exemplo.com/imagem.jpg" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
              {form.imageUrl && <img src={resolveUrl(form.imageUrl)} alt="preview" style={{ maxWidth: '100%', maxHeight: 110, marginTop: 6, borderRadius: 4, display: 'block' }} onError={(ev) => { ev.target.style.display = 'none'; }} />}
            </div>
            <div className="form-group">
              <label>Comentarios</label>
              <textarea rows={4} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} placeholder="Texto visivel a quem pode ver a folha" />
            </div>
            <div className="form-group">
              <label>Anotacoes privadas (so o mestre ve)</label>
              <textarea rows={3} value={form.masterNotes} onChange={(e) => setForm({ ...form, masterNotes: e.target.value })} />
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={form.visibleToPlayers} onChange={(e) => setForm({ ...form, visibleToPlayers: e.target.checked })} />
              Visivel para jogadores
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
