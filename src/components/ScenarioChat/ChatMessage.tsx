import { memo, useState } from 'react';
import type { ChatMessage as ChatMessageType } from '../../types';
import { useFlowStore } from '../../hooks/useFlowStore';

interface Props {
  message: ChatMessageType;
}

function ChatMessageComponent({ message }: Props) {
  const setHighlightedPath = useFlowStore((s) => s.setHighlightedPath);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed bg-teal-600 text-white">
          {message.content}
        </div>
      </div>
    );
  }

  // System / assistant 气泡
  const bubbleColor = message.isError
    ? 'bg-red-900/40 text-red-200 border border-red-700/40'
    : message.isFallback
    ? 'bg-amber-900/30 text-amber-100 border border-amber-700/40'
    : 'bg-slate-800 text-slate-200';

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

            {message.matchedPath && message.matchedPath.length > 0 && (
              <button
                onClick={() => setHighlightedPath(message.matchedPath!)}
                className="mt-2 flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                查看路径
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
