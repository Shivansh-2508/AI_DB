"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getUserEmail } from "@/utils/supabase/getUserEmail";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Database, Sparkles, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import ChatInput from "./ChatInput";
import MessageList, { Message } from "./MessageList";

// Phase 3: Enhanced types for better UX
interface ApiResponse {
  message?: string;
  sql?: string;
  results?: any;
  error?: string;
  clarifier?: string;
  suggestions?: string;
  history?: any[];
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
  const activityTimeoutRef = useRef<NodeJS.Timeout>();
  const maxInactivityMinutes = 30;

  // Phase 3: Update activity tracking
  const updateActivity = useCallback(() => {
    setSessionState(prev => ({
      ...prev,
      lastActivity: new Date(),
      isActive: true
    }));

    // Reset inactivity timer
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
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
  }, []);

  // Phase 3: Enhanced message management with types
  const addMessage = (msg: Omit<Message, "id" | "timestamp"> & { type?: "user" | "assistant" | "system" | "error" }) => {
    const newMessage: Message = {
      id: Date.now().toString(),
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
        return [...systemMessages, ...recentMessages];
      }
      
      return updated;
    });

    updateActivity();
  };

  // Phase 3: Clear chat history
  const clearChatHistory = async () => {
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
      
      console.log(`🧹 Chat history cleared for session: ${sessionId}`);
    } catch (err) {
      console.error("Failed to clear chat history:", err);
    }
  };

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
          addMessage({
            text: `✅ Query executed successfully!\n\`\`\`json\n${JSON.stringify(data.results, null, 2)}\n\`\`\``,
            type: "assistant"
          });
        } else {
          addMessage({
            text: "❌ Query cancelled as requested.",
            type: "assistant"
          });
        }
      } else {
        addMessage({
          text: data.error || "Failed to process confirmation.",
          type: "error"
        });
      }
    } catch (err) {
      addMessage({
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
          id: "welcome",
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
          addMessage({
            text: "✅ Database schema cached and ready for queries.",
            type: "system"
          });
          
          // Phase 3: Add helpful hints
          addMessage({
            text: `💡 **Quick tips:**\n• Try: "show me the customers table"\n• Ask: "what tables are available?"\n• Query: "find orders from last week"\n\n*Session ID: \`${sessionId}\`*`,
            type: "system"
          });
        } else {
          console.error("Schema prefetch failed:", data.error);
          addMessage({
            text: "⚠️ Failed to prefetch schema. Queries may not work correctly.",
            type: "error"
          });
        }
      } catch (err) {
        console.error("Prefetch error:", err);
        addMessage({
          text: "⚠️ Schema prefetch request failed.",
          type: "error"
        });
      }
    }

    prefetchSchema();
  }, [userEmail, sessionId, updateActivity]);

  // Phase 3: Enhanced backend communication with all response types
  const sendToBackend = async (text: string) => {
    if (!sessionState.isActive) {
      addMessage({
        text: "Session expired. Please refresh the page to start a new session.",
        type: "error"
      });
      return;
    }

    addMessage({ text, type: "user" });
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
        
        addMessage({
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
            
            addMessage({
              text: `⚠️ **Write Operation Detected**\n\n${data.clarifier}`,
              type: "assistant"
            });
            
            // Add confirmation buttons (you'll need to implement these in MessageList)
            addMessage({
              text: "🤔 **Confirm Action:**\n• Type 'yes' to proceed\n• Type 'no' to cancel",
              type: "system"
            });
          } else {
            // Regular clarification
            addMessage({
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
          
          addMessage({ 
            text: reply.trim(),
            type: "assistant"
          });
        }
      }
    } catch (err) {
      console.error("Backend request failed:", err);
      addMessage({
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
    <div className="w-full max-w-5xl mx-auto h-[85vh] flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      {/* Enhanced Header with Session Status */}
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b border-slate-200/50 dark:border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Database Assistant
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Natural language to SQL • {sessionState.messageCount} messages
              </p>
            </div>
          </div>
          
          {/* Phase 3: Session status indicators */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              sessionState.isActive 
                ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}>
              {sessionState.isActive ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  <span>Inactive</span>
                </>
              )}
            </div>
            
            {sessionState.awaitingConfirmation && (
              <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3" />
                <span>Awaiting Confirmation</span>
              </div>
            )}
            
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Sparkles className="h-3 w-3" />
              <span>AI Powered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 bg-slate-50/30 dark:bg-slate-900/30">
        <MessageList messages={messages} isLoading={loading} />
      </div>

      {/* Enhanced Input with confirmation state */}
      <div className="flex-shrink-0">
        <ChatInput 
          onSend={handleUserInput} 
          disabled={loading}
          placeholder="Ask me anything about your database..."
          awaitingConfirmation={sessionState.awaitingConfirmation}
          sessionActive={sessionState.isActive}
        />
      </div>
    </div>
  );
}