export default function Toolbar({ currentTool, onToolChange, isMaster, gridVisible, onToggleGrid, onOpenGridSettings, onOpenTokenDialog, onDeleteToken }) {
  const tools = [
    { id: 'select', label: 'Selecionar' },
    { id: 'move', label: 'Mover' },
  ];

  const masterTools = [
    { id: 'addToken', label: '+ Token' },
    { id: 'deleteToken', label: 'Excluir Token' },
  ];

  const fogTools = [
    { id: 'fogReveal', label: 'Revelar Neblina' },
    { id: 'fogHide', label: 'Ocultar Neblina' },
  ];

  function handleToolClick(toolId) {
    if (toolId === 'deleteToken') {
      onDeleteToken?.();
      return;
    }
    if (toolId === 'addToken') {
      onOpenTokenDialog?.();
      return;
    }
    onToolChange(toolId);
  }

  return (
    <div className="toolbar">
      <div className="tool-group">
        {tools.map((t) => (
          <button
            key={t.id}
            className={currentTool === t.id ? 'active' : ''}
            onClick={() => handleToolClick(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isMaster && (
        <div className="tool-group">
          {masterTools.map((t) => (
            <button
              key={t.id}
              className={currentTool === t.id ? 'active' : ''}
              onClick={() => handleToolClick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {isMaster && (
        <div className="tool-group">
          {fogTools.map((t) => (
            <button
              key={t.id}
              className={currentTool === t.id ? 'active' : ''}
              onClick={() => handleToolClick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {isMaster && (
        <div className="tool-group">
          <button
            className={gridVisible ? 'active' : ''}
            onClick={onToggleGrid}
          >
            Grade
          </button>
          <button onClick={onOpenGridSettings}>
            Config. Grade
          </button>
        </div>
      )}
    </div>
  );
}