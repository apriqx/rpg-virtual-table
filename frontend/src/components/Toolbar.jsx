// Itens 5-7/36: barra de ferramentas - jogador tem Selecionar, Mover e Medir
export default function Toolbar({ currentTool, onToolChange, isMaster, gridVisible, onToggleGrid, onOpenGridSettings, onOpenTokenDialog, onEditToken, onDeleteToken, onClearDrawings, drawColor, onDrawColorChange, onOpenSheets }) {
  const tools = [
    { id: 'select', label: 'Selecionar' },
    { id: 'move', label: 'Mover' },
    { id: 'measure', label: 'Medir' },
  ];

  const masterTools = [
    { id: 'addToken', label: '+ Token' },
    { id: 'editToken', label: 'Editar' },
    { id: 'deleteToken', label: 'Excluir Token' },
    { id: 'draw', label: 'Desenhar' },
    { id: 'erase', label: 'Borracha' },
    { id: 'annotate', label: 'Texto' },
  ];

  const fogTools = [
    { id: 'fogReveal', label: 'Revelar Neblina' },
    { id: 'fogHide', label: 'Ocultar Neblina' },
  ];

  function handleToolClick(toolId) {
    if (toolId === 'deleteToken') { onDeleteToken?.(); return; }
    if (toolId === 'addToken') { onOpenTokenDialog?.(); return; }
    if (toolId === 'editToken') { onEditToken?.(); return; }
    // "Mover" usa a mesma ferramenta de selecao: o token e arrastado no mapa (itens 6/37)
    const target = toolId === 'move' ? 'select' : toolId;
    onToolChange(target);
  }

  return (
    <div className="toolbar">
      <div className="tool-group">
        {tools.map((t) => (
          <button key={t.id} className={currentTool === t.id || (t.id === 'move' && currentTool === 'select') ? 'active' : ''} onClick={() => handleToolClick(t.id)}>{t.label}</button>
        ))}
        <button onClick={() => onOpenSheets?.()}>Folhas</button>
      </div>
      {isMaster && (
        <div className="tool-group">
          {masterTools.map((t) => (
            <button key={t.id} className={currentTool === t.id ? 'active' : ''} onClick={() => handleToolClick(t.id)}>{t.label}</button>
          ))}
          {currentTool === 'draw' && (
            <input type="color" value={drawColor || '#e94560'} onChange={(e) => onDrawColorChange?.(e.target.value)} style={{ width: 28, height: 24, padding: 0, cursor: 'pointer', border: '1px solid #555' }} />
          )}
          {currentTool === 'erase' && (
            <button onClick={onClearDrawings}>Limpar Tudo</button>
          )}
        </div>
      )}
      {isMaster && (
        <div className="tool-group">
          {fogTools.map((t) => (
            <button key={t.id} className={currentTool === t.id ? 'active' : ''} onClick={() => handleToolClick(t.id)}>{t.label}</button>
          ))}
        </div>
      )}
      {isMaster && (
        <div className="tool-group">
          <button className={gridVisible ? 'active' : ''} onClick={onToggleGrid}>Grade</button>
          <button onClick={onOpenGridSettings}>Config. Mapa</button>
        </div>
      )}
    </div>
  );
}
