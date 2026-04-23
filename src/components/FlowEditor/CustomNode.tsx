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
  const setEditingNode = useFlowStore((s) => s.setEditingNode);
  const setHistoryNode = useFlowStore((s) => s.setHistoryNode);
  const pathRecording = useFlowStore((s) => s.pathRecording);

  const isHighlighted = highlightedPath.includes(id);
  const isDimmed = highlightedPath.length > 0 && !isHighlighted;
  const style = styleConfig[data.nodeStyle] || styleConfig.default;

  const recordingIndex = pathRecording ? pathRecording.path.indexOf(id) : -1;
  const isInRecording = recordingIndex >= 0;
  const isRecording = !!pathRecording;

  const archiveCount = (data.versions?.length || 0) + (data.experiments?.length || 0);

  const handleDoubleClick = useCallback(() => {
    if (isRecording) return;
    setEditingNode(id);
  }, [id, setEditingNode, isRecording]);

  const handleHistoryClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isRecording) return;
      setHistoryNode(id);
    },
    [id, setHistoryNode, isRecording]
  );

  const rightPadding = archiveCount > 0 ? 76 : 40;

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{ paddingLeft: 16, paddingRight: rightPadding, paddingTop: 12, paddingBottom: 12, opacity: isDimmed ? 0.25 : 1 }}
      className={`
        relative rounded-lg border min-w-[140px]
        transition-all duration-200
        ${isDimmed ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
        ${style.border} ${style.bg}
        ${!isRecording && selected ? 'ring-[3px] ring-blue-400 shadow-[0_0_24px_rgba(59,130,246,0.6),0_0_48px_rgba(59,130,246,0.25),0_0_80px_rgba(59,130,246,0.1)] border-blue-400 scale-[1.03]' : ''}
        ${isHighlighted ? 'ring-2 ring-teal-400 shadow-lg shadow-teal-500/30 scale-105' : ''}
        ${isInRecording ? 'ring-2 ring-teal-400 border-teal-500 shadow-lg shadow-teal-500/30' : ''}
      `}
    >
      {isInRecording && (
        <div
          className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center z-10 shadow-md"
        >
          {recordingIndex + 1}
        </div>
      )}
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
        {archiveCount > 0 && (
          <button
            onClick={handleHistoryClick}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            title="查看历史版本 / 实验记录"
            className="nodrag flex items-center gap-1 text-[10px] leading-none px-1.5 py-1 rounded bg-slate-700/70 hover:bg-slate-600 text-slate-200 border border-slate-600/60 transition-colors"
          >
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            历史 {archiveCount}
          </button>
        )}
        {data.screenshot && (
          <div className="w-3.5 h-3.5 rounded-sm bg-slate-700/60 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${style.indicator}`} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100">{data.title}</div>
          <div className="text-xs text-slate-400 mt-0.5">{data.description}</div>
        </div>
      </div>
      {data.metrics && data.metrics.length > 0 && (
        <div className="flex items-center gap-2.5 mt-2 ml-3.5">
          {data.metrics.slice(0, 2).map((m) => (
            <span key={m.id} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-800/40">
              <span className="text-blue-400/70">{m.label}</span>{' '}
              <span className="text-blue-300">{m.value}</span>
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-slate-500" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-slate-500" />
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
