import { useState } from 'react';

// Itens 14-24: painel unico de CONFIGURACAO DO MAPA (GRADE + NEBLINA), exclusivo do mestre
export default function GridSettings({ open, onClose, config, fogConfig, onSave }) {
  const [cellSize, setCellSize] = useState(config.cellSize);
  const [physicalSize, setPhysicalSize] = useState(config.physicalSize);
  const [visible, setVisible] = useState(config.visible);
  const [lineThickness, setLineThickness] = useState(config.lineThickness);
  const [lineOpacity, setLineOpacity] = useState(config.lineOpacity);
  const [offsetX, setOffsetX] = useState(config.offsetX);
  const [offsetY, setOffsetY] = useState(config.offsetY);
  const [snapToGrid, setSnapToGrid] = useState(config.snapToGrid);

  const [fogEnabled, setFogEnabled] = useState(fogConfig ? fogConfig.enabled !== false : true);
  const [fogColor, setFogColor] = useState((fogConfig && fogConfig.color) || '#000000');
  const [fogMaster, setFogMaster] = useState(fogConfig ? Number(fogConfig.masterOpacity) : 0.5);
  const [fogPlayer, setFogPlayer] = useState(fogConfig ? Number(fogConfig.playerOpacity) : 0);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    // Item 15: grade mantida integralmente; item 16-21: neblina independente
    onSave({
      cellSize,
      physicalSize,
      visible,
      lineThickness,
      lineOpacity,
      offsetX,
      offsetY,
      snapToGrid,
    }, {
      enabled: fogEnabled,
      color: fogColor,
      masterOpacity: fogMaster,
      playerOpacity: fogPlayer,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Configuracoes do Mapa</h2>
        <form onSubmit={handleSubmit} className="grid-settings">
          <h3 className="gs-section-title">Grade</h3>
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
            <label>Opacidade da linha</label>
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

          {/* Itens 16-21: NEBLINA / FOG OF WAR */}
          <h3 className="gs-section-title">Neblina (fog of war)</h3>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={fogEnabled} onChange={(e) => setFogEnabled(e.target.checked)} />
              Ativar neblina
            </label>
          </div>
          <div className="form-group">
            <label>Cor da neblina</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(fogColor) ? fogColor : '#000000'} onChange={(e) => setFogColor(e.target.value)} />
              <input type="text" value={fogColor} onChange={(e) => setFogColor(e.target.value)} placeholder="#000000" style={{ width: 110 }} />
            </div>
          </div>
          <div className="form-group">
            <label>Opacidade da neblina — Mestre: {Math.round(fogMaster * 100)}%</label>
            <input type="range" min="0" max="1" step="0.05" value={fogMaster} onChange={(e) => setFogMaster(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Opacidade da neblina — Jogador: {Math.round(fogPlayer * 100)}%</label>
            <input type="range" min="0" max="1" step="0.05" value={fogPlayer} onChange={(e) => setFogPlayer(Number(e.target.value))} />
          </div>
          <p className="gs-hint">A opacidade define apenas a intensidade visual da camada. O que esta oculto continua oculto para o jogador, mesmo com opacidade 0%.</p>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
