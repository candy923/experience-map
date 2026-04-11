import { useFlowStore } from './useFlowStore';
import type { FlowProject } from '../types';

export function useActiveProject(): FlowProject {
  const projects = useFlowStore((s) => s.projects);
  const activeProjectId = useFlowStore((s) => s.activeProjectId);
  return projects.find((p) => p.id === activeProjectId) || projects[0];
}
