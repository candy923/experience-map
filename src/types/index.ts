import type { Node, Edge } from '@xyflow/react';

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  targetNodeId: string;
  targetProjectId?: string;
  label?: string;
}

export interface NodeMetric {
  id: string;
  label: string;
  value: string;
}

export interface NodeVersionSnapshot {
  title?: string;
  description?: string;
  screenshot?: string;
  metrics?: NodeMetric[];
}

export interface NodeVersion {
  id: string;
  name: string;
  createdAt: string;
  note?: string;
  snapshot: NodeVersionSnapshot;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  role: 'control' | 'treatment';
  screenshot?: string;
  metrics?: NodeMetric[];
}

export interface ExperimentSegmentRow {
  variantId: string;
  metrics: NodeMetric[];
}

export interface ExperimentSegment {
  id: string;
  name: string;
  rows: ExperimentSegmentRow[];
}

export interface NodeExperiment {
  id: string;
  name: string;
  period?: string;
  summary?: string;
  createdAt: string;
  variants: ExperimentVariant[];
  segments?: ExperimentSegment[];
}

export interface FlowNodeData {
  title: string;
  description: string;
  screenshot?: string;
  hotspots?: Hotspot[];
  metrics?: NodeMetric[];
  nodeStyle: 'default' | 'success' | 'error' | 'warning';
  /** Timestamp (ISO) of the last content update, used as the "current" row timestamp in the history panel. */
  updatedAt?: string;
  /** User-authored note shown only on the history panel's "current" row — e.g. "2026.04.22 全量". Not rendered on the canvas card. */
  currentNote?: string;
  versions?: NodeVersion[];
  experiments?: NodeExperiment[];
  [key: string]: unknown;
}

export type FlowNode = Node<FlowNodeData, 'custom'>;

export interface FlowEdgeData {
  /** Marks this edge as derived from a node's Hotspot. Derived edges are
   * rebuilt whenever the user runs "从 Hotspot 生成连线"; manually drawn
   * edges (without this field) are never touched. */
  hotspotId?: string;
  [key: string]: unknown;
}

export type FlowEdge = Edge<FlowEdgeData>;

export interface ScenarioRule {
  id: string;
  keywords: string[];
  path: string[];
  description: string;
}

export interface PathRecording {
  ruleId: string | null;
  description: string;
  path: string[];
}

export interface PathCandidateMsg {
  /** 候选路径的简短标题。 */
  title: string;
  /** 节点 id 序列。 */
  path: string[];
  /** 节点标题拼接成的路径预览（"A → B → C"），由 store 生成，UI 直接显示。 */
  pathPreview: string;
  /** 候选的选择理由（可选）。 */
  reasoning?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  content: string;
  /** 单路径消息：场景/关键词 fallback 匹配出的路径。 */
  matchedPath?: string[];
  /** AI 多候选路径消息：一次返回多条可选路径，用户在气泡里单选高亮。 */
  pathCandidates?: PathCandidateMsg[];
  timestamp: number;
  /** 模型给出的思考过程（GLM-5 的 reasoning_content）。前端折叠显示。 */
  reasoning?: string;
  /** 路径节点的可读名（label → label → ...），仅用于展示。 */
  pathPreview?: string;
  /** 走了关键词兜底匹配（说明 LLM 没找到合适路径）。 */
  isFallback?: boolean;
  /** LLM 调用还在进行中。 */
  isPending?: boolean;
  /** 调用失败时的错误提示。 */
  isError?: boolean;
  /** AI 找到的路径所在项目 id（只有跨项目命中时才有值）。 */
  targetProjectId?: string;
  /** AI 找到的路径所在项目名（用于气泡展示）。 */
  targetProjectName?: string;
  /** 此消息是 AI 的纯文字答案（非路径），UI 隐藏"查看路径"按钮。 */
  isAnswer?: boolean;
  /** 此条消息使用的模型 id，用于多模型 A/B 观测。 */
  usedModel?: string;
}

export interface FlowProject {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  scenarioRules: ScenarioRule[];
}

export interface ProjectData {
  projects: FlowProject[];
  activeProjectId: string;
}

/** Legacy format for backward compatibility */
export interface LegacyProjectData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  scenarioRules: ScenarioRule[];
}
