"use client";
import { useEffect, useRef } from "react";
import { Bot, Loader2, User, AlertTriangle, Info, Clock, Database } from "lucide-react";
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
      return "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 dark:shadow-indigo-400/20";
    }
    
    switch (message.type) {
      case "system":
        return "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border border-slate-200 dark:border-slate-600 shadow-lg shadow-slate-500/10";
      case "error":
        return "bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25 dark:shadow-red-400/20";
      default:
        return "bg-gradient-to-br from-white to-slate-50 dark:from-slate-700 dark:to-slate-600 border border-slate-200 dark:border-slate-600 shadow-lg shadow-slate-500/10";
    }
  };

  // Phase 3: Get appropriate bubble styling for message type
  const getBubbleStyling = (message: Message) => {
    const baseClasses = "rounded-3xl px-6 py-4 shadow-lg max-w-[85%] break-words backdrop-blur-sm transition-all duration-300";
    
    if (message.isUser || message.type === "user") {
      return `${baseClasses} bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 text-white rounded-br-lg ml-auto border border-indigo-400/20 shadow-indigo-500/25 hover:shadow-indigo-500/40`;
    }
    
    switch (message.type) {
      case "system":
        return `${baseClasses} bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-700 border border-slate-200/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-bl-lg shadow-slate-500/10 hover:shadow-slate-500/20`;
      case "error":
        return `${baseClasses} bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border border-red-200/50 dark:border-red-700/50 text-red-800 dark:text-red-200 rounded-bl-lg shadow-red-500/10 hover:shadow-red-500/20`;
      default:
        return `${baseClasses} bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-700 border border-slate-200/50 dark:border-slate-600/50 text-slate-900 dark:text-slate-100 rounded-bl-lg shadow-slate-500/10 hover:shadow-slate-500/20`;
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
      className="h-full overflow-y-auto px-8 py-6 chat-scrollbar"
    >
      <div className="space-y-6">
        {messageGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={`space-y-3 ${group.isGroup ? 'bg-white/30 dark:bg-slate-900/20 rounded-2xl p-4 border border-white/20 dark:border-slate-700/20 backdrop-blur-sm' : ''}`}>
            {group.messages.map((message, messageIndex) => {
              const isUser = message.isUser || message.type === "user";
              const showAvatar = !group.isGroup || messageIndex === 0;
              
              // Ensure unique key by combining message ID with group and message indices
              const uniqueKey = `${message.id}-${groupIndex}-${messageIndex}`;
              
              return (
                <div key={uniqueKey} className="group">
                  <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
                    {/* Avatar for non-user messages */}
                    {!isUser && showAvatar && (
                      <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 ${getAvatarStyling(message)}`}>
                        {getMessageIcon(message)}
                      </div>
                    )}
                    
                    {/* Modern Message bubble */}
                    <div className={`transition-all duration-300 hover:scale-[1.02] ${getBubbleStyling(message)}`}>
                      <MessageBubble {...message} />
                    </div>
                    
                    {/* Avatar for user messages */}
                    {isUser && showAvatar && (
                      <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 ${getAvatarStyling(message)}`}>
                        {getMessageIcon(message)}
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced timestamp with glass morphism */}
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-xs text-center mb-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full border border-white/30 dark:border-slate-700/30 text-slate-600 dark:text-slate-400">
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

        {/* Modern Enhanced loading indicator */}
        {isLoading && (
          <div className="flex justify-start mb-6">
            <div className="flex gap-4 max-w-[85%]">
              <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 dark:shadow-indigo-400/20 flex items-center justify-center">
                <Database className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-700 border border-slate-200/50 dark:border-slate-600/50 rounded-3xl rounded-bl-lg px-6 py-4 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                  <span className="text-sm font-medium">{getLoadingMessage()}</span>
                </div>
                
                {/* Enhanced loading progress dots */}
                <div className="flex gap-1.5 mt-3">
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modern empty state for new sessions */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 dark:shadow-indigo-400/20 flex items-center justify-center mb-6">
              <Database className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-900 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent mb-3">
              Ready to Query
            </h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              Ask me anything about your database. I can help you explore tables, run queries, and analyze your data with natural language.
            </p>
          </div>
        )}

        {/* Enhanced message count indicator for large chats */}
        {messages.length > 50 && (
          <div className="flex justify-center py-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30 dark:border-slate-700/30 shadow-lg">
              {messages.length} messages • Chat history auto-trimmed for performance
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}