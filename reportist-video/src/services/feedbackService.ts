// src/services/feedbackService.ts - Feedback & Issue Tracker Data Service (Supabase with LocalStorage Fallback)

import { supabase } from './supabaseClient.ts';
import type {
  FeedbackItem,
  NewFeedbackInput,
  FeedbackStatus,
  FeedbackStatusFilter,
  FeedbackCategoryFilter,
} from '../types/feedback.ts';

const LOCAL_STORAGE_KEY = 'reportist_feedbacks_v1';
const ATTACHMENT_BUCKET = 'feedback-attachments';

// 초기 샘플 피드백 데이터 (사용자 개선요청 및 개발자 처리 내용 예시 포함)
const SEED_FEEDBACKS: FeedbackItem[] = [
  {
    id: 'feedback-seed-1',
    category: 'feature',
    status: 'completed',
    title: '1080p FHD 및 고해상도 내보내기 옵션 지원 요청',
    content: '현재 기본 화질도 좋지만 유튜브 업로드용으로 1080p(FHD) 선택 옵션이 있었으면 좋겠습니다!',
    authorName: '유튜브 크리에이터',
    imageUrls: [],
    deviceInfo: 'Chrome / Windows 11',
    likeCount: 24,
    adminResponse: '요청해주신 1080p(1920x1080 FHD) 및 720p 해상도 선택 내보내기 엔진을 최신 업데이트에 탑재 완료했습니다! 이제 내보내기 모달에서 원하는 해상도를 직접 선택하실 수 있습니다.',
    adminRespondedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: 'feedback-seed-2',
    category: 'bug',
    status: 'completed',
    title: '긴 영상 병합 시 간헐적으로 프레임이 끊기거나 멈추는 현상',
    content: '1분 이상의 고화질 클립 여러 개를 병합할 때 브라우저 탭이 무거워지면서 프레임 스래싱이 생겼습니다.',
    authorName: '스튜디오 유저',
    imageUrls: [],
    deviceInfo: 'Edge / macOS Sonoma',
    likeCount: 15,
    adminResponse: '원인 파악 결과 GOP 시크 오프스크린 스로틀링 문제였으며, WebCodecs 연속 하드웨어 디코딩 엔진 도입과 중간 렌더링 플러시 로직을 개선하여 끊김 없는 고속 렌더링으로 해결되었습니다.',
    adminRespondedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
  {
    id: 'feedback-seed-3',
    category: 'improvement',
    status: 'in_progress',
    title: '타임라인에서 자막 폰트 크기 및 색상 커스텀 지원 제안',
    content: '자동 생성되는 자막도 아주 훌륭한데, 영상 분위기에 맞춰 글꼴 크기나 배경 박스 색상을 미세 조정할 수 있으면 더 완성도 높은 영상을 만들 수 있을 것 같아요.',
    authorName: '민우',
    imageUrls: [],
    deviceInfo: 'Chrome / macOS',
    likeCount: 31,
    adminResponse: '좋은 의견 감사드립니다! 현재 자막 스타일 커스텀 팔레트 및 프리셋 기능을 설계 중이며, 다음 마이너 업데이트에 반영될 예정입니다.',
    adminRespondedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'feedback-seed-4',
    category: 'feature',
    status: 'open',
    title: '클립 전환 효과(트랜지션) 다양화',
    content: '클립과 클립이 넘어갈 때 디졸브(페이드) 외에도 슬라이드나 줌 전환 효과도 선택할 수 있으면 좋겠습니다.',
    authorName: '비디오메이커',
    imageUrls: [],
    deviceInfo: 'Chrome / Windows',
    likeCount: 18,
    adminResponse: null,
    adminRespondedAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
];

function getLocalFeedbacks(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('[FeedbackService] LocalStorage read failed:', err);
  }
  return SEED_FEEDBACKS;
}

function saveLocalFeedbacks(items: FeedbackItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('[FeedbackService] LocalStorage write failed:', err);
  }
}

/**
 * 피드백 목록을 조회합니다.
 */
