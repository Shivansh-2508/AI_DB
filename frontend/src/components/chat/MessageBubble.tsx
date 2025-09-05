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
    if (content === null || content === undefined) return null;
    // If content is not a string (shouldn't usually happen because ChatContainer normalizes),
    // render a safe JSON string representation.
    if (typeof content !== 'string') {
      try {
        return <span>{JSON.stringify(content)}</span>;
      } catch {
        return <span>{String(content)}</span>;
      }
    }

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

      // Dark code block within light message bubble
      const language = match[1] || '';
      const code = match[2] || '';
      parts.push(
        <div key={parts.length} className="rounded-lg border overflow-x-auto font-mono text-sm my-3" style={{
          backgroundColor: '#1a1a1a',
          borderColor: '#374151'
        }}>
          {language && (
            <div className="text-xs mb-2 uppercase tracking-wide px-3 pt-2" style={{ color: '#9CA3AF' }}>
              {language}
            </div>
          )}
          <pre className="leading-relaxed whitespace-pre-wrap px-3 pb-2" style={{ color: '#F3F4F6' }}>
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
    // Only call replace when processed is a string
    if (typeof processed === 'string') {
      processed = processed.replace(boldRegex, '<strong class="font-medium">$1</strong>');
      processed = processed.replace(inlineCodeRegex, '<code class="px-2 py-1 rounded text-xs font-mono border" style="background-color: #374151; border-color: #6B7280; color: #F3F4F6;">$1</code>');
    }
    
    return <span key={key} dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {renderContent(text)}
    </div>
  );
}