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
import type { FlowNode, FlowEdge, ScenarioRule, ChatMessage, FlowProject, ProjectData, PathRecording } from '../types';
import { loadProjectData, loadProjectDataAsync, saveToLocalStorage, saveToFile } from '../services/storage';
import { matchScenario } from '../services/scenarioMatcher';

interface HistoryEntry {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

let _isDragging = false;
const MAX_HISTORY = 50;

// When loadData is invoked (typically from live-sync after an external
// edit), we've just imported content FROM disk — saving it back would be
// redundant work and, combined with any latency on the file watcher,
// enough to form a save→broadcast→load→save echo loop. Suppress one save.
let _suppressNextPersist = false;

interface FlowStore {
  projects: FlowProject[];
  activeProjectId: string;
  selectedNodeId: string | null;
  highlightedPath: string[];
  highlightedEdges: string[];
  chatMessages: ChatMessage[];
  editingNodeId: string | null;
  pathRecording: PathRecording | null;
  ready: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];

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
  toggleNodeSelection: (nodeId: string) => void;
  setEditingNode: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNode['data']>) => void;
  addNode: (position: { x: number; y: number }) => void;
  importNodes: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;

  previewEdgeSync: (projectId?: string) => { toAdd: number; toRemove: number };
  syncEdgesFromHotspots: (projectId?: string) => void;
  clearProjectEdges: (projectId?: string) => void;

  undo: () => void;
  redo: () => void;

  setHighlightedPath: (path: string[]) => void;
  clearHighlight: () => void;

  addScenarioRule: (rule: ScenarioRule) => void;
  updateScenarioRule: (id: string, updates: Partial<ScenarioRule>) => void;
  deleteScenarioRule: (id: string) => void;
  reorderScenarioRules: (fromIndex: number, toIndex: number) => void;

  startPathRecording: (rule?: ScenarioRule) => void;
  togglePathNode: (nodeId: string) => void;
  setPathDescription: (desc: string) => void;
  savePathRecording: () => void;
  cancelPathRecording: () => void;

  sendChatMessage: (content: string) => void;
  clearChat: () => void;

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

