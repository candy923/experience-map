import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FlowNode } from '../../types';
import { useFlowStore } from '../../hooks/useFlowStore';

const styleConfig = {
  default: {
    border: 'border-slate-600',
    bg: 'bg-[#1a2332]',
    indicator: 'bg-slate-500',
  },
  success: {
    border: 'border-emerald-600',
    bg: 'bg-emerald-950/60',
    indicator: 'bg-emerald-500',
  },
  error: {
    border: 'border-red-600',
    bg: 'bg-red-950/60',
    indicator: 'bg-red-500',
  },
  warning: {
    border: 'border-amber-600',
    bg: 'bg-amber-950/60',
    indicator: 'bg-amber-500',
  },
};

function CustomNodeComponent({ data, id, selected }: NodeProps<FlowNode>) {
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const setEditingNode = useFlowStore((s) => s.setEditingNode);

  const isHighlighted = highlightedPath.includes(id);
  const style = styleConfig[data.nodeStyle] || styleConfig.default;

  const handleClick = useCallback(() => {
    setSelectedNode(id);
  }, [id, setSelectedNode]);

  const handleDoubleClick = useCallback(() => {
    setEditingNode(id);
  }, [id, setEditingNode]);

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ paddingLeft: 16, paddingRight: 40, paddingTop: 12, paddingBottom: 12 }}
      className={`
        rounded-lg border min-w-[140px]
        cursor-pointer transition-all duration-200
        ${style.border} ${style.bg}
        ${selected ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-500/20' : ''}
        ${isHighlighted ? 'ring-2 ring-teal-400 shadow-lg shadow-teal-500/30 scale-105' : ''}
        hover:shadow-md
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${style.indicator}`} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100">{data.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">{data.description}</div>
        </div>
      </div>
      {data.screenshot && (
        <div className="mt-2 w-4 h-4 rounded bg-slate-700 flex items-center justify-center">
          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-slate-500" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-slate-500" />
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
