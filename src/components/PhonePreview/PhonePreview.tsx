import { useMemo, useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFlowStore } from '../../hooks/useFlowStore';
import type { Hotspot } from '../../types';

export function PhonePreview() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const nodes = useFlowStore((s) => s.nodes);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const [pathIndex, setPathIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const [selectingTarget, setSelectingTarget] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const activeNodeId = useMemo(() => {
    if (highlightedPath.length > 0) {
      return highlightedPath[Math.min(pathIndex, highlightedPath.length - 1)];
    }
    return selectedNodeId;
  }, [highlightedPath, pathIndex, selectedNodeId]);

  const activeNode = useMemo(() => {
    return nodes.find((n) => n.id === activeNodeId);
  }, [nodes, activeNodeId]);

  const pathNodes = useMemo(() => {
    if (highlightedPath.length === 0) return [];
    return highlightedPath.map((id) => nodes.find((n) => n.id === id)).filter(Boolean);
  }, [highlightedPath, nodes]);

  const safePathIndex = Math.min(pathIndex, Math.max(0, highlightedPath.length - 1));

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
    if (!drawing) return;
    const p = toPercent(e.clientX, e.clientY);
    setDrawing((d) => d ? { ...d, curX: p.x, curY: p.y } : null);
  }, [drawing, toPercent]);

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    const x = Math.min(drawing.startX, drawing.curX);
    const y = Math.min(drawing.startY, drawing.curY);
    const width = Math.abs(drawing.curX - drawing.startX);
    const height = Math.abs(drawing.curY - drawing.startY);
    setDrawing(null);
    if (width < 2 || height < 2) return;
    setSelectingTarget({ x, y, width, height });
  }, [drawing]);

  const handleSelectTarget = useCallback((targetNodeId: string) => {
    if (!selectingTarget || !activeNodeId) return;
    const hotspot: Hotspot = {
      id: uuidv4().slice(0, 8),
      ...selectingTarget,
      targetNodeId,
    };
    const existing = activeNode?.data.hotspots || [];
    updateNodeData(activeNodeId, { hotspots: [...existing, hotspot] });
    setSelectingTarget(null);
  }, [selectingTarget, activeNodeId, activeNode, updateNodeData]);

  const handleHotspotClick = useCallback((targetNodeId: string) => {
    if (editMode) return;
    setSelectedNode(targetNodeId);
  }, [editMode, setSelectedNode]);

  const handleDeleteHotspot = useCallback((hotspotId: string) => {
    if (!activeNodeId || !activeNode) return;
    const hotspots = (activeNode.data.hotspots || []).filter((h) => h.id !== hotspotId);
    updateNodeData(activeNodeId, { hotspots });
  }, [activeNodeId, activeNode, updateNodeData]);

  const hotspots = activeNode?.data.hotspots || [];
  const hasScreenshot = !!activeNode?.data.screenshot;

  const drawRect = drawing ? {
    x: Math.min(drawing.startX, drawing.curX),
    y: Math.min(drawing.startY, drawing.curY),
    width: Math.abs(drawing.curX - drawing.startX),
    height: Math.abs(drawing.curY - drawing.startY),
  } : null;

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-[#0a0f1a]">
      {/* Path navigation */}
      {highlightedPath.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap justify-center max-w-[380px]">
          {pathNodes.map((node, idx) => (
            <div key={node!.id} className="flex items-center">
              <button
                onClick={() => setPathIndex(idx)}
                className={`
                  px-2 py-1 text-xs rounded-md transition-all
                  ${idx === safePathIndex
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}
                `}
              >
                {node!.data.title}
              </button>
              {idx < pathNodes.length - 1 && (
                <svg className="w-3 h-3 text-slate-600 mx-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Phone mockup */}
      <div className="relative bg-black rounded-[40px] border-[3px] border-slate-700 shadow-2xl shadow-black/50 overflow-hidden" style={{ width: 300, height: 300 * (1624 / 750) + 6 }}>
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-10" />

        {/* Screen */}
        <div
          ref={screenRef}
          className="absolute inset-0 overflow-hidden rounded-[37px]"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: editMode && hasScreenshot ? 'crosshair' : 'default' }}
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
                  return (
                    <div
                      key={hs.id}
                      onClick={() => handleHotspotClick(hs.targetNodeId)}
                      className={`absolute transition-all ${
                        editMode
                          ? 'border-2 border-teal-400 bg-teal-400/20'
                          : 'border border-transparent hover:border-teal-400/60 hover:bg-teal-400/10'
                      }`}
                      style={{
                        left: `${hs.x}%`,
                        top: `${hs.y}%`,
                        width: `${hs.width}%`,
                        height: `${hs.height}%`,
                        cursor: editMode ? 'default' : 'pointer',
                      }}
                    >
                      {editMode && (
                        <div className="absolute -top-5 left-0 flex items-center gap-1">
                          <span className="text-[10px] bg-teal-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                            {targetNode?.data.title || hs.targetNodeId}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteHotspot(hs.id); }}
                            className="w-4 h-4 bg-red-600 text-white rounded flex items-center justify-center text-[10px] leading-none"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      {!editMode && targetNode && (
                        <div className="absolute inset-0 flex items-end justify-center pb-1 opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                            → {targetNode.data.title}
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

        <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-slate-600 rounded-full z-10" />
      </div>

      {/* Controls below phone */}
      <div className="mt-4 flex flex-col items-center gap-2">
        {activeNode && (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">{activeNode.data.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{activeNode.data.description}</p>
          </div>
        )}

        {/* Edit mode toggle */}
        {hasScreenshot && (
          <button
            onClick={() => { setEditMode(!editMode); setDrawing(null); setSelectingTarget(null); }}
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

      {/* Path step navigation */}
      {highlightedPath.length > 1 && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => setPathIndex(Math.max(0, safePathIndex - 1))}
            disabled={safePathIndex === 0}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs text-slate-500">
            {safePathIndex + 1} / {highlightedPath.length}
          </span>
          <button
            onClick={() => setPathIndex(Math.min(highlightedPath.length - 1, safePathIndex + 1))}
            disabled={safePathIndex >= highlightedPath.length - 1}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Target node selector modal */}
      {selectingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a2332] border border-slate-700 rounded-xl w-[420px] shadow-2xl max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-slate-100">选择跳转目标节点</h3>
              <button onClick={() => { setSelectingTarget(null); setSearchText(''); }} className="text-slate-400 hover:text-slate-200">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-3 pt-3">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索节点名称..."
                autoFocus
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="overflow-y-auto p-2 mt-1">
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
                      <div className="text-[10px] text-slate-500 px-2 pt-2 pb-1 font-medium">{title}</div>
                    )}
                    {groupNodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => { handleSelectTarget(n.id); setSearchText(''); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          n.data.nodeStyle === 'success' ? 'bg-emerald-500' :
                          n.data.nodeStyle === 'error' ? 'bg-red-500' :
                          n.data.nodeStyle === 'warning' ? 'bg-amber-500' : 'bg-slate-500'
                        }`} />
                        <span className="font-medium">{n.data.title}</span>
                        <span className="text-xs text-slate-500">{n.data.description}</span>
                      </button>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
