import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Image as KonvaImage, Text, Group, Circle, Ellipse, Arrow } from 'react-konva';
import React from 'react';
import { resolveUrl } from '../services/api';
import { markerEmoji } from './tokenMarkers';

const TokenComponent = React.memo(function TokenComponent({ token, isSelected, isActive, isMaster, masquerade, onDragEnd, onClick, onContextMenu, onMenuOpen, snapToGrid, canMove }) {
  const [img, setImg] = useState(null);

  useEffect(() => {
    if (token.imageUrl) {
      const image = new window.Image(); image.crossOrigin = 'anonymous'; image.src = resolveUrl(token.imageUrl);
      image.onload = () => setImg(image); image.onerror = () => setImg(null);
    } else { setImg(null); }
  }, [token.imageUrl]);

  function handleDragEnd(e) { const x = e.target.x(); const y = e.target.y(); const snapped = snapToGrid(token, x, y); onDragEnd(token.id, snapped.x, snapped.y); }
  function handleClick(e) { e.cancelBubble = true; onClick(token.id, e); }
  function handleContext(e) { e.cancelBubble = true; if (onContextMenu) onContextMenu(token, e); }
  function handleMenu(e) { e.cancelBubble = true; if (onMenuOpen) onMenuOpen(token, e); }

  const isMasterLayer = token.layer === 5;
  const canDrag = canMove && !token.locked;
  const opacity = typeof token.opacity === 'number' ? Math.max(0.1, Math.min(1, token.opacity)) : 1;
  const rotation = Number(token.rotation) || 0;
  const w = token.width;
  const h = token.height;
  const hasLight = (token.lightRadius || 0) > 0 && !masquerade;

  const charData = masquerade ? null : token.character && token.character.data;
  const customBars = Array.isArray(token.bars) ? token.bars.filter((b) => b && b.visible !== false && Number(b.max) > 0).slice(0, 3) : [];
  const hasHp = customBars.length === 0 && charData && typeof charData.hp && typeof charData.hp.max === 'number' && charData.hp.max > 0;
  const barList = customBars.length > 0
    ? customBars.map((b) => ({ pct: Math.max(0, Math.min(100, (Number(b.current) / Number(b.max)) * 100)), color: b.color || '#50fa7b' }))
    : (hasHp ? [{ pct: Math.max(0, Math.min(100, (((charData.hp.current || 0) + (charData.hp.temp || 0)) / charData.hp.max) * 100)), color: (((charData.hp.current || 0) + (charData.hp.temp || 0)) / charData.hp.max) > 0.5 ? '#50fa7b' : (((charData.hp.current || 0) + (charData.hp.temp || 0)) / charData.hp.max) > 0.25 ? '#f1fa8c' : '#ff5555' }] : []);
  const barsH = barList.length * 6;

  let label = null;
  if (masquerade) label = isMaster ? token.name : '???';
  else if (isMaster || token.showName !== false) label = token.displayName || token.name;
  const markers = Array.isArray(token.statusMarkers) ? token.statusMarkers.slice(0, 6) : [];

  return (
    <Group x={token.x} y={token.y} draggable={canDrag} onDragEnd={handleDragEnd} onClick={handleClick} onTap={handleClick} onContextMenu={handleContext} opacity={opacity}>
      {isSelected && (
        <Rect x={-4} y={-4} width={w + 8} height={h + barsH + 8} stroke="#4a9eff" strokeWidth={2} dash={[6, 3]} cornerRadius={6} listening={false} />
      )}
      {hasLight && (
        <Circle x={w / 2} y={h / 2} radius={token.lightRadius} fill="radial-gradient(rgba(255,255,200,0.08) 0%, rgba(255,255,200,0.03) 50%, transparent 70%)" stroke="rgba(255,255,200,0.15)" strokeWidth={1} listening={false} />
      )}
      <Group rotation={rotation} x={w / 2} y={h / 2} offsetX={w / 2} offsetY={h / 2}>
        {img ? (
          <KonvaImage image={img} width={w} height={h} stroke={isActive ? '#f1fa8c' : (isMasterLayer ? '#e94560' : 'transparent')} strokeWidth={isActive ? 3 : (isMasterLayer ? 2 : 0)} dash={isActive ? [8, 4] : (isMasterLayer ? [6, 3] : undefined)} />
        ) : (
          <Rect width={w} height={h} fill={isMasterLayer ? '#e94560' : '#0f3460'} stroke={isActive ? '#f1fa8c' : (isMasterLayer ? '#ff6b81' : '#1a5276')} strokeWidth={isActive ? 3 : 1} dash={isActive ? [8, 4] : (isMasterLayer ? [6, 3] : undefined)} cornerRadius={4} />
        )}
      </Group>
      {isMaster && token.locked && (
        <Text text="🔒" x={-8} y={-8} fontSize={12} listening={false} />
      )}
      {markers.length > 0 && (
        <Group y={-16} listening={false}>
          {markers.map((m, i) => (
            <Group key={`${m}-${i}`} x={i * 18}>
              <Circle x={8} y={0} radius={8} fill="rgba(10,10,20,0.85)" stroke="#4a9eff" strokeWidth={1} />
              <Text text={markerEmoji(m)} x={0} y={-7} width={16} align="center" fontSize={10} />
            </Group>
          ))}
        </Group>
      )}
      {barList.length > 0 && (
        <Group listening={false}>
          {barList.map((b, i) => (
            <Group key={i} y={h + i * 6}>
              <Rect width={w} height={5} fill="#1a1a2e" />
              <Rect width={(w * b.pct) / 100} height={5} fill={b.color} />
            </Group>
          ))}
        </Group>
      )}
      {label && (
        <Text text={label} fontSize={11} fill="white" width={w} align="center" y={h + barsH} listening={false} fontStyle="bold" shadowColor="black" shadowBlur={3} shadowOffsetX={1} shadowOffsetY={1} />
      )}
      {isSelected && onMenuOpen && (
        <Group x={w - 2} y={-16} onClick={handleMenu} onTap={handleMenu}>
          <Circle x={8} y={0} radius={9} fill="#1a1a2e" stroke="#4a9eff" strokeWidth={1} />
          <Text text="⋯" x={0} y={-8} width={16} align="center" fontSize={14} fontStyle="bold" fill="#4a9eff" />
        </Group>
      )}
    </Group>
  );
});

