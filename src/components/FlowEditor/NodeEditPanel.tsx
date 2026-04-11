import { useState, useEffect, useRef, useCallback } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';

const nodeStyles = [
  { value: 'default' as const, label: '默认', color: 'bg-slate-500' },
  { value: 'success' as const, label: '成功', color: 'bg-emerald-500' },
  { value: 'error' as const, label: '错误', color: 'bg-red-500' },
  { value: 'warning' as const, label: '警告', color: 'bg-amber-500' },
];

export function NodeEditPanel() {
  const editingNodeId = useFlowStore((s) => s.editingNodeId);
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const setEditingNode = useFlowStore((s) => s.setEditingNode);
  const deleteNode = useFlowStore((s) => s.deleteNode);

  const node = nodes.find((n) => n.id === editingNodeId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nodeStyle, setNodeStyle] = useState<'default' | 'success' | 'error' | 'warning'>('default');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNodeId) {
      const n = nodes.find((n) => n.id === editingNodeId);
      if (n) {
        setTitle(n.data.title);
        setDescription(n.data.description);
        setNodeStyle(n.data.nodeStyle);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNodeId]);

  const handleSave = useCallback(() => {
    if (editingNodeId) {
      updateNodeData(editingNodeId, { title, description, nodeStyle });
      setEditingNode(null);
    }
  }, [editingNodeId, title, description, nodeStyle, updateNodeData, setEditingNode]);

  const handleDelete = useCallback(() => {
    if (editingNodeId) {
      deleteNode(editingNodeId);
      setEditingNode(null);
    }
  }, [editingNodeId, deleteNode, setEditingNode]);

  const handleScreenshotUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingNodeId) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateNodeData(editingNodeId, { screenshot: reader.result as string });
    };
    reader.readAsDataURL(file);
  }, [editingNodeId, updateNodeData]);

  const handleRemoveScreenshot = useCallback(() => {
    if (editingNodeId) {
      updateNodeData(editingNodeId, { screenshot: undefined });
    }
  }, [editingNodeId, updateNodeData]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!editingNodeId) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          updateNodeData(editingNodeId, { screenshot: reader.result as string });
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, [editingNodeId, updateNodeData]);

  if (!editingNodeId || !node) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onPaste={handlePaste}>
      <div className="bg-[#1a2332] border border-slate-700 rounded-xl w-[420px] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-base font-semibold text-slate-100">编辑节点</h3>
          <button
            onClick={() => setEditingNode(null)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">节点标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="输入节点标题"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">节点描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              placeholder="输入节点描述"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">节点类型</label>
            <div className="flex gap-2">
              {nodeStyles.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setNodeStyle(s.value)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all
                    ${nodeStyle === s.value
                      ? 'bg-slate-700 text-slate-100 ring-1 ring-blue-500'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}
                  `}
                >
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">UI 截图</label>
            {node.data.screenshot ? (
              <div className="relative group">
                <img
                  src={node.data.screenshot}
                  alt="UI Screenshot"
                  className="w-full h-32 object-cover rounded-lg border border-slate-600"
                />
                <button
                  onClick={handleRemoveScreenshot}
                  className="absolute top-2 right-2 p-1 bg-red-600 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-slate-600 rounded-lg text-sm text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
              >
                点击上传或 Ctrl+V 粘贴截图
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
          >
            删除节点
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingNode(null)}
              className="px-4 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
