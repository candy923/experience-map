import { useRef, useEffect, useCallback } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ScenarioChat() {
  const chatMessages = useFlowStore((s) => s.chatMessages);
  const sendChatMessage = useFlowStore((s) => s.sendChatMessage);
  const clearChat = useFlowStore((s) => s.clearChat);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = useCallback(
    (content: string) => {
      sendChatMessage(content);
    },
    [sendChatMessage]
  );

  return (
    <div className="flex flex-col h-full bg-[#0d1321]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-[#111827]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-teal-500" />
          <h3 className="text-sm font-semibold text-slate-200">场景模拟</h3>
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            清空
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-3">
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-sm text-slate-300 mb-2">描述一个用户场景，我来展示对应的画面。</p>
            <p className="text-xs text-slate-500 mb-4">比如</p>
            <div className="space-y-2 w-full max-w-[240px]">
              {[
                '新用户第一次绑卡',
                '用户选了工商银行，被风控了',
                '绑卡成功后看到什么',
                '短信验证码收不到',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => handleSend(example)}
                  className="w-full text-left px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  「{example}」
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} />
    </div>
  );
}
