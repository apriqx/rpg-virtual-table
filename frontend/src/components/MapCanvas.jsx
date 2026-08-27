import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Image as KonvaImage, Text, Group, Circle } from 'react-konva';
import React from 'react';

const TokenComponent = React.memo(function TokenComponent({ token, isSelected, isMaster, onDragEnd, onClick, onSelect }) {
  const [img, setImg] = useState(null);

  useEffect(() => {
    if (token.imageUrl) {
      const image = new window.Image();
      image.crossOrigin = 'anonymous';
      image.src = token.imageUrl;
      image.onload = () => setImg(image);
    } else {
      setImg(null);
    }
  }, [token.imageUrl]);

  function handleDragEnd(e) {
    onDragEnd(token.id, e.target.x(), e.target.y());
  }

  function handleClick(e) {
    e.cancelBubble = true;
    onClick(token.id);
  }

  const isMasterLayer = token.layer === 5;

  return (
    <Group
      x={token.x}
      y={token.y}
      draggable={isMaster || !token.locked}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
    >
      {img ? (
        <KonvaImage
          image={img}
          width={token.width}
          height={token.height}
          stroke={isSelected ? '#4a9eff' : (isMasterLayer ? '#e94560' : 'transparent')}
          strokeWidth={isSelected ? 2 : (isMasterLayer ? 2 : 0)}
          dash={isMasterLayer && !isSelected ? [6, 3] : undefined}
        />
      ) : (
        <Rect
          width={token.width}
          height={token.height}
          fill={isMasterLayer ? '#e94560' : '#0f3460'}
          stroke={isSelected ? '#4a9eff' : (isMasterLayer ? '#ff6b81' : '#1a5276')}
          strokeWidth={isSelected ? 2 : 1}
          dash={isMasterLayer ? [6, 3] : undefined}
          cornerRadius={4}
        />
      )}
      <Text
        text={token.name}
        fontSize={11}
        fill="white"
        width={token.width}
        align="center"
        y={token.height + 2}
        listening={false}
        fontStyle="bold"
        shadowColor="black"
        shadowBlur={3}
        shadowOffsetX={1}
        shadowOffsetY={1}
      />
    </Group>
  );
});

