import api from '../services/api';

export const ABILITIES = [
  { key: 'for', name: 'Força' },
  { key: 'des', name: 'Destreza' },
  { key: 'con', name: 'Constituição' },
  { key: 'int', name: 'Inteligência' },
  { key: 'sab', name: 'Sabedoria' },
  { key: 'car', name: 'Carisma' },
];

export const SKILLS = [
  { key: 'acrobacia', name: 'Acrobacia', abil: 'des' },
  { key: 'adestrar', name: 'Adestrar Animais', abil: 'sab' },
  { key: 'arcanismo', name: 'Arcanismo', abil: 'int' },
  { key: 'atletismo', name: 'Atletismo', abil: 'for' },
  { key: 'atuacao', name: 'Atuação', abil: 'car' },
  { key: 'enganacao', name: 'Enganação', abil: 'car' },
  { key: 'furtividade', name: 'Furtividade', abil: 'des' },
  { key: 'historia', name: 'História', abil: 'int' },
  { key: 'intimidacao', name: 'Intimidação', abil: 'car' },
  { key: 'intuicao', name: 'Intuição', abil: 'sab' },
  { key: 'investigacao', name: 'Investigação', abil: 'int' },
  { key: 'medicina', name: 'Medicina', abil: 'sab' },
  { key: 'natureza', name: 'Natureza', abil: 'int' },
  { key: 'percepcao', name: 'Percepção', abil: 'sab' },
  { key: 'persuasao', name: 'Persuasão', abil: 'car' },
  { key: 'prestidigitacao', name: 'Prestidigitação', abil: 'des' },
  { key: 'religiao', name: 'Religião', abil: 'int' },
  { key: 'sobrevivencia', name: 'Sobrevivência', abil: 'sab' },
];