export const useFlowStore = create<FlowStore>((set, get) => {
  const pushHistory = () => {
    const project = get().getActiveProject();
    set({
      past: [...get().past.slice(-(MAX_HISTORY - 1)), { nodes: [...project.nodes], edges: [...project.edges] }],
      future: [],
    });
  };

  return {
  projects: initialData.projects,
  activeProjectId: initialData.activeProjectId,
  selectedNodeId: null,
  highlightedPath: [],
  highlightedEdges: [],
  chatMessages: [],
  editingNodeId: null,
  pathRecording: null,
  ready: false,
  past: [],
  future: [],

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
  },

  onNodesChange: (changes) => {
    // Use the non-select subset only for deciding whether to push a history
    // entry; pure selection toggles shouldn't pollute undo. But the actual
    // changes (including select) MUST be applied so ReactFlow can deselect
    // a node when the user clicks an edge — otherwise the node lingers as
    // "selected" in our store and gets killed alongside the edge on Delete.
    const nonSelect = changes.filter((c) => c.type !== 'select');

    const hasRemove = nonSelect.some((c) => c.type === 'remove');
    const hasDragStart = nonSelect.some((c) => c.type === 'position' && 'dragging' in c && c.dragging === true);
    const hasDragEnd = nonSelect.some((c) => c.type === 'position' && 'dragging' in c && c.dragging === false);

    if (hasRemove) {
      pushHistory();
    } else if (hasDragStart && !_isDragging) {
      pushHistory();
      _isDragging = true;
    }
    if (hasDragEnd) {
      _isDragging = false;
    }

    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: applyNodeChanges(changes, p.nodes),
      })),
    });
  },

  onEdgesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) {
      pushHistory();
    }
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        edges: applyEdgeChanges(changes, p.edges),
      })),
    });
  },

  onConnect: (connection) => {
    pushHistory();
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
      past: [],
      future: [],
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

  toggleNodeSelection: (nodeId) => {
    const { activeProjectId } = get();
    const project = get().getActiveProject();
    const node = project.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newSelected = !node.selected;
    set({
      selectedNodeId: newSelected ? nodeId : get().selectedNodeId,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((n) => n.id === nodeId ? { ...n, selected: newSelected } : n),
      })),
    });
  },

  setEditingNode: (nodeId) => {
    set({ editingNodeId: nodeId });
  },

  updateNodeData: (nodeId, data) => {
    pushHistory();
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
    pushHistory();
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

  importNodes: (newNodes, newEdges) => {
    if (newNodes.length === 0) return;
    pushHistory();
    const { activeProjectId } = get();
    set({
      selectedNodeId: newNodes[0].id,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: [...p.nodes, ...newNodes.map((n) => ({ ...n, selected: false }))],
        edges: [...p.edges, ...newEdges],
      })),
    });
  },

  duplicateNode: (nodeId) => {
    pushHistory();
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
    pushHistory();
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
    pushHistory();
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        edges: p.edges.filter((e) => e.id !== edgeId),
      })),
    });
  },

  updateEdgeLabel: (edgeId, label) => {
    pushHistory();
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => {
        const edge = p.edges.find((e) => e.id === edgeId);
        const hotspotId = edge?.data?.hotspotId;
        return {
          ...p,
          edges: p.edges.map((e) => (e.id === edgeId ? { ...e, label } : e)),
          // Write the new label back to the originating hotspot so the
          // in-phone tooltip stays in sync with the canvas edge label.
          nodes: hotspotId
            ? p.nodes.map((n) => {
                const hs = n.data.hotspots;
                if (!hs?.some((h) => h.id === hotspotId)) return n;
                return {
                  ...n,
                  data: {
                    ...n.data,
                    hotspots: hs.map((h) =>
                      h.id === hotspotId ? { ...h, label: label || undefined } : h
                    ),
                  },
                };
              })
            : p.nodes,
        };
      }),
    });
  },

  previewEdgeSync: (projectId) => {
    const { projects, activeProjectId } = get();
    const pid = projectId || activeProjectId;
    const project = projects.find((p) => p.id === pid);
    if (!project) return { toAdd: 0, toRemove: 0 };
    const nodeIds = new Set(project.nodes.map((n) => n.id));
    let toAdd = 0;
    for (const n of project.nodes) {
      for (const hs of n.data.hotspots || []) {
        // Cross-project hotspots don't produce edges (different canvas).
        if (hs.targetProjectId && hs.targetProjectId !== pid) continue;
        if (!nodeIds.has(hs.targetNodeId)) continue;
        toAdd += 1;
      }
    }
    const toRemove = project.edges.filter((e) => !!e.data?.hotspotId).length;
    return { toAdd, toRemove };
  },

  syncEdgesFromHotspots: (projectId) => {
    pushHistory();
    const { activeProjectId } = get();
    const pid = projectId || activeProjectId;
    set({
      projects: get().projects.map((p) => {
        if (p.id !== pid) return p;
        const nodeIds = new Set(p.nodes.map((n) => n.id));
        // Keep only manually drawn edges (those without a hotspotId tag).
        const manualEdges = p.edges.filter((e) => !e.data?.hotspotId);
        const derived: FlowEdge[] = [];
        for (const node of p.nodes) {
          for (const hs of node.data.hotspots || []) {
            if (hs.targetProjectId && hs.targetProjectId !== pid) continue;
            if (!nodeIds.has(hs.targetNodeId)) continue;
            derived.push({
              id: `e-${uuidv4().slice(0, 8)}`,
              source: node.id,
              target: hs.targetNodeId,
              type: 'default',
              label: hs.label,
              data: { hotspotId: hs.id },
            });
          }
        }
        return { ...p, edges: [...manualEdges, ...derived] };
      }),
    });
  },

  clearProjectEdges: (projectId) => {
    pushHistory();
    const { activeProjectId } = get();
    const pid = projectId || activeProjectId;
    set({
      projects: get().projects.map((p) =>
        p.id === pid ? { ...p, edges: [] } : p
      ),
    });
  },

  undo: () => {
    const { past, future, activeProjectId, selectedNodeId, editingNodeId } = get();
    if (past.length === 0) return;
    const project = get().getActiveProject();
    const current: HistoryEntry = { nodes: [...project.nodes], edges: [...project.edges] };
    const previous = past[past.length - 1];
    const nodeStillExists = (id: string | null) => id && previous.nodes.some((n) => n.id === id);
    set({
      past: past.slice(0, -1),
      future: [...future, current],
      selectedNodeId: nodeStillExists(selectedNodeId) ? selectedNodeId : null,
      editingNodeId: nodeStillExists(editingNodeId) ? editingNodeId : null,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: previous.nodes,
        edges: previous.edges,
      })),
    });
  },

  redo: () => {
    const { past, future, activeProjectId, selectedNodeId, editingNodeId } = get();
    if (future.length === 0) return;
    const project = get().getActiveProject();
    const current: HistoryEntry = { nodes: [...project.nodes], edges: [...project.edges] };
    const next = future[future.length - 1];
    const nodeStillExists = (id: string | null) => id && next.nodes.some((n) => n.id === id);
    set({
      past: [...past, current],
      future: future.slice(0, -1),
      selectedNodeId: nodeStillExists(selectedNodeId) ? selectedNodeId : null,
      editingNodeId: nodeStillExists(editingNodeId) ? editingNodeId : null,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: next.nodes,
        edges: next.edges,
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

  reorderScenarioRules: (fromIndex, toIndex) => {
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => {
        const rules = [...p.scenarioRules];
        const [moved] = rules.splice(fromIndex, 1);
        rules.splice(toIndex, 0, moved);
        return { ...p, scenarioRules: rules };
      }),
    });
  },

  startPathRecording: (rule) => {
    set({
      pathRecording: {
        ruleId: rule?.id || null,
        description: rule?.description.split('，')[0].split('。')[0] || '',
        path: rule?.path ? [...rule.path] : [],
      },
      highlightedPath: [],
      highlightedEdges: [],
    });
  },

  togglePathNode: (nodeId) => {
    const rec = get().pathRecording;
    if (!rec) return;
    const idx = rec.path.indexOf(nodeId);
    set({
      pathRecording: {
        ...rec,
        path: idx >= 0 ? rec.path.filter((id) => id !== nodeId) : [...rec.path, nodeId],
      },
    });
  },

  setPathDescription: (desc) => {
    const rec = get().pathRecording;
    if (!rec) return;
    set({ pathRecording: { ...rec, description: desc } });
  },

  savePathRecording: () => {
    const rec = get().pathRecording;
    if (!rec || !rec.description.trim() || rec.path.length === 0) return;
    const rule: ScenarioRule = {
      id: rec.ruleId || `rule-${uuidv4().slice(0, 8)}`,
      keywords: rec.description.split(/[，,、\s]+/).filter(Boolean),
      path: rec.path,
      description: rec.description.trim(),
    };
    const { activeProjectId } = get();
    const existing = get().getActiveProject().scenarioRules.find((r) => r.id === rule.id);
    if (existing) {
      set({
        pathRecording: null,
        projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
          ...p,
          scenarioRules: p.scenarioRules.map((r) => (r.id === rule.id ? rule : r)),
        })),
      });
    } else {
      set({
        pathRecording: null,
        projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
          ...p,
          scenarioRules: [...p.scenarioRules, rule],
        })),
      });
    }
  },

  cancelPathRecording: () => {
    set({ pathRecording: null });
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

  loadData: (data) => {
    const activeProject = data.projects.find((p) => p.id === data.activeProjectId) || data.projects[0];
    _suppressNextPersist = true;
    set({
      projects: data.projects,
      activeProjectId: activeProject.id,
      selectedNodeId: null,
      highlightedPath: [],
      highlightedEdges: [],
      past: [],
      future: [],
    });
  },
};});

