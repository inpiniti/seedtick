// App.tsx - Reportist Chat 메인 애플리케이션

import React, { useEffect, useRef, useState } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Square,
  Trash2,
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
  type ChatMessage,
  type ChatSession,
  type FreeModelMeta,
  type GatewayConfig,
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 현재 활성 세션
  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // 현재 선택된 모델 정보
  const currentModel =
    models.find((m) => m.id === selectedModelId) ||
    models[0] ||
    FALLBACK_FREE_MODELS[0];

  // 게이트웨이 모델 목록 및 상태 로드
  useEffect(() => {
    const initGateway = async () => {
      const online = await checkGatewayHealth(gatewayConfig);
      setIsGatewayOnline(online);

      const fetchedModels = await fetchFreeModels(gatewayConfig);
      if (fetchedModels.length > 0) {
        setModels(fetchedModels);
        // 만약 선택된 모델이 목록에 없다면 1번째 모델로
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

  // 메시지 전송
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isStreaming) return;

    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: messageContent,
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
    const newTitle = shouldUpdateTitle
      ? messageContent.slice(0, 24) + (messageContent.length > 24 ? '...' : '')
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

    // 게이트웨이에 보낼 메시지 히스토리 구성 (최근 15개)
    const apiMessages = [...currentSession.messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
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
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSession.id) {
              const msgs = s.messages.map((m) => {
                if (m.id === assistantMessageId) {
                  return {
                    ...m,
                    content: `⚠️ ${errorMsg}`,
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
              <span className="trigger-tier">({currentModel.daysAgo}일 전 · {currentModel.intelligenceTier})</span>
              <ChevronDown size={16} />
            </button>
          </div>

          <div className="top-right-actions">
            {/* 노력 선택 세그먼트 */}
            <div className="effort-selector-wrapper" title="추론 노력(Reasoning Effort) 설정">
              <Brain size={14} color="#3182f6" style={{ marginLeft: 6 }} />
              {REASONING_EFFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`effort-chip ${reasoningEffort === opt.key ? 'active' : ''}`}
                  onClick={() => setReasoningEffort(opt.key)}
                  title={`${opt.label}: ${opt.description}`}
                >
                  {opt.label}
                </button>
              ))}
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

        {/* 메시지 뷰포트 */}
        <div className="messages-viewport">
          {currentSession.messages.length === 0 ? (
            /* 웰컴 스크린 */
            <div className="welcome-screen">
              <div className="welcome-logo-badge">
                <Sparkles size={32} />
              </div>
              <h1 className="welcome-title">어떤 이야기를 나눠볼까요?</h1>
              <p className="welcome-subtitle">
                {currentModel.name} 모델과 {reasoningEffort} 추론 노력으로 준비되었어요.
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
                    <div className="user-bubble">{message.content}</div>
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

                    {/* 본문 텍스트 */}
                    {message.content ? (
                      <MarkdownRenderer content={message.content} />
                    ) : message.isStreaming && !hasReasoning ? (
                      <div style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
                        답변을 준비하고 있어요...
                        <span className="streaming-cursor" />
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
            3. 하단 메시지 입력창
        ───────────────────────────────────────────── */}
        <div className="chat-input-container">
          <div className="input-box-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="메시지를 입력해 주세요 (Enter: 전송, Shift+Enter: 줄바꿈)"
              rows={1}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
            />

            <div className="input-bottom-row">
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
                  disabled={!inputText.trim()}
                  title="전송하기"
                >
                  <CornerDownLeft size={16} />
                </button>
              )}
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
    </div>
  );
}

export default App;
