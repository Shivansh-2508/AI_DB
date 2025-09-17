"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Database, Bot, User } from "lucide-react";
import MessageBubble, { MessageBubbleProps } from "./MessageBubble";
import TableView from "./TableView";
import ChartRenderer, { ChartConfig } from "./ChartRenderer";

export interface TableResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface Message extends MessageBubbleProps {
  id: string;
  timestamp: Date;
  type?: "user" | "assistant" | "system" | "error";
  results?: TableResult;
  sql?: string;
  chart?: ChartConfig;
}

export interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

import { useAuth } from "@/context/AuthContext";

export default function MessageList({ messages, isLoading }: MessageListProps) {
  // SessionContext removed; chat is now user_id-based
  const bottomRef = useRef<HTMLDivElement>(null);
  const { token, logout } = useAuth();
  const authHeaders: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};
  
  // Track chart loading and configs per message id
  const [chartLoading, setChartLoading] = useState<{[id: string]: boolean}>({});
  const [charts, setCharts] = useState<{[id: string]: ChartConfig | null}>({});

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, charts]);

  const getLoadingMessage = () => {
    const loadingMessages = [
      "Analyzing your query...",
      "Generating SQL...",
      "Executing query...",
      "Processing results...",
      "Thinking..."
    ];
    return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
  };

  const isTableResult = (r: unknown): r is TableResult => {
    return (
      !!r &&
      typeof r === 'object' &&
      Array.isArray((r as TableResult).columns) &&
      Array.isArray((r as TableResult).rows)
    );
  };

  // Chart generation per message (new privacy-preserving flow)
  const handleGenerateChart = async (msg: Message) => {
    if (!msg || !isTableResult(msg.results)) return;
    setChartLoading(prev => ({ ...prev, [msg.id]: true }));
    try {
      // Find the user query that led to this assistant message
      const idx = messages.findIndex(m => m.id === msg.id);
      const prevUser = idx > 0 ? [...messages.slice(0, idx)].reverse().find(m => m.isUser || m.type === "user") : undefined;
      const query = (prevUser?.text || "").trim();
      if (!query) {
        console.warn("No user query found prior to results; cannot generate chart.");
        setChartLoading(prev => ({ ...prev, [msg.id]: false }));
        return;
      }

      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000";
      const res = await fetch(`${base}/generate_chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        return;
      }

      const { columns = [], rows = [], chart_type = "", confidence = 0 } = data || {};
      if (!Array.isArray(columns) || columns.length < 2 || !Array.isArray(rows) || rows.length <= 1) {
        console.warn("Backend did not return enough data to chart.");
        setChartLoading(prev => ({ ...prev, [msg.id]: false }));
        return;
      }

      // Optional: gate on low confidence
      if (typeof confidence === "number" && confidence < 0.6) {
        const proceed = typeof window !== 'undefined' ? window.confirm("The AI isn't very confident in this chart (confidence < 0.6). Proceed?") : true;
        if (!proceed) {
          setChartLoading(prev => ({ ...prev, [msg.id]: false }));
          return;
        }
      }

      // Coerce row values to string|number for ChartConfig typing safety
      const safeRows: Record<string, string | number>[] = (rows as Record<string, unknown>[]).map(row => {
        const out: Record<string, string | number> = {};
        for (const k of Object.keys(row)) {
          const v: unknown = row[k as keyof typeof row];
          out[k] = (typeof v === 'number' || typeof v === 'string') ? v : (v == null ? '' : String(v));
        }
        return out;
      });

      const chartConfig: ChartConfig = {
        type: chart_type || "bar",
        x: String(columns[0]),
        y: String(columns[1]),
        data: safeRows,
      };

      setCharts(prev => ({ ...prev, [msg.id]: chartConfig }));
    } catch (err) {
      setCharts(prev => ({ ...prev, [msg.id]: null }));
      console.error("Chart generation failed:", err);
    }
    setChartLoading(prev => ({ ...prev, [msg.id]: false }));
  };

  return (
    <div className="flex flex-col h-full bg-[#0F1A1C]">
      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        <div className="max-w-screen-xl mx-auto px-4">
          {messages.map((message: Message) => {
            const isUser = message.isUser || message.type === "user";
            return (
              <div
                key={message.id}
                className="group relative mb-6 last:mb-0"
              >
                <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isUser 
                        ? 'bg-gray-700/40 text-gray-300' 
                        : 'bg-gradient-to-r from-emerald-500/80 to-sky-500/80 text-gray-100'
                    }`}>
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-medium ${isUser ? 'text-gray-400 order-last' : 'text-emerald-500/90'}`}>
                        {isUser ? 'You' : 'Assistant'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className={`prose prose-sm max-w-none ${isUser ? 'prose-gray' : 'prose-invert'}`}>
                      <MessageBubble {...message} />
                    </div>

                    {message.results && (
                      <div className="mt-4 space-y-4">
                        <div className="bg-gray-900/50 rounded-lg p-4 backdrop-blur">
                          <TableView results={message.results} />
                        </div>
                        
                        {message.sql && (
                          <div className="bg-gray-900/50 rounded-lg p-4 backdrop-blur">
                            <div className="text-xs text-gray-400 mb-2 font-mono">Generated SQL:</div>
                            <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap">{String(message.sql)}</pre>
                          </div>
                        )}

                        {isTableResult(message.results) && message.results.columns.length >= 2 && message.results.rows.length > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              className={`inline-flex items-center gap-2 px-4 py-2 text-xs rounded-lg transition ${
                                chartLoading[message.id]
                                  ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                                  : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                              }`}
                              onClick={() => handleGenerateChart(message)}
                              disabled={chartLoading[message.id]}
                            >
                              {chartLoading[message.id] ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Generating Chart...</span>
                                </>
                              ) : (
                                <>
                                  <span>Generate Chart</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {charts[message.id] && (
                          <div className="mt-4 bg-gray-900/50 rounded-lg p-4 backdrop-blur">
                            <ChartRenderer config={charts[message.id]!} />
                          </div>
                        )}
                      </div>
                    )}

                    {(() => {
                      try {
                        const jsonMatch = (message.text || "").match(/```json\n([\s\S]*?)```/i);
                        if (jsonMatch && jsonMatch[1]) {
                          const parsed = JSON.parse(jsonMatch[1]);
                          return (
                            <div className="mt-4 bg-gray-900/50 rounded-lg p-4 backdrop-blur">
                              <TableView results={parsed} />
                            </div>
                          );
                        }
                      } catch {
                        // ignore parse errors
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-r from-emerald-500/80 to-sky-500/80">
                  <Bot className="h-4 w-4 text-gray-100" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500/90" />
                  <span className="text-sm">{getLoadingMessage()}</span>
                </div>
                <div className="flex gap-1.5 mt-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 animate-pulse"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-64 text-center py-12">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-r from-emerald-500/20 to-sky-500/20 mb-6">
                <Database className="h-8 w-8 text-emerald-500/90" />
              </div>
              <h3 className="text-lg font-medium mb-3 text-gray-100">Ready to Query</h3>
              <p className="max-w-md text-sm leading-relaxed text-gray-400">
                Ask me anything about your database. I can help you explore tables, run queries, and analyze your data with natural language.
              </p>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
