"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className = "" }: MarkdownViewerProps) {
  return (
    <div className={`text-[#0f172a] leading-relaxed text-sm ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] mt-7 mb-3.5 pb-2 border-b border-[#e2e8f0] tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] mt-6 mb-3 flex items-center gap-2 border-b border-[#f1f5f9] pb-1.5">
              <span className="w-1.5 h-4 bg-[#0f172a] rounded-xs inline-block" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold text-[#0f172a] mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-bold text-[#334155] mt-3.5 mb-1.5">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-[#334155] mb-3 leading-relaxed break-words">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3.5 space-y-1.5 text-sm text-[#334155]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3.5 space-y-1.5 text-sm text-[#334155]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#0f172a] bg-[#f8fafc] rounded-r-sm pl-4 py-3 my-4 text-xs sm:text-sm text-[#334155] font-medium leading-relaxed">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="w-full overflow-x-auto my-4 rounded-md border border-[#e2e8f0] shadow-2xs font-mono">
              <table className="w-full text-left border-collapse text-xs min-w-[320px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#0f172a] font-bold">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-[#f1f5f9] bg-white">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="p-2.5 text-xs font-semibold text-[#0f172a] whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-2.5 text-xs text-[#334155]">{children}</td>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-[#0f172a]">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="bg-[#f1f5f9] text-[#0f172a] font-mono border border-[#e2e8f0] px-1.5 py-0.5 rounded text-xs">
              {children}
            </code>
          ),
          hr: () => <hr className="my-6 border-[#e2e8f0]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
