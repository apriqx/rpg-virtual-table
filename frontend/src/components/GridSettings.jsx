import { useState } from 'react';

export default function GridSettings({ open, onClose, config, onSave }) {
  const [cellSize, setCellSize] = useState(config.cellSize);
  const [physicalSize, setPhysicalSize] = useState(config.physicalSize);
  const [visible, setVisible] = useState(config.visible);
  const [lineThickness, setLineThickness] = useState(config.lineThickness);
  const [lineOpacity, setLineOpacity] = useState(config.lineOpacity);
  const [offsetX, setOffsetX] = useState(config.offsetX);
  const [offsetY, setOffsetY] = useState(config.offsetY);
  const [snapToGrid, setSnapToGrid] = useState(config.snapToGrid);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      cellSize,
      physicalSize,
      visible,
      lineThickness,
      lineOpacity,
      offsetX,
      offsetY,
      snapToGrid,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Configuracoes da Grade</h2>
        <form onSubmit={handleSubmit} className="grid-settings">
          <div className="form-group">
            <label>Tamanho da celula (px)</label>
            <input type="number" value={cellSize} onChange={(e) => setCellSize(Number(e.target.value))} min={10} />
          </div>
          <div className="form-group">
            <label>Tamanho fisico (cm)</label>
            <input type="number" value={physicalSize} onChange={(e) => setPhysicalSize(Number(e.target.value))} min={0.1} step={0.1} />
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
              Visivel
            </label>
          </div>
          <div className="form-group">
            <label>Espessura da linha</label>
            <input type="number" value={lineThickness} onChange={(e) => setLineThickness(Number(e.target.value))} min={0.1} step={0.1} />
          </div>
          <div className="form-group">
            <label>Opacidade da linha ({lineOpacity})</label>
            <input type="range" min="0" max="1" step="0.05" value={lineOpacity} onChange={(e) => setLineOpacity(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Offset X (px)</label>
            <input type="number" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Offset Y (px)</label>
            <input type="number" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
              Ajustar a grade
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}