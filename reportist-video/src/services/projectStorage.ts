import type { StudioProject, StudioProjectSummary } from '../types/project.ts';
import { getStorageEstimate, getStoredStorageMode } from './storageQuotaService.ts';
import {
  isMobileStorageEnvironment,
  MOBILE_FINAL_RESULT_KEEP_COUNT,
  MOBILE_FINAL_RESULT_MAX_BYTES,
} from './deviceStoragePolicy.ts';
import {
  saveVideoToOPFS,
  getVideoFromOPFS,
  saveFinalResultToOPFS,
  getFinalResultFromOPFS,
  deleteProjectOPFS,
  copyProjectOPFS,
  isOpfsAvailable,
  purgeAllProjectOPFS,
} from './opfsStorage.ts';

const DB_NAME = 'reportist_video_studio_db';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const MEDIA_STORE_NAME = 'project_media';
const LAST_ACTIVE_KEY = 'reportist_video_last_active_project_id';
const MOBILE_POLICY_MIGRATION_KEY = 'reportist_video_mobile_storage_policy_v2';

interface StoredMediaRecord {
  key: string;
  projectId: string;
  kind: 'final';
  blob: Blob;
  size: number;
  updatedAt: number;
}

// 현재 세션에서 이미 기기에 기록한 완성본 Blob을 추적해, 자동 저장 때마다
// 동일한 수백 MB Blob을 다시 직렬화하는 낭비를 막는다.
const persistedFinalBlobs = new WeakMap<Blob, string>();

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

/**
 * 프로젝트 저장 데이터 정제 (직렬화 불가능한 필드 제거)
 * @param stripRawVideos 원본 다중 비디오 파일(수백MB~수GB) 제외 여부 (모바일 OOM 방지)
 * @param stripFinalResult 최종 완성본 비디오 1개 제외 여부
 * @param stripUserMediaAssets 인트로·아웃트로·커스텀 오디오 Blob 제외 여부 (모바일 용량 보호)
 */
function sanitizeProjectForStorage(
  project: StudioProject,
  stripRawVideos = false,
  stripFinalResult = false,
  stripUserMediaAssets = false
): StudioProject {
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
    fileBlob: stripRawVideos ? undefined : v.fileBlob,
    hasOpfsFile: stripRawVideos ? false : v.hasOpfsFile,
  }));

  const finalBlob = project.finalResult?.videoBlob;
  // 단일 최종 완성본 Blob이 비정상적으로 거대하지 않은지 체크 (최대 200MB까지 안전 보관)
  const isFinalBlobTooLarge = Boolean(
    finalBlob && finalBlob.size > 200 * 1024 * 1024
  );

  const sanitizedFinalResult = project.finalResult
    ? {
        ...project.finalResult,
        thumbnailUrl: sanitizeThumbnail(project.finalResult.thumbnailUrl),
        cleanThumbnailUrl: sanitizeThumbnail(project.finalResult.cleanThumbnailUrl),
        videoBlob: stripFinalResult || isFinalBlobTooLarge ? undefined : finalBlob,
      }
    : null;

  // 오디오 및 인트로/아웃트로 클립은 수십MB 이하의 가벼운 에셋이므로 stripRawVideos(수GB 원본 비디오 스트립)와 무관하게 안전 보존
  const safeAudioBlob =
    project.customAudioBlob && project.customAudioBlob.size < 50 * 1024 * 1024
      ? project.customAudioBlob
      : undefined;

  const safeIntroBlob =
    project.introVideoBlob && project.introVideoBlob.size < 100 * 1024 * 1024
      ? project.introVideoBlob
      : undefined;

  const safeOutroBlob =
    project.outroVideoBlob && project.outroVideoBlob.size < 100 * 1024 * 1024
      ? project.outroVideoBlob
      : undefined;

  return {
    ...project,
    updatedAt: Date.now(),
    thumbnailUrl: sanitizeThumbnail(project.thumbnailUrl),
    videos: sanitizedVideos,
    finalResult: sanitizedFinalResult,
    overlayOptions: sanitizedOverlay,
    selectedLibraryTrackId: project.selectedLibraryTrackId,
    customAudioBlob: stripUserMediaAssets ? undefined : safeAudioBlob,
    customAudioName: !stripUserMediaAssets && safeAudioBlob ? project.customAudioName : undefined,
    introVideoBlob: stripUserMediaAssets ? undefined : safeIntroBlob,
    introVideoName: !stripUserMediaAssets && safeIntroBlob ? project.introVideoName : undefined,
    outroVideoBlob: stripUserMediaAssets ? undefined : safeOutroBlob,
    outroVideoName: !stripUserMediaAssets && safeOutroBlob ? project.outroVideoName : undefined,
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

// IndexedDB 단일 레코드에 원본 비디오 Blob을 직접 직렬화할 수 있는 최대 안전 한도 (35MB, 최대 2개 이하)
const MAX_IDB_INLINE_BLOB_BYTES = 35 * 1024 * 1024;
const MAX_IDB_INLINE_VIDEO_COUNT = 2;

function getFinalMediaKey(projectId: string): string {
  return `final:${projectId}`;
}

function executeMediaPut(db: IDBDatabase, record: StoredMediaRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save final video media.'));
    tx.onabort = () => reject(tx.error || new Error('Final video media transaction aborted.'));
    tx.objectStore(MEDIA_STORE_NAME).put(record);
  });
}

function executeMediaDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to delete final video media.'));
    tx.onabort = () => reject(tx.error || new Error('Final video media delete aborted.'));
    tx.objectStore(MEDIA_STORE_NAME).delete(key);
  });
}

function getFinalMediaRecord(db: IDBDatabase, projectId: string): Promise<StoredMediaRecord | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
    const req = tx.objectStore(MEDIA_STORE_NAME).get(getFinalMediaKey(projectId));
    req.onsuccess = () => resolve((req.result as StoredMediaRecord | undefined) || null);
    req.onerror = () => reject(req.error || new Error('Failed to read final video media.'));
  });
}

function clearFinalMediaStore(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to clear final video media.'));
    tx.onabort = () => reject(tx.error || new Error('Final video media clear aborted.'));
    tx.objectStore(MEDIA_STORE_NAME).clear();
  });
}

async function saveFinalMediaForProject(
  db: IDBDatabase,
  projectId: string,
  blob: Blob
): Promise<void> {
  if (persistedFinalBlobs.get(blob) === projectId) return;
  await executeMediaPut(db, {
    key: getFinalMediaKey(projectId),
    projectId,
    kind: 'final',
    blob,
    size: blob.size,
    updatedAt: Date.now(),
  });
  persistedFinalBlobs.set(blob, projectId);
}

/**
 * 모바일에서 최근 완성본만 남기고 오래된 프로젝트의 완성본 Blob을 정리한다.
 * (메타데이터·썸네일·편집점은 그대로 유지)
 * key cursor만 사용해 Blob 본문을 메모리로 읽지 않는다.
 */
function pruneFinalMedia(db: IDBDatabase, activeProjectId?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE_NAME);
    const index = store.index('by_updatedAt');
    const req = index.openKeyCursor(null, 'prev');
    const keepProjectIds = new Set<string>();
    if (activeProjectId) keepProjectIds.add(activeProjectId);

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;

      const key = String(cursor.primaryKey);
      const projectId = key.startsWith('final:') ? key.slice('final:'.length) : key;

      if (keepProjectIds.has(projectId) || keepProjectIds.size < MOBILE_FINAL_RESULT_KEEP_COUNT) {
        keepProjectIds.add(projectId);
      } else {
        store.delete(cursor.primaryKey);
      }

      cursor.continue();
    };

    req.onerror = () => reject(req.error || new Error('Failed to prune final video media.'));
    tx.onerror = () => reject(tx.error || new Error('Final video media prune transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Final video media prune transaction aborted.'));
    tx.oncomplete = () => resolve();
  });
}

/**
 * 프로젝트 저장 또는 업데이트 (OPFS 분리 저장 + IndexedDB 하이브리드, 모바일 OOM 원천 차단)
 */
