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
 * 프로젝트 저장 데이터 정제 (직렬화 불가능한 필드 제거)
 */
function sanitizeProjectForStorage(project: StudioProject, stripBlobs = false): StudioProject {
  const sanitizedOverlay = project.overlayOptions
    ? {
        ...project.overlayOptions,
        introVideoFile: null,
        outroVideoFile: null,
      }
    : undefined;

  const sanitizeThumbnail = (url?: string) => (url && !url.startsWith('blob:') ? url : undefined);

  const sanitizedVideos = (project.videos || []).map((v) => ({
    id: v.id,
    name: v.name,
    sizeBytes: v.sizeBytes,
    duration: v.duration,
    width: v.width,
    height: v.height,
    status: v.status,
    segments: v.segments || [],
    metadataDate: v.metadataDate,
    recordedTimestamp: v.recordedTimestamp,
    latitude: v.latitude,
    longitude: v.longitude,
    locationName: v.locationName,
    thumbnailUrl: sanitizeThumbnail(v.thumbnailUrl),
    fileBlob: stripBlobs ? undefined : v.fileBlob,
  }));

  const sanitizedFinalResult = project.finalResult
    ? {
        ...project.finalResult,
        thumbnailUrl: sanitizeThumbnail(project.finalResult.thumbnailUrl),
        cleanThumbnailUrl: sanitizeThumbnail(project.finalResult.cleanThumbnailUrl),
        videoBlob: stripBlobs ? undefined : project.finalResult.videoBlob,
      }
    : null;

  return {
    ...project,
    updatedAt: Date.now(),
    thumbnailUrl: sanitizeThumbnail(project.thumbnailUrl),
    videos: sanitizedVideos,
    finalResult: sanitizedFinalResult,
    overlayOptions: sanitizedOverlay,
    customAudioBlob: stripBlobs ? undefined : project.customAudioBlob,
  };
}

/**
 * 단일 트랜잭션 실행 헬퍼
 */
async function executePut(db: IDBDatabase, data: StudioProject): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    // 모바일 기기에서 수백 MB의 비디오 Blob을 직렬화 및 플래시 스토리지에 기록할 때
    // 4초는 타임아웃이 발생하기 쉬우므로 25초로 안전 마진을 대폭 상향합니다.
    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error('IndexedDB put timed out (25s).'));
      }
    }, 25000);

    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      tx.oncomplete = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      tx.onerror = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          reject(tx.error || new Error('Transaction error while saving project.'));
        }
      };

      tx.onabort = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          reject(tx.error || new Error('Transaction aborted while saving project.'));
        }
      };

      store.put(data);
    } catch (err) {
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        reject(err);
      }
    }
  });
}

/**
 * 프로젝트 저장 또는 업데이트 (IndexedDB)
 * 대용량 Blob으로 인한 저장 실패(Quota/Clone) 시 메타데이터 우선 저장으로 안전하게 fallback
 */
export async function saveProject(project: StudioProject): Promise<void> {
  const db = await getDB();

  // 1차: Blob 포함 저장 시도
  try {
    const fullData = sanitizeProjectForStorage(project, false);
    await executePut(db, fullData);
    return;
  } catch (firstErr) {
    console.warn('saveProject: Full save with Blobs failed, attempting metadata-only fallback:', firstErr);
  }

  // 2차: QuotaExceeded 또는 Blob 복제 에러 발생 시 Blob 제외 후 메타데이터 우선 저장
  try {
    const safeData = sanitizeProjectForStorage(project, true);
    await executePut(db, safeData);
  } catch (secondErr) {
    console.error('saveProject: Metadata-only save also failed:', secondErr);
    throw secondErr;
  }
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
        const rawThumb = item.thumbnailUrl || (item.videos && item.videos[0]?.thumbnailUrl);
        const safeThumb = rawThumb && !rawThumb.startsWith('blob:') ? rawThumb : undefined;
        summaries.push({
          id: item.id,
          title: item.title || '이름 없는 작업',
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          thumbnailUrl: safeThumb,
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