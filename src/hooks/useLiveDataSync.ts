import { useEffect, useRef, useState } from 'react';
import { useFlowStore } from './useFlowStore';
import type { ProjectData, LegacyProjectData, FlowProject } from '../types';

const EVENT = 'flowmap:data-updated';

function isValidProject(p: unknown): p is FlowProject {
  if (!p || typeof p !== 'object') return false;
  const proj = p as FlowProject;
  return (
    !!proj.id &&
    !!proj.name &&
    Array.isArray(proj.nodes) &&
    Array.isArray(proj.edges) &&
    proj.nodes.length > 0
  );
}

function normalize(raw: unknown): ProjectData | null {
  if (!raw || typeof raw !== 'object') return null;
  const maybeNew = raw as ProjectData;
  if (Array.isArray(maybeNew.projects) && typeof maybeNew.activeProjectId === 'string') {
    const valid = maybeNew.projects.filter(isValidProject);
    if (valid.length === 0) return null;
    return {
      projects: valid,
      activeProjectId: valid.find((p) => p.id === maybeNew.activeProjectId)?.id || valid[0].id,
    };
  }
  const maybeLegacy = raw as LegacyProjectData;
  if (Array.isArray(maybeLegacy.nodes) && Array.isArray(maybeLegacy.edges)) {
    return {
      projects: [{ id: 'default', name: '默认', nodes: maybeLegacy.nodes, edges: maybeLegacy.edges, scenarioRules: maybeLegacy.scenarioRules || [] }],
      activeProjectId: 'default',
    };
  }
  return null;
}

/**
 * Subscribes to external data.json updates (e.g. from an AI agent or CLI)
 * via the dev-server HMR websocket, and refreshes the store live.
 *
 * In production builds (no import.meta.hot) this is a no-op.
 */
export function useLiveDataSync(): {
  lastSyncAt: number | null;
} {
  const loadData = useFlowStore((s) => s.loadData);
  const lastAppliedRef = useRef<number>(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  useEffect(() => {
    if (!import.meta.hot) return;

    const handler = async (payload: { at?: number } | undefined) => {
      const stamp = payload?.at ?? Date.now();
      if (stamp - lastAppliedRef.current < 500) return;
      lastAppliedRef.current = stamp;
      try {
        const resp = await fetch('/data.json?t=' + stamp);
        if (!resp.ok) return;
        const raw = await resp.json();
        const data = normalize(raw);
        if (!data) return;
        loadData(data);
        setLastSyncAt(Date.now());
      } catch (err) {
        console.error('Live sync failed:', err);
      }
    };

    import.meta.hot.on(EVENT, handler);
    return () => {
      import.meta.hot?.off(EVENT, handler);
    };
  }, [loadData]);

  return { lastSyncAt };
}
