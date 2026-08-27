export default function FogControls({ brushSize, onBrushSizeChange, onRevealAll, onHideAll }) {
  return (
    <div className="fog-controls">
      <label>
        Pincel: {brushSize}px
        <input
          type="range"
          className="fog-brush-size"
          min="20"
          max="200"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
        />
      </label>
      <button className="btn btn-sm btn-primary" onClick={onRevealAll}>Revelar Tudo</button>
      <button className="btn btn-sm btn-secondary" onClick={onHideAll}>Ocultar Tudo</button>
    </div>
  );
}