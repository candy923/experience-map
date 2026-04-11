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
      <div className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl" style={{ width: 480 }}>
        <div className="flex items-center justify-between border-b border-slate-700" style={{ padding: '20px 48px' }}>
          <h3 className="text-lg font-semibold text-slate-100">编辑连线</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '28px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="bg-slate-800 rounded-lg" style={{ padding: '8px 14px' }}>{sourceNode?.data.title || edge.source}</span>
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className="bg-slate-800 rounded-lg" style={{ padding: '8px 14px' }}>{targetNode?.data.title || edge.target}</span>
          </div>

          <div>
            <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 10 }}>连线标签</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              style={{ padding: '14px 20px' }}
              placeholder="输入标签文字（如：搜索、选卡）"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700" style={{ padding: '20px 48px' }}>
          <button
            onClick={handleDelete}
            className="text-base text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-xl transition-colors"
            style={{ padding: '14px 28px' }}
          >
            删除连线
          </button>
          <div className="flex" style={{ gap: 16 }}>
            <button
              onClick={onClose}
              className="text-base text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              style={{ padding: '14px 36px' }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="text-base text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
              style={{ padding: '14px 36px' }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
