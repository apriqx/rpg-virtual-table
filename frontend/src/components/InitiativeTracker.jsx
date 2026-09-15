import { useState, useEffect, useRef, useCallback } from 'react';
import { emitSocket, onSocket } from '../services/socket';

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

export default function InitiativeTracker({ tableId, tokens, members, isMaster, username }) {
  const [list, setList] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [round, setRound] = useState(1);
  const [showTracker, setShowTracker] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    const cleanup = onSocket('initiative:updated', (data) => {
      setList(data.list || []);
      setCurrentIdx(data.currentIdx ?? -1);
      setRound(data.round || 1);
    });
    return cleanup;
  }, []);

  const broadcast = useCallback((newList, newIdx, newRound) => {
    setList(newList);
    setCurrentIdx(newIdx);
    setRound(newRound);
    emitSocket('initiative:update', tableId, { list: newList, currentIdx: newIdx, round: newRound });
  }, [tableId]);

  function addFromMap() {
    const combatants = tokens
      .filter((t) => t.layer !== 5 && t.visible)
      .map((t) => ({
        id: t.id,
        name: t.name,
        initiative: 0,
        type: t.type,
      }));
    if (combatants.length === 0) return;
    const sorted = [...combatants].sort((a, b) => a.name.localeCompare(b.name));
    broadcast(sorted, 0, 1);
  }

  function addMember(name) {
    const entry = { id: Date.now().toString(), name, initiative: 0, type: 'character' };
    broadcast([...list, entry], currentIdx, round);
  }

  function rollAll() {
    const rolled = list.map((c) => ({ ...c, initiative: rollD20() }));
    const sorted = [...rolled].sort((a, b) => b.initiative - a.initiative);
    broadcast(sorted, 0, 1);
  }

  function rollOne(idx) {
    const updated = list.map((c, i) => (i === idx ? { ...c, initiative: rollD20() } : c));
    const sorted = [...updated].sort((a, b) => b.initiative - a.initiative);
    const newIdx = sorted.findIndex((c) => c.id === list[idx].id);
    broadcast(sorted, newIdx >= 0 ? newIdx : currentIdx);
  }

  function removeOne(idx) {
    const newList = list.filter((_, i) => i !== idx);
    let newIdx = currentIdx;
    if (currentIdx >= newList.length) newIdx = Math.max(0, newList.length - 1);
    broadcast(newList, newIdx, round);
  }

  function nextTurn() {
    if (list.length === 0) return;
    const newIdx = (currentIdx + 1) % list.length;
    broadcast(list, newIdx, newIdx === 0 ? round + 1 : round);
  }

  function prevTurn() {
    if (list.length === 0) return;
    if (currentIdx === 0) { broadcast(list, list.length - 1, Math.max(1, round - 1)); return; }
    broadcast(list, currentIdx - 1, round);
  }

  function clearTracker() {
    broadcast([], -1, 1);
  }

  function moveItem(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const arr = [...list];
    const [item] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, item);
    broadcast(arr, currentIdx, round);
  }

  function handleDragStart(idx) { setDragIdx(idx); }
  function handleDragOver(e) { e.preventDefault(); }
  function handleDrop(toIdx) {
    if (dragIdx !== null && dragIdx !== toIdx) moveItem(dragIdx, toIdx);
    setDragIdx(null);
  }

  if (!showTracker) {
    return (
      <button className="init-toggle" onClick={() => setShowTracker(true)}>
        Iniciativa {list.length > 0 && <span className="init-badge">{list.length}</span>}
      </button>
    );
  }

  return (
    <div className="init-tracker">
      <div className="init-header">
        <span>Iniciativa</span>
        <button className="modal-close" onClick={() => setShowTracker(false)}>×</button>
      </div>
      {isMaster && (
        <div className="init-actions">
          <button className="btn btn-sm" onClick={addFromMap}>Adicionar do Mapa</button>
          <button className="btn btn-sm" onClick={rollAll}>Rolar Todos</button>
          <button className="btn btn-sm" onClick={() => addMember(prompt('Nome do combatente:'))}>+ Manual</button>
        </div>
      )}
      {list.length > 0 && (
        <div className="init-turn-controls">
          <button className="btn btn-sm" onClick={prevTurn}>◀</button>
          <span className="init-turn-label">
            Rodada {round} - Turno {currentIdx + 1}/{list.length}: <strong>{list[currentIdx]?.name}</strong>
          </span>
          <button className="btn btn-sm" onClick={nextTurn}>▶</button>
        </div>
      )}
      <div className="init-list">
        {list.length === 0 ? (
          <div className="init-empty">Nenhum combatante. Adicione tokens ou combatentes manuais.</div>
        ) : (
          list.map((c, idx) => (
            <div
              key={c.id}
              className={`init-entry ${idx === currentIdx ? 'init-active' : ''} ${dragIdx === idx ? 'init-dragging' : ''}`}
              draggable={isMaster}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
            >
              {isMaster && <button className="init-roll-btn" onClick={() => rollOne(idx)} title="Rolar d20">d20</button>}
              <span className="init-init">{c.initiative}</span>
              <span className="init-name">{c.name}</span>
              {isMaster && <button className="init-remove" onClick={() => removeOne(idx)}>×</button>}
            </div>
          ))
        )}
      </div>
      {isMaster && list.length > 0 && (
        <button className="btn btn-sm btn-danger init-clear" onClick={clearTracker}>Limpar</button>
      )}
    </div>
  );
}