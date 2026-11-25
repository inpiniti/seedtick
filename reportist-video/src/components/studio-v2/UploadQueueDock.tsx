import { useEffect, useState } from 'react';
import { Plus, Scissors, Sparkles, UploadCloud, X } from 'lucide-react';
import type { VideoItem, VideoTaskProgress } from '../../types/video.ts';
import type { VideoSortMode } from './types.ts';
import type { VideoShareItem } from '../../types/share.ts';
import { useI18n } from '../../i18n/index.tsx';
import { ShimmeringText } from '../common/ShimmeringText.tsx';
import { SharedVideosPanel } from '../community/SharedVideosPanel.tsx';
import { PageTransition } from './PageTransition.tsx';
import { VideoContextMenu, type VideoContextAction } from './VideoContextMenu.tsx';
import { formatShootDate } from './types.ts';
import { Tooltip } from '../ui/Tooltip.tsx';
import { StarBorder } from '../common/StarBorder.tsx';

// components/studio-v2/UploadQueueDock.tsx
// 분석 전/중 좌측 원본 리스트. 썸네일 + 촬영일만 최소 표시하고,
// 분석이 끝나면 카드가 빠지고 전체 도크가 부드럽게 사라진다.
// 분석 중에는 progress.videoTasks(영상별 독립 슬롯)를 읽어 카드마다
// 다른 단계/진행률을 보여준다.
// 상단 탭으로 원본 영상 목록과 공유 영상 패널(내 영상 등록 + 다른 사람 영상 감상)을 전환한다.

export type LeftDockTab = 'source' | 'share';

interface UploadQueueDockProps {
  videos: VideoItem[];
  isProcessing: boolean;
  isPreparingVideos?: boolean;
  collapsed: boolean;
  landedVideos?: Set<string>;
  videoTasks?: VideoTaskProgress[];
  /** 원본 삭제 연출 중인 영상 id. 카드의 삭제 버튼을 잠근다. */
  removingVideoIds?: Set<string>;
  /** 현재 좌측 독 탭. CenterStudioView가 자동 접힘 규칙과 함께 관리한다. */
  activeTab: LeftDockTab;
  onTabChange: (tab: LeftDockTab) => void;
  /** 공유 탭에서 고른 영상. 중앙 미리보기에서 바로 재생한다. */
  selectedSharedVideo: VideoShareItem | null;
  onSelectSharedVideo: (video: VideoShareItem | null) => void;
  onFilesSelected: (files: File[]) => void;
  onAddVideos: () => void;
  onRemoveVideo: (id: string) => void;
  /** 우클릭 메뉴의 위쪽/아래쪽 삭제용 일괄 삭제. */
  onRemoveVideos?: (ids: string[]) => void;
  onSortVideos?: (mode: VideoSortMode) => void;
  onStartAnalysis: () => void;
  onCancel: () => void;
  /** 온보딩 중에만 번들 샘플을 프로젝트에 넣는다. */
  onLoadSampleVideos?: () => Promise<unknown>;
  isLoadingSample?: boolean;
  /** 가이드 진행 중일 때만 샘플 버튼을 노출한다. */
  isOnboardingActive?: boolean;
}

type UiFn = (source: string, params?: Record<string, string | number>) => string;

function taskBadge(task: VideoTaskProgress | undefined, hasSegments: boolean, ui: UiFn) {
  if (!task) {
    if (hasSegments) return { label: ui('컷 완료'), done: true, active: false, pct: 100, queued: false };
    return { label: ui('대기 중'), done: false, active: false, pct: 0, queued: false };
  }
  const pct = Math.max(0, Math.min(100, Math.floor(task.progressPercent)));
  switch (task.stage) {
    case 'extracting':
      return {
        label: ui('프레임 추출 {pct}%', { pct }),
        done: false,
        active: true,
        pct,
        queued: false,
      };
    case 'queued': {
      const pos = Math.max(0, task.queuePosition ?? 0);
      return {
        label: ui('대기열 {pos}번', { pos }),
        done: false,
        active: true,
        pct,
        queued: true,
      };
    }
    case 'analyzing':
      return {
        label: ui('AI 분석 중 {pct}%', { pct }),
        done: false,
        active: true,
        pct,
        queued: false,
      };
    case 'done':
    case 'reused':
      return { label: ui('컷 완료'), done: true, active: false, pct: 100, queued: false };
    default:
      return { label: ui('대기 중'), done: false, active: false, pct: 0, queued: false };
  }
}

