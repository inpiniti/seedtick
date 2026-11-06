import type { StudioProject, StudioProjectSummary } from '../types/project.ts';
import { getStorageEstimate, getStoredStorageMode } from './storageQuotaService.ts';
import {
  saveVideoToOPFS,
  getVideoFromOPFS,
  saveFinalResultToOPFS,
  getFinalResultFromOPFS,
  deleteProjectOPFS,
  copyProjectOPFS,
  isOpfsAvailable,
} from './opfsStorage.ts';

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
    hasOpfsFile: v.hasOpfsFile,
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
    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error('IndexedDB put timed out.'));
      }
    }, 15000);

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
 * 프로젝트 저장 또는 업데이트 (OPFS 분리 저장 + IndexedDB 하이브리드)
 */
export async function saveProject(project: StudioProject): Promise<void> {
  const db = await getDB();
  const currentMode = project.storageMode || getStoredStorageMode();
  let hasOpfs = false;

  // 1. 경량 모드(lightweight)인 경우: 대용량 Blob 제외하고 타임라인/메타데이터만 초고속 저장
  if (currentMode === 'lightweight') {
    const safeData = sanitizeProjectForStorage({
      ...project,
      storageMode: 'lightweight',
      hasOpfsFiles: false,
    }, true);
    await executePut(db, safeData);
    return;
  }

  // 2. OPFS 지원 환경: 비디오 바이너리를 가상 파일시스템(OPFS)에 안전하게 기록
  if (isOpfsAvailable()) {
    try {
      const opfsTasks: Promise<boolean>[] = [];

      for (const v of project.videos || []) {
        if (v.fileBlob && v.fileBlob.size > 0) {
          opfsTasks.push(
            saveVideoToOPFS(project.id, v.id, v.fileBlob).then((ok) => {
              if (ok) v.hasOpfsFile = true;
              return ok;
            })
          );
        }
      }

      if (project.finalResult?.videoBlob && project.finalResult.videoBlob.size > 0) {
        opfsTasks.push(saveFinalResultToOPFS(project.id, project.finalResult.videoBlob));
      }

      const results = await Promise.all(opfsTasks);
      hasOpfs = results.some(Boolean);
    } catch (opfsErr) {
      console.warn('[projectStorage] OPFS storage partial error, falling back:', opfsErr);
    }
  }

  // 3. OPFS에 저장된 경우: IndexedDB에는 가벼운 메타데이터만 기록 (직렬화 오버헤드 0, OOM 방지)
  if (hasOpfs) {
    const opfsMetadataOnly = sanitizeProjectForStorage({
      ...project,
      storageMode: currentMode,
      hasOpfsFiles: true,
    }, true);
    await executePut(db, opfsMetadataOnly);
    return;
  }

  // 4. OPFS 미지원 환경: 사전 쿼터(Quota) 체크
  const estimate = await getStorageEstimate();
  if (estimate.isLowStorage) {
    console.warn('[projectStorage] Storage quota critically low, saving metadata-only to prevent crash.');
    const safeData = sanitizeProjectForStorage({
      ...project,
      storageMode: 'lightweight',
      hasOpfsFiles: false,
    }, true);
    await executePut(db, safeData);
    return;
  }

  // 5. IndexedDB 폴백: Blob 포함 저장 시도 후 실패 시 메타데이터 fallback
  try {
    const fullData = sanitizeProjectForStorage({
      ...project,
      storageMode: currentMode,
      hasOpfsFiles: false,
    }, false);
    await executePut(db, fullData);
  } catch (firstErr) {
    console.warn('[projectStorage] Full save with Blobs failed, falling back to metadata-only:', firstErr);
    const safeData = sanitizeProjectForStorage({
      ...project,
      storageMode: 'lightweight',
      hasOpfsFiles: false,
    }, true);
    await executePut(db, safeData);
  }
}

/**
 * 단일 프로젝트 상세 불러오기 (OPFS 및 IndexedDB 하이브리드 복원)
 */
export async function getProject(id: string): Promise<StudioProject | null> {
  const db = await getDB();
  const project: StudioProject | null = await new Promise((resolve, reject) => {
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

  if (!project) return null;

  // OPFS가 지원되고 바이너리 복원이 필요한 경우
  if (isOpfsAvailable()) {
    try {
      // 1. 각 비디오 Blob 복원
      if (project.videos && project.videos.length > 0) {
        await Promise.all(
          project.videos.map(async (v) => {
            if (!v.fileBlob || v.fileBlob.size === 0) {
              const opfsBlob = await getVideoFromOPFS(project.id, v.id);
              if (opfsBlob) {
                v.fileBlob = opfsBlob;
                v.hasOpfsFile = true;
              }
            }
          })
        );
      }

      // 2. 최종 결과물 비디오 Blob 복원
      if (project.finalResult && (!project.finalResult.videoBlob || project.finalResult.videoBlob.size === 0)) {
        const opfsFinalBlob = await getFinalResultFromOPFS(project.id);
        if (opfsFinalBlob) {
          project.finalResult.videoBlob = opfsFinalBlob;
        }
      }
    } catch (err) {
      console.warn('[projectStorage] Error loading blobs from OPFS:', err);
    }
  }

  return project;
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
          storageMode: item.storageMode,
          hasOpfsFiles: item.hasOpfsFiles,
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
 * 프로젝트 삭제 (IndexedDB 및 OPFS 동시 정리)
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
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

  // OPFS 파일 정리
  await deleteProjectOPFS(id);
}

/**
 * 프로젝트 복제 (IndexedDB 메타데이터 및 OPFS 파일 복제)
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

  await copyProjectOPFS(id, newId);
  await saveProject(duplicated);
  return duplicated;
}