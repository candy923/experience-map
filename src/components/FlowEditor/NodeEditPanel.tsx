import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFlowStore } from '../../hooks/useFlowStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import type { NodeMetric } from '../../types';

const nodeStyles = [
  { value: 'default' as const, label: '默认', color: 'bg-slate-500' },
  { value: 'success' as const, label: '成功', color: 'bg-emerald-500' },
  { value: 'error' as const, label: '错误', color: 'bg-red-500' },
  { value: 'warning' as const, label: '警告', color: 'bg-amber-500' },
];

export function NodeEditPanel() {
  const editingNodeId = useFlowStore((s) => s.editingNodeId);
  const { nodes } = useActiveProject();
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const setEditingNode = useFlowStore((s) => s.setEditingNode);
  const deleteNode = useFlowStore((s) => s.deleteNode);

  const node = nodes.find((n) => n.id === editingNodeId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nodeStyle, setNodeStyle] = useState<'default' | 'success' | 'error' | 'warning'>('default');
  const [metrics, setMetrics] = useState<NodeMetric[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNodeId) {
      const n = nodes.find((n) => n.id === editingNodeId);
      if (n) {
        setTitle(n.data.title);
        setDescription(n.data.description);
        setNodeStyle(n.data.nodeStyle);
        setMetrics(n.data.metrics || []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNodeId]);

  const handleSave = useCallback(() => {
    if (editingNodeId) {
      const validMetrics = metrics.filter((m) => m.label.trim() || m.value.trim());
      updateNodeData(editingNodeId, {
        title,
        description,
        nodeStyle,
        metrics: validMetrics.length > 0 ? validMetrics : undefined,
      });
      setEditingNode(null);
    }
  }, [editingNodeId, title, description, nodeStyle, metrics, updateNodeData, setEditingNode]);

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

  const addMetric = useCallback(() => {
    setMetrics((prev) => [...prev, { id: uuidv4().slice(0, 8), label: '', value: '' }]);
  }, []);

  const updateMetric = useCallback((id: string, field: 'label' | 'value', val: string) => {
    setMetrics((prev) => prev.map((m) => m.id === id ? { ...m, [field]: val } : m));
  }, []);

  const removeMetric = useCallback((id: string) => {
    setMetrics((prev) => prev.filter((m) => m.id !== id));
  }, []);

  if (!editingNodeId || !node) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onPaste={handlePaste}>
      <div className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl flex flex-col" style={{ width: 700, maxHeight: '92vh' }}>
        <div className="flex items-center justify-between border-b border-slate-700 shrink-0" style={{ padding: '20px 48px' }}>
          <h3 className="text-lg font-semibold text-slate-100">编辑节点</h3>
          <button
            onClick={() => setEditingNode(null)}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1" style={{ padding: '28px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 10 }}>节点标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              style={{ padding: '14px 20px' }}
              placeholder="输入节点标题"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 10 }}>节点描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              style={{ padding: '14px 20px' }}
              placeholder="输入节点描述"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 10 }}>节点类型</label>
            <div className="flex gap-4">
              {nodeStyles.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setNodeStyle(s.value)}
                  className={`
                    flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-base transition-all
                    ${nodeStyle === s.value
                      ? 'bg-slate-700 text-slate-100 ring-2 ring-blue-500'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}
                  `}
                >
                  <div className={`w-3 h-3 rounded-full ${s.color}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 10 }}>UI 截图</label>
            {node.data.screenshot ? (
              <div className="relative group">
                <img
                  src={node.data.screenshot}
                  alt="UI Screenshot"
                  className="w-full rounded-xl border border-slate-600 object-cover"
                  style={{ height: 180 }}
                />
                <button
                  onClick={handleRemoveScreenshot}
                  className="absolute top-3 right-3 p-2 bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-600 rounded-xl text-base text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
                style={{ padding: '48px 0' }}
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

          {/* Metrics */}
          <div>
            <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 10 }}>数据指标</label>
            <div className="space-y-4">
              {metrics.map((m) => (
                <div key={m.id} className="flex items-center gap-4">
                  <input
                    type="text"
                    value={m.label}
                    onChange={(e) => updateMetric(m.id, 'label', e.target.value)}
                    placeholder="指标名，如 PV"
                    className="w-[200px] bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500"
                    style={{ padding: '14px 20px' }}
                  />
                  <input
                    type="text"
                    value={m.value}
                    onChange={(e) => updateMetric(m.id, 'value', e.target.value)}
                    placeholder="值，如 12.3万"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500"
                    style={{ padding: '14px 20px' }}
                  />
                  <button
                    onClick={() => removeMetric(m.id)}
                    className="p-3 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-colors shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                onClick={addMetric}
                className="flex items-center gap-2 text-base text-slate-400 hover:text-blue-400 transition-colors py-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                添加指标
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 shrink-0" style={{ padding: '20px 48px' }}>
          <button
            onClick={handleDelete}
            className="text-base text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-xl transition-colors"
            style={{ padding: '14px 28px' }}
          >
            删除节点
          </button>
          <div className="flex" style={{ gap: 16 }}>
            <button
              onClick={() => setEditingNode(null)}
              className="text-base text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              style={{ padding: '14px 36px' }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="text-base text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
              style={{ padding: '14px 36px' }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