function MapCanvas({
  map,
  tokens,
  gridConfig,
  fogRegions,
  isMaster,
  currentTool,
  onTokenMove,
  onFogUpdate,
  onAddToken,
  onTokenSelect,
  stageRef,
  brushSize = 50,
}) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [mapImage, setMapImage] = useState(null);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const isPanning = useRef(false);
  const lastPointerPos = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (map?.imageUrl) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = map.imageUrl;
      img.onload = () => setMapImage(img);
    } else {
      setMapImage(null);
    }
  }, [map?.imageUrl]);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();

    const scaleBy = 1.08;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setStageScale(clampedScale);
    setStagePos(newPos);
  }, [stageScale, stagePos]);

  const handleMouseDown = useCallback((e) => {
    if (e.evt.button === 1 || (currentTool === 'move' && e.evt.button === 0 && e.target === e.target.getStage())) {
      isPanning.current = true;
      lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY };
    }
  }, [currentTool]);

  const handleMouseMove = useCallback((e) => {
    if (!isPanning.current) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const newPos = {
      x: stagePos.x + (e.evt.clientX - lastPointerPos.current.x),
      y: stagePos.y + (e.evt.clientY - lastPointerPos.current.y),
    };
    lastPointerPos.current = { x: e.evt.clientX, y: e.evt.clientY };
    setStagePos(newPos);
  }, [stagePos]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    lastPointerPos.current = null;
  }, []);

  const snapToGrid = useCallback((x, y) => {
    if (!gridConfig.snapToGrid) return { x, y };
    const cs = gridConfig.cellSize;
    return {
      x: Math.round((x - gridConfig.offsetX) / cs) * cs + gridConfig.offsetX,
      y: Math.round((y - gridConfig.offsetY) / cs) * cs + gridConfig.offsetY,
    };
  }, [gridConfig]);

  const handleTokenDragEnd = useCallback((tokenId, x, y) => {
    const snapped = snapToGrid(x, y);
    onTokenMove(tokenId, snapped.x, snapped.y);
  }, [onTokenMove, snapToGrid]);

  const handleStageClick = useCallback((e) => {
    if (e.target !== e.target.getStage()) {
      const clickedToken = tokens.find((t) => {
        const node = e.target;
        const parent = node.parent;
        return parent && parent.attrs && parent.attrs.x !== undefined && tokens.some(
          (token) => token.x === parent.attrs.x && token.y === parent.attrs.y
        );
      });
      return;
    }

    setSelectedTokenId(null);

    if (currentTool === 'addToken' && isMaster) {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      const x = (pointer.x - stagePos.x) / stageScale;
      const y = (pointer.y - stagePos.y) / stageScale;
      const snapped = snapToGrid(x, y);
      onAddToken(snapped.x, snapped.y);
    }

    if ((currentTool === 'fogReveal' || currentTool === 'fogHide') && isMaster) {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      const x = (pointer.x - stagePos.x) / stageScale;
      const y = (pointer.y - stagePos.y) / stageScale;
      const half = brushSize / 2;
      const newRegion = {
        x: x - half,
        y: y - half,
        width: brushSize,
        height: brushSize,
        revealed: currentTool === 'fogReveal',
      };
      onFogUpdate([...fogRegions, newRegion]);
    }
  }, [currentTool, isMaster, stagePos, stageScale, snapToGrid, onAddToken, onFogUpdate, fogRegions, brushSize, tokens]);

  const handleTokenClick = useCallback((tokenId) => {
    setSelectedTokenId(tokenId);
    onTokenSelect(tokenId);
  }, [onTokenSelect]);

  const gridLines = useMemo(() => {
    if (!gridConfig.visible) return [];
    const lines = [];
    const cs = gridConfig.cellSize;
    const ox = gridConfig.offsetX;
    const oy = gridConfig.offsetY;
    for (let x = ox; x <= map.width; x += cs) {
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, 0, x, map.height]}
          stroke="white"
          strokeWidth={gridConfig.lineThickness}
          opacity={gridConfig.lineOpacity}
          listening={false}
        />
      );
    }
    for (let y = oy; y <= map.height; y += cs) {
      lines.push(
        <Line
          key={`h${y}`}
          points={[0, y, map.width, y]}
          stroke="white"
          strokeWidth={gridConfig.lineThickness}
          opacity={gridConfig.lineOpacity}
          listening={false}
        />
      );
    }
    return lines;
  }, [gridConfig, map.width, map.height]);

  const playerTokens = useMemo(() => tokens.filter((t) => t.layer !== 5), [tokens]);
  const masterTokens = useMemo(() => tokens.filter((t) => t.layer === 5), [tokens]);

  const isDraggable = currentTool === 'select' || currentTool === 'move';

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
        draggable={currentTool === 'move'}
        style={{ cursor: currentTool === 'move' ? 'grab' : 'default' }}
      >
        <Layer listening={false}>
          {mapImage ? (
            <KonvaImage image={mapImage} width={map.width} height={map.height} />
          ) : (
            <Rect width={map.width} height={map.height} fill="#2a2a3e" />
          )}
        </Layer>

        <Layer>
          {playerTokens.map((token) => (
            <TokenComponent
              key={token.id}
              token={token}
              isSelected={selectedTokenId === token.id}
              isMaster={isMaster}
              onDragEnd={handleTokenDragEnd}
              onClick={handleTokenClick}
              onSelect={handleTokenClick}
            />
          ))}
        </Layer>

        <Layer listening={false}>
          {gridLines}
        </Layer>

        <Layer listening={false}>
          <Rect
            x={0}
            y={0}
            width={map.width}
            height={map.height}
            fill="black"
            opacity={0.7}
            globalCompositeOperation="source-over"
          />
          <Group globalCompositeOperation="destination-out">
            {fogRegions.filter((r) => r.revealed).map((r, i) => (
              <Rect
                key={r.id || i}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill="white"
              />
            ))}
          </Group>
        </Layer>

        {isMaster && masterTokens.length > 0 && (
          <Layer>
            {masterTokens.map((token) => (
              <TokenComponent
                key={token.id}
                token={token}
                isSelected={selectedTokenId === token.id}
                isMaster={isMaster}
                onDragEnd={handleTokenDragEnd}
                onClick={handleTokenClick}
                onSelect={handleTokenClick}
              />
            ))}
          </Layer>
        )}
      </Stage>
    </div>
  );
}

export default React.memo(MapCanvas);