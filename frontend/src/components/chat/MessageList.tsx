"use client";
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Loader2, User, AlertTriangle, Info, CheckCircle, Clock, Database } from "lucide-react";
import MessageBubble, { MessageBubbleProps } from "./MessageBubble";

export interface Message extends MessageBubbleProps {
  id: string;
  timestamp: Date;
  type?: "user" | "assistant" | "system" | "error";
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Phase 3: Get appropriate icon for message type
  const getMessageIcon = (message: Message) => {
    if (message.isUser || message.type === "user") {
      return <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
    
    switch (message.type) {
      case "system":
        return <Info className="h-4 w-4 text-slate-600 dark:text-slate-400" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Bot className="h-4 w-4 text-slate-700 dark:text-slate-300" />;
    }
  };

  // Phase 3: Get appropriate avatar styling for message type
  const getAvatarStyling = (message: Message) => {
    if (message.isUser || message.type === "user") {
      return "bg-blue-500/10 border border-blue-200 dark:border-blue-700";
    }
    
    switch (message.type) {
      case "system":
        return "bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600";
      case "error":
        return "bg-red-500/10 border border-red-200 dark:border-red-700";
      default:
        return "bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-600";
    }
  };

  // Phase 3: Get appropriate bubble styling for message type
  const getBubbleStyling = (message: Message) => {
    const baseClasses = "rounded-2xl px-4 py-3 shadow-sm max-w-[85%] break-words";
    
    if (message.isUser || message.type === "user") {
      return `${baseClasses} bg-blue-600 text-white rounded-br-sm ml-auto`;
    }
    
    switch (message.type) {
      case "system":
        return `${baseClasses} bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-bl-sm`;
      case "error":
        return `${baseClasses} bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 rounded-bl-sm`;
      default:
        return `${baseClasses} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm`;
    }
  };

  // Phase 3: Enhanced loading states
  const getLoadingMessage = () => {
    const messages = [
      "Analyzing your query...",
      "Generating SQL...",
      "Executing query...",
      "Processing results...",
      "Thinking..."
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  // Phase 3: Message grouping by type and time
  const groupMessages = (messages: Message[]) => {
    const groups: Array<{ messages: Message[]; isGroup: boolean }> = [];
    let currentGroup: Message[] = [];
    let lastType: string | undefined;
    let lastTime: Date | undefined;

    messages.forEach((message, index) => {
      const messageType = message.type || (message.isUser ? "user" : "assistant");
      const timeDiff = lastTime ? message.timestamp.getTime() - lastTime.getTime() : 0;
      
      // Group if same type and within 2 minutes
      if (messageType === lastType && timeDiff < 120000 && currentGroup.length < 3) {
        currentGroup.push(message);
      } else {
        if (currentGroup.length > 0) {
          groups.push({ messages: [...currentGroup], isGroup: currentGroup.length > 1 });
        }
        currentGroup = [message];
      }
      
      lastType = messageType;
      lastTime = message.timestamp;
      
      // Push last group
      if (index === messages.length - 1) {
        groups.push({ messages: [...currentGroup], isGroup: currentGroup.length > 1 });
      }
    });

    return groups;
  };

  const messageGroups = groupMessages(messages);

  return (
    <div 
      className="h-full overflow-y-auto px-6 py-4"
      style={{ 
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 transparent'
      }}
    >
      <div className="space-y-4">
        {messageGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={`space-y-1 ${group.isGroup ? 'bg-slate-50/50 dark:bg-slate-900/20 rounded-lg p-2' : ''}`}>
            {group.messages.map((message, messageIndex) => {
              const isUser = message.isUser || message.type === "user";
              const showAvatar = !group.isGroup || messageIndex === 0;
              
              return (
                <div key={message.id} className="group">
                  <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
                    {/* Avatar for non-user messages */}
                    {!isUser && showAvatar && (
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getAvatarStyling(message)}`}>
                        {getMessageIcon(message)}
                      </div>
                    )}
                    
                    {/* Message bubble */}
                    <div className={getBubbleStyling(message)}>
                      <MessageBubble {...message} />
                    </div>
                    
                    {/* Avatar for user messages */}
                    {isUser && showAvatar && (
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getAvatarStyling(message)}`}>
                        {getMessageIcon(message)}
                      </div>
                    )}
                  </div>
                  
                  {/* Phase 3: Enhanced timestamp with message info */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-slate-400 dark:text-slate-500 text-center mb-1">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {message.type && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{message.type}</span>
                        </>
                      )}
                      {group.isGroup && messageIndex === 0 && (
                        <>
                          <span>•</span>
                          <span>{group.messages.length} messages</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Phase 3: Enhanced loading indicator */}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="flex gap-3 max-w-[85%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 border border-blue-200 dark:border-blue-700 flex items-center justify-center">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{getLoadingMessage()}</span>
                </div>
                
                {/* Loading progress dots */}
                <div className="flex gap-1 mt-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: Empty state for new sessions */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Database className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Ready to Query
            </h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md">
              Ask me anything about your database. I can help you explore tables, run queries, and analyze your data.
            </p>
          </div>
        )}

        {/* Phase 3: Message count indicator for large chats */}
        {messages.length > 50 && (
          <div className="flex justify-center py-2">
            <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              {messages.length} messages • Chat history auto-trimmed for performance
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}