import type { ProjectData } from '../types';
import { defaultNodes, defaultEdges, defaultScenarioRules } from '../data/defaultFlow';

const STORAGE_KEY = 'experience-map-data';

function getDefaults(): ProjectData {
  return {
    nodes: defaultNodes,
    edges: defaultEdges,
    scenarioRules: defaultScenarioRules,
  };
}

function isValidProjectData(data: unknown): data is ProjectData {
  if (!data || typeof data !== 'object') return false;
  const d = data as ProjectData;
  if (!Array.isArray(d.nodes) || d.nodes.length === 0) return false;
  if (!Array.isArray(d.edges)) return false;
  const firstNode = d.nodes[0];
  if (!firstNode.id || !firstNode.position || typeof firstNode.position.x !== 'number') return false;
  return true;
}

export async function loadProjectDataAsync(): Promise<ProjectData> {
  try {
    const resp = await fetch('/data.json?' + Date.now());
    if (resp.ok) {
      const data = await resp.json();
      if (isValidProjectData(data)) return data;
    }
  } catch { /* fall through */ }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const local = JSON.parse(raw);
      if (isValidProjectData(local)) return local;
    }
  } catch { /* fall through */ }

  return getDefaults();
}

export function loadProjectData(): ProjectData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (isValidProjectData(data)) return data;
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
        const data = JSON.parse(reader.result as string);
        if (!isValidProjectData(data)) {
          throw new Error('Invalid project data format');
        }
        resolve(data);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
