"use client";

import React, { useState } from "react";
import { SystemLogItem } from "@/types/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatTime } from "@/lib/utils";
import {
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronRight,
  Info,
  Search,
  ShieldAlert,
} from "lucide-react";

interface LogsTabProps {
  logs: SystemLogItem[];
  isLoading: boolean;
  onRefresh: (level?: string) => void;
}

export function LogsTab({ logs, isLoading, onRefresh }: LogsTabProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
    onRefresh(level === "ALL" ? undefined : level);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.message.toLowerCase().includes(term) ||
      (log.logger_name && log.logger_name.toLowerCase().includes(term)) ||
      log.code.toLowerCase().includes(term)
    );
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return <Badge variant="danger">CRITICAL</Badge>;
      case "ERROR":
        return <Badge variant="danger">ERROR</Badge>;
      case "WARNING":
        return <Badge variant="warning">WARN</Badge>;
      case "INFO":
      default:
        return <Badge variant="neutral">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 필터 및 검색 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* 레벨 칩 필터 (모바일: 줄바꿈으로 5개 칩 전부 노출) */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#f2f4f6] rounded-2xl w-full sm:w-fit">
          {["ALL", "CRITICAL", "ERROR", "WARNING", "INFO"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => handleLevelChange(lvl)}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                selectedLevel === lvl
                  ? "bg-white text-[#191f28] shadow-xs"
                  : "text-[#8b95a1] hover:text-[#4e5968]"
              }`}
            >
              {lvl === "ALL" ? "전체 로그" : lvl}
            </button>
          ))}
        </div>

        {/* 검색창 */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#8b95a1] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="메시지 또는 로거 검색..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#e5e8eb] rounded-2xl focus:outline-hidden focus:border-[#3182f6] text-[#191f28]"
          />
        </div>
      </div>

      {/* 로그 리스트 카드 */}
      <Card>
        <Card.Header className="border-b border-[#f2f4f6] pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <Card.Title>통합 시스템 및 에러 로그</Card.Title>
              <Card.Description>
                FastAPI 및 AI-Gateway에서 Supabase error_logs 테이블로 실시간 수집된 로그예요.
              </Card.Description>
            </div>
            <span className="text-xs text-[#8b95a1] font-medium shrink-0 self-start sm:self-auto">
              총 {filteredLogs.length}건
            </span>
          </div>
        </Card.Header>

        <Card.Content className="pt-2">
          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={<Bug className="w-8 h-8 text-[#8b95a1]" />}
              title="해당 조건의 로그가 없어요"
              description="시스템이 원활하게 동작하고 있거나 아직 등록된 로그가 없어요."
            />
          ) : (
            <div className="divide-y divide-[#f9fafb]">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div
                    key={log.id}
                    className="py-3 px-2 hover:bg-[#f9fafb] rounded-2xl transition-colors cursor-pointer"
                    onClick={() =>
                      setExpandedLogId(isExpanded ? null : log.id)
                    }
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">{getLevelBadge(log.level)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs font-semibold text-[#191f28] shrink-0">
                              [{log.code}]
                            </span>
                            {log.logger_name && (
                              <span className="text-[11px] text-[#8b95a1] truncate min-w-0">
                                {log.logger_name}
                              </span>
                            )}
                            {/* 모바일: 타임스탬프를 첫 줄 끝으로 옮겨 본문 폭 확보 */}
                            <span className="sm:hidden ml-auto text-[10px] text-[#b0b7c1] whitespace-nowrap shrink-0 tabular-nums">
                              {formatTime(log.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-[#4e5968] mt-1 break-words line-clamp-2">
                            {log.message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <span className="hidden sm:inline text-[11px] text-[#8b95a1] whitespace-nowrap tabular-nums">
                          {formatTime(log.created_at)}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#8b95a1]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[#8b95a1]" />
                        )}
                      </div>
                    </div>

                    {/* 확장된 JSON Context 상세 */}
                    {isExpanded && (
                      <div className="mt-3 p-3 rounded-2xl bg-[#f2f4f6] text-xs font-mono text-[#191f28] overflow-x-auto">
                        <div className="text-[11px] font-bold text-[#6b7684] mb-1">
                          로그 메타데이터 (Context JSON)
                        </div>
                        <pre className="text-[11px] text-[#333d4b] whitespace-pre-wrap">
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
