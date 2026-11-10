// src/data/patchNotesLocalization.ts - Multilingual localization dictionary and helper for Patch Notes
import type { Locale } from '../i18n/types.ts';
import { PATCH_RELEASES, type PatchRelease, type PatchCommit } from './patchNotes.ts';

export interface ReleaseI18nEntry {
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
}

export const RELEASE_TRANSLATIONS: Record<string, ReleaseI18nEntry> = {
  "0.9.8": {
    "title": {
      "ko": "설정 모달 내 클립 촬영일시 순 기본 정렬 옵션 추가 및 AI 하이라이트 생성 시 자동 정렬 연동",
      "en": "Add Default Sort by Filming Time in Settings & Auto-Order Clips on AI Highlight Generation",
      "ja": "設定モーダルに撮影日時順のデフォルト整列オプションを追加＆AIハイライト作成時の自動整列に対応",
      "zh": "在设置弹窗中添加默认按拍摄时间排序选项并支持AI高光生成时自动整列",
      "es": "Añadir orden cronológico predeterminado en Ajustes y ordenar clips automáticamente al generar momentos destacados",
      "fr": "Ajout du tri chronologique par défaut dans les paramètres et organisation automatique des clips lors de la génération IA",
      "de": "Option 'Standardmäßig nach Aufnahmezeit sortieren' in den Einstellungen hinzugefügt & automatische Sortierung bei KI-Highlights"
    },
    "summary": {
      "ko": "스튜디오 설정 모달 내 '촬영일시 순 기본 정렬' 토글 옵션을 추가하여, 개별 버튼을 수동으로 누르지 않아도 영상을 불러오거나 AI 하이라이트 분석 시 자동으로 클립들을 촬영일시(시·분·초) 기준 시간순으로 정렬하도록 사용성을 개선했습니다. 설정 값은 브라우저 로컬 저장소에 영구 보관되며, 설정 창에서 토글을 켜는 즉시 현재 작업 중인 타임라인 클립도 시간순으로 정렬됩니다.",
      "en": "Added a 'Default Sort by Filming Time' toggle option in Studio Settings, allowing clips to be automatically ordered chronologically (date, hour, minute, second) upon video import or AI highlight generation without needing to manually press the sort button every time. Preferences are permanently saved in local storage, and enabling the toggle immediately reorders existing timeline clips chronologically.",
      "ja": "スタジオ設定モーダルに「撮影日時順のデフォルト整列」トグルオプションを追加しました。動画読み込み時やAIハイライト作成時に手動ボタンを押すことなく、撮影日時（時・分・秒）順にクリップが自動的に時系列整列されます。設定内容はローカルストレージに永続保存され、トグルをオンにした瞬間に作業中のタイムラインクリップも即座に時系列順へ再整列されます。",
      "zh": "在工作室设置弹窗中增加了“默认按拍摄时间排序”开关选项。在导入视频或生成 AI 高光时，无需手动点击排序按钮即可自动按拍摄日期和时间（时分秒）顺序排列片段。设置项永久保存在本地存储中，开启开关时也会立即将当前时间线上的片段按时间顺序重新排列。",
      "es": "Se añadió la opción 'Orden cronológico predeterminado' en los Ajustes del Estudio para ordenar automáticamente los clips por fecha y hora de grabación sin necesidad de pulsar manualmente el botón de ordenar.",
      "fr": "Ajout d'une option 'Tri chronologique par défaut' dans les Paramètres du Studio pour organiser automatiquement les clips selon la date et l'heure de tournage lors de l'import ou de l'analyse IA.",
      "de": "Option 'Standardmäßig nach Aufnahmezeit sortieren' in den Studio-Einstellungen hinzugefügt, um Clips beim Laden oder Generieren automatisch chronologisch nach Aufnahmezeit anzuordnen."
    }
  },
  "0.9.7": {
    "title": {
      "ko": "백그라운드 탭·앱 전환 시 브라우저 프로세스 동결 방지(WakeLock·킵얼라이브) 및 화면 복귀 시 중단 지점 자동 재개 지원",
      "en": "Prevent Background Browser Freezing (WakeLock & Keep-Alive) and Auto-Resume Stalled Analysis on Focus Return",
      "ja": "バックグラウンドタブ・アプリ切替時のブラウザプロセス凍結防止(WakeLock・キープアライブ)＆画面復帰時の中断地点自動再開に対応",
      "zh": "防止切出后台时浏览器进程冻结（WakeLock 与保活机制）并支持返回时自动恢复中断进度",
      "es": "Evitar congelamiento en segundo plano (WakeLock y Keep-Alive) y reanudar an\u00e1lisis autom\u00e1ticamente al volver",
      "fr": "Emp\u00eacher le gel en arri\u00e8re-plan (WakeLock & Keep-Alive) et reprendre l'analyse automatiquement au retour",
      "de": "Verhindern von Hintergrund-Einfrieren (WakeLock & Keep-Alive) und automatisches Fortsetzen bei R\u00fcckkehr"
    },
    "summary": {
      "ko": "AI 하이라이트 분석 및 영상 생성 도중 사용자가 크롬 다른 탭으로 이동하거나 모바일에서 다른 앱을 켤 때 브라우저 프로세스가 동결(Freezing)되거나 TCP 소켓이 조용히 끊어져 작업이 멈추는 문제를 전면 해결했습니다. Screen Wake Lock API와 무음 오디오 킵얼라이브 및 Web Worker 정밀 하트비트를 도입하여 백그라운드에서도 네트워크 연결을 안정적으로 유지하며, AI Gateway 응답에 25초 무응답 워치독(Inactivity Timeout)을 탑재했습니다. 특히 다른 앱을 다녀와 화면으로 복귀했을 때 정체된 연결을 감지해 멈춘 위치부터 즉시 작업을 자동으로 재개(Auto-Resume)하며, 영상별 분석 완료 시마다 중간 체크포인트를 저장하여 완료된 결과는 영구 보존됩니다.",
      "en": "Completely resolves the issue where backgrounding Chrome or switching apps on mobile freezes the browser process or silently drops streaming sockets during long AI highlight generation. Integrates the Screen Wake Lock API, silent audio keep-alive, and Web Worker precision heartbeats to maintain active sockets in the background. Introduces a 25-second inactivity watchdog on AI Gateway streams. When returning to the app, it instantly detects stalled connections and auto-resumes progress seamlessly, saving intermediate checkpoints for each finished clip.",
      "ja": "AIハイライト分析中にChromeの他タブへ移動したりスマホで別アプリを開いた際に、ブラウザプロセスが凍結(Freezing)したりTCPソケットが切断されて進行が止まる問題を解決しました。Screen Wake Lock API、無音オーディオキープアライブ、Web Workerハートビートを導入しバックグラウンドでもネットワーク接続を維持。25秒無通信検知ウォッチドッグを備え、画面復帰時に停滞した接続を検知して停止位置から即座に自動再開(Auto-Resume)します。",
      "zh": "彻底解决在生成 AI 高光时因切换 Chrome 标签页或在手机上打开其他 App 导致浏览器进程冻结或 TCP 连接静默断开而卡住的问题。引入 Screen Wake Lock API、静音音频保活及 Web Worker 精密心跳维持后台活跃连接，并在 AI Gateway 流中加入 25 秒无响应看门狗。切回前台时可立即识别停滞连接并无缝自动恢复进度，且每段视频分析完成后均自动保存断点。",
      "es": "Evita el congelamiento del navegador y la desconexi\u00f3n de sockets al cambiar de pesta\u00f1a o app mediante WakeLock y Keep-Alive, reanudando autom\u00e1ticamente el progreso al volver.",
      "fr": "Emp\u00eache le gel du navigateur et la coupure de socket en arri\u00e8re-plan gr\u00e2ce \u00e0 WakeLock et Keep-Alive, avec reprise automatique au retour.",
      "de": "Verhindert das Einfrieren des Browsers und Socket-Abbr\u00fcche im Hintergrund durch WakeLock und Keep-Alive und setzt den Fortschritt bei R\u00fcckkehr automatisch fort."
    }
  },
  "0.9.6": {
    "title": {
      "ko": "모바일 Safari 완성본 비디오(Blob) IndexedDB 영구 보존 및 브라우저 재실행 시 0초 즉시 재생·다운로드 모드 지원",
      "en": "Preserve Stitched Final Video in IndexedDB on Mobile & Enable Instant 0s Playback & Download on Reopen",
      "ja": "モバイルSafariで完成動画(Blob)をIndexedDBに永続保持＆再起動時0秒即時再生・ダウンロードに対応",
      "zh": "移动端 Safari 最终成品视频 (Blob) IndexedDB 持久化保存与重开即享 0 秒直接播放/下载",
      "es": "Conservar el video final en IndexedDB en móviles y permitir reproducción y descarga instantáneas al reabrir",
      "fr": "Conserver la vidéo finale dans IndexedDB sur mobile et activer la lecture et le téléchargement instantanés à la réouverture",
      "de": "Speichern des fertigen Videos in IndexedDB auf Mobilgeräten & sofortiges Abspielen und Herunterladen beim Neustart"
    },
    "summary": {
      "ko": "아이폰 Safari 등 모바일 환경에서 수백 MB의 원본 영상 18개는 메모리 보호를 위해 분리 보관하면서도, 최종 완성본 비디오(Blob) 1개는 IndexedDB에 안전하게 영구 보존하도록 스토리지를 개선했습니다. 브라우저를 완전히 강제 종료한 뒤 재접속하더라도 불필요한 '원본 영상 18개 연결 필요' 경고를 띄우지 않고, 완성본 비디오를 고화질 하드웨어 가속으로 즉시 재생하거나 0초 만에 바로 다운로드할 수 있도록 사용자 경험을 전면 개선했습니다.",
      "en": "Safely stores the single rendered final video blob in IndexedDB on mobile browsers, while leaving multi-gigabyte raw source clips unloaded to prevent WebKit memory crashes. When reopening the browser, users can immediately watch or download their finished video in 0 seconds without being asked to reconnect 18 raw files.",
      "ja": "iPhone Safari等のモバイル環境で数十本の重い元動画はメモリ保護のため除外したまま、完成した単一の動画BlobをIndexedDBへ安全に永続保存。ブラウザ強制終了後の再起動時も「元動画18件の再接続が必要」警告を出さず、完成動画を即座に再生・ダウンロードできるように改善しました。",
      "zh": "在移动端 Safari 环境中，将多段庞大原始视频排除以保护内存，同时将已合成完毕的单一成品视频 (Blob) 安全持久化至 IndexedDB。重启浏览器后不再弹出烦人的「需重新关联18个原始视频」警告，支持 0 秒直接播放与免重新合成下载。",
      "es": "Guarda el video final en IndexedDB en navegadores móviles para evitar advertencias de reconexión y permitir la descarga instantánea.",
      "fr": "Enregistre la vidéo finale dans IndexedDB sur les navigateurs mobiles pour éviter les avertissements de reconnexion et permettre un téléchargement instantané.",
      "de": "Speichert das fertige Video in IndexedDB auf Mobilgeräten, um Neuverbindungswarnungen zu vermeiden und sofortiges Herunterladen zu ermöglichen."
    }
  },
  "0.9.5": {
    "title": {
      "ko": "스토리지 설정 내 OPFS 가상 파일시스템 및 브라우저 캐시 비우기 기능 추가",
      "en": "Add OPFS Virtual Filesystem & Browser Storage Purge Button in Settings",
      "ja": "ストレージ設定にOPFS仮想ファイルシステムおよびブラウザキャッシュ削除機能を追加",
      "zh": "在设置中新增 OPFS 虚拟文件系统及浏览器存储缓存一键清理功能",
      "es": "Botón de purga de almacenamiento y sistema de archivos OPFS en configuración",
      "fr": "Bouton de purge du cache du stockage du navigateur et du système OPFS dans les paramètres",
      "de": "Speicherbereinigung und OPFS-Dateisystem-Löschfunktion in den Einstellungen hinzugefügt"
    },
    "summary": {
      "ko": "보관함 내 프로젝트를 모두 삭제한 이후에도 브라우저 Origin 스토리지(OPFS 잔여 임시 파일, Service Worker/CacheStorage 비디오 캐시, 리소스 버퍼)에 수백 MB가 남아있을 수 있던 현상을 완전히 해소하기 위해, 스튜디오 설정에 [저장 공간 정리 (캐시 비우기)] 버튼을 도입했습니다. 또한 아이폰에서 18개 이상의 고화질 영상을 동시 선택할 때 iOS 사진 선택창(Photo Picker)이 자체 메모리 초과로 닫히는 현상에 대응하여 기기 공간 확보 및 분할 추가 가이드를 마련했습니다.",
      "en": "Introduced a dedicated 'Clear Storage (Purge Cache)' button in Studio Settings to wipe orphaned OPFS temporary directories and browser CacheStorage. Addressed iOS native Photo Picker crashes where selecting 18+ high-res clips causes the picker sheet to abruptly dismiss due to iOS memory pressure.",
      "ja": "プロジェクトを全削除した後もブラウザストレージ（OPFS残存一時ファイル、CacheStorage動画キャッシュ）に残る容量を完全にリセットできる「ストレージ整理（キャッシュ削除）」ボタンを追加しました。またiPhoneで18本以上の動画選択時にiOS写真ピッカーがメモリ制限で閉じる問題への対処ガイドを整備しました。",
      "zh": "在工作台设置中新增「清理存储空间（清除缓存）」功能，可彻底删除 OPFS 遗留临时目录及浏览器缓存。同时针对 iPhone 批量选择 18+ 视频时因 iOS 系统相册内存超限自动关闭的问题提供分批上传建议。",
      "es": "Se agregó un botón para limpiar el almacenamiento de caché y OPFS en la configuración del estudio.",
      "fr": "Ajout d'un bouton de nettoyage du stockage et du système OPFS dans les paramètres du studio.",
      "de": "Schaltfläche zur vollständigen Bereinigung von OPFS-Dateien und Browser-Caches in den Studio-Einstellungen hinzugefügt."
    }
  },
  "0.9.4": {
    "title": {
      "ko": "아이폰(iOS Safari) 대량 영상(18개+) 업로드 시 비디오 엘리먼트 디코더 고갈 및 새로고침 크래시 해결",
      "en": "Fix iPhone (iOS Safari) Mass Upload (18+) Video Decoder Exhaustion & WebProcess Reload Crash",
      "ja": "iPhone(iOS Safari)大量動画(18件以上)アップロード時のデコーダ枯渇およびクラッシュ・リロードの解決",
      "zh": "解决 iPhone (iOS Safari) 批量上传大批量视频(18+)时视频解码器耗尽导致的网页崩溃刷新问题",
      "es": "Solución al agotamiento de decodificadores y bloqueo de recarga en iPhone (iOS Safari) al subir múltiples videos (18+)",
      "fr": "Correction du plantage et rechargement sur iPhone (iOS Safari) lors du téléversement en masse (18+ vidéos)",
      "de": "Behebung von Decoder-Erschöpfung und WebProcess-Abstürzen auf dem iPhone (iOS Safari) beim Massenupload (18+ Videos)"
    },
    "summary": {
      "ko": "아이폰에서 18개 이상의 영상을 한 번에 업로드할 때 발생하던 Safari 새로고침(WebProcess Jetsam OOM) 크래시를 완전히 해결했습니다. <video> 엘리먼트를 여러 개 생성해 시크(seek)하는 무거운 방식 대신, QuickTime/MP4 컨테이너의 mvhd/tkhd 박스를 순수 바이너리로 파싱하여 디코더 가동 없이 0.05ms 만에 정확한 재생 길이, 해상도, 회전 각도를 즉각 추출하도록 혁신했습니다. 모바일에서는 첫 번째 영상에만 대표 썸네일을 가볍게 추출하고 나머지 영상은 디코더를 생성하지 않으며, 영상 처리 사이 40ms GC 틱을 보장합니다.",
      "en": "Resolved the Safari WebProcess Jetsam OOM reload crash when uploading 18+ video files on iPhone. Replaced heavy seeking video elements with a lightweight binary MP4/QuickTime mvhd/tkhd parser that extracts duration, resolution, and rotation in 0.05ms without decoder allocation. Mobile devices generate a thumbnail only for the first clip while bypassing decoder creation for remaining clips, complemented by 40ms GC pauses.",
      "ja": "iPhoneで18本以上の動画を一括アップロードする際に発生していたSafariの再読み込み（WebProcess OOM）クラッシュを完全に解決しました。<video>要素を連続生成してシークする重い方式を改め、QuickTime/MP4コンテナのmvhd/tkhdボックスを純粋なバイナリ解析することでデコーダを起動せずに0.05msで正確な再生時間・解像度・回転角を即時抽出します。モバイルでは先頭動画のみ軽量に代表サムネイルを生成し、動画処理間に40msのGCインターバルを確保しました。",
      "zh": "彻底解决了在 iPhone 上一次性上传 18 个以上视频时触发的 Safari 页面自动刷新崩溃问题。用纯二进制解析 QuickTime/MP4 容器的 mvhd/tkhd 盒子替代了频繁创建 <video> 标签并 seek 的繁重操作，无需任何硬件解码器即可在 0.05ms 内提取时长、分辨率及旋转角。移动端仅对首个视频生成代表缩略图，后续视频完全免除解码器创建，并加入 40ms GC 间隔保护。",
      "es": "Se solucionó por completo el bloqueo por falta de memoria (Jetsam OOM) en Safari al subir 18 o más videos en iPhone. Se reemplazó la creación de elementos <video> con un analizador binario puro de cajas mvhd/tkhd que extrae duración y dimensiones en 0.05ms sin decodificadores.",
      "fr": "Résolution définitive du rechargement forcé de Safari lors du téléversement de 18+ vidéos sur iPhone en remplaçant la création d'éléments vidéo par un analyseur binaire direct des boîtes mvhd/tkhd en 0,05 ms sans aucun décodeur matériel.",
      "de": "Vollständige Behebung von Safari-WebProcess-Neuladeabbrüchen beim Hochladen von 18+ Videos auf dem iPhone durch Einführung eines reinen binären Parsers für mvhd/tkhd-Boxen ohne Hardware-Decoder-Nutzung."
    }
  },
  "0.9.3": {
    "title": {
      "ko": "아이폰(iOS Safari) 다중 영상 내보내기 프레임 드랍 해결 및 디코더 1:1 동기화",
      "en": "Fix Multi-Video Export Frame Drops on iPhone (iOS Safari) & 1:1 Decoder Frame Sync",
      "ja": "iPhone(iOS Safari)複数動画書き出し時のフレームドロップ解決およびデコーダ1:1同期化",
      "zh": "解决 iPhone (iOS Safari) 多视频导出掉帧卡顿问题并实现解码器 1:1 帧同步",
      "es": "Corrección de caída de fotogramas al exportar múltiples videos en iPhone (iOS Safari) y sincronización 1:1",
      "fr": "Correction des pertes d'images à l'export multi-vidéos sur iPhone (iOS Safari) et synchronisation 1:1",
      "de": "Behebung von Frame-Drops beim Multi-Video-Export auf dem iPhone (iOS Safari) & 1:1-Decoder-Synchronisation"
    },
    "summary": {
      "ko": "아이폰에서 다수의 영상을 편집·병합하여 다운로드할 때 발생하던 프레임 드랍(멈칫거림·건너뛰기) 현상을 해결했습니다. 벽시계 가상 보간 클럭으로 인한 중복/스킵 캡처를 제거하고 requestVideoFrameCallback 실측 미디어 시간 1:1 동기화, DOM 프리뷰 비디오 디코더 슬롯 임시 반환 및 다중 영상 전환 시 디코더 플러시를 적용했습니다.",
      "en": "Eliminated severe frame drops and stuttering when exporting 18+ clips on iPhone by replacing synthetic wall-clock interpolation with strict requestVideoFrameCallback mediaTime synchronization, releasing DOM preview hardware decoder slots during export, and flushing decoder pipelines across clip switches.",
      "ja": "iPhoneで多数の動画を編集・結合してダウンロードする際に発生していたフレームドロップ（カクつき・フレーム飛ばし）を解決しました。仮想補間クロックによる重複・スキップを排除し、requestVideoFrameCallbackの実測メディア時間との1:1同期、DOMプレビュー動画のデコーダスロット一時解放、動画切り替え時のデコーダフラッシュを適用しました。",
      "zh": "解决了在 iPhone 上编辑并导出多个视频时出现的严重掉帧与卡顿现象。移除了虚拟时钟插值导致的重复/跳帧捕获，改为基于 requestVideoFrameCallback 实际解码时间的 1:1 精确同步，并在导出期间释放 DOM 预览视频硬件解码器槽位。",
      "es": "Se eliminaron las caídas de fotogramas al exportar múltiples clips en iPhone sincronizando estrictamente con el tiempo real de requestVideoFrameCallback, liberando ranuras de decodificador de hardware durante la exportación y limpiando el pipeline entre videos.",
      "fr": "Résolution des saccades et pertes d'images lors de l'export de nombreuses vidéos sur iPhone grâce à la synchronisation 1:1 via requestVideoFrameCallback, la libération temporaire des décodeurs matériels du DOM et le vidage du pipeline entre les clips.",
      "de": "Starke Frame-Drops beim Exportieren vieler Clips auf dem iPhone wurden behoben, indem die synthetische Zeitinterpolation durch eine strikte 1:1-Synchronisation via requestVideoFrameCallback ersetzt und Hardware-Decoder-Slots während des Exports freigegeben wurden."
    }
  },
  "0.9.2": {
    "title": {
      "ko": "아이폰(iOS Safari) 업로드 직후 자동 저장·메타데이터 파싱 메모리 크래시 원천 차단",
      "en": "Prevent iOS Safari Post-Upload Auto-Save & Metadata Parsing Memory Crashes",
      "ja": "iPhone(iOS Safari)アップロード直後の自動保存・メタデータ解析によるメモリクラッシュを防止",
      "zh": "彻底解决 iPhone (iOS Safari) 批量上传视频后自动保存与元数据解析导致的内存崩溃刷新问题",
      "es": "Prevención de cierres de memoria en iOS Safari tras subir videos por autoguardado y metadatos",
      "fr": "Correction des plantages mémoire iOS Safari après l'envoi liés à la sauvegarde auto et aux métadonnées",
      "de": "Behebung von iOS-Safari-Speicherabstürzen nach dem Upload durch Auto-Save und Metadaten-Parsing"
    },
    "summary": {
      "ko": "아이폰 XR 등 모바일 기기에서 다중 영상 업로드 직후 아무 버튼을 누르지 않아도 백그라운드 자동 저장(IndexedDB/OPFS 원본 Blob 직렬화)과 촬영일·GPS 메타데이터 중복 버퍼 스캔으로 인해 Safari가 강제 새로고침되던 문제를 완벽히 해결했습니다.",
      "en": "Resolved an issue on iPhone XR and mobile Safari where the page crashed and reloaded shortly after uploading multiple videos due to background auto-save raw Blob serialization in IndexedDB/OPFS and duplicate multi-megabyte metadata buffer scans.",
      "ja": "iPhone XRなどのモバイル端末で複数動画をアップロードした直後、バックグラウンド自動保存（IndexedDB/OPFSへの元動画Blobシリアライズ）や撮影日・GPSメタデータの重複バッファ走査によりSafariが強制再読み込みされる問題を解決しました。",
      "zh": "解决了 iPhone XR 等移动设备在上传多个视频后，即使不点击任何按钮也会因后台自动保存（IndexedDB/OPFS 原始视频 Blob 序列化）及拍摄日期与 GPS 元数据重复大缓冲区扫描导致 Safari 强制刷新的问题。",
      "es": "Se resolvió el problema en iPhone XR y Safari móvil donde la página se reiniciaba poco después de subir varios videos debido a la serialización de Blobs en el autoguardado y el escaneo duplicado de metadatos.",
      "fr": "Résolution du rechargement forcé de Safari sur iPhone XR peu après l'envoi de plusieurs vidéos, causé par la sérialisation de fichiers bruts lors de la sauvegarde automatique et l'analyse dupliquée des métadonnées.",
      "de": "Problem auf dem iPhone XR und im mobilen Safari behoben, bei dem die Seite kurz nach dem Hochladen mehrerer Videos durch Rohdaten-Serialisierung beim Auto-Save und doppeltes Metadaten-Scannen neu geladen wurde."
    }
  },
  "0.9.1": {
    "title": {
      "ko": "다중 영상 처리 메모리·디코더 최적화 및 메타데이터·성능 표기 개선",
      "en": "Multi-Video Memory & Decoder Optimization and Metadata/Performance Refinements",
      "ja": "複数動画処理のメモリ・デコーダー最適化およびメタデータ・性能表示の改善",
      "zh": "多视频处理内存与解码器优化及元数据、性能指标显示改进",
      "es": "Optimización de memoria y decodificador para múltiples videos y mejoras de metadatos",
      "fr": "Optimisation mémoire et décodeur multi-vidéos et améliorations des métadonnées",
      "de": "Speicher- und Decoder-Optimierung für mehrere Videos sowie Metadaten-Verbesserungen"
    },
    "summary": {
      "ko": "모바일·PC 대량 영상 업로드 및 AI 하이라이트 분석·병합 시 비디오 디코더 즉시 해제, 단일 캔버스 재사용, 오디오 구간 슬라이싱으로 메모리 초과(OOM) 크래시를 방지하고, 촬영일자·GPS 인식 및 모델 성능 메트릭 표기를 정밀화했습니다.",
      "en": "Prevented Out-Of-Memory (OOM) crashes during large batch uploads, AI highlight analysis, and stitching on mobile and PC via immediate decoder cleanup, single canvas reuse, and audio buffer slicing, alongside enhanced date/GPS parsing and live model performance metrics.",
      "ja": "モバイル・PCでの大量動画アップロードやAIハイライト解析・結合時に、デコーダー即時解放、単一キャンバスの再利用、音声区間スライシングによりメモリ不足(OOM)クラッシュを防止し、撮影日時・GPS認識およびモデル性能表示を精緻化しました。",
      "zh": "在移动端与PC端批量上传视频及AI高光分析、拼接时，通过立即释放解码器、复用单一画布及音频片段裁剪防止内存溢出(OOM)崩溃，并优化了拍摄日期、GPS解析与模型性能指标展示。",
      "es": "Se evitaron cierres por falta de memoria (OOM) al procesar muchos videos mediante liberación inmediata del decodificador, reutilización de lienzo único y recorte de búfer de audio, además de mejorar la detección de fecha/GPS.",
      "fr": "Prévention des plantages mémoire (OOM) lors du traitement de nombreuses vidéos grâce à la libération immédiate du décodeur, la réutilisation d'un canevas unique et le découpage audio, avec amélioration des métadonnées.",
      "de": "Speicherabstürze (OOM) bei vielen Videos auf Mobilgeräten und PCs durch sofortige Decoder-Freigabe, Einzel-Canvas-Wiederverwendung und Audio-Slicing behoben sowie Aufnahmezeit-/GPS-Erkennung verbessert."
    }
  },
  "0.9.0": {
    "title": {
      "ko": "피드백 & 개선 요청 게시판 연동 및 패치노트 시스템 도입",
      "en": "Feedback & Improvement Board Integration & Patch Notes System",
      "ja": "フィードバック＆改善要望掲示板の連携およびパッチノートシステムの導入",
      "zh": "接入反馈与建议讨论板及上线更新日志系统",
      "es": "Integración del tablón de sugerencias y sistema de notas del parche",
      "fr": "Intégration du tableau de retours et système de notes de version",
      "de": "Feedback-Board-Integration und Patch-Notes-System"
    },
    "summary": {
      "ko": "서비스 이용 중 불편사항이나 개선 아이디어를 남길 수 있는 피드백 게시판 연동과 버전별 변경 사항을 확인할 수 있는 패치노트가 추가되었습니다.",
      "en": "Added integration with a feedback board for reporting issues or suggestions, along with patch notes to track changes across versions.",
      "ja": "ご利用中のご不便や改善アイデアを投稿できるフィードバック掲示板と、バージョンごとの更新内容を確認できるパッチノートを追加しました。",
      "zh": "接入了可提交使用问题与改进建议的反馈讨论板，并上线了可查看各版本更新内容的更新日志。",
      "es": "Se añadió la integración con el tablón de comentarios para reportar problemas o ideas, junto con notas de versión para consultar los cambios.",
      "fr": "Ajout d'un tableau de retours pour signaler des problèmes ou proposer des idées, ainsi que de notes de version pour suivre les modifications.",
      "de": "Feedback-Board zum Einreichen von Problemen oder Ideen integriert, sowie Patch-Notes zur Einsicht aller Versionsänderungen hinzugefügt."
    }
  },
  "0.8.1": {
    "title": {
      "ko": "1080p(FHD) 및 720p 해상도 선택 내보내기 팝업 연동",
      "en": "1080p (FHD) & 720p Resolution Export Popup Integration",
      "ja": "1080p(FHD)および720p解像度選択エクスポートポップアップの連携",
      "zh": "接入 1080p(FHD) 与 720p 分辨率导出弹窗",
      "es": "Integración de ventana emergente para elegir resolución de exportación 1080p (FHD) y 720p",
      "fr": "Fenêtre contextuelle de sélection de résolution d'export 1080p (FHD) et 720p",
      "de": "Export-Popup zur Auswahl der Auflösung in 1080p (FHD) und 720p integriert"
    },
    "summary": {
      "ko": "다운로드 시 1080p FHD 및 720p HD 해상도를 직접 선택할 수 있는 팝업 모달이 추가되고 우측 중복 설정 카드가 정리되었습니다.",
      "en": "Added a popup modal to select between 1080p FHD and 720p HD upon download, and cleaned up duplicate setting cards on the right.",
      "ja": "ダウンロード時に1080p FHDまたは720p HD解像度を直接選択できるポップアップモーダルを追加し、右側の重複設定カードを整理しました。",
      "zh": "新增了下载时可自主选择 1080p FHD 与 720p HD 分辨率的弹窗，并清理了右侧重复的设置卡片。",
      "es": "Se agregó un modal emergente para seleccionar entre 1080p FHD y 720p HD al descargar, y se limpiaron las tarjetas duplicadas.",
      "fr": "Ajout d'une modale permettant de choisir entre 1080p FHD et 720p HD lors du téléchargement, et nettoyage des paramètres en double.",
      "de": "Pop-up-Modal zur Auswahl zwischen 1080p FHD und 720p HD beim Download hinzugefügt und doppelte Einstellungskarten aufgeräumt."
    }
  },
  "0.8.0": {
    "title": {
      "ko": "실시간 WYSIWYG 시퀀스 컴포지터 & BGM 배속 자동 동기화",
      "en": "Real-time WYSIWYG Sequence Compositor & BGM Speed Auto-Sync",
      "ja": "リアルタイムWYSIWYGシーケンスコンポジター＆BGM速度自動同期",
      "zh": "实时所见即所得序列合成器与背景音乐语速自动同步",
      "es": "Compositor de secuencia WYSIWYG en tiempo real y sincronización automática de BGM",
      "fr": "Compositeur de séquence WYSIWYG en temps réel et synchronisation automatique du tempo BGM",
      "de": "Echtzeit-WYSIWYG-Sequenzkompositor und automatische BGM-Geschwindigkeitssynchronisation"
    },
    "summary": {
      "ko": "캡컷 방식의 실시간 시퀀스 프리뷰 컴포지터 도입으로 내보내기 대기시간을 혁신적으로 단축하고, 배경음악 배속 자동 동기화 및 렌더링 프레임 끊김을 해결했습니다.",
      "en": "Drastically reduced export wait times with a CapCut-style real-time sequence preview compositor, automated BGM speed syncing, and fixed rendering frame stutter.",
      "ja": "CapCut方式のリアルタイムシーケンスプレビューコンポジターの導入により書き出し待ち時間を大幅短縮し、BGMの速度自動同期とレンダリングのコマ落ちを解消しました。",
      "zh": "引入类似剪映的实时序列预览合成器，大幅缩短导出等待时间，并实现背景音乐倍速自动同步，解决渲染掉帧卡顿。",
      "es": "Reducción drástica del tiempo de exportación con un compositor de vista previa en tiempo real estilo CapCut, sincronización de BGM y solución de caídas de fotogramas.",
      "fr": "Réduction radicale du temps d'attente d'exportation grâce à un compositeur de prévisualisation en temps réel style CapCut, synchronisation BGM et correction des saccades.",
      "de": "Drastische Reduzierung der Exportwartezeit durch CapCut-artigen Echtzeit-Sequenzvorschau-Kompositor, automatische BGM-Synchronisation und Behebung von Rucklern."
    }
  },
  "0.7.0": {
    "title": {
      "ko": "WebCodecs GPU 하드웨어 가속 60fps 비디오 렌더러 구현",
      "en": "WebCodecs GPU Hardware-Accelerated 60fps Video Renderer",
      "ja": "WebCodecs GPU ハードウェアアクセラレーション 60fps ビデオレンダラー実装",
      "zh": "基于 WebCodecs 的 GPU 硬件加速 60fps 视频渲染器",
      "es": "Renderizador de video de 60 fps con aceleración por hardware GPU mediante WebCodecs",
      "fr": "Moteur de rendu vidéo 60 fps accéléré par matériel GPU avec WebCodecs",
      "de": "WebCodecs GPU-hardwarebeschleunigter 60fps-Videorenderer"
    },
    "summary": {
      "ko": "차세대 WebCodecs API 기반 하드웨어 가속 60fps 렌더러를 구축하여 영상 병합 속도를 대폭 향상하고 모바일 반응형 30fps 최적화 및 화면 꺼짐 방지(Screen Wake Lock)를 적용했습니다.",
      "en": "Built a next-gen WebCodecs API hardware-accelerated 60fps renderer to dramatically boost stitching speed, with mobile 30fps optimization and Screen Wake Lock.",
      "ja": "次世代WebCodecs APIベースのハードウェアアクセラレーション60fpsレンダラーを構築して動画結合速度を大幅向上させ、モバイル向け30fps最適化と画面スリープ防止を適用しました。",
      "zh": "基于新一代 WebCodecs API 构建 GPU 硬件加速 60fps 渲染器，大幅提升视频拼接速度，并提供移动端 30fps 优化与防息屏(Screen Wake Lock)。",
      "es": "Implementación de renderizador a 60 fps acelerado por hardware con WebCodecs API, optimización a 30 fps para móviles y bloqueo de suspensión de pantalla.",
      "fr": "Moteur de rendu 60 fps accéléré par GPU avec WebCodecs API pour décupler la vitesse d'assemblage, optimisation 30 fps mobile et Screen Wake Lock.",
      "de": "Hardwarebeschleunigter 60fps-Renderer auf Basis der WebCodecs API zur Beschleunigung des Zusammenfügens, mobile 30fps-Optimierung und Screen Wake Lock."
    }
  },
  "0.6.0": {
    "title": {
      "ko": "원본 영상 기반 클립 구간 세밀 편집(Trim) 모달 및 대용량 OPFS 로드맵",
      "en": "Clip Precision Trim Modal & High-Capacity OPFS Storage Roadmap",
      "ja": "元動画ベースのクリップ区間精密トリミングモーダル＆大容量OPFSロードマップ",
      "zh": "基于原片的片段精细裁剪(Trim)弹窗与大容量 OPFS 路线图",
      "es": "Modal de recorte preciso de clips y hoja de ruta de almacenamiento OPFS",
      "fr": "Modale d'ajustement précis des clips et feuille de route stockage haute capacité OPFS",
      "de": "Präzises Clip-Trim-Modal und Roadmap für OPFS-Speicher mit hoher Kapazität"
    },
    "summary": {
      "ko": "클립 구간을 초 단위로 정밀하게 조절할 수 있는 세밀 편집(Trim) 모달 추가, 시퀀스 타임라인 실시간 스크러빙, 썸네일 AI 자동 줄바꿈 및 브라우저 대용량 저장소(OPFS) 로드맵을 구축했습니다.",
      "en": "Added precision trim modal for second-by-second clip adjustment, real-time sequence scrubbing, AI thumbnail auto-line-wrap, and browser OPFS large storage architecture.",
      "ja": "クリップ区間を秒単位で精密に調整できるトリミングモーダル、シーケンスタイムラインのリアルタイムスクラブ、サムネイルAI自動改行、大容量OPFSストレージ基盤を構築しました。",
      "zh": "新增支持逐秒微调片段的裁剪弹窗、序列时间轴实时拖动擦除、缩略图 AI 智能换行，并构建了浏览器 OPFS 大容量存储体系。",
      "es": "Modal de recorte de precisión por segundos, depuración en tiempo real en línea de tiempo, ajuste de líneas en miniaturas y almacenamiento OPFS.",
      "fr": "Modale de rognage précis à la seconde, défilement en temps réel de la timeline, retour à la ligne IA des miniatures et stockage OPFS.",
      "de": "Präzises Trim-Modal zur sekundengenauen Anpassung, Echtzeit-Scrubbing der Timeline, automatische KI-Thumbnail-Umbrüche und OPFS-Speicherarchitektur."
    }
  },
  "0.5.1": {
    "title": {
      "ko": "무정지(Zero-Freeze) 진행률 엔진 & 반응형 제논 점근 보간 시스템",
      "en": "Zero-Freeze Progress Engine & Responsive Zeno Asymptotic Interpolation",
      "ja": "フリーズ防止(Zero-Freeze)プログレスエンジン＆ゼノン漸近補間システム",
      "zh": "无停顿(Zero-Freeze)进度引擎与响应式芝诺渐近插值系统",
      "es": "Motor de progreso sin congelamiento y sistema de interpolación asintótica de Zenón",
      "fr": "Moteur de progression sans gel et système d'interpolation asymptotique de Zénon",
      "de": "Freeze-freie Progress-Engine und reaktives asymptotisches Zeno-Interpolationssystem"
    },
    "summary": {
      "ko": "AI 영상 분석 중 진행률이 멈추지 않는 무정지 엔진 도입, 모바일 Blob 유실 방어 및 재생 URL 자동 복구 등 모바일 안정성을 대폭 강화했습니다.",
      "en": "Introduced a Zero-Freeze progress engine that prevents stalling during AI analysis, along with mobile Blob loss protection and auto playback URL recovery.",
      "ja": "AI動画解析中に進行状況が止まらないフリーズ防止エンジンを導入し、モバイルでのBlob消失防止や再生URL自動復旧などモバイル安定性を大幅に強化しました。",
      "zh": "引入在 AI 视频分析过程中防止进度停滞的无停顿引擎，并增加了移动端 Blob 丢失防护与播放 URL 自动恢复等稳定性保障。",
      "es": "Introducción de motor de progreso sin bloqueos durante el análisis de IA, protección contra pérdida de Blobs móviles y recuperación automática de URLs de reproducción.",
      "fr": "Moteur de progression sans gel évitant tout blocage pendant l'analyse IA, protection contre la perte de Blob mobile et restauration automatique des URL de lecture.",
      "de": "Einführung einer unterbrechungsfreien Progress-Engine während der KI-Analyse sowie Schutz vor Blob-Verlust auf Mobilgeräten und automatische Wiederherstellung von Wiedergabe-URLs."
    }
  },
  "0.5.0": {
    "title": {
      "ko": "IndexedDB 스튜디오 작업 보관함 및 실시간 자동 저장 시스템",
      "en": "IndexedDB Studio Vault & Real-Time Auto-Save System",
      "ja": "IndexedDB スタジオ作業保管庫＆リアルタイム自動保存システム",
      "zh": "基于 IndexedDB 的工作室项目保险库与实时自动保存系统",
      "es": "Almacén de proyectos de estudio en IndexedDB y sistema de guardado automático en tiempo real",
      "fr": "Coffre de projets de studio IndexedDB et sauvegarde automatique en temps réel",
      "de": "IndexedDB-Projektarchiv und automatisches Echtzeit-Speichersystem"
    },
    "summary": {
      "ko": "브라우저 IndexedDB 기반 스튜디오 작업 보관함을 구축하여 작업 중인 프로젝트가 실시간으로 자동 저장되고 언제든 복원할 수 있도록 지원합니다.",
      "en": "Built a browser IndexedDB-based studio project vault ensuring active projects auto-save in real time and can be restored at any time.",
      "ja": "ブラウザのIndexedDBを活用したスタジオ作業保管庫を構築し、作業中のプロジェクトがリアルタイムで自動保存され、いつでも復元できるようにしました。",
      "zh": "构建了基于浏览器 IndexedDB 的工作室项目存储库，支持当前正在编辑的项目实时自动保存，并可随时恢复。",
      "es": "Creación de almacén de proyectos en el navegador con IndexedDB con autoguardado en tiempo real y restauración en cualquier momento.",
      "fr": "Système de stockage de studio basé sur IndexedDB avec sauvegarde automatique en temps réel et restauration instantanée des projets.",
      "de": "Erstellung eines browserbasierten IndexedDB-Projektarchivs mit automatischer Echtzeitspeicherung und Wiederherstellung zu jeder Zeit."
    }
  },
  "0.4.1": {
    "title": {
      "ko": "AI 썸네일 추천 프레임 자동 연동 및 NLE 멀티트랙 타임라인 정밀 동기화",
      "en": "AI Recommended Thumbnail Frame & NLE Multi-Track Timeline Sync",
      "ja": "AIおすすめサムネイルフレーム自動連携＆NLEマルチトラック高精度同期",
      "zh": "AI 推荐缩略图帧联动与 NLE 多轨时间轴精确同步",
      "es": "Fotograma de miniatura recomendado por IA y sincronización de línea de tiempo NLE multipista",
      "fr": "Sélection de miniature recommandée par IA et synchronisation de la timeline multipiste NLE",
      "de": "Von KI empfohlenes Thumbnail-Frame und präzise NLE-Mehrspur-Timeline-Synchronisation"
    },
    "summary": {
      "ko": "AI가 가장 극적인 프레임을 분석하여 썸네일로 자동 추천하며, 시퀀스 타임라인 V1 영상과 A1 오디오 멀티트랙 동기화 및 끊김 현상을 개선했습니다.",
      "en": "AI automatically identifies and recommends the most dramatic frame as thumbnail, while resolving video V1 and audio A1 multi-track desync and stuttering.",
      "ja": "AIが最もドラマチックなフレームを解析してサムネイルとして自動提案し、V1映像とA1音声マルチトラックの同期ずれや音飛びを解消しました。",
      "zh": "AI 自动分析并推荐最富张力的精彩瞬间作为视频缩略图，并优化了 V1 视频与 A1 音频多轨同步与卡顿问题。",
      "es": "La IA analiza y sugiere automáticamente el fotograma más impactante como miniatura, mejorando la sincronización de pistas de video V1 y audio A1.",
      "fr": "L'IA identifie et suggère automatiquement la séquence la plus spectaculaire comme miniature, tout en synchronisant les pistes vidéo V1 et audio A1.",
      "de": "Die KI analysiert und empfiehlt automatisch das dramatischste Frame als Thumbnail und synchronisiert die V1-Video- und A1-Audiospuren nahtlos."
    }
  },
  "0.4.0": {
    "title": {
      "ko": "HyperFrames 키네틱 챕터 브릿지 모션 엔진 & GPS 역지오코딩",
      "en": "HyperFrames Kinetic Chapter Bridge Motion Engine & GPS Reverse Geocoding",
      "ja": "HyperFrames キネティックチャプターブリッジモーションエンジン＆GPS逆ジオコーディング",
      "zh": "HyperFrames 动态章节转场过渡动效引擎与 GPS 逆地理编码",
      "es": "Motor de movimiento cinético HyperFrames para transiciones de capítulo y geocodificación inversa",
      "fr": "Moteur d'effets cinétiques de transition HyperFrames et géocodage inversé GPS",
      "de": "HyperFrames kinetische Kapitelübergangs-Motion-Engine und GPS-Rückwärts-Geokodierung"
    },
    "summary": {
      "ko": "GSAP 결정론적 타임라인 기반 5단 키네틱 루버 와이프 챕터 브릿지 모션 엔진을 탑재하고, 촬영 날짜 플립 및 GPS 역지오코딩 장소명 자동 매핑을 지원합니다.",
      "en": "Introduced a 5-stage kinetic louver wipe chapter transition engine powered by GSAP deterministic timelines, desktop clock date flips, and GPS reverse geocoded location mapping.",
      "ja": "GSAPの決定論的タイムラインに基づく5段階キネティックルーバーワイプのチャプターブリッジを搭載し、撮影日フリップクロックやGPS逆ジオコーディングによる地名自動マッピングに対応しました。",
      "zh": "搭载基于 GSAP 确定性时间轴的五段动态百叶百叶窗转场动画，并支持拍摄日期翻页钟表动效及 GPS 逆地理位置自动解析。",
      "es": "Incorporación de motor de transiciones cinéticas en 5 etapas con GSAP, reloj abatible de fecha de grabación y mapeo de ubicaciones por GPS.",
      "fr": "Intégration d'un moteur de transitions cinétiques à 5 volets basé sur GSAP, horloge à volets pour la date et géocodage GPS automatique.",
      "de": "Einführung einer 5-stufigen kinetischen Lamellen-Wipe-Übergangs-Engine mit GSAP, Flip-Clock-Aufnahmedatum und automatischer GPS-Standortzuordnung."
    }
  },
  "0.3.1": {
    "title": {
      "ko": "유튜브 호환 SRT 자막 다운로드 및 iOS Safari 재생 안정화",
      "en": "YouTube-Compatible SRT Subtitle Download & iOS Safari Playback Stabilization",
      "ja": "YouTube互換SRT字幕ダウンロード＆iOS Safari再生の安定化",
      "zh": "支持 YouTube 兼容的 SRT 字幕下载与 iOS Safari 播放稳定性优化",
      "es": "Descarga de subtítulos SRT compatibles con YouTube y estabilización en iOS Safari",
      "fr": "Téléchargement de sous-titres SRT compatibles YouTube et stabilisation iOS Safari",
      "de": "YouTube-kompatibler SRT-Untertitel-Download und Stabilisierung der iOS Safari-Wiedergabe"
    },
    "summary": {
      "ko": "유튜브 규격 다국어 SRT 자막 다운로드 지원, WebKit Bug 212275 회피, 캔버스 상시 하트비트 및 iOS Safari 하드웨어 디코더 파이프라인 안정화를 적용했습니다.",
      "en": "Added YouTube-compliant multilingual SRT subtitle downloads, workaround for WebKit Bug 212275, continuous canvas heartbeat, and iOS Safari hardware decoder pipeline stabilization.",
      "ja": "YouTube規格の多言語SRT字幕ダウンロード対応、WebKit Bug 212275回避、Canvas常時ハートビート、iOS Safariハードウェアデコーダーパイプラインの安定化を適用しました。",
      "zh": "支持下载 YouTube 标准的多语言 SRT 字幕文件，规避 WebKit Bug 212275，引入 Canvas 持续心跳保活及 iOS Safari 硬件解码管线稳定性优化。",
      "es": "Descarga de subtítulos SRT multilingües para YouTube, solución para WebKit Bug 212275, latido continuo de canvas y estabilización de decodificador en iOS Safari.",
      "fr": "Téléchargement de sous-titres SRT multilingues compatibles YouTube, contournement du bogue WebKit 212275 et stabilisation matérielle iOS Safari.",
      "de": "YouTube-konformer mehrsprachiger SRT-Untertitel-Download, Umgehung des WebKit-Fehlers 212275 und Stabilisierung der iOS Safari-Hardware-Decoder-Pipeline."
    }
  },
  "0.3.0": {
    "title": {
      "ko": "유튜브 영상 공유 커뮤니티 갤러리 및 DB 연동",
      "en": "YouTube Video Sharing Community Gallery & Supabase Database Integration",
      "ja": "YouTube動画共有コミュニティギャラリー＆Supabase DB連携",
      "zh": "YouTube 视频分享社区画廊与 Supabase 数据库联动",
      "es": "Galería comunitaria para compartir videos de YouTube e integración con Supabase DB",
      "fr": "Galerie communautaire de partage vidéo YouTube et intégration Supabase",
      "de": "YouTube-Video-Sharing-Community-Galerie und Supabase-Datenbank-Integration"
    },
    "summary": {
      "ko": "완성된 하이라이트 영상을 사용자들과 공유할 수 있는 커뮤니티 갤러리 탭 및 Supabase DB 연동을 추가하고 모던 디자인 시스템 테마를 전면 적용했습니다.",
      "en": "Added a community gallery tab and Supabase DB integration to share finished highlights, along with a unified modern design system theme.",
      "ja": "完成したハイライト動画を共有できるコミュニティギャラリータブとSupabase DB連携を追加し、モダンデザインシステムのテーマを全面適用しました。",
      "zh": "增加了可与他人分享精彩集锦的社区画廊标签页及 Supabase 数据库同步，并全面统一为现代化设计系统风格。",
      "es": "Se añadió la pestaña de galería comunitaria para compartir videos destacados con integración Supabase y tema de diseño moderno.",
      "fr": "Ajout d'une galerie communautaire pour partager des vidéos avec intégration Supabase et application d'un design système moderne.",
      "de": "Community-Galerie-Tab und Supabase-Integration zum Teilen fertiger Highlights hinzugefügt sowie ein modernes einheitliches Designsystem eingeführt."
    }
  },
  "0.2.1": {
    "title": {
      "ko": "다국어(i18n 7개국어) 지원 및 상단 헤더·모델 선택창 최적화",
      "en": "Multilingual Support (7 Locales) & Header/Model Selector Optimization",
      "ja": "多言語(7言語対応)および上部ヘッダー・モデル選択UIの最適化",
      "zh": "支持 7 国多语言(i18n)及顶部导航栏与模型选择弹窗优化",
      "es": "Soporte multilingüe (7 idiomas) y optimización de encabezado y selector de modelos",
      "fr": "Support multilingue (7 langues) et optimisation de l'en-tête et du sélecteur de modèles",
      "de": "Mehrsprachige Unterstützung (7 Sprachen) und Optimierung der Kopfzeile/Modellauswahl"
    },
    "summary": {
      "ko": "영어/한국어 등 7개 언어 i18n 시스템 구축, 카드형 AI 비전 모델 선택 모달 개선, 아이폰 구간 병합 멈춤 버그를 수정했습니다.",
      "en": "Built an i18n system supporting 7 languages including English and Korean, improved the card-style AI vision model modal, and resolved iPhone segment stitching stalls.",
      "ja": "英語・韓国語を含む7言語のi18n多言語システムを構築し、カード型AIビジョンモデル選択モーダルの改善、iPhoneでの結合フリーズ問題を修正しました。",
      "zh": "搭建支持英语、韩语等 7 种语言的国际化体系，改良卡片式 AI 视觉模型选择弹窗，并修复 iPhone 视频拼接卡死异常。",
      "es": "Sistema i18n con soporte para 7 idiomas, mejoras en el modal de selección de modelos de IA y corrección de bloqueos en iPhone.",
      "fr": "Mise en place d'un système i18n en 7 langues, amélioration du sélecteur de modèles d'IA et résolution des blocages sur iPhone.",
      "de": "Aufbau eines i18n-Systems für 7 Sprachen, verbessertes kartenbasiertes KI-Modellauswahl-Modal und Behebung von Zusammenfügungsfehlern auf dem iPhone."
    }
  },
  "0.2.0": {
    "title": {
      "ko": "NLE 멀티트랙 스튜디오 & 디자인 전면 리뉴얼",
      "en": "NLE Multi-Track Studio & Complete Design Overhaul",
      "ja": "NLEマルチトラックスタジオ＆全面デザインリニューアル",
      "zh": "NLE 多轨剪辑工作室与全新视觉设计改版",
      "es": "Estudio multipista NLE y renovación completa del diseño",
      "fr": "Studio multipiste NLE et refonte visuelle complète",
      "de": "NLE-Mehrspur-Studio und komplette Neugestaltung des Designs"
    },
    "summary": {
      "ko": "NLE 멀티트랙 타임라인, BGM 신디사이저, Remotion 감성의 프로 스튜디오 에디터 구축 및 깔끔하고 직관적인 모던 디자인 시스템으로 전면 리뉴얼했습니다.",
      "en": "Built a Remotion-inspired Pro Studio Editor featuring NLE multi-track timelines, BGM synthesizer, and a clean, intuitive modern design system.",
      "ja": "NLEマルチトラックタイムライン、BGMシンセサイザー、Remotion風のプロスタジオエディターを構築し、洗練されたモダンデザインシステムに刷新しました。",
      "zh": "打造类似 Remotion 质感的专业视频编辑器，包含 NLE 多轨时间轴、BGM 合成器，并重构为简洁直观的现代设计体系。",
      "es": "Creación de un editor de estudio profesional con pistas NLE, sintetizador BGM y renovación con diseño moderno e intuitivo.",
      "fr": "Conception d'un éditeur de studio pro inspiré de Remotion avec pistes NLE, synthétiseur BGM et interface épurée et moderne.",
      "de": "Aufbau eines professionellen Studio-Editors mit NLE-Mehrspur-Timeline, BGM-Synthesizer und kompletter Neugestaltung mit modernem Designsystem."
    }
  },
  "0.1.1": {
    "title": {
      "ko": "16:9 유튜브 스마트 크롭 및 실시간 추론 대시보드 개선",
      "en": "16:9 YouTube Smart Crop & Real-time Inference Dashboard Improvements",
      "ja": "16:9 YouTubeスマートクロップ＆リアルタイム推論ダッシュボードの改善",
      "zh": "16:9 YouTube 智能裁剪与实时推理仪表板优化",
      "es": "Recorte inteligente 16:9 para YouTube y mejoras en panel de inferencia en tiempo real",
      "fr": "Recadrage intelligent 16:9 YouTube et amélioration du tableau de bord d'inférence",
      "de": "16:9 intelligenter YouTube-Zuschnitt und Verbesserungen des Echtzeit-Inferenz-Dashboards"
    },
    "summary": {
      "ko": "16:9 유튜브 규격 스마트 크롭 정렬 및 비전 AI 실시간 추론 대시보드 파이프라인을 개선했습니다.",
      "en": "Improved 16:9 YouTube smart cropping alignment and upgraded the vision AI real-time inference dashboard pipeline.",
      "ja": "16:9 YouTube規格のスマートクロップ配置を改善し、ビジョンAIのリアルタイム推論ダッシュボードパイプラインを強化しました。",
      "zh": "优化 16:9 YouTube 规格的智能裁剪对齐方案，并升级了视觉 AI 实时推理仪表板数据流水线。",
      "es": "Mejoras en la alineación del recorte inteligente 16:9 para YouTube y optimización del panel de inferencia en tiempo real.",
      "fr": "Alignement du recadrage intelligent 16:9 pour YouTube et modernisation du pipeline d'inférence en direct.",
      "de": "Intelligente Zuschnitt-Ausrichtung für 16:9 YouTube und Upgrades der visuellen KI-Echtzeit-Inferenz-Pipeline."
    }
  },
  "0.1.0": {
    "title": {
      "ko": "AI 극적 하이라이트 영상 생성기 최초 구축",
      "en": "Initial Launch of AI Dramatic Highlight Video Generator",
      "ja": "AIドラマチックハイライト動画ジェネレーター初期リリース",
      "zh": "AI 精彩高光集锦视频生成器初版发布",
      "es": "Lanzamiento inicial del generador de videos de momentos destacados con IA",
      "fr": "Lancement initial du générateur de vidéos de moments forts par IA",
      "de": "Erstveröffentlichung des KI-Generators für dramatische Highlight-Videos"
    },
    "summary": {
      "ko": "OpenRouter 멀티모달 비전 모델 기반 다중 프레임 시각 분석 및 AI 극적 순간 자동 포착 하이라이트 생성기 초기 버전을 출시했습니다.",
      "en": "Initial release of the highlight generator leveraging OpenRouter multimodal vision models for multi-frame visual analysis and dramatic moment detection.",
      "ja": "OpenRouterマルチモーダルビジョンモデルを活用したマルチフレーム視覚解析と、劇的な瞬間を自動抽出するハイライト生成ツールの初期版をリリースしました。",
      "zh": "正式发布基于 OpenRouter 多模态视觉模型的高光集锦生成器初版，支持多帧视觉深度分析与精彩瞬间自动捕获。",
      "es": "Lanzamiento de la versión inicial que utiliza modelos de visión multimodal de OpenRouter para análisis visual y captura de momentos destacados.",
      "fr": "Sortie de la première version analysant des images par modèles de vision OpenRouter pour capturer les moments les plus marquants.",
      "de": "Erstveröffentlichung des Highlight-Generators mit multimodalen Vision-Modellen von OpenRouter für Bildanalysen und Momenterkennung."
    }
  }
};

