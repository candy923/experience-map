import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';

// 可选的 LLM 模型列表（后续新增其他模型在这里加一行即可）。
const MODEL_OPTIONS: Array<{ id: string; label: string; hint?: string }> = [
  { id: 'qwen3.5-35b-a3b', label: 'Qwen3.5-35B', hint: '快' },
  { id: 'glm-5', label: 'GLM-5', hint: '强' },
];

export function ScenarioChat() {
  const { scenarioRules } = useActiveProject();
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const setHighlightedPath = useFlowStore((s) => s.setHighlightedPath);
  const clearHighlight = useFlowStore((s) => s.clearHighlight);
  const startPathRecording = useFlowStore((s) => s.startPathRecording);
  const reorderScenarioRules = useFlowStore((s) => s.reorderScenarioRules);
  const chatMessages = useFlowStore((s) => s.chatMessages);
  const sendChatMessage = useFlowStore((s) => s.sendChatMessage);
  const clearChat = useFlowStore((s) => s.clearChat);
  const selectedModel = useFlowStore((s) => s.selectedModel);
  const setSelectedModel = useFlowStore((s) => s.setSelectedModel);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragStartY = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activeRuleId = scenarioRules.find(
    (r) => r.path.length === highlightedPath.length && r.path.every((id, i) => id === highlightedPath[i])
  )?.id;

  // 新消息进来自动滚到底
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages.length, chatMessages[chatMessages.length - 1]?.content]);

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

  const handleSend = useCallback(
    (text: string) => {
      void sendChatMessage(text);
    },
    [sendChatMessage]
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
      {/* ── 上半：用户场景（紧凑但不挤，高度自适应，最多占 50%） ─────────────────────── */}
      <div
        className="shrink-0 overflow-y-auto border-b border-slate-800"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '16px 24px 14px',
          maxHeight: '50%',
        }}
      >
        <h3 className="text-sm font-semibold text-slate-200 shrink-0">🗺️ 用户场景</h3>

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
                  style={{ height: 44, paddingLeft: 48, paddingRight: 48 }}
                  className={`
                    text-center rounded-full border transition-all text-xs flex items-center justify-center whitespace-nowrap
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
            style={{ height: 44, paddingLeft: 48, paddingRight: 48 }}
            className="text-center rounded-full border border-dashed border-slate-700 text-slate-500 hover:border-teal-600 hover:text-teal-400 transition-all text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加场景
          </button>
        </div>

        <button
          onClick={clearHighlight}
          className={`text-[11px] transition-colors shrink-0 mt-0.5 ${highlightedPath.length > 0 ? 'text-slate-500 hover:text-slate-300 cursor-pointer' : 'text-transparent pointer-events-none'}`}
        >
          取消选中
        </button>
      </div>

      {/* ── 下半：AI 路径助手（占满剩余空间） ─────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="shrink-0 px-4 pt-2.5 pb-2 flex items-center justify-between border-b border-slate-800/60 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs font-semibold text-slate-300 whitespace-nowrap">💬 AI 路径助手</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/40 text-teal-300 border border-teal-700/40 shrink-0">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-[11px] bg-slate-800 border border-slate-700 hover:border-slate-600 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-teal-600 cursor-pointer transition-colors"
              title="切换 LLM 模型"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}{opt.hint ? ` (${opt.hint})` : ''}
                </option>
              ))}
              {/* 兼容当前选中的 model 不在预设列表（比如手动用 env 指定了别的） */}
              {!MODEL_OPTIONS.some((m) => m.id === selectedModel) && (
                <option value={selectedModel}>{selectedModel}</option>
              )}
            </select>
            {chatMessages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                title="清空对话"
              >
                清空
              </button>
            )}
          </div>
        </div>

        <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-3 gap-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                可以问路径，也可以问指标数据
              </p>
              <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
                <p className="text-[10px] text-slate-600">试试这样问</p>
                {[
                  { text: '购物搜索体验', tag: '路径' },
                  { text: '提现券领取率是多少', tag: '指标' },
                  { text: '哪个节点 UV 最高', tag: '指标' },
                ].map((example) => (
                  <button
                    key={example.text}
                    onClick={() => handleSend(example.text)}
                    className="flex items-center justify-between gap-2 text-left text-[11px] px-3 py-1.5 rounded-md bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <span className="truncate">{example.text}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-500 shrink-0">
                      {example.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatMessages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}
        </div>

        <ChatInput onSend={handleSend} />
      </div>
    </div>
  );
}
