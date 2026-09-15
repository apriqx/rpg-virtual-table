import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Image as KonvaImage, Text, Group, Circle, Arrow } from 'react-konva';
import React from 'react';
import { resolveUrl } from '../services/api';

const TokenComponent = React.memo(function TokenComponent({ token, isSelected, isActive, isMaster, masquerade, onDragEnd, onClick, snapToGrid, canMove }) {
  const [img, setImg] = useState(null);

  useEffect(() => {
    if (token.imageUrl) {
      const image = new window.Image(); image.crossOrigin = 'anonymous'; image.src = resolveUrl(token.imageUrl);
      image.onload = () => setImg(image); image.onerror = () => setImg(null);
    } else { setImg(null); }
  }, [token.imageUrl]);

  function handleDragEnd(e) { const x = e.target.x(); const y = e.target.y(); const snapped = snapToGrid(x, y); onDragEnd(token.id, snapped.x, snapped.y); }
  function handleClick(e) { e.cancelBubble = true; onClick(token.id); }

  const isMasterLayer = token.layer === 5;
  const canDrag = canMove;
  const charData = masquerade ? null : token.character?.data;
  const hasHp = charData && typeof charData.hp?.max === 'number' && charData.hp.max > 0;
  const hpCur = hasHp ? (charData.hp.current || 0) + (charData.hp.temp || 0) : 0;
  const hpMax = hasHp ? charData.hp.max : 0;
  const hpPct = hpMax > 0 ? Math.max(0, Math.min(100, hpCur / hpMax * 100)) : 0;
  const hpColor = hpPct > 50 ? '#50fa7b' : hpPct > 25 ? '#f1fa8c' : '#ff5555';
  const hpBarH = hasHp ? 5 : 0;
  const hasLight = (token.lightRadius || 0) > 0 && !masquerade;

  return (
    <Group x={token.x} y={token.y} draggable={canDrag} onDragEnd={handleDragEnd} onClick={handleClick} onTap={handleClick}>
      {hasLight && (
        <Circle x={token.width / 2} y={token.height / 2} radius={token.lightRadius} fill="radial-gradient(rgba(255,255,200,0.08) 0%, rgba(255,255,200,0.03) 50%, transparent 70%)" stroke="rgba(255,255,200,0.15)" strokeWidth={1} listening={false} />
      )}
      {img ? (
        <KonvaImage image={img} width={token.width} height={token.height + hpBarH} stroke={isSelected ? '#4a9eff' : isActive ? '#f1fa8c' : (isMasterLayer ? '#e94560' : 'transparent')} strokeWidth={isSelected ? 2 : isActive ? 3 : (isMasterLayer ? 2 : 0)} dash={isActive && !isSelected ? [8, 4] : (isMasterLayer && !isSelected ? [6, 3] : undefined)} />
      ) : (
        <Rect width={token.width} height={token.height + hpBarH} fill={isMasterLayer ? '#e94560' : '#0f3460'} stroke={isSelected ? '#4a9eff' : isActive ? '#f1fa8c' : (isMasterLayer ? '#ff6b81' : '#1a5276')} strokeWidth={isSelected ? 2 : isActive ? 3 : 1} dash={isActive && !isSelected ? [8, 4] : (isMasterLayer ? [6, 3] : undefined)} cornerRadius={4} />
      )}
      {hasHp && (
        <Group listening={false}>
          <Rect x={0} y={token.height} width={token.width} height={hpBarH} fill="#1a1a2e" />
          <Rect x={0} y={token.height} width={(token.width * hpPct) / 100} height={hpBarH} fill={hpColor} />
        </Group>
      )}
      <Text text={masquerade ? (isMaster ? token.name : '???') : token.name} fontSize={11} fill="white" width={token.width} align="center" y={token.height + hpBarH} listening={false} fontStyle="bold" shadowColor="black" shadowBlur={3} shadowOffsetX={1} shadowOffsetY={1} />
    </Group>
  );
});

