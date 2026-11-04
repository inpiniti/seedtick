// src/services/subtitleService.ts - YouTube-compatible SRT subtitle generator and translation service
import type { HighlightSegment } from '../types/video.ts';
import type { Locale } from '../i18n/types.ts';
import { LOCALES } from '../i18n/types.ts';

/**
 * Format seconds into SRT timestamp format: HH:MM:SS,mmm
 * Example: 75.321 -> "00:01:15,321"
 */
export function formatSrtTimestamp(seconds: number): string {
  const safeSec = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMs = Math.floor(safeSec * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);

  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Build standard SubRip (.srt) subtitle string from highlight segments.
 * Fully compatible with YouTube subtitle upload specifications.
 */
export function buildSrtFromSegments(
  segments: HighlightSegment[],
  introDuration = 0,
  translations?: Record<string, string>,
  bridgeDurationMap?: Record<string, number>
): string {
  if (!segments || segments.length === 0) return '';

  let currentOffset = Math.max(0, introDuration);
  const cues: string[] = [];
  let cueIndex = 1;

  for (const seg of segments) {
    currentOffset += Math.max(0, bridgeDurationMap?.[seg.id] || 0);
    const startSec = currentOffset;
    const endSec = currentOffset + Math.max(0.5, seg.duration);
    currentOffset = endSec;

    const rawText = translations?.[seg.id] ?? (seg.subtitleTitle || seg.reason || '');
    const cleanText = rawText.trim();

    // YouTube requires non-empty subtitle cue text
    const cueText = cleanText || `Highlight #${cueIndex}`;

    cues.push(
      `${cueIndex}\r\n${formatSrtTimestamp(startSec)} --> ${formatSrtTimestamp(endSec)}\r\n${cueText}`
    );
    cueIndex++;
  }

  return cues.join('\r\n\r\n') + '\r\n';
}

/**
 * Google Translate target language mapping
 */
const LOCALE_TO_GT_LANG: Record<Locale, string> = {
  en: 'en',
  ko: 'ko',
  ja: 'ja',
  zh: 'zh-CN',
  es: 'es',
  fr: 'fr',
  de: 'de',
};

/**
 * Translate array of subtitle strings to the target locale.
 * Uses high-speed Google Translate client API with individual fallback.
 */
export async function translateSubtitles(
  texts: string[],
  targetLocale: Locale
): Promise<string[]> {
  if (!texts || texts.length === 0) return [];

  // Filter empty
  const nonEmpties = texts.map((t) => t.trim());
  const allEmpty = nonEmpties.every((t) => !t);
  if (allEmpty) return texts;

  const targetLang = LOCALE_TO_GT_LANG[targetLocale] || targetLocale;

  // 1. Try batch translation with newline separator
  try {
    const combined = nonEmpties.join('\n');
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(combined)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.[0])) {
        const fullTranslated = (data[0] as Array<[string, string]>)
          .map((item) => (Array.isArray(item) ? item[0] : ''))
          .join('');
        const splitLines = fullTranslated.split('\n');
        if (splitLines.length === texts.length) {
          return splitLines.map((line, idx) => line.trim() || texts[idx]);
        }
      }
    }
  } catch (err) {
    console.warn('[SubtitleService] Batch translation failed, falling back to per-item translation:', err);
  }

  // 2. Fallback: Translate individually with Promise.all
  try {
    const itemResults = await Promise.all(
      texts.map(async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return '';
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.[0])) {
              const trans = (data[0] as Array<[string, string]>)
                .map((item) => (Array.isArray(item) ? item[0] : ''))
                .join('');
              if (trans.trim()) return trans.trim();
            }
          }
        } catch {
          // ignore single item failure
        }
        return trimmed;
      })
    );
    return itemResults;
  } catch (err) {
    console.error('[SubtitleService] Translation failed completely, returning original texts:', err);
    return texts;
  }
}

/**
 * Trigger download of SRT file in the browser
 */
export function downloadSrtFile(srtContent: string, fileName: string): void {
  // UTF-8 with BOM helps some Windows and legacy subtitle editors parse UTF-8 characters properly
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, srtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = fileName.endsWith('.srt') ? fileName : `${fileName}.srt`;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Helper to get clean filename for subtitle export
 */
export function getSubtitleFileName(baseTitle: string, locale: Locale): string {
  const cleanTitle = (baseTitle || 'highlight_video')
    .replace(/[^\w\s\uac00-\ud7a3\u4e00-\u9fa5\u3040-\u30ff-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'highlight';

  return `${cleanTitle}_${locale}.srt`;
}
