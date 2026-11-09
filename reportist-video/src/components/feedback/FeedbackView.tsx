// src/components/feedback/FeedbackView.tsx - User Feedback & Developer Roadmap View
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  X,
  Bug,
  Lightbulb,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  Clock,
  Heart,
  Image as ImageIcon,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type {
  FeedbackItem,
  FeedbackCategory,
  FeedbackStatus,
  FeedbackStatusFilter,
  FeedbackCategoryFilter,
  NewFeedbackInput,
} from '../../types/feedback.ts';
import {
  fetchFeedbacks,
  createFeedback,
  updateFeedbackStatusAndResponse,
  deleteFeedback,
  incrementFeedbackLike,
} from '../../services/feedbackService.ts';
import { CreateFeedbackModal } from './CreateFeedbackModal.tsx';
import { FeedbackDetailModal } from './FeedbackDetailModal.tsx';

interface FeedbackViewProps {
  onOpenStudio?: () => void;
}

export const FeedbackView: React.FC<FeedbackViewProps> = ({ onOpenStudio }) => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Developer Mode
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    return localStorage.getItem('reportist_feedback_admin_mode') === 'true';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  const loadFeedbacks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchFeedbacks(statusFilter, categoryFilter, searchQuery);
      setFeedbacks(res.items);
      setIsUsingFallback(res.isUsingFallback);
    } catch (err) {
      console.warn('Failed to load feedbacks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  // Handle admin mode toggle
  const handleToggleAdminMode = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      localStorage.setItem('reportist_feedback_admin_mode', 'false');
      showToast('개발자 관리 모드가 해제되었습니다.');
    } else {
      const code = window.prompt('개발자 모드 활성화를 위한 비밀번호를 입력해주세요: (기본값: admin)');
      if (code === 'admin' || code === 'seedtick') {
        setIsAdminMode(true);
        localStorage.setItem('reportist_feedback_admin_mode', 'true');
        showToast('개발자 관리 모드가 활성화되었습니다.');
      } else if (code !== null) {
        alert('비밀번호가 올바르지 않습니다.');
      }
    }
  };

  // Submit new feedback
  const handleCreateSubmit = async (data: NewFeedbackInput) => {
    const newItem = await createFeedback(data);
    setFeedbacks((prev) => [newItem, ...prev]);
    showToast('소중한 피드백이 등록되었습니다! 개발자가 확인 후 반영하겠습니다.');
  };

  // Like feedback
  const handleLike = async (id: string) => {
    const newLikes = await incrementFeedbackLike(id);
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === id ? { ...f, likeCount: newLikes } : f))
    );
    if (selectedFeedback && selectedFeedback.id === id) {
      setSelectedFeedback((prev) => (prev ? { ...prev, likeCount: newLikes } : prev));
    }
    showToast('의견에 공감했습니다 ❤️');
  };

  // Update status & response (admin)
  const handleUpdateStatusAndResponse = async (
    id: string,
    status: FeedbackStatus,
    adminResponse: string | null
  ) => {
    const updated = await updateFeedbackStatusAndResponse(id, status, adminResponse);
    if (updated) {
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setSelectedFeedback(updated);
      showToast('개발자 처리 내용 및 상태가 성공적으로 반영되었습니다.');
    }
  };

  // Delete feedback (admin)
  const handleDeleteFeedback = async (id: string) => {
    await deleteFeedback(id);
    setFeedbacks((prev) => prev.filter((f) => f.id !== id));
    showToast('피드백이 삭제되었습니다.');
  };

  // Status counts for tabs
  const stats = useMemo(() => {
    return {
      all: feedbacks.length,
      completed: feedbacks.filter((f) => f.status === 'completed').length,
      in_progress: feedbacks.filter((f) => f.status === 'in_progress').length,
      open: feedbacks.filter((f) => f.status === 'open').length,
    };
  }, [feedbacks]);

  const getCategoryBadge = (category: FeedbackCategory) => {
    switch (category) {
      case 'bug':
        return (
          <span className="toss-badge bg-red-50 text-red-600 border border-red-200">
            <Bug size={10} />
            <span>버그</span>
          </span>
        );
      case 'feature':
        return (
          <span className="toss-badge bg-amber-50 text-amber-700 border border-amber-200">
            <Lightbulb size={10} />
            <span>기능제안</span>
          </span>
        );
      case 'improvement':
        return (
          <span className="toss-badge bg-blue-50 text-blue-600 border border-blue-200">
            <Sparkles size={10} />
            <span>개선요청</span>
          </span>
        );
      default:
        return (
          <span className="toss-badge bg-purple-50 text-purple-600 border border-purple-200">
            <HelpCircle size={10} />
            <span>기타</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="toss-badge bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
            <CheckCircle2 size={11} className="text-emerald-600" />
            <span>해결 완료</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="toss-badge bg-blue-50 text-blue-700 border border-blue-200 font-bold">
            <Clock size={11} className="text-blue-600" />
            <span>진행중</span>
          </span>
        );
      case 'closed':
        return (
          <span className="toss-badge bg-slate-100 text-slate-500 border border-slate-200">
            <span>보류</span>
          </span>
        );
      case 'open':
      default:
        return (
          <span className="toss-badge bg-amber-50 text-amber-600 border border-amber-200">
            <span>대기중</span>
          </span>
        );
    }
  };

  return (
    <div className="toss-feedback-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toss-toast-float">
          <Sparkles size={15} color="#fbbf24" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="toss-feedback-inner">
        {/* 1. Toss Style Header Card */}
        <section className="toss-feedback-header-card">
          <div className="toss-feedback-header-top">
            <div className="toss-feedback-header-left">
              <div className="toss-community-badge-row">
                <span className="toss-community-badge">FEEDBACK & ROADMAP</span>
                {isAdminMode && (
                  <span className="toss-badge bg-purple-100 text-purple-800 border border-purple-200 font-bold flex items-center gap-1">
                    <ShieldCheck size={11} />
                    <span>개발자 관리자 모드 ON</span>
                  </span>
                )}
              </div>
              <h1 className="toss-community-title">피드백 & 개선 요청</h1>
              <p className="toss-community-desc">
                서비스를 이용하며 느낀 불편사항이나 필요한 기능을 남겨주세요.
                개발자가 직접 확인하고 처리 결과를 공유합니다.
              </p>
            </div>

            <div className="toss-community-header-actions">
              <button
                type="button"
                className={`toss-btn-secondary text-xs flex items-center gap-1.5 ${
                  isAdminMode ? 'border-purple-300 text-purple-700 bg-purple-50' : ''
                }`}
                onClick={handleToggleAdminMode}
                title="개발자 전용 처리 상태 변경 및 답변 작성 모드"
              >
                <ShieldCheck size={14} className={isAdminMode ? 'text-purple-600' : 'text-slate-500'} />
                <span>{isAdminMode ? '관리자 모드 해제' : '개발자 모드'}</span>
              </button>

              <button
                type="button"
                className="toss-btn-primary flex items-center gap-2"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus size={16} />
                <span>피드백 남기기</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2. Filters & Search Toolbar */}
        <section className="toss-feedback-toolbar">
          {/* Status Filter Tabs */}
          <div className="toss-status-tabs">
            <button
              type="button"
              className={`toss-status-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              전체
            </button>
            <button
              type="button"
              className={`toss-status-tab-btn ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              해결 완료 🎉
            </button>
            <button
              type="button"
              className={`toss-status-tab-btn ${statusFilter === 'in_progress' ? 'active' : ''}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              진행중 🛠️
            </button>
            <button
              type="button"
              className={`toss-status-tab-btn ${statusFilter === 'open' ? 'active' : ''}`}
              onClick={() => setStatusFilter('open')}
            >
              대기중 💬
            </button>
          </div>

          {/* Category & Search Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <select
              className="toss-select text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as FeedbackCategoryFilter)}
            >
              <option value="all">모든 분류</option>
              <option value="improvement">사용성 개선</option>
              <option value="feature">새로운 기능</option>
              <option value="bug">버그 제보</option>
              <option value="other">기타</option>
            </select>

            <div className="toss-search-box relative flex-1 sm:w-64">
              <Search size={14} className="toss-community-search-icon" />
              <input
                type="text"
                placeholder="제목, 내용 검색..."
                className="toss-search-input text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="toss-community-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 3. Feedback Cards Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span className="text-sm">피드백 목록을 불러오는 중입니다...</span>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="toss-feedback-empty-card">
            <MessageSquare size={36} className="text-slate-300 mb-2" />
            <h3 className="text-base font-bold text-slate-700">등록된 피드백이 없습니다</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
              불편했던 점이나 추가를 원하는 기능이 있다면 첫 번째 피드백을 남겨보세요!
            </p>
            <button
              type="button"
              className="toss-btn-primary text-xs mt-4 flex items-center gap-1.5"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus size={14} />
              <span>피드백 작성하기</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feedbacks.map((item) => (
              <div
                key={item.id}
                className="toss-feedback-card"
                onClick={() => setSelectedFeedback(item)}
              >
                {/* Card Top: Badges */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {getCategoryBadge(item.category)}
                    {getStatusBadge(item.status)}
                  </div>
                  {item.adminResponse && (
                    <span className="toss-badge bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1">
                      <ShieldCheck size={11} className="text-blue-600" />
                      <span>답변 완료</span>
                    </span>
                  )}
                </div>

                {/* Card Title */}
                <h3 className="toss-feedback-card-title">{item.title}</h3>

                {/* Card Content Snippet */}
                <p className="toss-feedback-card-snippet">{item.content}</p>

                {/* Admin Response Snippet Preview if present */}
                {item.adminResponse && (
                  <div className="toss-feedback-admin-snippet">
                    <span className="font-bold text-blue-700">개발자 답변: </span>
                    <span>{item.adminResponse}</span>
                  </div>
                )}

                {/* Card Bottom Meta */}
                <div className="toss-feedback-card-footer">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <span className="text-slate-600 font-medium">{item.authorName}</span>
                    {item.imageUrls && item.imageUrls.length > 0 && (
                      <span className="flex items-center gap-0.5 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                        <ImageIcon size={11} />
                        <span>{item.imageUrls.length}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 text-xs">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-rose-500 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(item.id);
                      }}
                    >
                      <Heart size={12} className={item.likeCount > 0 ? 'text-rose-500 fill-rose-500' : ''} />
                      <span>{item.likeCount || 0}</span>
                    </button>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateFeedbackModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      <FeedbackDetailModal
        feedback={selectedFeedback}
        isOpen={Boolean(selectedFeedback)}
        onClose={() => setSelectedFeedback(null)}
        onLike={handleLike}
        isAdminMode={isAdminMode}
        onUpdateStatusAndResponse={handleUpdateStatusAndResponse}
        onDeleteFeedback={handleDeleteFeedback}
      />
    </div>
  );
};
