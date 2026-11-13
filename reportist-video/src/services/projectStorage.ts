import type { StudioProject, StudioProjectSummary } from '../types/project.ts';
import { getStoredStorageMode } from './storageQuotaService.ts';
import {
  isMobileStorageEnvironment,
} from './deviceStoragePolicy.ts';
import {
  saveVideoToOPFS,
  getVideoFromOPFS,
  saveFinalResultToOPFS,
  getFinalResultFromOPFS,
  deleteProjectOPFS,
  copyProjectOPFS,
  isOpfsAvailable,
  purgeAllOPFSStorage,
  pruneOrphanProjectOPFS,
} from './opfsStorage.ts';

const DB_NAME = 'reportist_video_studio_db';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const MEDIA_STORE_NAME = 'project_media';
const LAST_ACTIVE_KEY = 'reportist_video_last_active_project_id';
const MEDIA_SPLIT_MIGRATION_KEY = 'reportist_video_media_split_v1';

// 대용량 바이너리는 전부 `project_media` 스토어에만 저장하고,
// `projects` 레코드에는 가벼운 JSON 메타데이터만 남긴다.
// - raw:<projectId>:<videoId>   원본 영상
// - final:<projectId>           최종 완성본 (레거시 키와 동일)
// - asset:<projectId>:<assetId> 인트로/아웃트로/커스텀 오디오 (assetId: 'intro' | 'outro' | 'audio')
export type ProjectMediaKind = 'raw' | 'final' | 'asset';
export type ProjectMediaAssetId = 'intro' | 'outro' | 'audio';

interface StoredMediaRecord {
  key: string;
  projectId: string;
  kind: ProjectMediaKind;
  itemId?: string;
  blob: Blob;
  size: number;
  updatedAt: number;
}

// 이 세션에서 이미 IndexedDB에 기록했거나(저장 시) 읽은(복원 시) 미디어를 추적해
// 자동 저장이 반복될 때마다 수백MB Blob을 다시 직렬화하는 것을 막는다.
const persistedMediaBlobs = new WeakMap<Blob, string>();
const persistedMediaKeys = new Map<string, number>();

