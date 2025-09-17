"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { Database } from "lucide-react";
import ChatInput from "./ChatInput";
import MessageList, { Message } from "./MessageList";

// Phase 3: Enhanced types for better UX
interface ApiResponse {
  message?: string;
  sql?: string;
  columns?: string[];
  results?: Record<string, unknown>;
  error?: string;
  clarifier?: string;
  suggestions?: string;
  history?: Record<string, unknown>[];
}

// Backend message shape returned by GET /chat/:sessionId
interface BackendMessage {
  message_id?: string;
  messageId?: string;
  id?: string;
  content?: string;
  text?: string;
  role?: string;
  type?: string;
  timestamp?: string;
}

// extended variant for persisted structured fields
interface BackendMessageWithStructured extends BackendMessage {
  results?: unknown;
  sql?: string;
}

interface SessionState {
  isActive: boolean;
  lastActivity: Date;
  messageCount: number;
  pendingWrite?: string;
  awaitingConfirmation?: boolean;
}

// Helper function to normalize results to TableResult format
function normalizeResults(data: ApiResponse): { columns: string[]; rows: Record<string, unknown>[] } | undefined {
  if (data && Array.isArray(data.columns) && Array.isArray(data.results)) {
    return { columns: data.columns as string[], rows: data.results as Record<string, unknown>[] };
  } else if (Array.isArray(data.results)) {
    // legacy: derive columns from first row but keep insertion order
    const rows = data.results as Record<string, unknown>[];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { columns, rows };
  } else if (data.results) {
    // non-array results (object / scalar) — pass through as a single-row table
    const rows = [data.results as Record<string, unknown>];
    const columns = Object.keys(rows[0]);
    return { columns, rows };
  }
  return undefined;
}