function MapCanvas({ map, tokens, gridConfig, fogRegions, drawings, annotations, isMaster, currentTool, onTokenMove, onFogUpdate, onAddToken, onTokenSelect, stageRef, brushSize, canMoveToken, masquerade, drawColor, onDrawingCreated, onAnnotationCreated, onDrawingDeleted, onAnnotationDeleted, onAnnotationUpdated, activeTokenId, tableId }) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [mapImage, setMapImage] = useState(null);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const videoRef = useRef(null);
  const videoCanvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const isPanning = useRef(false);
  const lastPointerPos = useRef(null);
  const isVideo = map?.mediaType === 'video';

  const [measureStart, setMeasureStart] = useState(null);
  const [measureEnd, setMeasureEnd] = useState(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState([]);

  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    const observer = new ResizeObserver((entries) => { for (const entry of entries) setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height }); });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!map?.imageUrl) { setMapImage(null); return; }
    if (isVideo) {
      setMapImage(null);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current) { videoRef.current.pause(); videoRef.current = null; }
      const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.src = resolveUrl(map.imageUrl); video.loop = true; video.muted = true; video.playsInline = true;
      videoRef.current = video;
      const canvas = document.createElement('canvas'); canvas.width = map.width; canvas.height = map.height;
      videoCanvasRef.current = canvas;
      video.onloadeddata = () => { video.play(); const ctx = canvas.getContext('2d'); function drawFrame() { ctx.drawImage(video, 0, 0, map.width, map.height); const stage = stageRef.current; if (stage) stage.batchDraw(); animFrameRef.current = requestAnimationFrame(drawFrame); } drawFrame(); };
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (videoRef.current) { videoRef.current.pause(); videoRef.current = null; }
      const image = new window.Image(); image.crossOrigin = 'anonymous'; image.src = resolveUrl(map.imageUrl);
      image.onload = () => setMapImage(image); image.onerror = () => setMapImage(null);
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); if (videoRef.current) { videoRef.current.pause(); videoRef.current = null; } };
  }, [map?.imageUrl, map?.mediaType, map?.width, map?.height]);

  const getPointerPos = useCallback((e) => {
    const stage = e.target.getStage(); if (!stage) return null;
    const pointer = stage.getPointerPosition(); if (!pointer) return null;
    return { x: (pointer.x - stagePos.x) / stageScale, y: (pointer.y - stagePos.y) / stageScale };
  }, [stagePos, stageScale]);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage(); const oldScale = stageScale; const pointer = stage.getPointerPosition();
    const newScale = e.evt.deltaY < 0 ? oldScale * 1.08 : oldScale / 1.08;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));
    const mousePointTo = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale };
    setStageScale(clampedScale); setStagePos({ x: pointer.x - mousePointTo.x * clampedScale, y: pointer.y - mousePointTo.y * clampedScale });
  }, [stageScale, stagePos]);

  const handleMouseDown = useCallback((e) => {
    if (e.evt.button === 1 || (currentTool === 'move' && e.evt.button === 0 && e.target === e.target.getStage())) { isPanning.current = true; lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY }; }
    if (currentTool === 'measure' && isMaster && e.evt.button === 0) { const pos = getPointerPos(e); if (pos) { setMeasureStart(pos); setMeasureEnd(pos); setIsMeasuring(true); } }
    if (currentTool === 'draw' && isMaster && e.evt.button === 0) { const pos = getPointerPos(e); if (pos) { setIsDrawing(true); setCurrentStroke([pos]); } }
  }, [currentTool, isMaster, getPointerPos]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning.current) {
      setStagePos((p) => ({ x: p.x + (e.evt.clientX - lastPointerPos.current.x), y: p.y + (e.evt.clientY - lastPointerPos.current.y) }));
      lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY };
    }
    if (isMeasuring) { const pos = getPointerPos(e); if (pos) setMeasureEnd(pos); }
    if (isDrawing) { const pos = getPointerPos(e); if (pos) setCurrentStroke((s) => [...s, pos]); }
  }, [getPointerPos, isMeasuring, isDrawing]);

  const handleMouseUp = useCallback(async (e) => {
    isPanning.current = false; lastPointerPos.current = null;
    if (isMeasuring && measureEnd) { setIsMeasuring(false); setMeasureStart(null); setMeasureEnd(null); }
    if (isDrawing && currentStroke.length > 1) {
      setIsDrawing(false);
      try { await onDrawingCreated({ color: drawColor || '#e94560', lineWidth: 3, points: currentStroke }); } catch {}
      setCurrentStroke([]);
    } else { setIsDrawing(false); }
  }, [isMeasuring, isDrawing, measureEnd, currentStroke, drawColor, onDrawingCreated]);

  const snapToGrid = useCallback((x, y) => {
    if (!gridConfig.snapToGrid) return { x, y };
    const cs = gridConfig.cellSize;
    return { x: Math.round((x - gridConfig.offsetX) / cs) * cs + gridConfig.offsetX, y: Math.round((y - gridConfig.offsetY) / cs) * cs + gridConfig.offsetY };
  }, [gridConfig]);

  const handleTokenDragEnd = useCallback((tokenId, x, y) => {
    const t = tokens.find((tk) => tk.id === tokenId);
    let cx = x; let cy = y;
    if (t) {
      cx = Math.max(0, Math.min(map.width - t.width, x));
      cy = Math.max(0, Math.min(map.height - t.height, y));
    }
    onTokenMove(tokenId, cx, cy);
  }, [onTokenMove, tokens, map.width, map.height]);
  const handleTokenClick = useCallback((tokenId) => { setSelectedTokenId(tokenId); onTokenSelect(tokenId); }, [onTokenSelect]);

  const handleStageClick = useCallback((e) => {
    if (e.target !== e.target.getStage()) return;
    setSelectedTokenId(null);
    if (currentTool === 'select' && isMaster) {
      const pos = getPointerPos(e); if (!pos) return;
      const hitAnn = (annotations || []).find((a) => Math.hypot(a.x - pos.x, a.y - pos.y) < (a.fontSize || 16));
      if (hitAnn) {
        const text = prompt('Editar texto da anotacao:', hitAnn.text);
        if (text == null || text.trim() === '' || text === hitAnn.text) return;
        onAnnotationUpdated?.(hitAnn.id, { text: text.trim() });
        return;
      }
    }
    if (currentTool === 'erase' && isMaster) {
      const pos = getPointerPos(e); if (!pos) return;
      const hitDrawing = (drawings || []).find((d) => Array.isArray(d.points) && d.points.some((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < 12));
      if (hitDrawing) { onDrawingDeleted?.(hitDrawing.id); return; }
      const hitAnn = (annotations || []).find((a) => Math.hypot(a.x - pos.x, a.y - pos.y) < (a.fontSize || 16));
      if (hitAnn) { onAnnotationDeleted?.(hitAnn.id); return; }
    }
    if (currentTool === 'annotate' && isMaster) {
      const pos = getPointerPos(e); if (!pos) return;
      const text = prompt('Texto da anotacao:'); if (!text) return;
      onAnnotationCreated({ text, x: pos.x, y: pos.y });
      return;
    }
    if (currentTool === 'addToken' && isMaster) {
      const pos = getPointerPos(e); if (!pos) return;
      const snapped = snapToGrid(pos.x, pos.y); onAddToken(snapped.x, snapped.y);
    }
    if (currentTool === 'fogReveal' && isMaster) {
      const pos = getPointerPos(e); if (!pos) return;
      const half = brushSize / 2;
      onFogUpdate([...fogRegions, { id: Date.now().toString(), x: pos.x - half, y: pos.y - half, width: brushSize, height: brushSize, revealed: true }]);
    }
    if (currentTool === 'fogHide' && isMaster) {
      const pos = getPointerPos(e); if (!pos) return;
      const half = brushSize / 2;
      const hideRect = { x: pos.x - half, y: pos.y - half, w: brushSize, h: brushSize };
      const updated = fogRegions.filter((r) => {
        const overlap = !(r.x + r.width <= hideRect.x || hideRect.x + hideRect.w <= r.x || r.y + r.height <= hideRect.y || hideRect.y + hideRect.h <= r.y);
        return !overlap;
      });
      onFogUpdate(updated);
    }
  }, [currentTool, isMaster, getPointerPos, snapToGrid, onAddToken, onFogUpdate, fogRegions, brushSize, onAnnotationCreated, drawings, annotations, onDrawingDeleted, onAnnotationDeleted, onAnnotationUpdated]);

  const gridLines = useMemo(() => {
    if (!gridConfig.visible) return [];
    const lines = []; const cs = gridConfig.cellSize; const ox = gridConfig.offsetX; const oy = gridConfig.offsetY;
    for (let x = ox; x <= map.width; x += cs) lines.push(<Line key={`v${x}`} points={[x, 0, x, map.height]} stroke='white' strokeWidth={gridConfig.lineThickness} opacity={gridConfig.lineOpacity} listening={false} />);
    for (let y = oy; y <= map.height; y += cs) lines.push(<Line key={`h${y}`} points={[0, y, map.width, y]} stroke='white' strokeWidth={gridConfig.lineThickness} opacity={gridConfig.lineOpacity} listening={false} />);
    return lines;
  }, [gridConfig, map.width, map.height]);

  const masterTokens = useMemo(() => tokens.filter((t) => t.layer === 5), [tokens]);
  const playerTokens = useMemo(() => tokens.filter((t) => t.layer !== 5), [tokens]);
  const mapImageSource = isVideo && videoCanvasRef.current ? videoCanvasRef.current : mapImage;

  const getCanMove = useCallback((token) => { if (canMoveToken) return canMoveToken(token); return isMaster || !token.locked; }, [canMoveToken, isMaster]);

  const measureDistance = useMemo(() => {
    if (!measureStart || !measureEnd) return null;
    const dx = measureEnd.x - measureStart.x; const dy = measureEnd.y - measureStart.y;
    const px = Math.sqrt(dx * dx + dy * dy);
    const cells = gridConfig.cellSize > 0 ? px / gridConfig.cellSize : 0;
    const ft = cells * (gridConfig.physicalSize || 1.5);
    return { px: Math.round(px), cells: cells.toFixed(1), ft: ft.toFixed(1) };
  }, [measureStart, measureEnd, gridConfig.cellSize, gridConfig.physicalSize]);

  const drawingLines = useMemo(() => {
    return (drawings || []).map((d) => {
      const pts = Array.isArray(d.points) ? d.points : [];
      if (pts.length < 2) return null;
      const flat = pts.flatMap((p) => [p.x, p.y]);
      return <Line key={d.id} points={flat} stroke={d.color || '#e94560'} strokeWidth={d.lineWidth || 3} lineCap="round" lineJoin="round" listening={false} />;
    }).filter(Boolean);
  }, [drawings]);

  const annotationTexts = useMemo(() => {
    return (annotations || []).map((a) => (
      <Text key={a.id} x={a.x} y={a.y} text={a.text} fontSize={a.fontSize || 16} fill={a.color || '#ffffff'} listening={false} shadowColor="black" shadowBlur={4} shadowOffsetX={1} shadowOffsetY={1} />
    ));
  }, [annotations]);

  const currentDrawLine = useMemo(() => {
    if (currentStroke.length < 2) return null;
    const flat = currentStroke.flatMap((p) => [p.x, p.y]);
    return <Line points={flat} stroke={drawColor || '#e94560'} strokeWidth={3} lineCap="round" lineJoin="round" listening={false} dash={[5, 5]} />;
  }, [currentStroke, drawColor]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <Stage ref={stageRef} width={containerSize.width} height={containerSize.height} scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onClick={handleStageClick} draggable={currentTool === 'move'} style={{ cursor: currentTool === 'move' ? 'grab' : currentTool === 'draw' ? 'crosshair' : currentTool === 'measure' ? 'crosshair' : currentTool === 'annotate' ? 'text' : currentTool === 'erase' ? 'pointer' : 'default' }}>
        <Layer listening={false}>
          {mapImageSource ? <KonvaImage image={mapImageSource} width={map.width} height={map.height} /> : <Rect width={map.width} height={map.height} fill="#2a2a3e" />}
        </Layer>
        <Layer listening={false}>{drawingLines}{currentDrawLine}</Layer>
        <Layer listening={false}>{annotationTexts}</Layer>
        {isMaster && masterTokens.length > 0 && (
          <Layer>{masterTokens.map((token) => (<TokenComponent key={token.id} token={token} isSelected={selectedTokenId === token.id} isActive={activeTokenId === token.id} isMaster={isMaster} masquerade={masquerade} onDragEnd={handleTokenDragEnd} onClick={handleTokenClick} snapToGrid={snapToGrid} canMove={getCanMove(token)} />))}</Layer>
        )}
        <Layer>{playerTokens.map((token) => (<TokenComponent key={token.id} token={token} isSelected={selectedTokenId === token.id} isActive={activeTokenId === token.id} isMaster={isMaster} masquerade={masquerade} onDragEnd={handleTokenDragEnd} onClick={handleTokenClick} snapToGrid={snapToGrid} canMove={getCanMove(token)} />))}</Layer>
        <Layer listening={false}>{gridLines}</Layer>
        <Layer listening={false}>
          <Rect x={0} y={0} width={map.width} height={map.height} fill="black" opacity={0.7} globalCompositeOperation="source-over" />
          <Group globalCompositeOperation="destination-out">
            {fogRegions.filter((r) => r.revealed).map((r, i) => (<Rect key={r.id || i} x={r.x} y={r.y} width={r.width} height={r.height} fill="white" />))}
            {tokens.filter((t) => (t.lightRadius || 0) > 0 && !masquerade).map((t) => (<Circle key={`light-${t.id}`} x={t.x + t.width / 2} y={t.y + t.height / 2} radius={t.lightRadius} fill="white" />))}
          </Group>
        </Layer>
        {(isMeasuring || currentTool === 'measure') && measureStart && measureEnd && (
          <Layer listening={false}>
            <Line points={[measureStart.x, measureStart.y, measureEnd.x, measureEnd.y]} stroke="#f1fa8c" strokeWidth={2} dash={[8, 4]} />
            <Circle x={measureStart.x} y={measureStart.y} radius={4} fill="#f1fa8c" listening={false} />
            <Circle x={measureEnd.x} y={measureEnd.y} radius={4} fill="#f1fa8c" listening={false} />
            {measureDistance && (
              <Group>
                <Rect x={(measureStart.x + measureEnd.x) / 2 - 50} y={(measureStart.y + measureEnd.y) / 2 - 22} width={100} height={20} fill="rgba(0,0,0,0.8)" cornerRadius={4} listening={false} />
                <Text x={(measureStart.x + measureEnd.x) / 2} y={(measureStart.y + measureEnd.y) / 2 - 10} text={`${measureDistance.cells} cel (${measureDistance.ft}ft)`} fontSize={12} fill="#f1fa8c" align="center" width={100} listening={false} />
              </Group>
            )}
          </Layer>
        )}
      </Stage>
    </div>
  );
}

export default React.memo(MapCanvas);