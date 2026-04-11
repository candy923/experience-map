import { useCallback, useRef, useState } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { useActiveProject } from '../../hooks/useActiveProject';

export function ScenarioChat() {
  const { scenarioRules } = useActiveProject();
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const setHighlightedPath = useFlowStore((s) => s.setHighlightedPath);
  const clearHighlight = useFlowStore((s) => s.clearHighlight);
  const startPathRecording = useFlowStore((s) => s.startPathRecording);
  const reorderScenarioRules = useFlowStore((s) => s.reorderScenarioRules);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragStartY = useRef(0);

  const activeRuleId = scenarioRules.find(
    (r) => r.path.length === highlightedPath.length && r.path.every((id, i) => id === highlightedPath[i])
  )?.id;

  const handleSelect = useCallback(
    (ruleId: string) => {
      const rule = scenarioRules.find((r) => r.id === ruleId);
      if (!rule) return;
      if (activeRuleId === ruleId) {
        clearHighlight();
      } else {
        setHighlightedPath(rule.path);
      }
    },
    [scenarioRules, activeRuleId, setHighlightedPath, clearHighlight]
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragStartY.current = e.clientY;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && index !== dragIndex) {
      setDropIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      reorderScenarioRules(dragIndex, index);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1321]">
      <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '40px 32px' }}>
        <h3 className="text-xl font-semibold text-slate-200">🗺️ 用户场景</h3>
        <p className="text-sm text-slate-400 mb-2">选择一个用户场景，展示对应的流程。</p>

        {scenarioRules.map((rule, index) => {
          const isActive = activeRuleId === rule.id;
          const isDragging = dragIndex === index;
          const isDropTarget = dropIndex === index;

          return (
            <div
              key={rule.id}
              className={`relative shrink-0 group transition-all duration-150 ${isDragging ? 'opacity-40 scale-95' : ''} ${isDropTarget ? 'translate-y-1' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {isDropTarget && dragIndex !== null && dragIndex > index && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-teal-500 rounded-full" />
              )}
              <div className="flex items-center">
                <div
                  className="absolute -left-6 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="拖拽排序"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                  </svg>
                </div>
                <button
                  onClick={() => handleSelect(rule.id)}
                  style={{ height: 50, paddingLeft: 48, paddingRight: 48 }}
                  className={`
                    text-center rounded-full border transition-all text-sm flex items-center justify-center whitespace-nowrap
                    ${isActive
                      ? 'bg-teal-900/30 border-teal-600 text-teal-200'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'}
                  `}
                >
                  {rule.description.split('，')[0].split('。')[0]}
                </button>
              </div>
              <button
                onClick={() => startPathRecording(rule)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                title="编辑场景"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              {isDropTarget && dragIndex !== null && dragIndex < index && (
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-teal-500 rounded-full" />
              )}
            </div>
          );
        })}

        <div className="shrink-0">
          <button
            onClick={() => startPathRecording()}
            style={{ height: 50, paddingLeft: 48, paddingRight: 48 }}
            className="text-center rounded-full border border-dashed border-slate-700 text-slate-500 hover:border-teal-600 hover:text-teal-400 transition-all text-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加场景
          </button>
        </div>

        <button
          onClick={clearHighlight}
          className={`text-xs transition-colors shrink-0 mt-2 ${activeRuleId ? 'text-slate-500 hover:text-slate-300 cursor-pointer' : 'text-transparent pointer-events-none'}`}
        >
          取消选中
        </button>
      </div>
    </div>
  );
}
