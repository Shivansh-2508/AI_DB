"use client";
import { cn } from "@/lib/utils";
import { User, Bot, AlertCircle } from "lucide-react";
import { useState, ReactElement } from "react";

export interface MessageBubbleProps {
  text: string;
  isUser?: boolean;
  isError?: boolean;
}

export default function MessageBubble({
  text,
  isUser = false,
  isError = false,
}: MessageBubbleProps) {
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);

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

      // Add code block
      const language = match[1] || '';
      const code = match[2] || '';
      parts.push(
        <div key={parts.length} className="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 my-2 overflow-x-auto">
          <pre className="text-slate-100 text-xs font-mono whitespace-pre-wrap">
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
    processed = processed.replace(boldRegex, '<strong class="font-semibold">$1</strong>');
    processed = processed.replace(inlineCodeRegex, '<code class="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
    
    return <span key={key} dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  return (
    <div className={cn(
      "flex w-full mb-4 group",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "flex gap-3 max-w-[85%]",
        isUser ? "flex-row-reverse" : "flex-row"
      )}>
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser 
            ? "bg-blue-600 text-white" 
            : isError
            ? "bg-red-500 text-white"
            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
        )}>
          {isUser ? (
            <User className="h-4 w-4" />
          ) : isError ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>

        {/* Message */}
        <div className={cn(
          "rounded-2xl px-4 py-3 shadow-sm transition-all duration-200",
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : isError
            ? "bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-bl-sm"
            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm hover:shadow-md"
        )}>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {renderContent(text)}
          </div>
        </div>
      </div>
    </div>
  );
}