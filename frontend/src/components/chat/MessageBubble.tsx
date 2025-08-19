"use client";
import { ReactElement } from "react";

export interface MessageBubbleProps {
  text: string;
  isUser?: boolean;
  isError?: boolean;
}

export default function MessageBubble({
  text,
}: MessageBubbleProps) {
  const renderContent = (content: string) => {
    if (!content) return content;

    // Check for code blocks first
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: (string | ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const beforeText = content.slice(lastIndex, match.index);
        if (beforeText) {
          parts.push(processInlineFormatting(beforeText, parts.length));
        }
      }

      // Add modern code block
      const language = match[1] || '';
      const code = match[2] || '';
      parts.push(
        <div key={parts.length} className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 rounded-2xl p-4 my-3 overflow-x-auto border border-slate-700/50 shadow-lg shadow-slate-900/20">
          {language && (
            <div className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wide">
              {language}
            </div>
          )}
          <pre className="text-slate-100 text-sm font-mono leading-relaxed whitespace-pre-wrap">
            {code}
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex);
      if (remainingText) {
        parts.push(processInlineFormatting(remainingText, parts.length));
      }
    }

    // If no code blocks found, just process inline formatting
    if (parts.length === 0) {
      return processInlineFormatting(content, 0);
    }

    return parts;
  };

  const processInlineFormatting = (text: string, key: number): ReactElement => {
    const inlineCodeRegex = /`([^`]+)`/g;
    const boldRegex = /\*\*(.*?)\*\*/g;

    let processed = text;
    processed = processed.replace(boldRegex, '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>');
    processed = processed.replace(inlineCodeRegex, '<code class="bg-slate-200/80 dark:bg-slate-700/80 px-2 py-1 rounded-lg text-xs font-mono border border-slate-300/50 dark:border-slate-600/50">$1</code>');
    
    return <span key={key} dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {renderContent(text)}
    </div>
  );
}