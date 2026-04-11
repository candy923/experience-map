import type { ProjectData, LegacyProjectData, FlowProject } from '../types';
import { defaultProject } from '../data/defaultFlow';

const STORAGE_KEY = 'experience-map-data';

function getDefaults(): ProjectData {
  return {
    projects: [defaultProject],
    activeProjectId: defaultProject.id,
  };
}

function isValidProject(p: unknown): p is FlowProject {
  if (!p || typeof p !== 'object') return false;
  const proj = p as FlowProject;
  if (!proj.id || !proj.name) return false;
  if (!Array.isArray(proj.nodes) || proj.nodes.length === 0) return false;
  if (!Array.isArray(proj.edges)) return false;
  const firstNode = proj.nodes[0];
  if (!firstNode.id || !firstNode.position || typeof firstNode.position.x !== 'number') return false;
  return true;
}

function isNewFormat(data: unknown): data is ProjectData {
  if (!data || typeof data !== 'object') return false;
  const d = data as ProjectData;
  return Array.isArray(d.projects) && typeof d.activeProjectId === 'string';
}

function isLegacyFormat(data: unknown): data is LegacyProjectData {
  if (!data || typeof data !== 'object') return false;
  const d = data as LegacyProjectData;
  if (!Array.isArray(d.nodes) || d.nodes.length === 0) return false;
  if (!Array.isArray(d.edges)) return false;
  const firstNode = d.nodes[0];
  if (!firstNode.id || !firstNode.position || typeof firstNode.position.x !== 'number') return false;
  return true;
}

function normalize(data: unknown): ProjectData | null {
  if (isNewFormat(data)) {
    const valid = data.projects.filter(isValidProject);
    if (valid.length === 0) return null;
    return {
      projects: valid,
      activeProjectId: valid.find((p) => p.id === data.activeProjectId)?.id || valid[0].id,
    };
  }
  if (isLegacyFormat(data)) {
    const project: FlowProject = {
      id: 'default',
      name: '天天领',
      nodes: data.nodes,
      edges: data.edges,
      scenarioRules: data.scenarioRules || [],
    };
    return { projects: [project], activeProjectId: project.id };
  }
  return null;
}

export async function loadProjectDataAsync(): Promise<ProjectData> {
  try {
    const resp = await fetch('/data.json?' + Date.now());
    if (resp.ok) {
      const result = normalize(await resp.json());
      if (result) return result;
    }
  } catch { /* fall through */ }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const result = normalize(JSON.parse(raw));
      if (result) return result;
    }
  } catch { /* fall through */ }

  return getDefaults();
}

export function loadProjectData(): ProjectData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const result = normalize(JSON.parse(raw));
      if (result) return result;
    }
  } catch { /* ignore */ }
  return getDefaults();
}

export function saveToLocalStorage(data: ProjectData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export async function saveToFile(data: ProjectData): Promise<boolean> {
  try {
    const resp = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export function exportProjectJSON(data: ProjectData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `experience-map-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProjectJSON(file: File): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const result = normalize(raw);
        if (!result) throw new Error('Invalid project data format');
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
