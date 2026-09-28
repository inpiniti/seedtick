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
    <div className={`text-[#191f28] leading-relaxed text-sm ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl sm:text-2xl font-bold text-[#191f28] mt-6 mb-3 pb-2 border-b border-[#f2f4f6]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg sm:text-xl font-bold text-[#191f28] mt-5 mb-2.5 text-[#3182f6] flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#3182f6] rounded-full inline-block" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold text-[#191f28] mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-bold text-[#333d4b] mt-3 mb-1.5">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-[#4e5968] mb-3 leading-relaxed break-words">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1.5 text-sm text-[#4e5968]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-sm text-[#4e5968]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#3182f6] bg-[#f7f9fc] rounded-r-2xl pl-3.5 py-2.5 my-3 text-xs sm:text-sm text-[#4e5968] font-medium">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="w-full overflow-x-auto my-4 rounded-2xl border border-[#e5e8eb] shadow-xs">
              <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[320px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#f9fafb] border-b border-[#e5e8eb] text-[#191f28] font-bold">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-[#f2f4f6] bg-white">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="p-3 text-xs font-bold text-[#191f28] whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-3 text-xs text-[#4e5968]">{children}</td>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-[#191f28]">{children}</strong>
          ),
          code: ({ children }) => (
            <code className="bg-[#f2f4f6] text-[#f04452] font-mono px-1.5 py-0.5 rounded-md text-xs">
              {children}
            </code>
          ),
          hr: () => <hr className="my-6 border-[#e5e8eb]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
