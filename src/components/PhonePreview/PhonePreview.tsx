import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFlowStore } from '../../hooks/useFlowStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import type { Hotspot } from '../../types';

export function PhonePreview() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const projects = useFlowStore((s) => s.projects);
  const activeProjectId = useFlowStore((s) => s.activeProjectId);
  const switchProject = useFlowStore((s) => s.switchProject);
  const { nodes } = useActiveProject();
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const [editMode, setEditMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playIndex, setPlayIndex] = useState(0);
  const playTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (highlightedPath.length > 1) {
      setPlaying(false);
      setPlayIndex(0);
      setSelectedNode(highlightedPath[0]);
    } else {
      setPlaying(false);
    }
  }, [highlightedPath, setSelectedNode]);

  useEffect(() => {
    if (!playing || highlightedPath.length <= 1) return;
    clearTimeout(playTimerRef.current);
    playTimerRef.current = setTimeout(() => {
      const next = playIndex + 1;
      if (next < highlightedPath.length) {
        setPlayIndex(next);
        setSelectedNode(highlightedPath[next]);
      } else {
        setPlaying(false);
      }
    }, 2000);
    return () => clearTimeout(playTimerRef.current);
  }, [playing, playIndex, highlightedPath, setSelectedNode]);
  const [searchText, setSearchText] = useState('');
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const [selectingTarget, setSelectingTarget] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    corner: 'tl' | 'tr' | 'bl' | 'br';
    anchorX: number; anchorY: number;
  } | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const activeNodeId = selectedNodeId;

  const activeNode = useMemo(() => {
    return nodes.find((n) => n.id === activeNodeId);
  }, [nodes, activeNodeId]);

  const hotspots = activeNode?.data.hotspots || [];
  const hasScreenshot = !!activeNode?.data.screenshot;

  const toPercent = useCallback((clientX: number, clientY: number) => {
    if (!screenRef.current) return { x: 0, y: 0 };
    const rect = screenRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editMode || !activeNode?.data.screenshot) return;
    e.preventDefault();
    const p = toPercent(e.clientX, e.clientY);
    setDrawing({ startX: p.x, startY: p.y, curX: p.x, curY: p.y });
  }, [editMode, activeNode, toPercent]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const p = toPercent(e.clientX, e.clientY);

    if (dragging) {
      const hs = hotspots.find((h) => h.id === dragging.id);
      if (!hs || !activeNodeId) return;
      const newX = Math.max(0, Math.min(100 - hs.width, p.x - dragging.offsetX));
      const newY = Math.max(0, Math.min(100 - hs.height, p.y - dragging.offsetY));
      const updated = hotspots.map((h) =>
        h.id === dragging.id ? { ...h, x: newX, y: newY } : h
      );
      updateNodeData(activeNodeId, { hotspots: updated });
      return;
    }

    if (resizing) {
      const hs = hotspots.find((h) => h.id === resizing.id);
      if (!hs || !activeNodeId) return;
      const ax = resizing.anchorX;
      const ay = resizing.anchorY;
      const minSize = 2;
      let newX: number, newY: number, newW: number, newH: number;

      if (resizing.corner === 'br') {
        newX = ax; newY = ay;
        newW = Math.max(minSize, Math.min(100 - ax, p.x - ax));
        newH = Math.max(minSize, Math.min(100 - ay, p.y - ay));
      } else if (resizing.corner === 'bl') {
        newY = ay;
        newW = Math.max(minSize, ax - Math.max(0, p.x));
        newX = ax - newW;
        newH = Math.max(minSize, Math.min(100 - ay, p.y - ay));
      } else if (resizing.corner === 'tr') {
        newX = ax;
        newW = Math.max(minSize, Math.min(100 - ax, p.x - ax));
        newH = Math.max(minSize, ay - Math.max(0, p.y));
        newY = ay - newH;
      } else {
        newW = Math.max(minSize, ax - Math.max(0, p.x));
        newX = ax - newW;
        newH = Math.max(minSize, ay - Math.max(0, p.y));
        newY = ay - newH;
      }

      const updated = hotspots.map((h) =>
        h.id === resizing.id ? { ...h, x: newX, y: newY, width: newW, height: newH } : h
      );
      updateNodeData(activeNodeId, { hotspots: updated });
      return;
    }

    if (!drawing) return;
    setDrawing((d) => d ? { ...d, curX: p.x, curY: p.y } : null);
  }, [drawing, dragging, resizing, hotspots, activeNodeId, toPercent, updateNodeData]);

  const handleMouseUp = useCallback(() => {
    if (dragging) { setDragging(null); return; }
    if (resizing) { setResizing(null); return; }
    if (!drawing) return;
    const x = Math.min(drawing.startX, drawing.curX);
    const y = Math.min(drawing.startY, drawing.curY);
    const width = Math.abs(drawing.curX - drawing.startX);
    const height = Math.abs(drawing.curY - drawing.startY);
    setDrawing(null);
    if (width < 2 || height < 2) return;
    setSelectingTarget({ x, y, width, height });
  }, [drawing, dragging, resizing]);

  const handleSelectTarget = useCallback((targetNodeId: string, targetProjectId?: string) => {
    if (!selectingTarget || !activeNodeId) return;
    const hotspot: Hotspot = {
      id: uuidv4().slice(0, 8),
      ...selectingTarget,
      targetNodeId,
      ...(targetProjectId ? { targetProjectId } : {}),
    };
    const existing = activeNode?.data.hotspots || [];
    updateNodeData(activeNodeId, { hotspots: [...existing, hotspot] });
    setSelectingTarget(null);
  }, [selectingTarget, activeNodeId, activeNode, updateNodeData]);

  const handleHotspotClick = useCallback((hotspot: Hotspot) => {
    if (editMode) return;
    if (hotspot.targetProjectId) {
      switchProject(hotspot.targetProjectId);
    } else {
      setSelectedNode(hotspot.targetNodeId);
    }
  }, [editMode, setSelectedNode, switchProject]);

  const handleDeleteHotspot = useCallback((hotspotId: string) => {
    if (!activeNodeId || !activeNode) return;
    const hotspots = (activeNode.data.hotspots || []).filter((h) => h.id !== hotspotId);
    updateNodeData(activeNodeId, { hotspots });
  }, [activeNodeId, activeNode, updateNodeData]);

  const drawRect = drawing ? {
    x: Math.min(drawing.startX, drawing.curX),
    y: Math.min(drawing.startY, drawing.curY),
    width: Math.abs(drawing.curX - drawing.startX),
    height: Math.abs(drawing.curY - drawing.startY),
  } : null;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0a0f1a]" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 40 }}>
      {/* Phone mockup — responsive height, container-query driven scaling */}
      <div
        style={{ containerType: 'inline-size', width: 'min(300px, calc((100vh - 280px) * 750 / 1624))', aspectRatio: '750 / 1624' }}
      >
      <div
        className="relative bg-black border-solid border-slate-700 shadow-2xl shadow-black/50 overflow-hidden w-full h-full"
        style={{ borderRadius: '13.333cqw', borderWidth: '1cqw' }}
      >
        <div className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full z-10" style={{ top: '3.333cqw', width: '33.333cqw', height: '9.333cqw' }} />

        {/* Screen */}
        <div
          ref={screenRef}
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: '12.333cqw', cursor: editMode && hasScreenshot ? 'crosshair' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {activeNode ? (
            activeNode.data.screenshot ? (
              <>
                <img
                  src={activeNode.data.screenshot}
                  alt={activeNode.data.title}
                  className="w-full h-full object-cover pointer-events-none select-none"
                  draggable={false}
                />
                {/* Hotspots overlay */}
                {hotspots.map((hs) => {
                  const targetNode = nodes.find((n) => n.id === hs.targetNodeId);
                  const targetProject = hs.targetProjectId
                    ? projects.find((p) => p.id === hs.targetProjectId)
                    : null;
                  const displayLabel = targetProject
                    ? `📑 ${targetProject.name}`
                    : (targetNode?.data.title || hs.targetNodeId);
                  const isDraggingThis = dragging?.id === hs.id || resizing?.id === hs.id;
                  return (
                    <div
                      key={hs.id}
                      onClick={() => handleHotspotClick(hs)}
                      onMouseDown={(e) => {
                        if (!editMode) return;
                        e.stopPropagation();
                        e.preventDefault();
                        const p = toPercent(e.clientX, e.clientY);
                        setDragging({ id: hs.id, offsetX: p.x - hs.x, offsetY: p.y - hs.y });
                      }}
                      className={`absolute ${isDraggingThis ? '' : 'transition-all'} ${
                        editMode
                          ? targetProject
                            ? 'border-2 border-amber-400 bg-amber-400/20'
                            : 'border-2 border-teal-400 bg-teal-400/20'
                          : 'border border-transparent hover:border-teal-400/60 hover:bg-teal-400/10'
                      }`}
                      style={{
                        left: `${hs.x}%`,
                        top: `${hs.y}%`,
                        width: `${hs.width}%`,
                        height: `${hs.height}%`,
                        cursor: editMode ? 'move' : 'pointer',
                      }}
                    >
                      {editMode && (
                        <>
                          <div className="absolute -top-5 left-0 flex items-center gap-1">
                            <span className={`text-[10px] text-white px-1.5 py-0.5 rounded whitespace-nowrap ${
                              targetProject ? 'bg-amber-600' : 'bg-teal-600'
                            }`}>
                              {displayLabel}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteHotspot(hs.id); }}
                              className="w-4 h-4 bg-red-600 text-white rounded flex items-center justify-center text-[10px] leading-none"
                            >
                              ×
                            </button>
                          </div>
                          {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
                            const pos = {
                              tl: { top: -3, left: -3, cursor: 'nwse-resize' },
                              tr: { top: -3, right: -3, cursor: 'nesw-resize' },
                              bl: { bottom: -3, left: -3, cursor: 'nesw-resize' },
                              br: { bottom: -3, right: -3, cursor: 'nwse-resize' },
                            }[corner];
                            return (
                              <div
                                key={corner}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const anchorX = corner.includes('l') ? hs.x + hs.width : hs.x;
                                  const anchorY = corner.includes('t') ? hs.y + hs.height : hs.y;
                                  setResizing({ id: hs.id, corner, anchorX, anchorY });
                                }}
                                className="absolute w-[7px] h-[7px] bg-white border border-teal-500 rounded-[1px] z-10"
                                style={{ ...pos, cursor: pos.cursor }}
                              />
                            );
                          })}
                        </>
                      )}
                      {!editMode && (
                        <div className="absolute inset-0 flex items-end justify-center pb-1 opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                            → {displayLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Drawing rect */}
                {drawRect && (
                  <div
                    className="absolute border-2 border-teal-400 bg-teal-400/20 pointer-events-none"
                    style={{
                      left: `${drawRect.x}%`,
                      top: `${drawRect.y}%`,
                      width: `${drawRect.width}%`,
                      height: `${drawRect.height}%`,
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-slate-900 to-slate-950 px-6">
                <div className={`
                  w-16 h-16 rounded-2xl flex items-center justify-center mb-4
                  ${activeNode.data.nodeStyle === 'success' ? 'bg-emerald-900/50' :
                    activeNode.data.nodeStyle === 'error' ? 'bg-red-900/50' :
                    activeNode.data.nodeStyle === 'warning' ? 'bg-amber-900/50' :
                    'bg-blue-900/50'}
                `}>
                  <svg className={`w-8 h-8 ${
                    activeNode.data.nodeStyle === 'success' ? 'text-emerald-400' :
                    activeNode.data.nodeStyle === 'error' ? 'text-red-400' :
                    activeNode.data.nodeStyle === 'warning' ? 'text-amber-400' :
                    'text-blue-400'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1.5">{activeNode.data.title}</h3>
                <p className="text-sm text-slate-400 text-center">{activeNode.data.description}</p>
                <p className="text-xs text-slate-600 mt-6">双击流程节点可上传UI截图</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-slate-900 to-slate-950 px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 text-center">点击左侧流程图节点</p>
              <p className="text-xs text-slate-600 mt-1">查看对应的 UI 页面</p>
            </div>
          )}
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 bg-slate-600 rounded-full z-10" style={{ bottom: '2cqw', width: '33.333cqw', height: '1.333cqw' }} />
      </div>
      </div>

      {/* Controls below phone — fixed height to prevent layout shift */}
      <div style={{ marginTop: 24 }} className="flex flex-col items-center gap-4 w-[320px] min-h-[140px] shrink-0">
        {activeNode && (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">{activeNode.data.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{activeNode.data.description}</p>
          </div>
        )}

        {/* Metrics cards */}
        {activeNode?.data.metrics && activeNode.data.metrics.length > 0 && (
          <div className="flex flex-wrap gap-3 justify-center w-full">
            {activeNode.data.metrics.map((m) => (
              <div key={m.id} className="px-5 py-3 bg-slate-800/80 border border-slate-700 rounded-lg text-center min-w-[90px]">
                <div className="text-xs text-slate-500">{m.label}</div>
                <div className="text-base font-semibold text-slate-200 mt-1">{m.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Edit mode toggle */}
        {hasScreenshot && !highlightedPath.length && (
          <button
            onClick={() => { setEditMode(!editMode); setDrawing(null); setSelectingTarget(null); setDragging(null); setResizing(null); }}
            className={`mt-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              editMode
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {editMode ? '退出热区编辑' : '编辑热区'}
          </button>
        )}
        {editMode && (
          <p className="text-[10px] text-slate-500">在截图上拖拽画矩形，然后选择跳转目标</p>
        )}
      </div>


      {/* Target node selector modal */}
      {selectingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl flex flex-col" style={{ width: 520, maxHeight: '80vh' }}>
            <div className="flex items-center justify-between border-b border-slate-700 shrink-0" style={{ padding: '20px 48px' }}>
              <h3 className="text-lg font-semibold text-slate-100">选择跳转目标节点</h3>
              <button onClick={() => { setSelectingTarget(null); setSearchText(''); }} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="shrink-0" style={{ padding: '20px 48px 0' }}>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索节点名称..."
                autoFocus
                className="w-full bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                style={{ padding: '14px 20px' }}
              />
            </div>
            <div className="overflow-y-auto flex-1" style={{ padding: '16px 40px 28px' }}>
              {(() => {
                const otherProjects = projects
                  .filter((p) => p.id !== activeProjectId)
                  .filter((p) => {
                    if (!searchText) return true;
                    return p.name.toLowerCase().includes(searchText.toLowerCase());
                  });
                if (otherProjects.length === 0) return null;
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div className="text-xs text-amber-400 font-medium" style={{ padding: '8px 8px 6px' }}>跳转到其他页面</div>
                    {otherProjects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { handleSelectTarget(p.nodes[0]?.id || '', p.id); setSearchText(''); }}
                        className="w-full text-left text-base text-slate-300 hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-3"
                        style={{ padding: '12px 16px' }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-500" />
                        <span className="font-medium">📑 {p.name}</span>
                        <span className="text-sm text-slate-500">切换Tab</span>
                      </button>
                    ))}
                    <div className="h-px bg-slate-700/50 mx-2" style={{ marginTop: 8 }} />
                  </div>
                );
              })()}
              {(() => {
                const filtered = nodes
                  .filter((n) => n.id !== activeNodeId)
                  .filter((n) => {
                    if (!searchText) return true;
                    const s = searchText.toLowerCase();
                    return n.data.title.toLowerCase().includes(s) || n.data.description.toLowerCase().includes(s);
                  });
                const grouped = new Map<string, typeof filtered>();
                for (const n of filtered) {
                  const group = n.data.title;
                  if (!grouped.has(group)) grouped.set(group, []);
                  grouped.get(group)!.push(n);
                }
                return Array.from(grouped.entries()).map(([title, groupNodes]) => (
                  <div key={title}>
                    {grouped.size > 1 && groupNodes.length > 1 && (
                      <div className="text-xs text-slate-500 font-medium" style={{ padding: '12px 8px 6px' }}>{title}</div>
                    )}
                    {groupNodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => { handleSelectTarget(n.id); setSearchText(''); }}
                        className="w-full text-left text-base text-slate-300 hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-3"
                        style={{ padding: '12px 16px' }}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          n.data.nodeStyle === 'success' ? 'bg-emerald-500' :
                          n.data.nodeStyle === 'error' ? 'bg-red-500' :
                          n.data.nodeStyle === 'warning' ? 'bg-amber-500' : 'bg-slate-500'
                        }`} />
                        <span className="font-medium">{n.data.title}</span>
                        <span className="text-sm text-slate-500">{n.data.description}</span>
                      </button>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Playback controls — fixed at bottom */}
      <div className="shrink-0 h-[50px] flex items-center justify-center border-t border-slate-800">
        {highlightedPath.length > 1 ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                } else {
                  const nextIdx = playIndex >= highlightedPath.length - 1 ? 0 : playIndex;
                  setPlayIndex(nextIdx);
                  setSelectedNode(highlightedPath[nextIdx]);
                  setPlaying(true);
                }
              }}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              {playing ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <div className="flex gap-3">
              {highlightedPath.map((nodeId, idx) => (
                <button
                  key={nodeId}
                  onClick={() => { setPlayIndex(idx); setSelectedNode(nodeId); setPlaying(false); }}
                  className="p-2.5 flex items-center justify-center"
                >
                  <span className={`block rounded-full transition-all ${
                    nodeId === selectedNodeId ? 'w-4 h-4 bg-teal-400' : 'w-3 h-3 bg-slate-600 hover:bg-slate-500'
                  }`} />
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500">
              {playIndex + 1}/{highlightedPath.length}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
