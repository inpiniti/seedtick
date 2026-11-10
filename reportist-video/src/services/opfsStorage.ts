// src/services/opfsStorage.ts - OPFS (Origin Private File System) 대용량 비디오 파일 독립 보관 서비스

const OPFS_ROOT_DIR = 'reportist_projects';

/**
 * OPFS 지원 여부 확인
 */
export function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory);
}

/**
 * OPFS 루트 내 Reportist 전용 디렉터리 핸들 반환
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
 * 프로젝트 전용 디렉터리 핸들 반환
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
 * Blob을 OPFS 파일로 안전하게 기록
 */
async function writeBlobToFile(dir: FileSystemDirectoryHandle, fileName: string, blob: Blob): Promise<boolean> {
  try {
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    // createWritable이 지원되는 일반 브라우저 환경
    if (typeof fileHandle.createWritable === 'function') {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }
    // Safari 등 일부 환경에서 createSyncAccessHandle 또는 스트림 대체 지원 (일반 메인스레드는 createWritable)
    return false;
  } catch (err) {
    console.warn(`[opfsStorage] Failed to write file ${fileName}:`, err);
    return false;
  }
}

/**
 * OPFS에서 파일 읽기
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
 * OPFS에 해당 비디오 파일이 이미 정상 크기(expectedSize)로 존재하는지 확인
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
 * 개별 비디오 Blob을 OPFS에 저장 (이미 동일 크기로 저장된 경우 재기록 생략)
 */
export async function saveVideoToOPFS(projectId: string, videoId: string, blob: Blob): Promise<boolean> {
  if (!isOpfsAvailable() || !blob || blob.size === 0) return false;
  if (await hasVideoInOPFS(projectId, videoId, blob.size)) {
    return true;
  }
  const dir = await getProjectDir(projectId, true);
  if (!dir) return false;
  return await writeBlobToFile(dir, `video_${videoId}.bin`, blob);
}

/**
 * OPFS에서 비디오 Blob 불러오기
 */
export async function getVideoFromOPFS(projectId: string, videoId: string): Promise<Blob | null> {
  if (!isOpfsAvailable()) return null;
  const dir = await getProjectDir(projectId, false);
  if (!dir) return null;
  return await readFileFromDir(dir, `video_${videoId}.bin`);
}

/**
 * 최종 완성 비디오 Blob을 OPFS에 저장
 */
export async function saveFinalResultToOPFS(projectId: string, blob: Blob): Promise<boolean> {
  if (!isOpfsAvailable() || !blob || blob.size === 0) return false;
  const dir = await getProjectDir(projectId, true);
  if (!dir) return false;
  return await writeBlobToFile(dir, 'final_result.bin', blob);
}

/**
 * OPFS에서 최종 완성 비디오 Blob 불러오기
 */
export async function getFinalResultFromOPFS(projectId: string): Promise<Blob | null> {
  if (!isOpfsAvailable()) return null;
  const dir = await getProjectDir(projectId, false);
  if (!dir) return null;
  return await readFileFromDir(dir, 'final_result.bin');
}

/**
 * 프로젝트 내 모든 OPFS 파일 삭제
 */
export async function deleteProjectOPFS(projectId: string): Promise<void> {
  if (!isOpfsAvailable()) return;
  const root = await getReportistRootDir();
  if (!root) return;
  try {
    await root.removeEntry(projectId, { recursive: true });
  } catch {
    // 디렉터리가 없거나 이미 삭제된 경우 무시
  }
}

/**
 * 프로젝트 OPFS 파일 복제
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