export const UploadQueueDock = ({
  videos,
  isProcessing,
  isPreparingVideos,
  collapsed,
  landedVideos,
  videoTasks,
  removingVideoIds,
  activeTab,
  onTabChange,
  selectedSharedVideo,
  onSelectSharedVideo,
  onFilesSelected,
  onAddVideos,
  onRemoveVideo,
  onRemoveVideos,
  onSortVideos,
  onStartAnalysis,
  onCancel,
  onLoadSampleVideos,
  isLoadingSample,
  isOnboardingActive,
}: UploadQueueDockProps) => {
  const { ui } = useI18n();

  // 우클릭 메뉴 상태. 인덱스는 메뉴를 연 시점의 목록 순서를 기준으로 한다.
  const [contextMenu, setContextMenu] = useState<{
    videoId: string;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  // 탭 전환·목록 비움 시 커서 위치가 무의미해진 메뉴는 닫는다.
  useEffect(() => {
    setContextMenu(null);
  }, [activeTab]);
  useEffect(() => {
    if (videos.length === 0) setContextMenu(null);
  }, [videos.length]);

  const handleContextAction = (action: VideoContextAction) => {
    if (!contextMenu) return;
    const { videoId, index } = contextMenu;
    switch (action) {
      case 'delete':
        onRemoveVideo(videoId);
        break;
      case 'deleteAbove': {
        const ids = videos.slice(0, index).map((v) => v.id);
        if (ids.length) {
          if (onRemoveVideos) onRemoveVideos(ids);
          else ids.forEach((id) => onRemoveVideo(id));
        }
        break;
      }
      case 'deleteBelow': {
        const ids = videos.slice(index + 1).map((v) => v.id);
        if (ids.length) {
          if (onRemoveVideos) onRemoveVideos(ids);
          else ids.forEach((id) => onRemoveVideo(id));
        }
        break;
      }
      case 'sortAsc':
        onSortVideos?.('asc');
        break;
      case 'sortDesc':
        onSortVideos?.('desc');
        break;
      case 'sortNone':
        onSortVideos?.('none');
        break;
    }
  };

  // 분석 중에 새 영상을 넣으면 분석 시작 시점의 스냅샷이 다시 덮어써서 방금 넣은 영상이 사라진다.
  // 자막 다듬기(분석)가 끝날 때까지 추가 경로를 전부 잠근다.
  const addDisabled = isProcessing || activeTab !== 'source';
  const addHint = isProcessing
    ? ui('분석이 끝나면 영상을 추가할 수 있어요')
    : ui('영상 추가');
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (addDisabled) return;
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('video/'));
    if (files.length) onFilesSelected(files);
  };

  const hasPending = videos.some((v) => (v.segments?.length ?? 0) === 0);
  const taskByVideoId = buildTaskMap(videoTasks);
  const doneCount = videoTasks
    ? videoTasks.filter((t) => t.stage === 'done' || t.stage === 'reused').length
    : videos.filter((v) => (v.segments?.length ?? 0) > 0).length;

  return (
    <div
      className="sv2-dock"
      data-collapsed={collapsed}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="sv2-dock-inner">
        <div className="sv2-dock-tabs" role="tablist" aria-label={ui('좌측 패널')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'source'}
            className="sv2-dock-tab"
            onClick={() => onTabChange('source')}
          >
            <span>{ui('원본 영상')}</span>
            <span className="sv2-dock-tab-count">
              {isProcessing && videoTasks ? `${doneCount}/${videos.length}` : videos.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'share'}
            className="sv2-dock-tab"
            onClick={() => onTabChange('share')}
          >
            <span>{ui('공유')}</span>
          </button>
        </div>

        {/* 탭이 바뀌면 Animate UI PageTransition으로 패널 내용을 전환한다. 탭 바 자체는 고정. */}
        <PageTransition effect="slide" pageKey={activeTab} className="sv2-dock-page">
          {activeTab === 'source' ? (
            <>
              <div className="sv2-dock-add-row">
                <Tooltip content={addHint}>
                  <button
                    type="button"
                    className="sv2-dock-add"
                    onClick={onAddVideos}
                    disabled={addDisabled}
                    aria-label={addHint}
                  >
                    <Plus size={15} />
                    <span>{ui('영상 추가')}</span>
                  </button>
                </Tooltip>
              </div>

              <div className="sv2-dock-list">
                {videos.length === 0 && (
                  <button
                    type="button"
                    className="sv2-dock-empty"
                    onClick={onAddVideos}
                    disabled={addDisabled}
                  >
                    <UploadCloud size={30} />
                    <span>
                      {ui('영상을 끌어다 놓거나')}
                      <br />
                      {ui('여기서 영상을 추가해 주세요')}
                    </span>
                  </button>
                )}

                {videos.map((video, index) => {
                  const segment = video.segments?.[0];
                  const segmentCount = video.segments?.length ?? 0;
                  const task = taskByVideoId.get(video.id);
                  const badge = taskBadge(task, segmentCount > 0, ui);
                  const done = segmentCount > 0 || badge.done;
                  const label =
                    done &&
                    segmentCount > 0 &&
                    (task?.stage === 'done' || task?.stage === 'reused' || !task)
                      ? ui('컷 {count}개 완료', { count: segmentCount })
                      : badge.label;
                  const shootDate = formatShootDate(segment) || video.metadataDate || '';
                  const isRemoving = removingVideoIds?.has(video.id) ?? false;
                  return (
                    <div
                      key={video.id}
                      className="sv2-upload-card"
                      data-cut-card-id={video.id}
                      data-active={badge.active}
                      data-done={done}
                      // 분석 중에만 착지한 카드를 접는다. 분석이 끝나면 삭제할 수 있도록 다시 노출한다.
                      data-landed={isProcessing && (landedVideos?.has(video.id) ?? false)}
                      data-removing={isRemoving}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (isProcessing || isRemoving) return;
                        setContextMenu({
                          videoId: video.id,
                          index,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                    >
                      {video.thumbnailUrl ? (
                        <img className="sv2-upload-thumb" src={video.thumbnailUrl} alt="" />
                      ) : (
                        <div className="sv2-upload-thumb" />
                      )}
                      <div className="sv2-upload-meta">
                        <Tooltip content={video.name}>
                          <div className="sv2-upload-name">
                            {badge.active ? (
                              <ShimmeringText
                                text={video.name}
                                duration={1.4}
                                className="sv2-shimmer-name"
                              />
                            ) : (
                              video.name
                            )}
                          </div>
                        </Tooltip>
                        <div className="sv2-upload-date">{shootDate}</div>
                      </div>
                      {!isProcessing && (
                        <div className="sv2-upload-side">
                          <button
                            type="button"
                            className="sv2-upload-card-remove"
                            onClick={() => onRemoveVideo(video.id)}
                            disabled={isRemoving}
                            aria-label={ui('영상 삭제')}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}
                      {/* 진행률은 카드 하단에 꽉 붙은 얇은 선으로만 표시한다. 상태 문구는 aria로만 제공. */}
                      {isProcessing && !done && (
                        <div
                          className="sv2-progress-bar sv2-card-progress"
                          data-queued={badge.queued}
                          role="progressbar"
                          aria-label={label}
                          aria-valuenow={badge.pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="sv2-progress-fill"
                            style={{ width: `${badge.pct}%` }}
                          />
                        </div>
                      )}
                      {/* 분석 중인 카드에만 React Bits Star Border를 얹어 어떤 영상이 진행 중인지 바로 알 수 있게 한다. */}
                      {isProcessing && badge.active && (
                        <StarBorder
                          as="div"
                          className="sv2-upload-star-border"
                          theme="dark"
                          color="#ffffff"
                          trailColor="#ffffff"
                          duration={4.5}
                          thickness={1.2}
                          radius={9}
                          trailLength={0.16}
                          stars={1}
                          glow={0.45}
                          sparkle={false}
                          hover="none"
                          clickPulse={false}
                          backgroundColor="transparent"
                          borderColor="transparent"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            padding: 0,
                            background: 'transparent',
                            borderRadius: 'inherit',
                            pointerEvents: 'none',
                            // 라이트/다크 테마 모두에서 별이 보이도록 흰 빛을 배경색의 반전으로 그린다.
                            mixBlendMode: 'difference',
                            zIndex: 4,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="sv2-dock-footer">
                {!isProcessing && isOnboardingActive && onLoadSampleVideos && (
                  <button
                    type="button"
                    className="sv2-sample-btn"
                    onClick={() => void onLoadSampleVideos()}
                    disabled={isLoadingSample}
                    data-tour="onboarding-sample"
                  >
                    <Sparkles size={14} />
                    {isLoadingSample ? ui('샘플을 준비하고 있어요') : ui('샘플 영상으로 시작하기')}
                  </button>
                )}
                {isProcessing ? (
                  <button type="button" className="sv2-btn" onClick={onCancel}>
                    {ui('분석 중지')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sv2-btn sv2-btn-primary"
                    onClick={onStartAnalysis}
                    disabled={videos.length === 0 || !hasPending || isPreparingVideos}
                    data-tour="onboarding-analyze"
                    data-tour-ready={videos.length > 0 && !isPreparingVideos ? 'true' : 'false'}
                  >
                    <Scissors size={16} /> {ui('AI 컷 분석')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <SharedVideosPanel
              selectedVideoId={selectedSharedVideo?.id}
              onSelectVideo={onSelectSharedVideo}
            />
          )}
        </PageTransition>
      </div>

      {contextMenu && (
        <VideoContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasAbove={contextMenu.index > 0}
          hasBelow={contextMenu.index < videos.length - 1}
          onClose={() => setContextMenu(null)}
          onSelect={handleContextAction}
        />
      )}
    </div>
  );
};

function buildTaskMap(tasks?: VideoTaskProgress[]): Map<string, VideoTaskProgress> {
  const map = new Map<string, VideoTaskProgress>();
  if (!tasks) return map;
  for (const task of tasks) map.set(task.videoId, task);
  return map;
}