// SessionContext removed: no longer needed for user-based chat

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const { user, token, logout } = useAuth();
  const userEmail = user?.email || null;
  const [loading, setLoading] = useState(false);
  const [isSchemaLoading, setIsSchemaLoading] = useState(true);
  const [sessionState, setSessionState] = useState<SessionState>({
    isActive: true,
    lastActivity: new Date(),
    messageCount: 0,
    awaitingConfirmation: false
  });
  const authHeaders = useMemo<Record<string,string>>(() => {
    return token ? { Authorization: `Bearer ${token}` } : {} as Record<string,string>;
  }, [token]);

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? ""}/chat/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data && data.error ? data.error : 'Failed to clear chat on server';
        console.error(msg);
        setMessages(prev => [
          {
            id: generateMessageId(),
            text: `⚠️ ${msg}`,
            isUser: false,
            isError: true,
            timestamp: new Date(),
            type: 'error'
          },
          ...prev
        ]);
        return;
      }

      const sysMsg: Message = {
        id: generateMessageId(),
        text: '🧹 Chat history cleared.',
        isUser: false,
        isError: false,
        timestamp: new Date(),
        type: 'system'
      };

      setMessages([sysMsg]);
      setSessionState(prev => ({ 
        ...prev, 
        messageCount: 0, 
        awaitingConfirmation: false,
        pendingWrite: undefined 
      }));

      usedMessageIds.current.clear();
      messageIdCounterRef.current = 0;

      console.log(`🧹 Chat history cleared for user.`);
    } catch (err) {
      console.error('Failed to clear chat history', err);
      setMessages(prev => [
        {
          id: generateMessageId(),
          text: '⚠️ Failed to clear chat history. Check server.',
          isUser: false,
          isError: true,
          timestamp: new Date(),
          type: 'error'
        },
        ...prev
      ]);
    }
  }, [generateMessageId, authHeaders]);

  // Phase 3: Enhanced message management with types
  type MessageWithOptionalStructured = Omit<Message, "id" | "timestamp"> & { type?: "user" | "assistant" | "system" | "error", results?: unknown, sql?: string };
  const addMessage = useCallback((msg: MessageWithOptionalStructured) => {
    const newMessage: Message = {
      id: generateMessageId(),
      timestamp: new Date(),
      isUser: msg.type === "user" || msg.isUser || false,
      isError: msg.type === "error" || msg.isError || false,
      ...msg
    };

    setMessages((m) => {
      const updated = [...m, newMessage];
      
      if (updated.length > 100) {
        const systemMessages = updated.filter(msg => msg.type === "system").slice(-5);
        const recentMessages = updated.slice(-90);
        const remainingMessages = [...systemMessages, ...recentMessages];
        usedMessageIds.current = new Set(remainingMessages.map(msg => msg.id));
        return remainingMessages;
      }
      
      return updated;
    });

    // Persist to backend
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        messageId: newMessage.id,
        content: newMessage.text,
        role: msg.type || "assistant",
        results: msg.results ?? undefined,
        sql: msg.sql ?? undefined
        // If backend requires user_id, add: user_id: user?.id
      })
    }).catch(err => console.error("Failed to save message to backend", err));
  }, [generateMessageId, authHeaders]);

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
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          // session_id removed: user_id is handled by backend via JWT
          decision: decision
        }),
      });

      const data: ApiResponse = await res.json();
      
      if (res.ok) {
        if (decision === "yes") {
          // Use the normalizeResults helper function to properly format the results
          const normalizedResults = normalizeResults(data);
          
          addMessageWithActivity({
            text: `✅ Query executed successfully!`,
            type: "assistant",
            results: normalizedResults,
            sql: data.sql
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

  useEffect(() => {
    updateActivity();
  }, [updateActivity]);

  // Load persisted chat history
  const persistedLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? ""}/chat/history`, { headers: { ...authHeaders } });
        const data = await res.json();
        if (res.status === 401) {
          logout();
          return;
        }
        if (cancelled) return;

        const history = data.history || [];
        if (!Array.isArray(history) || history.length === 0) {
          if (!persistedLoadedRef.current) {
            setMessages([
              {
                id: "welcome-initial",
                text: userEmail
                  ? `Hello ${userEmail}! I'm here to help you query and explore your database. What would you like to know?`
                  : "Hello! I'm here to help you query and explore your database. What would you like to know?",
                isUser: false,
                isError: false,
                timestamp: new Date(),
                type: "system",
              },
            ]);
          }
          persistedLoadedRef.current = true;
          return;
        }

        const mapped: Message[] = history.map((h: BackendMessageWithStructured) => {
          const id = h.message_id || h.messageId || h.id || generateMessageId();
          usedMessageIds.current.add(id);

          const timestamp = h.timestamp ? new Date(h.timestamp) : new Date();
          const isUser = (h.type === "user" || h.role === "user");
          const isError = (h.type === "error" || h.role === "error");

          let textVal: string = "";
          let resultsVal: unknown = h.results ?? undefined;
          let sqlVal: string | undefined = h.sql ?? undefined;

          if (h.text && typeof h.text === 'string') {
            textVal = h.text;
          }

          if (h.content && typeof h.content !== 'string') {
            try {
              const contentObj = h.content as unknown as Record<string, unknown>;
              if (contentObj.type === 'results' && Array.isArray(contentObj.rows)) {
                const providedCols = Array.isArray(contentObj.columns)
                  ? (contentObj.columns as unknown[]).map((c) => String(c))
                  : undefined;

                const rawRows = contentObj.rows as unknown[];
                const normalizedRows: Record<string, unknown>[] = rawRows.map((r) => {
                  if (Array.isArray(r)) {
                    if (providedCols && providedCols.length >= r.length) {
                      const obj: Record<string, unknown> = {};
                      (r as unknown[]).forEach((val, idx) => { obj[providedCols[idx]] = val; });
                      return obj;
                    }
                    const obj: Record<string, unknown> = {};
                    (r as unknown[]).forEach((val, idx) => { obj[`col_${idx}`] = val; });
                    return obj;
                  }

                  if (r && typeof r === 'object') return r as Record<string, unknown>;
                  return { value: r };
                });

                const derivedCols = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
                const finalCols = providedCols && providedCols.length ? providedCols : derivedCols;

                resultsVal = { columns: finalCols, rows: normalizedRows } as unknown;
                sqlVal = sqlVal ?? (typeof contentObj.sql === 'string' ? contentObj.sql : (contentObj.sql ? String(contentObj.sql) : undefined));
                textVal = textVal || `Results: ${normalizedRows.length} row${normalizedRows.length === 1 ? '' : 's'}`;
              } else {
                textVal = textVal || JSON.stringify(contentObj);
              }
            } catch {
              textVal = textVal || String(h.content);
            }
          } else if (!textVal && typeof h.content === 'string') {
            textVal = h.content;
          }

          return {
            id,
            text: textVal,
            results: resultsVal ?? undefined,
            sql: sqlVal ?? undefined,
            isUser,
            isError,
            timestamp,
            type: h.type || h.role || (isUser ? "user" : "assistant"),
          } as Message;
        });

        messageIdCounterRef.current = Math.max(messageIdCounterRef.current, mapped.length);
        setMessages(mapped);
        setSessionState(prev => ({ ...prev, messageCount: mapped.length }));
        persistedLoadedRef.current = true;
        console.log(`✅ Loaded ${mapped.length} persisted messages for user.`);
      } catch (err) {
        console.error("Failed to load persisted chat history:", err);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [generateMessageId, userEmail, authHeaders, logout]);

  // Prefetch schema
  useEffect(() => {
    if (!userEmail) return;

    async function prefetchSchema() {
      setIsSchemaLoading(true);
      try {
        // Use dedicated endpoint for schema prefetch
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE ?? ""}/chat/schema`,
          {
            method: "GET",
            headers: { ...authHeaders },
          }
        );

        const data = await res.json();
        if (res.status === 401) {
          logout();
          return;
        }
        if (res.ok && data.schema_summary) {
          console.log("Schema cached:", data.schema_summary);
          addMessageWithActivity({
            text: "✅ Database schema cached and ready for queries.",
            type: "system"
          });
          addMessageWithActivity({
            text: `💡 **Quick tips:**\n• Try: "show me the customers table"\n• Ask: "what tables are available?"\n• Query: "find orders from last week"`,
            type: "system"
          });
          setIsSchemaLoading(false);
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
  }, [userEmail, addMessageWithActivity, authHeaders, logout]);

  const sendToBackend = async (text: string) => {
    if (!sessionState.isActive) {
      addMessageWithActivity({
        text: "Session expired. Please refresh the page to start a new session.",
        type: "error"
      });
      return;
    }
    if (isSchemaLoading) {
      addMessageWithActivity({
        text: "⏳ Please wait until the database schema is loaded before chatting.",
        type: "error"
      });
      return;
    }

    addMessageWithActivity({ text, type: "user" });
    setSessionState(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
    setLoading(true);

    let res: Response | undefined;
    try {
      res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE ?? ""}/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            message: text
          }),
        }
      );

      const data: ApiResponse = await res.json();
      if (res.status === 401) {
        logout();
        return;
      }

      if (!res.ok || data.error) {
        let errorMsg = data.error || "Unable to process your request. Please try again.";
        if (data.suggestions) {
          errorMsg += `\n\n**Suggestions:**\n${data.suggestions}`;
        }
        addMessageWithActivity({
          text: errorMsg,
          type: "error"
        });
      } else {
        if (data.clarifier) {
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
            addMessageWithActivity({
              text: "🤔 **Confirm Action:**\n• Type 'yes' to proceed\n• Type 'no' to cancel",
              type: "system"
            });
          } else {
            addMessageWithActivity({
              text: `🤔 ${data.clarifier}`,
              type: "assistant"
            });
          }
        } else {
          const assistantTextParts: string[] = [];
          if (data.message) assistantTextParts.push(data.message);
          if (data.sql) assistantTextParts.push("Generated SQL available.");

          const normalizedResults = normalizeResults(data);

          addMessageWithActivity({
            text: assistantTextParts.join("\n\n") || "Here are the results:",
            type: "assistant",
            results: normalizedResults,
            sql: data.sql
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
    
    await sendToBackend(text);
  };

  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="h-screen flex bg-[#0A1112]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-emerald-400/10 bg-white/10 backdrop-blur-xl shadow-2xl">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-r from-emerald-400/80 to-sky-400/80 shadow-lg">
                <Database className="h-4 w-4 text-gray-100" />
              </div>
              <h1 className="text-lg font-bold text-gray-100 tracking-tight drop-shadow">Database Assistant</h1>
            </div>
          </div>
        </div>

        {/* Messages Area with gradient background */}
        <div className="flex-1 min-h-[600px] bg-gradient-to-b from-[#0F1A1C] to-[#0A1112] overflow-hidden">
          <div className="h-full relative">
            <div className="absolute inset-0">
              <MessageList messages={messages} isLoading={loading || isSchemaLoading} schemaLoading={isSchemaLoading} />
            </div>
          </div>
        </div>

        {/* Input Area - Fixed at bottom with blur effect */}
        <div className="flex-shrink-0 border-t border-gray-800/40 bg-[#0F1A1C]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <ChatInput
              onSend={handleUserInput}
              disabled={loading || isSchemaLoading}
              placeholder={isSchemaLoading ? "Please wait while database schema is loading..." : "Ask about your database..."}
              awaitingConfirmation={sessionState.awaitingConfirmation}
              sessionActive={sessionState.isActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
