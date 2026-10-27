// App.tsx - Reportist Chat 메인 애플리케이션

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Brain,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  FileAudio,
  FileVideo,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import './App.css';
import { MarkdownRenderer } from './components/MarkdownRenderer.tsx';
import { ModelSelectorModal } from './components/ModelSelectorModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import {
  FALLBACK_FREE_MODELS,
  checkGatewayHealth,
  fetchFreeModels,
  loadGatewayConfig,
  saveGatewayConfig,
  streamChatCompletions,
} from './services/api.ts';
import {
  type ChatAttachment,
  type ChatMessage,
  type ChatSession,
  type FreeModelMeta,
  type GatewayConfig,
  getModelInputModalities,
  getModelSupportedEfforts,
  REASONING_EFFORT_OPTIONS,
  type ReasoningEffortOption,
} from './types/chat.ts';

const STORAGE_KEY_SESSIONS = 'reportist_chat_sessions';
const STORAGE_KEY_ACTIVE_SESSION_ID = 'reportist_chat_active_session_id';

const WELCOME_PROMPTS = [
  {
    title: '코딩 문제 및 알고리즘 구현',
    prompt: 'TypeScript로 LRU 캐시(Least Recently Used Cache) 자료구조를 작성하고 원리를 설명해줘.',
  },
  {
    title: '글로벌 금융 시장 & 경제 분석',
    prompt: '최근 미국 빅테크 기업들의 AI 반도체 투자 동향과 금융 시장에 미치는 영향을 분석해줘.',
  },
  {
    title: '복잡한 논리 추론 문제 풀이',
    prompt: '3개의 문이 있는 몬티홀 문제의 수학적 확률과 직관적 오류에 대해 단계별로 자세히 설명해줘.',
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function App() {
  // 게이트웨이 설정
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig>(loadGatewayConfig);
  const [isGatewayOnline, setIsGatewayOnline] = useState<boolean>(true);

  // 모달 상태
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 모델 목록
  const [models, setModels] = useState<FreeModelMeta[]>(FALLBACK_FREE_MODELS);
  const [selectedModelId, setSelectedModelId] = useState<string>('recursive/flint-v1.0:free');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortOption>('low');

  // 대화 세션
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (raw) return JSON.parse(raw);
    } catch {}
    const defaultSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: '새로운 대화',
      messages: [],
      modelId: 'recursive/flint-v1.0:free',
      reasoningEffort: 'low',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return [defaultSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION_ID) || sessions[0]?.id || '';
  });

  // 입력창 및 스트리밍 상태
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Set<string>>(new Set());

  // 멀티모달 첨부파일 상태
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ type: 'image' | 'video'; url: string; name: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 현재 활성 세션
  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // 현재 선택된 모델 정보 및 지원 모달리티
  const currentModel =
    models.find((m) => m.id === selectedModelId) ||
    models[0] ||
    FALLBACK_FREE_MODELS[0];

  const currentInputModalities = useMemo(() => getModelInputModalities(currentModel), [currentModel]);
  const canAttachImage = currentInputModalities.includes('image');
  const canAttachAudio = currentInputModalities.includes('audio');
  const canAttachVideo = currentInputModalities.includes('video');
  const canAttachAny = canAttachImage || canAttachAudio || canAttachVideo;

  // 현재 선택된 모델에서 지원되는 추론 노력도(Reasoning Effort) 목록 계산
  const supportedEffortKeys = useMemo(
    () => getModelSupportedEfforts(currentModel),
    [currentModel]
  );

  // 모델이 변경되었을 때 지원하지 않는 추론 강도(예: extra/max 미지원 모델)가 선택되어 있다면 안전한 기본값으로 자동 교정
  useEffect(() => {
    if (!supportedEffortKeys.includes(reasoningEffort)) {
      const fallback =
        (currentModel.defaultEffort?.toLowerCase() as ReasoningEffortOption) ||
        (supportedEffortKeys.includes('low') ? 'low' : supportedEffortKeys[0]) ||
        'none';
      setReasoningEffort(supportedEffortKeys.includes(fallback) ? fallback : 'none');
    }
  }, [currentModel, supportedEffortKeys, reasoningEffort]);

  const fileAcceptTypes = useMemo(() => {
    const list: string[] = [];
    if (canAttachImage) list.push('image/*');
    if (canAttachAudio) list.push('audio/*');
    if (canAttachVideo) list.push('video/*');
    return list.join(',');
  }, [canAttachImage, canAttachAudio, canAttachVideo]);

  // 게이트웨이 모델 목록 및 상태 로드
  useEffect(() => {
    const initGateway = async () => {
      const online = await checkGatewayHealth(gatewayConfig);
      setIsGatewayOnline(online);

      const fetchedModels = await fetchFreeModels(gatewayConfig);
      if (fetchedModels.length > 0) {
        setModels(fetchedModels);
        if (!fetchedModels.some((m) => m.id === selectedModelId)) {
          setSelectedModelId(fetchedModels[0].id);
        }
      }
    };

    initGateway();
  }, [gatewayConfig]);

  // 세션 목록 로컬스토리지 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
      localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION_ID, activeSessionId);
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }
  }, [sessions, activeSessionId]);

  // 스크롤 맨 아래로 이동
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isStreaming]);

  // 새 대화 시작
  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: '새로운 대화',
      messages: [],
      modelId: selectedModelId,
      reasoningEffort,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInputText('');
    setPendingAttachments([]);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  // 대화 세션 삭제
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== sessionId);
    if (remaining.length === 0) {
      handleNewChat();
      return;
    }
    setSessions(remaining);
    if (activeSessionId === sessionId) {
      setActiveSessionId(remaining[0].id);
    }
  };

  // 추론 과정 아코디언 토글
  const toggleReasoning = (messageId: string) => {
    setExpandedReasoningIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  // 첨부파일 처리 헬퍼 함수
  const addFilesToAttachments = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    for (const file of fileArray) {
      // 25MB 용량 제한
      if (file.size > 25 * 1024 * 1024) {
        alert(`파일(${file.name}) 용량이 너무 큽니다. 25MB 이하의 파일만 첨부할 수 있어요.`);
        continue;
      }

      let type: 'image' | 'audio' | 'video' | null = null;
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.startsWith('video/')) type = 'video';

      if (!type) {
        alert(`지원하지 않는 파일 형식입니다 (${file.name}). 사진, 오디오, 비디오 파일만 첨부해 주세요.`);
        continue;
      }

      // 모델 지원 여부 검증
      if (type === 'image' && !canAttachImage) {
        alert(`현재 선택된 모델(${currentModel.name})은 이미지 입력을 지원하지 않아요. 상단 모델 선택에서 '🖼️ 이미지' 지원 모델을 선택해 주세요.`);
        continue;
      }
      if (type === 'audio' && !canAttachAudio) {
        alert(`현재 선택된 모델(${currentModel.name})은 오디오 입력을 지원하지 않아요. 상단 모델 선택에서 '🎙️ 오디오' 지원 모델을 선택해 주세요.`);
        continue;
      }
      if (type === 'video' && !canAttachVideo) {
        alert(`현재 선택된 모델(${currentModel.name})은 비디오 입력을 지원하지 않아요. 상단 모델 선택에서 '🎬 비디오' 지원 모델을 선택해 주세요.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const newAtt: ChatAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            type,
            mimeType: file.type,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            dataUrl: reader.result,
          };
          setPendingAttachments((prev) => [...prev, newAtt]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFilesToAttachments(e.target.files);
    }
    // 동일 파일 재선택 가능하게 초기화
    e.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // 클립보드 붙여넣기(Ctrl+V) 지원
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToUpload: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          filesToUpload.push(file);
        }
      }
    }

    if (filesToUpload.length > 0) {
      if (!canAttachAny) {
        alert(`현재 선택된 모델(${currentModel.name})은 텍스트 전용 모델입니다. 사진이나 미디어를 입력하려면 상단에서 멀티모달 지원 모델을 선택해 주세요.`);
        return;
      }
      e.preventDefault();
      addFilesToAttachments(filesToUpload);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canAttachAny) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canAttachAny) {
      alert(`현재 선택된 모델(${currentModel.name})은 텍스트 전용 모델입니다. 미디어를 첨부하려면 상단에서 지원 모델을 선택해 주세요.`);
      return;
    }
    if (e.dataTransfer.files) {
      addFilesToAttachments(e.dataTransfer.files);
    }
  };

  // 메시지 전송
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend !== undefined ? textToSend : inputText).trim();
    const hasAttachments = pendingAttachments.length > 0;

    // 텍스트도 없고 첨부파일도 없으면 전송 불가
    if ((!messageContent && !hasAttachments) || isStreaming) return;

    const currentAttachments = [...pendingAttachments];
    setPendingAttachments([]);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: messageContent,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      timestamp: Date.now(),
    };

    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      reasoning: '',
      isStreaming: true,
      timestamp: Date.now(),
    };

    // 대화 제목 자동 생성 (첫 메시지일 경우)
    const shouldUpdateTitle = (currentSession.messages.length === 0);
    const titleSnippet = messageContent || (currentAttachments[0]?.name ?? '첨부파일 대화');
    const newTitle = shouldUpdateTitle
      ? titleSnippet.slice(0, 24) + (titleSnippet.length > 24 ? '...' : '')
      : currentSession.title;

    const updatedMessages = [...currentSession.messages, userMessage, assistantMessage];

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSession.id) {
          return {
            ...s,
            title: newTitle,
            messages: updatedMessages,
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );

    // 기본적으로 생성 중인 메시지의 추론 과정은 펼쳐둠
    setExpandedReasoningIds((prev) => new Set(prev).add(assistantMessageId));
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 게이트웨이에 보낼 메시지 히스토리 구성 (첨부파일 포함)
    const apiMessages = [...currentSession.messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments,
    }));

    let accumulatedContent = '';
    let accumulatedReasoning = '';

    await streamChatCompletions({
      messages: apiMessages,
      model: selectedModelId,
      reasoningEffort,
      config: gatewayConfig,
      signal: controller.signal,
      onDelta: (contentChunk, reasoningChunk) => {
        accumulatedContent += contentChunk;
        accumulatedReasoning += reasoningChunk;

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSession.id) {
              const msgs = s.messages.map((m) => {
                if (m.id === assistantMessageId) {
                  return {
                    ...m,
                    content: accumulatedContent,
                    reasoning: accumulatedReasoning,
                  };
                }
                return m;
              });
              return { ...s, messages: msgs };
            }
            return s;
          })
        );
      },
      onError: (errorMsg) => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSession.id) {
              const msgs = s.messages.map((m) => {
                if (m.id === assistantMessageId) {
                  return {
                    ...m,
                    content: '',
                    isStreaming: false,
                    isError: true,
                    errorMsg,
                  };
                }
                return m;
              });
              return { ...s, messages: msgs };
            }
            return s;
          })
        );
      },
      onFinish: () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSession.id) {
              const msgs = s.messages.map((m) => {
                if (m.id === assistantMessageId) {
                  return {
                    ...m,
                    isStreaming: false,
                  };
                }
                return m;
              });
              return { ...s, messages: msgs };
            }
            return s;
          })
        );
      },
    });
  };

  // 에러 발생 메시지 다시 시도
  const handleRetryMessage = (failedMessageId: string) => {
    if (isStreaming) return;
    const session = currentSession;
    const msgIndex = session.messages.findIndex((m) => m.id === failedMessageId);
    if (msgIndex === -1) return;

    // 직전 사용자 메시지 찾기
    let targetUserMsg: ChatMessage | null = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (session.messages[i].role === 'user') {
        targetUserMsg = session.messages[i];
        break;
      }
    }

    if (!targetUserMsg) return;

    // 실패한 어시스턴트 메시지와 그 뒤의 메시지들을 제거하고 재전송
    const trimmedMessages = session.messages.slice(0, msgIndex);
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === session.id) {
          return {
            ...s,
            messages: trimmedMessages,
          };
        }
        return s;
      })
    );

    // 다시 전송
    const textToResend = targetUserMsg.content;
    const attachmentsToResend = targetUserMsg.attachments;
    if (attachmentsToResend && attachmentsToResend.length > 0) {
      setPendingAttachments(attachmentsToResend);
    }
    setTimeout(() => {
      handleSendMessage(textToResend);
    }, 50);
  };

  // 안정적인 무료 모델로 빠른 전환
  const handleSwitchToStableModel = () => {
    const stableCandidates = [
      'nvidia/nemotron-3.5-super-vl:free',
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'nvidia/nemotron-3.5-lightning:free',
    ];
    const nextModel = models.find(
      (m) => stableCandidates.includes(m.id) && m.id !== selectedModelId
    );
    if (nextModel) {
      setSelectedModelId(nextModel.id);
      alert(`안정적인 '${nextModel.name}' 모델로 변경되었습니다. [다시 시도]를 누르시면 새 모델로 답변을 받아보실 수 있어요.`);
    } else if (models.length > 1) {
      const other = models.find((m) => m.id !== selectedModelId);
      if (other) {
        setSelectedModelId(other.id);
        alert(`'${other.name}' 모델로 변경되었습니다.`);
      }
    }
  };

  // 응답 생성 중단
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  // 텍스트 영역 키보드 입력 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 텍스트 영역 높이 자동 조절
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  return (
    <div className="app-container">
      {/* ─────────────────────────────────────────────
          1. 사이드바 (대화 세션 목록)
      ───────────────────────────────────────────── */}
      <aside className={`sidebar ${isSidebarOpen ? '' : 'hidden'}`}>
        <div className="sidebar-header">
          <div className="brand-row">
            <div className="brand-logo-icon">
              <Sparkles size={18} />
            </div>
            <span className="brand-title">Reportist Chat</span>
          </div>
        </div>

        <button type="button" className="new-chat-btn" onClick={handleNewChat}>
          <Plus size={16} />
          <span>새 대화 시작하기</span>
        </button>

        <div className="session-list-scroll">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => {
                setActiveSessionId(session.id);
                if (window.innerWidth <= 768) setIsSidebarOpen(false);
              }}
            >
              <MessageSquare size={16} />
              <span className="session-item-title">{session.title}</span>
              <button
                type="button"
                className="session-del-btn"
                title="대화 삭제"
                onClick={(e) => handleDeleteSession(session.id, e)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="footer-btn"
            onClick={() => setIsSettingsModalOpen(true)}
          >
            <Settings size={16} />
            <span>게이트웨이 설정</span>
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────
          2. 메인 채팅 뷰
      ───────────────────────────────────────────── */}
      <main className="main-chat-container">
        {/* 상단 컨트롤 바 */}
        <header className="chat-top-bar">
          <div className="top-left-controls">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              title="사이드바 토글"
            >
              <Menu size={20} />
            </button>

            {/* 모델 선택 트리거 버튼 */}
            <button
              type="button"
              className="model-picker-trigger"
              onClick={() => setIsModelModalOpen(true)}
            >
              <span className="trigger-badge">FREE</span>
              <span className="trigger-name">{currentModel.name}</span>

              {/* 지능 점수 뱃지 (OpenRouter Artificial Analysis) */}
              {currentModel.intelligenceIndex != null && (
                <span
                  className="trigger-intel-tag"
                  title={`Artificial Analysis 지능 지수: ${currentModel.intelligenceIndex}점`}
                >
                  🧠 {currentModel.intelligenceIndex}
                </span>
              )}

              <div className="trigger-modality-tags">
                {canAttachImage && <span className="trigger-mod-tag" title="이미지 지원">🖼️</span>}
                {canAttachAudio && <span className="trigger-mod-tag" title="오디오 지원">🎙️</span>}
                {canAttachVideo && <span className="trigger-mod-tag" title="비디오 지원">🎬</span>}
              </div>
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="top-right-actions">
            {/* 노력 선택 세그먼트: 현재 모델이 지원하는 단계만 동적 표시 */}
            <div className="effort-selector-wrapper" title="추론 노력(Reasoning Effort) 설정">
              <Brain size={14} color="#3182f6" style={{ marginLeft: 6 }} />
              <span className="effort-title-label">노력:</span>
              {supportedEffortKeys.length <= 1 ? (
                <span
                  className="effort-auto-chip"
                  title="이 모델은 모델 기본 추론 강도로 자동 동작해요"
                >
                  기본(자동)
                </span>
              ) : (
                REASONING_EFFORT_OPTIONS.filter((opt) => supportedEffortKeys.includes(opt.key)).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`effort-chip ${reasoningEffort === opt.key ? 'active' : ''}`}
                    onClick={() => setReasoningEffort(opt.key)}
                    title={`${opt.label} (${opt.englishLabel}): ${opt.description}`}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>

            {/* 게이트웨이 온라인 상태 뱃지 */}
            <div className="gateway-status-pill" title="AI Gateway 상태">
              <span className={`status-dot ${isGatewayOnline ? 'online' : 'offline'}`} />
              <span>{isGatewayOnline ? '온라인' : '오프라인'}</span>
            </div>

            {/* 설정 버튼 */}
            <button
              type="button"
              className="icon-action-btn"
              onClick={() => setIsSettingsModalOpen(true)}
              title="설정"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* 메시지 뷰포트 (드래그 앤 드롭 지원) */}
        <div
          className={`messages-viewport ${isDragging ? 'dragging-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="drag-drop-overlay">
              <div className="drag-drop-card">
                <Paperclip size={40} color="#3182f6" />
                <p className="drag-drop-title">여기에 파일을 놓아 첨부하세요</p>
                <p className="drag-drop-desc">
                  {[
                    canAttachImage ? '사진(Image)' : '',
                    canAttachAudio ? '오디오(Audio)' : '',
                    canAttachVideo ? '비디오(Video)' : '',
                  ].filter(Boolean).join(' · ')}
                  {' '}파일을 첨부할 수 있어요
                </p>
              </div>
            </div>
          )}

          {currentSession.messages.length === 0 ? (
            /* 웰컴 스크린 */
            <div className="welcome-screen">
              <div className="welcome-logo-badge">
                <Sparkles size={32} />
              </div>
              <h1 className="welcome-title">어떤 이야기를 나눠볼까요?</h1>
              <p className="welcome-subtitle">
                {currentModel.name} 모델과 {reasoningEffort} 추론 노력으로 준비되었어요.
                {canAttachAny && (
                  <span className="welcome-modality-tip">
                    <br />
                    이 모델은 {[
                      canAttachImage ? '사진' : '',
                      canAttachAudio ? '오디오' : '',
                      canAttachVideo ? '비디오' : '',
                    ].filter(Boolean).join(', ')} 입력을 지원해요. 클립(📎) 버튼이나 드래그 앤 드롭으로 첨부해 보세요.
                  </span>
                )}
                <br />
                궁금한 질문을 입력하거나 아래 추천 질문을 눌러보세요.
              </p>

              <div className="welcome-prompt-chips">
                {WELCOME_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="prompt-suggestion-card"
                    onClick={() => handleSendMessage(p.prompt)}
                  >
                    <Zap size={18} className="suggestion-icon" />
                    <span>{p.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* 메시지 목록 */
            currentSession.messages.map((message) => {
              if (message.role === 'user') {
                return (
                  <div key={message.id} className="message-row user">
                    <div className="user-bubble">
                      {/* 첨부파일 렌더링 */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="user-attachments-grid">
                          {message.attachments.map((att) => {
                            if (att.type === 'image') {
                              return (
                                <div
                                  key={att.id}
                                  className="user-media-thumbnail clickable"
                                  onClick={() =>
                                    setPreviewMedia({
                                      type: 'image',
                                      url: att.dataUrl,
                                      name: att.name,
                                    })
                                  }
                                  title="클릭하여 원본 크기로 보기"
                                >
                                  <img src={att.dataUrl} alt={att.name} />
                                </div>
                              );
                            }
                            if (att.type === 'video') {
                              return (
                                <div key={att.id} className="user-video-container">
                                  <video controls src={att.dataUrl} className="user-video-player" />
                                </div>
                              );
                            }
                            if (att.type === 'audio') {
                              return (
                                <div key={att.id} className="user-audio-container">
                                  <div className="user-audio-header">
                                    <FileAudio size={16} color="#3182f6" />
                                    <span className="user-audio-name">{att.name}</span>
                                  </div>
                                  <audio controls src={att.dataUrl} className="user-audio-player" />
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                      {message.content && (
                        <div className="user-text-content">{message.content}</div>
                      )}
                    </div>
                  </div>
                );
              }

              // 어시스턴트 메시지
              const hasReasoning = Boolean(message.reasoning?.trim());
              const isReasoningExpanded = expandedReasoningIds.has(message.id);

              return (
                <div key={message.id} className="message-row assistant">
                  <div className="assistant-bubble-card">
                    <div className="assistant-meta-header">
                      <div className="assistant-model-info">
                        <Sparkles size={14} color="#3182f6" />
                        <span>{currentModel.name}</span>
                        {currentModel.intelligenceIndex != null && (
                          <span
                            className="assistant-intel-badge"
                            title={`지능 지수: ${currentModel.intelligenceIndex}점`}
                          >
                            🧠 {currentModel.intelligenceIndex}
                          </span>
                        )}
                        <span className="effort-badge">노력: {reasoningEffort}</span>
                      </div>
                    </div>

                    {/* 사고 과정 (Reasoning Accordion) */}
                    {hasReasoning && (
                      <div className="reasoning-accordion">
                        <button
                          type="button"
                          className="reasoning-header"
                          onClick={() => toggleReasoning(message.id)}
                        >
                          <div className="reasoning-title-group">
                            {message.isStreaming && !message.content ? (
                              <div className="pulsing-dot" />
                            ) : (
                              <Brain size={14} />
                            )}
                            <span>
                              {message.isStreaming && !message.content
                                ? '생각하는 중...'
                                : `추론 과정 보기 (${message.reasoning?.length || 0}자)`}
                            </span>
                          </div>
                          {isReasoningExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isReasoningExpanded && (
                          <div className="reasoning-body">{message.reasoning}</div>
                        )}
                      </div>
                    )}

                    {/* 본문 텍스트 또는 에러/빈 응답 안내 */}
                    {message.isError ? (
                      <div className="assistant-error-box">
                        <div className="error-message-row">
                          <AlertCircle size={16} className="error-icon" />
                          <span>{message.errorMsg || '답변을 불러오지 못했어요. 일시적인 모델 과부하일 수 있어요.'}</span>
                        </div>
                        <div className="error-action-row">
                          <button
                            type="button"
                            className="retry-chat-btn"
                            onClick={() => handleRetryMessage(message.id)}
                          >
                            <RotateCcw size={13} />
                            <span>다시 시도</span>
                          </button>
                          <button
                            type="button"
                            className="switch-model-btn"
                            onClick={handleSwitchToStableModel}
                          >
                            <Sparkles size={13} />
                            <span>다른 추천 모델로 전환</span>
                          </button>
                        </div>
                      </div>
                    ) : message.content ? (
                      <MarkdownRenderer content={message.content} />
                    ) : message.isStreaming && !hasReasoning ? (
                      <div style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
                        답변을 준비하고 있어요...
                        <span className="streaming-cursor" />
                      </div>
                    ) : !message.isStreaming && !message.content && !hasReasoning ? (
                      <div className="assistant-error-box">
                        <div className="error-message-row">
                          <AlertCircle size={16} className="error-icon" />
                          <span>AI 모델로부터 수신된 내용이 비어있어요.</span>
                        </div>
                        <div className="error-action-row">
                          <button
                            type="button"
                            className="retry-chat-btn"
                            onClick={() => handleRetryMessage(message.id)}
                          >
                            <RotateCcw size={13} />
                            <span>다시 시도</span>
                          </button>
                          <button
                            type="button"
                            className="switch-model-btn"
                            onClick={handleSwitchToStableModel}
                          >
                            <Sparkles size={13} />
                            <span>다른 추천 모델로 전환</span>
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {message.isStreaming && message.content && (
                      <span className="streaming-cursor" />
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ─────────────────────────────────────────────
            3. 하단 메시지 입력창 (첨부파일 미리보기 포함)
        ───────────────────────────────────────────── */}
        <div className="chat-input-container">
          <div className="input-box-wrapper">
            {/* 첨부파일 대기열 미리보기 바 */}
            {pendingAttachments.length > 0 && (
              <div className="pending-attachments-bar">
                {pendingAttachments.map((att) => (
                  <div key={att.id} className="pending-attachment-chip">
                    {att.type === 'image' && (
                      <img src={att.dataUrl} alt={att.name} className="pending-thumb" />
                    )}
                    {att.type === 'audio' && <FileAudio size={18} color="#3182f6" />}
                    {att.type === 'video' && <FileVideo size={18} color="#7952b3" />}
                    <div className="pending-file-info">
                      <span className="pending-file-name" title={att.name}>{att.name}</span>
                      <span className="pending-file-size">{(att.size / (1024 * 1024)).toFixed(1)}MB</span>
                    </div>
                    <button
                      type="button"
                      className="pending-remove-btn"
                      onClick={() => handleRemoveAttachment(att.id)}
                      title="첨부 취소"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder={
                canAttachAny
                  ? `메시지를 입력하거나 ${[
                      canAttachImage ? '사진' : '',
                      canAttachAudio ? '오디오' : '',
                      canAttachVideo ? '비디오' : '',
                    ].filter(Boolean).join('/')} 파일을 첨부하세요 (Enter: 전송)`
                  : '메시지를 입력해 주세요 (Enter: 전송, Shift+Enter: 줄바꿈)'
              }
              rows={1}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />

            <div className="input-bottom-row">
              {/* 왼쪽 툴: 미디어 첨부 버튼 */}
              <div className="input-left-tools">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={fileAcceptTypes}
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className={`attach-tool-btn ${canAttachAny ? 'active' : 'disabled'}`}
                  onClick={() => {
                    if (canAttachAny) {
                      fileInputRef.current?.click();
                    }
                  }}
                  disabled={!canAttachAny}
                  title={
                    canAttachAny
                      ? `미디어 첨부 (${[
                          canAttachImage ? '사진' : '',
                          canAttachAudio ? '오디오' : '',
                          canAttachVideo ? '비디오' : '',
                        ].filter(Boolean).join('·')})`
                      : '선택한 모델은 텍스트 전용이에요 (상단에서 멀티모달 모델 선택)'
                  }
                >
                  <Paperclip size={17} />
                  {canAttachAny && (
                    <span className="attach-btn-label">
                      {[
                        canAttachImage ? '사진' : '',
                        canAttachAudio ? '음성' : '',
                        canAttachVideo ? '영상' : '',
                      ].filter(Boolean).join('/')}
                    </span>
                  )}
                </button>
              </div>

              {/* 오른쪽 도구: 정보 힌트 및 전송 버튼 */}
              <div className="input-right-tools">
                <span className="input-meta-hint">
                  {currentModel.providerName} · {currentModel.parametersSummary}
                </span>

                {isStreaming ? (
                  <button
                    type="button"
                    className="send-action-btn stop"
                    onClick={handleStopStreaming}
                    title="생성 중단"
                  >
                    <Square size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="send-action-btn send"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() && pendingAttachments.length === 0}
                    title="전송하기"
                  >
                    <CornerDownLeft size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────
          4. 모달창들
      ───────────────────────────────────────────── */}
      <ModelSelectorModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={(id) => setSelectedModelId(id)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={gatewayConfig}
        onSaveConfig={(cfg) => {
          setGatewayConfig(cfg);
          saveGatewayConfig(cfg);
        }}
      />

      {/* 미디어 원본 미리보기 모달 */}
      {previewMedia && (
        <div className="media-preview-backdrop" onClick={() => setPreviewMedia(null)}>
          <div className="media-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="media-preview-header">
              <span className="media-preview-title">{previewMedia.name}</span>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewMedia(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="media-preview-content">
              {previewMedia.type === 'image' && (
                <img src={previewMedia.url} alt={previewMedia.name} />
              )}
              {previewMedia.type === 'video' && (
                <video controls autoPlay src={previewMedia.url} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
