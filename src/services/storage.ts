import type { ProjectData, LegacyProjectData, FlowProject } from '../types';
import { defaultProject } from '../data/defaultFlow';
import { supabase } from './supabase';

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

export function normalize(data: unknown): ProjectData | null {
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

// ─── Supabase 读写 ───

function rowToProject(row: Record<string, unknown>): FlowProject {
  return {
    id: row.id as string,
    name: row.name as string,
    nodes: (row.nodes as FlowProject['nodes']) || [],
    edges: (row.edges as FlowProject['edges']) || [],
    scenarioRules: (row.scenario_rules as FlowProject['scenarioRules']) || [],
  };
}

function projectToRow(p: FlowProject) {
  return {
    id: p.id,
    name: p.name,
    nodes: p.nodes,
    edges: p.edges,
    scenario_rules: p.scenarioRules,
    updated_at: new Date().toISOString(),
  };
}

const TIMEOUT_MS = 8000;

function raceTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    fn(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function loadFromSupabase(): Promise<ProjectData | null> {
  if (!supabase) return null;
  const db = supabase;
  try {
    const result = await raceTimeout(
      () => Promise.resolve(db.from('flow_projects').select('*').order('updated_at', { ascending: true })),
      TIMEOUT_MS,
    );
    if (!result || result.error || !result.data || result.data.length === 0) return null;
    const projects = (result.data as Record<string, unknown>[]).map(rowToProject).filter(isValidProject);
    if (projects.length === 0) return null;
    return { projects, activeProjectId: projects[0].id };
  } catch {
    return null;
  }
}

export async function saveToSupabase(projectData: ProjectData): Promise<boolean> {
  if (!supabase) return false;
  const db = supabase;
  try {
    const rows = projectData.projects.map(projectToRow);
    const result = await raceTimeout(
      () => Promise.resolve(db.from('flow_projects').upsert(rows, { onConflict: 'id' })),
      TIMEOUT_MS,
    );
    return !!result && !result.error;
  } catch {
    return false;
  }
}

export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  if (!supabase) return false;
  const db = supabase;
  try {
    const result = await raceTimeout(
      () => Promise.resolve(db.from('flow_projects').delete().eq('id', projectId)),
      TIMEOUT_MS,
    );
    return !!result && !result.error;
  } catch {
    return false;
  }
}

// ─── 综合加载（优先 Supabase → localStorage → 静态文件 → 默认值）───

export async function loadProjectDataAsync(): Promise<ProjectData> {
  const fromCloud = await loadFromSupabase();
  if (fromCloud) return fromCloud;

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
