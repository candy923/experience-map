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
import { EdgeEditPanel } from './EdgeEditPanel';
import { Toolbar } from './Toolbar';

const nodeTypes = { custom: CustomNode };

export function FlowEditor() {
  const { nodes, edges } = useActiveProject();
  const highlightedPath = useFlowStore((s) => s.highlightedPath);
  const highlightedEdges = useFlowStore((s) => s.highlightedEdges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const setSelectedNode = useFlowStore((s) => s.setSelectedNode);
  const toggleNodeSelection = useFlowStore((s) => s.toggleNodeSelection);
  const addNode = useFlowStore((s) => s.addNode);
  const duplicateNode = useFlowStore((s) => s.duplicateNode);
  const undo = useFlowStore((s) => s.undo);
  const redo = useFlowStore((s) => s.redo);
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const editingNodeId = useFlowStore((s) => s.editingNodeId);
  const { screenToFlowPosition } = useReactFlow();
  const prevSelectedRef = useRef<string | null>(null);

  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const lastClickTime = useRef(0);
  const lastClickPos = useRef({ x: 0, y: 0 });
  const copiedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    prevSelectedRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (editingNodeId || editingEdgeId) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedNodeId) {
        copiedNodeIdRef.current = selectedNodeId;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && copiedNodeIdRef.current) {
        duplicateNode(copiedNodeIdRef.current);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedNodeId) {
        e.preventDefault();
        duplicateNode(selectedNodeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, editingNodeId, editingEdgeId, duplicateNode, undo, redo]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (event.shiftKey) {
        toggleNodeSelection(node.id);
      } else {
        setSelectedNode(node.id);
      }
    },
    [setSelectedNode, toggleNodeSelection]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
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
    [setSelectedNode, screenToFlowPosition, addNode]
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
          zoomOnDoubleClick={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'default',
          }}
          deleteKeyCode={['Backspace', 'Delete']}
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
      </div>
      {editingNodeId && <NodeEditPanel />}
      {editingEdgeId && (
        <EdgeEditPanel
          edgeId={editingEdgeId}
          onClose={() => setEditingEdgeId(null)}
        />
      )}
    </div>
  );
}
