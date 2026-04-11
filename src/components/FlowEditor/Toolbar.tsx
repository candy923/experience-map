import { useCallback, useRef, useState } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { exportProjectJSON, importProjectJSON } from '../../services/storage';

export function Toolbar() {
  const projects = useFlowStore((s) => s.projects);
  const activeProjectId = useFlowStore((s) => s.activeProjectId);
  const switchProject = useFlowStore((s) => s.switchProject);
  const addProject = useFlowStore((s) => s.addProject);
  const renameProject = useFlowStore((s) => s.renameProject);
  const deleteProject = useFlowStore((s) => s.deleteProject);
  const save = useFlowStore((s) => s.save);
  const loadData = useFlowStore((s) => s.loadData);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    const ok = await save();
    setSaveStatus(ok ? 'saved' : 'idle');
    if (ok) setTimeout(() => setSaveStatus('idle'), 2000);
  }, [save]);

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

  return (
    <div className="bg-[#111827] border-b border-slate-700/50">
      {/* Row 1: Actions */}
      <div className="flex items-center gap-3 px-6 pt-4 pb-3">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg transition-colors ${
            saveStatus === 'saved'
              ? 'text-emerald-300 bg-emerald-900/40'
              : 'text-slate-300 bg-slate-800 hover:bg-slate-700'
          }`}
          title="保存到文件"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存 ✓' : '保存'}
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          title="导出JSON文件"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          导出
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          title="导入JSON文件"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          导入
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
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

      {/* Edit project modal */}
      {editingProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a2332] border border-slate-700 rounded-2xl w-[400px] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <h3 className="text-base font-semibold text-slate-100">编辑页面</h3>
              <button onClick={() => setEditingProjectId(null)} className="p-1 text-slate-400 hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-6">
              <label className="block text-sm font-medium text-slate-400 mb-2">页面名称</label>
              <input
                type="text"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProjectEdit(); }}
                autoFocus
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex items-center justify-between px-6 py-5 border-t border-slate-700">
              {projects.length > 1 ? (
                <button
                  onClick={handleDeleteProject}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  删除页面
                </button>
              ) : <div />}
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingProjectId(null)}
                  className="px-5 py-2 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveProjectEdit}
                  className="px-5 py-2 text-sm text-white bg-teal-600 hover:bg-teal-500 rounded-lg"
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
