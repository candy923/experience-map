import { useMemo, useState } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';

export function PhonePreview() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const nodes = useFlowStore((s) => s.nodes);

  const [pathIndex, setPathIndex] = useState(0);

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

      {/* Phone mockup — inner screen matches 750×1624 */}
      <div className="relative bg-black rounded-[40px] border-[3px] border-slate-700 shadow-2xl shadow-black/50 overflow-hidden" style={{ width: 300, height: 300 * (1624 / 750) + 6 }}>
        {/* Dynamic Island */}
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-10" />

        {/* Screen content */}
        <div className="absolute inset-0 overflow-hidden rounded-[37px]">
          {activeNode ? (
            activeNode.data.screenshot ? (
              <img
                src={activeNode.data.screenshot}
                alt={activeNode.data.title}
                className="w-full h-full object-cover"
              />
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

        {/* Home indicator */}
        <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-slate-600 rounded-full z-10" />
      </div>

      {/* Node title below phone */}
      {activeNode && (
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-slate-300">{activeNode.data.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{activeNode.data.description}</p>
        </div>
      )}

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
    </div>
  );
}
