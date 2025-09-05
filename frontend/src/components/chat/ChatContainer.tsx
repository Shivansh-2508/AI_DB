"use client";
import { useState, useEffect, useRef, useCallback, createContext } from "react";
import { useAuth } from "@/context/AuthContext";
import { Database, AlertTriangle } from "lucide-react";
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

export const SessionContext = createContext<string | null>(null);

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const { user } = useAuth();
  const userEmail = user?.email || null;
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>({
    isActive: true,
    lastActivity: new Date(),
    messageCount: 0,
    awaitingConfirmation: false
  });
  const { logout } = useAuth();
  
  // Phase 3: Persistent session ID with cleanup
  const [sessionId] = useState(() => {
    try {
      const existing = localStorage.getItem("chat_session_id");
      if (existing) return existing;
    } catch {
      // localStorage might be unavailable in some environments (SSR/locked down)
    }

    const newId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

    try { localStorage.setItem("chat_session_id", newId); } catch { /* ignore */ }
    console.log(`🔄 New session created: ${newId}`);
    return newId;
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
    setClearing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? ""}/chat/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data && data.error ? data.error : 'Failed to clear chat on server';
        console.error(msg);
        // show transient error message in chat using state update
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

      // Successful clear: update local state with a single system message
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

      // Reset message ID tracking
      usedMessageIds.current.clear();
      messageIdCounterRef.current = 0;

      console.log(`🧹 Chat history cleared for session: ${sessionId}`);
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
    } finally {
      setClearing(false);
    }
  }, [sessionId, generateMessageId]);

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userEmail,
        sessionId: sessionId,
        messageId: newMessage.id,
        content: newMessage.text,
        role: msg.type || "assistant",
        // include structured fields if present so persisted history contains full results
  results: msg.results ?? undefined,
  sql: msg.sql ?? undefined
      })
    }).catch(err => console.error("Failed to save message to backend", err));
}, [generateMessageId, sessionId, userEmail]);

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

  // User email now derived from AuthContext; no async fetch needed
  useEffect(() => {
    updateActivity();
  }, [updateActivity]);

  // --- New: load persisted chat history from backend as soon as we have a sessionId ---
  // This runs regardless of whether the userEmail is available so anonymous sessions
  // still restore their chat history on reload.
  const persistedLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? ""}/chat/${sessionId}`);
        const data = await res.json();
        if (cancelled) return;

        const history = data.history || [];
        if (!Array.isArray(history) || history.length === 0) {
          // No persisted messages — show welcome message once
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
          return; // nothing persisted
        }

  // Map backend rows to local Message shape
  const mapped: Message[] = history.map((h: BackendMessageWithStructured) => {
          const id = h.message_id || h.messageId || h.id || generateMessageId();
          // ensure used ids tracked
          usedMessageIds.current.add(id);

          const timestamp = h.timestamp ? new Date(h.timestamp) : new Date();
          const isUser = (h.type === "user" || h.role === "user");
          const isError = (h.type === "error" || h.role === "error");

          // If the backend stored a structured payload in `content` (e.g. { type: 'results', rows, columns, sql })
          // restore results/sql into the message object and convert text to a safe string summary.
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
                // Preserve full structured shape (columns + rows) and normalize rows so that
                // every row is an object keyed by column name. This fixes misalignment when
                // rows were stored as arrays of values.
                const providedCols = Array.isArray(contentObj.columns)
                  ? (contentObj.columns as unknown[]).map((c) => String(c))
                  : undefined;

                const rawRows = contentObj.rows as unknown[];
                const normalizedRows: Record<string, unknown>[] = rawRows.map((r) => {
                  if (Array.isArray(r)) {
                    // Map positional array to object using providedCols when available.
                    if (providedCols && providedCols.length >= r.length) {
                      const obj: Record<string, unknown> = {};
                      (r as unknown[]).forEach((val, idx) => { obj[providedCols[idx]] = val; });
                      return obj;
                    }
                    // Fallback: create numeric column names
                    const obj: Record<string, unknown> = {};
                    (r as unknown[]).forEach((val, idx) => { obj[`col_${idx}`] = val; });
                    return obj;
                  }

                  if (r && typeof r === 'object') return r as Record<string, unknown>;
                  return { value: r };
                });

                // If providedCols was missing, derive columns from first normalized row
                const derivedCols = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
                const finalCols = providedCols && providedCols.length ? providedCols : derivedCols;

                resultsVal = { columns: finalCols, rows: normalizedRows } as unknown;
                sqlVal = sqlVal ?? (typeof contentObj.sql === 'string' ? contentObj.sql : (contentObj.sql ? String(contentObj.sql) : undefined));
                // keep a concise human-readable summary in the bubble
                textVal = textVal || `Results: ${normalizedRows.length} row${normalizedRows.length === 1 ? '' : 's'}`;
              } else {
                // Generic object: stringify for display
                textVal = textVal || JSON.stringify(contentObj);
              }
            } catch {
              // fallback to safe string conversion
              textVal = textVal || String(h.content);
            }
          } else if (!textVal && typeof h.content === 'string') {
            textVal = h.content;
          }

          return {
            id,
            text: textVal,
            // restore structured results/sql if backend persisted them
            results: resultsVal ?? undefined,
            sql: sqlVal ?? undefined,
            isUser,
            isError,
            timestamp,
            type: h.type || h.role || (isUser ? "user" : "assistant"),
          } as Message;
        });

        // Update message counter to avoid id collisions for newly generated ids
        messageIdCounterRef.current = Math.max(messageIdCounterRef.current, mapped.length);

        // Replace messages only if we haven't already loaded persisted history
        setMessages(mapped);

        // update session state counts
        setSessionState(prev => ({ ...prev, messageCount: mapped.length }));

        persistedLoadedRef.current = true;
        console.log(`✅ Loaded ${mapped.length} persisted messages for session ${sessionId}`);
      } catch (err) {
        console.error("Failed to load persisted chat history:", err);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [sessionId, generateMessageId, userEmail]);

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
          // Regular query response: attach structured results & sql
          const assistantTextParts: string[] = [];
          if (data.message) assistantTextParts.push(data.message);
          if (data.sql) assistantTextParts.push("Generated SQL available.");

          // Use the normalizeResults helper function
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
    <div className="h-[calc(100vh-1px)] flex flex-col">
      {/* Chat Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b" style={{ 
        backgroundColor: 'rgba(22, 42, 44, 0.98)',
        borderColor: 'rgba(211, 195, 185, 0.3)'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* AI Icon with gradient */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ 
              background: 'linear-gradient(135deg, #E91E63 0%, #14B8A6 100%)'
            }}>
              <Database className="h-4 w-4 text-white" />
            </div>
            
            <div>
              <h1 className="text-base font-medium" style={{ color: '#FEFCF6' }}>
                Database Assistant
              </h1>
              <div className="flex items-center gap-2 text-xs font-mono" style={{ color: '#D3C3B9' }}>
                <span>{sessionState.messageCount} queries</span>
                {sessionState.isActive && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-green-400"></div>
                      <span>active</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Status and Controls */}
          <div className="flex items-center gap-3">
             {/* Session Status */}
             {!sessionState.isActive && (
               <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: '#D3C3B9' }}>
                 <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#D3C3B9' }}></div>
                 <span>inactive</span>
               </div>
             )}
             
             {/* Confirmation Status */}
             {sessionState.awaitingConfirmation && (
               <div className="flex items-center gap-1.5 text-xs text-yellow-400 font-mono">
                 <AlertTriangle className="h-3 w-3" />
                 <span>confirm</span>
               </div>
             )}

             {/* Clear Chat Button */}
             <button
               type="button"
               disabled={clearing}
               onClick={() => {
                 if (typeof window !== 'undefined' && window.confirm('Clear all chat history for this session?')) {
                   clearChatHistory();
                 }
               }}
               className="text-xs hover:text-opacity-80 transition-colors duration-200 font-mono"
               style={{ color: '#D3C3B9' }}
               aria-label="Clear chat history"
             >
               {clearing ? 'clearing...' : 'clear'}
             </button>

             {/* Logout Button */}
             <button
               type="button"
               onClick={() => {
                 logout();
                 if (typeof window !== 'undefined') {
                   window.location.href = '/';
                 }
               }}
               className="text-xs hover:text-opacity-80 transition-colors duration-200 font-mono"
               style={{ color: '#D3C3B9' }}
               aria-label="Logout"
             >
               logout
             </button>
           </div>
        </div>
      </div>


      {/* Messages Area */}
      <SessionContext.Provider value={sessionId}>
        <div className="flex-1 min-h-0" style={{ backgroundColor: '#162A2C' }}>
          <MessageList messages={messages} isLoading={loading} />
        </div>
      </SessionContext.Provider>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t" style={{ 
        backgroundColor: 'rgba(22, 42, 44, 0.98)',
        borderColor: 'rgba(211, 195, 185, 0.3)'
      }}>
        <ChatInput 
          onSend={handleUserInput} 
          disabled={loading}
          placeholder="Ask about your database..."
          awaitingConfirmation={sessionState.awaitingConfirmation}
          sessionActive={sessionState.isActive}
        />
      </div>
    </div>
  );
}