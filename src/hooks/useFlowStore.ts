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
import type { FlowNode, FlowEdge, FlowEdgeData, ScenarioRule, ChatMessage, FlowProject, ProjectData, PathRecording, NodeVersion, NodeExperiment } from '../types';
import { loadProjectData, loadProjectDataAsync, saveToLocalStorage, saveToFile } from '../services/storage';
import { matchScenario } from '../services/scenarioMatcher';
import { planPath, limitedAll } from '../services/pathPlanner';

interface HistoryEntry {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface ClipboardData {
  sourceProjectId: string;
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

interface SessionViewport {
  x: number;
  y: number;
  zoom: number;
}

interface FlowStore {
  projects: FlowProject[];
  activeProjectId: string;
  selectedNodeId: string | null;
  highlightedPath: string[];
  highlightedEdges: string[];
  chatMessages: ChatMessage[];
  /** 当前选中的 LLM 模型 id，由 UI 下拉切换，localStorage 持久化。 */
  selectedModel: string;
  editingNodeId: string | null;
  historyNodeId: string | null;
  pathRecording: PathRecording | null;
  ready: boolean;
  past: HistoryEntry[];
  future: HistoryEntry[];
  clipboard: ClipboardData | null;
  /**
   * Per-project viewport remembered for the current session only. NOT persisted
   * to data.json — see persistIfChanged below. Used by FlowEditor to restore
   * the canvas position when the user switches between project tabs.
   */
  sessionViewports: Record<string, SessionViewport>;
  setSessionViewport: (projectId: string, viewport: SessionViewport) => void;

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
  setPrimarySelection: (nodeId: string | null) => void;
  toggleNodeSelection: (nodeId: string) => void;
  setEditingNode: (nodeId: string | null) => void;
  setHistoryNode: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Partial<FlowNode['data']>) => void;
  /** Patch only the history-panel "current" meta fields (currentNote / updatedAt) without
   * bumping the auto-managed `updatedAt` like a normal content edit would. */
  updateNodeCurrentMeta: (nodeId: string, patch: { currentNote?: string; updatedAt?: string }) => void;
  addNodeVersion: (nodeId: string, version: Omit<NodeVersion, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => void;
  updateNodeVersion: (nodeId: string, versionId: string, patch: Partial<Omit<NodeVersion, 'id' | 'createdAt'>>) => void;
  restoreNodeVersion: (nodeId: string, versionId: string, archiveCurrent?: boolean) => void;
  deleteNodeVersion: (nodeId: string, versionId: string) => void;
  addNodeExperiment: (nodeId: string, experiment: Omit<NodeExperiment, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => void;
  updateNodeExperiment: (nodeId: string, experimentId: string, patch: Partial<NodeExperiment>) => void;
  deleteNodeExperiment: (nodeId: string, experimentId: string) => void;
  addNode: (position: { x: number; y: number }) => void;
  importNodes: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  duplicateNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  updateEdgeLabel: (edgeId: string, label: string) => void;

  copySelection: () => number;
  cutSelection: () => number;
  pasteClipboard: () => number;

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

  sendChatMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  setSelectedModel: (model: string) => void;

  loadData: (data: ProjectData) => void;
}

const initialData = loadProjectData();

const DEFAULT_MODEL = 'qwen3.5-35b-a3b';
const MODEL_STORAGE_KEY = 'llm-model';

function loadInitialModel(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_MODEL;
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

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
  selectedModel: loadInitialModel(),
  editingNodeId: null,
  historyNodeId: null,
  pathRecording: null,
  ready: false,
  past: [],
  future: [],
  clipboard: null,
  sessionViewports: {},

  setSessionViewport: (projectId, viewport) => {
    set({
      sessionViewports: { ...get().sessionViewports, [projectId]: viewport },
    });
  },

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
    // Preserve the project's existing selection (lives on nodes[].selected).
    // Fall back to the first node only if nothing is currently flagged or the
    // flagged node was deleted while we were away (e.g. by live-sync).
    const existingSelected = project.nodes.find((n) => n.selected)?.id ?? null;
    const nextSelected = existingSelected ?? project.nodes[0]?.id ?? null;
    set({
      activeProjectId: id,
      selectedNodeId: nextSelected,
      highlightedPath: [],
      highlightedEdges: [],
      editingNodeId: null,
      historyNodeId: null,
      past: [],
      future: [],
      projects: existingSelected
        ? get().projects
        : get().projects.map((p) =>
            p.id === id
              ? { ...p, nodes: p.nodes.map((n) => ({ ...n, selected: n.id === nextSelected })) }
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
        data: { title: name, description: '起始页面', nodeStyle: 'default', updatedAt: new Date().toISOString() },
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
    const { [id]: _removed, ...restViewports } = get().sessionViewports;
    set({ projects: remaining, sessionViewports: restViewports });
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

  // Update only the "primary" selection (the one displayed in the side
  // panel) without altering each node's `selected` flag. Used during
  // shift-click multi-select where ReactFlow itself is responsible for
  // adding the clicked node to the selection set.
  setPrimarySelection: (nodeId) => {
    set({ selectedNodeId: nodeId });
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

  setHistoryNode: (nodeId) => {
    set({ historyNodeId: nodeId });
  },

  updateNodeData: (nodeId, data) => {
    pushHistory();
    const { activeProjectId } = get();
    const nowIso = new Date().toISOString();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data, updatedAt: nowIso } }
            : node
        ),
      })),
    });
  },

  updateNodeCurrentMeta: (nodeId, patch) => {
    pushHistory();
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  // Use `in` so an explicit `undefined` can clear the field.
                  ...('currentNote' in patch ? { currentNote: patch.currentNote } : {}),
                  ...('updatedAt' in patch ? { updatedAt: patch.updatedAt } : {}),
                },
              }
            : node
        ),
      })),
    });
  },

  addNodeVersion: (nodeId, version) => {
    pushHistory();
    const { activeProjectId } = get();
    const fullVersion: NodeVersion = {
      id: version.id || `ver-${uuidv4().slice(0, 8)}`,
      createdAt: version.createdAt || new Date().toISOString(),
      name: version.name,
      note: version.note,
      snapshot: version.snapshot,
    };
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  versions: [fullVersion, ...(node.data.versions || [])],
                },
              }
            : node
        ),
      })),
    });
  },

  updateNodeVersion: (nodeId, versionId, patch) => {
    pushHistory();
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const list = node.data.versions || [];
          return {
            ...node,
            data: {
              ...node.data,
              versions: list.map((v) =>
                v.id === versionId
                  ? {
                      ...v,
                      ...patch,
                      // Preserve immutable identity + createdAt, but allow
                      // patching the nested snapshot shallowly.
                      id: v.id,
                      createdAt: v.createdAt,
                      snapshot: patch.snapshot ? { ...v.snapshot, ...patch.snapshot } : v.snapshot,
                    }
                  : v
              ),
            },
          };
        }),
      })),
    });
  },

  restoreNodeVersion: (nodeId, versionId, archiveCurrent = true) => {
    pushHistory();
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const target = node.data.versions?.find((v) => v.id === versionId);
          if (!target) return node;
          // Auto-archive the current state as a new version so "restore" is
          // never destructive. This keeps the timeline honest when users
          // hop between versions to compare results.
          const archived: NodeVersion | null = archiveCurrent
            ? {
                id: `ver-${uuidv4().slice(0, 8)}`,
                name: '还原前自动保存',
                createdAt: new Date().toISOString(),
                note: `自动存档于还原「${target.name}」之前`,
                snapshot: {
                  title: node.data.title,
                  description: node.data.description,
                  screenshot: node.data.screenshot,
                  metrics: node.data.metrics,
                },
              }
            : null;
          const versions = archived
            ? [archived, ...(node.data.versions || [])]
            : node.data.versions;
          return {
            ...node,
            data: {
              ...node.data,
              title: target.snapshot.title ?? node.data.title,
              description: target.snapshot.description ?? node.data.description,
              screenshot: target.snapshot.screenshot,
              metrics: target.snapshot.metrics,
              updatedAt: new Date().toISOString(),
              versions,
            },
          };
        }),
      })),
    });
  },

  deleteNodeVersion: (nodeId, versionId) => {
    pushHistory();
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const next = (node.data.versions || []).filter((v) => v.id !== versionId);
          return {
            ...node,
            data: {
              ...node.data,
              versions: next.length > 0 ? next : undefined,
            },
          };
        }),
      })),
    });
  },

  addNodeExperiment: (nodeId, experiment) => {
    pushHistory();
    const { activeProjectId } = get();
    const full: NodeExperiment = {
      id: experiment.id || `exp-${uuidv4().slice(0, 8)}`,
      createdAt: experiment.createdAt || new Date().toISOString(),
      name: experiment.name,
      period: experiment.period,
      summary: experiment.summary,
      variants: experiment.variants,
      segments: experiment.segments,
    };
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  experiments: [full, ...(node.data.experiments || [])],
                },
              }
            : node
        ),
      })),
    });
  },

  updateNodeExperiment: (nodeId, experimentId, patch) => {
    pushHistory();
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const list = node.data.experiments || [];
          return {
            ...node,
            data: {
              ...node.data,
              experiments: list.map((e) => (e.id === experimentId ? { ...e, ...patch, id: e.id, createdAt: e.createdAt } : e)),
            },
          };
        }),
      })),
    });
  },

  deleteNodeExperiment: (nodeId, experimentId) => {
    pushHistory();
    const { activeProjectId } = get();
    set({
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          const next = (node.data.experiments || []).filter((e) => e.id !== experimentId);
          return {
            ...node,
            data: {
              ...node.data,
              experiments: next.length > 0 ? next : undefined,
            },
          };
        }),
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
      data: { title: '新节点', description: '点击编辑', nodeStyle: 'default', updatedAt: new Date().toISOString() },
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
      historyNodeId: get().historyNodeId === nodeId ? null : get().historyNodeId,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.filter((n) => n.id !== nodeId),
        edges: p.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      })),
    });
  },

  // Copy currently-selected nodes (falls back to `selectedNodeId` when no
  // multi-selection exists) into an in-memory clipboard. The clipboard
  // also captures any edges fully contained in the selection so that the
  // sub-graph round-trips. Returns the number of nodes copied.
  copySelection: () => {
    const project = get().getActiveProject();
    let selectedIds = new Set(project.nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedIds.size === 0 && get().selectedNodeId) {
      selectedIds = new Set([get().selectedNodeId!]);
    }
    if (selectedIds.size === 0) return 0;
    const nodes = project.nodes
      .filter((n) => selectedIds.has(n.id))
      .map((n) => JSON.parse(JSON.stringify(n)) as FlowNode);
    const edges = project.edges
      .filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
      .map((e) => JSON.parse(JSON.stringify(e)) as FlowEdge);
    set({
      clipboard: {
        sourceProjectId: project.id,
        nodes,
        edges,
      },
    });
    return nodes.length;
  },

  cutSelection: () => {
    const count = get().copySelection();
    if (count === 0) return 0;
    const clip = get().clipboard;
    if (!clip) return 0;
    pushHistory();
    const ids = new Set(clip.nodes.map((n) => n.id));
    const { activeProjectId, selectedNodeId, editingNodeId } = get();
    set({
      selectedNodeId: selectedNodeId && ids.has(selectedNodeId) ? null : selectedNodeId,
      editingNodeId: editingNodeId && ids.has(editingNodeId) ? null : editingNodeId,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: p.nodes.filter((n) => !ids.has(n.id)),
        edges: p.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
      })),
    });
    return count;
  },

  pasteClipboard: () => {
    const clip = get().clipboard;
    if (!clip || clip.nodes.length === 0) return 0;
    pushHistory();
    const { activeProjectId } = get();
    const sameProject = clip.sourceProjectId === activeProjectId;

    // Map original node IDs → freshly minted IDs so internal edges and
    // hotspots can be rewired into the pasted copy instead of pointing
    // back at the source nodes.
    const idMap = new Map<string, string>();
    for (const n of clip.nodes) {
      idMap.set(n.id, `node-${uuidv4().slice(0, 8)}`);
    }

    const newNodes: FlowNode[] = clip.nodes.map((n) => {
      const newId = idMap.get(n.id)!;
      const remappedHotspots = n.data.hotspots?.map((hs) => {
        const remappedTarget = idMap.get(hs.targetNodeId);
        if (remappedTarget) {
          return {
            ...hs,
            id: `hs-${uuidv4().slice(0, 8)}`,
            targetNodeId: remappedTarget,
            targetProjectId: undefined,
          };
        }
        // Hotspot points outside the copied set. When pasting into a
        // different project we anchor it back to the source project so
        // the link still resolves; same-project pastes keep the existing
        // (already-valid) reference.
        return {
          ...hs,
          id: `hs-${uuidv4().slice(0, 8)}`,
          targetProjectId: sameProject ? hs.targetProjectId : hs.targetProjectId || clip.sourceProjectId,
        };
      });
      return {
        ...n,
        id: newId,
        selected: true,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        data: {
          ...n.data,
          hotspots: remappedHotspots,
        },
      };
    });

    const newEdges: FlowEdge[] = clip.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => {
        // Drop the hotspotId tag — hotspots were re-issued with new IDs
        // above, so the old tag would be stale; the user can re-run
        // "从热区生成连线" to restore derived links if desired.
        let nextData: FlowEdgeData | undefined;
        if (e.data) {
          const cleaned: FlowEdgeData = { ...e.data };
          delete cleaned.hotspotId;
          if (Object.keys(cleaned).length > 0) nextData = cleaned;
        }
        return {
          ...e,
          id: `e-${uuidv4().slice(0, 8)}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
          data: nextData,
        };
      });

    const firstNewId = newNodes[0]?.id || null;
    set({
      selectedNodeId: firstNewId,
      projects: updateActiveProject(get().projects, activeProjectId, (p) => ({
        ...p,
        nodes: [
          ...p.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
          ...newNodes,
        ],
        edges: [...p.edges, ...newEdges],
      })),
    });
    return newNodes.length;
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

  sendChatMessage: async (content) => {
    const activeProject = get().getActiveProject();
    const currentModel = get().selectedModel;
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    const pendingId = uuidv4();
    const pendingMsg: ChatMessage = {
      id: pendingId,
      role: 'system',
      content: '正在思考...',
      timestamp: Date.now(),
      isPending: true,
      usedModel: currentModel,
    };
    set({ chatMessages: [...get().chatMessages, userMsg, pendingMsg] });

    const formatPath = (path: string[], projectNodes: FlowNode[]) =>
      path
        .map((id) => projectNodes.find((n) => n.id === id)?.data.title || id)
        .join(' → ');

    const replacePending = (patch: Partial<ChatMessage>) => {
      set({
        chatMessages: get().chatMessages.map((m) =>
          m.id === pendingId
            ? { ...m, ...patch, isPending: false, timestamp: Date.now() }
            : m
        ),
      });
    };

    const updatePendingContent = (text: string) => {
      set({
        chatMessages: get().chatMessages.map((m) =>
          m.id === pendingId ? { ...m, content: text } : m
        ),
      });
    };

    // 关键词兜底：在当前 tab 的 scenarioRules 里用关键词匹配。AI 全部未命中时调用。
    const runFallback = (note: string) => {
      const matched = matchScenario(content, activeProject.scenarioRules);
      if (matched) {
        const { rule } = matched;
        const pathNames = formatPath(rule.path, activeProject.nodes);
        replacePending({
          content: `${note}\n\n${rule.description}\n\n**关键词匹配路径：**\n${pathNames}`,
          matchedPath: rule.path,
          pathPreview: pathNames,
          isFallback: true,
        });
        get().setHighlightedPath(rule.path);
      } else {
        replacePending({
          content: `${note}\n\n关键词匹配也未命中任何场景。`,
          isFallback: true,
          isError: true,
        });
      }
    };

    // --- 第一步：当前 tab 调 LLM ----------------------------------------
    try {
      const result = await planPath(content, activeProject.nodes, activeProject.edges, {
        model: currentModel,
      });

      // 1a. 路径模式命中（可能多条候选）
      if (result.mode === 'path' && result.candidates.length > 0) {
        const candidatesWithPreview = result.candidates.map((c) => ({
          title: c.title,
          path: c.path,
          pathPreview: formatPath(c.path, activeProject.nodes),
          reasoning: c.reasoning,
        }));
        const content =
          candidatesWithPreview.length > 1
            ? `找到 ${candidatesWithPreview.length} 条相关路径`
            : `${result.reasoning}\n\n**${candidatesWithPreview[0].title}**\n${candidatesWithPreview[0].pathPreview}`;
        replacePending({
          content,
          matchedPath: candidatesWithPreview[0].path,
          pathCandidates: candidatesWithPreview,
          reasoning: result.thinking,
        });
        // 默认高亮第一条候选（推荐度最高）
        get().setHighlightedPath(candidatesWithPreview[0].path);
        return;
      }

      // 1b. 答案模式命中（直接文字回答，不高亮任何路径）
      if (result.mode === 'answer' && result.answer) {
        replacePending({
          content: result.answer,
          reasoning: result.thinking,
          isAnswer: true,
        });
        return;
      }

      // 1c. 当前 tab 返回 none → 进跨 tab 搜索
      const otherProjects = get().projects.filter((p) => p.id !== activeProject.id);

      if (otherProjects.length > 0) {
        updatePendingContent(`当前项目没找到，正在搜索其他 ${otherProjects.length} 个项目...`);

        const tasks = otherProjects.map(
          (proj) => () =>
            planPath(content, proj.nodes, proj.edges, { model: currentModel })
              .then((r) => ({ project: proj, result: r, error: null as unknown }))
              .catch((e) => ({ project: proj, result: null, error: e }))
        );
        const crossResults = await limitedAll(tasks, 3);

        // 跨 tab 命中：先看有没有 path 命中（路径类优先于答案类展示路径高亮）
        const pathHit = crossResults.find(
          (r) => r.result && r.result.mode === 'path' && r.result.candidates.length > 0
        );
        if (pathHit && pathHit.result) {
          const hitCandidates = pathHit.result.candidates.map((c) => ({
            title: c.title,
            path: c.path,
            pathPreview: formatPath(c.path, pathHit.project.nodes),
            reasoning: c.reasoning,
          }));
          const header =
            hitCandidates.length > 1
              ? `在【${pathHit.project.name}】中找到 ${hitCandidates.length} 条路径`
              : `${pathHit.result.reasoning}\n\n**${hitCandidates[0].title}**\n${hitCandidates[0].pathPreview}`;
          replacePending({
            content: header,
            matchedPath: hitCandidates[0].path,
            pathCandidates: hitCandidates,
            reasoning: pathHit.result.thinking,
            targetProjectId: pathHit.project.id,
            targetProjectName: pathHit.project.name,
          });
          return;
        }

        const answerHit = crossResults.find(
          (r) => r.result && r.result.mode === 'answer' && r.result.answer
        );
        if (answerHit && answerHit.result && answerHit.result.answer) {
          replacePending({
            content: answerHit.result.answer,
            reasoning: answerHit.result.thinking,
            isAnswer: true,
            targetProjectId: answerHit.project.id,
            targetProjectName: answerHit.project.name,
          });
          return;
        }
      }

      // --- 第二步：全部未命中 → 关键词兜底 -----------------------------
      const note = result.invalidReason
        ? `⚠️ AI 在所有项目中均未给出有效结果（当前项目: ${result.invalidReason}），已用关键词匹配兜底。`
        : `⚠️ AI 在所有项目中都没找到答案${result.reasoning ? `（${result.reasoning}）` : ''}，已用关键词匹配兜底。`;
      runFallback(note);
    } catch (err) {
      runFallback(`⚠️ AI 调用失败（${(err as Error).message}），已用关键词匹配兜底。`);
    }
  },

  clearChat: () => {
    set({ chatMessages: [], highlightedPath: [], highlightedEdges: [] });
  },

  setSelectedModel: (model) => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch {
      // localStorage 不可用时静默降级，只更新内存状态
    }
    set({ selectedModel: model });
  },

  loadData: (data) => {
    const activeProject = data.projects.find((p) => p.id === data.activeProjectId) || data.projects[0];
    _suppressNextPersist = true;
    const validIds = new Set(data.projects.map((p) => p.id));
    const prunedViewports = Object.fromEntries(
      Object.entries(get().sessionViewports).filter(([k]) => validIds.has(k))
    );
    set({
      projects: data.projects,
      activeProjectId: activeProject.id,
      selectedNodeId: null,
      highlightedPath: [],
      highlightedEdges: [],
      past: [],
      future: [],
      sessionViewports: prunedViewports,
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
  // `selected` is a runtime-only UI flag (drives ReactFlow highlight + our
  // PhonePreview). Strip it before serialization so:
  //   1) data.json stays clean — clicking different nodes no longer churns
  //      the file with `"selected": true` diffs.
  //   2) Refreshing the page resets all selections, because switchProject's
  //      fallback path picks the first node when nothing is flagged.
  const cleanedProjects = state.projects.map((p) => ({
    ...p,
    nodes: p.nodes.map(({ selected: _selected, ...rest }) => rest as (typeof p.nodes)[number]),
  }));
  const data = { projects: cleanedProjects, activeProjectId: state.activeProjectId };
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
