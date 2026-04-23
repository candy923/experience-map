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

export interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  content: string;
  matchedPath?: string[];
  timestamp: number;
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
