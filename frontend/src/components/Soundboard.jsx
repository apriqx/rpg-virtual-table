import { useState, useRef, useEffect } from 'react';
import { emitSocket } from '../services/socket';

export const SOUNDS = [
  { name: 'dice', file: 'dice.wav', label: 'Dados', icon: '🎲' },
  { name: 'sword', file: 'sword.ogg', label: 'Espada', icon: '⚔️' },
  { name: 'slash', file: 'slash.ogg', label: 'Corte', icon: '🗡️' },
  { name: 'hit', file: 'hit.ogg', label: 'Impacto', icon: '💥' },
  { name: 'punch', file: 'punch.ogg', label: 'Soco', icon: '👊' },
  { name: 'magic', file: 'magic.wav', label: 'Magia', icon: '✨' },
  { name: 'heal', file: 'heal.wav', label: 'Cura', icon: '💚' },
  { name: 'levelup', file: 'levelup.ogg', label: 'Level Up', icon: '⭐' },
  { name: 'death', file: 'death.wav', label: 'Morte', icon: '💀' },
  { name: 'bell', file: 'bell.ogg', label: 'Sino', icon: '🔔' },
  { name: 'door-open', file: 'door-open.ogg', label: 'Abrir Porta', icon: '🚪' },
  { name: 'door-close', file: 'door-close.ogg', label: 'Fechar Porta', icon: '🚪' },
  { name: 'chest', file: 'chest.ogg', label: 'Baú', icon: '🎁' },
  { name: 'coins', file: 'coins.ogg', label: 'Moedas', icon: '💰' },
  { name: 'book', file: 'book.ogg', label: 'Livro', icon: '📖' },
  { name: 'equip', file: 'equip.ogg', label: 'Equipar', icon: '🛡️' },
  { name: 'trap', file: 'trap.ogg', label: 'Armadilha', icon: '🕸️' },
  { name: 'suspense', file: 'suspense.ogg', label: 'Suspense', icon: '👁️' },
];

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';

export function playSound(name) {
  const s = SOUNDS.find((x) => x.name === name);
  if (!s) return;
  try {
    const a = new Audio(BASE + 'sounds/' + s.file);
    a.volume = Math.max(0, Math.min(1, Number(localStorage.getItem('soundboard-vol')) || 0.8));
    a.play().catch(() => {});
  } catch {}
}

export function isSoundMuted() {
  return localStorage.getItem('soundboard-muted') === '1';
}

export default function Soundboard({ tableId, isMaster }) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(isSoundMuted());
  const [vol, setVol] = useState(Number(localStorage.getItem('soundboard-vol')) || 0.8);
  const volRef = useRef(vol);
  volRef.current = vol;

  useEffect(() => { localStorage.setItem('soundboard-vol', String(vol)); }, [vol]);

  function play(name) {
    emitSocket('sound:play', tableId, name);
    if (!isSoundMuted()) playSound(name);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('soundboard-muted', next ? '1' : '0');
  }

  return (
    <div className="soundboard">
      <button className={'btn btn-sm ' + (open ? 'btn-primary' : '')} onClick={() => setOpen(!open)}>{open ? '▲ Sons' : '▼ Sons'}</button>
      {open && (
        <div className="soundboard-panel">
          {isMaster && (
            <div className="sound-btns">
              {SOUNDS.map((s) => (
                <button key={s.name} type="button" className="sound-btn" title={s.label} onClick={() => play(s.name)}>
                  <span className="sound-icon">{s.icon}</span>
                  <span className="sound-label">{s.label}</span>
                </button>
              ))}
            </div>
          )}
          <div className="sound-controls">
            <label className="sound-vol">
              🔉 <input type="range" min="0" max="1" step="0.05" value={vol} onChange={(e) => setVol(Number(e.target.value))} />
            </label>
            <button type="button" className={'btn btn-sm ' + (muted ? 'btn-danger' : 'btn-secondary')} onClick={toggleMute}>{muted ? '🔇 Sons desligados' : '🔊 Sons ligados'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
