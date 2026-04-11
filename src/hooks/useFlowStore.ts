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
import type { FlowNode, FlowEdge, ScenarioRule, ChatMessage, FlowProject, ProjectData } from '../types';
import {
  loadProjectData,
  loadProjectDataAsync,
  saveToLocalStorage,
  saveToSupabase,
  deleteProjectFromSupabase,
} from '../services/storage';
import { supabase } from '../services/supabase';
import { matchScenario } from '../services/scenarioMatcher';

interface FlowStore {
  projects: FlowProject[];
  activeProjectId: string;
  selectedNodeId: string | null;
  highlightedPath: string[];
  highlightedEdges: string[];
  chatMessages: ChatMessage[];
  editingNodeId: string | null;
  ready: boolean;
  syncing: boolean;
  syncError: boolean;

  getActiveProject: () => FlowProject;

  init: () => Promise<void>;
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;

  switchProject: (id: string) => void;
  addProject: (name: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;

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

  addScenarioRule: (rule: ScenarioRule) => void;
  updateScenarioRule: (id: string, updates: Partial<ScenarioRule>) => void;
  deleteScenarioRule: (id: string) => void;

  sendChatMessage: (content: string) => void;
  clearChat: () => void;

  save: () => Promise<boolean>;
  loadData: (data: ProjectData) => void;
}

const initialData = loadProjectData();

function updateActiveProject(
  projects: FlowProject[],
  activeId: string,
  updater: (p: FlowProject) => FlowProject
): FlowProject[] {
  return projects.map((p) => (p.id === activeId ? updater(p) : p));
}

let _ignoreNextRealtimeUpdate = false;

export const useFlowStore = create<FlowStore>((set, get) => ({
  projects: initialData.projects,
  activeProjectId: initialData.activeProjectId,
  selectedNodeId: null,
  highlightedPath: [],
  highlightedEdges: [],
  chatMessages: [],
  editingNodeId: null,
  ready: false,
  syncing: false,
  syncError: false,

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  },

  init: async () => {
    const data = await loadProjectDataAsync();
    const activeProject = data.projects.find((p) => p.id === data.activeProjectId) || data.projects[0];
    const firstId = activeProject.nodes[0]?.id || null;
    const projects = data.projects.map((p) =>
      p.id === activeProject.id
        ? { ...p, nodes: p.nodes.map((n) => ({ ...n, selected: n.id === firstId })) }
        : p
    );
    set({
      projects,
      activeProjectId: activeProject.id,
      selectedNodeId: firstId,
      ready: true,
    });

    if (supabase) {
      const initialSaveData: ProjectData = { projects: data.projects, activeProjectId: data.activeProjectId };
      saveToSupabase(initialSaveData);

      supabase
        .channel('flow_projects_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'flow_projects' },
          (payload) => {
            if (_ignoreNextRealtimeUpdate) {
              _ignoreNextRealtimeUpdate = false;
              return;
            }
            handleRealtimeChange(payload);
          }
        )
        .subscribe();
    }
  },

  onNodesChange: (changes) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: applyNodeChanges(changes, p.nodes),
      })),
    });
  },

  onEdgesChange: (changes) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        edges: applyEdgeChanges(changes, p.edges),
      })),
    });
  },

  onConnect: (connection) => {
    const { activeProjectId } = get();
    const newEdge: FlowEdge = {
      ...connection,
      id: `e-${uuidv4().slice(0, 8)}`,
      type: 'default',
    };
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        edges: addEdge(newEdge, p.edges),
      })),
    });
  },

  switchProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    const firstId = project.nodes[0]?.id || null;
    set({
      activeProjectId: id,
      selectedNodeId: firstId,
      highlightedPath: [],
      highlightedEdges: [],
      editingNodeId: null,
      projects: get().projects.map((p) =>
        p.id === id
          ? { ...p, nodes: p.nodes.map((n) => ({ ...n, selected: n.id === firstId })) }
          : p
      ),
    });
  },

  addProject: (name) => {
    const id = `proj-${uuidv4().slice(0, 8)}`;
    const newProject: FlowProject = {
      id,
      name,
      nodes: [{
        id: `node-${uuidv4().slice(0, 8)}`,
        type: 'custom',
        position: { x: 300, y: 200 },
        data: { title: name, description: '起始页面', nodeStyle: 'default' },
      }],
      edges: [],
      scenarioRules: [],
    };
    set({
      projects: [...get().projects, newProject],
    });
    get().switchProject(id);
  },

  renameProject: (id, name) => {
    set({
      projects: get().projects.map((p) =>
        p.id === id ? { ...p, name } : p
      ),
    });
  },

  deleteProject: (id) => {
    const remaining = get().projects.filter((p) => p.id !== id);
    if (remaining.length === 0) return;
    set({ projects: remaining });
    if (get().activeProjectId === id) {
      get().switchProject(remaining[0].id);
    }
    deleteProjectFromSupabase(id);
  },

  setSelectedNode: (nodeId) => {
    const { activeProjectId } = get();
    set({
      selectedNodeId: nodeId,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((n) => ({ ...n, selected: n.id === nodeId })),
      })),
    });
  },

  setEditingNode: (nodeId) => {
    set({ editingNodeId: nodeId });
  },

  updateNodeData: (nodeId, data) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        ),
      })),
    });
  },

  addNode: (position) => {
    const { activeProjectId } = get();
    const newNode: FlowNode = {
      id: `node-${uuidv4().slice(0, 8)}`,
      type: 'custom',
      position,
      data: { title: '新节点', description: '点击编辑', nodeStyle: 'default' },
    };
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: [...p.nodes, newNode],
      })),
    });
  },

  duplicateNode: (nodeId) => {
    const { activeProjectId } = get();
    const project = get().getActiveProject();
    const source = project.nodes.find((n) => n.id === nodeId);
    if (!source) return;
    const newNode: FlowNode = {
      id: `node-${uuidv4().slice(0, 8)}`,
      type: 'custom',
      position: { x: source.position.x + 40, y: source.position.y + 40 },
      data: { ...source.data },
    };
    set({
      selectedNodeId: newNode.id,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: [...p.nodes, newNode],
      })),
    });
  },

  deleteNode: (nodeId) => {
    const { activeProjectId } = get();
    set({
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      editingNodeId: get().editingNodeId === nodeId ? null : get().editingNodeId,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.filter((n) => n.id !== nodeId),
        edges: p.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      })),
    });
  },

  deleteEdge: (edgeId) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        edges: p.edges.filter((e) => e.id !== edgeId),
      })),
    });
  },

  updateEdgeLabel: (edgeId, label) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        edges: p.edges.map((e) => (e.id === edgeId ? { ...e, label } : e)),
      })),
    });
  },

  setHighlightedPath: (path) => {
    const project = get().getActiveProject();
    const highlightedEdges: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const edge = project.edges.find(
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

  addScenarioRule: (rule) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        scenarioRules: [...p.scenarioRules, rule],
      })),
    });
  },

  updateScenarioRule: (id, updates) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        scenarioRules: p.scenarioRules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      })),
    });
  },

  deleteScenarioRule: (id) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        scenarioRules: p.scenarioRules.filter((r) => r.id !== id),
      })),
    });
  },

  sendChatMessage: (content) => {
    const project = get().getActiveProject();
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const result = matchScenario(content, project.scenarioRules);

    let systemMsg: ChatMessage;
    if (result) {
      const { rule } = result;
      const pathNames = rule.path
        .map((id) => project.nodes.find((n) => n.id === id)?.data.title || id)
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
        content: '抱歉，没有找到匹配的场景。',
        timestamp: Date.now(),
      };
    }

    set({ chatMessages: [...get().chatMessages, userMsg, systemMsg] });
  },

  clearChat: () => {
    set({ chatMessages: [], highlightedPath: [], highlightedEdges: [] });
  },

  save: async () => {
    const { projects, activeProjectId } = get();
    const data: ProjectData = { projects, activeProjectId };
    saveToLocalStorage(data);
    _ignoreNextRealtimeUpdate = true;
    const cloudOk = await saveToSupabase(data);
    if (!cloudOk) {
      _ignoreNextRealtimeUpdate = false;
    }
    return cloudOk;
  },

  loadData: (data) => {
    const activeProject = data.projects.find((p) => p.id === data.activeProjectId) || data.projects[0];
    set({
      projects: data.projects,
      activeProjectId: activeProject.id,
      selectedNodeId: null,
      highlightedPath: [],
      highlightedEdges: [],
    });
  },
}));

