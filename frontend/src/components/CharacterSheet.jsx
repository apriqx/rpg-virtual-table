import { useState, useEffect } from 'react';
import api, { resolveUrl } from '../services/api';
import Dnd5eSheetBody from './Dnd5eSheetBody';

export default function CharacterSheet({ character, tableId, onClose, isOwner, isMaster, userId, members }) {
  const [data, setData] = useState(character.data || {});
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(character.data || {});
  const [saving, setSaving] = useState(false);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [permSel, setPermSel] = useState(() => new Set());
  const [permCtrl, setPermCtrl] = useState(() => new Set());
  const [permSaving, setPermSaving] = useState(false);

  const myPerm = (character.permissions || []).find((p) => p.userId === userId);
  const canControl = isOwner || isMaster || Boolean(myPerm?.canControl);

  const hp = data.hp || { current: 0, max: 0, temp: 0 };
  const stats = data.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const combat = data.combat || { ac: 10, speed: 30, proficiency: 0 };
  const hpPercent = hp.max > 0 ? Math.max(0, Math.min(100, (hp.current + hp.temp) / hp.max * 100)) : 0;
  const hpColor = hpPercent > 50 ? '#50fa7b' : hpPercent > 25 ? '#f1fa8c' : '#ff5555';

  function startEdit() { setEditData(JSON.parse(JSON.stringify(data))); setEditing(true); }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.characters.update(tableId, character.id, { data: editData });
      setData(updated.data);
      setEditing(false);
    } catch (err) { alert('Erro ao salvar ficha'); }
    setSaving(false);
  }

  function cancelEdit() { setEditing(false); }

  async function quickHp(delta) {
    const cur = data.hp || { current: 0, max: 0, temp: 0 };
    const newHp = { ...cur, current: Math.max(0, Math.min(cur.max || 999, (cur.current || 0) + delta)) };
    setData((p) => ({ ...p, hp: newHp }));
    setEditData((p) => ({ ...p, hp: newHp }));
    try { await api.characters.update(tableId, character.id, { data: { ...data, hp: newHp } }); } catch {}
  }

  async function shortRest() {
    const d = data;
    const hd = d.hitDice || { total: '', used: 0 };
    const level = Number(d.level) || 1;
    const used = Number(hd.used) || 0;
    const maxSpend = Math.max(0, level - used);
    if (maxSpend < 1) { alert('Sem dados de vida disponiveis para gastar.'); return; }
    const dieM = String(hd.total || '').match(/d(\d+)/i);
    const die = dieM ? Number(dieM[1]) : 8;
    const conMod = Math.floor(((Number((d.abilities || {}).con) || 10) - 10) / 2);
    const perHd = Math.floor(die / 2) + 1 + conMod;
    const ans = window.prompt('Descanso Curto: gastar quantos dados de vida? (1-' + maxSpend + ')\nCada dado recupera ' + perHd + ' PV', '1');
    if (ans === null) return;
    const n = Math.max(0, Math.min(maxSpend, Number(ans) || 0));
    if (!n) return;
    const heal = n * perHd;
    const hp = d.hp || { current: 0, max: 0, temp: 0 };
    const newHp = { ...hp, current: Math.max(0, Math.min(hp.max || 999, (hp.current || 0) + heal)) };
    const newHd = { ...hd, used: used + n };
    const nd = { ...d, hp: newHp, hitDice: newHd };
    setData(nd); setEditData((p) => ({ ...p, hp: newHp, hitDice: newHd }));
    try { await api.characters.update(tableId, character.id, { data: nd }); } catch {}
    alert('Descanso curto: ' + n + ' dado(s) gasto(s), +' + heal + ' PV (agora ' + newHp.current + '/' + (hp.max || 0) + ').');
  }

  async function longRest() {
    if (!window.confirm('Descanso Longo: recuperar todos os PV, dados de vida, espacos de magia e salvaguardas contra morte?')) return;
    const d = data;
    const hp = { ...(d.hp || { current: 0, max: 0, temp: 0 }), current: Number((d.hp || {}).max) || 0, temp: 0 };
    const hitDice = { ...(d.hitDice || { total: '', used: 0 }), used: 0 };
    const sc = d.spellcasting || { ability: 'int', slots: [] };
    const slotsMax = Array.isArray(sc.slotsMax) && sc.slotsMax.length ? sc.slotsMax : (Array.isArray(sc.slots) ? sc.slots : []);
    const spellcasting = { ...sc, slots: slotsMax.slice() };
    const nd = { ...d, hp, hitDice, spellcasting, deathSaves: { successes: 0, failures: 0 } };
    setData(nd);
    setEditData((p) => ({ ...p, hp, hitDice, spellcasting, deathSaves: { successes: 0, failures: 0 } }));
    try { await api.characters.update(tableId, character.id, { data: nd }); } catch {}
    alert('Descanso longo concluido! PV ' + hp.current + '/' + (hp.max || 0) + ', dados de vida e espacos de magia restaurados.');
  }

  function openPerms() {
    const sel = new Set();
    const ctrl = new Set();
    (character.permissions || []).forEach((p) => { if (p.canView || p.canControl) sel.add(p.userId); if (p.canControl) ctrl.add(p.userId); });
    setPermSel(sel); setPermCtrl(ctrl);
    setShowPerms(true);
  }

  async function savePerms() {
    setPermSaving(true);
    try {
      const list = (members || []).filter((mm) => mm.role !== 'MASTER').map((mm) => {
        const uid = mm.userId || (mm.user || mm).id;
        const ctl = permCtrl.has(uid);
        return { userId: uid, canView: permSel.has(uid) || ctl, canControl: ctl };
      });
      const updated = await api.characters.setPermissions(tableId, character.id, list);
      character.permissions = updated.permissions;
      setShowPerms(false);
    } catch { alert('Erro ao salvar permissoes'); }
    setPermSaving(false);
  }

  async function handlePortraitChange(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
    setUploadingPortrait(true);
    try { const d = await api.uploads.create(file); setField('portrait', d.url); } catch { alert('Erro ao enviar retrato'); }
    setUploadingPortrait(false);
  }

  const modValue = (path, delta) => {
    const d = { ...editData };
    const parts = path.split('.');
    let obj = d;
    for (let i = 0; i < parts.length - 1; i++) { obj = obj[parts[i]]; }
    const last = parts[parts.length - 1];
    obj[last] = (obj[last] || 0) + delta;
    setEditData(d);
  };

  const setField = (path, val) => {
    const d = { ...editData };
    const parts = path.split('.');
    let obj = d;
    for (let i = 0; i < parts.length - 1; i++) { obj = obj[parts[i]]; }
    obj[parts[parts.length - 1]] = val;
    setEditData(d);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal char-sheet-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="char-header">
          <div className="char-portrait">
            {(editing ? editData.portrait : data.portrait)
              ? <img src={resolveUrl(editing ? editData.portrait : data.portrait)} alt="retrato" />
              : <span className="char-portrait-empty">?</span>}
          </div>
          <h2 style={{ flex: 1 }}>{character.name}</h2>
          {isMaster && (
            <button className="btn btn-sm btn-secondary" title="Quem pode ver/controlar esta ficha" onClick={openPerms}>👥 Permissoes</button>
          )}
          {canControl && !editing && (
            <button className="btn btn-sm btn-primary" onClick={startEdit}>Editar</button>
          )}
          {editing && (
            <div className="char-header-actions">
              <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              <button className="btn btn-sm btn-secondary" onClick={cancelEdit}>Cancelar</button>
            </div>
          )}
        </div>
        {editing && (isOwner || isMaster) && (
          <div className="char-portrait-upload">
            <span>{uploadingPortrait ? 'Enviando retrato...' : 'Retrato:'}</span>
            <input type="file" accept="image/*" onChange={handlePortraitChange} disabled={uploadingPortrait} />
          </div>
        )}

        {character.system === 'dnd5e' ? (
          <Dnd5eSheetBody editData={editData} setField={setField} editing={editing} tableId={tableId} onQuickHp={canControl ? quickHp : undefined} onShortRest={canControl ? shortRest : undefined} onLongRest={canControl ? longRest : undefined} />
        ) : (
        <>
        <div className="char-hp-section">
          <div className="char-hp-bar">
            <div className="char-hp-fill" style={{ width: hpPercent + '%', backgroundColor: hpColor }} />
          </div>
          <div className="char-hp-text">
            HP: {hp.current}/{hp.max} {hp.temp > 0 && <span className="char-hp-temp">+{hp.temp}</span>}
          </div>
          {editing && (
            <div className="char-hp-edit">
              <label>Atual:</label>
              <input type="number" value={editData.hp?.current ?? 0} onChange={(e) => setField('hp.current', Number(e.target.value))} />
              <label>Máx:</label>
              <input type="number" value={editData.hp?.max ?? 0} onChange={(e) => setField('hp.max', Number(e.target.value))} />
              <label>Temp:</label>
              <input type="number" value={editData.hp?.temp ?? 0} onChange={(e) => setField('hp.temp', Number(e.target.value))} />
            </div>
          )}
        </div>

        <div className="char-stats-grid">
          <div className="char-stat"><span className="char-stat-label">FOR</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.stats?.str ?? 10} onChange={(e) => setField('stats.str', Number(e.target.value))} /> : stats.str}</span></div>
          <div className="char-stat"><span className="char-stat-label">DES</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.stats?.dex ?? 10} onChange={(e) => setField('stats.dex', Number(e.target.value))} /> : stats.dex}</span></div>
          <div className="char-stat"><span className="char-stat-label">CON</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.stats?.con ?? 10} onChange={(e) => setField('stats.con', Number(e.target.value))} /> : stats.con}</span></div>
          <div className="char-stat"><span className="char-stat-label">INT</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.stats?.int ?? 10} onChange={(e) => setField('stats.int', Number(e.target.value))} /> : stats.int}</span></div>
          <div className="char-stat"><span className="char-stat-label">SAB</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.stats?.wis ?? 10} onChange={(e) => setField('stats.wis', Number(e.target.value))} /> : stats.wis}</span></div>
          <div className="char-stat"><span className="char-stat-label">CAR</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.stats?.cha ?? 10} onChange={(e) => setField('stats.cha', Number(e.target.value))} /> : stats.cha}</span></div>
        </div>

        <div className="char-combat-section">
          <h3>Combate</h3>
          <div className="char-combat-grid">
            <div className="char-stat"><span className="char-stat-label">CA</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.combat?.ac ?? 10} onChange={(e) => setField('combat.ac', Number(e.target.value))} /> : combat.ac}</span></div>
            <div className="char-stat"><span className="char-stat-label">Velocidade</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.combat?.speed ?? 30} onChange={(e) => setField('combat.speed', Number(e.target.value))} /> : combat.speed + 'ft'}</span></div>
            <div className="char-stat"><span className="char-stat-label">Proficiencia</span><span>{editing ? <input className="char-stat-input" type="number" value={editData.combat?.proficiency ?? 0} onChange={(e) => setField('combat.proficiency', Number(e.target.value))} /> : '+' + combat.proficiency}</span></div>
          </div>
        </div>

        <div className="char-notes-section">
          <h3>Notas</h3>
          {editing ? (
            <textarea className="char-notes-input" value={editData.notes || ''} onChange={(e) => setField('notes', e.target.value)} rows={5} />
          ) : (
            <div className="char-notes-display">{data.notes || 'Sem notas'}</div>
          )}
        </div>
        </>
        )}
        {showPerms && (
          <div className="modal-overlay" onClick={() => setShowPerms(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
              <button className="modal-close" onClick={() => setShowPerms(false)}>×</button>
              <h2>Permissoes da ficha</h2>
              <p style={{ color: '#aaa', fontSize: 12 }}>Marque quem pode ver a ficha. Quem tem "controlar" tambem edita valores (HP, descansos) e rola.</p>
              {(members || []).filter((mm) => mm.role !== 'MASTER').map((mm) => {
                const mu = mm.user || mm;
                const uid = mm.userId || mu.id;
                return (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <span style={{ flex: 1 }}>{mu.username}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <input type="checkbox" checked={permCtrl.has(uid)} onChange={() => setPermCtrl((p) => { const n = new Set(p); if (n.has(uid)) { n.delete(uid); } else { n.add(uid); } return n; })} /> controlar
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <input type="checkbox" checked={permSel.has(uid) || permCtrl.has(uid)} onChange={() => setPermSel((p) => { const n = new Set(p); if (n.has(uid)) { n.delete(uid); } else { n.add(uid); } return n; })} /> ver
                    </label>
                  </div>
                );
              })}
              {(members || []).filter((mm) => mm.role !== 'MASTER').length === 0 && <p style={{ color: '#aaa' }}>Nenhum jogador na mesa.</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPerms(false)}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={savePerms} disabled={permSaving}>{permSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}