let localTimer: ReturnType<typeof setTimeout>;
let fileTimer: ReturnType<typeof setTimeout>;
// Track the last serialized payload we wrote so we can skip redundant
// saves (e.g. projects reference churned but content is identical, which
// happens on selection toggles and live-sync replays). We compute this
// inside the debounced callback, not in the subscribe handler, so that
// stringifying a potentially multi-MB payload (base64 screenshots) only
// happens at most once per write window.
let lastPersistedSignature = '';

function persistIfChanged(): void {
  const state = useFlowStore.getState();
  const data = { projects: state.projects, activeProjectId: state.activeProjectId };
  const signature = JSON.stringify(data);
  if (signature === lastPersistedSignature) return;
  lastPersistedSignature = signature;
  saveToLocalStorage(data);
  void saveToFile(data);
}

useFlowStore.subscribe((state, prevState) => {
  if (state.projects === prevState.projects) return;
  if (_suppressNextPersist) {
    _suppressNextPersist = false;
    return;
  }
  // localStorage is cheap — update it quickly for reload safety.
  // The file write is the expensive one; debounce it longer to coalesce
  // rapid edits and to ride out any live-sync echo caused by an external
  // file change that we've just re-fetched.
  clearTimeout(localTimer);
  localTimer = setTimeout(persistIfChanged, 500);
  clearTimeout(fileTimer);
  fileTimer = setTimeout(persistIfChanged, 1500);
});
