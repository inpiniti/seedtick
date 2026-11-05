import type { StudioProject, StudioProjectSummary } from '../types/project.ts';

const DB_NAME = 'reportist_video_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const LAST_ACTIVE_KEY = 'reportist_video_last_active_project_id';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };
  });

  return dbPromise;
}

export function generateProjectId(): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `proj_${timestamp}_${rand}`;
}

export function getLastActiveProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setLastActiveProjectId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(LAST_ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(LAST_ACTIVE_KEY);
    }
  } catch {}
}

/**
 * 프로젝트 저장 또는 업데이트 (IndexedDB)
 */
export async function saveProject(project: StudioProject): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const updatedProject: StudioProject = {
      ...project,
      updatedAt: Date.now(),
    };

    const req = store.put(updatedProject);

    req.onsuccess = () => {
      resolve();
    };

    req.onerror = () => {
      reject(req.error || new Error('Failed to save project.'));
    };
  });
}

/**
 * 단일 프로젝트 상세 불러오기 (비디오 Blob 포함)
 */
export async function getProject(id: string): Promise<StudioProject | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => {
      resolve(req.result || null);
    };

    req.onerror = () => {
      reject(req.error || new Error('Failed to get project.'));
    };
  });
}

/**
 * 모든 프로젝트 목록 요약 (가벼운 메타데이터만 추출하여 최신 수정순 정렬)
 */
export async function getAllProjectSummaries(): Promise<StudioProjectSummary[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('by_updatedAt');
    const summaries: StudioProjectSummary[] = [];

    // 최신순 (prev) 방향으로 순회
    const req = index.openCursor(null, 'prev');

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const item = cursor.value as StudioProject;
        summaries.push({
          id: item.id,
          title: item.title || '이름 없는 작업',
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          thumbnailUrl: item.thumbnailUrl || (item.videos && item.videos[0]?.thumbnailUrl),
          duration: item.duration || 0,
          videoCount: item.videoCount || (item.videos ? item.videos.length : 0),
          hasResult: Boolean(item.finalResult && (item.finalResult.videoBlob || item.finalResult.duration > 0)),
          step: item.step || 'upload',
        });
        cursor.continue();
      } else {
        resolve(summaries);
      }
    };

    req.onerror = () => {
      reject(req.error || new Error('Failed to list projects.'));
    };
  });
}

/**
 * 프로젝트 삭제
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => {
      if (getLastActiveProjectId() === id) {
        setLastActiveProjectId(null);
      }
      resolve();
    };

    req.onerror = () => {
      reject(req.error || new Error('Failed to delete project.'));
    };
  });
}

/**
 * 프로젝트 복제
 */
export async function duplicateProject(id: string): Promise<StudioProject> {
  const original = await getProject(id);
  if (!original) {
    throw new Error('Project to duplicate was not found.');
  }

  const newId = generateProjectId();
  const duplicated: StudioProject = {
    ...original,
    id: newId,
    title: `${original.title} (사본)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveProject(duplicated);
  return duplicated;
}