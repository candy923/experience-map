import type { FlowNode, FlowEdge } from '../types';
import { callLLM, getContent, getReasoning } from './llmClient';

export interface PathCandidate {
  /** 这条候选路径的简短标题（5-12 字），如"手动搜索流程"。 */
  title: string;
  /** 节点 id 序列，已通过校验。 */
  path: string[];
  /** 该候选的选择理由（可选）。 */
  reasoning?: string;
}

export interface PathPlanResult {
  /** 三种模式：path=返回节点路径（可能多条候选）；answer=直接文字回答；none=找不到。 */
  mode: 'path' | 'answer' | 'none';
  /** path 模式下的候选路径数组（1-3 条），按推荐度排序。answer/none 为空数组。 */
  candidates: PathCandidate[];
  /** answer 模式下的文字回答。 */
  answer?: string;
  /** 模型给出的总体理由（path 和 answer 都可能有）。 */
  reasoning: string;
  /** 模型自身的思考链（reasoning_content 字段，GLM/Qwen 深度思考模型才有）。 */
  thinking?: string;
  /** path 模式下路径校验失败时的原因，便于上层决定兜底。 */
  invalidReason?: string;
  /** 总 token 消耗，便于成本观测。 */
  totalTokens?: number;
}

const MAX_PATH_LENGTH = 8;

/**
 * 按上限并发执行一批 Promise 任务，按输入顺序返回结果。
 * 避免跨 tab 全局搜索时把 Venus 网关限流打爆。
 */
export async function limitedAll<T>(
  tasks: Array<() => Promise<T>>,
  limit = 3
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= tasks.length) return;
        results[idx] = await tasks[idx]();
      }
    })
  );
  return results;
}

/** 抽出 nodes 中给模型看的字段：label + description + metrics。
 *  不包含 base64 截图、versions、experiments 这些噪声字段。 */
function slimNodes(nodes: FlowNode[]) {
  return nodes.map((n) => {
    const metrics = n.data.metrics?.filter((m) => m.label || m.value) ?? [];
    return {
      id: n.id,
      label: n.data.title || '',
      description: n.data.description || '',
      ...(metrics.length > 0
        ? {
            metrics: metrics.map((m) => ({
              label: m.label,
              value: m.value,
            })),
          }
        : {}),
    };
  });
}

function slimEdges(edges: FlowEdge[]) {
  return edges.map((e) => ({
    source: e.source,
    target: e.target,
    ...(typeof e.label === 'string' && e.label ? { label: e.label } : {}),
  }));
}

/** GLM/Qwen 偶尔会把 JSON 包在 ```json ... ``` 代码块里或前后加废话，做一次稳健解析。 */
function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('模型返回不是合法 JSON');
  }
}

interface RawLLMResult {
  mode?: unknown;
  path?: unknown;
  paths?: unknown;
  answer?: unknown;
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
  const edgeSet = new Set(edges.map((e) => `${e.source}->${e.target}`));
  for (let i = 0; i < path.length - 1; i++) {
    if (!edgeSet.has(`${path[i]}->${path[i + 1]}`)) {
      return { ok: false, reason: `节点 "${path[i]}" 与 "${path[i + 1]}" 之间没有连线` };
    }
  }
  return { ok: true };
}

const SYSTEM_PROMPT = `你是用户体验地图助手。给你一张产品流程图（nodes + edges，每个节点可能带 metrics 指标）和一个用户问题，请根据问题类型返回以下三种 JSON 之一：

【1】 问题是关于用户操作流程、使用路径、场景体验（比如"购物搜索体验"、"领取券的流程"、"新用户怎么进入天天领"）：
{"mode": "path", "paths": [{"title": "xxx", "path": ["id1", "id2", ...], "reasoning": "..."}, ...], "reasoning": "总体说明"}

关键规则（必须严格遵守）：
- **paths 是数组，长度 1~3**。问题明确只有一条路径时返回 1 条；问题宽泛且图中存在多条合法分支时列出全部相关分支（最多 3 条），按推荐度从高到低排序
- 每条 paths[i].title：5-12 字的简短标题，用于区分不同候选（如"手动搜索流程"、"切换平台渠道"、"新用户引导"）
- 每条 paths[i].path：独立满足——每个 id 存在于 nodes 列表；相邻 id 在 edges 中有 (source→target) 连边，不能反向、不能跳跃；长度 1~${MAX_PATH_LENGTH}，能短则短
- 每条 paths[i].reasoning：一句话说明这条路径对应什么场景
- 不要把同一条路径拆成多个候选；候选之间必须有明显差异（不同起点、不同分支、或不同结果）

【2】 问题是关于具体指标、数值、统计信息（比如"提现券领取率是多少"、"UV 多少"、"哪个节点留存最高"）：
{"mode": "answer", "answer": "直接给出简洁自然语言回答", "reasoning": "一句话理由"}
- answer 必须引用 nodes.metrics 中的精确值，**不得自己编造或推算**
- 如果有多个相关节点可以一并列出，用简短格式

【3】 图里找不到能回答问题的信息：
{"mode": "none", "reasoning": "简短说明为什么找不到"}

**严格要求**：只返回纯 JSON，不要 markdown 代码块，不要前后说明。`;

