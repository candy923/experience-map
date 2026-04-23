import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFlowStore } from '../../hooks/useFlowStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import type {
  NodeMetric,
  NodeVersion,
  NodeVersionSnapshot,
  NodeExperiment,
  ExperimentVariant,
  ExperimentSegment,
} from '../../types';

export const VERSION_SOFT_LIMIT = 20;

interface Props {
  nodeId: string;
  onClose: () => void;
}

type Tab = 'versions' | 'experiments';

export function NodeHistoryPanel({ nodeId, onClose }: Props) {
  const { nodes } = useActiveProject();
  const node = nodes.find((n) => n.id === nodeId);

  const addNodeVersion = useFlowStore((s) => s.addNodeVersion);
  const updateNodeVersion = useFlowStore((s) => s.updateNodeVersion);
  const restoreNodeVersion = useFlowStore((s) => s.restoreNodeVersion);
  const deleteNodeVersion = useFlowStore((s) => s.deleteNodeVersion);
  const updateNodeCurrentMeta = useFlowStore((s) => s.updateNodeCurrentMeta);
  const addNodeExperiment = useFlowStore((s) => s.addNodeExperiment);
  const updateNodeExperiment = useFlowStore((s) => s.updateNodeExperiment);
  const deleteNodeExperiment = useFlowStore((s) => s.deleteNodeExperiment);

  const [tab, setTab] = useState<Tab>('versions');
  const [quickSaveOpen, setQuickSaveOpen] = useState(false);
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingExperimentId, setEditingExperimentId] = useState<string | null>(null);
  const [creatingExperiment, setCreatingExperiment] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

  const editingExperiment = useMemo(
    () => node?.data.experiments?.find((e) => e.id === editingExperimentId) || null,
    [node, editingExperimentId]
  );

  const editingVersion = useMemo(
    () => node?.data.versions?.find((v) => v.id === editingVersionId) || null,
    [node, editingVersionId]
  );

  if (!node) return null;

  const versions = node.data.versions || [];
  const experiments = node.data.experiments || [];

  const handleSaveCurrent = (name: string, note: string) => {
    if (versions.length >= VERSION_SOFT_LIMIT) {
      const ok = window.confirm(
        `该节点已有 ${versions.length} 个历史版本，建议先清理过旧的记录避免 data.json 过大。是否继续保存？`
      );
      if (!ok) return;
    }
    addNodeVersion(nodeId, {
      name: name.trim() || `版本 ${versions.length + 1}`,
      note: note.trim() || undefined,
      snapshot: {
        title: node.data.title,
        description: node.data.description,
        screenshot: node.data.screenshot,
        metrics: node.data.metrics,
      },
    });
    setQuickSaveOpen(false);
  };

  const handleRestore = (versionId: string, versionName: string) => {
    const ok = window.confirm(
      `将把「${versionName}」覆盖到当前节点内容，当前状态会自动存为一条新版本。是否继续？`
    );
    if (!ok) return;
    restoreNodeVersion(nodeId, versionId, true);
  };

  const handleDeleteVersion = (versionId: string, versionName: string) => {
    if (!window.confirm(`确定删除版本「${versionName}」？此操作可通过撤销恢复。`)) return;
    deleteNodeVersion(nodeId, versionId);
  };

  const handleDeleteExperiment = (experimentId: string, experimentName: string) => {
    if (!window.confirm(`确定删除实验「${experimentName}」？此操作可通过撤销恢复。`)) return;
    deleteNodeExperiment(nodeId, experimentId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 1200, maxHeight: '94vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-slate-700 shrink-0"
          style={{ padding: '22px 44px' }}
        >
          <div className="flex items-center gap-5">
            <h3 className="text-lg font-semibold text-slate-100">
              历史 · {node.data.title}
            </h3>
            <div className="flex rounded-lg bg-slate-800 p-1">
              <button
                onClick={() => setTab('versions')}
                className={`text-sm px-4 py-1.5 rounded-md transition-colors ${
                  tab === 'versions' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                版本 {versions.length > 0 && <span className="opacity-60">· {versions.length}</span>}
              </button>
              <button
                onClick={() => setTab('experiments')}
                className={`text-sm px-4 py-1.5 rounded-md transition-colors ${
                  tab === 'experiments' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                实验 {experiments.length > 0 && <span className="opacity-60">· {experiments.length}</span>}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1" style={{ padding: '28px 44px' }}>
          {tab === 'versions' ? (
            <VersionsTab
              node={node.data}
              versions={versions}
              onEditCurrent={() => setEditingCurrent(true)}
              onEdit={(id) => setEditingVersionId(id)}
              onRestore={handleRestore}
              onDelete={handleDeleteVersion}
              onPreview={setPreviewImage}
            />
          ) : (
            <ExperimentsTab
              experiments={experiments}
              onEdit={(id) => setEditingExperimentId(id)}
              onDelete={handleDeleteExperiment}
              onPreview={setPreviewImage}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t border-slate-700 shrink-0"
          style={{ padding: '18px 44px' }}
        >
          <div className="text-xs text-slate-500">
            {tab === 'versions' && versions.length >= VERSION_SOFT_LIMIT * 0.8 && (
              <span className="text-amber-400">
                已有 {versions.length} 个版本，接近建议上限 {VERSION_SOFT_LIMIT}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {tab === 'versions' ? (
              <button
                onClick={() => setQuickSaveOpen(true)}
                className="text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                style={{ padding: '10px 20px' }}
              >
                将当前存为新版本
              </button>
            ) : (
              <button
                onClick={() => setCreatingExperiment(true)}
                className="text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                style={{ padding: '10px 20px' }}
              >
                添加实验记录
              </button>
            )}
          </div>
        </div>
      </div>

      {quickSaveOpen && (
        <QuickSaveVersionDialog
          defaultName={`版本 ${versions.length + 1}`}
          onCancel={() => setQuickSaveOpen(false)}
          onConfirm={handleSaveCurrent}
        />
      )}

      {editingVersion && (
        <VersionEditor
          version={editingVersion}
          onCancel={() => setEditingVersionId(null)}
          onSave={(patch) => {
            updateNodeVersion(nodeId, editingVersion.id, patch);
            setEditingVersionId(null);
          }}
        />
      )}

      {editingCurrent && (
        <CurrentMetaEditor
          currentNote={node.data.currentNote}
          updatedAt={node.data.updatedAt}
          onCancel={() => setEditingCurrent(false)}
          onSave={(patch) => {
            updateNodeCurrentMeta(nodeId, patch);
            setEditingCurrent(false);
          }}
        />
      )}

      {previewImage && <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />}

      {(creatingExperiment || editingExperiment) && (
        <ExperimentEditor
          initial={editingExperiment}
          onCancel={() => {
            setCreatingExperiment(false);
            setEditingExperimentId(null);
          }}
          onSave={(exp) => {
            if (editingExperiment) {
              updateNodeExperiment(nodeId, editingExperiment.id, exp);
            } else {
              addNodeExperiment(nodeId, exp);
            }
            setCreatingExperiment(false);
            setEditingExperimentId(null);
          }}
        />
      )}
    </div>
  );
}

// -------------------- Versions Tab --------------------

function VersionsTab({
  node,
  versions,
  onEditCurrent,
  onEdit,
  onRestore,
  onDelete,
  onPreview,
}: {
  node: { title: string; description: string; screenshot?: string; metrics?: NodeMetric[]; updatedAt?: string; currentNote?: string };
  versions: NodeVersion[];
  onEditCurrent: () => void;
  onEdit: (id: string) => void;
  onRestore: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onPreview: (src: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Current pinned */}
      <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-6">
        <div className="flex items-start gap-6">
          <Thumbnail src={node.screenshot} onPreview={onPreview} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <span className="text-xs text-blue-300 bg-blue-500/20 rounded px-2 py-0.5">当前</span>
                <span className="text-lg font-semibold text-slate-100 truncate">{node.title}</span>
                {node.updatedAt && (
                  <span className="text-sm text-slate-500 shrink-0">更新于 {formatDate(node.updatedAt)}</span>
                )}
              </div>
              <div className="shrink-0">
                <button
                  onClick={onEditCurrent}
                  className="text-sm text-slate-300 hover:bg-slate-700 rounded-md px-3 py-1.5 transition-colors"
                  title="编辑当前版本的发布备注与时间"
                >
                  编辑
                </button>
              </div>
            </div>
            <div className="text-base text-slate-400 mb-3">{node.description}</div>
            {node.currentNote && (
              <div className="text-base text-slate-300 whitespace-pre-wrap mb-4">{node.currentNote}</div>
            )}
            <MetricsChips metrics={node.metrics} />
          </div>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="text-center text-sm text-slate-500 py-10">
          还没有历史版本。点击右下角「将当前存为新版本」把目前的标题 / 截图 / 指标存档一份。
        </div>
      ) : (
        <div className="space-y-4">
          {versions.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start gap-6">
                <Thumbnail src={v.snapshot.screenshot} onPreview={onPreview} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg font-semibold text-slate-100 truncate">{v.name}</span>
                      <span className="text-sm text-slate-500 shrink-0">{formatDate(v.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onEdit(v.id)}
                        className="text-sm text-slate-300 hover:bg-slate-700 rounded-md px-3 py-1.5 transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => onRestore(v.id, v.name)}
                        className="text-sm text-blue-400 hover:bg-blue-500/10 rounded-md px-3 py-1.5 transition-colors"
                      >
                        还原为当前
                      </button>
                      <button
                        onClick={() => onDelete(v.id, v.name)}
                        className="text-sm text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-md px-3 py-1.5 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  {v.snapshot.title && v.snapshot.title !== node.title && (
                    <div className="text-base text-slate-400 mb-1 truncate">标题：{v.snapshot.title}</div>
                  )}
                  {v.note && <div className="text-base text-slate-300 mb-3 whitespace-pre-wrap">{v.note}</div>}
                  <MetricsChips metrics={v.snapshot.metrics} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumbnail({ src, onPreview }: { src?: string; onPreview: (src: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => src && onPreview(src)}
      disabled={!src}
      title={src ? '点击查看大图' : '无截图'}
      className="rounded-lg overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center border border-slate-700 group relative disabled:cursor-default enabled:cursor-zoom-in enabled:hover:border-slate-500 transition-colors"
      style={{ width: 200, height: 290 }}
    >
      {src ? (
        <>
          <img src={src} alt="" className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <svg
              className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m-3-3h6"
              />
            </svg>
          </div>
        </>
      ) : (
        <span className="text-sm text-slate-600">无截图</span>
      )}
    </button>
  );
}

function MetricsChips({
  metrics,
  size = 'md',
}: {
  metrics?: NodeMetric[];
  size?: 'sm' | 'md';
}) {
  if (!metrics || metrics.length === 0) {
    return <div className="text-xs text-slate-600">无指标</div>;
  }
  const chipCls =
    size === 'sm'
      ? 'text-xs px-2 py-0.5 rounded'
      : 'text-sm px-2.5 py-1 rounded-md';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {metrics.map((m) => (
        <span key={m.id} className={`${chipCls} bg-blue-900/30 border border-blue-800/40`}>
          <span className="text-blue-400/80">{m.label}</span>{' '}
          <span className="text-blue-300 font-medium">{m.value}</span>
        </span>
      ))}
    </div>
  );
}

// -------------------- Experiments Tab --------------------

function ExperimentsTab({
  experiments,
  onEdit,
  onDelete,
  onPreview,
}: {
  experiments: NodeExperiment[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onPreview: (src: string) => void;
}) {
  if (experiments.length === 0) {
    return (
      <div className="text-center text-sm text-slate-500 py-10">
        还没有实验记录。点击右下角「添加实验记录」可以录入类似「旧方案 vs 新方案」「新用户/老用户分组数据」等对比信息。
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {experiments.map((exp) => (
        <ExperimentCard key={exp.id} experiment={exp} onEdit={onEdit} onDelete={onDelete} onPreview={onPreview} />
      ))}
    </div>
  );
}

function ExperimentCard({
  experiment,
  onEdit,
  onDelete,
  onPreview,
}: {
  experiment: NodeExperiment;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onPreview: (src: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-100">{experiment.name}</div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
            {experiment.period && <span>{experiment.period}</span>}
            <span>记录于 {formatDate(experiment.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(experiment.id)}
            className="text-xs text-blue-400 hover:bg-blue-500/10 rounded-md px-2.5 py-1.5 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() => onDelete(experiment.id, experiment.name)}
            className="text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-md px-2.5 py-1.5 transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      {experiment.summary && (
        <div className="text-xs text-slate-400 whitespace-pre-wrap mb-4">{experiment.summary}</div>
      )}

      {experiment.variants.length > 0 && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${Math.min(experiment.variants.length, 3)}, minmax(0, 1fr))` }}>
          {experiment.variants.map((v) => (
            <div key={v.id} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    v.role === 'control'
                      ? 'bg-slate-600/40 text-slate-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {v.role === 'control' ? '对照组' : '实验组'}
                </span>
                <span className="text-xs text-slate-200 truncate">{v.name}</span>
              </div>
              {v.screenshot ? (
                <button
                  type="button"
                  onClick={() => onPreview(v.screenshot!)}
                  title="点击查看大图"
                  className="block w-full cursor-zoom-in group/img relative"
                >
                  <img
                    src={v.screenshot}
                    alt=""
                    className="w-full rounded-md border border-slate-700 object-contain bg-slate-950 group-hover/img:border-slate-500 transition-colors"
                    style={{ maxHeight: 360 }}
                  />
                </button>
              ) : (
                <div className="w-full h-24 rounded-md border border-dashed border-slate-700 flex items-center justify-center text-[11px] text-slate-600">
                  无截图
                </div>
              )}
              <div className="mt-2">
                <MetricsChips metrics={v.metrics} />
              </div>
            </div>
          ))}
        </div>
      )}

      {experiment.segments && experiment.segments.length > 0 && (
        <SegmentsTable experiment={experiment} />
      )}
    </div>
  );
}

function SegmentsTable({ experiment }: { experiment: NodeExperiment }) {
  const variantIds = experiment.variants.map((v) => v.id);
  const variantNameOf = (id: string) => experiment.variants.find((v) => v.id === id)?.name || id;
  const allMetricLabels = useMemo(() => {
    const set = new Set<string>();
    for (const seg of experiment.segments || []) {
      for (const row of seg.rows) {
        for (const m of row.metrics) set.add(m.label);
      }
    }
    return Array.from(set);
  }, [experiment.segments]);

  if (allMetricLabels.length === 0) return null;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400">
            <th className="text-left font-medium py-1.5 px-2">分组</th>
            <th className="text-left font-medium py-1.5 px-2">方案</th>
            {allMetricLabels.map((l) => (
              <th key={l} className="text-left font-medium py-1.5 px-2">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {experiment.segments!.map((seg) =>
            variantIds.map((vid, idx) => {
              const row = seg.rows.find((r) => r.variantId === vid);
              return (
                <tr key={`${seg.id}-${vid}`} className="border-t border-slate-800">
                  {idx === 0 && (
                    <td rowSpan={variantIds.length} className="py-1.5 px-2 align-top text-slate-300 font-medium">
                      {seg.name}
                    </td>
                  )}
                  <td className="py-1.5 px-2 text-slate-400">{variantNameOf(vid)}</td>
                  {allMetricLabels.map((label) => {
                    const v = row?.metrics.find((m) => m.label === label)?.value || '—';
                    return (
                      <td key={label} className="py-1.5 px-2 text-slate-200">
                        {v}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// -------------------- Quick save dialog --------------------

function QuickSaveVersionDialog({
  defaultName,
  onCancel,
  onConfirm,
}: {
  defaultName: string;
  onCancel: () => void;
  onConfirm: (name: string, note: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a2332] border border-slate-700 rounded-xl shadow-2xl" style={{ width: 460, padding: 24 }}>
        <h4 className="text-base font-semibold text-slate-100 mb-1">存为历史版本</h4>
        <p className="text-xs text-slate-500 mb-4">
          会将当前节点的标题 / 描述 / 截图 / 指标打包为一条版本归档。卡片本身不会变。
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">版本名</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              style={{ padding: '10px 14px' }}
              placeholder='例如 "v1 旧方案" / "2024春节方案"'
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">备注（可选）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
              style={{ padding: '10px 14px' }}
              placeholder="改动说明、上线时间、实验结论等"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onCancel}
            className="text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            style={{ padding: '10px 22px' }}
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(name, note)}
            className="text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            style={{ padding: '10px 22px' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------- Experiment Editor --------------------

type ExperimentDraft = Omit<NodeExperiment, 'id' | 'createdAt'> & { id?: string; createdAt?: string };

function ExperimentEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: NodeExperiment | null;
  onCancel: () => void;
  onSave: (exp: ExperimentDraft) => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [period, setPeriod] = useState(initial?.period || '');
  const [summary, setSummary] = useState(initial?.summary || '');
  const [variants, setVariants] = useState<ExperimentVariant[]>(
    initial?.variants.length
      ? initial.variants
      : [
          { id: `v-${uuidv4().slice(0, 6)}`, name: '旧方案', role: 'control', metrics: [] },
          { id: `v-${uuidv4().slice(0, 6)}`, name: '新方案', role: 'treatment', metrics: [] },
        ]
  );
  const [segments, setSegments] = useState<ExperimentSegment[]>(initial?.segments || []);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { id: `v-${uuidv4().slice(0, 6)}`, name: `方案 ${prev.length + 1}`, role: 'treatment', metrics: [] },
    ]);
  };
  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
    setSegments((prev) =>
      prev.map((seg) => ({ ...seg, rows: seg.rows.filter((r) => r.variantId !== id) }))
    );
  };
  const updateVariant = (id: string, patch: Partial<ExperimentVariant>) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const addVariantMetric = (variantId: string) => {
    updateVariant(variantId, {
      metrics: [
        ...(variants.find((v) => v.id === variantId)?.metrics || []),
        { id: uuidv4().slice(0, 8), label: '', value: '' },
      ],
    });
  };
  const updateVariantMetric = (variantId: string, metricId: string, field: 'label' | 'value', val: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;
    updateVariant(variantId, {
      metrics: (variant.metrics || []).map((m) => (m.id === metricId ? { ...m, [field]: val } : m)),
    });
  };
  const removeVariantMetric = (variantId: string, metricId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;
    updateVariant(variantId, {
      metrics: (variant.metrics || []).filter((m) => m.id !== metricId),
    });
  };

  const handleScreenshotFile = (variantId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      updateVariant(variantId, { screenshot: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const addSegment = () => {
    setSegments((prev) => [
      ...prev,
      {
        id: `seg-${uuidv4().slice(0, 6)}`,
        name: `分组 ${prev.length + 1}`,
        rows: variants.map((v) => ({ variantId: v.id, metrics: [] })),
      },
    ]);
  };
  const removeSegment = (id: string) => setSegments((prev) => prev.filter((s) => s.id !== id));
  const renameSegment = (id: string, name: string) =>
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));

  const addSegmentRowMetric = (segId: string, variantId: string) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        return {
          ...s,
          rows: s.rows.map((r) =>
            r.variantId === variantId
              ? { ...r, metrics: [...r.metrics, { id: uuidv4().slice(0, 8), label: '', value: '' }] }
              : r
          ),
        };
      })
    );
  };
  const updateSegmentRowMetric = (
    segId: string,
    variantId: string,
    metricId: string,
    field: 'label' | 'value',
    val: string
  ) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        return {
          ...s,
          rows: s.rows.map((r) =>
            r.variantId === variantId
              ? { ...r, metrics: r.metrics.map((m) => (m.id === metricId ? { ...m, [field]: val } : m)) }
              : r
          ),
        };
      })
    );
  };
  const removeSegmentRowMetric = (segId: string, variantId: string, metricId: string) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        return {
          ...s,
          rows: s.rows.map((r) =>
            r.variantId === variantId ? { ...r, metrics: r.metrics.filter((m) => m.id !== metricId) } : r
          ),
        };
      })
    );
  };

  const canSave = name.trim().length > 0 && variants.length >= 1;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const cleanVariants = variants.map((v) => ({
      ...v,
      metrics: (v.metrics || []).filter((m) => m.label.trim() || m.value.trim()),
    }));
    const cleanSegments: ExperimentSegment[] = segments
      .map((s) => ({
        ...s,
        rows: s.rows.map((r) => ({
          ...r,
          metrics: r.metrics.filter((m) => m.label.trim() || m.value.trim()),
        })),
      }))
      .filter((s) => s.rows.some((r) => r.metrics.length > 0));

    onSave({
      id: initial?.id,
      createdAt: initial?.createdAt,
      name: name.trim(),
      period: period.trim() || undefined,
      summary: summary.trim() || undefined,
      variants: cleanVariants,
      segments: cleanSegments.length > 0 ? cleanSegments : undefined,
    });
  }, [canSave, variants, segments, name, period, summary, initial, onSave]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl flex flex-col" style={{ width: 880, maxHeight: '92vh' }}>
        <div className="flex items-center justify-between border-b border-slate-700 shrink-0" style={{ padding: '18px 32px' }}>
          <h3 className="text-base font-semibold text-slate-100">
            {initial ? '编辑实验记录' : '添加实验记录'}
          </h3>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1" style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">实验名称</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如 实验组1"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                style={{ padding: '10px 14px' }}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">时间段（可选）</label>
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="如 2024-03-01 ~ 2024-03-15"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                style={{ padding: '10px 14px' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">摘要 / 结论（可选）</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="如：不同文案和 icon 的实验来看，变化 icon 和文案的组合方案，对点击率提升效果显著。"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
              style={{ padding: '10px 14px' }}
            />
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400">实验分组（对照组 / 实验组）</label>
              <button onClick={addVariant} className="text-xs text-blue-400 hover:bg-blue-500/10 rounded-md px-2 py-1 transition-colors">
                + 添加方案
              </button>
            </div>
            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v.id} className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <select
                      value={v.role}
                      onChange={(e) => updateVariant(v.id, { role: e.target.value as 'control' | 'treatment' })}
                      className="bg-slate-800 border border-slate-600 rounded-md text-xs text-slate-200 px-2 py-1.5 focus:outline-none focus:border-blue-500"
                    >
                      <option value="control">对照组</option>
                      <option value="treatment">实验组</option>
                    </select>
                    <input
                      value={v.name}
                      onChange={(e) => updateVariant(v.id, { name: e.target.value })}
                      placeholder="方案名，如 旧方案 50% 对照组"
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-md text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      style={{ padding: '6px 10px' }}
                    />
                    {variants.length > 1 && (
                      <button
                        onClick={() => removeVariant(v.id)}
                        className="text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-md px-2 py-1 transition-colors"
                      >
                        删除
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-[140px_1fr] gap-3">
                    <div>
                      {v.screenshot ? (
                        <div className="relative group">
                          <img src={v.screenshot} alt="" className="w-full rounded-md border border-slate-700 bg-slate-950 object-contain" style={{ maxHeight: 180 }} />
                          <button
                            onClick={() => updateVariant(v.id, { screenshot: undefined })}
                            className="absolute top-1 right-1 p-1 bg-red-600/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRefs.current[v.id]?.click()}
                          className="w-full border-2 border-dashed border-slate-600 rounded-md text-xs text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
                          style={{ height: 120 }}
                        >
                          点击上传截图
                        </button>
                      )}
                      <input
                        ref={(el) => { fileInputRefs.current[v.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleScreenshotFile(v.id, f);
                          e.target.value = '';
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1.5">该组总体指标</div>
                      <div className="space-y-1.5">
                        {(v.metrics || []).map((m) => (
                          <div key={m.id} className="flex gap-1.5">
                            <input
                              value={m.label}
                              onChange={(e) => updateVariantMetric(v.id, m.id, 'label', e.target.value)}
                              placeholder="指标名"
                              className="w-28 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                              style={{ padding: '5px 8px' }}
                            />
                            <input
                              value={m.value}
                              onChange={(e) => updateVariantMetric(v.id, m.id, 'value', e.target.value)}
                              placeholder="值"
                              className="flex-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                              style={{ padding: '5px 8px' }}
                            />
                            <button
                              onClick={() => removeVariantMetric(v.id, m.id)}
                              className="text-xs text-slate-500 hover:text-red-400 px-1.5"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addVariantMetric(v.id)}
                          className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          + 添加指标
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Segments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400">分人群数据（可选，比如 新用户 / 老用户）</label>
              <button onClick={addSegment} className="text-xs text-blue-400 hover:bg-blue-500/10 rounded-md px-2 py-1 transition-colors">
                + 添加人群分组
              </button>
            </div>
            {segments.length === 0 ? (
              <div className="text-[11px] text-slate-600 rounded-md border border-dashed border-slate-700 py-3 text-center">
                暂未添加分人群数据
              </div>
            ) : (
              <div className="space-y-3">
                {segments.map((seg) => (
                  <div key={seg.id} className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        value={seg.name}
                        onChange={(e) => renameSegment(seg.id, e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded-md text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                        style={{ padding: '5px 10px' }}
                      />
                      <button
                        onClick={() => removeSegment(seg.id)}
                        className="text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-md px-2 py-1 transition-colors"
                      >
                        删除分组
                      </button>
                    </div>
                    <div className="space-y-2">
                      {variants.map((v) => {
                        const row = seg.rows.find((r) => r.variantId === v.id) || { variantId: v.id, metrics: [] };
                        return (
                          <div key={v.id} className="rounded-md border border-slate-700/60 p-2">
                            <div className="text-[11px] text-slate-400 mb-1.5">{v.name}</div>
                            <div className="space-y-1.5">
                              {row.metrics.map((m) => (
                                <div key={m.id} className="flex gap-1.5">
                                  <input
                                    value={m.label}
                                    onChange={(e) => updateSegmentRowMetric(seg.id, v.id, m.id, 'label', e.target.value)}
                                    placeholder="如 点击率"
                                    className="w-28 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                                    style={{ padding: '5px 8px' }}
                                  />
                                  <input
                                    value={m.value}
                                    onChange={(e) => updateSegmentRowMetric(seg.id, v.id, m.id, 'value', e.target.value)}
                                    placeholder="如 2.1%"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                                    style={{ padding: '5px 8px' }}
                                  />
                                  <button
                                    onClick={() => removeSegmentRowMetric(seg.id, v.id, m.id)}
                                    className="text-xs text-slate-500 hover:text-red-400 px-1.5"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => addSegmentRowMetric(seg.id, v.id)}
                                className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                              >
                                + 添加指标
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-700 shrink-0" style={{ padding: '14px 32px' }}>
          <button
            onClick={onCancel}
            className="text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            style={{ padding: '10px 22px' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors"
            style={{ padding: '10px 22px' }}
          >
            {initial ? '保存修改' : '创建实验'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------- Version Editor --------------------

function VersionEditor({
  version,
  onCancel,
  onSave,
}: {
  version: NodeVersion;
  onCancel: () => void;
  onSave: (patch: { name: string; note?: string; snapshot: NodeVersionSnapshot }) => void;
}) {
  const [name, setName] = useState(version.name);
  const [note, setNote] = useState(version.note || '');
  const [title, setTitle] = useState(version.snapshot.title || '');
  const [description, setDescription] = useState(version.snapshot.description || '');
  const [screenshot, setScreenshot] = useState<string | undefined>(version.snapshot.screenshot);
  const [metrics, setMetrics] = useState<NodeMetric[]>(
    (version.snapshot.metrics || []).map((m) => ({ ...m }))
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshot(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setScreenshot(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const addMetric = () =>
    setMetrics((prev) => [...prev, { id: uuidv4().slice(0, 8), label: '', value: '' }]);
  const updateMetric = (id: string, field: 'label' | 'value', val: string) =>
    setMetrics((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: val } : m)));
  const removeMetric = (id: string) =>
    setMetrics((prev) => prev.filter((m) => m.id !== id));

  const handleSave = () => {
    const validMetrics = metrics.filter((m) => m.label.trim() || m.value.trim());
    onSave({
      name: name.trim() || version.name,
      note: note.trim() || undefined,
      snapshot: {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        screenshot,
        metrics: validMetrics.length > 0 ? validMetrics : undefined,
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onPaste={handlePaste}
    >
      <div
        className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 680, maxHeight: '92vh' }}
      >
        <div
          className="flex items-center justify-between border-b border-slate-700 shrink-0"
          style={{ padding: '18px 32px' }}
        >
          <div>
            <h3 className="text-base font-semibold text-slate-100">编辑历史版本</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              仅修改这条归档的内容，不会影响画布上显示的"当前"版本
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className="overflow-y-auto flex-1"
          style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">版本名</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                style={{ padding: '10px 14px' }}
                placeholder='如 "v1 旧方案"'
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                创建时间 <span className="text-slate-600">（只读）</span>
              </label>
              <input
                readOnly
                value={formatDate(version.createdAt)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-500 focus:outline-none"
                style={{ padding: '10px 14px' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">备注（可选）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
              style={{ padding: '10px 14px' }}
              placeholder="改动说明、上线时间、实验结论等"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">快照标题</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                style={{ padding: '10px 14px' }}
                placeholder="版本里保存的节点标题"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">快照描述</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                style={{ padding: '10px 14px' }}
                placeholder="版本里保存的节点描述"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">截图</label>
            {screenshot ? (
              <div className="relative group">
                <img
                  src={screenshot}
                  alt=""
                  className="w-full rounded-lg border border-slate-700 object-contain bg-slate-950"
                  style={{ maxHeight: 220 }}
                />
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-2.5 py-1.5 bg-slate-800/90 text-slate-200 rounded-md hover:bg-slate-700"
                  >
                    替换
                  </button>
                  <button
                    onClick={() => setScreenshot(undefined)}
                    className="text-xs px-2.5 py-1.5 bg-red-600/90 text-white rounded-md hover:bg-red-600"
                  >
                    移除
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-600 rounded-lg text-sm text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
                style={{ padding: '36px 0' }}
              >
                点击上传或 Ctrl+V 粘贴截图
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleScreenshotUpload}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">指标</label>
            <div className="space-y-2">
              {metrics.map((m) => (
                <div key={m.id} className="flex gap-2">
                  <input
                    value={m.label}
                    onChange={(e) => updateMetric(m.id, 'label', e.target.value)}
                    placeholder="指标名，如 曝光"
                    className="w-40 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    style={{ padding: '8px 12px' }}
                  />
                  <input
                    value={m.value}
                    onChange={(e) => updateMetric(m.id, 'value', e.target.value)}
                    placeholder="值，如 4400w"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    style={{ padding: '8px 12px' }}
                  />
                  <button
                    onClick={() => removeMetric(m.id)}
                    className="px-2 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={addMetric}
                className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
              >
                + 添加指标
              </button>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 border-t border-slate-700 shrink-0"
          style={{ padding: '14px 32px' }}
        >
          <button
            onClick={onCancel}
            className="text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            style={{ padding: '10px 22px' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            style={{ padding: '10px 22px' }}
          >
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------- Current-version Meta Editor --------------------

function CurrentMetaEditor({
  currentNote,
  updatedAt,
  onCancel,
  onSave,
}: {
  currentNote?: string;
  updatedAt?: string;
  onCancel: () => void;
  onSave: (patch: { currentNote?: string; updatedAt?: string }) => void;
}) {
  const [note, setNote] = useState(currentNote || '');
  // We render a datetime-local picker for easy editing. Convert back to ISO on save.
  const toInputValue = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [updatedAtInput, setUpdatedAtInput] = useState<string>(toInputValue(updatedAt));

  const handleSave = () => {
    let nextUpdatedAt: string | undefined = updatedAt;
    if (updatedAtInput === '') {
      nextUpdatedAt = undefined;
    } else {
      const d = new Date(updatedAtInput);
      if (!Number.isNaN(d.getTime())) nextUpdatedAt = d.toISOString();
    }
    onSave({
      currentNote: note.trim() ? note : undefined,
      updatedAt: nextUpdatedAt,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a2332] border border-slate-700 rounded-xl shadow-2xl" style={{ width: 540, padding: 26 }}>
        <h4 className="text-base font-semibold text-slate-100 mb-1">编辑当前版本</h4>
        <p className="text-xs text-slate-500 mb-5">
          这里的内容只出现在「历史」面板里，不会显示在画布节点上。
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">发布备注 / 全量时间文案（可选）</label>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
              style={{ padding: '10px 14px' }}
              placeholder='例如 "2026.04.22 全量" / "灰度 10%"'
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              更新时间（可选，手动覆盖）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={updatedAtInput}
                onChange={(e) => setUpdatedAtInput(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                style={{ padding: '10px 14px' }}
              />
              {updatedAtInput && (
                <button
                  onClick={() => setUpdatedAtInput('')}
                  className="text-xs text-slate-500 hover:text-slate-200 hover:bg-slate-700 rounded-md px-2.5 py-1.5 transition-colors shrink-0"
                  title="清除"
                >
                  清除
                </button>
              )}
            </div>
            <div className="text-[11px] text-slate-600 mt-1.5">
              留空就不显示时间；改过后，下次编辑节点内容会再次自动刷新成最新。
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            style={{ padding: '10px 22px' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
            style={{ padding: '10px 22px' }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------- Image Lightbox --------------------

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm cursor-zoom-out"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-2.5 text-slate-200 hover:bg-white/10 rounded-lg transition-colors"
        title="关闭 (Esc)"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[92vw] max-h-[92vh] object-contain shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// -------------------- helpers --------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
