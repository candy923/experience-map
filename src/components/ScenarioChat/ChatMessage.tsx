import { memo, useState } from 'react';
import type { ChatMessage as ChatMessageType } from '../../types';
import { useFlowStore } from '../../hooks/useFlowStore';

interface Props {
  message: ChatMessageType;
}

function ChatMessageComponent({ message }: Props) {
  const setHighlightedPath = useFlowStore((s) => s.setHighlightedPath);
  const clearHighlight = useFlowStore((s) => s.clearHighlight);
  const switchProject = useFlowStore((s) => s.switchProject);
  const activeProjectId = useFlowStore((s) => s.activeProjectId);
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const isUser = message.role === 'user';

  // 当前消息的 path 是否正在被高亮（只比较 path 本身；targetProjectId 只参与视觉降级）。
  const isHighlightActive =
    !!message.matchedPath &&
    message.matchedPath.length > 0 &&
    message.matchedPath.length === highlightedPath.length &&
    message.matchedPath.every((id, i) => id === highlightedPath[i]);

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed bg-teal-600 text-white">
          {message.content}
        </div>
      </div>
    );
  }

  // 是否为跨项目命中（targetProjectId 存在且与当前 tab 不一致）。
  // 若用户已切到目标 tab，视觉上就降级为普通气泡，避免反复提醒。
  const isCrossProject = !!message.targetProjectId && message.targetProjectId !== activeProjectId;

  // System / assistant 气泡
  const bubbleColor = message.isError
    ? 'bg-red-900/40 text-red-200 border border-red-700/40'
    : message.isFallback
    ? 'bg-amber-900/30 text-amber-100 border border-amber-700/40'
    : isCrossProject
    ? 'bg-slate-800 text-slate-200 border border-sky-600/50'
    : 'bg-slate-800 text-slate-200';

  const handleSwitchAndHighlight = () => {
    if (message.targetProjectId && message.targetProjectId !== activeProjectId) {
      switchProject(message.targetProjectId);
    }
    if (message.matchedPath && message.matchedPath.length > 0) {
      setHighlightedPath(message.matchedPath);
    }
  };

  // 同项目路径按钮：点一次高亮，再点一次取消。
  const handleToggleHighlight = () => {
    if (!message.matchedPath || message.matchedPath.length === 0) return;
    if (isHighlightActive) {
      clearHighlight();
    } else {
      setHighlightedPath(message.matchedPath);
    }
  };

  return (
    <div className="flex justify-start mb-3">
      <div className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed ${bubbleColor}`}>
        {message.isPending ? (
          <div className="flex items-center gap-2 text-slate-400">
            <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
            <span className="ml-1 text-xs">{message.content}</span>
          </div>
        ) : (
          <>
            {isCrossProject && message.targetProjectName && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-medium">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {message.targetProjectName}
                </span>
                <span className="text-xs text-slate-500">（不在当前项目）</span>
              </div>
            )}

            {message.content.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-slate-300 mt-2 mb-1">{line.replace(/\*\*/g, '')}</p>;
              }
              if (line.startsWith('• ')) {
                return <p key={i} className="text-slate-400 text-xs ml-1">{line}</p>;
              }
              if (!line.trim()) return <div key={i} className="h-1" />;
              return <p key={i}>{line}</p>;
            })}

            {message.reasoning && (
              <div className="mt-2 border-t border-white/10 pt-2">
                <button
                  onClick={() => setReasoningOpen((v) => !v)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${reasoningOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  AI 思考过程
                </button>
                {reasoningOpen && (
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {message.reasoning}
                  </p>
                )}
              </div>
            )}

            {message.usedModel && !message.isError && (
              <div className="mt-1.5 text-[10px] text-slate-500">
                via {message.usedModel}
              </div>
            )}

            {/* 多候选路径：渲染候选卡片列表，每个独立切换高亮 */}
            {!message.isAnswer &&
              message.pathCandidates &&
              message.pathCandidates.length > 1 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {message.pathCandidates.map((candidate, idx) => {
                    const isCandidateActive =
                      !isCrossProject &&
                      candidate.path.length === highlightedPath.length &&
                      candidate.path.every((id, i) => id === highlightedPath[i]);

                    const handleCandidateClick = () => {
                      if (isCrossProject && message.targetProjectId) {
                        switchProject(message.targetProjectId);
                        setHighlightedPath(candidate.path);
                        return;
                      }
                      if (isCandidateActive) {
                        clearHighlight();
                      } else {
                        setHighlightedPath(candidate.path);
                      }
                    };

                    return (
                      <button
                        key={idx}
                        onClick={handleCandidateClick}
                        className={`text-left px-2.5 py-2 rounded-md border transition-colors ${
                          isCandidateActive
                            ? 'bg-teal-900/30 border-teal-600/60'
                            : 'bg-slate-900/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 text-[10px] mt-0.5 text-slate-500 font-mono">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`text-xs font-medium ${
                                  isCandidateActive ? 'text-teal-200' : 'text-slate-200'
                                }`}
                              >
                                {candidate.title}
                              </p>
                              <span
                                className={`shrink-0 text-[10px] ${
                                  isCrossProject
                                    ? 'text-sky-400'
                                    : isCandidateActive
                                    ? 'text-slate-400'
                                    : 'text-teal-400'
                                }`}
                              >
                                {isCrossProject ? '→ 切换' : isCandidateActive ? '取消查看' : '查看路径'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug break-words">
                              {candidate.pathPreview}
                            </p>
                            {candidate.reasoning && (
                              <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                                {candidate.reasoning}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

            {/* 单路径 / 兜底匹配：沿用原来的单按钮 */}
            {!message.isAnswer &&
              message.matchedPath &&
              message.matchedPath.length > 0 &&
              (!message.pathCandidates || message.pathCandidates.length <= 1) &&
              (isCrossProject ? (
                <button
                  onClick={handleSwitchAndHighlight}
                  className="mt-2 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 hover:text-sky-200 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  切换到【{message.targetProjectName}】并查看
                </button>
              ) : (
                <button
                  onClick={handleToggleHighlight}
                  className={`mt-2 flex items-center gap-1 text-xs transition-colors ${
                    isHighlightActive
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-teal-400 hover:text-teal-300'
                  }`}
                >
                  {isHighlightActive ? (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      取消查看
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      查看路径
                    </>
                  )}
                </button>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
