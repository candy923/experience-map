import { useState, useCallback, useEffect } from 'react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import {
  parseFigmaUrl,
  fetchFrames,
  fetchImageUrls,
  toDataUrl,
  buildNodesAndEdges,
  loadStoredToken,
  saveStoredToken,
  clearStoredToken,
  type FigmaFrameInfo,
} from '../../services/figmaImporter';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Phase = 'idle' | 'fetchingFrames' | 'previewReady' | 'downloading' | 'done';

export function FigmaImportModal({ open, onClose }: Props) {
  const importNodes = useFlowStore((s) => s.importNodes);
  const { nodes: activeNodes, name: activeName } = useActiveProject();

  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [rememberToken, setRememberToken] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [frames, setFrames] = useState<FigmaFrameInfo[]>([]);
  const [fileKey, setFileKey] = useState('');
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setToken(loadStoredToken());
      setPhase('idle');
      setError('');
      setUrl('');
      setFrames([]);
      setProgress({ done: 0, total: 0 });
    }
  }, [open]);

  const handlePreview = useCallback(async () => {
    setError('');
    setFrames([]);
    if (!url.trim()) { setError('请填写 Figma 链接'); return; }
    if (!token.trim()) { setError('请填写 Figma Personal Access Token'); return; }
    try {
      const parsed = parseFigmaUrl(url);
      setPhase('fetchingFrames');
      const list = await fetchFrames(parsed.fileKey, parsed.nodeId, token.trim());
      setFileKey(parsed.fileKey);
      setNodeId(parsed.nodeId);
      setFrames(list);
      setPhase('previewReady');
      if (rememberToken) saveStoredToken(token.trim());
      else clearStoredToken();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('idle');
    }
  }, [url, token, rememberToken]);

  const handleImport = useCallback(async () => {
    if (frames.length === 0) return;
    setError('');
    setPhase('downloading');
    setProgress({ done: 0, total: frames.length });
    try {
      const urls = await fetchImageUrls(
        fileKey,
        frames.map((f) => f.id),
        token.trim(),
        1,
        'png'
      );
      const dataUrlById: Record<string, string> = {};
      let done = 0;
      for (const frame of frames) {
        const imgUrl = urls[frame.id];
        if (!imgUrl) continue;
        dataUrlById[frame.id] = await toDataUrl(imgUrl, 'image/png');
        done += 1;
        setProgress({ done, total: frames.length });
      }

      // Place new nodes in a vertical column to the LEFT of existing content,
      // with enough horizontal gap to avoid overlap with long labels.
      const existingXs = activeNodes.map((n) => n.position.x);
      const existingYs = activeNodes.map((n) => n.position.y);
      const baseX = existingXs.length ? Math.min(...existingXs) - 360 : 0;
      const baseY = existingYs.length ? Math.min(...existingYs) : 0;

      const { nodes, edges } = buildNodesAndEdges(frames, dataUrlById, baseX, baseY, 'vertical');
      importNodes(nodes, edges);
      setPhase('done');
      setTimeout(() => onClose(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('previewReady');
    }
  }, [frames, fileKey, token, activeNodes, importNodes, onClose]);

  if (!open) return null;

  const busy = phase === 'fetchingFrames' || phase === 'downloading';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-[#1a2332] border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 640, maxHeight: '92vh' }}
      >
        <div
          className="flex items-center justify-between border-b border-slate-700 shrink-0"
          style={{ padding: '20px 48px' }}
        >
          <h3 className="text-lg font-semibold text-slate-100">从 Figma 导入</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          className="overflow-y-auto flex-1"
          style={{ padding: '24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          {error && (
            <div className="rounded-xl bg-red-900/30 border border-red-800/50 text-red-300 text-sm" style={{ padding: '12px 16px' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 8 }}>
              Figma 链接
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              placeholder="https://www.figma.com/design/xxx/..?node-id=0-1"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-60"
              style={{ padding: '12px 16px' }}
            />
            <p className="text-xs text-slate-500" style={{ marginTop: 6 }}>
              在 Figma 里右键 Page 或 Frame，选 Copy link，粘贴到这里
            </p>
          </div>

          <div>
            <label className="block text-base font-medium text-slate-400" style={{ marginBottom: 8 }}>
              Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              placeholder="figd_..."
              className="w-full bg-slate-800 border border-slate-600 rounded-xl text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-60"
              style={{ padding: '12px 16px' }}
            />
            <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberToken}
                  onChange={(e) => setRememberToken(e.target.checked)}
                  className="accent-teal-500"
                />
                记住 token（仅保存在浏览器本地）
              </label>
              <a
                href="https://www.figma.com/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-teal-400 hover:text-teal-300"
              >
                生成 token →
              </a>
            </div>
          </div>

          {phase === 'previewReady' && frames.length > 0 && (
            <div>
              <div className="text-sm text-slate-300" style={{ marginBottom: 8 }}>
                将要导入 <span className="text-teal-400 font-semibold">{frames.length}</span> 个 Frame，
                追加到 <span className="text-slate-100 font-medium">{activeName}</span>：
              </div>
              <div
                className="rounded-xl border border-slate-700 bg-slate-900/50 overflow-y-auto"
                style={{ maxHeight: 200, padding: '8px 12px' }}
              >
                <ol className="text-sm text-slate-300 list-decimal list-inside space-y-1">
                  {frames.map((f) => (
                    <li key={f.id}>
                      <span className="text-slate-200">{f.name}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        {Math.round(f.width)}×{Math.round(f.height)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {phase === 'downloading' && (
            <div>
              <div className="flex items-center justify-between text-sm text-slate-300" style={{ marginBottom: 8 }}>
                <span>正在下载截图…</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="rounded-xl bg-emerald-900/30 border border-emerald-800/50 text-emerald-300 text-sm" style={{ padding: '12px 16px' }}>
              导入完成！已追加 {frames.length} 个节点到「{activeName}」
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between border-t border-slate-700 shrink-0"
          style={{ padding: '20px 48px' }}
        >
          <div className="text-xs text-slate-500">
            {nodeId ? `Node: ${nodeId}` : fileKey ? `File: ${fileKey}` : ''}
          </div>
          <div className="flex" style={{ gap: 12 }}>
            <button
              onClick={onClose}
              disabled={busy}
              className="text-base text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
              style={{ padding: '12px 28px' }}
            >
              取消
            </button>
            {phase === 'previewReady' ? (
              <button
                onClick={handleImport}
                disabled={busy || frames.length === 0}
                className="text-base text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '12px 28px' }}
              >
                导入 {frames.length} 个节点
              </button>
            ) : (
              <button
                onClick={handlePreview}
                disabled={busy}
                className="text-base text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors disabled:opacity-50"
                style={{ padding: '12px 28px' }}
              >
                {phase === 'fetchingFrames' ? '读取中…' : '预览'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