// ─── 实时变更处理 ───

function handleRealtimeChange(payload: {
  eventType: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}) {
  const state = useFlowStore.getState();
  const { eventType } = payload;

  if (eventType === 'INSERT' || eventType === 'UPDATE') {
    const row = payload.new;
    if (!row) return;
    const updated: FlowProject = {
      id: row.id as string,
      name: row.name as string,
      nodes: (row.nodes as FlowProject['nodes']) || [],
      edges: (row.edges as FlowProject['edges']) || [],
      scenarioRules: (row.scenario_rules as FlowProject['scenarioRules']) || [],
    };

    const exists = state.projects.some((p) => p.id === updated.id);
    const projects = exists
      ? state.projects.map((p) => (p.id === updated.id ? updated : p))
      : [...state.projects, updated];

    useFlowStore.setState({ projects });
  }

  if (eventType === 'DELETE') {
    const row = payload.old;
    if (!row) return;
    const deletedId = row.id as string;
    const remaining = state.projects.filter((p) => p.id !== deletedId);
    if (remaining.length === 0) return;
    const updates: Partial<ReturnType<typeof useFlowStore.getState>> = { projects: remaining };
    if (state.activeProjectId === deletedId) {
      updates.activeProjectId = remaining[0].id;
    }
    useFlowStore.setState(updates);
  }
}

// ─── 自动保存（debounce 同步到 localStorage + Supabase）───

let debounceTimer: ReturnType<typeof setTimeout>;
useFlowStore.subscribe((state, prevState) => {
  if (state.projects !== prevState.projects) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const data: ProjectData = {
        projects: state.projects,
        activeProjectId: state.activeProjectId,
      };
      saveToLocalStorage(data);
      _ignoreNextRealtimeUpdate = true;
      useFlowStore.setState({ syncing: true, syncError: false });
      saveToSupabase(data).then((ok) => {
        if (!ok) _ignoreNextRealtimeUpdate = false;
        useFlowStore.setState({ syncing: false, syncError: !ok });
      });
    }, 800);
  }
});
