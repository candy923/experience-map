import { memo } from 'react';
import type { ChatMessage as ChatMessageType } from '../../types';
import { useFlowStore } from '../../hooks/useFlowStore';

interface Props {
  message: ChatMessageType;
}

function ChatMessageComponent({ message }: Props) {
  const setHighlightedPath = useFlowStore((s) => s.setHighlightedPath);

  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`
          max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-teal-600 text-white rounded-br-md'
            : 'bg-slate-800 text-slate-200 rounded-bl-md'}
        `}
      >
        {message.role === 'system' ? (
          <div>
            {message.content.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-slate-300 mt-2 mb-1">{line.replace(/\*\*/g, '')}</p>;
              }
              if (line.startsWith('• ')) {
                return <p key={i} className="text-slate-400 text-xs ml-1">{line}</p>;
              }
              return <p key={i}>{line}</p>;
            })}
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
          </div>
        ) : (
          <p>{message.content}</p>
        )}
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
