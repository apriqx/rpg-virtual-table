import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const DICE = [
  { label: 'd4', sides: 4 },
  { label: 'd6', sides: 6 },
  { label: 'd8', sides: 8 },
  { label: 'd10', sides: 10 },
  { label: 'd12', sides: 12 },
  { label: 'd20', sides: 20 },
  { label: 'd100', sides: 100 },
];

function parseResult(text) {
  const m = (text || '').match(/\[([^\]]*)\]\s*=\s*\*\*(-?\d+)\*\*/);
  if (!m) return null;
  const rolls = m[1].split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
  const total = parseInt(m[2], 10);
  if (rolls.length === 0 || !Number.isFinite(total)) return null;
  return { rolls, total };
}

export default function DiceRoller({ tableId, onClose }) {
  const [count, setCount] = useState(1);
  const [sides, setSides] = useState(20);
  const [modifier, setModifier] = useState('');
  const [custom, setCustom] = useState('');
  const [lastRoll, setLastRoll] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [rollDisplay, setRollDisplay] = useState(null);
  const shuffleRef = useRef(null);
  const revealRef = useRef(null);

  useEffect(() => () => { clearInterval(shuffleRef.current); clearTimeout(revealRef.current); }, []);

  async function roll(expr) {
    const rollExpr = expr || `${count}d${sides}${modifier}`;
    if (rolling) return;
    let msg = null;
    try {
      msg = await api.chat.send(tableId, { type: 'dice', text: `/r ${rollExpr}` });
    } catch (err) {
      console.error(err);
      return;
    }
    const parsed = parseResult(msg.text);
    const max = Math.max(2, sides);
    setRolling(true);
    setRollDisplay(Math.floor(Math.random() * max) + 1);
    shuffleRef.current = setInterval(() => setRollDisplay(Math.floor(Math.random() * max) + 1), 80);
    revealRef.current = setTimeout(() => {
      clearInterval(shuffleRef.current);
      setRolling(false);
      setLastRoll(msg);
      setRollDisplay(parsed || { rolls: [], total: null });
    }, 700);
  }

  function handleQuickRoll(s) {
    setSides(s);
    roll(`1d${s}${modifier}`);
  }

  return (
    <div className="dice-roller">
      <div className="dice-roller-header">
        <span>Dados</span>
        {onClose && <button className="modal-close" onClick={onClose}>×</button>}
      </div>
      <div className="dice-buttons">
        {DICE.map((d) => (
          <button key={d.sides} className="dice-btn" onClick={() => handleQuickRoll(d.sides)}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="dice-custom-row">
        <label>Qtd:</label>
        <input type="number" min="1" max="100" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="dice-input" />
        <label>d</label>
        <input type="number" min="1" max="100" value={sides} onChange={(e) => setSides(Number(e.target.value) || 20)} className="dice-input" />
        <label>Mod:</label>
        <input value={modifier} onChange={(e) => setModifier(e.target.value)} placeholder="+3" className="dice-input dice-input-sm" />
        <button className="btn btn-primary btn-sm" onClick={() => roll()} disabled={rolling}>{rolling ? '...' : 'Rolar'}</button>
      </div>
      <div className="dice-custom-row">
        <label>Expressao:</label>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="2d6+3" className="dice-input" onKeyDown={(e) => { if (e.key === 'Enter' && custom.trim()) { roll(custom.trim()); setCustom(''); } }} />
        <button className="btn btn-sm" onClick={() => { if (custom.trim()) { roll(custom.trim()); setCustom(''); } }} disabled={rolling}>Rolar</button>
      </div>
      {rolling && (
        <div className="dice-result-box">
          <span className="dice-chip dice-rolling-num">{rollDisplay}</span>
          <span className="dice-rolling-label">rolando...</span>
        </div>
      )}
      {!rolling && rollDisplay && rollDisplay.rolls && rollDisplay.rolls.length > 0 && (
        <div className="dice-result-box">
          {rollDisplay.rolls.map((r, i) => (
            <span key={i} className="dice-chip" style={{ animationDelay: i * 60 + 'ms' }}>{r}</span>
          ))}
          {rollDisplay.total != null && <span className="dice-total">= {rollDisplay.total}</span>}
        </div>
      )}
      {lastRoll && !rolling && (
        <div className="dice-last-roll" dangerouslySetInnerHTML={{ __html: lastRoll.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      )}
    </div>
  );
}
