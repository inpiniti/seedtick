"use client";

import React, { useState } from "react";
import { SystemLogItem } from "@/types/api";
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
        return <Badge variant="danger" className="font-mono">CRITICAL</Badge>;
      case "ERROR":
        return <Badge variant="danger" className="font-mono">ERROR</Badge>;
      case "WARNING":
        return <Badge variant="warning" className="font-mono">WARN</Badge>;
      case "INFO":
      default:
        return <Badge variant="neutral" className="font-mono">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 필터 및 검색 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* 레벨 칩 필터 */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#f1f5f9] rounded-md border border-[#e2e8f0] w-full sm:w-fit font-mono text-xs">
          {["ALL", "CRITICAL", "ERROR", "WARNING", "INFO"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => handleLevelChange(lvl)}
              className={`shrink-0 whitespace-nowrap px-3 py-1 rounded transition-colors cursor-pointer ${
                selectedLevel === lvl
                  ? "bg-[#0f172a] text-white font-medium shadow-xs"
                  : "text-[#64748b] hover:text-[#0f172a] hover:bg-white/60"
              }`}
            >
              {lvl === "ALL" ? "ALL LOGS" : lvl}
            </button>
          ))}
        </div>

        {/* 검색창 */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search message, code, or logger..."
            className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-white border border-[#e2e8f0] rounded-md focus:outline-hidden focus:border-[#0f172a] text-[#0f172a]"
          />
        </div>
      </div>

      {/* 로그 리스트 */}
      <div className="rounded-md border border-[#e2e8f0] bg-white overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
          <div>
            <h4 className="text-xs font-mono font-medium text-[#0f172a] uppercase">
              Audit & Error Logs
            </h4>
            <p className="text-[11px] font-mono text-[#64748b] mt-0.5">
              Live audit events collected from FastAPI and AI Gateway.
            </p>
          </div>
          <span className="font-mono text-xs text-[#64748b] bg-white border border-[#e2e8f0] px-2 py-0.5 rounded">
            COUNT: {filteredLogs.length}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon="📋"
              title="조건에 맞는 시스템 로그가 없습니다"
              description="최근 오류가 발생하지 않았거나 검색 필터와 일치하는 로그가 없습니다."
            />
          </div>
        ) : (
          <div className="divide-y divide-[#f1f5f9] font-mono text-xs">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="hover:bg-[#f8fafc] transition-colors">
                  <div
                    onClick={() =>
                      setExpandedLogId(isExpanded ? null : log.id)
                    }
                    className="p-3 sm:px-4 sm:py-3 flex items-start gap-3 cursor-pointer select-none"
                  >
                    <button className="text-[#94a3b8] mt-0.5 shrink-0 hover:text-[#0f172a]">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <div className="shrink-0">{getLevelBadge(log.level)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#0f172a] text-xs">
                          [{log.code}]
                        </span>
                        {log.logger_name && (
                          <span className="text-[#64748b] text-[11px]">
                            {log.logger_name}
                          </span>
                        )}
                        <span className="text-[#94a3b8] text-[10px] ml-auto">
                          {formatTime(log.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-[#334155] mt-1 break-words line-clamp-2">
                        {log.message}
                      </p>
                    </div>
                  </div>

                  {/* 세부 정보 확장 뷰 */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-[#f8fafc] border-t border-[#f1f5f9] space-y-2 text-xs">
                      {log.context && (
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-[#64748b] block mb-1">
                            CONTEXT METADATA
                          </span>
                          <pre className="p-2.5 rounded bg-white border border-[#e2e8f0] text-[#0f172a] text-[11px] overflow-x-auto leading-relaxed">
                            {typeof log.context === "object"
                              ? JSON.stringify(log.context, null, 2)
                              : String(log.context)}
                          </pre>
                        </div>
                      )}
                      {Boolean(log.context && log.context.stack_trace) && (
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-rose-700 block mb-1">
                            STACK TRACE
                          </span>
                          <pre className="p-2.5 rounded bg-rose-50/50 border border-rose-200 text-rose-900 text-[10px] overflow-x-auto leading-relaxed">
                            {String(log.context.stack_trace)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
