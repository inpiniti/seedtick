// src/services/opfsStorage.ts - OPFS (Origin Private File System) 대용량 비디오 파일 분리 보관 서비스
import { isMobileStorageEnvironment } from './deviceStoragePolicy.ts';

const OPFS_ROOT_DIR = 'reportist_projects';

/**
 * OPFS 지???��? ?�인
 */
export function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory);
}

/**
 * OPFS 루트 ??Reportist ?�용 ?�렉?�리 ?�들 반환
 */
async function getReportistRootDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOpfsAvailable()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(OPFS_ROOT_DIR, { create: true });
  } catch (err) {
    console.warn('[opfsStorage] OPFS root access failed:', err);
    return null;
  }
}

/**
 * ?�로?�트 ?�용 ?�렉?�리 ?�들 반환
 */
async function getProjectDir(projectId: string, create = false): Promise<FileSystemDirectoryHandle | null> {
  const root = await getReportistRootDir();
  if (!root) return null;
  try {
    return await root.getDirectoryHandle(projectId, { create });
  } catch (err) {
    if (!create) return null;
    console.warn(`[opfsStorage] Failed to get/create dir for project ${projectId}:`, err);
    return null;
  }
}

/**
 * Blob??OPFS ?�일�??�전?�게 기록
 */
async function writeBlobToFile(dir: FileSystemDirectoryHandle, fileName: string, blob: Blob): Promise<boolean> {
  try {
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    // createWritable??지?�되???�반 브라?��? ?�경
    if (typeof fileHandle.createWritable === 'function') {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }
    // Safari ???��? ?�경?�서 createSyncAccessHandle ?�는 ?�트�??��?지??(?�반 메인?�레?�는 createWritable)
    return false;
  } catch (err) {
    console.warn(`[opfsStorage] Failed to write file ${fileName}:`, err);
    return false;
  }
}

/**
 * OPFS?�서 ?�일 ?�기
 */
async function readFileFromDir(dir: FileSystemDirectoryHandle, fileName: string): Promise<Blob | null> {
  try {
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file && file.size > 0 ? file : null;
  } catch {
    return null;
  }
}

/**
 * OPFS???�당 비디???�일???��? ?�상 ?�기(expectedSize)�?존재?�는지 ?�인
 */
