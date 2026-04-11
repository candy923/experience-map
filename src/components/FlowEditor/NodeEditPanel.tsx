import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFlowStore } from '../../hooks/useFlowStore';
import type { NodeMetric } from '../../types';

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
      <div className="bg-[#1a2332] border border-slate-700 rounded-2xl w-[620px] shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-10 py-6 border-b border-slate-700 shrink-0">
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

        <div className="px-10 py-8 space-y-10 overflow-y-auto">
          <div>
            <label className="block text-base font-medium text-slate-400 mb-3">节点标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-5 py-4 bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="输入节点标题"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-slate-400 mb-3">节点描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-5 py-4 bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              placeholder="输入节点描述"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-slate-400 mb-3">节点类型</label>
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
            <label className="block text-base font-medium text-slate-400 mb-3">UI 截图</label>
            {node.data.screenshot ? (
              <div className="relative group">
                <img
                  src={node.data.screenshot}
                  alt="UI Screenshot"
                  className="w-full h-44 object-cover rounded-xl border border-slate-600"
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
                className="w-full py-12 border-2 border-dashed border-slate-600 rounded-xl text-base text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
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
            <label className="block text-base font-medium text-slate-400 mb-3">数据指标</label>
            <div className="space-y-4">
              {metrics.map((m) => (
                <div key={m.id} className="flex items-center gap-4">
                  <input
                    type="text"
                    value={m.label}
                    onChange={(e) => updateMetric(m.id, 'label', e.target.value)}
                    placeholder="指标名，如 PV"
                    className="w-[200px] px-5 py-4 bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={m.value}
                    onChange={(e) => updateMetric(m.id, 'value', e.target.value)}
                    placeholder="值，如 12.3万"
                    className="flex-1 px-5 py-4 bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 focus:outline-none focus:border-blue-500"
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

        <div className="flex items-center justify-between px-10 py-6 border-t border-slate-700 shrink-0">
          <button
            onClick={handleDelete}
            className="px-6 py-3 text-base text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-xl transition-colors"
          >
            删除节点
          </button>
          <div className="flex gap-4">
            <button
              onClick={() => setEditingNode(null)}
              className="px-8 py-3 text-base text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-3 text-base text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
