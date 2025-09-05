"use client";
import { ReactElement } from "react";

export interface MessageBubbleProps {
  text: string;
  isUser?: boolean;
  isError?: boolean;
}

export default function MessageBubble({
  text,
  isUser,
  isError
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
        <div key={parts.length} className="relative group rounded-xl ring-1 ring-gray-800/50 p-5 my-4 overflow-x-auto font-mono text-sm bg-black/30 backdrop-blur-sm">
          {/* Gradient hover effect for code blocks */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-violet-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          
          <div className="relative">
            {language && (
              <div className="flex items-center gap-2 mb-3">
                <div className="px-2 py-1 text-xs font-medium text-indigo-400/90 bg-indigo-600/10 rounded-md ring-1 ring-indigo-500/20 uppercase tracking-wide">
                  {language}
                </div>
              </div>
            )}
            <pre className="leading-relaxed whitespace-pre-wrap text-gray-300">
              {code}
            </pre>
          </div>
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
      processed = processed.replace(inlineCodeRegex, '<code class="px-2 py-1 rounded-md text-xs font-mono bg-black/30 text-indigo-400/90 ring-1 ring-indigo-500/20">$1</code>');
    }
    
    return <span key={key} dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  return (
    <div
      className={`relative group text-sm leading-relaxed whitespace-pre-wrap px-5 py-3 rounded-xl shadow-lg backdrop-blur-xl transition-all duration-200
        ${isError 
          ? 'bg-red-500/10 ring-1 ring-red-500/20 text-red-200' 
          : isUser 
            ? 'bg-[#0A0F16]/80 ring-1 ring-gray-800/30 text-gray-100 ml-auto hover:shadow-indigo-500/5' 
            : 'bg-[#0A0F16]/80 ring-1 ring-gray-800/30 text-gray-100 hover:shadow-indigo-500/5'
        }
      `}
      style={{ maxWidth: isUser ? '70%' : '80%', wordBreak: 'break-word' }}
    >
      {/* Gradient hover effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-violet-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      
      {/* Content with relative positioning to appear above the gradient */}
      <div className="relative">
        {renderContent(text)}
      </div>
    </div>
  );
}