export async function saveProject(project: StudioProject): Promise<void> {
  const db = await getDB();
  const currentMode = project.storageMode || getStoredStorageMode();
  let hasOpfs = false;

  const videoList = project.videos || [];
  const totalVideoBlobBytes =
    videoList.reduce((sum, v) => sum + (v.fileBlob?.size || v.sizeBytes || 0), 0) +
    (project.finalResult?.videoBlob?.size || 0);

  // 1. 모바일(iOS/Android) 환경: 원본·인트로·아웃트로·커스텀 오디오 Blob은
  // IndexedDB/OPFS에 절대 기록하지 않는다. 자동 저장이 반복될 때마다 수백 MB를
  // 다시 직렬화하며 Safari 앱 용량이 수 GB로 불어나는 문제를 원천 차단한다.
  // 편집점/분석 결과는 메타데이터로 유지하고, 완성본만 별도 media store에
  // 최근 MOBILE_FINAL_RESULT_KEEP_COUNT개(각 60MB 이하)까지 보관한다.
  if (isMobileStorageEnvironment()) {
    const finalBlob = project.finalResult?.videoBlob;
    if (finalBlob && finalBlob.size > 0) {
      if (finalBlob.size <= MOBILE_FINAL_RESULT_MAX_BYTES) {
        try {
          await saveFinalMediaForProject(db, project.id, finalBlob);
        } catch (mediaErr) {
          console.warn('[projectStorage] Failed to persist mobile final video:', mediaErr);
        }
      } else {
        // 새 완성본이 보관 한도를 넘으면 이전 완성본도 함께 정리한다.
        await executeMediaDelete(db, getFinalMediaKey(project.id)).catch(() => {});
      }
    }

    const metadataOnly = sanitizeProjectForStorage(
      {
        ...project,
        storageMode: currentMode,
        hasOpfsFiles: false,
      },
      true, // stripRawVideos = true (원본 비디오 제외)
      true, // stripFinalResult = true (완성본은 별도 media store에 보관)
      true  // stripUserMediaAssets = true (인트로/아웃트로/커스텀 오디오 제외)
    );
    await executePut(db, metadataOnly);
    await pruneFinalMedia(db, project.id).catch((pruneErr) => {
      console.warn('[projectStorage] Failed to prune mobile final media:', pruneErr);
    });
    return;
  }

  // 2. 경량 모드(lightweight): 데스크톱에서도 원본 없이 메타데이터만 보관
  if (currentMode === 'lightweight') {
    const metadataOnly = sanitizeProjectForStorage(
      {
        ...project,
        storageMode: 'lightweight',
        hasOpfsFiles: false,
      },
      true,
      false
    );
    await executePut(db, metadataOnly);
    return;
  }

  // 3. 데스크톱 OPFS 지원 환경: Promise.all 병렬 쓰기 대신 1개씩 순차 기록 (메모리 스파이크 방지)
  if (isOpfsAvailable()) {
    try {
      let anySaved = false;

      for (const v of videoList) {
        if (v.hasOpfsFile) {
          anySaved = true;
          continue;
        }
        if (v.fileBlob && v.fileBlob.size > 0) {
          const ok = await saveVideoToOPFS(project.id, v.id, v.fileBlob);
          if (ok) {
            v.hasOpfsFile = true;
            anySaved = true;
          } else {
            // 첫 파일에서 OPFS 쓰기(createWritable 미지원 등)가 실패하면 즉시 루프 중단
            break;
          }
        }
      }

      const finalBlob = project.finalResult?.videoBlob;
      if (
        finalBlob &&
        finalBlob.size > 0 &&
        persistedFinalBlobs.get(finalBlob) !== project.id
      ) {
        const finalSaved = await saveFinalResultToOPFS(project.id, finalBlob);
        if (finalSaved) {
          anySaved = true;
          persistedFinalBlobs.set(finalBlob, project.id);
        }
      }

      hasOpfs = anySaved;
    } catch (opfsErr) {
      console.warn('[projectStorage] OPFS storage partial error, falling back:', opfsErr);
    }
  }

  // 4. OPFS에 저장된 경우: IndexedDB에는 가벼운 메타데이터만 기록 (직렬화 오버헤드 0, OOM 방지)
  if (hasOpfs) {
    const opfsMetadataOnly = sanitizeProjectForStorage(
      {
        ...project,
        storageMode: currentMode,
        hasOpfsFiles: true,
      },
      true,
      true
    );
    await executePut(db, opfsMetadataOnly);
    return;
  }

  // 5. OPFS 미지원/실패 환경: 다중 영상이거나 용량이 큰 경우 원본 영상 직렬화 제외하되 완성본은 보존
  const exceedsInlineLimit =
    videoList.length > MAX_IDB_INLINE_VIDEO_COUNT ||
    totalVideoBlobBytes > MAX_IDB_INLINE_BLOB_BYTES;

  if (exceedsInlineLimit) {
    try {
      const safeData = sanitizeProjectForStorage(
        {
          ...project,
          storageMode: 'lightweight',
          hasOpfsFiles: false,
        },
        true,
        false
      );
      await executePut(db, safeData);
      return;
    } catch {
      const metadataOnly = sanitizeProjectForStorage(
        {
          ...project,
          storageMode: 'lightweight',
          hasOpfsFiles: false,
        },
        true,
        true
      );
      await executePut(db, metadataOnly);
      return;
    }
  }

  // 6. 소용량(2개 이하 & 35MB 이하) 데스크톱 프로젝트만 쿼터 확인 후 IndexedDB 폴백 저장
  const estimate = await getStorageEstimate();
  if (estimate.isLowStorage) {
    console.warn('[projectStorage] Storage quota critically low, saving metadata-only to prevent crash.');
    const safeData = sanitizeProjectForStorage(
      {
        ...project,
        storageMode: 'lightweight',
        hasOpfsFiles: false,
      },
      true,
      false
    );
    await executePut(db, safeData);
    return;
  }

  try {
    const fullData = sanitizeProjectForStorage(
      {
        ...project,
        storageMode: currentMode,
        hasOpfsFiles: false,
      },
      false,
      false
    );
    await executePut(db, fullData);
  } catch (firstErr) {
    console.warn('[projectStorage] Full save with Blobs failed, falling back to metadata-only:', firstErr);
    const safeData = sanitizeProjectForStorage(
      {
        ...project,
        storageMode: 'lightweight',
        hasOpfsFiles: false,
      },
      true,
      false
    );
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

  // 모바일: 원본은 기기에 저장하지 않으므로, 별도 media store에 보관된
  // 최근 완성본 Blob만 복원한다. (편집점·분석 결과는 메타데이터로 유지)
  if (isMobileStorageEnvironment()) {
    try {
      const media = await getFinalMediaRecord(db, project.id);
      if (media?.blob && media.blob.size > 0 && project.finalResult) {
        if (!project.finalResult.videoBlob || project.finalResult.videoBlob.size === 0) {
          project.finalResult.videoBlob = media.blob;
        }
        persistedFinalBlobs.set(media.blob, project.id);
      }
    } catch (err) {
      console.warn('[projectStorage] Error loading mobile final media:', err);
    }
    return project;
  }

  // OPFS가 지원되고 바이너리 복원이 필요한 경우 (데스크톱)
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
          persistedFinalBlobs.set(opfsFinalBlob, project.id);
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
      if (cursor && summaries.length < 20) {
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

  // OPFS 파일 및 별도 완성본 media 정리
  await Promise.all([
    deleteProjectOPFS(id),
    executeMediaDelete(db, getFinalMediaKey(id)).catch(() => {}),
  ]);
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

  if (!isMobileStorageEnvironment()) {
    await copyProjectOPFS(id, newId);
  }
  await saveProject(duplicated);
  return duplicated;
}

interface MobileMigrationScanResult {
  freedBytes: number;
  newestFinalBlob: Blob | null;
  newestFinalProjectId: string | null;
}

/**
 * 모바일 저장소 정책 마이그레이션 1단계:
 * 기존 프로젝트 레코드에 남아 있는 원본/완성본 Blob 용량을 집계하고,
 * 가장 최근 프로젝트의 완성본 1개만 보존 대상으로 선택한다.
 */
function scanLegacyMobileProjectMedia(db: IDBDatabase): Promise<MobileMigrationScanResult> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).openCursor();
    let freedBytes = 0;
    let newestUpdatedAt = -1;
    let newestFinalBlob: Blob | null = null;
    let newestFinalProjectId: string | null = null;

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const project = cursor.value as StudioProject;

      for (const video of project.videos || []) {
        freedBytes += video.fileBlob?.size || 0;
      }
      freedBytes += project.finalResult?.videoBlob?.size || 0;
      freedBytes += project.customAudioBlob?.size || 0;
      freedBytes += project.introVideoBlob?.size || 0;
      freedBytes += project.outroVideoBlob?.size || 0;

      const finalBlob = project.finalResult?.videoBlob;
      if (
        finalBlob &&
        finalBlob.size > 0 &&
        finalBlob.size <= MOBILE_FINAL_RESULT_MAX_BYTES &&
        (project.updatedAt || 0) > newestUpdatedAt
      ) {
        newestUpdatedAt = project.updatedAt || 0;
        newestFinalBlob = finalBlob;
        newestFinalProjectId = project.id;
      }

      cursor.continue();
    };

    req.onerror = () => reject(req.error || new Error('Failed to scan legacy mobile project media.'));
    tx.onerror = () => reject(tx.error || new Error('Legacy mobile media scan transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Legacy mobile media scan transaction aborted.'));
    tx.oncomplete = () =>
      resolve({ freedBytes, newestFinalBlob, newestFinalProjectId });
  });
}

