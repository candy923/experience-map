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

export interface FlowNodeData {
  title: string;
  description: string;
  screenshot?: string;
  hotspots?: Hotspot[];
  metrics?: NodeMetric[];
  nodeStyle: 'default' | 'success' | 'error' | 'warning';
  [key: string]: unknown;
}

export type FlowNode = Node<FlowNodeData, 'custom'>;

export interface FlowEdgeData {
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
