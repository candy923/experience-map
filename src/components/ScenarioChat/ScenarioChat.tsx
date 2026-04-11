import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFlowStore } from '../../hooks/useFlowStore';
import type { ScenarioRule } from '../../types';

function ScenarioEditModal({
  rule,
  onSave,
  onClose,
}: {
  rule: ScenarioRule | null;
  onSave: (rule: ScenarioRule) => void;
  onClose: () => void;
}) {
  const nodes = useFlowStore((s) => s.nodes);
  const [description, setDescription] = useState(
    rule ? rule.description.split('，')[0].split('。')[0] : ''
  );
  const [path, setPath] = useState<string[]>(rule?.path || []);

  const handleToggleNode = (nodeId: string) => {
    setPath((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const handleSave = () => {
    if (!description.trim() || path.length === 0) return;
    onSave({
      id: rule?.id || `rule-${uuidv4().slice(0, 8)}`,
      keywords: description.split(/[，,、\s]+/).filter(Boolean),
      path,
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1a2332] border border-slate-700 rounded-2xl w-[500px] shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700 shrink-0">
          <h3 className="text-base font-semibold text-slate-100">{rule ? '编辑场景' : '新增场景'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">场景描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              placeholder="如：新用户首次进入天天领"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              选择路径节点
              <span className="text-xs text-slate-500 ml-2">（按顺序点选）</span>
            </label>
            {path.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mb-3 p-3 bg-slate-800/50 rounded-lg">
                {path.map((nodeId, idx) => {
                  const n = nodes.find((n) => n.id === nodeId);
                  return (
                    <div key={nodeId} className="flex items-center">
                      <span className="text-xs bg-teal-900/50 text-teal-300 px-2 py-1 rounded">
                        {n?.data.title || nodeId}
                      </span>
                      {idx < path.length - 1 && (
                        <svg className="w-3 h-3 text-slate-600 mx-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {nodes.map((n) => {
                const idx = path.indexOf(n.id);
                const inPath = idx >= 0;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleToggleNode(n.id)}
                    className={`text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                      inPath
                        ? 'bg-teal-900/40 border border-teal-600 text-teal-200'
                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {inPath && (
                      <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate">{n.data.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{n.data.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-slate-700 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || path.length === 0}
            className="px-6 py-2.5 text-sm text-white bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScenarioChat() {
  const scenarioRules = useFlowStore((s) => s.scenarioRules);
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const setHighlightedPath = useFlowStore((s) => s.setHighlightedPath);
  const clearHighlight = useFlowStore((s) => s.clearHighlight);
  const addScenarioRule = useFlowStore((s) => s.addScenarioRule);
  const updateScenarioRule = useFlowStore((s) => s.updateScenarioRule);
  const [editingRule, setEditingRule] = useState<ScenarioRule | null | 'new'>(null);

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

  const handleSaveRule = useCallback(
    (rule: ScenarioRule) => {
      const existing = scenarioRules.find((r) => r.id === rule.id);
      if (existing) {
        updateScenarioRule(rule.id, rule);
      } else {
        addScenarioRule(rule);
      }
      setEditingRule(null);
    },
    [scenarioRules, updateScenarioRule, addScenarioRule]
  );

  return (
    <div className="flex flex-col h-full bg-[#0d1321]">
      <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '40px 32px' }}>
        <h3 className="text-xl font-semibold text-slate-200">🗺️ 用户场景</h3>
        <p className="text-sm text-slate-400 mb-2">选择一个用户场景，展示对应的流程。</p>

        {scenarioRules.map((rule) => {
          const isActive = activeRuleId === rule.id;

          return (
            <div key={rule.id} className="relative shrink-0 group">
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
              <button
                onClick={() => setEditingRule(rule)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          );
        })}

        <div className="shrink-0">
          <button
            onClick={() => setEditingRule('new')}
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

      {editingRule && (
        <ScenarioEditModal
          rule={editingRule === 'new' ? null : editingRule}
          onSave={handleSaveRule}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  );
}
