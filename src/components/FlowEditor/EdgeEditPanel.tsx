import { useState, useEffect, useCallback } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { useActiveProject } from '../../hooks/useActiveProject';

interface Props {
  edgeId: string;
  onClose: () => void;
}

export function EdgeEditPanel({ edgeId, onClose }: Props) {
  const { edges, nodes } = useActiveProject();
  const updateEdgeLabel = useFlowStore((s) => s.updateEdgeLabel);
  const deleteEdge = useFlowStore((s) => s.deleteEdge);

  const edge = edges.find((e) => e.id === edgeId);
  const [label, setLabel] = useState('');

  const sourceNode = nodes.find((n) => n.id === edge?.source);
  const targetNode = nodes.find((n) => n.id === edge?.target);

  useEffect(() => {
    if (edge) {
      setLabel((edge.label as string) || '');
    }
  }, [edge]);

  const handleSave = useCallback(() => {
    updateEdgeLabel(edgeId, label);
    onClose();
  }, [edgeId, label, updateEdgeLabel, onClose]);

  const handleDelete = useCallback(() => {
    deleteEdge(edgeId);
    onClose();
  }, [edgeId, deleteEdge, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSave();
      if (e.key === 'Escape') onClose();
    },
    [handleSave, onClose]
  );

  if (!edge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1a2332] border border-slate-700 rounded-xl w-[360px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-base font-semibold text-slate-100">编辑连线</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="px-2 py-1 bg-slate-800 rounded">{sourceNode?.data.title || edge.source}</span>
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className="px-2 py-1 bg-slate-800 rounded">{targetNode?.data.title || edge.target}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">连线标签</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="输入标签文字（如：搜索、选卡）"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
          >
            删除连线
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
