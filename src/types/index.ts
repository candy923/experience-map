import type { Node, Edge } from '@xyflow/react';

export interface Hotspot {
  id: string;
  x: number;      // percentage 0-100
  y: number;
  width: number;
  height: number;
  targetNodeId: string;
  label?: string;
}

export interface FlowNodeData {
  title: string;
  description: string;
  screenshot?: string;
  hotspots?: Hotspot[];
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'system';
  content: string;
  matchedPath?: string[];
  timestamp: number;
}

export interface ProjectData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  scenarioRules: ScenarioRule[];
}
