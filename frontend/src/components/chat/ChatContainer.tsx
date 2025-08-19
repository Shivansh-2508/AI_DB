"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getUserEmail } from "@/utils/supabase/getUserEmail";
import { Database, Sparkles, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import ChatInput from "./ChatInput";
import MessageList, { Message } from "./MessageList";

// Phase 3: Enhanced types for better UX
interface ApiResponse {
  message?: string;
  sql?: string;
  results?: Record<string, unknown>;
  error?: string;
  clarifier?: string;
  suggestions?: string;
  history?: Record<string, unknown>[];
}

interface SessionState {
  isActive: boolean;
  lastActivity: Date;
  messageCount: number;
  pendingWrite?: string;
  awaitingConfirmation?: boolean;
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>({
    isActive: true,
    lastActivity: new Date(),
    messageCount: 0,
    awaitingConfirmation: false
  });
  
  // Phase 3: Persistent session ID with cleanup
  const [sessionId] = useState(() => {
    const id = Math.random().toString(36).slice(2);
    console.log(`🔄 New session created: ${id}`);
    return id;
  });

  // Phase 3: Activity tracking and cleanup
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxInactivityMinutes = 30;

  // Phase 3: Update activity tracking
  // Track inactivity state to avoid resetting isActive after inactivity
  const isInactiveRef = useRef(false);
  
  // Message ID counter to ensure uniqueness
  const messageIdCounterRef = useRef(0);
  
  // Track used message IDs to prevent duplicates
  const usedMessageIds = useRef(new Set<string>());

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    let id: string;
    do {
      messageIdCounterRef.current += 1;
      id = `msg-${Date.now()}-${messageIdCounterRef.current}-${Math.random().toString(36).slice(2, 8)}`;
    } while (usedMessageIds.current.has(id));
    
    usedMessageIds.current.add(id);
    return id;
  }, []);

  // Phase 3: Clear chat history
  const clearChatHistory = useCallback(async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? ""}/chat/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      
      setMessages([]);
      setSessionState(prev => ({ 
        ...prev, 
        messageCount: 0, 
        awaitingConfirmation: false,
        pendingWrite: undefined 
      }));
      
      // Reset message ID tracking
      usedMessageIds.current.clear();
      messageIdCounterRef.current = 0;
      
      console.log(`🧹 Chat history cleared for session: ${sessionId}`);
    } catch {
      console.error("Failed to clear chat history");
    }
  }, [sessionId]);

  // Phase 3: Enhanced message management with types
  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp"> & { type?: "user" | "assistant" | "system" | "error" }) => {
    const newMessage: Message = {
      id: generateMessageId(),
      timestamp: new Date(),
      isUser: msg.type === "user" || msg.isUser || false,
      isError: msg.type === "error" || msg.isError || false,
      ...msg
    };

    setMessages((m) => {
      const updated = [...m, newMessage];
      
      // Phase 3: Client-side message trimming (keep last 100 messages)
      if (updated.length > 100) {
        const systemMessages = updated.filter(msg => msg.type === "system").slice(-5);
        const recentMessages = updated.slice(-90);
        
        // Clean up used IDs for removed messages
        const remainingMessages = [...systemMessages, ...recentMessages];
        const remainingIds = new Set(remainingMessages.map(msg => msg.id));
        usedMessageIds.current = remainingIds;
        
        return remainingMessages;
      }
      
      return updated;
    });
  }, [generateMessageId]);

  const updateActivity = useCallback(() => {
    // Only set isActive to true if not currently inactive
    setSessionState(prev => ({
      ...prev,
      lastActivity: new Date(),
      isActive: !isInactiveRef.current
    }));

    // Reset inactivity timer
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      isInactiveRef.current = true;
      setSessionState(prev => ({ ...prev, isActive: false }));
      addMessage({
        text: "⏰ Session inactive. Your chat history will be cleared for security.",
        isUser: false,
        isError: false,
        type: "system"
      });
      // Clear session on backend
      clearChatHistory();
    }, maxInactivityMinutes * 60 * 1000);
    isInactiveRef.current = false;
  }, [addMessage, clearChatHistory, maxInactivityMinutes]);

  // Enhanced addMessage that calls updateActivity
  const addMessageWithActivity = useCallback((msg: Omit<Message, "id" | "timestamp"> & { type?: "user" | "assistant" | "system" | "error" }) => {
    addMessage(msg);
    updateActivity();
  }, [addMessage, updateActivity]);

  // Phase 3: Enhanced confirmation handler
  const handleWriteConfirmation = async (decision: "yes" | "no") => {
    if (!sessionState.awaitingConfirmation) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? ""}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          decision: decision
        }),
      });

      const data: ApiResponse = await res.json();
      
      if (res.ok) {
        if (decision === "yes") {
          addMessageWithActivity({
            text: `✅ Query executed successfully!\n\`\`\`json\n${JSON.stringify(data.results, null, 2)}\n\`\`\``,
            type: "assistant"
          });
        } else {
          addMessageWithActivity({
            text: "❌ Query cancelled as requested.",
            type: "assistant"
          });
        }
      } else {
        addMessageWithActivity({
          text: data.error || "Failed to process confirmation.",
          type: "error"
        });
      }
    } catch {
      addMessageWithActivity({
        text: "Connection failed during confirmation.",
        type: "error"
      });
    } finally {
      setSessionState(prev => ({ 
        ...prev, 
        awaitingConfirmation: false,
        pendingWrite: undefined 
      }));
      setLoading(false);
      updateActivity();
    }
  };

  // Fetch user email on mount
  useEffect(() => {
    async function fetchEmail() {
      const email = await getUserEmail();
      setUserEmail(email);

      setMessages([
        {
          id: "welcome-initial",
          text: email
            ? `Hello ${email}! I'm here to help you query and explore your database. What would you like to know?`
            : "Hello! I'm here to help you query and explore your database. What would you like to know?",
          isUser: false,
          isError: false,
          timestamp: new Date(),
          type: "system"
        },
      ]);
    }
    fetchEmail();
    updateActivity();
  }, [updateActivity]);

  // Prefetch schema with enhanced error handling
  useEffect(() => {
    if (!userEmail) return;

    async function prefetchSchema() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE ?? ""}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              email: userEmail, 
              session_id: sessionId 
            }),
          }
        );

        const data = await res.json();
        if (res.ok) {
          console.log("Schema cached:", data.schema_summary);
          addMessageWithActivity({
            text: "✅ Database schema cached and ready for queries.",
            type: "system"
          });
          
          // Phase 3: Add helpful hints
          addMessageWithActivity({
            text: `💡 **Quick tips:**\n• Try: "show me the customers table"\n• Ask: "what tables are available?"\n• Query: "find orders from last week"\n\n*Session ID: \`${sessionId}\`*`,
            type: "system"
          });
        } else {
          console.error("Schema prefetch failed:", data.error);
          addMessageWithActivity({
            text: "⚠️ Failed to prefetch schema. Queries may not work correctly.",
            type: "error"
          });
        }
      } catch {
        console.error("Prefetch error");
        addMessageWithActivity({
          text: "⚠️ Schema prefetch request failed.",
          type: "error"
        });
      }
    }

    prefetchSchema();
  }, [userEmail, sessionId, addMessageWithActivity]);

  // Phase 3: Enhanced backend communication with all response types
  const sendToBackend = async (text: string) => {
    if (!sessionState.isActive) {
      addMessageWithActivity({
        text: "Session expired. Please refresh the page to start a new session.",
        type: "error"
      });
      return;
    }

    addMessageWithActivity({ text, type: "user" });
    setSessionState(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE ?? ""}/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            email: userEmail,
          }),
        }
      );

      const data: ApiResponse = await res.json();

      if (!res.ok || data.error) {
        // Phase 3: Enhanced error handling with suggestions
        let errorMsg = data.error || "Unable to process your request. Please try again.";
        if (data.suggestions) {
          errorMsg += `\n\n**Suggestions:**\n${data.suggestions}`;
        }
        
        addMessageWithActivity({
          text: errorMsg,
          type: "error"
        });
      } else {
        // Phase 3: Handle all response types
        if (data.clarifier) {
          // Write confirmation or clarification needed
          if (data.clarifier.includes("modify data") || data.clarifier.includes("Do you want me to run it")) {
            setSessionState(prev => ({ 
              ...prev, 
              awaitingConfirmation: true,
              pendingWrite: data.sql 
            }));
            
            addMessageWithActivity({
              text: `⚠️ **Write Operation Detected**\n\n${data.clarifier}`,
              type: "assistant"
            });
            
            // Add confirmation buttons (you'll need to implement these in MessageList)
            addMessageWithActivity({
              text: "🤔 **Confirm Action:**\n• Type 'yes' to proceed\n• Type 'no' to cancel",
              type: "system"
            });
          } else {
            // Regular clarification
            addMessageWithActivity({
              text: `🤔 ${data.clarifier}`,
              type: "assistant"
            });
          }
        } else {
          // Regular query response
          let reply = "";
          if (data.message) reply += `${data.message}\n`;
          if (data.sql) reply += `\n**Generated SQL:**\n\`\`\`sql\n${data.sql}\n\`\`\`\n`;
          if (data.results) reply += `\n**Results:**\n\`\`\`json\n${JSON.stringify(data.results, null, 2)}\n\`\`\``;
          
          addMessageWithActivity({ 
            text: reply.trim(),
            type: "assistant"
          });
        }
      }
    } catch (err) {
      console.error("Backend request failed:", err);
      addMessageWithActivity({
        text: "Connection failed. Please check your network and try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
      updateActivity();
    }
  };

  // Phase 3: Handle confirmation responses
  const handleUserInput = async (text: string) => {
    const lowerText = text.toLowerCase().trim();
    
    if (sessionState.awaitingConfirmation) {
      if (lowerText === "yes" || lowerText === "y") {
        await handleWriteConfirmation("yes");
        return;
      } else if (lowerText === "no" || lowerText === "n") {
        await handleWriteConfirmation("no");
        return;
      }
    }
    
    // Regular message
    await sendToBackend(text);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto h-[85vh] flex flex-col relative">
      {/* Modern Glassmorphic Container */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 via-white/20 to-sky-50/30 dark:from-indigo-950/20 dark:via-slate-900/40 dark:to-sky-950/20 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-700/30 shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-900/20"></div>
      
      <div className="relative z-10 h-full flex flex-col rounded-3xl overflow-hidden">
        {/* Premium Header with Neural Network Aesthetic */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-50/90 via-white/80 to-indigo-50/90 dark:from-slate-900/90 dark:via-slate-800/80 dark:to-indigo-950/90 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* AI-Themed Icon with Glow */}
              <div className="relative p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25 dark:shadow-indigo-400/20">
                <Database className="h-6 w-6 text-white" />
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl opacity-0 hover:opacity-20 transition-opacity duration-300"></div>
              </div>
              
              <div className="space-y-1">
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-indigo-800 to-purple-900 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent">
                  AI Database Assistant
                </h1>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Natural Language → SQL • {sessionState.messageCount} queries
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Neural Processing</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modern Status Indicators */}
            <div className="flex items-center gap-3">
              {/* Session Status */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
                sessionState.isActive 
                  ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 shadow-lg shadow-emerald-500/10' 
                  : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/50 shadow-lg shadow-red-500/10'
              }`}>
                {sessionState.isActive ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Active Session</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    <span>Inactive</span>
                  </>
                )}
              </div>
              
              {/* Confirmation Status */}
              {sessionState.awaitingConfirmation && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 shadow-lg shadow-amber-500/10 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Awaiting Confirmation</span>
                </div>
              )}
              
              {/* AI Badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50 shadow-lg shadow-indigo-500/10">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Powered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Messages Area */}
        <div className="flex-1 min-h-0 bg-gradient-to-b from-slate-50/30 via-white/10 to-indigo-50/20 dark:from-slate-900/30 dark:via-slate-800/10 dark:to-indigo-950/20">
          <MessageList messages={messages} isLoading={loading} />
        </div>

        {/* Premium Input Area */}
        <div className="flex-shrink-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t border-slate-200/50 dark:border-slate-700/50">
          <ChatInput 
            onSend={handleUserInput} 
            disabled={loading}
            placeholder="Ask me anything about your database..."
            awaitingConfirmation={sessionState.awaitingConfirmation}
            sessionActive={sessionState.isActive}
          />
        </div>
      </div>
    </div>
  );
}