import { useState, useRef, useCallback, useEffect } from 'react';

// Itens 5-13, 26-27: janela flutuante generica arrastavel/redimensionavel.
// Reutilizada pelas fichas (CharacterSheet e CompactSheet) - nao duplica logica.
const MIN_W = 320;
const MIN_H = 220;

export default function FloatingWindow({ title, win, onChange, onClose, onFocus, z, children }) {
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(null);

  const clamp = useCallback((w, h) => {
    const maxW = Math.max(MIN_W, window.innerWidth - 16);
    const maxH = Math.max(MIN_H, window.innerHeight - 90);
    return { w: Math.max(MIN_W, Math.min(maxW, w)), h: Math.max(MIN_H, Math.min(maxH, h)) };
  }, []);

  // Itens 7/26: limites de redimensionamento e adaptacao a area util
  const startDrag = (e) => {
    if (e.target.closest('.fw-btn')) return;
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, x: win.x, y: win.y };
    setDragging(true);
    onFocus?.();
  };
  const startResize = (dir) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { sx: e.clientX, sy: e.clientY, x: win.x, y: win.y, w: win.w, h: win.h, dir };
    setResizing(dir);
    onFocus?.();
  };
  useEffect(() => {
    if (!dragging && !resizing) return undefined;
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (dragging) {
        const maxW = Math.max(MIN_W, window.innerWidth - 16);
        const maxH = Math.max(MIN_H, window.innerHeight - 90);
        const { w, h } = clamp(win.w, win.h);
        onChange({ ...win, w, h, x: Math.max(-w + 80, Math.min(window.innerWidth - 80, d.x + dx)), y: Math.max(0, Math.min(window.innerHeight - 50, d.y + dy)) });
      } else if (resizing) {
        let { x, y, w, h } = { x: d.x, y: d.y, w: d.w, h: d.h };
        if (d.dir.includes('e')) w = d.w + dx;
        if (d.dir.includes('s')) h = d.h + dy;
        if (d.dir.includes('w')) { w = d.w - dx; x = d.x + dx; }
        if (d.dir.includes('n')) { h = d.h - dy; y = d.y + dy; }
        const c = clamp(w, h);
        if (d.dir.includes('w') && c.w !== w) x = d.x + (d.w - c.w);
        if (d.dir.includes('n') && c.h !== h) y = d.y + (d.h - c.h);
        onChange({ ...win, x, y, ...c });
      }
    };
    const up = () => { setDragging(false); setResizing(null); dragRef.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragging, resizing, win, onChange, onFocus, clamp]);

  if (!win || win.minimized) return null;

  const handles = [];
  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => handles.push(
    <div key={dir} className={`fw-resize fw-resize-${dir}`} onMouseDown={startResize(dir)} />
  ));

  return (
    <div className="floating-window" style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: z || 1000 }}
      onMouseDown={() => onFocus?.()}>
      {handles}
      <div className={`fw-header${dragging ? ' fw-dragging' : ''}`} onMouseDown={startDrag} onDoubleClick={() => onChange({ ...win, w: Math.max(MIN_W, Math.min(window.innerWidth - 24, 820)), h: Math.max(MIN_H, Math.min(window.innerHeight - 100, 720)) })}>
        <span className="fw-title">{title}</span>
        <span className="fw-actions">
          {/* Item 13: [-] minimiza (mantem na barra), [x] fecha */}
          <button type="button" className="fw-btn" title="Minimizar (mantem na barra inferior)" onClick={() => { onFocus?.(); onChange({ ...win, minimized: true, restore: { x: win.x, y: win.y, w: win.w, h: win.h } }); }}>–</button>
          <button type="button" className="fw-btn fw-close" title="Fechar" onClick={() => { onFocus?.(); onClose?.(); }}>×</button>
        </span>
      </div>
      <div className="fw-body">{children}</div>
    </div>
  );
}
