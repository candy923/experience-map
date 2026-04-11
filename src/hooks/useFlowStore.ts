import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import type { FlowNode, FlowEdge, ScenarioRule, ChatMessage } from '../types';
import { loadProjectData, loadProjectDataAsync, saveToLocalStorage, saveToFile } from '../services/storage';
import { matchScenario } from '../services/scenarioMatcher';

interface FlowStore {
  nodes: FlowNode[];
  edges: FlowEdge[];
  scenarioRules: ScenarioRule[];
  selectedNodeId: string | null;
  highlightedPath: string[];
  highlightedEdges: string[];
  chatMessages: ChatMessage[];
  editingNodeId: string | null;
  ready: boolean;

  init: () => Promise<void>;
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;

  setSelectedNode: (nodeId: string | null) => void;
  setEditingNode: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNode['data']>) => void;
  addNode: (position: { x: number; y: number }) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;

  setHighlightedPath: (path: string[]) => void;
  clearHighlight: () => void;

  sendChatMessage: (content: string) => void;
  clearChat: () => void;

  save: () => Promise<boolean>;
  loadData: (nodes: FlowNode[], edges: FlowEdge[], rules: ScenarioRule[]) => void;
}

const initialData = loadProjectData();

export const useFlowStore = create<FlowStore>((set, get) => ({
  nodes: initialData.nodes,
  edges: initialData.edges,
  scenarioRules: initialData.scenarioRules,
  selectedNodeId: null,
  highlightedPath: [],
  highlightedEdges: [],
  chatMessages: [],
  editingNodeId: null,
  ready: false,

  init: async () => {
    const data = await loadProjectDataAsync();
    set({
      nodes: data.nodes,
      edges: data.edges,
      scenarioRules: data.scenarioRules,
      ready: true,
    });
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    const newEdge: FlowEdge = {
      ...connection,
      id: `e-${uuidv4().slice(0, 8)}`,
      type: 'default',
    };
    set({ edges: addEdge(newEdge, get().edges) });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setEditingNode: (nodeId) => {
    set({ editingNodeId: nodeId });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    });
  },

  addNode: (position) => {
    const newNode: FlowNode = {
      id: `node-${uuidv4().slice(0, 8)}`,
      type: 'custom',
      position,
      data: {
        title: '新节点',
        description: '点击编辑',
        nodeStyle: 'default',
      },
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  duplicateNode: (nodeId) => {
    const source = get().nodes.find((n) => n.id === nodeId);
    if (!source) return;
    const newNode: FlowNode = {
      id: `node-${uuidv4().slice(0, 8)}`,
      type: 'custom',
      position: { x: source.position.x + 40, y: source.position.y + 40 },
      data: { ...source.data },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: newNode.id });
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      editingNodeId: get().editingNodeId === nodeId ? null : get().editingNodeId,
    });
  },

  deleteEdge: (edgeId) => {
    set({ edges: get().edges.filter((e) => e.id !== edgeId) });
  },

  updateEdgeLabel: (edgeId, label) => {
    set({
      edges: get().edges.map((e) =>
        e.id === edgeId ? { ...e, label } : e
      ),
    });
  },

  setHighlightedPath: (path) => {
    const { edges } = get();
    const highlightedEdges: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const edge = edges.find(
        (e) => e.source === path[i] && e.target === path[i + 1]
      );
      if (edge) highlightedEdges.push(edge.id);
    }
    set({ highlightedPath: path, highlightedEdges });
    if (path.length > 0) {
      set({ selectedNodeId: path[0] });
    }
  },

  clearHighlight: () => {
    set({ highlightedPath: [], highlightedEdges: [] });
  },

  sendChatMessage: (content) => {
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const result = matchScenario(content, get().scenarioRules);

    let systemMsg: ChatMessage;
    if (result) {
      const { rule } = result;
      const { nodes } = get();
      const pathNames = rule.path
        .map((id) => nodes.find((n) => n.id === id)?.data.title || id)
        .join(' → ');

      systemMsg = {
        id: uuidv4(),
        role: 'system',
        content: `${rule.description}\n\n**匹配路径：**\n${pathNames}`,
        matchedPath: rule.path,
        timestamp: Date.now(),
      };

      get().setHighlightedPath(rule.path);
    } else {
      systemMsg = {
        id: uuidv4(),
        role: 'system',
        content: '抱歉，没有找到匹配的场景。请尝试用不同的关键词描述，例如：\n• 新用户第一次绑卡\n• 用户被风控拦截\n• 短信验证码收不到\n• 信用卡绑定',
        timestamp: Date.now(),
      };
    }

    set({
      chatMessages: [...get().chatMessages, userMsg, systemMsg],
    });
  },

  clearChat: () => {
    set({ chatMessages: [], highlightedPath: [], highlightedEdges: [] });
  },

  save: async () => {
    const { nodes, edges, scenarioRules } = get();
    const data = { nodes, edges, scenarioRules };
    saveToLocalStorage(data);
    return saveToFile(data);
  },

  loadData: (nodes, edges, rules) => {
    set({
      nodes,
      edges,
      scenarioRules: rules,
      selectedNodeId: null,
      highlightedPath: [],
      highlightedEdges: [],
    });
  },
}));

// Auto-save to localStorage only (no file write, no page refresh)
let debounceTimer: ReturnType<typeof setTimeout>;
useFlowStore.subscribe((state, prevState) => {
  if (
    state.nodes !== prevState.nodes ||
    state.edges !== prevState.edges ||
    state.scenarioRules !== prevState.scenarioRules
  ) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      saveToLocalStorage({
        nodes: state.nodes,
        edges: state.edges,
        scenarioRules: state.scenarioRules,
      });
    }, 500);
  }
});
