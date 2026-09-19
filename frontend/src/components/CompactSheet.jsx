import { resolveUrl } from '../services/api';

const mod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
const fmtMod = (m) => (m >= 0 ? '+' + m : String(m));
const AB_LABEL = { str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };

export default function CompactSheet({ character, onClose, onOpenFull, isMaster, embedded }) {
  const d = character.data || {};
  const ab = d.abilities || {};
  const hp = d.hp || { current: 0, max: 0, temp: 0 };
  const combat = d.combat || {};
  const prof = 2 + Math.floor(((Number(d.level) || 1) - 1) / 4);
  const speed = Number(combat.speed) || 30;
  const hpPct = hp.max > 0 ? Math.max(0, Math.min(100, ((hp.current + hp.temp) / hp.max) * 100)) : 0;
  const hpColor = hpPct > 50 ? '#50fa7b' : hpPct > 25 ? '#f1fa8c' : '#ff5555';
  const attacks = Array.isArray(d.attacks) ? d.attacks.filter((a) => a && (a.name || a.bonus || a.damage)) : [];
  const features = String(d.features || '').split('\n').map((f) => f.trim()).filter(Boolean);
  const subtitle = [d.race, d.className ? String(d.className) + (d.level ? ' ' + d.level : '') : '', d.background].filter(Boolean).join(' · ');

  // Item 32: mesmo componente como janela flutuante (embedded) ou modal
  const content = (
    <>
      <div className="cs-header">
          {d.portrait ? <img className="cs-portrait" src={resolveUrl(d.portrait)} alt="" /> : <div className="cs-portrait cs-portrait-empty">?</div>}
          <div className="cs-titles">
            <h2>{character.name}</h2>
            {subtitle && <div className="cs-subtitle">{subtitle}</div>}
          </div>
        </div>
        <div className="cs-vitals">
          <div className="cs-hp">
            <div className="cs-hp-bar"><div className="cs-hp-fill" style={{ width: hpPct + '%', backgroundColor: hpColor }} /></div>
            <div className="cs-hp-text">PV {hp.current}{hp.temp > 0 ? ' (+' + hp.temp + ')' : ''} / {hp.max}</div>
          </div>
          <div className="cs-quick">
            <div className="cs-quick-item"><span className="cs-label">CA</span><span className="cs-value">{Number(combat.ac) || 10}</span></div>
            <div className="cs-quick-item"><span className="cs-label">Iniciativa</span><span className="cs-value">{fmtMod(mod(ab.dex))}</span></div>
            <div className="cs-quick-item"><span className="cs-label">Desloc.</span><span className="cs-value">{speed}ft ({(speed * 0.3).toFixed(1)}m)</span></div>
          </div>
        </div>
        <div className="cs-abilities">
          {Object.keys(AB_LABEL).map((k) => {
            const score = Number(ab[k]) || 10;
            return <div key={k} className="cs-ability"><span className="cs-label">{AB_LABEL[k]}</span><span className="cs-value">{score}</span><span className="cs-mod">{fmtMod(mod(score))}</span></div>;
          })}
        </div>
        <div className="cs-section">
          <h4>Ataques <small>proficiência {fmtMod(prof)}</small></h4>
          {attacks.length === 0 && <div className="cs-empty">Sem ataques registrados</div>}
          {attacks.map((a, i) => (
            <div key={i} className="cs-attack">
              <span className="cs-attack-name">{a.name || '—'}</span>
              <span className="cs-attack-bonus">{a.bonus ? fmtMod(parseInt(a.bonus, 10) || 0) : ''}</span>
              <span className="cs-attack-damage">{[a.damage, a.damageType].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
        </div>
        {features.length > 0 && (
          <div className="cs-section">
            <h4>Habilidades</h4>
            {features.map((f, i) => <div key={i} className="cs-feature" title={f}>{f}</div>)}
          </div>
        )}
        {isMaster && onOpenFull && (
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onOpenFull}>Ficha do Jogador (completa)</button></div>
        )}
    </>
  );
  if (embedded) return <div className="compact-sheet-embedded">{content}</div>;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal compact-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        {content}
      </div>
    </div>
  );
}
