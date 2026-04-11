import { useCallback, useRef, useState } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { exportProjectJSON, importProjectJSON } from '../../services/storage';

export function Toolbar() {
  const { nodes, edges, scenarioRules, addNode, save, loadData } = useFlowStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleAddNode = useCallback(() => {
    const centerX = 300 + Math.random() * 200;
    const centerY = 300 + Math.random() * 200;
    addNode({ x: centerX, y: centerY });
  }, [addNode]);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    const ok = await save();
    setSaveStatus(ok ? 'saved' : 'idle');
    if (ok) setTimeout(() => setSaveStatus('idle'), 2000);
  }, [save]);

  const handleExport = useCallback(() => {
    exportProjectJSON({ nodes, edges, scenarioRules });
  }, [nodes, edges, scenarioRules]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importProjectJSON(file);
      loadData(data.nodes, data.edges, data.scenarioRules || []);
    } catch (err) {
      console.error('Import failed:', err);
    }
    e.target.value = '';
  }, [loadData]);

  return (
    <div className="flex items-center gap-1.5 p-2 bg-[#111827] border-b border-slate-700/50">
      <button
        onClick={handleAddNode}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
        title="添加节点"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加节点
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      <button
        onClick={handleSave}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
          saveStatus === 'saved'
            ? 'text-emerald-300 bg-emerald-900/40'
            : 'text-slate-300 bg-slate-800 hover:bg-slate-700'
        }`}
        title="保存到文件（可分享给他人）"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存 ✓' : '保存'}
      </button>

      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
        title="导出JSON文件"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        导出
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
        title="导入JSON文件"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        导入
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}
