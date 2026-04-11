import { useState, useCallback } from 'react';

interface Props {
  onSend: (message: string) => void;
}

export function ChatInput({ onSend }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex items-center gap-2 p-3 border-t border-slate-700/50 bg-[#111827]">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="描述场景 / 改文案 / 问问题..."
        className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
      >
        发送
      </button>
    </div>
  );
}