/**
 * 모든 프로젝트 레코드를 메타데이터 전용으로 다시 기록한다.
 * (편집점·분석 결과·썸네일은 유지, 원본/완성본/인트로/아웃트로/오디오 Blob만 제거)
 */
function rewriteProjectsAsMetadataOnly(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).openCursor();

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const project = cursor.value as StudioProject;
      const metadataOnly = sanitizeProjectForStorage(
        {
          ...project,
          storageMode: 'lightweight',
          hasOpfsFiles: false,
        },
        true,
        true,
        true
      );
      // 정렬 기준이 바뀌지 않도록 기존 수정 시각을 보존한다.
      metadataOnly.updatedAt = project.updatedAt || metadataOnly.updatedAt;
      cursor.update(metadataOnly);
      cursor.continue();
    };

    req.onerror = () => reject(req.error || new Error('Failed to rewrite project metadata.'));
    tx.onerror = () => reject(tx.error || new Error('Project metadata rewrite transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Project metadata rewrite transaction aborted.'));
    tx.oncomplete = () => resolve();
  });
}

/**
 * 모바일 기기의 기존 프로젝트에서 대용량 미디어 Blob을 1회 정리한다.
 * - IndexedDB: 원본/완성본/인트로/아웃트로/오디오 Blob 제거 (메타데이터 유지)
 * - OPFS: 이전 버전이 남긴 프로젝트 파일 디렉터리 제거
 * - 최근 프로젝트의 완성본 1개(60MB 이하)만 media store에 보존
 */
