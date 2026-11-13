// src/services/exportMuxerTarget.ts - MP4 muxer 출력 대상을 메모리/디스크에서 선택한다.
//
// 기존 ArrayBufferTarget은 완성된 MP4 전체를 JS 힙에 보관해 장시간 1080p 영상에서
// 수백 MB~GB의 메모리를 사용했다. 데스크톱에서는 OPFS 파일 스트림에 직접 기록해
// 인코딩 중 메모리 사용을 줄이고, 마지막에 독립 Blob으로 스냅샷해 반환한다.
import { ArrayBufferTarget, FileSystemWritableFileStreamTarget } from 'mp4-muxer';
import { isMobileStorageEnvironment } from './deviceStoragePolicy.ts';

const EXPORT_DIR = 'reportist_exports';
const STREAM_CHUNK_SIZE = 4 * 1024 * 1024;

export interface ExportMuxerTarget {
  target: ArrayBufferTarget | FileSystemWritableFileStreamTarget;
  fastStart: false | 'in-memory';
  streaming: boolean;
  /** muxer.finalize() 이후 호출해 최종 Blob을 얻는다. */
  finalize: () => Promise<Blob>;
}

async function tryCreateStreamingTarget(): Promise<ExportMuxerTarget | null> {
  // 모바일 Safari는 OPFS writable 지원과 쿼터가 불안정해 기존 메모리 경로를 유지한다.
  if (isMobileStorageEnvironment()) return null;
  if (typeof navigator === 'undefined' || typeof navigator.storage?.getDirectory !== 'function') {
    return null;
  }
  if (typeof FileSystemWritableFileStream === 'undefined') return null;

  let writable: FileSystemWritableFileStream | null = null;
  try {
    const root = await navigator.storage.getDirectory();
    // 이전 내보내기 임시 파일을 정리해 OPFS 사용량을 최신 1개로 제한한다.
    try {
      await root.removeEntry(EXPORT_DIR, { recursive: true });
    } catch {
      // 이전 파일이 없으면 무시
    }
    const dir = await root.getDirectoryHandle(EXPORT_DIR, { create: true });
    // 동시에 이전 결과를 재생 중이어도 파일이 잘리지 않도록 매 내보내기마다 고유 파일명을 쓴다.
    const exportFileName = `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const fileHandle = await dir.getFileHandle(exportFileName, { create: true });
    if (typeof fileHandle.createWritable !== 'function') return null;

    writable = await fileHandle.createWritable();
    const target = new FileSystemWritableFileStreamTarget(writable, {
      chunkSize: STREAM_CHUNK_SIZE,
    });
    const writableRef = writable;

    return {
      target,
      // moov를 파일 끝에 기록해 샘플 데이터를 즉시 디스크로 흘려보낸다.
      // (fastStart 'in-memory'는 전체 mdat를 메모리에 보관하므로 사용하지 않는다.)
      fastStart: false,
      streaming: true,
      finalize: async () => {
        await writableRef.close();
        writable = null;
        const file = await fileHandle.getFile();
        if (file.size === 0) {
          throw new Error('스트리밍으로 생성된 비디오 파일의 크기가 0바이트입니다.');
        }
        // OPFS File은 경로를 지연 참조한다. 그대로 반환하면 임시 파일을 정리하거나
        // IndexedDB에 저장한 뒤 원본이 사라졌을 때 재생/다운로드가 깨진다.
        // 스트림을 독립 Blob으로 스냅샷해(대용량은 브라우저 Blob 저장소로 흘려보냄)
        // JS 힙에 전체 파일을 올리지 않으면서 안전하게 반환한다.
        const blob = await new Response(file.stream(), {
          headers: { 'Content-Type': 'video/mp4' },
        }).blob();
        if (blob.size === 0) {
          throw new Error('스트리밍으로 생성된 비디오 파일의 크기가 0바이트입니다.');
        }
        // 임시 파일을 즉시 정리해 OPFS 사용량이 내보내기마다 누적되지 않게 한다.
        try {
          await dir.removeEntry(exportFileName);
        } catch {
          // 정리 실패 시 다음 내보내기 시작 시점의 디렉터리 정리에서 제거된다.
        }
        return blob;
      },
    };
  } catch (err) {
    console.warn('[Export] OPFS 스트리밍 대상 생성 실패, 메모리 버퍼로 폴백:', err);
    try {
      await writable?.abort();
    } catch {
      // abort 실패 무시
    }
    return null;
  }
}

/**
 * 환경에 따라 디스크 스트리밍 대상(OPFS) 또는 메모리 버퍼 대상을 만든다.
 * 스트리밍을 사용할 수 없으면 기존 동작(ArrayBufferTarget)으로 안전하게 폴백한다.
 */
export async function createExportMuxerTarget(): Promise<ExportMuxerTarget> {
  const streamingTarget = await tryCreateStreamingTarget();
  if (streamingTarget) return streamingTarget;

  const target = new ArrayBufferTarget();
  return {
    target,
    fastStart: 'in-memory',
    streaming: false,
    finalize: async () => new Blob([target.buffer], { type: 'video/mp4' }),
  };
}