export function defaultDnd5eData() {
  const skills = {};
  SKILLS.forEach((s) => { skills[s.key] = 0; });
  return {
    level: 1, className: '', race: '', background: '', alignment: '', xp: 0, inspiration: false,
    hp: { current: 0, max: 0, temp: 0 },
    hitDice: { total: '', used: 0 },
    deathSaves: { successes: 0, failures: 0 },
    abilities: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    saveProf: { for: false, des: false, con: false, int: false, sab: false, car: false },
    skills,
    combat: { ac: 10, deslocamento: 9 },
    attacks: [],
    spellcasting: { ability: 'int', slots: [0, 0, 0, 0, 0, 0, 0, 0, 0], slotsMax: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
    currency: { pp: 0, op: 0, eo: 0, tp: 0, pc: 0 },
    personality: { traits: '', ideals: '', bonds: '', flaws: '' },
    proficiencies: '', features: '', equipment: '', treasure: '',
  };
}

const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
const fmt = (m) => (m >= 0 ? '+' + m : String(m));
const profBonus = (level) => 2 + Math.floor(((Number(level) || 1) - 1) / 4);

export default function Dnd5eSheetBody({ editData, setField, editing, tableId, onQuickHp, onShortRest, onLongRest }) {
  const ab = editData.abilities || {};
  const sp = editData.saveProf || {};
  const sk = editData.skills || {};
  const cb = editData.combat || {};
  const hp = editData.hp || { current: 0, max: 0, temp: 0 };
  const hd = editData.hitDice || { total: '', used: 0 };
  const ds = editData.deathSaves || { successes: 0, failures: 0 };
  const sc = editData.spellcasting || { ability: 'int', slots: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const cur = editData.currency || { pp: 0, op: 0, eo: 0, tp: 0, pc: 0 };
  const per = editData.personality || { traits: '', ideals: '', bonds: '', flaws: '' };
  const attacks = Array.isArray(editData.attacks) ? editData.attacks : [];
  const pb = profBonus(editData.level);
  const dis = !editing;

  const setAb = (key, v) => setField('abilities', { ...ab, [key]: v });
  const setSaveProf = (key, v) => setField('saveProf', { ...sp, [key]: v });
  const cycleSkill = (key) => { const next = ((Number(sk[key]) || 0) + 1) % 3; setField('skills', { ...sk, [key]: next }); };
  const skillTotal = (s) => mod(ab[s.abil]) + (Number(sk[s.key]) >= 1 ? pb : 0) + (Number(sk[s.key]) === 2 ? pb : 0);
  const saveTotal = (a) => mod(ab[a]) + (sp[a] ? pb : 0);
  const setAttack = (i, field, v) => { const arr = attacks.map((at, j) => (j === i ? { ...at, [field]: v } : at)); setField('attacks', arr); };
  const setSlot = (i, v) => { const arr = (sc.slots || []).slice(); arr[i] = v; setField('spellcasting', { ...sc, slots: arr }); };
  const setSlotMax = (i, v) => { const arr = (sc.slotsMax || (sc.slots || []).slice()).slice(); arr[i] = v; setField('spellcasting', { ...sc, slotsMax: arr }); };
  const passivePerception = 10 + (Number(sk.percepcao) >= 1 ? pb : 0) + (Number(sk.percepcao) === 2 ? pb : 0) + mod(ab.sab);

  async function rollChat(expr) {
    if (!tableId || !expr) return;
    try { await api.chat.send(tableId, { type: 'dice', text: '/r ' + expr }); } catch {}
  }

  const rollBtn = (expr, title, emoji) => (!editing && tableId && expr ? (
    <button type="button" className="dnd-roll-btn" title={title || 'Rolar 1d20 no chat'} onClick={() => rollChat(expr)}>{emoji || '🎲'}</button>
  ) : null);

  return (
    <div className="dnd-body">
      <div className="dnd-identity">
        <div className="dnd-field-sm"><label>Nível</label><input type="number" min={1} max={20} value={editData.level ?? 1} disabled={dis} onChange={(e) => setField('level', Number(e.target.value) || 1)} /></div>
        <div className="dnd-field-sm"><label>Classe</label><input value={editData.className || ''} disabled={dis} onChange={(e) => setField('className', e.target.value)} placeholder="Guerreiro" /></div>
        <div className="dnd-field-sm"><label>Raça</label><input value={editData.race || ''} disabled={dis} onChange={(e) => setField('race', e.target.value)} placeholder="Humano" /></div>
        <div className="dnd-field-sm"><label>Antecedente</label><input value={editData.background || ''} disabled={dis} onChange={(e) => setField('background', e.target.value)} /></div>
        <div className="dnd-field-sm"><label>Alinhamento</label><input value={editData.alignment || ''} disabled={dis} onChange={(e) => setField('alignment', e.target.value)} placeholder="Neutro" /></div>
        <div className="dnd-field-sm"><label>XP</label><input type="number" min={0} value={editData.xp ?? 0} disabled={dis} onChange={(e) => setField('xp', Number(e.target.value) || 0)} /></div>
        <div className="dnd-field-sm dnd-insp"><label><input type="checkbox" checked={!!editData.inspiration} disabled={dis} onChange={(e) => setField('inspiration', e.target.checked)} /> Inspiração</label></div>
      </div>

      <div className="dnd-hp-row">
        <div className="dnd-box dnd-hp-box">
          <label>Pontos de Vida</label>
          <div className="dnd-hp-inputs">
            <span>Atual</span><input type="number" value={hp.current ?? 0} disabled={dis} onChange={(e) => setField('hp', { ...hp, current: Number(e.target.value) || 0 })} />
            <span>Máx</span><input type="number" value={hp.max ?? 0} disabled={dis} onChange={(e) => setField('hp', { ...hp, max: Number(e.target.value) || 0 })} />
            <span>Temp</span><input type="number" value={hp.temp ?? 0} disabled={dis} onChange={(e) => setField('hp', { ...hp, temp: Number(e.target.value) || 0 })} />
          </div>
          {onQuickHp && !editing && (
            <div className="dnd-quick-hp">
              {[-5, -1, 1, 5].map((d) => (<button key={d} type="button" className={'btn btn-sm ' + (d > 0 ? '' : 'btn-danger')} onClick={() => onQuickHp(d)}>{d > 0 ? '+' + d : String(d)}</button>))}
            </div>
          )}
          {(onShortRest || onLongRest) && !editing && (
            <div className="dnd-rest">
              {onShortRest && <button type="button" className="btn btn-sm" title="Gastar dados de vida para curar" onClick={onShortRest}>🌙 Descanso Curto</button>}
              {onLongRest && <button type="button" className="btn btn-sm" title="Restaurar PV, dados de vida e magia" onClick={onLongRest}>🛏️ Descanso Longo</button>}
            </div>
          )}
        </div>
        <div className="dnd-box"><label>Dado de Vida</label><input value={hd.total || ''} disabled={dis} placeholder="1d8" onChange={(e) => setField('hitDice', { ...hd, total: e.target.value })} /><span>Gastos</span><input type="number" min={0} value={hd.used ?? 0} disabled={dis} onChange={(e) => setField('hitDice', { ...hd, used: Number(e.target.value) || 0 })} /></div>
        <div className="dnd-box"><label>Salvaguardas contra Morte</label>
          <div className="dnd-ds"><span>Sucessos</span><input type="number" min={0} max={3} value={ds.successes ?? 0} disabled={dis} onChange={(e) => setField('deathSaves', { ...ds, successes: Math.min(3, Number(e.target.value) || 0) })} /><span>Falhas</span><input type="number" min={0} max={3} value={ds.failures ?? 0} disabled={dis} onChange={(e) => setField('deathSaves', { ...ds, failures: Math.min(3, Number(e.target.value) || 0) })} /></div>
        </div>
      </div>

      <div className="dnd-abilities">
        {ABILITIES.map((a) => (
          <div key={a.key} className="dnd-ability">
            <span className="dnd-ability-name">{a.name}</span>
            <input type="number" min={1} max={30} value={ab[a.key] ?? 10} disabled={dis} onChange={(e) => setAb(a.key, Number(e.target.value) || 10)} />
            <span className="dnd-mod">{fmt(mod(ab[a.key]))}</span>
            <label className="dnd-save"><input type="checkbox" checked={!!sp[a.key]} disabled={dis} onChange={(e) => setSaveProf(a.key, e.target.checked)} /> {fmt(saveTotal(a.key))}</label>
            {rollBtn('1d20' + fmt(saveTotal(a.key)), 'Teste de resistência: ' + a.name)}
          </div>
        ))}
      </div>

      <div className="dnd-mid-grid">
        <div className="dnd-skills">
          <h4>Perícias</h4>
          {SKILLS.map((s) => (
            <div key={s.key} className="dnd-skill-row">
              <button type="button" className={'dnd-prof-dot p' + (Number(sk[s.key]) || 0)} disabled={dis} title={'Nenhum → Proficiente → Especialista'} onClick={() => cycleSkill(s.key)}>{['○', '◉', '⬤'][Number(sk[s.key]) || 0]}</button>
              <span className="dnd-skill-bonus">{fmt(skillTotal(s))}</span>
              <span className="dnd-skill-name">{s.name} <em>({ABILITIES.find((a) => a.key === s.abil)?.name.slice(0, 3).toLowerCase()})</em></span>
              {rollBtn('1d20' + fmt(skillTotal(s)), 'Rolagem: ' + s.name)}
            </div>
          ))}
        </div>
        <div className="dnd-combat-col">
          <div className="dnd-combat-boxes">
            <div className="dnd-box"><label>CA</label><input type="number" value={cb.ac ?? 10} disabled={dis} onChange={(e) => setField('combat', { ...cb, ac: Number(e.target.value) || 0 })} /></div>
            <div className="dnd-box"><label>Iniciativa</label><span className="dnd-computed">{fmt(mod(ab.des))}</span></div>
            <div className="dnd-box"><label>Deslocamento</label><input type="number" min={0} value={cb.deslocamento ?? 9} disabled={dis} onChange={(e) => setField('combat', { ...cb, deslocamento: Number(e.target.value) || 0 })} /></div>
            <div className="dnd-box"><label>Bônus de Prof.</label><span className="dnd-computed">{fmt(pb)}</span></div>
            <div className="dnd-box"><label>Percepção Passiva</label><span className="dnd-computed">{passivePerception}</span></div>
          </div>
          <div className="dnd-attacks">
            <h4>Ataques</h4>
            {attacks.map((at, i) => (
              <div key={i} className="dnd-attack-row">
                <input placeholder="Nome" value={at.name || ''} disabled={dis} onChange={(e) => setAttack(i, 'name', e.target.value)} />
                <input placeholder="+5" value={at.bonus || ''} disabled={dis} onChange={(e) => setAttack(i, 'bonus', e.target.value)} />
                <input placeholder="1d8+3 cortante" value={at.damage || ''} disabled={dis} onChange={(e) => setAttack(i, 'damage', e.target.value)} />
                {/^[+-]?\d+$/.test(String(at.bonus || '').trim()) && rollBtn('1d20' + (String(at.bonus).trim().startsWith('+') || String(at.bonus).trim().startsWith('-') ? String(at.bonus).trim() : '+' + String(at.bonus).trim()), 'Ataque: ' + (at.name || ''))}
                {(String(at.damage || '').match(/^\d*d\d+(?:\s*[+-]\s*\d+)?/i) || [])[0] && rollBtn(String(at.damage).match(/^\d*d\d+(?:\s*[+-]\s*\d+)?/i)[0].replace(/\s+/g, ''), 'Dano: ' + (at.name || ''), '💥')}
                {editing && <button type="button" className="btn btn-sm btn-danger" onClick={() => setField('attacks', attacks.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            {editing && <button type="button" className="btn btn-sm" onClick={() => setField('attacks', [...attacks, { name: '', bonus: '', damage: '' }])}>+ Ataque</button>}
          </div>
          <div className="dnd-spells">
            <h4>Conjuração</h4>
            <div className="dnd-spell-top">
              <select value={sc.ability || 'int'} disabled={dis} onChange={(e) => setField('spellcasting', { ...sc, ability: e.target.value })}>
                {ABILITIES.filter((a) => ['int', 'sab', 'car'].includes(a.key)).map((a) => (<option key={a.key} value={a.key}>{a.name}</option>))}
              </select>
              <span>CD: <strong>{8 + pb + mod(ab[sc.ability || 'int'])}</strong></span>
              <span>Ataque: <strong>{fmt(pb + mod(ab[sc.ability || 'int']))}</strong></span>
            </div>
            <div className="dnd-slots">
              {(sc.slots || []).map((v, i) => {
                const mx = Number((sc.slotsMax || [])[i]) || 0;
                return (
                  <label key={i}>{i + 1}º
                    <input type="number" min={0} max={20} value={v ?? 0} disabled={dis} title="Espacos disponiveis" onChange={(e) => setSlot(i, Number(e.target.value) || 0)} />
                    {editing
                      ? <input type="number" min={0} max={20} className="dnd-slot-max" title="Total maximo" value={mx} onChange={(e) => setSlotMax(i, Number(e.target.value) || 0)} />
                      : <span className="dnd-slot-max-txt">/{mx}</span>}
                  </label>
                );
              })}
            </div>
            <small className="dnd-slots-hint">usados/total — o Descanso Longo restaura os usados para o total</small>
          </div>
          <div className="dnd-currency">
            {[['pp', 'PP'], ['op', 'OP'], ['eo', 'EO'], ['tp', 'TP'], ['pc', 'PC']].map(([k, lbl]) => (
              <label key={k}>{lbl}<input type="number" min={0} value={cur[k] ?? 0} disabled={dis} onChange={(e) => setField('currency', { ...cur, [k]: Number(e.target.value) || 0 })} /></label>
            ))}
          </div>
        </div>
      </div>

      <div className="dnd-text-grid">
        <div><h4>Personalidade</h4><textarea rows={2} value={per.traits || ''} disabled={dis} onChange={(e) => setField('personality', { ...per, traits: e.target.value })} placeholder="Traços" /></div>
        <div><h4>&nbsp;</h4><textarea rows={2} value={per.ideals || ''} disabled={dis} onChange={(e) => setField('personality', { ...per, ideals: e.target.value })} placeholder="Ideais" /></div>
        <div><h4>&nbsp;</h4><textarea rows={2} value={per.bonds || ''} disabled={dis} onChange={(e) => setField('personality', { ...per, bonds: e.target.value })} placeholder="Vínculos" /></div>
        <div><h4>&nbsp;</h4><textarea rows={2} value={per.flaws || ''} disabled={dis} onChange={(e) => setField('personality', { ...per, flaws: e.target.value })} placeholder="Defeitos" /></div>
        <div><h4>Proficiências</h4><textarea rows={3} value={editData.proficiencies || ''} disabled={dis} onChange={(e) => setField('proficiencies', e.target.value)} /></div>
        <div><h4>Características e Rasgos</h4><textarea rows={3} value={editData.features || ''} disabled={dis} onChange={(e) => setField('features', e.target.value)} /></div>
        <div><h4>Equipamento</h4><textarea rows={3} value={editData.equipment || ''} disabled={dis} onChange={(e) => setField('equipment', e.target.value)} /></div>
        <div><h4>Tesouro</h4><textarea rows={3} value={editData.treasure || ''} disabled={dis} onChange={(e) => setField('treasure', e.target.value)} /></div>
      </div>
    </div>
  );
}