function mediaKeyFor(kind: ProjectMediaKind, projectId: string, itemId?: string): string {
  if (kind === 'final') return `final:${projectId}`;
  return `${kind}:${projectId}:${itemId}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      dbPromise = null;
      reject(new Error('IndexedDB open timed out.'));
    }, 15000);

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        const mediaStore = db.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'key' });
        mediaStore.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        mediaStore.createIndex('by_projectId', 'projectId', { unique: false });
      }
    };

    request.onsuccess = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(request.result);
    };

    request.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };

    request.onblocked = () => {
      console.warn('[projectStorage] IndexedDB upgrade is blocked by another open tab.');
    };
  });

  return dbPromise;
}

/** 열린 DB 커넥션을 명시적으로 닫는다. (deleteDatabase 전제 조건) */
export async function closeDatabaseConnection(): Promise<void> {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    db.close();
  } catch {
    // 이미 닫혔거나 열리지 않은 경우 무시
  } finally {
    dbPromise = null;
  }
}

function deleteDatabaseAsync(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve();
      return;
    }
    const req = window.indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error || new Error('Failed to delete IndexedDB database.'));
    req.onblocked = () => {
      console.warn('[projectStorage] IndexedDB delete is blocked by another open tab.');
      // 다른 탭이 닫힐 때까지 기다리지 않고 성공 처리한다.
      resolve();
    };
  });
}

async function deleteAllCacheStorage(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((k) => window.caches.delete(k)));
  } catch (err) {
    console.warn('[projectStorage] CacheStorage clear failed:', err);
  }
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

export const SELECTED_MODEL_KEY = 'reportist_video_selected_model';
export const SELECTED_EFFORT_KEY = 'reportist_video_selected_effort';

export function getStoredSelectedModel(): string | null {
  try {
    return localStorage.getItem(SELECTED_MODEL_KEY);
  } catch {
    return null;
  }
}

export function setStoredSelectedModel(modelId: string | null): void {
  try {
    if (modelId) {
      localStorage.setItem(SELECTED_MODEL_KEY, modelId);
    } else {
      localStorage.removeItem(SELECTED_MODEL_KEY);
    }
  } catch {}
}

export function getStoredSelectedEffort(): string | null {
  try {
    return localStorage.getItem(SELECTED_EFFORT_KEY);
  } catch {
    return null;
  }
}

export function setStoredSelectedEffort(effort: string | null): void {
  try {
    if (effort) {
      localStorage.setItem(SELECTED_EFFORT_KEY, effort);
    } else {
      localStorage.removeItem(SELECTED_EFFORT_KEY);
    }
  } catch {}
}

// 썸네일 등 base64 데이터 URL이 메타데이터 레코드를 비대하게 만드는 것을 막기 위한 상한.
// (320px JPEG 기준 약 30~50KB → 400,000자면 약 300KB로 충분하다)
const MAX_THUMBNAIL_DATA_URL_CHARS = 400_000;
const MAX_AI_THUMBNAIL_RECOMMENDATIONS = 24;

function clampDataUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('data:') && url.length > MAX_THUMBNAIL_DATA_URL_CHARS) {
    return undefined;
  }
  return url;
}

/** 프로젝트 메타데이터(썸네일 등) 경량화 */
function clampProjectThumbnails(project: StudioProject): void {
  project.thumbnailUrl = clampDataUrl(project.thumbnailUrl);

  for (const video of project.videos || []) {
    video.thumbnailUrl = clampDataUrl(video.thumbnailUrl);
  }

  if (project.finalResult) {
    project.finalResult.thumbnailUrl = clampDataUrl(project.finalResult.thumbnailUrl);
    project.finalResult.cleanThumbnailUrl = clampDataUrl(project.finalResult.cleanThumbnailUrl);
    project.finalResult.bestThumbnailCleanDataUrl = clampDataUrl(
      project.finalResult.bestThumbnailCleanDataUrl
    );
    if (project.finalResult.aiThumbnailRecommendations) {
      project.finalResult.aiThumbnailRecommendations = project.finalResult.aiThumbnailRecommendations
        .slice(0, MAX_AI_THUMBNAIL_RECOMMENDATIONS)
        .map((rec) => ({
          ...rec,
          cleanDataUrl: clampDataUrl(rec.cleanDataUrl) || '',
        }));
    }
  }
}

/**
 * 프로젝트 저장 데이터 정제.
 * `projects` 레코드에는 절대 대용량 Blob을 남기지 않는다.
 * (미디어 바이너리는 별도 `project_media` 스토어에 분리 저장)
 */
function sanitizeProjectForStorage(project: StudioProject): StudioProject {
  const sanitizedOverlay = project.overlayOptions
    ? {
        ...project.overlayOptions,
        introVideoFile: null,
        outroVideoFile: null,
      }
    : undefined;

  const sanitizeThumbnail = (url?: string) => clampDataUrl(url && !url.startsWith('blob:') ? url : undefined);

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
    fileBlob: undefined,
    hasOpfsFile: v.hasOpfsFile,
  }));

  const sanitizedFinalResult = project.finalResult
    ? {
        ...project.finalResult,
        thumbnailUrl: sanitizeThumbnail(project.finalResult.thumbnailUrl),
        cleanThumbnailUrl: sanitizeThumbnail(project.finalResult.cleanThumbnailUrl),
        bestThumbnailCleanDataUrl: sanitizeThumbnail(project.finalResult.bestThumbnailCleanDataUrl),
        videoBlob: undefined,
      }
    : null;

  const sanitized: StudioProject = {
    ...project,
    updatedAt: Date.now(),
    thumbnailUrl: sanitizeThumbnail(project.thumbnailUrl),
    videos: sanitizedVideos,
    finalResult: sanitizedFinalResult,
    overlayOptions: sanitizedOverlay,
    selectedLibraryTrackId: project.selectedLibraryTrackId,
    customAudioBlob: undefined,
    customAudioName: project.customAudioBlob ? project.customAudioName : undefined,
    introVideoBlob: undefined,
    introVideoName: project.introVideoBlob ? project.introVideoName : undefined,
    outroVideoBlob: undefined,
    outroVideoName: project.outroVideoBlob ? project.outroVideoName : undefined,
  };

  clampProjectThumbnails(sanitized);
  return sanitized;
}

/** 프로젝트가 차지하는 미디어(프로젝트당) 총 바이트 계산 — 화면 표시/統計용 */
function computeMediaBytes(project: StudioProject): number {
  let total = 0;
  for (const v of project.videos || []) {
    total += v.fileBlob?.size || v.sizeBytes || 0;
  }
  total += project.finalResult?.videoBlob?.size || 0;
  total += project.customAudioBlob?.size || 0;
  total += project.introVideoBlob?.size || 0;
  total += project.outroVideoBlob?.size || 0;
  return total;
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

function executeMediaPut(db: IDBDatabase, record: StoredMediaRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save project media.'));
    tx.onabort = () => reject(tx.error || new Error('Project media transaction aborted.'));
    tx.objectStore(MEDIA_STORE_NAME).put(record);
  });
}

function executeMediaDelete(db: IDBDatabase, key: string): Promise<void> {
  persistedMediaKeys.delete(key);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete project media.'));
    tx.onabort = () => reject(tx.error || new Error('Project media delete aborted.'));
    tx.objectStore(MEDIA_STORE_NAME).delete(key);
  });
}

function getMediaRecord(db: IDBDatabase, key: string): Promise<StoredMediaRecord | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
    const req = tx.objectStore(MEDIA_STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as StoredMediaRecord | undefined) || null);
    req.onerror = () => reject(req.error || new Error('Failed to read project media.'));
  });
}

function markMediaPersisted(blob: Blob, key: string, size: number): void {
  persistedMediaBlobs.set(blob, key);
  persistedMediaKeys.set(key, size);
}

/**
 * 미디어 Blob을 project_media 스토어에 기록한다.
 * 이미 기록했음이 확인된 Blob/키는 다시 쓰지 않는다.
 * (final은 새 내보내기 시 항상 덮어쓴다.)
 */
async function saveProjectMedia(
  db: IDBDatabase,
  kind: ProjectMediaKind,
  projectId: string,
  itemId: string | undefined,
  blob: Blob
): Promise<void> {
  const key = mediaKeyFor(kind, projectId, itemId);

  // 이 세션에서 같은 Blob을 이미 기록했으면 스킵 (WeakMap identity 비교)
  if (persistedMediaBlobs.get(blob) === key) return;

  // raw/asset은 동일 크기 기존 레코드가 있으면 같은 내용으로 간주하고 스킵.
  // (다른 내용으로 교체되는 경로는 모두 media 키를 먼저 삭제하므로 안전)
  if (kind !== 'final' && persistedMediaKeys.get(key) === blob.size) return;

  await executeMediaPut(db, {
    key,
    projectId,
    kind,
    itemId,
    blob,
    size: blob.size,
    updatedAt: Date.now(),
  });
  markMediaPersisted(blob, key, blob.size);
}

/** 특정 프로젝트의 모든 미디어 레코드를 키만 읽어 일괄 삭제한다. (Blob 본문은 읽지 않음) */
function deleteProjectMediaByProjectId(db: IDBDatabase, projectId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE_NAME);
    const index = store.index('by_projectId');
    const req = index.openKeyCursor(IDBKeyRange.only(projectId));
    let deleted = 0;

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      persistedMediaKeys.delete(String(cursor.primaryKey));
      store.delete(cursor.primaryKey);
      deleted += 1;
      cursor.continue();
    };

    req.onerror = () => reject(req.error || new Error('Failed to iterate project media.'));
    tx.onerror = () => reject(tx.error || new Error('Project media cleanup transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Project media cleanup transaction aborted.'));
    tx.oncomplete = () => resolve(deleted);
  });
}

/**
 * 프로젝트 저장 또는 업데이트.
 * 프로젝트 `projects` 레코드에는 메타데이터만 남기고,
 * 원본 영상/완성본/에셋 Blob은 `project_media`에 쓰기-once 원칙으로 저장한다.
 */
export async function saveProject(project: StudioProject): Promise<void> {
  const db = await getDB();
  const currentMode = project.storageMode || getStoredStorageMode();
  const isLightweight = currentMode === 'lightweight';
  const projectId = project.id;

  const videoList = project.videos || [];
  // 데스크톱 + OPFS 지원 환경은 OPFS에 바이너리를 쓰고,
  // 그 외(모바일 포함)에는 IndexedDB project_media에 저장한다.
  const useOpfs = !isLightweight && isOpfsAvailable() && !isMobileStorageEnvironment();

  let hasOpfs = false;

  if (!isLightweight) {
    try {
      // 1. 원본 영상
      if (useOpfs) {
        let anySaved = false;
        for (const v of videoList) {
          if (v.hasOpfsFile) {
            anySaved = true;
            continue;
          }
          if (v.fileBlob && v.fileBlob.size > 0) {
            const ok = await saveVideoToOPFS(projectId, v.id, v.fileBlob);
            if (ok) {
              v.hasOpfsFile = true;
              anySaved = true;
            } else {
              break;
            }
          }
        }
        hasOpfs = anySaved;
      } else {
        for (const v of videoList) {
          if (v.fileBlob && v.fileBlob.size > 0) {
            await saveProjectMedia(db, 'raw', projectId, v.id, v.fileBlob);
          }
        }
      }

      // 2. 최종 완성본
      const finalBlob = project.finalResult?.videoBlob;
      if (finalBlob && finalBlob.size > 0) {
        if (useOpfs) {
          const finalKey = mediaKeyFor('final', projectId);
          if (persistedMediaBlobs.get(finalBlob) !== finalKey) {
            const finalSaved = await saveFinalResultToOPFS(projectId, finalBlob);
            if (finalSaved) {
              hasOpfs = true;
              persistedMediaBlobs.set(finalBlob, finalKey);
            }
          } else {
            hasOpfs = true;
          }
        } else {
          await saveProjectMedia(db, 'final', projectId, undefined, finalBlob);
        }
      }

      // 3. 인트로/아웃트로/커스텀 오디오 (수십MB 이하 에셋)
      const audio = project.customAudioBlob;
      if (audio && audio.size > 0 && audio.size < 50 * 1024 * 1024) {
        if (!useOpfs) await saveProjectMedia(db, 'asset', projectId, 'audio', audio);
      }
      const intro = project.introVideoBlob;
      if (intro && intro.size > 0 && intro.size < 100 * 1024 * 1024) {
        if (!useOpfs) await saveProjectMedia(db, 'asset', projectId, 'intro', intro);
      }
      const outro = project.outroVideoBlob;
      if (outro && outro.size > 0 && outro.size < 100 * 1024 * 1024) {
        if (!useOpfs) await saveProjectMedia(db, 'asset', projectId, 'outro', outro);
      }
    } catch (mediaErr) {
      // 미디어 저장(쿼터 초과 등)에 실패해도 편집 메타데이터는 보존한다.
      console.warn('[projectStorage] Media persistence failed, saving metadata only:', mediaErr);
    }
  }

  const mediaBytes = isLightweight ? 0 : computeMediaBytes(project);

  const metadataOnly = sanitizeProjectForStorage({
    ...project,
    storageMode: isLightweight ? 'lightweight' : currentMode,
    hasOpfsFiles: hasOpfs,
    mediaBytes,
  });

  await executePut(db, metadataOnly);
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

  // 1. 원본 영상 Blob 복원 — OPFS 우선, 없으면 IndexedDB project_media
  if (project.videos && project.videos.length > 0) {
    await Promise.all(
      project.videos.map(async (v) => {
        if (v.fileBlob && v.fileBlob.size > 0) {
          // 레거시 레코드에 인라인 Blob이 남아 있는 경우: 복원 상태로 간주
          markMediaPersisted(v.fileBlob, mediaKeyFor('raw', project.id, v.id), v.fileBlob.size);
          return;
        }
        if (isOpfsAvailable()) {
          try {
            const opfsBlob = await getVideoFromOPFS(project.id, v.id);
            if (opfsBlob) {
              v.fileBlob = opfsBlob;
              v.hasOpfsFile = true;
              return;
            }
          } catch (err) {
            console.warn('[projectStorage] Error restoring video from OPFS:', err);
          }
        }
        try {
          const media = await getMediaRecord(db, mediaKeyFor('raw', project.id, v.id));
          if (media?.blob && media.blob.size > 0) {
            v.fileBlob = media.blob;
            markMediaPersisted(media.blob, media.key, media.size);
          }
        } catch (err) {
          console.warn('[projectStorage] Error restoring video from project_media:', err);
        }
      })
    );
  }

  // 2. 최종 완성본 Blob 복원 — OPFS 우선, 없으면 IndexedDB project_media
  if (project.finalResult && (!project.finalResult.videoBlob || project.finalResult.videoBlob.size === 0)) {
    let finalBlob: Blob | null = null;
    if (isOpfsAvailable()) {
      try {
        finalBlob = await getFinalResultFromOPFS(project.id);
      } catch (err) {
        console.warn('[projectStorage] Error restoring final video from OPFS:', err);
      }
    }
    if (!finalBlob) {
      try {
        const media = await getMediaRecord(db, mediaKeyFor('final', project.id));
        if (media?.blob && media.blob.size > 0) {
          finalBlob = media.blob;
          markMediaPersisted(media.blob, media.key, media.size);
        }
      } catch (err) {
        console.warn('[projectStorage] Error restoring final video from project_media:', err);
      }
    } else {
      markMediaPersisted(finalBlob, mediaKeyFor('final', project.id), finalBlob.size);
    }
    if (finalBlob) {
      project.finalResult.videoBlob = finalBlob;
    }
  } else if (project.finalResult?.videoBlob) {
    markMediaPersisted(
      project.finalResult.videoBlob,
      mediaKeyFor('final', project.id),
      project.finalResult.videoBlob.size
    );
  }

  // 3. 인트로/아웃트로/커스텀 오디오 복원
  const assetRestores: Array<{ field: 'customAudioBlob' | 'introVideoBlob' | 'outroVideoBlob'; assetId: ProjectMediaAssetId }> = [
    { field: 'customAudioBlob', assetId: 'audio' },
    { field: 'introVideoBlob', assetId: 'intro' },
    { field: 'outroVideoBlob', assetId: 'outro' },
  ];
  for (const { field, assetId } of assetRestores) {
    const existing = project[field];
    if (existing && existing.size > 0) {
      markMediaPersisted(existing, mediaKeyFor('asset', project.id, assetId), existing.size);
      continue;
    }
    try {
      const media = await getMediaRecord(db, mediaKeyFor('asset', project.id, assetId));
      if (media?.blob && media.blob.size > 0) {
        (project[field] as Blob) = media.blob;
        markMediaPersisted(media.blob, media.key, media.size);
      }
    } catch (err) {
      console.warn('[projectStorage] Error restoring asset from project_media:', err);
    }
  }

  // 레거시 레코드에 인라인으로 남아 있는 에셋 Blob 정리 등록
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
        // mediaBytes가 없는 레거시 레코드는 인라인 Blob 크기로 추정한다.
        const legacyMediaBytes =
          (item.videos || []).reduce((sum, v) => sum + (v.fileBlob?.size || 0), 0) +
          (item.finalResult?.videoBlob?.size || 0) +
          (item.customAudioBlob?.size || 0) +
          (item.introVideoBlob?.size || 0) +
          (item.outroVideoBlob?.size || 0);
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
          mediaBytes: item.mediaBytes ?? legacyMediaBytes,
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

/** projects 스토어의 남은 레코드 수 */
function countProjects(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to count projects.'));
  });
}

/** OPFS + CacheStorage + IndexedDB를 모두 비우는 최종 정리 (데이터 전부 삭제) */
export async function wipeAllAppData(): Promise<void> {
  await closeDatabaseConnection();
  await deleteDatabaseAsync();
  await purgeAllOPFSStorage().catch((err) => {
    console.warn('[projectStorage] OPFS purge failed:', err);
  });
  await deleteAllCacheStorage();
  try {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  } catch {}
}

/**
 * 프로젝트 삭제 (IndexedDB 메타데이터 + project_media 연쇄 삭제 + OPFS 정리)
 * 마지막 프로젝트가 삭제되면 DB 자체를 지워 SQLite/고아 Blob 잔여 용량까지 회수한다.
 */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();

  // 1. project_media 연쇄 삭제 (키만 순회, Blob 본문은 읽지 않음)
  try {
    await deleteProjectMediaByProjectId(db, id);
  } catch (err) {
    console.warn('[projectStorage] Failed to delete project media:', err);
  }

  // 2. projects 레코드 삭제
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

  // 3. OPFS 파일 정리
  await deleteProjectOPFS(id).catch((err) => {
    console.warn('[projectStorage] Failed to delete project OPFS files:', err);
  });

  // 4. 남은 프로젝트가 0개면 DB/OPFS/캐시를 완전히 초기화해 디스크 잔여 용량을 회수
  try {
    const remaining = await countProjects(db);
    if (remaining === 0) {
      await wipeAllAppData();
    }
  } catch (err) {
    console.warn('[projectStorage] Failed to reset empty database:', err);
  }
}

/**
 * 프로젝트 미디어 항목 1개 삭제 (편집 중 개별 영상 제거, 재연결 시 갱신용)
 */
export async function deleteProjectMediaItem(
  projectId: string,
  kind: ProjectMediaKind,
  itemId?: string
): Promise<void> {
  const db = await getDB();
  await executeMediaDelete(db, mediaKeyFor(kind, projectId, itemId));
}

/**
 * 프로젝트 복제 (IndexedDB 메타데이터 및 미디어 복제)
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

  // OPFS 파일 복제 (OPFS 미사용 환경에서는 즉시 no-op)
  await copyProjectOPFS(id, newId);
  await saveProject(duplicated);
  return duplicated;
}

/**
 * 앱 내부 저장소 통계 (프로젝트 수 + project_media 합산 바이트)
 */
export async function getAppStorageStats(): Promise<{
  projectCount: number;
  mediaCount: number;
  mediaBytes: number;
}> {
  const db = await getDB();

  const projectCount = await countProjects(db);

  const { mediaCount, mediaBytes } = await new Promise<{ mediaCount: number; mediaBytes: number }>(
    (resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const index = tx.objectStore(MEDIA_STORE_NAME).index('by_projectId');
      const req = index.openCursor();
      let count = 0;
      let bytes = 0;

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const value = cursor.value as StoredMediaRecord;
        count += 1;
        bytes += value?.size || 0;
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error('Failed to iterate project media.'));
      tx.oncomplete = () => resolve({ mediaCount: count, mediaBytes: bytes });
      tx.onerror = () => reject(tx.error || new Error('Failed to read project media stats.'));
    }
  );

  return { projectCount, mediaCount, mediaBytes };
}

/** 모든 projects 레코드를 메모리로 읽는다. (메타데이터 전용, Blob 제외) */
function readAllProjectRecords(db: IDBDatabase): Promise<StudioProject[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as StudioProject[]) || []);
    req.onerror = () => reject(req.error || new Error('Failed to read project records.'));
  });
}

/** project_media 전체 레코드를 읽는다. (Blob 참조만 메모리에 유지) */
function readAllMediaRecords(db: IDBDatabase): Promise<StoredMediaRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
    const req = tx.objectStore(MEDIA_STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as StoredMediaRecord[]) || []);
    req.onerror = () => reject(req.error || new Error('Failed to read project media records.'));
  });
}

/** DB 재구축 시 인라인 Blob을 media 레코드로 옮긴다. (레거시 호환) 옮긴 바이트 수를 반환한다. */
function relocateInlineMedia(
  project: StudioProject,
  media: StoredMediaRecord[]
): number {
  const stamp = Date.now();
  const projectId = project.id;
  let relocatedBytes = 0;

  for (const video of project.videos || []) {
    if (video.fileBlob && video.fileBlob.size > 0) {
      media.push({
        key: mediaKeyFor('raw', projectId, video.id),
        projectId,
        kind: 'raw',
        itemId: video.id,
        blob: video.fileBlob,
        size: video.fileBlob.size,
        updatedAt: stamp,
      });
      relocatedBytes += video.fileBlob.size;
      video.fileBlob = undefined;
    }
  }

  const finalBlob = project.finalResult?.videoBlob;
  if (project.finalResult && finalBlob && finalBlob.size > 0) {
    media.push({
      key: mediaKeyFor('final', projectId),
      projectId,
      kind: 'final',
      itemId: undefined,
      blob: finalBlob,
      size: finalBlob.size,
      updatedAt: stamp,
    });
    relocatedBytes += finalBlob.size;
    project.finalResult.videoBlob = undefined;
  }

  const assetPairs: Array<['customAudioBlob' | 'introVideoBlob' | 'outroVideoBlob', ProjectMediaAssetId]> = [
    ['customAudioBlob', 'audio'],
    ['introVideoBlob', 'intro'],
    ['outroVideoBlob', 'outro'],
  ];
  for (const [field, assetId] of assetPairs) {
    const blob = project[field];
    if (blob && blob.size > 0) {
      media.push({
        key: mediaKeyFor('asset', projectId, assetId),
        projectId,
        kind: 'asset',
        itemId: assetId,
        blob,
        size: blob.size,
        updatedAt: stamp,
      });
      relocatedBytes += blob.size;
      (project[field] as Blob | null | undefined) = undefined;
    }
  }

  return relocatedBytes;
}

/**
 * 저장소 최적화(DB 압축): 남은 프로젝트 데이터를 보존한 채
 * IndexedDB를 삭제하고 새로 만들어 고아 Blob/SQLite freelist를 회수한다.
 */
export async function compactDatabase(): Promise<{
  projectCount: number;
  mediaCount: number;
  mediaBytes: number;
}> {
  const db = await getDB();

  // 1. 스냅샷: 프로젝트 메타데이터 + 미디어 레코드 (Blob 참조만 보존)
  const projects = await readAllProjectRecords(db);
  const media = await readAllMediaRecords(db);

  for (const project of projects) {
    // 레거시 레코드에 인라인으로 남아 있는 Blob을 미디어 레코드로 변환
    relocateInlineMedia(project, media);
    clampProjectThumbnails(project);
  }

  const mediaBytes = media.reduce((sum, m) => sum + (m.size || 0), 0);

  // 2. DB 커넥션을 닫고 삭제 → 디스크 잔여 용량 즉시 회수
  //    OPFS는 존재하지 않는 프로젝트의 고아 파일만 골라 지우고 실제 프로젝트 파일은 유지한다.
  const validProjectIds = new Set(projects.map((p) => p.id));
  await closeDatabaseConnection();
  await deleteDatabaseAsync();
  await pruneOrphanProjectOPFS(validProjectIds).catch(() => {});

  // 3. 깨끗한 DB에 재기록
  const fresh = await getDB();
  for (const project of projects) {
    const metadataOnly = sanitizeProjectForStorage({ ...project });
    // 정렬 기준이 바뀌지 않도록 기존 수정 시각을 보존한다.
    metadataOnly.updatedAt = project.updatedAt || metadataOnly.updatedAt;
    await executePut(fresh, metadataOnly);
  }
  for (const record of media) {
    await executeMediaPut(fresh, record);
    markMediaPersisted(record.blob, record.key, record.size);
  }

  return { projectCount: projects.length, mediaCount: media.length, mediaBytes };
}

/**
 * 미디어 분리 마이그레이션 1회 실행.
 * 인라인으로 저장된 Blob을 project_media로 옮기고
 * projects 레코드를 메타데이터 전용으로 다시 기록한다.
 */
export async function runMediaSplitMigration(): Promise<void> {
  try {
    if (localStorage.getItem(MEDIA_SPLIT_MIGRATION_KEY) === '1') return;
  } catch {}

  try {
    const db = await getDB();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, MEDIA_STORE_NAME], 'readwrite');
      const projectsStore = tx.objectStore(STORE_NAME);
      const mediaStore = tx.objectStore(MEDIA_STORE_NAME);
      const req = projectsStore.openCursor();
      let relocatedBytes = 0;

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const project = cursor.value as StudioProject;
        const preBytes = project.mediaBytes ?? computeMediaBytes(project);
        const mediaRecords: StoredMediaRecord[] = [];
        relocateInlineMedia(project, mediaRecords);

        for (const record of mediaRecords) {
          mediaStore.put(record);
          relocatedBytes += record.size;
        }

        const metadataOnly = sanitizeProjectForStorage({ ...project });
        metadataOnly.updatedAt = project.updatedAt || metadataOnly.updatedAt;
        metadataOnly.mediaBytes = preBytes;
        cursor.update(metadataOnly);
        cursor.continue();
      };

      req.onerror = () => reject(req.error || new Error('Media split migration scan failed.'));
      tx.onerror = () => reject(tx.error || new Error('Media split migration transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('Media split migration transaction aborted.'));
      tx.oncomplete = () => {
        console.info(
          `[projectStorage] Media split migration complete. Relocated ${Math.round(
            relocatedBytes / (1024 * 1024)
          )}MB of inline media.`
        );
        resolve();
      };
    });

    try {
      localStorage.setItem(MEDIA_SPLIT_MIGRATION_KEY, '1');
    } catch {}
  } catch (err) {
    console.warn('[projectStorage] Media split migration failed:', err);
  }
}

