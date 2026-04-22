import type { FlowNode, FlowEdge } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface FigmaFrameInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId: string | null;
}

const FIGMA_API = 'https://api.figma.com/v1';

/**
 * Parse a Figma URL into { fileKey, nodeId }.
 * Supports:
 *   https://www.figma.com/design/:fileKey/:fileName?node-id=:nodeId
 *   https://www.figma.com/file/:fileKey/:fileName?node-id=:nodeId
 * nodeId in URL uses "-" which we convert to ":".
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  const u = url.trim();
  const match = u.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error('链接格式无效：必须是 figma.com/design/... 或 figma.com/file/...');
  const fileKey = match[1];

  let nodeId: string | null = null;
  const nodeIdMatch = u.match(/[?&]node-id=([^&]+)/);
  if (nodeIdMatch) {
    nodeId = decodeURIComponent(nodeIdMatch[1]).replace(/-/g, ':');
  }
  return { fileKey, nodeId };
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  children?: FigmaNode[];
}

async function figmaFetch<T>(path: string, token: string): Promise<T> {
  const resp = await fetch(`${FIGMA_API}${path}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!resp.ok) {
    if (resp.status === 403) throw new Error('Token 无效或没有权限（403）');
    if (resp.status === 404) throw new Error('文件不存在或无权访问（404）');
    throw new Error(`Figma API 错误：${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

/**
 * Fetch the top-level frames under the specified node (or under the first page if nodeId is null).
 * Returns frames sorted by visual position (rows by y, then x).
 */
export async function fetchFrames(
  fileKey: string,
  nodeId: string | null,
  token: string
): Promise<FigmaFrameInfo[]> {
  let parent: FigmaNode;

  if (nodeId) {
    const data = await figmaFetch<{ nodes: Record<string, { document: FigmaNode } | null> }>(
      `/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
      token
    );
    const entry = data.nodes[nodeId];
    if (!entry) throw new Error(`节点 ${nodeId} 在该 Figma 文件里找不到`);
    parent = entry.document;
  } else {
    const data = await figmaFetch<{ document: FigmaNode }>(`/files/${fileKey}`, token);
    const firstPage = data.document.children?.[0];
    if (!firstPage) throw new Error('文件里没有可导入的页面');
    parent = firstPage;
  }

  const children = parent.children || [];
  const frames = children
    .filter((c) => c.type === 'FRAME' && c.absoluteBoundingBox)
    .map<FigmaFrameInfo>((c) => ({
      id: c.id,
      name: c.name,
      x: c.absoluteBoundingBox!.x,
      y: c.absoluteBoundingBox!.y,
      width: c.absoluteBoundingBox!.width,
      height: c.absoluteBoundingBox!.height,
    }));

  if (frames.length === 0) {
    throw new Error(`节点 ${parent.name} 下没有找到任何一级 Frame`);
  }

  return sortFramesByPosition(frames);
}

/**
 * Sort frames into a linear reading order: group by rows (y-axis), then left-to-right within a row.
 */
export function sortFramesByPosition(frames: FigmaFrameInfo[]): FigmaFrameInfo[] {
  if (frames.length <= 1) return [...frames];
  const avgHeight = frames.reduce((sum, f) => sum + f.height, 0) / frames.length;
  const rowTolerance = avgHeight / 2;

  const sortedByY = [...frames].sort((a, b) => a.y - b.y);
  const rows: FigmaFrameInfo[][] = [];
  for (const f of sortedByY) {
    const row = rows.find((r) => Math.abs(r[0].y - f.y) < rowTolerance);
    if (row) row.push(f);
    else rows.push([f]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows.flat();
}

/**
 * Fetch S3 export URLs for the given frame ids (PNG @1x by default).
 */
export async function fetchImageUrls(
  fileKey: string,
  ids: string[],
  token: string,
  scale = 1,
  format: 'png' | 'jpg' = 'png'
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const idsParam = ids.map(encodeURIComponent).join(',');
  const data = await figmaFetch<{ err: string | null; images: Record<string, string | null> }>(
    `/images/${fileKey}?ids=${idsParam}&format=${format}&scale=${scale}`,
    token
  );
  if (data.err) throw new Error(`Figma 图片导出失败：${data.err}`);
  const out: Record<string, string> = {};
  for (const [id, url] of Object.entries(data.images)) {
    if (url) out[id] = url;
  }
  return out;
}

/**
 * Download an image URL and convert to a data URL (base64).
 */
export async function toDataUrl(url: string, mime = 'image/png'): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载图片失败：${resp.status}`);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Normalize mime if the blob's type is empty
      if (!result.startsWith('data:')) {
        resolve(`data:${mime};base64,${result}`);
      } else {
        resolve(result);
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export interface BuildResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type LayoutOrientation = 'vertical' | 'horizontal';

/**
 * Build FlowNodes and linear FlowEdges from ordered frames and their data URLs.
 * Default: vertical column (safer against long Chinese titles overlapping).
 */
export function buildNodesAndEdges(
  frames: FigmaFrameInfo[],
  dataUrlById: Record<string, string>,
  baseX: number,
  baseY: number,
  orientation: LayoutOrientation = 'vertical',
  spacing = orientation === 'vertical' ? 120 : 280
): BuildResult {
  const nodes: FlowNode[] = frames.map((f, i) => ({
    id: `node-${uuidv4().slice(0, 8)}`,
    type: 'custom',
    position:
      orientation === 'vertical'
        ? { x: baseX, y: baseY + i * spacing }
        : { x: baseX + i * spacing, y: baseY },
    data: {
      title: f.name,
      description: '',
      nodeStyle: 'default',
      screenshot: dataUrlById[f.id],
    },
  }));

  const edges: FlowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `e-${uuidv4().slice(0, 8)}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: 'default',
    });
  }

  return { nodes, edges };
}

const TOKEN_KEY = 'figma-personal-access-token';
export function loadStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
export function saveStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch { /* ignore */ }
}
export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}
