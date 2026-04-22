import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { exportProjectJSON, importProjectJSON } from '../../services/storage';
import { FigmaImportModal } from './FigmaImportModal';

export function Toolbar() {
  const projects = useFlowStore((s) => s.projects);
  const activeProjectId = useFlowStore((s) => s.activeProjectId);
  const switchProject = useFlowStore((s) => s.switchProject);
  const addProject = useFlowStore((s) => s.addProject);
  const renameProject = useFlowStore((s) => s.renameProject);
  const deleteProject = useFlowStore((s) => s.deleteProject);
  const loadData = useFlowStore((s) => s.loadData);
  const undo = useFlowStore((s) => s.undo);
  const redo = useFlowStore((s) => s.redo);
  const canUndo = useFlowStore((s) => s.past.length > 0);
  const canRedo = useFlowStore((s) => s.future.length > 0);
  const previewEdgeSync = useFlowStore((s) => s.previewEdgeSync);
  const syncEdgesFromHotspots = useFlowStore((s) => s.syncEdgesFromHotspots);
  const clearProjectEdges = useFlowStore((s) => s.clearProjectEdges);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<{ toAdd: number; toRemove: number } | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    setSaveStatus('saved');
    const timer = setTimeout(() => setSaveStatus('idle'), 1500);
    return () => clearTimeout(timer);
  }, [projects]);

  const handleExport = useCallback(() => {
    exportProjectJSON({ projects, activeProjectId });
  }, [projects, activeProjectId]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importProjectJSON(file);
      loadData(data);
    } catch (err) {
      console.error('Import failed:', err);
    }
    e.target.value = '';
  }, [loadData]);

  const handleFinishAdd = useCallback(() => {
    if (newName.trim()) {
      addProject(newName.trim());
    }
    setAddingNew(false);
    setNewName('');
  }, [newName, addProject]);

  const handleOpenEditProject = useCallback((id: string) => {
    const p = projects.find((p) => p.id === id);
    if (!p) return;
    setEditingProjectId(id);
    setEditProjectName(p.name);
  }, [projects]);

  const handleSaveProjectEdit = useCallback(() => {
    if (editingProjectId && editProjectName.trim()) {
      renameProject(editingProjectId, editProjectName.trim());
    }
    setEditingProjectId(null);
  }, [editingProjectId, editProjectName, renameProject]);

  const handleDeleteProject = useCallback(() => {
    if (!editingProjectId || projects.length <= 1) return;
    deleteProject(editingProjectId);
    setEditingProjectId(null);
  }, [editingProjectId, projects.length, deleteProject]);

  const handleOpenSyncPreview = useCallback(() => {
    setSyncPreview(previewEdgeSync(activeProjectId));
  }, [previewEdgeSync, activeProjectId]);

  const handleConfirmSync = useCallback(() => {
    syncEdgesFromHotspots(activeProjectId);
    setSyncPreview(null);
  }, [syncEdgesFromHotspots, activeProjectId]);

  const handleConfirmClear = useCallback(() => {
    clearProjectEdges(activeProjectId);
    setClearConfirm(false);
  }, [clearProjectEdges, activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const currentEdgeCount = activeProject?.edges.length ?? 0;

  return (
    <div className="bg-[#111827] border-b border-slate-700/50">
      {/* Row 1: Actions */}
      <div className="flex items-center gap-3 px-6 pt-4 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-lg transition-colors ${
            canUndo
              ? 'text-slate-300 bg-slate-800 hover:bg-slate-700'
              : 'text-slate-600 bg-slate-800/50 cursor-not-allowed'
          }`}
          title="撤销 (⌘Z)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
          </svg>
          撤销
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-lg transition-colors ${
            canRedo
              ? 'text-slate-300 bg-slate-800 hover:bg-slate-700'
              : 'text-slate-600 bg-slate-800/50 cursor-not-allowed'
          }`}
          title="重做 (⌘⇧Z)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" />
          </svg>
          重做
        </button>
        <div className="shrink-0 w-px h-6 bg-slate-700/50" />
        <button
          onClick={handleExport}
          className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          title="导出JSON文件"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          title="导入JSON文件"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          导入
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <button
          onClick={() => setFigmaOpen(true)}
          className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 bg-teal-700/40 hover:bg-teal-600/60 border border-teal-600/40 rounded-lg transition-colors"
          title="从 Figma 批量导入节点"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 38 57" fill="none">
            <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1ABCFE" />
            <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0ACF83" />
            <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#FF7262" />
            <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#F24E1E" />
            <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#A259FF" />
          </svg>
          从 Figma 导入
        </button>
        <div className="shrink-0 w-px h-6 bg-slate-700/50" />
        <button
          onClick={handleOpenSyncPreview}
          className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 bg-indigo-700/40 hover:bg-indigo-600/60 border border-indigo-600/40 rounded-lg transition-colors"
          title="根据当前页面所有节点上的热区（Hotspot）自动生成连线"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          从热区生成连线
        </button>
        <button
          onClick={() => setClearConfirm(true)}
          disabled={currentEdgeCount === 0}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors ${
            currentEdgeCount === 0
              ? 'text-slate-600 bg-slate-800/50 cursor-not-allowed'
              : 'text-red-300 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40'
          }`}
          title="清空当前页面所有连线（节点和热区不会被删除）"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V4a2 2 0 012-2h4a2 2 0 012 2v3" />
          </svg>
          清空连线
        </button>
        <span
          aria-hidden={saveStatus !== 'saved'}
          title="已自动保存"
          className={`shrink-0 whitespace-nowrap ml-auto flex items-center gap-1 px-2 py-2.5 text-xs text-emerald-400 transition-opacity duration-300 pointer-events-none ${
            saveStatus === 'saved' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          已保存
        </span>
      </div>

      {/* Row 2: Project tabs */}
      <div className="flex items-center gap-3" style={{ padding: 24 }}>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => switchProject(p.id)}
            onDoubleClick={() => handleOpenEditProject(p.id)}
            style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12 }}
            className={`text-sm rounded-lg transition-colors ${
              p.id === activeProjectId
                ? 'bg-teal-600 text-white font-semibold shadow-lg shadow-teal-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
            }`}
          >
            {p.name}
          </button>
        ))}
        {addingNew ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleFinishAdd}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFinishAdd(); if (e.key === 'Escape') { setAddingNew(false); setNewName(''); } }}
            autoFocus
            placeholder="页面名称"
            className="px-5 py-3 text-sm bg-slate-700 border border-teal-500 rounded-lg text-slate-100 focus:outline-none w-[100px] placeholder:text-slate-500"
          />
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="px-4 py-3 text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="新建页面"
          >
            +
          </button>
        )}
      </div>

      <FigmaImportModal open={figmaOpen} onClose={() => setFigmaOpen(false)} />

      {/* Sync confirmation modal */}
      {syncPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl" style={{ width: 480 }}>
            <div className="flex items-center justify-between border-b border-slate-700" style={{ padding: '20px 36px' }}>
              <h3 className="text-lg font-semibold text-slate-100">从热区生成连线</h3>
              <button onClick={() => setSyncPreview(null)} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '24px 36px' }}>
              <p className="text-sm text-slate-300 leading-relaxed">
                扫描当前页面 <span className="text-white font-medium">{activeProject?.name}</span> 所有节点上的热区：
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl p-4">
                  <div className="text-xs text-emerald-400 font-medium">将新增派生连线</div>
                  <div className="text-2xl font-bold text-emerald-300 mt-1">+{syncPreview.toAdd}</div>
                </div>
                <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl p-4">
                  <div className="text-xs text-amber-400 font-medium">将移除旧派生连线</div>
                  <div className="text-2xl font-bold text-amber-300 mt-1">−{syncPreview.toRemove}</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                手动画的连线不会被动到（只有之前通过此操作派生的连线会被替换）。
              </p>
            </div>
            <div className="flex items-center justify-end border-t border-slate-700" style={{ padding: '16px 36px', gap: 12 }}>
              <button
                onClick={() => setSyncPreview(null)}
                className="text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                style={{ padding: '10px 24px' }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmSync}
                disabled={syncPreview.toAdd === 0 && syncPreview.toRemove === 0}
                className="text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl transition-colors"
                style={{ padding: '10px 24px' }}
              >
                执行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear edges confirmation */}
      {clearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl" style={{ width: 440 }}>
            <div className="flex items-center justify-between border-b border-slate-700" style={{ padding: '20px 36px' }}>
              <h3 className="text-lg font-semibold text-slate-100">清空连线</h3>
              <button onClick={() => setClearConfirm(false)} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '24px 36px' }}>
              <p className="text-sm text-slate-300 leading-relaxed">
                将删除页面 <span className="text-white font-medium">{activeProject?.name}</span> 里的 <span className="text-red-300 font-semibold">{currentEdgeCount}</span> 条连线。
              </p>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                节点和热区保持不变。可按 ⌘Z 撤销。
              </p>
            </div>
            <div className="flex items-center justify-end border-t border-slate-700" style={{ padding: '16px 36px', gap: 12 }}>
              <button
                onClick={() => setClearConfirm(false)}
                className="text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                style={{ padding: '10px 24px' }}
              >
                取消
              </button>
              <button
                onClick={handleConfirmClear}
                className="text-sm text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors"
                style={{ padding: '10px 24px' }}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit project modal */}
      {editingProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl" style={{ width: 480 }}>
            <div className="flex items-center justify-between border-b border-slate-700" style={{ padding: '20px 48px' }}>
              <h3 className="text-lg font-semibold text-slate-100">编辑页面</h3>
              <button onClick={() => setEditingProjectId(null)} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '28px 48px' }}>
              <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 10 }}>页面名称</label>
              <input
                type="text"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProjectEdit(); }}
                autoFocus
                className="w-full bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-teal-500 transition-colors"
                style={{ padding: '14px 20px' }}
              />
            </div>
            <div className="flex items-center justify-between border-t border-slate-700" style={{ padding: '20px 48px' }}>
              {projects.length > 1 ? (
                <button
                  onClick={handleDeleteProject}
                  className="text-base text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-xl transition-colors"
                  style={{ padding: '14px 28px' }}
                >
                  删除页面
                </button>
              ) : <div />}
              <div className="flex" style={{ gap: 16 }}>
                <button
                  onClick={() => setEditingProjectId(null)}
                  className="text-base text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                  style={{ padding: '14px 36px' }}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveProjectEdit}
                  className="text-base text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors"
                  style={{ padding: '14px 36px' }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