export interface PlanPathOptions {
  signal?: AbortSignal;
  /** 指定使用的模型 id。不传走 llmClient 默认值。 */
  model?: string;
}

export async function planPath(
  question: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: PlanPathOptions = {}
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
    { temperature: 0.1, signal: options.signal, model: options.model }
  );

  const content = getContent(resp);
  const thinking = getReasoning(resp);
  const totalTokens = resp.usage?.total_tokens;

  let parsed: RawLLMResult;
  try {
    parsed = extractJSON(content) as RawLLMResult;
  } catch (e) {
    return {
      mode: 'none',
      candidates: [],
      reasoning: '',
      thinking,
      totalTokens,
      invalidReason: `模型输出无法解析为 JSON: ${(e as Error).message}`,
    };
  }

  const mode =
    parsed.mode === 'path' || parsed.mode === 'answer' || parsed.mode === 'none'
      ? parsed.mode
      : null;
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';
  const answer = typeof parsed.answer === 'string' ? parsed.answer : undefined;

  // 兼容模型可能返回 paths（新 schema）或 path（旧 schema）
  const rawCandidates: Array<{ title?: unknown; path?: unknown; reasoning?: unknown }> = [];
  if (Array.isArray(parsed.paths)) {
    for (const p of parsed.paths as unknown[]) {
      if (p && typeof p === 'object') rawCandidates.push(p as { title?: unknown; path?: unknown; reasoning?: unknown });
    }
  } else if (Array.isArray(parsed.path)) {
    // 兼容：模型忽略了新 schema，直接返回了 path 数组
    rawCandidates.push({ path: parsed.path });
  }

  const inferredMode: 'path' | 'answer' | 'none' =
    mode ?? (rawCandidates.length > 0 ? 'path' : answer ? 'answer' : 'none');

  if (inferredMode === 'path') {
    if (rawCandidates.length === 0) {
      return {
        mode: 'none',
        candidates: [],
        reasoning: reasoning || '模型未返回路径',
        thinking,
        totalTokens,
      };
    }

    const validCandidates: PathCandidate[] = [];
    const validationErrors: string[] = [];
    const seen = new Set<string>();

    rawCandidates.forEach((c, idx) => {
      const pathArr = Array.isArray(c.path)
        ? ((c.path as unknown[]).filter((x) => typeof x === 'string') as string[])
        : [];
      if (pathArr.length === 0) {
        validationErrors.push(`候选 #${idx + 1}: path 为空`);
        return;
      }
      const validation = validatePath(pathArr, nodes, edges);
      if (!validation.ok) {
        validationErrors.push(`候选 #${idx + 1}: ${validation.reason}`);
        return;
      }
      // 去重（不同候选碰巧 path 相同的情况）
      const key = pathArr.join('->');
      if (seen.has(key)) return;
      seen.add(key);
      validCandidates.push({
        title:
          typeof c.title === 'string' && c.title.trim()
            ? c.title.trim()
            : rawCandidates.length > 1
            ? `路径 ${validCandidates.length + 1}`
            : 'AI 规划路径',
        path: pathArr,
        reasoning: typeof c.reasoning === 'string' ? c.reasoning : undefined,
      });
    });

    if (validCandidates.length === 0) {
      return {
        mode: 'none',
        candidates: [],
        reasoning,
        thinking,
        totalTokens,
        invalidReason: validationErrors.join('; ') || '模型未返回合法路径',
      };
    }

    return {
      mode: 'path',
      candidates: validCandidates,
      reasoning: reasoning || '已规划路径',
      thinking,
      totalTokens,
    };
  }

  if (inferredMode === 'answer') {
    if (!answer || !answer.trim()) {
      return {
        mode: 'none',
        candidates: [],
        reasoning: reasoning || '模型未给出答案',
        thinking,
        totalTokens,
      };
    }
    return {
      mode: 'answer',
      candidates: [],
      answer,
      reasoning: reasoning || '已直接回答',
      thinking,
      totalTokens,
    };
  }

  return {
    mode: 'none',
    candidates: [],
    reasoning: reasoning || '模型未找到答案',
    thinking,
    totalTokens,
  };
}