function MapCanvas({ map, tokens, gridConfig, fogRegions, drawings, annotations, isMaster, currentTool, onTokenMove, onFogUpdate, onAddToken, onTokenSelect, stageRef, brushSize, canMoveToken, masquerade, drawColor, fogShape, onDrawingCreated, onAnnotationCreated, onDrawingDeleted, onAnnotationDeleted, onAnnotationUpdated, activeTokenId, tableId, onTokenEdit, onTokenDuplicate, onTokenPatch, onTokenDelete, onTokenPermissions, canControlToken, onSelectionChange }) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [mapImage, setMapImage] = useState(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const marqueeMoved = useRef(false);
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

  const [fogPreview, setFogPreview] = useState(null);
  const [freePoints, setFreePoints] = useState([]);
  const [tokenMenu, setTokenMenu] = useState(null);

  useEffect(() => { setFreePoints([]); setFogPreview(null); }, [currentTool, fogShape]);

  useEffect(() => { setSelectedTokenIds([]); setMarquee(null); if (onSelectionChange) onSelectionChange([]); }, [map.id]);

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
    if (currentTool === 'select' && e.evt.button === 0 && e.target === e.target.getStage()) { const pos = getPointerPos(e); if (pos) { marqueeMoved.current = false; setMarquee({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y }); } }
    if (currentTool === 'measure' && isMaster && e.evt.button === 0) { const pos = getPointerPos(e); if (pos) { setMeasureStart(pos); setMeasureEnd(pos); setIsMeasuring(true); } }
    if (currentTool === 'draw' && isMaster && e.evt.button === 0) { const pos = getPointerPos(e); if (pos) { setIsDrawing(true); setCurrentStroke([pos]); } }
  }, [currentTool, isMaster, getPointerPos]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning.current) {
      setStagePos((p) => ({ x: p.x + (e.evt.clientX - lastPointerPos.current.x), y: p.y + (e.evt.clientY - lastPointerPos.current.y) }));
      lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY };
    }
    if (marquee) {
      const pos = getPointerPos(e);
      if (pos) {
        if (Math.abs(pos.x - marquee.x1) > 4 || Math.abs(pos.y - marquee.y1) > 4) marqueeMoved.current = true;
        setMarquee((m) => (m ? { ...m, x2: pos.x, y2: pos.y } : m));
      }
    }
    if (isMeasuring) { const pos = getPointerPos(e); if (pos) setMeasureEnd(pos); }
    if (isDrawing) { const pos = getPointerPos(e); if (pos) setCurrentStroke((s) => [...s, pos]); }
    if (isMaster && fogShape !== 'free' && (currentTool === 'fogReveal' || currentTool === 'fogHide')) { setFogPreview(getPointerPos(e)); }
  }, [getPointerPos, isMeasuring, isDrawing, isMaster, fogShape, currentTool, marquee]);

  const handleStageMouseLeave = useCallback(() => { setFogPreview(null); }, []);

  const handleMouseUp = useCallback(async (e) => {
    isPanning.current = false; lastPointerPos.current = null;
    if (marquee) {
      const rect = { x: Math.min(marquee.x1, marquee.x2), y: Math.min(marquee.y1, marquee.y2), width: Math.abs(marquee.x2 - marquee.x1), height: Math.abs(marquee.y2 - marquee.y1) };
      setMarquee(null);
      if (marqueeMoved.current && rect.width > 4 && rect.height > 4) {
        const hits = tokens.filter((t) => t.x < rect.x + rect.width && t.x + t.width > rect.x && t.y < rect.y + rect.height && t.y + t.height > rect.y).map((t) => t.id);
        setSelectedTokenIds(hits);
        if (onSelectionChange) onSelectionChange(hits);
      }
      return;
    }
    if (isMeasuring && measureEnd) { setIsMeasuring(false); setMeasureStart(null); setMeasureEnd(null); }
    if (isDrawing && currentStroke.length > 1) {
      setIsDrawing(false);
      try { await onDrawingCreated({ color: drawColor || '#e94560', lineWidth: 3, points: currentStroke }); } catch {}
      setCurrentStroke([]);
    } else { setIsDrawing(false); }
  }, [marquee, tokens, onSelectionChange, isMeasuring, isDrawing, measureEnd, currentStroke, drawColor, onDrawingCreated]);

  const getCanMove = useCallback((token) => { if (canMoveToken) return canMoveToken(token); return isMaster || !token.locked; }, [canMoveToken, isMaster]);

  const snapToGrid = useCallback((token, x, y) => {
    if (token && token.snapToGrid === false) return { x, y };
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
    const moves = [{ id: tokenId, x: cx, y: cy }];
    if (selectedTokenIds.includes(tokenId) && selectedTokenIds.length > 1) {
      const dx = cx - (t ? t.x : x); const dy = cy - (t ? t.y : y);
      for (const id of selectedTokenIds) {
        if (id === tokenId) continue;
        const o = tokens.find((tk) => tk.id === id);
        if (!o || !getCanMove(o) || o.locked) continue;
        const snapped = snapToGrid(o, Math.max(0, Math.min(map.width - o.width, o.x + dx)), Math.max(0, Math.min(map.height - o.height, o.y + dy)));
        moves.push({ id: o.id, x: snapped.x, y: snapped.y });
      }
    }
    onTokenMove(moves);
  }, [onTokenMove, tokens, map.width, map.height, selectedTokenIds, getCanMove, snapToGrid]);

  const handleTokenClick = useCallback((tokenId, evt) => {
    const shift = evt && evt.evt && (evt.evt.shiftKey || evt.evt.ctrlKey || evt.evt.metaKey);
    setSelectedTokenIds((prev) => {
      const next = shift ? (prev.includes(tokenId) ? prev.filter((id) => id !== tokenId) : [...prev, tokenId]) : [tokenId];
      if (onSelectionChange) onSelectionChange(next);
      return next;
    });
    onTokenSelect(tokenId);
  }, [onTokenSelect, onSelectionChange]);

  const handleStageClick = useCallback((e) => {
    if (e.target !== e.target.getStage()) return;
    if (marqueeMoved.current) { marqueeMoved.current = false; return; }
    if (selectedTokenIds.length > 0) { setSelectedTokenIds([]); if (onSelectionChange) onSelectionChange([]); }
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
      const snapped = snapToGrid(null, pos.x, pos.y); onAddToken(snapped.x, snapped.y);
    }
    if ((currentTool === 'fogReveal' || currentTool === 'fogHide') && isMaster) {
      const pos = getPointerPos(e); if (!pos) return;
      const reveal = currentTool === 'fogReveal';
      if (fogShape === 'free') {
        if (freePoints.length >= 3 && Math.hypot(pos.x - freePoints[0].x, pos.y - freePoints[0].y) <= 12 / stageScale) {
          const xs = freePoints.map((p) => p.x); const ys = freePoints.map((p) => p.y);
          const minX = Math.min(...xs); const minY = Math.min(...ys);
          const region = { id: Date.now().toString(), x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY, shape: 'polygon', points: freePoints.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]), revealed: true };
          if (reveal) onFogUpdate([...fogRegions, region]);
          else onFogUpdate(fogRegions.filter((r) => !(r.x + r.width <= region.x || region.x + region.width <= r.x || r.y + r.height <= region.y || region.y + region.height <= r.y)));
          setFreePoints([]);
          return;
        }
        setFreePoints((p) => [...p, pos]);
        return;
      }
      const half = brushSize / 2;
      const region = { id: Date.now().toString(), x: pos.x - half, y: pos.y - half, width: brushSize, height: brushSize, revealed: true };
      if (fogShape === 'circle') region.shape = 'circle';
      if (reveal) onFogUpdate([...fogRegions, region]);
      else onFogUpdate(fogRegions.filter((r) => !(r.x + r.width <= region.x || region.x + region.width <= r.x || r.y + r.height <= region.y || region.y + region.height <= r.y)));
    }
  }, [currentTool, isMaster, getPointerPos, snapToGrid, onAddToken, onFogUpdate, fogRegions, brushSize, fogShape, freePoints, stageScale, onAnnotationCreated, drawings, annotations, onDrawingDeleted, onAnnotationDeleted, onAnnotationUpdated]);

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

  const openTokenMenu = useCallback((token, e) => {
    const container = containerRef.current;
    if (!container) return;
    let cx = null; let cy = null;
    const stage = stageRef && stageRef.current;
    const p = stage ? stage.getPointerPosition() : null;
    if (p) { cx = p.x; cy = p.y; }
    else if (e && e.evt && typeof e.evt.clientX === 'number') {
      const rect = container.getBoundingClientRect();
      cx = e.evt.clientX - rect.left; cy = e.evt.clientY - rect.top;
    }
    if (cx === null) return;
    setTokenMenu({
      x: Math.min(Math.max(cx, 8), Math.max(8, containerSize.width - 200)),
      y: Math.min(Math.max(cy, 8), Math.max(8, containerSize.height - 300)),
      token,
    });
  }, [stageRef, containerSize.width, containerSize.height]);

  const handleTokenContextMenu = useCallback((token, e) => {
    if (canControlToken ? !canControlToken(token) : !isMaster) return;
    if (onTokenSelect) onTokenSelect(token.id);
    openTokenMenu(token, e);
  }, [canControlToken, isMaster, onTokenSelect, openTokenMenu]);

  const renderToken = (token) => (
    <TokenComponent key={token.id} token={token} isSelected={selectedTokenIds.includes(token.id)} isActive={activeTokenId === token.id} isMaster={isMaster} masquerade={masquerade} onDragEnd={handleTokenDragEnd} onClick={handleTokenClick} onContextMenu={handleTokenContextMenu} onMenuOpen={openTokenMenu} snapToGrid={snapToGrid} canMove={getCanMove(token)} />
  );

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
      <Stage ref={stageRef} width={containerSize.width} height={containerSize.height} scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleStageMouseLeave} onClick={handleStageClick} draggable={currentTool === 'move'} style={{ cursor: currentTool === 'move' ? 'grab' : currentTool === 'draw' ? 'crosshair' : currentTool === 'measure' ? 'crosshair' : currentTool === 'annotate' ? 'text' : currentTool === 'erase' ? 'pointer' : (currentTool === 'fogReveal' || currentTool === 'fogHide') ? 'crosshair' : 'default' }}>
        <Layer listening={false}>
          {mapImageSource ? <KonvaImage image={mapImageSource} width={map.width} height={map.height} /> : <Rect width={map.width} height={map.height} fill="#2a2a3e" />}
        </Layer>
        <Layer listening={false}>{drawingLines}{currentDrawLine}</Layer>
        <Layer listening={false}>{annotationTexts}</Layer>
        {isMaster && masterTokens.length > 0 && (
          <Layer>{masterTokens.map(renderToken)}</Layer>
        )}
        <Layer>{playerTokens.map(renderToken)}</Layer>
        <Layer listening={false}>{gridLines}</Layer>
        <Layer listening={false}>
          <Rect x={0} y={0} width={map.width} height={map.height} fill="black" opacity={0.7} globalCompositeOperation="source-over" />
          <Group globalCompositeOperation="destination-out">
            {fogRegions.filter((r) => r.revealed).map((r, i) => {
              if (r.shape === 'circle') return <Ellipse key={r.id || i} x={r.x + r.width / 2} y={r.y + r.height / 2} radiusX={r.width / 2} radiusY={r.height / 2} fill="white" />;
              const pts = Array.isArray(r.points) ? r.points : null;
              if (r.shape === 'polygon' && pts && pts.length >= 3) return <Line key={r.id || i} points={pts.flatMap((p) => p)} closed fill="white" stroke="white" strokeWidth={1} lineJoin="round" />;
              return <Rect key={r.id || i} x={r.x} y={r.y} width={r.width} height={r.height} fill="white" />;
            })}
            {tokens.filter((t) => (t.lightRadius || 0) > 0 && !masquerade).map((t) => (<Circle key={`light-${t.id}`} x={t.x + t.width / 2} y={t.y + t.height / 2} radius={t.lightRadius} fill="white" />))}
            {tokens.filter((t) => !masquerade && ((t.visionRadius || 0) > 0 || (map.darkMode && t.visible !== false))).map((t) => {
              const pxPerFt = (gridConfig.cellSize || 50) / (gridConfig.physicalSize || 1.5);
              const hasVision = (t.visionRadius || 0) > 0;
              const r = hasVision ? t.visionRadius * pxPerFt : 6 * (gridConfig.cellSize || 50);
              return (
                <Circle key={`vision-${t.id}`} x={t.x + t.width / 2} y={t.y + t.height / 2} radius={r}
                  fillRadialGradientStart={{ x: 0, y: 0 }} fillRadialGradientStartRadius={0}
                  fillRadialGradientEnd={{ x: 0, y: 0 }} fillRadialGradientEndRadius={r}
                  fillRadialGradientColorStops={hasVision ? [0, 'rgba(255,255,255,1)', 0.55, 'rgba(255,255,255,0.85)', 1, 'rgba(255,255,255,0)'] : [0, 'rgba(255,255,255,1)', 0.6, 'rgba(255,255,255,0.8)', 1, 'rgba(255,255,255,0)']} />
              );
            })}
          </Group>
        </Layer>
        {isMaster && (currentTool === 'fogReveal' || currentTool === 'fogHide') && (
          <Layer listening={false}>
            {(() => {
              const color = currentTool === 'fogReveal' ? '#50fa7b' : '#ff5555';
              const sw = 1.5 / stageScale;
              return (
                <>
                  {fogShape === 'square' && fogPreview && (
                    <Rect x={fogPreview.x - brushSize / 2} y={fogPreview.y - brushSize / 2} width={brushSize} height={brushSize} stroke={color} strokeWidth={sw} dash={[6 / stageScale, 4 / stageScale]} fill={color} opacity={0.2} />
                  )}
                  {fogShape === 'circle' && fogPreview && (
                    <Circle x={fogPreview.x} y={fogPreview.y} radius={brushSize / 2} stroke={color} strokeWidth={sw} dash={[6 / stageScale, 4 / stageScale]} fill={color} opacity={0.2} />
                  )}
                  {fogShape === 'free' && freePoints.length > 0 && (
                    <Group>
                      <Line points={freePoints.flatMap((p) => [p.x, p.y])} stroke={color} strokeWidth={sw} dash={[6 / stageScale, 4 / stageScale]} lineJoin="round" />
                      {freePoints.map((p, i) => (<Circle key={i} x={p.x} y={p.y} radius={(i === 0 ? 7 : 4) / stageScale} fill={i === 0 ? '#f1fa8c' : color} />))}
                    </Group>
                  )}
                </>
              );
            })()}
          </Layer>
        )}
        {marquee && (
          <Layer listening={false}>
            <Rect x={Math.min(marquee.x1, marquee.x2)} y={Math.min(marquee.y1, marquee.y2)} width={Math.abs(marquee.x2 - marquee.x1)} height={Math.abs(marquee.y2 - marquee.y1)} stroke="#4a9eff" strokeWidth={1.5 / stageScale} dash={[6 / stageScale, 4 / stageScale]} fill="rgba(74,158,255,0.12)" />
          </Layer>
        )}
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
      {tokenMenu && (
        <>
          <div className="tcm-backdrop" onClick={() => setTokenMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTokenMenu(null); }} />
          <div className="token-context-menu" style={{ left: tokenMenu.x, top: tokenMenu.y }}>
            <div className="tcm-title">{tokenMenu.token.displayName || tokenMenu.token.name}</div>
            {(isMaster || (canControlToken && canControlToken(tokenMenu.token))) && (
              <button type="button" onClick={() => { const t = tokenMenu.token; setTokenMenu(null); if (onTokenEdit) onTokenEdit(t); }}>✏️ Editar</button>
            )}
            {isMaster && (
              <button type="button" onClick={() => { const t = tokenMenu.token; setTokenMenu(null); if (onTokenDuplicate) onTokenDuplicate(t); }}>📄 Duplicar</button>
            )}
            {(isMaster || (canControlToken && canControlToken(tokenMenu.token))) && (
              <button type="button" onClick={() => { const t = tokenMenu.token; setTokenMenu(null); if (onTokenPatch) onTokenPatch(t, { locked: !t.locked }); }}>{tokenMenu.token.locked ? '🔓 Desbloquear' : '🔒 Bloquear'}</button>
            )}
            {isMaster && (
              <div className="tcm-group">
                <span className="tcm-group-label">Camada</span>
                <div className="tcm-group-btns">
                  {[{ v: 1, l: 'Efeitos' }, { v: 2, l: 'Tokens' }, { v: 5, l: 'Mestre' }].map((o) => (
                    <button key={o.v} type="button" className={tokenMenu.token.layer === o.v ? 'active' : ''} onClick={() => { const t = tokenMenu.token; setTokenMenu(null); if (onTokenPatch) onTokenPatch(t, { layer: o.v }); }}>{o.l}</button>
                  ))}
                </div>
              </div>
            )}
            {isMaster && (
              <button type="button" onClick={() => { const t = tokenMenu.token; setTokenMenu(null); if (onTokenPermissions) onTokenPermissions(t); }}>👥 Permissões</button>
            )}
            {(isMaster || (canControlToken && canControlToken(tokenMenu.token))) && (
              <button type="button" className="tcm-danger" onClick={() => { const t = tokenMenu.token; setTokenMenu(null); if (window.confirm('Excluir este token?') && onTokenDelete) onTokenDelete(t); }}>🗑 Excluir</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default React.memo(MapCanvas);