export async function fetchFeedbacks(
  statusFilter: FeedbackStatusFilter = 'all',
  categoryFilter: FeedbackCategoryFilter = 'all',
  searchQuery = ''
): Promise<{ items: FeedbackItem[]; isUsingFallback: boolean }> {
  // 1. Supabase 시도
  if (supabase) {
    try {
      let query = supabase.from('feedback_posts').select('*').order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,author_name.ilike.%${q}%`);
      }

      const { data, error } = await query;

      if (!error && data) {
        const items: FeedbackItem[] = data.map((row) => ({
          id: row.id,
          category: row.category,
          status: row.status,
          title: row.title,
          content: row.content,
          authorName: row.author_name,
          imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
          deviceInfo: row.device_info,
          likeCount: row.like_count ?? 0,
          adminResponse: row.admin_response,
          adminRespondedAt: row.admin_responded_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        return { items, isUsingFallback: false };
      }
    } catch (err) {
      console.warn('[FeedbackService] Supabase query failed, falling back to LocalStorage:', err);
    }
  }

  // 2. LocalStorage Fallback
  let items = getLocalFeedbacks();

  if (statusFilter !== 'all') {
    items = items.filter((f) => f.status === statusFilter);
  }

  if (categoryFilter !== 'all') {
    items = items.filter((f) => f.category === categoryFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    items = items.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q) ||
        f.authorName.toLowerCase().includes(q)
    );
  }

  return { items, isUsingFallback: true };
}

/**
 * 신규 피드백을 등록합니다.
 */
export async function createFeedback(input: NewFeedbackInput): Promise<FeedbackItem> {
  const newItem: FeedbackItem = {
    id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    category: input.category,
    status: 'open',
    title: input.title.trim(),
    content: input.content.trim(),
    authorName: input.authorName.trim() || '익명 사용자',
    imageUrls: input.imageUrls || [],
    deviceInfo: input.deviceInfo || navigator.userAgent,
    likeCount: 0,
    adminResponse: null,
    adminRespondedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Supabase Insert
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('feedback_posts')
        .insert({
          category: newItem.category,
          status: newItem.status,
          title: newItem.title,
          content: newItem.content,
          author_name: newItem.authorName,
          image_urls: newItem.imageUrls,
          device_info: newItem.deviceInfo,
          likeCount: 0,
        })
        .select()
        .single();

      if (!error && data) {
        newItem.id = data.id;
        newItem.createdAt = data.created_at;
        newItem.updatedAt = data.updated_at;
      }
    } catch (err) {
      console.warn('[FeedbackService] Supabase insert failed, storing locally:', err);
    }
  }

  // 2. LocalStorage에도 동기화
  const current = getLocalFeedbacks();
  saveLocalFeedbacks([newItem, ...current]);

  return newItem;
}

/**
 * 개발자(관리자): 처리 상태 및 답변 업데이트
 */
export async function updateFeedbackStatusAndResponse(
  id: string,
  status: FeedbackStatus,
  adminResponse: string | null
): Promise<FeedbackItem | null> {
  const now = new Date().toISOString();

  // 1. Supabase Update
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('feedback_posts')
        .update({
          status,
          admin_response: adminResponse?.trim() || null,
          admin_responded_at: adminResponse?.trim() ? now : null,
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        // 로컬스토리지도 업데이트
        const localItems = getLocalFeedbacks().map((item) =>
          item.id === id
            ? {
                ...item,
                status: data.status,
                adminResponse: data.admin_response,
                adminRespondedAt: data.admin_responded_at,
                updatedAt: data.updated_at,
              }
            : item
        );
        saveLocalFeedbacks(localItems);

        return {
          id: data.id,
          category: data.category,
          status: data.status,
          title: data.title,
          content: data.content,
          authorName: data.author_name,
          imageUrls: Array.isArray(data.image_urls) ? data.image_urls : [],
          deviceInfo: data.device_info,
          likeCount: data.like_count ?? 0,
          adminResponse: data.admin_response,
          adminRespondedAt: data.admin_responded_at,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch (err) {
      console.warn('[FeedbackService] Supabase update failed, updating locally:', err);
    }
  }

  // 2. LocalStorage Update
  const local = getLocalFeedbacks();
  let updatedItem: FeedbackItem | null = null;
  const nextList = local.map((item) => {
    if (item.id === id) {
      updatedItem = {
        ...item,
        status,
        adminResponse: adminResponse?.trim() || null,
        adminRespondedAt: adminResponse?.trim() ? now : null,
        updatedAt: now,
      };
      return updatedItem;
    }
    return item;
  });

  saveLocalFeedbacks(nextList);
  return updatedItem;
}

/**
 * 개발자(관리자): 피드백 삭제
 */
export async function deleteFeedback(id: string): Promise<boolean> {
  if (supabase) {
    try {
      await supabase.from('feedback_posts').delete().eq('id', id);
    } catch (err) {
      console.warn('[FeedbackService] Supabase delete error:', err);
    }
  }

  const local = getLocalFeedbacks().filter((item) => item.id !== id);
  saveLocalFeedbacks(local);
  return true;
}

/**
 * 피드백 공감/좋아요 증가
 */
export async function incrementFeedbackLike(id: string): Promise<number> {
  if (supabase) {
    try {
      await supabase.rpc('increment_feedback_like', { target_feedback_id: id });
    } catch {
      // ignore
    }
  }

  const items = getLocalFeedbacks();
  let newLikes = 1;
  const updated = items.map((f) => {
    if (f.id === id) {
      newLikes = (f.likeCount || 0) + 1;
      return { ...f, likeCount: newLikes };
    }
    return f;
  });
  saveLocalFeedbacks(updated);
  return newLikes;
}

/**
 * 첨부 이미지 업로드 (Supabase Storage 버킷 지원, 실패 시 base64 DataURL 반환)
 */
export async function uploadFeedbackAttachment(file: File): Promise<string> {
  if (supabase) {
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = `uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from(ATTACHMENT_BUCKET)
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (err) {
      console.warn('[FeedbackService] Supabase storage upload failed, converting to DataURL:', err);
    }
  }

  // Fallback: DataURL 인코딩
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
