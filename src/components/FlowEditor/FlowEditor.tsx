import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import { useFlowStore } from '../../hooks/useFlowStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import { CustomNode } from './CustomNode';
import { NodeEditPanel } from './NodeEditPanel';
import { NodeHistoryPanel } from './NodeHistoryPanel';
import { EdgeEditPanel } from './EdgeEditPanel';
import { Toolbar } from './Toolbar';

const nodeTypes = { custom: CustomNode };

export function FlowEditor() {
  const activeProject = useActiveProject();
  const { nodes, edges, id: activeProjectId } = activeProject;
  const setSessionViewport = useFlowStore((s) => s.setSessionViewport);
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const highlightedEdges = useFlowStore((s) => s.highlightedEdges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const setPrimarySelection = useFlowStore((s) => s.setPrimarySelection);
  const pathRecording = useFlowStore((s) => s.pathRecording);
  const togglePathNode = useFlowStore((s) => s.togglePathNode);
  const setPathDescription = useFlowStore((s) => s.setPathDescription);
  const savePathRecording = useFlowStore((s) => s.savePathRecording);
  const cancelPathRecording = useFlowStore((s) => s.cancelPathRecording);
  const deleteScenarioRule = useFlowStore((s) => s.deleteScenarioRule);
  const addNode = useFlowStore((s) => s.addNode);
  const duplicateNode = useFlowStore((s) => s.duplicateNode);
  const copySelection = useFlowStore((s) => s.copySelection);
  const cutSelection = useFlowStore((s) => s.cutSelection);
  const pasteClipboard = useFlowStore((s) => s.pasteClipboard);
  const undo = useFlowStore((s) => s.undo);
  const redo = useFlowStore((s) => s.redo);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const editingNodeId = useFlowStore((s) => s.editingNodeId);
  const historyNodeId = useFlowStore((s) => s.historyNodeId);
  const setHistoryNode = useFlowStore((s) => s.setHistoryNode);
  const { screenToFlowPosition, setViewport, getViewport, fitView } = useReactFlow();
  const prevSelectedRef = useRef<string | null>(null);
  const prevProjectRef = useRef<string | null>(null);

  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const lastClickTime = useRef(0);
  const lastClickPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    prevSelectedRef.current = selectedNodeId;
  }, [selectedNodeId]);

  // Per-project viewport memory: when switching tabs, snapshot the outgoing
  // project's viewport into the store, then restore the incoming project's
  // remembered viewport (or fitView on first visit). Without this, ReactFlow
  // keeps the previous viewport, which often points at empty space because
  // each project lives in its own coordinate range.
  // Skip on the very first render — the static `fitView` prop on <ReactFlow>
  // already handles initial mount, so doing it again here would just trigger
  // a redundant animation.
  useEffect(() => {
    const prev = prevProjectRef.current;
    prevProjectRef.current = activeProjectId;
    if (prev === null || prev === activeProjectId) return;

    setSessionViewport(prev, getViewport());

    // Wait one frame so React Flow has measured the new project's nodes
    // before we ask it to fit them.
    const raf = requestAnimationFrame(() => {
      const saved = useFlowStore.getState().sessionViewports[activeProjectId];
      if (saved) {
        setViewport(saved, { duration: 250 });
      } else {
        fitView({ padding: 0.2, duration: 300 });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeProjectId, setSessionViewport, setViewport, getViewport, fitView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (editingNodeId || editingEdgeId || historyNodeId) return;

      const cmd = e.metaKey || e.ctrlKey;

      if (cmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (cmd && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (cmd && (e.key === 'c' || e.key === 'C')) {
        // Skip the shortcut when the user is actually trying to copy
        // selected text on the page, otherwise we'd swallow the system
        // clipboard event and they'd get nothing.
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
        e.preventDefault();
        copySelection();
        return;
      }
      if (cmd && (e.key === 'x' || e.key === 'X')) {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
        e.preventDefault();
        cutSelection();
        return;
      }
      if (cmd && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (cmd && (e.key === 'd' || e.key === 'D') && selectedNodeId) {
        e.preventDefault();
        duplicateNode(selectedNodeId);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, editingNodeId, editingEdgeId, historyNodeId, duplicateNode, undo, redo, copySelection, cutSelection, pasteClipboard]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (pathRecording) {
        togglePathNode(node.id);
        return;
      }
      // Multi-select via shift / cmd / ctrl is handled by ReactFlow itself
      // (see `multiSelectionKeyCode` below). We just need to keep the
      // "primary" selection — used by the side editor panel — pointing at
      // the most recently clicked node, without disturbing the multi-set.
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        setPrimarySelection(node.id);
      } else {
        setSelectedNode(node.id);
      }
    },
    [setSelectedNode, setPrimarySelection, pathRecording, togglePathNode]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (pathRecording) return;
      const now = Date.now();
      const dx = event.clientX - lastClickPos.current.x;
      const dy = event.clientY - lastClickPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (now - lastClickTime.current < 400 && dist < 10) {
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addNode(position);
        lastClickTime.current = 0;
      } else {
        setSelectedNode(null);
        lastClickTime.current = now;
        lastClickPos.current = { x: event.clientX, y: event.clientY };
      }
    },
    [setSelectedNode, screenToFlowPosition, addNode, pathRecording]
  );

  const handleEdgeDoubleClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      setEditingEdgeId(edge.id);
    },
    []
  );

  const styledEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      style: highlightedEdges.includes(edge.id)
        ? { stroke: '#14b8a6', strokeWidth: 3 }
        : { stroke: '#475569', strokeWidth: 2 },
      animated: highlightedEdges.includes(edge.id),
      labelStyle: { fill: '#94a3b8', fontSize: 11, fontWeight: 500, cursor: 'pointer' },
      labelBgStyle: { fill: '#1a2332', fillOpacity: 0.9 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
    }));
  }, [edges, highlightedEdges]);

  const styledNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      className: highlightedPath.includes(node.id) ? 'highlighted' : '',
    }));
  }, [nodes, highlightedPath]);

  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <div className="flex-1 relative">
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          connectionRadius={30}
          panOnScroll
          zoomOnDoubleClick={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'default',
          }}
          deleteKeyCode={pathRecording ? [] : ['Backspace', 'Delete']}
          multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
          selectionKeyCode="Shift"
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
          <Controls position="bottom-left" />
          <MiniMap
            position="bottom-right"
            nodeStrokeWidth={3}
            pannable
            zoomable
            style={{ width: 160, height: 100 }}
          />
        </ReactFlow>

        {pathRecording && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-[#111827]/95 backdrop-blur-sm border-b border-teal-700/50">
            <div className="flex items-center gap-4" style={{ padding: '16px 24px' }}>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-sm font-medium text-teal-300">录制路径</span>
              </div>

              <input
                type="text"
                value={pathRecording.description}
                onChange={(e) => setPathDescription(e.target.value)}
                placeholder="输入场景描述..."
                className="bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                style={{ padding: '8px 14px', width: 200 }}
              />

              <span className="flex-1 text-sm text-slate-500">
                {pathRecording.path.length === 0
                  ? '点击流程图节点添加到路径'
                  : `已选择 ${pathRecording.path.length} 个节点`}
              </span>

              <div className="flex items-center shrink-0" style={{ gap: 10 }}>
                {pathRecording.ruleId && (
                  <button
                    onClick={() => { deleteScenarioRule(pathRecording.ruleId!); cancelPathRecording(); }}
                    className="text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                    style={{ padding: '8px 20px' }}
                  >
                    删除
                  </button>
                )}
                <button
                  onClick={cancelPathRecording}
                  className="text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  style={{ padding: '8px 20px' }}
                >
                  取消
                </button>
                <button
                  onClick={savePathRecording}
                  disabled={!pathRecording.description.trim() || pathRecording.path.length === 0}
                  className="text-sm text-white bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors"
                  style={{ padding: '8px 20px' }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {editingNodeId && <NodeEditPanel />}
      {historyNodeId && (
        <NodeHistoryPanel
          nodeId={historyNodeId}
          onClose={() => setHistoryNode(null)}
        />
      )}
      {editingEdgeId && (
        <EdgeEditPanel
          edgeId={editingEdgeId}
          onClose={() => setEditingEdgeId(null)}
        />
      )}
    </div>
  );
}
