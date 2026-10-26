// components/MarkdownRenderer.tsx - 마크다운 렌더링 및 코드 복사 컴포넌트

import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 코드 블록과 일반 텍스트 분리 파싱
  const parts = useMemo(() => {
    // 코드 블록 정규식: ```language ... ```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const items: Array<
      | { type: 'text'; html: string }
      | { type: 'code'; language: string; code: string; index: number }
    > = [];

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let codeIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        items.push({
          type: 'text',
          html: marked.parse(textBefore, { breaks: true }) as string,
        });
      }

      items.push({
        type: 'code',
        language: match[1] || 'text',
        code: match[2].trimEnd(),
        index: codeIndex++,
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const remaining = content.substring(lastIndex);
      items.push({
        type: 'text',
        html: marked.parse(remaining, { breaks: true }) as string,
      });
    }

    return items;
  }, [content]);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  return (
    <div className="markdown-content">
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          return (
            <div
              key={idx}
              className="markdown-text"
              dangerouslySetInnerHTML={{ __html: part.html }}
            />
          );
        }

        return (
          <div key={idx} className="code-block-container">
            <div className="code-header">
              <span className="code-lang">{part.language || 'code'}</span>
              <button
                type="button"
                className="copy-btn"
                onClick={() => handleCopy(part.code, part.index)}
              >
                {copiedIndex === part.index ? (
                  <>
                    <Check size={14} className="copy-icon" />
                    <span>복사했어요</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} className="copy-icon" />
                    <span>복사하기</span>
                  </>
                )}
              </button>
            </div>
            <pre className="code-content">
              <code>{part.code}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );
};