export const COMMIT_TRANSLATIONS: Record<string, Record<Locale, string>> = {
  "fps093a": {
    "ko": "아이폰 다중 영상 내보내기 시 하드웨어 디코더 슬롯 독점 보장 및 실측 프레임 1:1 동기화로 프레임 드랍 해결",
    "en": "Guarantee exclusive hardware decoder slot and strict 1:1 decoded frame sync to eliminate frame drops when exporting multiple videos on iPhone",
    "ja": "iPhone複数動画書き出し時のハードウェアデコーダスロット独占保証および実測フレーム1:1同期によりフレームドロップを解決",
    "zh": "在 iPhone 导出多视频时保障硬件解码器槽位独占并采用实测帧 1:1 同步，彻底解决掉帧问题",
    "es": "Garantizar ranura exclusiva de decodificador de hardware y sincronización 1:1 de fotogramas reales para eliminar caídas en iPhone",
    "fr": "Garantir l'exclusivité du décodeur matériel et la synchronisation 1:1 des images décodées pour éliminer les pertes d'images sur iPhone",
    "de": "Exklusiven Hardware-Decoder-Slot und strikte 1:1-Frame-Synchronisation garantieren, um Frame-Drops beim Multi-Video-Export auf dem iPhone zu beheben"
  },
  "ios092a": {
    "ko": "아이폰 다중 영상 업로드 직후 자동 저장 Blob 직렬화 차단 및 메타데이터 단일 패스 경량화로 Safari 새로고침 크래시 해결",
    "en": "Prevent auto-save raw Blob serialization and streamline metadata extraction to a single lightweight pass to fix iOS Safari post-upload crash",
    "ja": "iPhone複数動画アップロード直後の自動保存Blobシリアライズ遮断およびメタデータ単一パス軽量化によりSafari再読み込みクラッシュを解決",
    "zh": "拦截 iPhone 批量上传视频后的自动保存原始 Blob 序列化并将元数据解析精简为单次轻量扫描，解决 Safari 强制刷新崩溃",
    "es": "Evitar serialización de Blobs en autoguardado y optimizar metadatos en una sola pasada ligera para corregir reinicios en iOS Safari",
    "fr": "Blocage de la sérialisation Blob en sauvegarde auto et analyse légère des métadonnées en une passe pour corriger le crash iOS Safari",
    "de": "Roh-Blob-Serialisierung beim Auto-Save verhindert und Metadaten-Parsing auf einen leichten Durchgang reduziert, um iOS-Safari-Abstürze zu beheben"
  },
  "mem091a": {
    "ko": "대량 영상 처리 시 비디오·캔버스 디코더 즉시 해제, 업로드 동시성 제어 및 오디오·자막 캔버스 메모리 최적화",
    "en": "Immediate video/canvas decoder release, upload concurrency queue, and audio/subtitle canvas memory optimization for large video batches",
    "ja": "大量動画処理時のビデオ・キャンバスデコーダー即時解放、アップロード同時実行制御および音声・字幕キャンバスのメモリ最適化",
    "zh": "批量视频处理时立即释放视频与画布解码器、控制上传并发，并优化音频与字幕画布内存占用",
    "es": "Liberación inmediata del decodificador de video/lienzo, control de concurrencia de subida y optimización de memoria de audio y subtítulos",
    "fr": "Libération immédiate du décodeur vidéo/canevas, file d'attente d'envoi et optimisation mémoire audio et sous-titres",
    "de": "Sofortige Video-/Canvas-Decoder-Freigabe, Upload-Parallelitätssteuerung und Audio-/Untertitel-Canvas-Speicheroptimierung"
  },
  "4e4442b": {
    "ko": "동영상 메타데이터(촬영일자·GPS) 파서 고도화 및 구글 포토 다운로드 영상 인식 개선",
    "en": "Enhance video metadata (creation date & GPS) parser and improve recognition for Google Photos downloads",
    "ja": "動画メタデータ（撮影日時・GPS）パーサーの高度化およびGoogleフォトダウンロード動画の認識改善",
    "zh": "升级视频元数据（拍摄日期与GPS）解析器并改进对 Google 相册下载视频的识别",
    "es": "Mejora del analizador de metadatos de video (fecha y GPS) y reconocimiento de videos de Google Fotos",
    "fr": "Amélioration de l'analyseur de métadonnées vidéo (date et GPS) et prise en charge des vidéos Google Photos",
    "de": "Verbesserter Video-Metadaten-Parser (Aufnahmedatum & GPS) und Erkennung von Google Fotos-Videos"
  },
  "0203382": {
    "ko": "모델 선택 모달의 응답 속도 및 지연시간 표기 포맷 정밀화",
    "en": "Refine throughput speed and latency display formatting in model selector modal",
    "ja": "モデル選択モーダルでの応答速度およびレイテンシ表記フォーマットの精緻化",
    "zh": "精细化模型选择弹窗中的响应速度与延迟时间显示格式",
    "es": "Refinar el formato de visualización de velocidad de respuesta y latencia en el selector de modelos",
    "fr": "Affinement du format d'affichage de la vitesse de réponse et de la latence dans le sélecteur de modèles",
    "de": "Präzisierung der Anzeigeformate für Antwortgeschwindigkeit und Latenz im Modellauswahl-Modal"
  },
  "9e4ebf2": {
    "ko": "OpenRouter 실시간 성능 메트릭 연동 및 공식 벤치마크 보강",
    "en": "Integrate OpenRouter live performance metrics and enrich official intelligence benchmarks",
    "ja": "OpenRouterリアルタイム性能メトリクス連携および公式ベンチマークデータの補強",
    "zh": "接入 OpenRouter 实时性能指标并补充官方基准测试数据",
    "es": "Integración de métricas de rendimiento en tiempo real de OpenRouter y puntos de referencia oficiales",
    "fr": "Intégration des métriques de performance en direct d'OpenRouter et enrichissement des benchmarks officiels",
    "de": "Integration von OpenRouter-Echtzeit-Leistungsmetriken und Ergänzung offizieller Benchmarks"
  },
  "7357529": {
    "ko": "날짜 플립 탁상시계 및 장소 곡선 점선 이동 브릿지 연출 고도화",
    "en": "Implement story chapter bridge motion synthesis engine powered by HyperFrames (GSAP deterministic timeline)",
    "ja": "HyperFrames(GSAP決定論的タイムライン)ベースのストーリーチャプターブリッジモーション合成エンジンを実装",
    "zh": "实现基于 HyperFrames (GSAP确定性时间轴) 的故事章节过渡动效合成引擎",
    "es": "Implementar motor de síntesis de transiciones cinéticas HyperFrames basado en GSAP",
    "fr": "Implémentation du moteur de synthèse de transitions cinétiques HyperFrames avec GSAP",
    "de": "HyperFrames (GSAP-Timeline) Motion-Synthese-Engine für Kapitelübergänge implementiert"
  },
  "8947538": {
    "ko": "보관함에서 새 작업 시작 시 이전 세그먼트 및 스튜디오 상태 잔재 완전 초기화",
    "en": "Fully reset previous segments and studio state residue when starting new project from Vault",
    "ja": "保管庫から新規作業開始時に前回のセグメントとスタジオ状態残滓を完全リセット",
    "zh": "从保管库新建任务时彻底清理重置旧片段与工作区残余状态",
    "es": "Reiniciar por completo segmentos anteriores al iniciar nuevo proyecto desde el almacén",
    "fr": "Réinitialiser totalement les segments précédents lors d'un nouveau projet depuis le coffre",
    "de": "Vorherige Segmente und Studio-Zustände beim Start eines neuen Projekts vollständig zurücksetzen"
  },
  "9169512": {
    "ko": "아이폰 구간 병합 멈춤 해결 (타임아웃·프레임 스텝 폴백·MP4 녹화)",
    "en": "Add background music audio library popup and provide 3 built-in curated tracks",
    "ja": "BGMオーディオ保管庫ポップアップを追加し内蔵音源3種の選択に対応",
    "zh": "新增背景音乐试听曲库弹窗，并内置 3 首精心调校的精选免版税音频",
    "es": "Añadir ventana emergente de biblioteca de música y ofrecer 3 pistas predeterminadas",
    "fr": "Ajouter une bibliothèque audio contextuelle et fournir 3 morceaux intégrés",
    "de": "BGM-Bibliothek-Popup hinzugefügt und 3 integrierte Musiktitel zur Auswahl bereitgestellt"
  },
  "9616316": {
    "ko": "유튜브 영상 공유 모달 내 소개 및 하이라이트 설명 다국어(i18n) 적용",
    "en": "Apply i18n localization to intro and highlight descriptions inside YouTube video share modal",
    "ja": "YouTube動画共有モーダル内の説明文およびハイライト解説に多言語(i18n)を適用",
    "zh": "YouTube 视频分享弹窗内的简介与高光片段描述接入多语言(i18n)",
    "es": "Aplicar localización i18n a la descripción de introducción y momentos destacados en modal de YouTube",
    "fr": "Localisation i18n des descriptions d'intro et de moments forts dans la modale YouTube",
    "de": "i18n-Lokalisierung für Intro- und Highlight-Beschreibungen im YouTube-Share-Modal angewendet"
  },
  "01291ac": {
    "ko": "피드백 및 개선 요청 게시판 기능 추가 (1·2단계 개발자 처리 연동)",
    "en": "Add feedback and feature request board (phases 1 & 2 developer workflow integration)",
    "ja": "フィードバックおよび改善要望掲示板機能の追加（フェーズ1・2開発者処理連携）",
    "zh": "新增用户反馈与建议讨论板功能（接入第1·2阶段开发者处理流程）",
    "es": "Añadir panel de comentarios y solicitudes (integración de fases 1 y 2 para desarrolladores)",
    "fr": "Ajout du tableau de retours et suggestions (intégration flux développeur phases 1 et 2)",
    "de": "Feedback- und Feature-Request-Board hinzugefügt (Phasen 1 & 2 Entwickler-Workflow)"
  },
  "584cb41": {
    "ko": "피드백 메뉴를 상단 탭에서 설정(Settings) 모달 내부로 재배치",
    "en": "Relocate feedback menu from top navigation tab into Settings modal",
    "ja": "フィードバックメニューを上部タブから設定(Settings)モーダル内部へ再配置",
    "zh": "将反馈菜单从顶部导航标签迁移至设置(Settings)弹窗内部",
    "es": "Reubicar el menú de comentarios de la barra superior al modal de Ajustes",
    "fr": "Déplacer le menu de retours de l'onglet supérieur vers la modale Paramètres",
    "de": "Feedback-Menü von der oberen Leiste in das Einstellungs-Modal verschoben"
  },
  "06bf2cd": {
    "ko": "1080p(FHD) 및 720p 해상도 선택 내보내기 지원 및 스튜디오 UI 연동",
    "en": "Support 1080p (FHD) & 720p export resolution selection and Studio UI integration",
    "ja": "1080p(FHD)および720p解像度選択エクスポート対応とスタジオUI連携",
    "zh": "支持 1080p(FHD) 与 720p 分辨率导出选择及工作室 UI 联动",
    "es": "Soporte para selección de resolución 1080p (FHD) y 720p e integración con UI de Studio",
    "fr": "Prise en charge de la sélection de résolution 1080p (FHD) et 720p avec intégration UI Studio",
    "de": "Unterstützung für Auflösungsauswahl 1080p (FHD) und 720p sowie Studio-UI-Integration"
  },
  "e0273e2": {
    "ko": "내보내기 화질 선택 UI 디자인 시스템 적용 및 스타일 개선",
    "en": "Apply Toss design system and refine styles for export quality selector UI",
    "ja": "エクスポート画質選択UIにトスデザインシステムを適用しスタイル改善",
    "zh": "导出画质选择 UI 应用 Toss 设计系统并优化样式",
    "es": "Aplicar sistema de diseño Toss y refinar estilos de la interfaz de selección de calidad",
    "fr": "Application du design system Toss et amélioration des styles du sélecteur de qualité",
    "de": "Toss-Designsystem angewendet und Stile der Exportqualität-UI optimiert"
  },
  "258de0a": {
    "ko": "다운로드 클릭 시 해상도 선택 팝업 제공 및 우측 중복 설정 카드 제거",
    "en": "Provide resolution selection popup on download and clean up duplicate setting cards",
    "ja": "ダウンロード時に解像度選択ポップアップを表示し、右側の重複設定カードを削除",
    "zh": "点击下载时弹出分辨率选择窗口并移除右侧重复的设置卡片",
    "es": "Ofrecer ventana emergente de resolución al descargar y eliminar tarjetas duplicadas",
    "fr": "Afficher une modale de résolution au téléchargement et supprimer les cartes en double",
    "de": "Auflösungs-Popup beim Download anzeigen und doppelte Einstellungskarten entfernen"
  },
  "094f651": {
    "ko": "캡컷 방식 실시간 WYSIWYG 시퀀스 프리뷰 컴포지터 및 다운로드 시 단 1회 내보내기 워크플로우 전환",
    "en": "Transition to CapCut-style real-time WYSIWYG sequence preview compositor & single-pass export",
    "ja": "CapCut方式のリアルタイムWYSIWYGシーケンスプレビューコンポジター導入と1回書き出しへの移行",
    "zh": "转为类似剪映的实时所见即所得序列预览合成器与单次导出工作流",
    "es": "Transición a compositor WYSIWYG estilo CapCut y flujo de exportación en una pasada",
    "fr": "Transition vers compositeur de prévisualisation WYSIWYG style CapCut et export unique",
    "de": "Umstellung auf CapCut-artigen WYSIWYG-Sequenzvorschau-Kompositor & Single-Pass-Export"
  },
  "7206e3f": {
    "ko": "영상 길이에 맞춘 배경음악(BGM) 배속 자동 동기화 기능 구현",
    "en": "Implement auto speed-sync of background music (BGM) based on video duration",
    "ja": "動画の長さに合わせたBGMの倍速自動同期機能を実装",
    "zh": "实现根据视频总长度自动自适应同步背景音乐(BGM)播放速度",
    "es": "Implementar sincronización automática de velocidad de música de fondo (BGM) según duración",
    "fr": "Synchronisation automatique du tempo de la musique de fond (BGM) selon la durée vidéo",
    "de": "Automatische Geschwindigkeitssynchronisation der Hintergrundmusik (BGM) an Videolänge"
  },
  "947c9d1": {
    "ko": "AI 분석 시작 시 진행률 초기화 및 N개 영상 균등 1/n 분할 진행률 엔진 적용",
    "en": "Reset progress on AI analysis start & apply equal 1/n partitioned progress engine across N videos",
    "ja": "AI解析開始時の進行状況リセットとN本動画の均等1/n分割プログレスエンジンを適用",
    "zh": "AI 分析启动时重置进度，并对 N 个视频应用均等 1/n 分段进度引擎",
    "es": "Restablecer progreso al iniciar análisis IA y aplicar motor dividido 1/n para N videos",
    "fr": "Réinitialiser la progression au début de l'analyse IA et partitionner en 1/n sur N vidéos",
    "de": "Fortschritt bei KI-Analyse-Start zurücksetzen & gleichmäßige 1/n-Verteilung für N Videos"
  },
  "3413a88": {
    "ko": "내보내기 영상 프레임 끊김(GOP 시크 스래싱·오프스크린 스로틀링·중간 flush) 해결 및 하드웨어 연속 디코딩 적용",
    "en": "Fix export frame stuttering (GOP seek thrashing, offscreen throttling, mid flush) via continuous HW decode",
    "ja": "GOPシークの競合・オフスクリーンスロットリング・flush問題を解消しHW連続デコードを適用",
    "zh": "修复导出视频掉帧卡顿（解决 GOP 跳转颠簸、离屏降频与中途 flush 问题）并采用硬件连续解码",
    "es": "Corregir tirones de fotogramas al exportar aplicando decodificación por hardware continua",
    "fr": "Corriger les saccades d'exportation en appliquant le décodage matériel continu",
    "de": "Ruckler beim Video-Export durch kontinuierliche Hardware-Dekodierung behoben"
  },
  "ea979dd": {
    "ko": "스토리지 엔진 및 보관 설정 UI 스타일 적용 및 미적용 클래스 수정",
    "en": "Apply Toss style to storage engine & retention settings UI and fix missing classes",
    "ja": "ストレージエンジンおよび保持設定UIにトススタイルを適用し未適用クラスを修正",
    "zh": "存储引擎与保留设置 UI 应用 Toss 风格并补全缺失类名",
    "es": "Aplicar estilo Toss a la interfaz de motor de almacenamiento y corregir clases faltantes",
    "fr": "Appliquer le style Toss aux paramètres de stockage et corriger les classes manquantes",
    "de": "Toss-Stil auf Speicher-Engine & Aufbewahrungs-UI angewendet und fehlende Klassen behoben"
  },
  "aa7d27e": {
    "ko": "WebCodecs GPU 하드웨어 가속 60fps 비디오 렌더러 구현 및 Fallback 연동",
    "en": "Implement WebCodecs GPU hardware-accelerated 60fps video renderer with fallback support",
    "ja": "WebCodecs GPUハードウェアアクセラレーション60fpsビデオレンダラー実装およびフォールバック連携",
    "zh": "实现基于 WebCodecs 的 GPU 硬件加速 60fps 视频渲染器并联动降级兜底方案",
    "es": "Implementar renderizador de video 60 fps acelerado por hardware con WebCodecs y respaldo",
    "fr": "Implémentation d'un moteur de rendu vidéo 60 fps accéléré par GPU WebCodecs avec repli",
    "de": "WebCodecs GPU-hardwarebeschleunigten 60fps-Videorenderer mit Fallback implementiert"
  },
  "a3d5e3c": {
    "ko": "모바일/아이폰 WebCodecs 렌더러 반응형 30fps 최적화 및 Screen Wake Lock 적용",
    "en": "Optimize mobile/iPhone WebCodecs renderer to responsive 30fps and apply Screen Wake Lock",
    "ja": "モバイル・iPhone向けWebCodecsレンダラーを30fpsに最適化しScreen Wake Lockを適用",
    "zh": "优化移动端及 iPhone 上的 WebCodecs 渲染器自适应 30fps 并接入防息屏(Screen Wake Lock)",
    "es": "Optimizar renderizador WebCodecs en móviles/iPhone a 30 fps y aplicar Screen Wake Lock",
    "fr": "Optimisation du moteur WebCodecs mobile/iPhone à 30 fps et Screen Wake Lock",
    "de": "Mobile/iPhone WebCodecs-Renderer auf 30fps optimiert und Screen Wake Lock aktiviert"
  },
  "4216c0a": {
    "ko": "영상 편집 옵션 변경 시 상단 '다시 병합' 버튼 표시 및 완료 시 자동 숨김",
    "en": "Show top 'Re-stitch' button when editing video options and auto-hide on completion",
    "ja": "動画編集オプション変更時に上部「再結合」ボタンを表示し、完了時に自動非表示",
    "zh": "修改视频编辑选项时在顶部显示“重新拼接”按钮，完成后自动隐藏",
    "es": "Mostrar botón superior de 'Reunir' al cambiar opciones y ocultarlo al finalizar",
    "fr": "Afficher le bouton 'Réassembler' lors des modifications et masquer automatiquement après",
    "de": "'Erneut zusammenfügen'-Button bei Optionenänderung anzeigen und bei Abschluss ausblenden"
  },
  "96d3ee1": {
    "ko": "16:9 인물 크롭 위치 카드 세로 영상만 표시",
    "en": "Display 16:9 portrait crop position card only for vertical videos",
    "ja": "16:9人物クロップ位置カードを縦動画の場合のみ表示",
    "zh": "16:9 人物裁剪定位卡片仅在垂直竖屏视频时显示",
    "es": "Mostrar tarjeta de posición de recorte 16:9 únicamente en videos verticales",
    "fr": "Afficher la carte de position de recadrage 16:9 uniquement pour les vidéos verticales",
    "de": "16:9-Hochformat-Zuschnitt-Karte nur bei vertikalen Videos anzeigen"
  },
  "fe7b5ee": {
    "ko": "모바일 썸네일 액션 버튼 1줄 레이아웃 정렬 및 2줄 줄바꿈 수정",
    "en": "Align mobile thumbnail action buttons in single row and resolve 2-line break issue",
    "ja": "モバイルのサムネイルアクションボタンを1行に整列し、2行折り返しを修正",
    "zh": "移动端缩略图操作按钮单行排版对齐，修复折为两行问题",
    "es": "Alinear botones de acción de miniatura en una sola fila en móviles y corregir saltos de línea",
    "fr": "Aligner les boutons d'action des miniatures sur une seule ligne sur mobile",
    "de": "Thumbnail-Aktionsschaltflächen auf Mobilgeräten einzeilig ausgerichtet"
  },
  "f8759cb": {
    "ko": "비효율적인 -0.5s/+0.5s 버튼 제거 및 원본 영상 기반 클립 구간 세밀 편집 모달 추가",
    "en": "Remove inefficient -0.5s/+0.5s buttons and add precision clip trim modal based on source video",
    "ja": "非効率な-0.5s/+0.5sボタンを廃止し元動画ベースのクリップ区間精密トリミングモーダルを追加",
    "zh": "移除低效的 -0.5s/+0.5s 调节按钮，增加基于原始视频的片段精细裁剪弹窗",
    "es": "Eliminar botones ineficientes de -0.5s/+0.5s y añadir modal de recorte de precisión",
    "fr": "Remplacer les boutons -0.5s/+0.5s par une modale de rognage précis basée sur la vidéo source",
    "de": "Ineffiziente -0,5s/+0,5s-Buttons entfernt und präzises Clip-Trim-Modal hinzugefügt"
  },
  "65164a4": {
    "ko": "문구 및 타임라인 수정 시 '다시 병합' 우선 표시 및 병합 완료 후 다운로드 버튼 노출",
    "en": "Prioritize 'Re-stitch' display when modifying text/timeline and show Download button once complete",
    "ja": "テキストやタイムライン編集時に「再結合」を優先表示し、結合完了後にダウンロードボタンを表示",
    "zh": "修改文案或时间轴时优先展示“重新拼接”，拼接完成后方展示下载按钮",
    "es": "Priorizar 'Reunir' al editar texto/línea de tiempo y mostrar Descarga al completar",
    "fr": "Afficher 'Réassembler' en priorité lors des retouches et bouton Télécharger une fois terminé",
    "de": "Bei Text-/Timeline-Änderung 'Erneut zusammenfügen' priorisieren und nach Fertigstellung Download zeigen"
  },
  "8c10b6b": {
    "ko": "클립 구간 세밀 편집 모달 모바일 한 화면 최적화 (2컬럼 콤팩트 레이아웃)",
    "en": "Optimize clip precision trim modal for single-screen mobile view (compact 2-column layout)",
    "ja": "クリップ精密トリミングモーダルをモバイル1画面に最適化（2カラムコンパクトレイアウト）",
    "zh": "将片段精细裁剪弹窗适配移动端单屏视图（双列紧凑布局）",
    "es": "Optimizar modal de recorte de precisión para vista móvil en pantalla única",
    "fr": "Optimiser la modale de rognage précis pour affichage mobile mono-écran compact",
    "de": "Präzises Trim-Modal für mobilen Einzelschirm-Blickwinkel optimiert (2 Spalten)"
  },
  "34f92e2": {
    "ko": "클립 상세 영역 내 중복된 '원본 영상 구간 조절' 카드 영역 제거",
    "en": "Remove redundant 'Source Video Segment Adjustment' card in clip detail section",
    "ja": "クリップ詳細領域内の重複した「元動画区間調節」カード領域を削除",
    "zh": "移除片段详情区域内重复的“原片截取区间调整”卡片",
    "es": "Eliminar tarjeta duplicada de ajuste de segmento en la sección de detalles del clip",
    "fr": "Supprimer la carte dupliquée d'ajustement de segment dans les détails du clip",
    "de": "Überflüssige 'Originalvideo-Segment anpassen'-Karte im Clip-Detailbereich entfernt"
  },
  "dbe9864": {
    "ko": "세밀 편집 모달 타임라인 빨간색 플레이헤드 드래그 터치 영역 및 모바일 크기 최적화",
    "en": "Enlarge red playhead touch target and optimize mobile dimensions in precision trim modal",
    "ja": "精密トリミングモーダルの赤色再生ヘッドのタッチ領域拡大およびモバイルサイズ最適化",
    "zh": "优化精细裁剪弹窗中红色播放指针的触控拖拽区域与移动端尺寸",
    "es": "Agrandar área táctil del cabezal rojo y optimizar tamaño móvil en modal de recorte",
    "fr": "Agrandir la zone tactile de la tête de lecture rouge et optimiser la taille sur mobile",
    "de": "Touch-Bereich des roten Abspielkopfs vergrößert und mobile Abmessungen optimiert"
  },
  "db9d418": {
    "ko": "모든 버튼 요소 및 버튼 클래스 텍스트/콘텐츠 중앙 정렬(center) 일관성 적용",
    "en": "Enforce consistent center text/content alignment across all button elements and classes",
    "ja": "すべてのボタン要素およびボタンクラスで中央揃え(center)の一貫性を適用",
    "zh": "对所有按钮元素与按钮类名统一应用居中(center)对齐规范",
    "es": "Aplicar alineación centrada coherente en todos los botones y clases",
    "fr": "Appliquer un alignement centré cohérent sur tous les boutons et classes de bouton",
    "de": "Einheitliche zentrierte Ausrichtung für alle Button-Elemente und -Klassen angewendet"
  },
  "d2947f7": {
    "ko": "시퀀스 타임라인 빨간색 플레이헤드 드래그 시 실시간 영상 프레임 갱신 및 터치 반응성 개선",
    "en": "Update real-time video frame and improve touch responsiveness when dragging red playhead on timeline",
    "ja": "タイムラインの赤色再生ヘッドドラッグ時のリアルタイム映像更新とタッチ応答性を改善",
    "zh": "拖动时间轴红色指针时实时更新视频画面并提升触控灵敏度",
    "es": "Actualizar fotograma en tiempo real y mejorar respuesta táctil al arrastrar cabezal de línea de tiempo",
    "fr": "Actualiser l'image vidéo en direct et améliorer la réactivité tactile de la tête de lecture",
    "de": "Echtzeit-Frame-Aktualisierung und verbesserte Touch-Reaktion beim Ziehen des Abspielkopfs"
  },
  "d4043ce": {
    "ko": "썸네일 타이틀 AI 추천값 자동 동기화 및 글자 수에 따른 고정 폰트 2~3줄 자동 줄바꿈 지원",
    "en": "Auto-sync AI recommended thumbnail title with fixed font 2-3 line auto-wrap based on character count",
    "ja": "サムネイルタイトルのAI推薦値自動同期および文字数に応じた2〜3行自動改行対応",
    "zh": "缩略图标题自动同步 AI 推荐文案，并根据字数支持固定字号 2~3 行智能折行",
    "es": "Sincronizar título de miniatura recomendado por IA con ajuste automático a 2-3 líneas",
    "fr": "Synchronisation automatique du titre recommandé par l'IA avec retour à la ligne sur 2-3 lignes",
    "de": "Automatischer Abgleich des KI-Thumbnail-Titels mit 2-3-zeiligem Zeilenumbruch nach Zeichenanzahl"
  },
  "e75f87a": {
    "ko": "대용량 영상 브라우저 스토리지 로드맵 구현 (OPFS 분리 저장, 쿼터 및 영구 보존 관리, 원본 영상 재연결 UX, 다중 코덱 지원)",
    "en": "Implement large video browser storage roadmap (OPFS isolated storage, quota & persistence, reconnect UX, multi-codec)",
    "ja": "大容量動画ブラウザストレージのロードマップ実装（OPFS分離保存、容量永続化管理、再接続UX、マルチコーデック）",
    "zh": "实现大容量视频浏览器存储路线图（OPFS独立存储、配额与持久保存、原视频重连UX、多格式解码）",
    "es": "Hoja de ruta de almacenamiento de video de gran tamaño (OPFS, cuotas, reconexión de video, multi-códec)",
    "fr": "Feuille de route stockage vidéo volumineux (OPFS, quotas, reconnexion vidéo, multi-codec)",
    "de": "Roadmap für browserbasierten Videospeicher mit hoher Kapazität implementiert (OPFS, Quoten, Multi-Codec)"
  },
  "de3b404": {
    "ko": "AI 영상 분석 진행률 가중치 재조정 및 스트리밍 점근 보간으로 계단식 점프 현상 해결",
    "en": "Rebalance AI analysis progress weights and apply asymptotic interpolation to resolve stepped jumps",
    "ja": "AI動画解析プログレスの重み付け再調整と漸近補間により段階的な急進現象を解消",
    "zh": "重新校准 AI 视频分析进度权重，采用流式渐近插值解决跳跃顿挫",
    "es": "Reequilibrar pesos del progreso de análisis de IA e interpolación asintótica para evitar saltos bruscos",
    "fr": "Rééquilibrage des coefficients de progression IA et interpolation asymptotique pour éviter les à-coups",
    "de": "Gewichtung des KI-Analysefortschritts neu austariert und asymptotische Interpolation angewendet"
  },
  "ce681e1": {
    "ko": "프로젝트 및 극적 순간 목록 카드 테두리 불균형 두께 제거 및 사방 균일화",
    "en": "Normalize border widths across project and dramatic moment list cards",
    "ja": "プロジェクトおよび劇的瞬間一覧カードの枠線の太さを四方均一に整流化",
    "zh": "消除项目卡片与精彩片段列表边框厚度不均，实现四周完全统一",
    "es": "Normalizar grosor de bordes en tarjetas de proyectos y momentos destacados",
    "fr": "Harmoniser l'épaisseur des bordures sur les cartes de projet et de moments forts",
    "de": "Rahmenstärken bei Projekt- und Highlight-Karten gleichmäßig vereinheitlicht"
  },
  "f3252f2": {
    "ko": "영상 길이별 진행률 동적 가중치 분배 및 제논 점근 크롤링·실시간 메트릭 카운터 적용",
    "en": "Dynamic progress weighting by video length, Zeno asymptotic crawl, and real-time metric counter",
    "ja": "動画長ごとの動的進行重み付けとゼノン漸近クロール・リアルタイムメトリックカウンター適用",
    "zh": "按视频时长动态分配进度权重，并接入芝诺渐近爬行与实时指标计数器",
    "es": "Ponderación dinámica de progreso según duración, avance asintótico de Zenón y contador en tiempo real",
    "fr": "Pondération dynamique par durée de vidéo, progression asymptotique de Zénon et compteur en direct",
    "de": "Dynamische Fortschrittsgewichtung nach Videolänge, Zeno-Verlangsamung & Echtzeit-Zähler"
  },
  "752bf23": {
    "ko": "구간별 제논 감속 점근(30%·60%·90%) 및 정밀 진행률 보간 적용",
    "en": "Apply stepped Zeno decelerations (30%, 60%, 90%) and fine-grained progress interpolation",
    "ja": "区間ごとのゼノン減速漸近(30%・60%・90%)と精密進行補間を適用",
    "zh": "应用分段式芝诺减速渐近(30%·60%·90%)与精细进度插值",
    "es": "Aplicar desaceleración de Zenón por tramos (30%, 60%, 90%) e interpolación precisa de progreso",
    "fr": "Appliquer la décélération par paliers de Zénon (30%, 60%, 90%) et interpolation fine",
    "de": "Stufenweise Zeno-Abbremsung (30%, 60%, 90%) und präzise Fortschrittsinterpolation angewendet"
  },
  "cb36fc0": {
    "ko": "상단 네비게이션 헤더 및 컨트롤 반응형 브레이크포인트 최적화와 문구 겹침·이탈 방지",
    "en": "Optimize responsive breakpoints for top nav header and controls to prevent text overflow",
    "ja": "上部ナビヘッダーおよび操作系のレスポンシブブレークポイント最適化とテキスト重なり防止",
    "zh": "优化顶部导航栏与控制区的响应式断点，防止文字溢出与重叠",
    "es": "Optimizar puntos de interrupción responsivos en cabecera y controles para evitar desbordes",
    "fr": "Optimisation des points de rupture responsive de l'en-tête pour éviter les débordements de texte",
    "de": "Responsive Breakpoints für Kopfzeile und Bedienelemente zur Vermeidung von Textüberlauf optimiert"
  },
  "8fc1368": {
    "ko": "무정지(Zero-Freeze) 진행률 엔진 도입, 가짜 최저 속도 보장 및 심리학적 단계별 텍스트 전환 적용",
    "en": "Introduce Zero-Freeze progress engine, guaranteed min crawl speed, and psychological staged text",
    "ja": "Zero-Freezeプログレスエンジンの導入、最低進行速度の保証および心理的段階テキスト遷移の適用",
    "zh": "引入无停顿(Zero-Freeze)进度引擎、保底最低前行速率与心理分阶文字轮播",
    "es": "Incorporar motor Zero-Freeze, velocidad mínima garantizada y textos psicológicos por etapas",
    "fr": "Moteur de progression Zero-Freeze, vitesse minimale garantie et étapes textuelles psychologiques",
    "de": "Zero-Freeze-Fortschritts-Engine, Mindestgeschwindigkeit und psychologische Phasenanzeige eingeführt"
  },
  "dc8a411": {
    "ko": "데스크탑 레이아웃 일부 수정",
    "en": "Minor adjustments to desktop layout",
    "ja": "デスクトップレイアウトの一部調整",
    "zh": "微调桌面端部分布局样式",
    "es": "Ajustes menores en la distribución de escritorio",
    "fr": "Ajustements mineurs sur la disposition de bureau",
    "de": "Kleinere Anpassungen am Desktop-Layout"
  },
  "75a899b": {
    "ko": "데스크탑 레이아웃 일부 수정",
    "en": "Minor adjustments to desktop layout styling",
    "ja": "デスクトップレイアウトのスタイル一部調整",
    "zh": "微调桌面端布局样式",
    "es": "Ajustes de estilo en la distribución de escritorio",
    "fr": "Ajustements de style sur la disposition de bureau",
    "de": "Stilanpassungen am Desktop-Layout"
  },
  "98cfefa": {
    "ko": "보관함 화면 풀너비 확장 및 전체 영역 스크롤 적용",
    "en": "Expand Studio Vault to full width and enable scroll across full area",
    "ja": "保管庫画面をフル幅に拡張し全エリアスクロールを適用",
    "zh": "项目保管库界面扩展为全宽并支持全屏区域滚动",
    "es": "Expandir el almacén de proyectos a ancho completo y habilitar desplazamiento en toda el área",
    "fr": "Élargir la vue coffre-fort en pleine largeur et activer le défilement sur toute la zone",
    "de": "Archivansicht auf volle Breite erweitert und Scrollen über den gesamten Bereich aktiviert"
  },
  "6f19ca5": {
    "ko": "보관함 아이템 너비를 영상 공유 그리드와 동일하게 통일",
    "en": "Unify Vault item widths to match video sharing grid",
    "ja": "保管庫アイテムの幅を動画共有グリッドと同一に統一",
    "zh": "将项目库中各卡片宽度统一为与视频分享网格一致",
    "es": "Unificar el ancho de los elementos del almacén con la cuadrícula de compartir videos",
    "fr": "Harmoniser la largeur des éléments du coffre avec la grille de partage vidéo",
    "de": "Breite der Archivelemente an das Video-Share-Raster angepasst"
  },
  "c14958f": {
    "ko": "업로드 영상 목록 모달 상단 요약(시간·용량·추가버튼) 줄바꿈 및 모바일 UI 깨짐 현상 수정",
    "en": "Fix line breaks and mobile layout glitches in uploaded video modal header",
    "ja": "アップロード動画一覧モーダル上部のサマリー（時間・容量・追加ボタン）改行と崩れを修正",
    "zh": "修复已上传视频列表弹窗顶部摘要信息（时长·大小·添加按钮）换行与移动端样式错位",
    "es": "Corregir saltos de línea y desajustes móviles en el encabezado del modal de videos",
    "fr": "Corriger les retours à la ligne et bugs d'affichage mobile dans l'en-tête des vidéos importées",
    "de": "Zeilenumbrüche und mobile Darstellungsfehler im Kopfbereich des Upload-Modals behoben"
  },
  "5511ff5": {
    "ko": "모바일 브라우저 원본 영상 Blob 소실 방어, 재생 URL 자동 복구 및 디코더 충돌 방지",
    "en": "Guard against original video Blob loss, auto-recover playback URL, and prevent decoder crashes on mobile",
    "ja": "モバイルでのBlob消失防止、再生URL自動復旧およびデコーダークラッシュ防止を実装",
    "zh": "防御移动端浏览器原片 Blob 丢失、自动恢复播放 URL 并防止解码器并发崩溃",
    "es": "Proteger contra pérdida de Blob en móviles, autorrecuperar URLs y prevenir fallos del decodificador",
    "fr": "Protection contre la perte de Blob mobile, récupération d'URL et prévention des plantages du décodeur",
    "de": "Schutz vor Blob-Verlust auf Mobilgeräten, Auto-Wiederherstellung und Decoder-Absturzsicherung"
  },
  "b3ef5ee": {
    "ko": "팝업 활성화 중 배경 스크롤 잠금 및 터치·드래그 이벤트 전파 차단",
    "en": "Lock background scroll and prevent touch/drag event propagation when modal is active",
    "ja": "ポップアップ表示時の背景スクロール固定およびタッチ・ドラッグイベント伝播遮断",
    "zh": "弹窗打开时锁定背景滚动并阻断触控与拖拽事件冒泡",
    "es": "Bloquear desplazamiento de fondo y evitar propagación de eventos táctiles con modal abierto",
    "fr": "Verrouiller le défilement d'arrière-plan et bloquer la propagation des événements tactiles",
    "de": "Hintergrund-Scrollen bei aktiven Modals sperren und Touch-/Drag-Event-Weiterleitung stoppen"
  },
  "27a9ee0": {
    "ko": "영상 재생 프로그레스바 및 시퀀스 타임라인 플레이헤드 실시간 드래그 스크러빙 지원",
    "en": "Support real-time drag scrubbing on video playback progress bar and sequence timeline playhead",
    "ja": "動画再生バーおよびシーケンスタイムライン再生ヘッドのリアルタイムドラッグスクラブに対応",
    "zh": "支持视频播放进度条与序列时间轴播放指针的实时拖拽擦除(Scrubbing)",
    "es": "Permitir arrastre y desplazamiento en tiempo real en la barra de progreso y línea de tiempo",
    "fr": "Prise en charge du défilement en direct sur la barre de lecture et la tête de lecture timeline",
    "de": "Echtzeit-Scrubbing auf Video-Fortschrittsleiste und Timeline-Abspielkopf unterstützt"
  },
  "4d427d3": {
    "ko": "하단 고정 상태바의 중복 시간 절약률 영역 제거 및 영상 요약만 노출",
    "en": "Remove redundant time-saved metric from bottom fixed status bar and show video summary only",
    "ja": "下部固定ステータスバーの重複する時間節約率を削除し動画概要のみを表示",
    "zh": "移除底部固定状态栏中重复的时间节约率卡片，仅保留视频概要信息",
    "es": "Eliminar área redundante de ahorro de tiempo en la barra inferior y mostrar solo resumen",
    "fr": "Supprimer la mention redondante de temps gagné en bas et n'afficher que le résumé vidéo",
    "de": "Überflüssige Zeitersparnis-Anzeige in der unteren Statusleiste entfernt, nur Video-Zusammenfassung"
  },
  "7ecab37": {
    "ko": "모바일 AI 포착 극적 순간 씬 아이템의 썸네일·조절 버튼 레이아웃 겹침 수정",
    "en": "Fix thumbnail and button layout overlap in mobile dramatic moment scene items",
    "ja": "モバイルのAI劇的瞬間シーンアイテムにおけるサムネイルと調節ボタンの重なりを修正",
    "zh": "修复移动端 AI 精彩场景条目中缩略图与调节按钮排版重叠的异常",
    "es": "Corregir superposición de miniatura y botones de ajuste en escenas de momentos destacados en móviles",
    "fr": "Corriger le chevauchement de la miniature et des boutons d'ajustement sur mobile",
    "de": "Überlappung von Thumbnail und Einstell-Buttons bei Highlight-Szenen auf Mobilgeräten behoben"
  },
  "8350acb": {
    "ko": "시퀀스 타임라인 영상 종료점 마감 정렬 및 원곡 배경음악 잔여 구간 연장 표시",
    "en": "Align timeline video end edge and extend remaining background music track display",
    "ja": "シーケンスタイムライン動画終了位置の整列およびBGM残余区間の延長表示",
    "zh": "时间轴视频末端对齐修整，并延长显示原背景音乐剩余轨道区域",
    "es": "Alinear final de video en la línea de tiempo y extender visualización de pista de música restante",
    "fr": "Aligner la fin de la vidéo sur la timeline et prolonger l'affichage de la musique restante",
    "de": "Video-Ende in der Timeline bündig ausgerichtet und Restbereich der Hintergrundmusik verlängert"
  },
  "2adf61e": {
    "ko": "시간 절약률 요약 카드 제거 및 하단 상태바 시간 절약률 표시 복원",
    "en": "Remove time-saved summary card and restore time-saved metric in bottom status bar",
    "ja": "時間節約率サマリーカードを削除し下部ステータスバーの時間節約率表示を復元",
    "zh": "移除时间节约率概要卡片，并在底部状态栏恢复时间节约率数值展示",
    "es": "Eliminar tarjeta de ahorro de tiempo y restaurar indicador en barra inferior",
    "fr": "Supprimer la carte de temps gagné et restaurer l'affichage dans la barre d'état inférieure",
    "de": "Zeitersparnis-Zusammenfassungskarte entfernt und Anzeige in unterer Statusleiste wiederhergestellt"
  },
  "93298ae": {
    "ko": "씬 아이템 하단 중복 영상 방향 회전 카드 제거",
    "en": "Remove duplicate video rotation card below scene items",
    "ja": "シーンアイテム下部の重複する動画回転カードを削除",
    "zh": "移除各场景条目下方多余的视频旋转卡片",
    "es": "Eliminar tarjeta duplicada de rotación de video debajo de las escenas",
    "fr": "Supprimer la carte dupliquée de rotation vidéo sous les scènes",
    "de": "Doppelte Video-Rotationskarte unter Szenenelementen entfernt"
  },
  "898687f": {
    "ko": "스튜디오 작업 보관함(IndexedDB) 및 자동 저장·불러오기 기능 구현",
    "en": "Implement studio project vault (IndexedDB) and auto-save / restore functionality",
    "ja": "スタジオ作業保管庫(IndexedDB)および自動保存・復元機能を実装",
    "zh": "实现工作室项目库(IndexedDB)与实时自动保存/恢复功能",
    "es": "Implementar almacén de proyectos en IndexedDB y guardado/restauración automática",
    "fr": "Implémentation du coffre de projets (IndexedDB) et sauvegarde/restauration automatique",
    "de": "Studio-Projektarchiv (IndexedDB) mit automatischer Speicherung und Wiederherstellung implementiert"
  },
  "3ee23a7": {
    "ko": "스튜디오 상단 네비게이션에 보관함 탭 버튼 연결 및 IndexedDB 자동 저장 상태 연동",
    "en": "Connect Vault tab in top navigation and bind IndexedDB auto-save status indicator",
    "ja": "上部ナビに保管庫タブボタンを接続しIndexedDB自動保存ステータスと連携",
    "zh": "在顶部导航栏接入项目库标签，并联动 IndexedDB 自动保存状态指示器",
    "es": "Conectar pestaña de almacén en la barra superior y vincular estado de guardado IndexedDB",
    "fr": "Ajouter l'onglet coffre dans la navigation supérieure et lier l'état de sauvegarde IndexedDB",
    "de": "Archiv-Tab in der oberen Leiste verknüpft und IndexedDB-Speicherstatus angebunden"
  },
  "ce56614": {
    "ko": "빈 상태 자동저장 오류 수정 및 하단 고정 상태바(저장·시간절약률) UI 구현",
    "en": "Fix empty-state auto-save glitch and implement bottom fixed status bar (save & time-saved)",
    "ja": "空状態の自動保存不具合修正と下部固定ステータスバー（保存・時間節約率）UIを実装",
    "zh": "修复空白状态下自动保存异常，并实现底部固定状态栏（保存状态与省时比例）",
    "es": "Corregir fallo de guardado en estado vacío e implementar barra inferior de estado",
    "fr": "Corriger la sauvegarde en état vide et intégrer la barre d'état inférieure",
    "de": "Fehler beim Auto-Save bei Leerzustand behoben und untere Statusleiste implementiert"
  },
  "34ffca5": {
    "ko": "좌/우 패널 스크롤바 완전 숨김 처리",
    "en": "Hide scrollbars completely on left and right panels",
    "ja": "左右パネルのスクロールバーを完全非表示に設定",
    "zh": "彻底隐藏左右两侧面板的系统滚动条",
    "es": "Ocultar completamente las barras de desplazamiento en paneles izquierdo y derecho",
    "fr": "Masquer totalement les barres de défilement sur les panneaux gauche et droite",
    "de": "Scrollleisten im linken und rechten Panel vollständig ausgeblendet"
  },
  "00135f3": {
    "ko": "좌/우 패널 여백 조절",
    "en": "Adjust margins on left and right panels",
    "ja": "左右パネルの余白を微調整",
    "zh": "微调左右两侧面板的外边距与间距",
    "es": "Ajustar márgenes de los paneles izquierdo y derecho",
    "fr": "Ajuster les marges des panneaux gauche et droite",
    "de": "Abstände im linken und rechten Panel angepasst"
  },
  "ec42a56": {
    "ko": "타이틀 핑퐁 무한루프 및 자동저장 대기 멈춤 현상 수정",
    "en": "Fix title ping-pong infinite loop and auto-save stall bug",
    "ja": "タイトルピンポンの無限ループおよび自動保存待機フリーズの不具合を修正",
    "zh": "修复标题更新乒乓死循环及自动保存等待卡死故障",
    "es": "Corregir bucle infinito de título y bloqueo en la espera de autoguardado",
    "fr": "Corriger la boucle infinie sur le titre et le blocage de la sauvegarde automatique",
    "de": "Endlosschleife beim Titelwechsel und Hänger beim Auto-Save behoben"
  },
  "196f585": {
    "ko": "영상 분석 모델 선택 및 폴백 목록에서 오류 빈발 Google Gemma 모델 제외",
    "en": "Exclude error-prone Google Gemma models from video analysis model selection and fallback list",
    "ja": "動画解析モデル選択およびフォールバックからエラー多発のGoogle Gemmaモデルを除外",
    "zh": "从视频分析模型选择与降级列表中剔除高频报错的 Google Gemma 模型",
    "es": "Excluir modelos Google Gemma con alta tasa de error de la selección y respaldo",
    "fr": "Exclure les modèles Google Gemma instables de la liste des modèles et du repli",
    "de": "Fehleranfällige Google Gemma-Modelle aus Modellauswahl und Fallback-Liste entfernt"
  },
  "8897d34": {
    "ko": "아이폰 업로드 시 원본 촬영일자 메타데이터 우선 추출 및 파싱 개선",
    "en": "Prioritize extracting and parsing original recording date metadata during iPhone uploads",
    "ja": "iPhoneからのアップロード時に撮影日メタデータを優先抽出・解析するように改善",
    "zh": "优化 iPhone 上传时优先解析并提取原视频原始拍摄日期元数据",
    "es": "Priorizar extracción y análisis de metadatos de fecha original al subir desde iPhone",
    "fr": "Prioriser l'extraction et l'analyse de la date originale lors de l'import depuis iPhone",
    "de": "Ursprüngliche Aufnahmedatum-Metadaten beim iPhone-Upload bevorzugt auslesen"
  },
  "0fc52e4": {
    "ko": "하이라이트 생성 전 가짜 클립 및 시간 절약률 노출 제거, 원본 영상 미리보기 모드와 재생 실패 안내 추가",
    "en": "Remove mock clips & time-saved preview prior to generation; add source video preview and play error notice",
    "ja": "ハイライト生成前のモッククリップ・時間節約率表示を削除し元動画プレビューと再生失敗案内を追加",
    "zh": "在生成集锦前移除模拟片段与虚假省时率，增加原视频预览模式及播放失败排查指引",
    "es": "Eliminar clips simulados antes de la generación y añadir vista previa y aviso de error de reproducción",
    "fr": "Supprimer les clips factices avant génération et ajouter la prévisualisation et l'aide à la lecture",
    "de": "Schein-Clips vor Generierung entfernt; Originalvorschau und Fehlerhinweis hinzugefügt"
  },
  "5d58ec3": {
    "ko": "다국어(i18n) 번역 키 확장 및 모달 컴포넌트 다국어 지원 연동",
    "en": "Expand i18n translation keys and connect multilingual support across modal components",
    "ja": "多言語(i18n)翻訳キーを拡張し各モーダルコンポーネントに多言語対応を適用",
    "zh": "扩充 i18n 多语言字典词条并全面接入各弹窗组件",
    "es": "Ampliar claves de traducción i18n y conectar soporte multilingüe en componentes modales",
    "fr": "Étendre les clés de traduction i18n et intégrer le support multilingue aux modales",
    "de": "i18n-Übersetzungsschlüssel erweitert und mehrsprachige Unterstützung in Modals integriert"
  },
  "5a610a0": {
    "ko": "헤더 및 앱 레벨 오류 배너·자막 다운로드 다국어(i18n) 누락 항목 추가 보완",
    "en": "Supplement missing i18n entries across header, app-level error banners, and subtitle downloads",
    "ja": "ヘッダー、アプリ全体エラーバナー、字幕ダウンロードの多言語(i18n)不足項目を補完",
    "zh": "补全顶部导航、应用级错误提示条与字幕下载功能遗漏的多语言(i18n)词条",
    "es": "Completar traducciones i18n faltantes en cabecera, avisos de error y descarga de subtítulos",
    "fr": "Compléter les traductions i18n manquantes dans l'en-tête, les bannières d'erreur et les sous-titres",
    "de": "Fehlende i18n-Einträge in Header, Fehlermeldungen und Untertitel-Download ergänzt"
  },
  "5f9e9b0": {
    "ko": "다국어(i18n) 파일 내 모든 이모지 제거 및 UI 텍스트 정제",
    "en": "Remove all emojis from i18n locale files and sanitize UI strings",
    "ja": "多言語(i18n)ファイル内の全絵文字を削除しUIテキストを洗練化",
    "zh": "彻底清除 i18n 多语言文件中的全部 Emoji 表情并净化界面文案",
    "es": "Eliminar todos los emojis de los archivos i18n y pulir textos de interfaz",
    "fr": "Supprimer tous les émojis des fichiers i18n et uniformiser les textes d'interface",
    "de": "Alle Emojis aus i18n-Dateien entfernt und UI-Texte bereinigt"
  },
  "86683bc": {
    "ko": "업로드 영상 모달 메타데이터 줄바꿈·삭제 버튼 겹침 UI 수정 및 원본 영상 미리보기 다국어(i18n) 연동",
    "en": "Fix metadata wrap and delete button overlap in uploaded video modal; connect source preview i18n",
    "ja": "アップロード動画モーダルのメタデータ改行と削除ボタン重なり修正および元動画プレビューi18n連携",
    "zh": "修复上传视频弹窗中元数据折行与删除按钮重叠缺陷，并接入原片预览多语言(i18n)",
    "es": "Corregir desajuste de metadatos y botón de eliminar en modal de videos; conectar i18n de vista previa",
    "fr": "Corriger l'affichage des métadonnées et le bouton supprimer dans la modale vidéos; lier i18n",
    "de": "Metadaten-Zeilenumbruch und Löschen-Button im Upload-Modal korrigiert; Vorschau-i18n angebunden"
  },
  "159bc21": {
    "ko": "업로드 영상 목록 모달 메타데이터 폰트 축소(10px) 및 전용 CSS 분리로 텍스트-삭제버튼 겹침 현상 해결",
    "en": "Reduce uploaded video modal metadata font (10px) and split dedicated CSS to resolve text-button collision",
    "ja": "アップロード動画一覧モーダルのメタデータ文字を10pxに縮小し専用CSSを分離して重なりを解消",
    "zh": "将上传视频弹窗元数据字号微调至 10px 并抽离专用 CSS，消除文字与删除按钮碰撞",
    "es": "Reducir tamaño de fuente de metadatos (10px) y separar CSS para evitar solapamientos",
    "fr": "Réduire la police des métadonnées (10px) et isoler le CSS pour éviter les collisions",
    "de": "Schriftgröße der Metadaten im Upload-Modal auf 10px verkleinert und eigenes CSS erstellt"
  },
  "4d80c39": {
    "ko": "업로드 영상 목록 모달 타이틀 크기 확대(13.5px) 및 좌측 정렬 수정",
    "en": "Increase uploaded video list modal title size (13.5px) and correct left alignment",
    "ja": "アップロード動画一覧モーダルのタイトルを13.5pxに拡大し左揃えに修正",
    "zh": "放大上传视频列表弹窗标题字号至 13.5px 并修正为左对齐",
    "es": "Aumentar tamaño del título en modal de lista de videos (13.5px) y corregir alineación izquierda",
    "fr": "Agrandir le titre de la modale des vidéos (13.5px) et corriger l'alignement à gauche",
    "de": "Titelgröße im Upload-Modal auf 13,5px vergrößert und Linksbündigkeit korrigiert"
  },
  "75b37de": {
    "ko": "AI 직접 추천 썸네일 프레임 연동 및 썸네일 내 영상 오버레이 문구(상단·날짜·채널) 제거",
    "en": "Sort AI captured dramatic moment clips chronologically by recording timestamp (HH:MM:SS)",
    "ja": "AI劇的瞬間クリップ一覧を撮影日時（時・分・秒）基準の時系列順に並び替える機能を追加",
    "zh": "为 AI 捕获的精彩片段列表增加按拍摄时间戳（时·分·秒）正序时序排列功能",
    "es": "Ordenar clips destacados cronológicamente según la hora de grabación (HH:MM:SS)",
    "fr": "Trier les clips des moments forts par ordre chronologique selon l'heure d'enregistrement",
    "de": "Highlight-Clips chronologisch nach Aufnahmezeitstempel (HH:MM:SS) sortieren"
  },
  "f6fef08": {
    "ko": "데스크탑 모드 하단 불필요한 공백 제거",
    "en": "Replace chapter bridge modal popup with 5-stage kinetic louver wipe and mask split typography",
    "ja": "チャプターブリッジのモーダルを廃止し5段階キネティックルーバーワイプとマスクスプリットタイポを適用",
    "zh": "移除章节转场弹窗，全面应用五段动态百叶百叶窗转场与文字遮罩视差动效",
    "es": "Sustituir modal de transición por barrido cinético de persiana en 5 fases y tipografía dividida",
    "fr": "Remplacer la modale par un balayage cinétique à 5 lames et typographie à masque fractionné",
    "de": "Kapitel-Modal durch 5-stufigen kinetischen Lamellen-Wipe und Maskensplit-Typografie ersetzt"
  },
  "d91e81d": {
    "ko": "지능 지수 미집계 모델을 최신 출시순으로 정렬",
    "en": "Integrate AI recommended thumbnail frames and remove overlay text (top text, date, channel) from thumbnails",
    "ja": "AI直接推薦サムネイルフレームの連携およびサムネイル内オーバーレイ文字（上部・日付・チャンネル）を削除",
    "zh": "联动 AI 智能推荐缩略图帧并移除缩略图上的视频文字叠加层（顶部文案·日期·频道名）",
    "es": "Integrar fotogramas de miniatura recomendados por IA y quitar textos superpuestos",
    "fr": "Intégrer les miniatures suggérées par IA et retirer les superpositions de texte",
    "de": "Von KI empfohlene Thumbnail-Frames integriert und Textüberlagerungen entfernt"
  },
  "4ade89c": {
    "ko": "시퀀스 타임라인 멀티트랙(V1 영상·A1 음악) 표시 및 음악 초과 클립 정리 기능 추가",
    "en": "Remove unnecessary bottom padding in desktop mode",
    "ja": "デスクトップモード下部の不要な余白を削除",
    "zh": "移除桌面端视图底部多余的空白留白",
    "es": "Eliminar espacio inferior innecesario en modo escritorio",
    "fr": "Supprimer l'espace vide superflu en bas en mode bureau",
    "de": "Überflüssigen Abstand am unteren Rand im Desktop-Modus entfernt"
  },
  "5e905b1": {
    "ko": "영상 병합 프레임 페이싱 정밀 동기화 및 iOS/데스크탑 끊김 현상 개선",
    "en": "Sort models with unranked intelligence scores by newest release date",
    "ja": "知能スコア未集計のモデルを最新リリース順に並び替え",
    "zh": "将尚未统计智能评分的模型按最新发布时间排序",
    "es": "Ordenar modelos sin puntuación de inteligencia por fecha de lanzamiento reciente",
    "fr": "Trier les modèles sans score d'intelligence par date de sortie la plus récente",
    "de": "Modelle ohne Intelligenz-Bewertung nach neuester Veröffentlichung sortieren"
  },
  "5fae131": {
    "ko": "데스크탑 패널 하단 여백 복원 및 스크롤 끝 카드 잘림 방지",
    "en": "Display sequence timeline multi-track (V1 video, A1 audio) and clean up clips exceeding music",
    "ja": "シーケンスタイムラインのマルチトラック(V1映像・A1音楽)表示と音楽超過クリップの整理機能を追加",
    "zh": "显示序列时间轴多轨界面（V1 视频与 A1 音频）并自动修整超出音乐长度的冗余片段",
    "es": "Mostrar multipista en la línea de tiempo (video V1, audio A1) y recortar clips excedentes",
    "fr": "Afficher le multipiste sur la timeline (vidéo V1, audio A1) et nettoyer les clips dépassant la musique",
    "de": "Mehrspur-Timeline (V1 Video, A1 Audio) anzeigen und überstehende Clips kürzen"
  },
  "fae81ce": {
    "ko": "시퀀스 타임라인 세로줄 오류·클립 간 빈틈 제거 및 배경음악 미선택 UI 스타일 보정",
    "en": "Precise frame pacing synchronization during video stitching and resolve stutter on iOS/Desktop",
    "ja": "動画結合時のフレームペーシング高精度同期とiOS・デスクトップでのカクつき改善",
    "zh": "精准同步视频拼接时的帧间隔节奏，彻底解决 iOS 与桌面端画面顿挫",
    "es": "Sincronización precisa de fotogramas al unir videos y solución de tirones en iOS/Escritorio",
    "fr": "Synchronisation précise des trames lors de l'assemblage et fluidité accrue sur iOS/Bureau",
    "de": "Präzise Frame-Synchronisation beim Zusammenfügen und Behebung von Rucklern auf iOS/Desktop"
  },
  "46c0e8b": {
    "ko": "데스크탑 패널 상하 하단 여백 제거 및 패널 자체 여백 추가",
    "en": "Restore desktop panel bottom padding and prevent clipping at end of scroll",
    "ja": "デスクトップパネル下部の余白を復元しスクロール末尾のカード見切れを防止",
    "zh": "恢复桌面端面板底部留白，防止滚动至底部时卡片内容被截断",
    "es": "Restaurar margen inferior en panel de escritorio y evitar cortes al final del scroll",
    "fr": "Restaurer la marge inférieure du panneau et éviter que le bas ne soit coupé au défilement",
    "de": "Unteren Abstand im Desktop-Panel wiederhergestellt und Abschneiden beim Scrollen behoben"
  },
  "16cf52a": {
    "ko": "Revert \"fix(video): 데스크탑 패널 상하 하단 여백 제거 및 패널 자체 여백 추가\"",
    "en": "Eliminate vertical line artifacts & gaps between clips on timeline; fix styling for unselected BGM",
    "ja": "シーケンスタイムラインの縦線エラーとクリップ間隙間を解消しBGM未選択時のUIスタイルを補正",
    "zh": "消除时间轴竖线异常与片段微小缝隙，并美化未选取背景音乐时的占位样式",
    "es": "Eliminar líneas verticales y huecos entre clips en la línea de tiempo; corregir estilo sin BGM",
    "fr": "Éliminer les lignes verticales et espacements entre clips; ajuster le style sans BGM",
    "de": "Vertikale Linienfehler und Lücken zwischen Clips behoben; Stil ohne BGM korrigiert"
  },
  "b05c728": {
    "ko": "데스크탑 메인 상하 여백 제거 및 컬럼 내부 여백으로 잘림 방지",
    "en": "Remove outer desktop panel vertical padding and apply padding directly inside panel container",
    "ja": "デスクトップパネルの上下余白を削除しパネル自体の内側余白を追加",
    "zh": "移除桌面端面板外围上下间距，并在面板内部直接添加内边距",
    "es": "Eliminar padding vertical externo del panel y añadir margen interno",
    "fr": "Supprimer les marges verticales externes du panneau et ajouter un espacement interne",
    "de": "Äußere vertikale Abstände des Desktop-Panels entfernt und Innenabstand hinzugefügt"
  },
  "4fa9cdc": {
    "ko": "AI 추천 썸네일 프레임 버튼 넘침 방지·UI 보정 및 타이틀 토글 스위치 개선",
    "en": "Revert commit: Remove outer desktop panel vertical padding and apply padding directly inside panel container",
    "ja": "コミット取り消し: デスクトップパネルの上下余白削除およびパネル内部余白追加をロールバック",
    "zh": "撤销提交: 桌面端面板上下间距微调方案还原",
    "es": "Revertir commit de ajustes de márgenes del panel de escritorio",
    "fr": "Annuler le commit d'ajustement des marges du panneau de bureau",
    "de": "Commit rückgängig gemacht: Äußere vertikale Abstände des Desktop-Panels entfernt"
  },
  "2e9d8f5": {
    "ko": "헤더 브랜드 서브텍스트 배치·버튼 높이 통일·진행 모달 UI 개선 및 촬영 날짜 on/off 기능 추가",
    "en": "Remove desktop main vertical padding and prevent clipping using inner column margins",
    "ja": "デスクトップメインの上下余白を削除しカラム内部余白により見切れを防止",
    "zh": "移除桌面主区域上下多余外间距，采用列内边距防止视觉截断",
    "es": "Eliminar padding vertical principal y usar márgenes internos de columna para evitar cortes",
    "fr": "Supprimer les marges verticales principales et utiliser les marges internes de colonne",
    "de": "Hauptabstände oben/unten im Desktop entfernt und Spaltenabstände angepasst"
  },
  "327366f": {
    "ko": "사용되지 않는 프로젝트 보관함 임포트 및 미사용 props 정리",
    "en": "Prevent AI recommended thumbnail button overflow, tune UI, and improve title toggle switch",
    "ja": "AI推薦サムネイルボタンのはみ出し防止・UI微調整およびタイトルトグルスイッチの改善",
    "zh": "防止 AI 推荐缩略图按钮文本溢出，精细调优 UI 并改良标题开关组件",
    "es": "Evitar desborde del botón de miniatura recomendada por IA y mejorar interruptor de título",
    "fr": "Éviter le débordement du bouton de miniature IA et perfectionner l'interrupteur de titre",
    "de": "Überlaufen des KI-Thumbnail-Buttons verhindert, UI verfeinert und Titelschalter verbessert"
  },
  "4d869c0": {
    "ko": "HyperFrames(GSAP 결정론적 타임라인) 기반 스토리 챕터 브릿지 모션 합성 엔진 구현",
    "en": "Refine header branding subtext, unify button heights, improve progress modal, and add date toggle",
    "ja": "ヘッダーのブランドサブテキスト配置・ボタン高さ統一・進行状況UI改善および撮影日ON/OFF機能を追加",
    "zh": "排版顶部品牌副标题、统一样式高度、精简进度条弹窗并新增拍摄日期开关",
    "es": "Alinear subtítulo de marca en cabecera, unificar alturas de botones y añadir interruptor de fecha",
    "fr": "Harmoniser la hauteur des boutons, améliorer la modale et ajouter l'interrupteur de date",
    "de": "Marken-Untertitel platziert, Button-Höhen vereinheitlicht und Datums-Schalter hinzugefügt"
  },
  "e26c1c9": {
    "ko": "챕터 브릿지 모달 팝업 제거 및 5단 키네틱 루버 와이프·마스크 스플릿 타이포 연출 적용",
    "en": "Clean up unused project vault imports and obsolete props",
    "ja": "使用されていないプロジェクト保管庫のインポートおよび不要なpropsを整理",
    "zh": "清理废弃的项目库引用并移除无用的组件 Props",
    "es": "Limpiar importaciones no utilizadas del almacén de proyectos y props obsoletas",
    "fr": "Nettoyer les imports inutilisés du coffre de projets et les props obsolètes",
    "de": "Unbenutzte Projektarchiv-Imports und veraltete Props aufgeräumt"
  },
  "764cf5e": {
    "ko": "미디어 첨부 시 촬영일자 및 GPS 역지오코딩 장소명 자동 매핑 구현",
    "en": "Upgrade desktop flip clock for recording date and curve dotted path for location bridge transitions",
    "ja": "撮影日のフリップ置時計演出および場所の曲線点線移動ブリッジ演出を高度化",
    "zh": "升级拍摄日期的翻页复古台钟动画及地点间的曲线虚线移动过渡特效",
    "es": "Mejorar animación de reloj abatible para fechas y ruta curva punteada para transiciones de lugar",
    "fr": "Perfectionner l'horloge à volets pour la date et la ligne pointillée courbée pour les lieux",
    "de": "Flip-Clock-Effekt für Aufnahmedatum und geschwungene Pfadlinie für Ortswechsel verfeinert"
  },
  "b3bb872": {
    "ko": "영상 패널 전체화면 확대 버튼 추가 및 재생 종료 후 처음부터 다시 재생 기능 구현",
    "en": "Implement auto-mapping of recording date and GPS reverse geocoded place names upon media attachment",
    "ja": "メディア添付時の撮影日時およびGPS逆ジオコーディング地名自動マッピングを実装",
    "zh": "添加视频素材时自动解析拍摄日期与 GPS 逆地理编码地名映射",
    "es": "Mapeo automático de fecha de grabación y ubicación geográfica inversa al adjuntar archivos",
    "fr": "Mappage automatique de la date et du géocodage inversé GPS lors de l'ajout de médias",
    "de": "Automatische Zuordnung von Aufnahmedatum und GPS-Geokodierungs-Ortsnamen bei Medien-Upload"
  },
  "aa9c261": {
    "ko": "AI 포착 극적 순간 클립 리스트 촬영일시(시·분·초) 기준 시간순 정렬 기능 추가",
    "en": "Add fullscreen expand button to video panel and implement replay from start upon completion",
    "ja": "動画パネルに全画面拡大ボタンを追加し再生完了後の最初から再再生機能を実装",
    "zh": "为视频播放窗口新增全屏放大按钮，并支持播放完毕后点击重新播放",
    "es": "Añadir botón de pantalla completa en panel de video y función de reiniciar reproducción",
    "fr": "Ajouter le plein écran sur le lecteur vidéo et la reprise depuis le début à la fin",
    "de": "Vollbild-Schaltfläche zum Videopanel hinzugefügt und erneutes Abspielen bei Ende ermöglicht"
  },
  "d3522e5": {
    "ko": "AI 포착 극적 순간 영상 개별 90도 좌우 회전 기능 구현",
    "en": "Support individual 90-degree left/right video rotation for AI captured dramatic moments",
    "ja": "AI劇的瞬間動画の個別90度左右回転機能に対応",
    "zh": "支持对 AI 捕获的各个精彩片段单独进行顺/逆时针 90 度画面旋转",
    "es": "Permitir rotación individual de 90 grados a izquierda y derecha en clips destacados",
    "fr": "Rotation individuelle à 90 degrés gauche/droite pour les clips de moments forts",
    "de": "Individuelle 90-Grad-Drehung nach links/rechts für Highlight-Clips unterstützt"
  },
  "47c3b6f": {
    "ko": "AI 포착 극적 순간 리스트 UI 개선 (썸네일 버튼 제거, 정렬 버튼 및 브릿지·촬영일시 스타일링)",
    "en": "Enhance AI dramatic moments list UI (remove thumbnail buttons, style sorting and bridge timestamps)",
    "ja": "AI劇的瞬間一覧UIの改善（サムネイルボタン削除、並び替えボタンおよびブリッジ・撮影日時のスタイリング）",
    "zh": "重构 AI 精彩瞬间列表 UI（移除多余缩略图按钮，美化排序按钮与过渡章节时间戳）",
    "es": "Mejorar interfaz de lista de momentos destacados (quitar botones superfluos y estilizar fechas)",
    "fr": "Améliorer l'UI des moments forts (retirer les boutons de miniature, styliser le tri et les dates)",
    "de": "UI der Highlight-Liste verbessert (Thumbnail-Buttons entfernt, Sortierung & Datum gestylt)"
  },
  "fc41739": {
    "ko": "역지오코딩 CORS 오류 해결, 비디오 currentTime 예외 방어 및 AI 게이트웨이 503 자동 복구 구현",
    "en": "Resolve reverse geocoding CORS issue, guard video currentTime, and auto-recover on AI Gateway 503",
    "ja": "逆ジオコーディングCORSエラー解決、動画currentTime例外ガードおよびAIゲートウェイ503自動復旧を実装",
    "zh": "解决逆地理编码跨域(CORS)故障，增加播放时间防御机制，遇 AI 网关 503 自动重连",
    "es": "Resolver CORS en geocodificación, proteger currentTime y autorrecuperar en error 503 de IA",
    "fr": "Corriger l'erreur CORS de géocodage, sécuriser currentTime et auto-reprise sur erreur 503",
    "de": "CORS-Fehler bei Geokodierung behoben, currentTime abgesichert & Auto-Recovery bei 503-Fehler"
  },
  "860b100": {
    "ko": "역지오코딩 타임아웃 예외 처리 안정화 및 AI 썸네일 추천 사유 연동",
    "en": "Stabilize reverse geocoding timeout handling and link AI thumbnail recommendation reasoning",
    "ja": "逆ジオコーディングタイムアウト例外処理の安定化およびAIサムネイル推薦理由の連携",
    "zh": "完善逆地理位置请求超时容错机制，并联动展示 AI 推荐缩略图的具体理由",
    "es": "Estabilizar manejo de timeout en geocodificación y vincular motivos de recomendación de miniaturas",
    "fr": "Stabiliser le délai d'attente de géocodage et afficher les critères de sélection IA des miniatures",
    "de": "Timeout-Handling bei Geokodierung stabilisiert und Begründung der KI-Thumbnail-Wahl angebunden"
  },
  "271e49f": {
    "ko": "하단 자막 툴팁 문구 현행화",
    "en": "Update bottom subtitle tooltip copy to match current feature set",
    "ja": "下部字幕ツールチップの文言を最新仕様に更新",
    "zh": "校对并同步底部字幕功能悬浮提示文案至最新规范",
    "es": "Actualizar textos del tooltip de subtítulos inferiores a la versión actual",
    "fr": "Mettre à jour le texte de l'infobulle des sous-titres inférieurs",
    "de": "Tooltip-Texte für untere Untertitel auf aktuellen Stand gebracht"
  },
  "62aba72": {
    "ko": "비디오 스티칭 시 재생 지연 방어 및 캔버스 동기화 안정성 개선",
    "en": "Defend against playback lag and enhance canvas synchronization stability during video stitching",
    "ja": "動画結合時の再生遅延防止ガードおよびキャンバス同期安定性を向上",
    "zh": "规避视频拼接过程中的播放卡顿，提升 Canvas 实时渲染画面的画音同步率",
    "es": "Evitar retardos de reproducción y mejorar sincronización de canvas al unir videos",
    "fr": "Prévenir les lenteurs de lecture et stabiliser la synchronisation canvas lors de l'assemblage",
    "de": "Wiedergabeverzögerungen beim Zusammenfügen verhindert und Canvas-Synchronisation stabilisiert"
  },
  "b5d6a9f": {
    "ko": "오버레이 오프스크린 캐싱 및 stalled 오인 버그 제거로 렌더링 프레임 드랍 해결",
    "en": "Resolve rendering frame drops by offscreen overlay caching and eliminating stalled state false alarms",
    "ja": "オフスクリーンオーバーレイキャッシュとstalled誤判定の除去によりレンダリングコマ落ちを解消",
    "zh": "引入离屏图层缓冲机制，杜绝虚假 stalled 停滞警报导致的渲染丢帧卡顿",
    "es": "Resolver caídas de fotogramas mediante caché de superposiciones y evitar falsas alertas de bloqueo",
    "fr": "Éliminer les pertes d'images par mise en cache hors écran et supprimer les faux blocages",
    "de": "Frame-Drops durch Offscreen-Overlay-Caching behoben und Fehlalarme bei stalled entfernt"
  },
  "4f0988e": {
    "ko": "상단 헤더 액션(새로시작·썸네일 다운로드) 정리 및 영상 다운로드 시퀀스 타임라인 하단 재배치",
    "en": "Reorganize top header actions (New Project, Download Thumbnail) and relocate video download below timeline",
    "ja": "上部ヘッダー操作（新規開始・サムネイルDL）の整理および動画ダウンロードをタイムライン下部へ再配置",
    "zh": "规整顶部导航栏核心操作（重新开始·下载缩略图），并将成片下载移至时间轴下方",
    "es": "Reorganizar acciones de cabecera y reubicar descarga de video debajo de la línea de tiempo",
    "fr": "Réorganiser l'en-tête et déplacer le téléchargement vidéo sous la timeline",
    "de": "Header-Aktionen neu angeordnet und Video-Download unter die Timeline verschoben"
  },
  "58f9f15": {
    "ko": "재병합 모달 오버레이 z-index 스타일 반영",
    "en": "Apply z-index styling to re-stitch modal backdrop overlay",
    "ja": "再結合モーダルのオーバーレイにz-indexスタイルを適用",
    "zh": "为重新拼接弹窗遮罩层补充正确的 z-index 层级样式",
    "es": "Aplicar estilos de z-index a la capa superpuesta del modal de reunión",
    "fr": "Appliquer les styles de z-index sur l'overlay de la modale de réassemblage",
    "de": "z-index-Stil für das Overlay des Zusammenfügen-Modals angewendet"
  },
  "4a0197c": {
    "ko": "데스크탑 설정 버튼 추가 및 만 나이(2살 미만 개월수) 표시 옵션 구현",
    "en": "Add desktop settings button and implement international age (months under 2 years) display option",
    "ja": "デスクトップ設定ボタンの追加および満年齢（2歳未満は月齢）表示オプションを実装",
    "zh": "增加桌面端专用设置入口，并实现国际周岁及 2 岁以下幼童月龄显示开关",
    "es": "Añadir botón de ajustes de escritorio y opción de mostrar edad en meses para menores de 2 años",
    "fr": "Ajouter les paramètres de bureau et l'option d'affichage de l'âge en mois pour les moins de 2 ans",
    "de": "Desktop-Einstellungen hinzugefügt und Monatsanzeige für Kinder unter 2 Jahren implementiert"
  },
  "5f67c72": {
    "ko": "iOS Safari MP4 무음 오디오 트랙 블로킹 및 paused 상태 stop 유실 버그 수정",
    "en": "Fix iOS Safari silent audio track blocking and resolve lost stop event in paused state",
    "ja": "iOS Safariでの無音オーディオトラック停止障害および一時停止時のstop喪失バグを修正",
    "zh": "修复 iOS Safari 在静音音轨时音频上下文卡死及暂停状态下 stop 丢失的缺陷",
    "es": "Corregir bloqueo de pistas de audio sin sonido en iOS Safari y eventos stop perdidos en pausa",
    "fr": "Corriger le blocage des pistes audio silencieuses et la perte d'événement stop sur iOS Safari",
    "de": "Blockieren stummer Audiospuren und Verlust des Stop-Events im Pausenmodus auf iOS Safari behoben"
  },
  "16d10cf": {
    "ko": "무음 영상 인코딩 시 오디오 코덱 MIME 제거 및 timeslice 1s 청크 스트리밍 적용",
    "en": "Remove audio codec MIME during silent video encoding and apply timeslice 1s chunk streaming",
    "ja": "無音動画エンコード時のオーディオコーデックMIME除去とtimeslice 1sチャンク配信を適用",
    "zh": "在编码无声音频时剔除多余的音频 Codec MIME 参数，并启用 1 秒分片流式写出",
    "es": "Eliminar MIME de audio al codificar videos sin sonido y aplicar fragmentación de 1s",
    "fr": "Supprimer le MIME audio lors de l'encodage sans son et diffuser par segments de 1 seconde",
    "de": "Audio-Codec-MIME bei stummen Videos entfernt und 1s-Chunk-Streaming angewendet"
  },
  "eb6e754": {
    "ko": "스튜디오 설정 내 자막 on/off 토글 및 유튜브 호환 다국어 SRT 자막 다운로드 기능 구현",
    "en": "Implement subtitle on/off toggle and YouTube-compatible multilingual SRT subtitle download",
    "ja": "スタジオ設定内の字幕ON/OFF切り替えおよびYouTube互換多言語SRT字幕ダウンロード機能を実装",
    "zh": "在工作室设置中增加字幕显示开关，并支持下载符合 YouTube 规范的多语言 SRT 字幕",
    "es": "Añadir interruptor de subtítulos y descarga de archivos SRT compatibles con YouTube",
    "fr": "Ajout d'un interrupteur de sous-titres et téléchargement de fichiers SRT pour YouTube",
    "de": "Untertitel-Ein/Ausschalter und YouTube-kompatibler mehrsprachiger SRT-Download implementiert"
  },
  "1ef8d8e": {
    "ko": "WebKit Bug 212275 회피, 캔버스 상시 하트비트 및 VideoToolbox 플러시 딜레이 적용",
    "en": "Workaround WebKit Bug 212275 with continuous canvas heartbeat and VideoToolbox flush delay",
    "ja": "WebKit Bug 212275の回避、キャンバス常時ハートビートおよびVideoToolbox flushディレイを適用",
    "zh": "规避 WebKit Bug 212275，开启 Canvas 持续心跳保活及 VideoToolbox 缓冲刷新延迟",
    "es": "Evitar el error WebKit Bug 212275 con latido continuo de canvas y retardo en VideoToolbox",
    "fr": "Contournement du bug WebKit 212275 avec signal constant et délai de vidage VideoToolbox",
    "de": "WebKit-Fehler 212275 mit kontinuierlichem Canvas-Heartbeat und Flush-Delay umgangen"
  },
  "53f582a": {
    "ko": "병합 실패 시 아이폰 상세 진단 리포트 및 원터치 복사 배너 적용",
    "en": "Apply iPhone detailed diagnostic report and one-touch copy banner on stitching failure",
    "ja": "結合失敗時のiPhone詳細診断レポートおよびワンタッチコピーバナーを適用",
    "zh": "当视频拼接失败时在 iPhone 设备上输出排错诊断报告并支持一键快捷复制",
    "es": "Generar informe de diagnóstico detallado y banner de copia rápida en fallos de unión en iPhone",
    "fr": "Rapport de diagnostic détaillé et bannière de copie en un clic en cas d'erreur sur iPhone",
    "de": "Detaillierter Diagnosebericht und Ein-Klick-Kopierbanner bei Zusammenfügungsfehler auf iPhone"
  },
  "2e2ad23": {
    "ko": "AI 분석 모달 내 영상 썸네일 표시 및 실시간 작업·추론 단일 라인 표시로 개편",
    "en": "Revamp AI analysis modal with video thumbnails and single-line real-time reasoning display",
    "ja": "AI解析モーダル内に動画サムネイルを表示しリアルタイム推論を1行表示に改編",
    "zh": "改版 AI 分析弹窗，展示视频缩略图并将实时推理步骤整合为单行清晰轮播",
    "es": "Rediseñar modal de análisis de IA con miniaturas y visualización de razonamiento en una sola línea",
    "fr": "Refonte de la modale d'analyse IA avec miniatures et affichage du raisonnement sur une seule ligne",
    "de": "KI-Analyse-Modal mit Thumbnails und einzeiliger Echtzeit-Inferenzanzeige überarbeitet"
  },
  "5f154e3": {
    "ko": "AI 분석 모달 내 실시간 추론 박스 배경을 화이트톤으로 변경 및 텍스트 시인성 개선",
    "en": "Change real-time reasoning box background to white tone and improve text contrast in AI analysis modal",
    "ja": "AI解析モーダル内のリアルタイム推論ボックスを白基調に変更しテキスト視認性を向上",
    "zh": "将 AI 分析弹窗中实时推理信息框调整为高对比度白底，提升文字可读性",
    "es": "Cambiar fondo del cuadro de razonamiento en tiempo real a blanco y mejorar contraste",
    "fr": "Passer le fond de la boîte de raisonnement en blanc et améliorer la lisibilité du texte",
    "de": "Hintergrund der Inferenz-Box auf Weiß umgestellt und Lesbarkeit des Textes verbessert"
  },
  "5ec2504": {
    "ko": "AI 분석 모달 내 중복 헤더 제거 및 실시간 작업 문구를 1줄 고정 말줄임·소형 폰트로 개편",
    "en": "Remove duplicate headers in AI analysis modal and switch real-time tasks to single-line ellipsis font",
    "ja": "AI解析モーダル内の重複ヘッダーを削除しリアルタイム作業文言を1行省略表示・小型フォントに改編",
    "zh": "精简 AI 分析弹窗中的多余标题，将实时状态文案改为单行末尾省略与小号字排版",
    "es": "Eliminar encabezados duplicados en modal de análisis y mostrar tareas en una línea con puntos suspensivos",
    "fr": "Supprimer les en-têtes dupliqués et afficher les tâches sur une seule ligne avec ellipse",
    "de": "Doppelte Überschriften im KI-Analyse-Modal entfernt und Aufgabenzeile einzeilig formatiert"
  },
  "e550387": {
    "ko": "AI 분석 모달 내 작업/추론 문구를 11px 소형 폰트 및 2줄 고정 높이 말줄임으로 개편",
    "en": "Revamp task/reasoning text in AI analysis modal with compact 11px font and fixed 2-line ellipsis height",
    "ja": "AI解析モーダル内の作業・推論テキストを11px小型フォントおよび2行固定高さ省略表示に改編",
    "zh": "将 AI 弹窗任务与推理文字调整为 11px 紧凑排版并锁定双行固定高度溢出省略",
    "es": "Ajustar texto de tareas/razonamiento a 11px y altura fija de 2 líneas con puntos suspensivos",
    "fr": "Ajuster la police à 11px et hauteur fixe sur 2 lignes avec ellipse pour les tâches et raisonnements",
    "de": "Text im Analyse-Modal auf 11px und feste zweizeilige Höhe mit Auslassungspunkten angepasst"
  },
  "16838a7": {
    "ko": "모바일 Safari 구간 전환 시 멈춤 프레임 녹화 및 영상 재생 길이 초과 버그 수정",
    "en": "Fix mobile Safari freeze frame recording and video playback duration overflow during scene transitions",
    "ja": "モバイルSafariの区間切り替え時のフリーズ録画および再生時間超過の不具合を修正",
    "zh": "修复移动端 Safari 在片段转场时录制卡顿静止帧及播放总时长超限溢出的问题",
    "es": "Corregir fotogramas congelados en grabaciones de Safari móvil y exceso en la duración de video",
    "fr": "Corriger l'enregistrement d'images figées sur Safari mobile et le dépassement de durée de lecture",
    "de": "Eingefrorene Frames und Überschreitung der Videodauer beim Szenenwechsel auf mobiler Safari behoben"
  },
  "9b1b654": {
    "ko": "AI 분석 모달 디자인 복구 및 듀얼 워커 0ms 핑퐁 파이프라인 적용",
    "en": "Restore AI analysis modal design and deploy 0ms dual-worker ping-pong pipeline",
    "ja": "AI解析モーダルのデザイン復旧および0msデュアルワーカーPing-Pongパイプラインを適用",
    "zh": "恢复 AI 分析弹窗经典视觉设计，并应用 0 延迟双 Worker 乒乓流式处理管线",
    "es": "Restaurar diseño del modal de análisis e implementar canalización ping-pong de doble worker con 0ms",
    "fr": "Restaurer le design de la modale d'analyse et intégrer un pipeline à double worker sans latence",
    "de": "Design des Analyse-Modals wiederhergestellt und latenzfreie Dual-Worker-Pipeline aktiviert"
  },
  "54d9d78": {
    "ko": "아이폰 저전력 모드 및 Safari 자동재생 차단 시 프레임 스텝 모드 자동 폴백 적용",
    "en": "Apply auto frame-step fallback on iPhone Low Power Mode and Safari autoplay blocking",
    "ja": "iPhone低電力モードおよびSafari自動再生制限時にフレームステップモードへ自動フォールバック",
    "zh": "针对 iPhone 低电量模式与 Safari 自动播放拦截机制，实现逐帧步进模式无感兜底",
    "es": "Activar modo de avance fotograma a fotograma si Safari bloquea la reproducción automática en iPhone",
    "fr": "Basculement automatique pas à pas lors du blocage de lecture automatique sur iPhone",
    "de": "Automatischer Frame-Step-Fallback bei Energiesparmodus und Autoplay-Sperre auf dem iPhone"
  },
  "a29bea1": {
    "ko": "대기 워커 백그라운드 자동재생으로 인한 2번째 씬 조기 스킵 버그 수정",
    "en": "Fix premature skip of scene 2 caused by idle worker background autoplay",
    "ja": "待機ワーカーのバックグラウンド自動再生による2番目シーンの誤スキップバグを修正",
    "zh": "修复备用 Worker 在后台意外自动播放导致第 2 个场景被提前跳过的逻辑缺陷",
    "es": "Corregir salto prematuro de la escena 2 causado por reproducción en segundo plano del worker inactivo",
    "fr": "Corriger le passage prématuré de la scène 2 causé par la lecture en arrière-plan d'un worker inactif",
    "de": "Vorzeitiges Überspringen von Szene 2 durch Hintergrund-Wiedergabe des inaktiven Workers behoben"
  },
  "57e7e78": {
    "ko": "use single hardware decoder pipeline and active playback accumulator so scene 2 plays completely on iOS",
    "en": "Use single hardware decoder pipeline and active playback accumulator so scene 2 plays completely on iOS",
    "ja": "単一ハードウェアデコーダーと再生アキュムレーターによりiOSでシーン2が完全再生されるよう改善",
    "zh": "采用单硬件解码器流水线与播放累加器，确保 iOS 设备能够完整连贯播放后续场景",
    "es": "Usar un único decodificador por hardware y acumulador para reproducir la escena 2 completa en iOS",
    "fr": "Utiliser un pipeline de décodage matériel unique pour assurer la lecture complète de la scène 2 sur iOS",
    "de": "Einzelne Hardware-Decoder-Pipeline eingesetzt, damit Szene 2 auf iOS vollständig abgespielt wird"
  },
  "8148d28": {
    "ko": "상단 헤더 내 데스크탑 AI 모델 선택 트리거 제거 (설정 모달로 일원화)",
    "en": "Remove desktop AI model selector trigger from top header (consolidate into Settings modal)",
    "ja": "上部ヘッダーからデスクトップ用AIモデル選択トリガーを削除（設定モーダルに一本化）",
    "zh": "从顶部导航栏移除桌面端 AI 模型切换按钮（统一整合至设置弹窗）",
    "es": "Eliminar selector de modelos de IA de la cabecera (unificar en el modal de Ajustes)",
    "fr": "Retirer le sélecteur de modèle d'IA de l'en-tête (centralisé dans les Paramètres)",
    "de": "Modellauswahl aus der Kopfzeile entfernt und in den Einstellungen gebündelt"
  },
  "4df8739": {
    "ko": "영상 공유 화면 좌우 풀 너비 확장 및 5·4·3·2·1 반응형 그리드 적용",
    "en": "Expand video share screen to full width and apply 5-4-3-2-1 responsive grid",
    "ja": "動画共有画面を左右フル幅に拡張し5・4・3・2・1のレスポンシブグリッドを適用",
    "zh": "将视频分享画廊宽度扩充至全屏，并适配 5·4·3·2·1 递减响应式栅格",
    "es": "Expandir pantalla para compartir videos a ancho completo y aplicar cuadrícula responsiva 5-4-3-2-1",
    "fr": "Élargir la vue de partage à 100% et appliquer une grille adaptative 5-4-3-2-1",
    "de": "Video-Share-Ansicht auf volle Breite erweitert mit responsivem 5-4-3-2-1 Raster"
  },
  "f601f9e": {
    "ko": "모바일에서 AI 포착 극적 순간 카드 헤더 찌그러짐 수정 및 액션 그룹 분리 정렬",
    "en": "Fix distorted card header in AI captured dramatic moments on mobile and separate action group alignment",
    "ja": "モバイルでのAI劇的瞬間カードヘッダーの歪みを修正しアクションボタングループを分離整列",
    "zh": "修复移动端 AI 精彩瞬间卡片头部挤压变形，并合理分离操作按钮排布",
    "es": "Corregir deformación del encabezado de tarjetas de momentos destacados en móviles y separar acciones",
    "fr": "Corriger l'en-tête déformé des cartes de moments forts sur mobile et séparer les boutons d'action",
    "de": "Verzerrten Kartenkopf bei Highlight-Momenten auf Mobilgeräten behoben und Aktionen neu angeordnet"
  },
  "96c8bee": {
    "ko": "영상 업로드 패널 테두리 점선(dashed) 스타일 적용 및 호버 인터랙션 개선",
    "en": "Apply dashed border style and enhance hover interactions on video upload panel",
    "ja": "動画アップロードパネルに点線(dashed)枠線スタイルを適用しホバー操作を改善",
    "zh": "视频上传拖拽面板应用经典虚线边框样式，并增强悬停微交互效果",
    "es": "Aplicar estilo de borde discontinuo y mejorar interacción al pasar el cursor en panel de subida",
    "fr": "Appliquer une bordure en pointillés et améliorer les effets de survol sur le panneau d'import",
    "de": "Gestrichelten Rahmenstil und verbesserte Hover-Effekte auf Video-Upload-Panel angewendet"
  },
  "e5bcd15": {
    "ko": "모바일 AI 극적 순간 카드 헤더 내 불필요한 세로 공백 제거",
    "en": "Remove redundant vertical whitespace inside mobile AI dramatic moment card headers",
    "ja": "モバイルのAI劇的瞬間カードヘッダー内の不要な縦方向の余白を削除",
    "zh": "消除移动端 AI 精彩瞬间卡片头部多余的垂直空白间距",
    "es": "Eliminar espacio vertical innecesario en encabezados de tarjetas de momentos destacados en móviles",
    "fr": "Supprimer l'espacement vertical superflu dans les cartes de moments forts sur mobile",
    "de": "Überflüssigen vertikalen Weißraum in den Kartenköpfen auf Mobilgeräten entfernt"
  },
  "246609f": {
    "ko": "유튜브 영상 공유 커뮤니티 갤러리 및 Supabase DB 연동 기능 추가",
    "en": "Add YouTube video sharing community gallery tab and Supabase DB integration",
    "ja": "YouTube動画共有コミュニティギャラリータブおよびSupabase DB連携機能を追加",
    "zh": "新增 YouTube 视频分享社区画廊标签页及 Supabase 数据库同步能力",
    "es": "Añadir pestaña de galería comunitaria para compartir videos de YouTube e integración con Supabase",
    "fr": "Ajouter l'onglet galerie de partage vidéo YouTube et intégration base de données Supabase",
    "de": "YouTube-Video-Sharing-Community-Tab und Supabase-Datenbank-Integration hinzugefügt"
  },
  "60eea53": {
    "ko": "영상 공유 커뮤니티 UI 문구 다듬기 및 초기 시드 비디오 노출 처리",
    "en": "Polish video sharing community copy and display initial seed videos",
    "ja": "動画共有コミュニティの文言調整および初期シード動画の表示処理",
    "zh": "润色视频分享社区界面文案，并提供精选种子视频初始展示",
    "es": "Pulir textos de la comunidad de videos compartidos y mostrar videos iniciales de muestra",
    "fr": "Peaufiner les textes de la communauté de partage et afficher les vidéos d'exemple",
    "de": "Texte der Video-Sharing-Community verfeinert und anfängliche Seed-Videos angezeigt"
  },
  "4787fb2": {
    "ko": "AI 썸네일 프레임 캡처 및 미리보기 표시 오류 수정",
    "en": "Fix AI thumbnail frame capture and preview rendering issue",
    "ja": "AIサムネイルフレームキャプチャおよびプレビュー表示の不具合を修正",
    "zh": "修复 AI 缩略图截帧与预览展示偶发空白的问题",
    "es": "Corregir captura de fotogramas de miniatura de IA y visualización de vista previa",
    "fr": "Corriger la capture de miniature par IA et l'affichage de la prévisualisation",
    "de": "Fehler bei KI-Thumbnail-Frame-Erfassung und Vorschaudarstellung behoben"
  },
  "47614d4": {
    "ko": "영상 공유 커뮤니티 UI를 기존 모던 디자인 시스템 및 카드 테마로 전면 통일",
    "en": "Unify video sharing community UI with existing modern design system and card themes",
    "ja": "動画共有コミュニティUIを既存のモダンデザインシステムおよびカードテーマに全面統一",
    "zh": "将视频分享社区界面样式全面统一为现有现代化设计规范与卡片风格",
    "es": "Unificar la interfaz de la comunidad con el sistema de diseño moderno y temas de tarjetas",
    "fr": "Uniformiser l'UI de la communauté avec le design system moderne et les cartes",
    "de": "UI der Video-Sharing-Community mit dem modernen Designsystem und Kartenthemen vereinheitlicht"
  },
  "ae3ab35": {
    "ko": "썸네일 상단 불필요 문구 및 배지 제거",
    "en": "Remove redundant text and badge above thumbnails",
    "ja": "サムネイル上部の不要なテキストおよびバッジを削除",
    "zh": "移除缩略图上方多余的说明文字与标签角标",
    "es": "Eliminar textos y distintivos redundantes sobre las miniaturas",
    "fr": "Supprimer les mentions et badges inutiles au-dessus des miniatures",
    "de": "Überflüssigen Text und Badges über den Thumbnails entfernt"
  },
  "e1a5b62": {
    "ko": "모바일 상단 네비게이션 탭 아이콘화 및 NEW 배지 제거로 우측 버튼 잘림 해결",
    "en": "Convert mobile top navigation to icons and remove NEW badge to resolve button clipping",
    "ja": "モバイル上部ナビゲーションをアイコン化しNEWバッジを削除してボタン見切れを解消",
    "zh": "将移动端顶部导航标签改为精简图标并移除 NEW 徽标，彻底解决右侧按钮被截断",
    "es": "Convertir navegación superior móvil en iconos y quitar etiqueta NEW para evitar recortes",
    "fr": "Transformer la navigation mobile en icônes et retirer le badge NEW pour éviter les coupures",
    "de": "Mobile Navigationsleiste auf Icons umgestellt und NEW-Badge entfernt, um Abschneiden zu verhindern"
  },
  "be835f3": {
    "ko": "모바일 상단바 AI 모델/언어/설정 메뉴를 설정 모달로 분리하여 버튼 잘림 현상 해결",
    "en": "Move AI model, language, and settings into dedicated Settings modal to fix header overflow on mobile",
    "ja": "モバイル上部バーのモデル・言語・設定メニューを設定モーダルに集約しはみ出しを解消",
    "zh": "将移动端顶部栏的模型、语言与偏好菜单合并至设置弹窗，解决按钮溢出",
    "es": "Mover modelo de IA, idioma y ajustes a un modal dedicado para evitar desbordes en móviles",
    "fr": "Déplacer le modèle IA, la langue et les réglages dans une modale dédiée sur mobile",
    "de": "KI-Modell, Sprache und Einstellungen in Einstellungs-Modal gebündelt, um Überlauf zu beheben"
  },
  "a9fc7e3": {
    "ko": "모바일 상단바 영상 목록 및 액션 버튼 레이아웃 깨짐 현상 수정",
    "en": "Fix video list and action button layout glitches in mobile top bar",
    "ja": "モバイル上部バーの動画一覧およびアクションボタンのレイアウト崩れを修正",
    "zh": "修复移动端顶部栏中视频列表与操作按钮排版溢出与错位缺陷",
    "es": "Corregir fallos de diseño en la lista de videos y botones de acción en la barra superior móvil",
    "fr": "Corriger les bugs d'affichage de la liste des vidéos et des boutons sur la barre mobile",
    "de": "Layout-Fehler in Videoliste und Aktions-Buttons in der mobilen Kopfzeile behoben"
  },
  "480987d": {
    "ko": "인트로 겹침 및 BGM 순간이동 버그 수정 (오디오 동기화·타임라인 오프셋 반영)",
    "en": "Fix intro overlap and BGM teleportation bugs (audio sync & timeline offset calculation)",
    "ja": "イントロ重複およびBGMの不意なシークの不具合を修正（音声同期・タイムラインオフセット反映）",
    "zh": "修复片头重叠及背景音乐异常跳跃现象（精确计算音频同步与时间轴偏移量）",
    "es": "Corregir superposición de intro y saltos de música (sincronización de audio y desfase temporal)",
    "fr": "Corriger le chevauchement d'intro et les sauts de musique (synchronisation et décalage)",
    "de": "Intro-Überlappung und BGM-Sprünge behoben (Audiosynchronisation & Timeline-Offset angepasst)"
  },
  "5c78a8c": {
    "ko": "시퀀스 타임라인 인트로/아웃트로 싱크 불일치 버그 수정",
    "en": "Fix intro and outro synchronization mismatch in sequence timeline",
    "ja": "シーケンスタイムラインのイントロ・アウトトロ同期不整合の不具合を修正",
    "zh": "修复序列时间轴中片头片尾画面与主轨音画不同步的异常",
    "es": "Corregir desajuste de sincronización en intro y outro en la línea de tiempo",
    "fr": "Corriger le décalage de synchronisation sur l'intro et l'outro dans la timeline",
    "de": "Synchronisationsfehler zwischen Intro und Outro in der Sequenz-Timeline behoben"
  },
  "955a447": {
    "ko": "브라우저 기본 body 마진 제거, 좌측 패널 축소 및 우측 패널 확장(44:56), 영상 100% 꽉 채움 적용",
    "en": "Support BGM audio extraction via YouTube link or video key",
    "ja": "YouTubeリンクまたは動画キーからのBGMオーディオ抽出機能に対応",
    "zh": "支持粘贴 YouTube 链接或视频唯一标识快速提取免版税背景配乐",
    "es": "Permitir extracción de audio de música de fondo a través de enlace o clave de YouTube",
    "fr": "Extraction audio de musique de fond via un lien ou une clé de vidéo YouTube",
    "de": "Audioextraktion für Hintergrundmusik über YouTube-Link oder Video-Key unterstützt"
  },
  "f37243c": {
    "ko": "빈 영상 플레이어 모서리 검은 테두리(블리드) 제거 및 빈 상태/재생 상태 배경 스타일 분리",
    "en": "Consolidate scene subtitle, date, and location editing inline within AI captured dramatic moments list",
    "ja": "選択シーンの字幕・日時・位置編集を「AIが捉えた劇的瞬間」一覧内にインライン統合",
    "zh": "将选定场景的字幕文案、日期与地理信息编辑无缝内联整合至“AI 捕获精彩片段”列表中",
    "es": "Integrar edición de subtítulos, fechas y lugares en línea dentro de la lista de momentos destacados",
    "fr": "Intégrer l'édition des sous-titres, dates et lieux directement dans la liste des moments forts",
    "de": "Bearbeitung von Untertitel, Datum und Ort direkt in die Liste der Highlight-Momente integriert"
  },
  "5c420b1": {
    "ko": "다국어(i18n) 시스템 구축 및 영어 기본값·한국어 포함 7개 언어 지원 적용",
    "en": "Fix layout jank caused by active playing indicator inside AI captured dramatic moments list",
    "ja": "「AIが捉えた劇的瞬間」一覧内の再生中インジケーターによるレイアウトの揺れを修正",
    "zh": "修复“AI 捕获精彩瞬间”列表中正在播放指示标导致整体卡片高度抖动的布局缺陷",
    "es": "Corregir desajuste de diseño causado por el indicador de reproducción activa en la lista",
    "fr": "Corriger le tressautement d'affichage causé par l'indicateur de lecture dans la liste",
    "de": "Layout-Ruckler durch Wiedergabe-Indikator in der Highlight-Moment-Liste behoben"
  },
  "2a91e2f": {
    "ko": "다국어 선택 UI를 모델 선택창 스타일의 모달 팝업으로 개편 및 CSS 깨짐 수정",
    "en": "Remove default browser body margin, shrink left panel & widen right panel (44:56), fill video 100%",
    "ja": "ブラウザ既定のbodyマージン削除、左パネル縮小・右パネル拡大(44:56)、動画100%全画面フィット適用",
    "zh": "移除浏览器默认 body 边距，微调左右面板比例至 44:56，使视频 100% 撑满自适应呈现",
    "es": "Eliminar margen de body, ajustar proporción de paneles (44:56) y expandir video al 100%",
    "fr": "Supprimer la marge body par défaut, ajuster les panneaux (44:56) et adapter la vidéo à 100%",
    "de": "Standard-Body-Rand entfernt, Panels auf 44:56 angepasst und Video auf 100% skaliert"
  },
  "d47a5bb": {
    "ko": "모바일 상단 헤더 레이아웃 최적화 및 1열 통합 세로 스크롤 지원",
    "en": "Remove black border (bleed) on empty video player corners and separate empty vs playback backgrounds",
    "ja": "空の動画プレイヤー四隅の黒枠(ブリード)を除去し、空状態と再生状態の背景スタイルを分離",
    "zh": "消除空白播放器四角黑边渗出，并将空状态与播放状态的背景样式彻底分离",
    "es": "Eliminar bordes negros en esquinas del reproductor vacío y diferenciar fondos",
    "fr": "Supprimer les bordures noires sur le lecteur vide et séparer les styles de fond",
    "de": "Schwarze Ränder am leeren Player entfernt und Hintergründe für Leer-/Wiedergabemodus getrennt"
  },
  "b5f59c6": {
    "ko": "업로드 영상 팝업 버튼 스타일 및 상하단 영역 UI 정돈",
    "en": "Build multilingual i18n system supporting 7 languages with English as default and Korean included",
    "ja": "英語をデフォルトとし韓国語を含む7言語対応の多言語(i18n)システムを構築",
    "zh": "搭建国际化(i18n)多语言体系，以英语为默认并支持包括韩语在内的 7 国语言",
    "es": "Construir sistema multilingüe i18n para 7 idiomas con inglés por defecto y coreano",
    "fr": "Création du système multilingue i18n supportant 7 langues avec anglais par défaut",
    "de": "Mehrsprachiges i18n-System für 7 Sprachen mit Englisch als Standard aufgebaut"
  },
  "fa839fa": {
    "ko": "AI 모델 선택 모달의 파라미터·지능티어·태그 등 다국어 번역 미흡 항목 전면 개선",
    "en": "Redesign language selector UI into model-selector style modal popup and fix CSS glitches",
    "ja": "言語選択UIをモデル選択ダイアログ風モーダルポップアップに刷新しCSS崩れを修正",
    "zh": "将语言切换 UI 重构为类似模型选择框的卡片弹窗并修复 CSS 样式错位",
    "es": "Rediseñar selector de idiomas como ventana modal estilo selector de modelos y corregir CSS",
    "fr": "Refonte du sélecteur de langue sous forme de modale et correction des erreurs CSS",
    "de": "Sprachauswahl als kartenbasiertes Modal-Popup überarbeitet und CSS-Fehler behoben"
  },
  "fd82ceb": {
    "ko": "Nemotron 3.5 Super VL 모델 제거 및 전체 모델명에서 '(free)' 표기 삭제",
    "en": "Optimize mobile top header layout and support single-column unified vertical scrolling",
    "ja": "モバイル上部ヘッダーのレイアウト最適化および1列統合縦スクロールに対応",
    "zh": "针对移动端优化顶部导航排版，支持单列一体化纵向顺畅滚动",
    "es": "Optimizar diseño del encabezado móvil y permitir desplazamiento vertical de una columna",
    "fr": "Optimiser l'en-tête mobile et prendre en charge le défilement vertical sur une colonne",
    "de": "Mobiles Header-Layout optimiert und einspaltiges vertikales Scrollen unterstützt"
  },
  "ccaa2db": {
    "ko": "Nemotron 3.5 Super VL 모델 필터링 제외 및 전체 모델명 '(free)' 표기 전면 삭제",
    "en": "Refine uploaded video popup button styles and tidy upper and lower UI zones",
    "ja": "アップロード動画ポップアップのボタンスタイルおよび上下エリアのUIを整理",
    "zh": "微调已上传视频列表弹窗按钮视觉样式并规整上下布局间距",
    "es": "Refinar estilos de botones en modal de videos y organizar áreas superior e inferior",
    "fr": "Peaufiner les styles de boutons de la modale vidéo et ordonner l'interface",
    "de": "Button-Stile im Upload-Modal verfeinert und obere/untere Bereiche aufgeräumt"
  },
  "0a6f3ef": {
    "ko": "모델 정렬 순서를 지능순으로 변경 및 최고 지능 모델 기본 선택 적용",
    "en": "Thoroughly enhance AI model modal translations for parameters, intelligence tiers, and tags",
    "ja": "AIモデル選択モーダルのパラメータ・知能階層・タグ等の多言語翻訳不備を全面改善",
    "zh": "全面修复并完善 AI 模型选择弹窗中的参数规模、算力梯队与技术标签的多语言翻译",
    "es": "Mejorar traducciones de parámetros, niveles de inteligencia y etiquetas en selector de modelos",
    "fr": "Améliorer les traductions des paramètres, tiers d'intelligence et tags dans la modale IA",
    "de": "Übersetzungen für Modellparameter, Intelligenz-Stufen und Tags umfassend verbessert"
  },
  "880ae0b": {
    "ko": "배경음악 오디오 보관함 팝업 및 내장 음원 3종 선택 지원",
    "en": "Remove Nemotron 3.5 Super VL model and purge '(free)' notations from all model names",
    "ja": "Nemotron 3.5 Super VLモデルを削除し全モデル名から「(free)」表記を全面除去",
    "zh": "移除 Nemotron 3.5 Super VL 模型，并清理所有模型名称中残留的 '(free)' 免费标注",
    "es": "Eliminar el modelo Nemotron 3.5 Super VL y suprimir el texto '(free)' de los nombres de modelos",
    "fr": "Supprimer le modèle Nemotron 3.5 Super VL et retirer la mention '(free)' de tous les modèles",
    "de": "Nemotron 3.5 Super VL-Modell entfernt und '(free)'-Zusatz aus allen Modellnamen gelöscht"
  },
  "ba2004d": {
    "ko": "상단 헤더 로고를 관리자와 동일한 Reportist 브랜드 로고로 통일",
    "en": "Exclude Nemotron 3.5 Super VL from filtering and completely remove '(free)' markers",
    "ja": "Nemotron 3.5 Super VLモデルの除外フィルタリングと「(free)」表記の完全削除",
    "zh": "彻底从过滤列表中剔除 Nemotron 3.5 Super VL 并移除所有 '(free)' 标签",
    "es": "Excluir Nemotron 3.5 Super VL de los filtros y eliminar marcas '(free)' por completo",
    "fr": "Exclure Nemotron 3.5 Super VL des filtres et supprimer totalement les mentions '(free)'",
    "de": "Nemotron 3.5 Super VL von Filtern ausgeschlossen und '(free)'-Zusätze restlos entfernt"
  },
  "6741f1a": {
    "ko": "모바일 배경음악 카드 레이아웃 오버플로 및 줄바꿈 깨짐 수정",
    "en": "Change model sorting to intelligence-descending order and default to highest intelligence model",
    "ja": "モデル並び順を知能スコア順に変更し最高知能モデルをデフォルト選択に設定",
    "zh": "将模型默认排序规则改为按综合智能评分降序，默认自动选中最高阶模型",
    "es": "Ordenar modelos por nivel de inteligencia y preseleccionar el de mayor capacidad",
    "fr": "Classer les modèles par intelligence décroissante et sélectionner le plus performant par défaut",
    "de": "Modelle nach Intelligenz absteigend sortiert und das leistungsfähigste standardmäßig gewählt"
  },
  "2f76a9e": {
    "ko": "Remotion 스타일 프로 비디오 스튜디오 에디터, NLE 멀티트랙 타임라인, BGM 신디사이저 및 클립 인스펙터 구현",
    "en": "Unify top header logo to official Reportist brand logo matching admin portal",
    "ja": "上部ヘッダーのロゴを管理者ポータルと同一のReportist公式ブランドロゴに統一",
    "zh": "顶部导航栏 Logo 与管理后台完全统一为 Reportist 官方品牌视觉标识",
    "es": "Unificar el logotipo de cabecera con la marca oficial de Reportist",
    "fr": "Uniformiser le logo de l'en-tête avec le logo officiel de la marque Reportist",
    "de": "Header-Logo an das offizielle Reportist-Markenlogo des Admin-Portals angepasst"
  },
  "e55142d": {
    "ko": "첫 화면부터 Remotion 스타일 다크 NLE 스튜디오 에디터로 전면 개편",
    "en": "Fix mobile background music card layout overflow and text wrap issues",
    "ja": "モバイルでのBGMカードのレイアウトはみ出しおよび文字折り返し崩れを修正",
    "zh": "修复移动端背景音乐卡片排版宽度溢出及文字异常换行缺陷",
    "es": "Corregir desbordamientos y saltos de línea en tarjeta de música de fondo en móviles",
    "fr": "Corriger les débordements et retours à la ligne de la carte de musique sur mobile",
    "de": "Layout-Überlauf und fehlerhafte Zeilenumbrüche der BGM-Karte auf Mobilgeräten behoben"
  },
  "d3c0270": {
    "ko": "깔끔하고 정갈한 16:9 AI 영상 스튜디오 전면 리뉴얼",
    "en": "Resolve iPhone segment stitching stalls via timeout watchdog, frame-step fallback & MP4 encoding",
    "ja": "タイムアウト監視・フレームステップフォールバック・MP4録画によりiPhone結合フリーズを解決",
    "zh": "借助超时看门狗、逐帧步进容错与 MP4 规范写出，彻底解决 iPhone 视频拼接卡死",
    "es": "Resolver bloqueos de unión en iPhone mediante control de tiempo de espera y avance por fotogramas",
    "fr": "Résoudre les blocages sur iPhone grâce à une surveillance de délai et repli image par image",
    "de": "iPhone-Hänger beim Zusammenfügen durch Watchdog, Frame-Step-Fallback und MP4 gelöst"
  },
  "9fa14eb": {
    "ko": "비디오 재생/일시정지 및 프로그레스 바 버그 수정, 16:9 인터랙티브 시퀀스 타임라인 에디터 트랙 추가",
    "en": "Implement Remotion-inspired Pro Studio Editor, NLE multi-track timeline, BGM synth & clip inspector",
    "ja": "Remotionスタイルのプロスタジオエディター、NLEマルチトラックタイムライン、BGMシンセ＆クリップ詳細を実装",
    "zh": "实现类似 Remotion 的专业剪辑工作台、NLE 多轨时间轴、BGM 合成器与片段属性检查器",
    "es": "Implementar editor de estudio profesional estilo Remotion, línea de tiempo NLE y sintetizador BGM",
    "fr": "Implémentation d'un éditeur pro inspiré de Remotion avec timeline NLE et synthétiseur BGM",
    "de": "Remotion-inspirierter Studio-Editor, NLE-Mehrspur-Timeline und BGM-Synthesizer implementiert"
  },
  "4a44b97": {
    "ko": "사용자 BGM 직접 업로드, 제목·채널·촬영일자 오버레이 자막, 인트로/아웃트로 옵션 및 병합 멈춤 버그 수정",
    "en": "Complete overhaul to Remotion-style dark NLE studio editor from the initial landing screen",
    "ja": "初期画面からRemotionスタイルのダークNLEスタジオエディターへ全面改編",
    "zh": "从着陆首屏起全面改版为沉浸式深色专业 NLE 剪辑工作台界面",
    "es": "Renovación completa a editor de estudio oscuro estilo Remotion desde la pantalla inicial",
    "fr": "Refonte complète vers un éditeur de studio NLE sombre style Remotion dès la première page",
    "de": "Komplette Umstellung auf dunklen NLE-Studio-Editor im Remotion-Stil ab dem Startbildschirm"
  },
  "982b8fa": {
    "ko": "씬별 자막·촬영일자 편집, GPS 지도 연동, 인트로/아웃트로 동영상 삽입 및 AI 실시간 추론 콘솔 구현",
    "en": "Full renewal into clean and elegant 16:9 AI video production studio",
    "ja": "洗練された清潔感あふれる16:9 AI動画スタジオへ全面リニューアル",
    "zh": "全面焕新为现代、考究、直观的 16:9 AI 视频创作工作室",
    "es": "Renovación integral a un estudio de producción de video IA 16:9 limpio y elegante",
    "fr": "Refonte globale en un studio vidéo IA 16:9 élégant et soigné",
    "de": "Komplette Neugestaltung zu einem eleganten 16:9 KI-Videoproduktionsstudio"
  },
  "cb7aefa": {
    "ko": "영상 분석 추론 과정 실시간 스트리밍 적용 및 AI 추론 콘솔 멈춤 현상 해결",
    "en": "Fix video play/pause and progress bar bugs; add 16:9 interactive sequence timeline editor track",
    "ja": "動画再生・一時停止およびバーのバグ修正、16:9インタラクティブシーケンスタイムライントラックを追加",
    "zh": "修复视频播放/暂停与进度条交互缺陷，新增 16:9 交互式序列时间轴编辑轨道",
    "es": "Corregir reproducción/pausa y barra de progreso; añadir pista interactiva de línea de tiempo 16:9",
    "fr": "Corriger lecture/pause et barre de progression; ajouter une piste d'édition de timeline 16:9",
    "de": "Wiedergabe/Pause und Fortschrittsleiste repariert; 16:9-Timeline-Spur hinzugefügt"
  },
  "dfc0a2a": {
    "ko": "선택 씬 자막·날짜·위치 편집을 'AI가 포착한 극적 순간' 목록 내 인라인으로 통합",
    "en": "Support custom BGM upload, title/channel/date overlay subtitles, intro/outro options and fix stalls",
    "ja": "カスタムBGMアップロード、タイトル・日付字幕、イントロ・アウトトロおよび結合フリーズ修正に対応",
    "zh": "支持用户自主上传配乐、标题/拍摄日/频道名字幕浮层、片头片尾选项并修复合并假死",
    "es": "Permitir subida de BGM, subtítulos superpuestos de fecha/título y opciones de intro/outro",
    "fr": "Permettre l'import de BGM, sous-titres superposés date/titre et options d'intro/outro",
    "de": "Eigenen BGM-Upload, Datums-/Titel-Untertitel, Intro/Outro-Optionen unterstützt und Hänger behoben"
  },
  "59cdebb": {
    "ko": "AI가 포착한 극적 순간 목록의 재생 중 표시가 레이아웃을 흔들던 문제 수정",
    "en": "Implement per-scene subtitle/date editing, GPS map integration, intro/outro insertion & real-time AI console",
    "ja": "シーン別字幕・日時編集、GPS地図連携、イントロ動画挿入およびAIリアルタイム推論コンソールを実装",
    "zh": "实现按场景逐一微调字幕与拍摄时间、GPS 地图定位联动、自定义片头插入及 AI 实时推理控制台",
    "es": "Implementar edición de subtítulos/fechas por escena, mapa GPS, inserción de intro y consola de IA",
    "fr": "Édition des sous-titres et dates par scène, intégration carte GPS, intro vidéo et console IA",
    "de": "Szenenweise Untertitel-/Datumsbearbeitung, GPS-Karte, Intro-Einbindung und KI-Konsole implementiert"
  },
  "3d19f71": {
    "ko": "유튜브 링크·영상 키로 배경음악 오디오 추출 지원",
    "en": "Real-time streaming for video analysis reasoning and fix AI reasoning console freezing",
    "ja": "動画解析推論プロセスのリアルタイムストリーミング適用および推論コンソールのフリーズを解消",
    "zh": "实时流式输出视频内容视觉理解推导过程，并彻底解决推理控制台视图假死",
    "es": "Transmisión en tiempo real del razonamiento del análisis de video y solución de bloqueos de consola",
    "fr": "Diffusion en direct du raisonnement d'analyse vidéo et résolution des blocages de la console",
    "de": "Echtzeit-Streaming des Analyse-Reasonings und Behebung von Hängern in der KI-Konsole"
  },
  "3cd856a": {
    "ko": "지능·속도·레이턴시 카드형 AI 모델 선택 모달 추가 및 가장 빠른 비전 모델 기본 선택",
    "en": "Add card-style AI model modal with intelligence, speed, and latency badges; default to fastest vision model",
    "ja": "知能・速度・レイテンシをカード化したAIモデル選択ダイアログを追加し最速モデルをデフォルト設定",
    "zh": "新增标注智能度、生成速度与延迟分级的卡片式 AI 模型弹窗，默认选用最迅速的视觉模型",
    "es": "Añadir modal de modelos con métricas de inteligencia y velocidad, preseleccionando el más rápido",
    "fr": "Ajouter la modale des modèles d'IA avec badges d'intelligence et vitesse, modèle rapide par défaut",
    "de": "Kartenbasiertes KI-Modell-Modal mit Intelligenz- und Geschwindigkeits-Badges hinzugefügt"
  },
  "8efc0a8": {
    "ko": "유튜브 오디오 추출 기능 및 Analyzer 작업자 코드 전면 롤백",
    "en": "Revert YouTube audio extraction feature and Analyzer worker code rollback",
    "ja": "YouTubeオーディオ抽出機能およびAnalyzerワーカーコードを全面ロールバック",
    "zh": "全面回滚 YouTube 音频在线提取功能及配套的 Analyzer 后台 Worker 逻辑",
    "es": "Revertir función de extracción de audio de YouTube y código del worker Analyzer",
    "fr": "Annuler l'extraction audio YouTube et restaurer le code du worker Analyzer",
    "de": "YouTube-Audioextraktion und Analyzer-Worker-Code vollständig zurückgesetzt"
  },
  "48d4afb": {
    "ko": "와이드 스튜디오 레이아웃 확장 및 영상 상단 문구·BGM 업로드·우측 극적순간/인아웃트로 재배치",
    "en": "Expand to wide studio layout; reposition top copy, BGM upload, and right-hand dramatic moments & intro/outro",
    "ja": "ワイドスタジオレイアウトへ拡張し上部テキスト・BGMアップロード・右側劇的瞬間/インアウトトロを再配置",
    "zh": "扩展至全视域宽屏工作台，重新编排顶部引导、配乐上传及右侧高光列表与片头片尾",
    "es": "Ampliar a diseño panorámico de estudio y reubicar textos, subida de BGM y momentos destacados",
    "fr": "Passer en affichage studio large et réorganiser les textes, l'import BGM et les moments forts",
    "de": "Breiteres Studio-Layout eingeführt und Texte, BGM-Upload sowie Highlights neu angeordnet"
  },
  "790f1be": {
    "ko": "풀와이드 레이아웃 적용, 문구 및 인아웃트로 스위치 정렬 수정, 상단바 영상목록 모달 통합",
    "en": "Apply full-width layout, fix text and intro/outro switch alignment, consolidate top-bar video list modal",
    "ja": "フルワイドレイアウト適用、文言とインアウトトロスイッチの整列修正、上部バー動画一覧モーダル統合",
    "zh": "应用沉浸式全宽布局，校准文字与片头片尾开关对齐，将顶部导航栏素材列表收纳为弹窗",
    "es": "Aplicar diseño a ancho completo, corregir interruptores y unificar modal de lista de videos",
    "fr": "Appliquer la pleine largeur, aligner les interrupteurs et intégrer la liste vidéo dans l'en-tête",
    "de": "Vollbreiten-Layout angewendet, Schalter ausgerichtet und Videolisten-Modal integriert"
  },
  "71188dd": {
    "ko": "하단 버튼 상단 헤더 이전 및 IDE 스타일 100vh 무스크롤 독립 패널 레이아웃 적용",
    "en": "Relocate bottom buttons to top header and apply IDE-style 100vh scroll-free independent panel layout",
    "ja": "下部ボタンを上部ヘッダーへ移設しIDE風100vhスクロールフリー独立パネルレイアウトを適用",
    "zh": "将底部浮动操作栏收归至顶部工具栏，应用类似专业 IDE 的 100vh 无外层滚动双独立面板",
    "es": "Reubicar botones inferiores en cabecera y aplicar diseño de paneles independientes 100vh estilo IDE",
    "fr": "Déplacer les boutons du bas vers l'en-tête et appliquer une disposition 100vh sans scroll style IDE",
    "de": "Untere Buttons in Header verlegt und IDE-Layout über 100vh mit unabhängigen Panels angewendet"
  },
  "244c0a3": {
    "ko": "Vercel 스타일 1px 직선 분할 패널 레이아웃 적용 (0px 갭, 둥근 모서리/여백 제거)",
    "en": "Apply Vercel-style 1px border split panel layout (0px gap, no rounded corners or padding)",
    "ja": "Vercel風の1px境界線分割パネルレイアウトを適用（0pxギャップ、角丸・余白の排除）",
    "zh": "应用类似 Vercel 的 1px 精细分界线面板切割设计（0px 缝隙，消除外围圆角与外边距）",
    "es": "Aplicar diseño de paneles divididos por línea de 1px estilo Vercel (espacio 0px, sin bordes redondeados)",
    "fr": "Disposition de panneaux divisés par une ligne de 1px style Vercel (espace 0px, sans arrondi)",
    "de": "Vercel-artiges 1px-Linien-Panellayout angewendet (0px Lücke, ohne abgerundete Ecken)"
  },
  "526cb44": {
    "ko": "Revert \"feat(video): Vercel 스타일 1px 직선 분할 패널 레이아웃 적용 (0px 갭, 둥근 모서리/여백 제거)\"",
    "en": "Revert 'Apply Vercel-style 1px border split panel layout'",
    "ja": "ロールバック: 「Vercel風の1px境界線分割パネルレイアウトを適用」を取り消し",
    "zh": "撤销提交: 还原“类似 Vercel 的 1px 精细分界线面板切割设计”",
    "es": "Revertir 'Aplicar diseño de paneles divididos por línea de 1px estilo Vercel'",
    "fr": "Annuler 'Disposition de panneaux divisés par une ligne de 1px style Vercel'",
    "de": "Rückgängig gemacht: 'Vercel-artiges 1px-Linien-Panellayout angewendet'"
  },
  "858a4bc": {
    "ko": "좌측 패널 폭 최적화, 패널 여백 통일 및 카드 타이틀·아이콘 상단 좌측 밀착 정렬",
    "en": "Optimize left panel width, normalize margins, and snap card titles/icons tightly to top-left",
    "ja": "左パネル幅を最適化しパネル余白を統一、カードタイトルとアイコンを左上に密着配置",
    "zh": "优化左侧操作面板宽度，统一各模块内边距并将卡片标题与图标严整靠左上排布",
    "es": "Optimizar ancho de panel izquierdo, normalizar márgenes y alinear títulos a la izquierda",
    "fr": "Optimiser la largeur du panneau gauche, harmoniser les marges et aligner les titres à gauche",
    "de": "Breite des linken Panels optimiert, Ränder vereinheitlicht und Titel bündig ausgerichtet"
  },
  "07b8c25": {
    "ko": "모델 지능·속도 하드코딩 및 임의 추정치 제거, 원천 데이터 수신값 100% 신뢰 구조로 전환",
    "en": "Remove hardcoded intelligence/speed estimations; transition to 100% authoritative raw upstream data",
    "ja": "モデル知能・速度のハードコードと恣意的推定値を排除し元データ100%信頼の設計へ移行",
    "zh": "剔除对模型智能度与速度的任意硬编码估算，全面转为 100% 忠实呈现上游权威元数据",
    "es": "Eliminar estimaciones arbitrarias de velocidad e inteligencia; pasar a datos 100% reales",
    "fr": "Supprimer les estimations arbitraires d'intelligence/vitesse; basculer sur les données réelles",
    "de": "Hardcodierte Modellschätzungen entfernt; auf 100% echte Rohdaten umgestellt"
  },
  "f4a6631": {
    "ko": "16:9 유튜브 규격 크롭, 영상 멈춤 버그 수정, 구간 삭제·재병합 및 실시간 추론 대시보드 구현",
    "en": "16:9 YouTube crop, fix video freeze bugs, section delete/re-stitch, and real-time inference dashboard",
    "ja": "16:9 YouTube規格クロップ、映像停止バグ修正、区間削除・再結合およびリアルタイム推論画面を実装",
    "zh": "16:9 YouTube 视频规整裁剪、修复播放卡死、片段删除/重新合并及实时推理大屏",
    "es": "Recorte 16:9 para YouTube, solución de congelamientos, eliminar/reunir y panel de inferencia en tiempo real",
    "fr": "Recadrage 16:9 YouTube, correction des gels, suppression/réassemblage et tableau de bord en direct",
    "de": "16:9 YouTube-Zuschnitt, Behebung von Video-Hängern, Segment-Löschen/Neubinden & Inferenz-Dashboard"
  },
  "48c37de": {
    "ko": "16:9 소스 스마트 크롭 정렬(우측 여백/좌측 쏠림 해결), 유튜브 아이콘 크기 고정, 추론 콘솔 고대비 개선 및 파이프라인 자동 연결",
    "en": "Smart crop alignment for 16:9 sources, fixed YouTube icon size, high-contrast console & auto pipeline link",
    "ja": "16:9素材のスマートクロップ配置、YouTubeアイコンサイズ固定、推論コンソールの高コントラスト化",
    "zh": "16:9 素材智能对齐居中裁剪（消除右黑边与左倾）、固定图标尺寸、增强终端对比度并自动接通管线",
    "es": "Alineación de recorte inteligente 16:9, tamaño de icono fijo, mayor contraste y conexión de flujo",
    "fr": "Alignement du recadrage intelligent 16:9, taille d'icône fixe, contraste accru et liaison automatique",
    "de": "Intelligente 16:9-Zuschnitt-Ausrichtung, feste Icon-Größe, höherer Kontrast & Pipeline-Anbindung"
  },
  "f5e98a1": {
    "ko": "AI 기반 극적 하이라이트 영상 생성기(reportist-video) 구축",
    "en": "Initial build of AI-powered dramatic highlight video generator (reportist-video)",
    "ja": "AIベースの劇的ハイライト動画ジェネレーター(reportist-video)の初期構築",
    "zh": "初版搭建基于 AI 的精彩高光集锦视频生成系统 (reportist-video)",
    "es": "Construcción inicial del generador de videos de momentos destacados con IA (reportist-video)",
    "fr": "Création initiale du générateur de vidéos de moments forts par IA (reportist-video)",
    "de": "Erstaufbau des KI-basierten Highlight-Video-Generators (reportist-video)"
  },
  "4fae9f8": {
    "ko": "Reportist 공식 브랜드 로고·파비콘 통합 적용 및 구글 검색엔진 최적화(SEO) 구축",
    "en": "Integrate Reportist official brand logo and favicon; configure Google Search Console SEO optimization",
    "ja": "Reportist公式ブランドロゴ・ファビコンの統合適用およびGoogle検索エンジン最適化(SEO)を構築",
    "zh": "全面接入 Reportist 官方品牌 Logo 与网页 Favicon，并配置 Google 搜索引擎 SEO 优化",
    "es": "Integrar logotipo y favicon oficial de Reportist y configurar optimización SEO para Google",
    "fr": "Intégrer le logo officiel de marque et le favicon Reportist; optimiser le référencement Google",
    "de": "Offizielles Reportist-Logo & Favicon integriert; Google-SEO-Optimierung eingerichtet"
  },
  "096843e": {
    "ko": "OpenRouter 비디오 잔액 오류 해결을 위한 다중 프레임 시각 분석 전환 및 게이트웨이 폴백 강화",
    "en": "Switch to multi-frame visual analysis and reinforce gateway fallback to resolve OpenRouter video balance error",
    "ja": "OpenRouter動画残高エラー回避のためのマルチフレーム視覚解析への移行とゲートウェイフォールバック強化",
    "zh": "转向多帧视觉深度解析并强化网关多重兜底降级，彻底解决 OpenRouter 视频余额报错限制",
    "es": "Pasar a análisis visual multimarco y reforzar respaldo para resolver errores de saldo en OpenRouter",
    "fr": "Passer à l'analyse visuelle multi-images et renforcer le repli pour contourner l'erreur OpenRouter",
    "de": "Auf Multiframe-Bildanalyse umgestellt und Gateway-Fallback verstärkt gegen OpenRouter-Guthabenfehler"
  }
};

/**
 * Returns localized patch releases for the specified locale.
 * If locale is 'ko', the original Korean data is returned directly.
 * Otherwise, titles, summaries, and commit messages are localized.
 */
export function getLocalizedPatchReleases(locale: Locale): PatchRelease[] {
  if (locale === 'ko') {
    return PATCH_RELEASES;
  }

  return PATCH_RELEASES.map((rel) => {
    const relI18n = RELEASE_TRANSLATIONS[rel.version];
    const title = relI18n?.title[locale] || relI18n?.title.en || rel.title;
    const summary = relI18n?.summary[locale] || relI18n?.summary.en || rel.summary;

    const localizedCommits: PatchCommit[] = rel.commits.map((commit) => {
      const commitI18n = COMMIT_TRANSLATIONS[commit.hash];
      const message = commitI18n?.[locale] || commitI18n?.en || commit.message;
      const scopePrefix = commit.scope ? `(${commit.scope}): ` : ': ';
      const rawSubject = `${commit.type}${scopePrefix}${message}`;

      return {
        ...commit,
        message,
        rawSubject,
      };
    });

    return {
      ...rel,
      title,
      summary,
      commits: localizedCommits,
    };
  });
}