export async function applyMobileStoragePolicy(): Promise<void> {
  if (!isMobileStorageEnvironment()) return;

  try {
    if (localStorage.getItem(MOBILE_POLICY_MIGRATION_KEY) === '1') return;
  } catch {}

  try {
    const db = await getDB();
    const scan = await scanLegacyMobileProjectMedia(db);
    await rewriteProjectsAsMetadataOnly(db);
    await clearFinalMediaStore(db);

    if (scan.newestFinalBlob && scan.newestFinalProjectId) {
      await saveFinalMediaForProject(db, scan.newestFinalProjectId, scan.newestFinalBlob);
    }

    await purgeAllProjectOPFS();

    try {
      localStorage.setItem(MOBILE_POLICY_MIGRATION_KEY, '1');
    } catch {}

    console.info(
      `[projectStorage] Mobile storage policy applied. Freed ${Math.round(
        scan.freedBytes / (1024 * 1024)
      )}MB of project media.`
    );
  } catch (err) {
    console.warn('[projectStorage] Failed to apply mobile storage policy:', err);
  }
}

/**
 * 사용자가 '저장 공간 정리'를 눌렀을 때 모바일 프로젝트의 미디어 Blob을 즉시 제거한다.
 * (프로젝트 목록·편집점·분석 결과는 그대로 유지)
 */
export async function clearMobileProjectMedia(): Promise<void> {
  if (!isMobileStorageEnvironment()) return;

  const db = await getDB();
  await rewriteProjectsAsMetadataOnly(db);
  await clearFinalMediaStore(db);
  await purgeAllProjectOPFS();
}