export async function hasVideoInOPFS(
  projectId: string,
  videoId: string,
  expectedSize?: number
): Promise<boolean> {
  if (!isOpfsAvailable()) return false;
  const dir = await getProjectDir(projectId, false);
  if (!dir) return false;
  try {
    const fileHandle = await dir.getFileHandle(`video_${videoId}.bin`);
    const file = await fileHandle.getFile();
    if (!file || file.size === 0) return false;
    if (typeof expectedSize === 'number' && expectedSize > 0) {
      return file.size === expectedSize;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 개별 비디??Blob??OPFS???�??(?��? ?�일 ?�기�??�?�된 경우 ?�기�??�략)
 */
export async function saveVideoToOPFS(projectId: string, videoId: string, blob: Blob, force = false): Promise<boolean> {
  if (isMobileStorageEnvironment()) return false;
  if (!isOpfsAvailable() || !blob || blob.size === 0) return false;
  if (!force && (await hasVideoInOPFS(projectId, videoId, blob.size))) {
    return true;
  }
  const dir = await getProjectDir(projectId, true);
  if (!dir) return false;
  return await writeBlobToFile(dir, `video_${videoId}.bin`, blob);
}

/**
 * OPFS?�서 비디??Blob 불러?�기
 */
export async function getVideoFromOPFS(projectId: string, videoId: string): Promise<Blob | null> {
  if (!isOpfsAvailable()) return null;
  const dir = await getProjectDir(projectId, false);
  if (!dir) return null;
  return await readFileFromDir(dir, `video_${videoId}.bin`);
}

/**
 * 최종 ?�성 비디??Blob??OPFS???�?? */
export async function saveFinalResultToOPFS(projectId: string, blob: Blob): Promise<boolean> {
  if (isMobileStorageEnvironment()) return false;
  if (!isOpfsAvailable() || !blob || blob.size === 0) return false;
  const dir = await getProjectDir(projectId, true);
  if (!dir) return false;
  return await writeBlobToFile(dir, 'final_result.bin', blob);
}

/**
 * OPFS?�서 최종 ?�성 비디??Blob 불러?�기
 */
export async function getFinalResultFromOPFS(projectId: string): Promise<Blob | null> {
  if (!isOpfsAvailable()) return null;
  const dir = await getProjectDir(projectId, false);
  if (!dir) return null;
  return await readFileFromDir(dir, 'final_result.bin');
}

/**
 * ?�로?�트 ??모든 OPFS ?�일 ??��
 */
export async function deleteProjectOPFS(projectId: string): Promise<void> {
  if (!isOpfsAvailable()) return;
  const root = await getReportistRootDir();
  if (!root) return;
  try {
    await root.removeEntry(projectId, { recursive: true });
  } catch {
    // ?�렉?�리가 ?�거???��? ??��??경우 무시
  }
}

/**
 * ?�로?�트 OPFS ?�일 복제
 */
export async function copyProjectOPFS(sourceProjectId: string, targetProjectId: string): Promise<void> {
  if (!isOpfsAvailable()) return;
  const sourceDir = await getProjectDir(sourceProjectId, false);
  if (!sourceDir) return;

  const targetDir = await getProjectDir(targetProjectId, true);
  if (!targetDir) return;

  try {
    // @ts-ignore
    for await (const [name, handle] of (sourceDir as any).entries()) {
      if (handle.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        await writeBlobToFile(targetDir, name, file);
      }
    }
  } catch (err) {
    console.warn('[opfsStorage] Failed to copy OPFS project files:', err);
  }
}

/**
 * Reportist ?�로?�트 ?�렉?�리�??�리 (?�른 ?�의 OPFS ?�이?�는 건드리�? ?�음)
 */
export async function purgeAllProjectOPFS(): Promise<boolean> {
  if (!isOpfsAvailable()) return false;
  try {
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry(OPFS_ROOT_DIR, { recursive: true });
    } catch {
      // ?��? ?�거????�� ?�패 ??무시
    }
    await root.getDirectoryHandle(OPFS_ROOT_DIR, { create: true });
    return true;
  } catch (err) {
    console.warn('[opfsStorage] Failed to purge project OPFS:', err);
    return false;
  }
}

export async function pruneOrphanProjectOPFS(validProjectIds: Set<string>): Promise<number> {
  if (!isOpfsAvailable()) return 0;
  try {
    const root = await navigator.storage.getDirectory();
    const rootDir = await root.getDirectoryHandle(OPFS_ROOT_DIR, { create: false }).catch(() => null);
    if (!rootDir) return 0;
    let removed = 0;
    const names: string[] = [];
    // @ts-ignore
    if (typeof (rootDir as any).entries === 'function') {
      // @ts-ignore
      for await (const [name] of (rootDir as any).entries()) {
        names.push(name);
      }
    }
    for (const name of names) {
      if (!validProjectIds.has(name)) {
        try {
          await rootDir.removeEntry(name, { recursive: true });
          removed += 1;
        } catch {}
      }
    }
    return removed;
  } catch (err) {
    console.warn('[opfsStorage] Failed to prune orphan OPFS projects:', err);
    return 0;
  }
}

/**
 * OPFS 전체 가상 파일시스템 정리 (모든 프로젝트 + 잔여 임시 파일 전부 삭제)
 */
export async function purgeAllOPFSStorage(): Promise<boolean> {
  if (!isOpfsAvailable()) return false;
  try {
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry(OPFS_ROOT_DIR, { recursive: true });
    } catch {
      // ?��? ?�거????�� ?�패 ??무시
    }

    try {
      // @ts-ignore
      if (typeof (root as any).values === 'function') {
        // @ts-ignore
        for await (const handle of (root as any).values()) {
          try {
            await root.removeEntry(handle.name, { recursive: true });
          } catch {}
        }
      }
    } catch {}

    // 깨끗??루트 ?�렉?�리 ?�구�?    await root.getDirectoryHandle(OPFS_ROOT_DIR, { create: true });
    return true;
  } catch (err) {
    console.warn('[opfsStorage] Failed to purge OPFS storage:', err);
    return false;
  }
}

