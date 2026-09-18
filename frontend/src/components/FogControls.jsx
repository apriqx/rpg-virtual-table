export default function FogControls({ fogMode, fogShape, onFogShapeChange, brushSize, onBrushSizeChange, onRevealAll, onHideAll }) {
  return (
    <div className="fog-controls">
      <span className="fog-mode-label">Modo: <strong className={fogMode === 'fogReveal' ? 'fog-mode-reveal' : 'fog-mode-hide'}>{fogMode === 'fogReveal' ? 'Revelar' : 'Ocultar'}</strong></span>
      <label className="fog-shape-label">
        Formato:
        <select value={fogShape || 'square'} onChange={(e) => onFogShapeChange(e.target.value)}>
          <option value="square">Quadrado</option>
          <option value="circle">Circulo</option>
          <option value="free">Selecao Livre</option>
        </select>
      </label>
      {fogShape !== 'free' && (
        <label>
          Tamanho: {brushSize}px
          <input
            type="range"
            className="fog-brush-size"
            min="20"
            max="200"
            value={brushSize}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          />
        </label>
      )}
      {fogShape === 'free' && <small className="fog-free-hint">Clique nos vertices e clique no ponto amarelo para fechar</small>}
      <button className="btn btn-sm btn-primary" onClick={onRevealAll}>Revelar Tudo</button>
      <button className="btn btn-sm btn-secondary" onClick={onHideAll}>Ocultar Tudo</button>
    </div>
  );
}
