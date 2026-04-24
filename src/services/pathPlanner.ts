import type { FlowNode, FlowEdge } from '../types';
import { callLLM, getContent, getReasoning } from './llmClient';

export interface PathPlanResult {
  /** 规划出的节点 id 序列。空数组 = 没找到。 */
  path: string[];
  /** 模型给出的简短理由。 */
  reasoning: string;
  /** 模型自身在 reasoning_content 字段里的思考链（GLM-5 才有）。 */
  thinking?: string;
  /** 模型返回路径校验失败时的原因，便于上层决定是否走 fallback。 */
  invalidReason?: string;
  /** 总共消耗的 token，便于成本观测。 */
  totalTokens?: number;
}

const MAX_PATH_LENGTH = 8;

/** 抽出 nodes/edges 中真正给模型看的字段，避免把 base64 截图、metrics、versions 这些噪声塞进 prompt。 */
function slimNodes(nodes: FlowNode[]) {
  return nodes.map((n) => ({
    id: n.id,
    label: n.data.title || '',
    description: n.data.description || '',
  }));
}

function slimEdges(edges: FlowEdge[]) {
  return edges.map((e) => ({
    source: e.source,
    target: e.target,
    ...(typeof e.label === 'string' && e.label ? { label: e.label } : {}),
  }));
}

/** GLM 偶尔会把 JSON 包在 ```json ... ``` 代码块里或前后加废话，做一次稳健解析。 */
function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  // 先按 ```json ... ``` 围栏抽
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // 兜底：找第一个 { 到最后一个 }
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('模型返回不是合法 JSON');
  }
}

interface RawLLMResult {
  path?: unknown;
  reasoning?: unknown;
}

/** 校验 LLM 返回的 path 是否真实存在、是否相邻可达、是否在长度范围内。 */
function validatePath(
  path: string[],
  nodes: FlowNode[],
  edges: FlowEdge[]
): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(path)) return { ok: false, reason: 'path 不是数组' };
  if (path.length === 0) return { ok: false, reason: '模型返回空路径' };
  if (path.length > MAX_PATH_LENGTH) {
    return { ok: false, reason: `路径长度 ${path.length} 超过上限 ${MAX_PATH_LENGTH}` };
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const id of path) {
    if (typeof id !== 'string' || !nodeIds.has(id)) {
      return { ok: false, reason: `节点 id "${id}" 不存在` };
    }
  }
  // 相邻必须有边
  const edgeSet = new Set(edges.map((e) => `${e.source}->${e.target}`));
  for (let i = 0; i < path.length - 1; i++) {
    if (!edgeSet.has(`${path[i]}->${path[i + 1]}`)) {
      return { ok: false, reason: `节点 "${path[i]}" 与 "${path[i + 1]}" 之间没有连线` };
    }
  }
  return { ok: true };
}

const SYSTEM_PROMPT = `你是用户体验路径规划助手。我会给你一张产品流程的有向图（nodes + edges），以及一个用户问题。
你需要在图里规划出一条最能回答用户问题的节点路径。

硬性要求：
1. path 中的每个 id 必须出现在 nodes 列表里。
2. 相邻两个 id 必须在 edges 中存在 (source→target 同向)。不能反向走，不能跳跃。
3. 路径长度 1~${MAX_PATH_LENGTH}。能短则短，避免凑步数。
4. 如果图里确实找不到能回答问题的合理路径，返回 {"path": [], "reasoning": "原因"}。

输出格式（**只返回纯 JSON，不要 markdown 代码块、不要任何其它解释**）：
{"path": ["nodeId1", "nodeId2"], "reasoning": "一句话说明为什么选这条路径"}`;

export async function planPath(
  question: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: { signal?: AbortSignal } = {}
): Promise<PathPlanResult> {
  const slimmedNodes = slimNodes(nodes);
  const slimmedEdges = slimEdges(edges);

  const userPrompt = `nodes:
${JSON.stringify(slimmedNodes, null, 2)}

edges:
${JSON.stringify(slimmedEdges)}

用户问题：${question}`;

  const resp = await callLLM(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.1, signal: options.signal }
  );

  const content = getContent(resp);
  const thinking = getReasoning(resp);
  const totalTokens = resp.usage?.total_tokens;

  let parsed: RawLLMResult;
  try {
    parsed = extractJSON(content) as RawLLMResult;
  } catch (e) {
    return {
      path: [],
      reasoning: '',
      thinking,
      totalTokens,
      invalidReason: `模型输出无法解析为 JSON: ${(e as Error).message}`,
    };
  }

  const rawPath = Array.isArray(parsed.path) ? (parsed.path as unknown[]).filter((x) => typeof x === 'string') as string[] : [];
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

  // 模型自己说找不到 → 直接透传，不算"无效"，让上层决定是否 fallback
  if (rawPath.length === 0) {
    return {
      path: [],
      reasoning: reasoning || '模型未找到合适路径',
      thinking,
      totalTokens,
    };
  }

  const validation = validatePath(rawPath, nodes, edges);
  if (!validation.ok) {
    return {
      path: [],
      reasoning,
      thinking,
      totalTokens,
      invalidReason: validation.reason,
    };
  }

  return {
    path: rawPath,
    reasoning: reasoning || '已规划路径',
    thinking,
    totalTokens,
  };
}
