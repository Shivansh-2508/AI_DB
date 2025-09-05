"use client";
import { useEffect, useRef, useState, useContext } from "react";
import { Loader2, Database, Bot, User } from "lucide-react";

import MessageBubble, { MessageBubbleProps } from "./MessageBubble";
import TableView from "./TableView";
import ChartRenderer, { ChartConfig } from "./ChartRenderer";
import { SessionContext } from "./ChatContainer";
import { useAuth } from "@/context/AuthContext";

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

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const sessionId = useContext(SessionContext);
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

  // Chart generation per message
  const handleGenerateChart = async (msg: Message) => {
    if (!msg || !isTableResult(msg.results)) return;
    setChartLoading(prev => ({ ...prev, [msg.id]: true }));
    try {
      const columns = msg.results.columns;
      const rows = msg.results.rows;
      const x = columns[0];
      const y = columns[1];
      const safeRows: Record<string, string | number>[] = rows.map(row => {
        const safeRow: Record<string, string | number> = {};
        for (const key of Object.keys(row)) {
          const val = row[key];
          safeRow[key] = typeof val === 'number' || typeof val === 'string' ? val : String(val);
        }
        return safeRow;
      });
      const chartConfig: ChartConfig = {
        type: "bar",
        x,
        y,
        data: safeRows
      };
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000";
      const res = await fetch(`${base}/chart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          session_id: sessionId,
          table: { columns, rows },
          chart: chartConfig
        })
      });
      const data = await res.json();
      if (res.status === 401) {
        logout();
        return;
      }
      setCharts(prev => ({ ...prev, [msg.id]: data.chart || chartConfig }));
    } catch (err) {
      setCharts(prev => ({ ...prev, [msg.id]: null }));
      console.error("Chart generation failed:", err);
    }
    setChartLoading(prev => ({ ...prev, [msg.id]: false }));
  };

  return (
    <div className="flex flex-col space-y-4 px-4 py-4 overflow-y-auto h-full">
      {messages.map((message: Message) => {
        const isUser = message.isUser || message.type === "user";
        const isSystem = message.type === "system";
        const isError = message.isError || message.type === "error";
        
        return (
          <div key={message.id} className={`flex gap-2 sm:gap-4 ${isSystem ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'}`}>
            {/* Avatar - Mobile Optimized */}
            {!isUser && !isSystem && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <Bot className="h-4 w-4 text-gray-300" />
              </div>
            )}
            
            {/* Message Content - Mobile Optimized */}
            <div className={`max-w-[90%] sm:max-w-[85%] lg:max-w-[70%] ${isUser ? 'order-first' : ''}`}>
              {isSystem ? (
                <div className="text-center py-2">
                  <span className="inline-block px-3 py-1 bg-[#0A0F16]/80 text-gray-400 text-xs rounded-full border border-gray-800/40">
                    {message.text}
                  </span>
                </div>
              ) : (
                <div className={`rounded-lg px-4 py-3 ${isUser ? 'bg-gray-800/50' : 'bg-transparent'} text-gray-100`}>
                  {/* Message Header - Minimal */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {isUser ? 'You' : isError ? 'Error' : 'Assistant'}
                    </span>
                    <span className="text-xs text-gray-600">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Message Text - Mobile Optimized */}
                  <div className="text-sm leading-relaxed">
                    <MessageBubble {...message} />
                  </div>

                  {/* SQL Code Block - Minimal */}
                  {message.sql && !isError && (
                    <div className="mt-3 rounded bg-gray-800/50 overflow-hidden">
                      <div className="px-3 py-1.5 border-b border-gray-700/30 flex items-center gap-2">
                        <span className="text-xs text-gray-400">Generated SQL</span>
                      </div>
                      <div className="overflow-x-auto">
                        <pre className="p-3 text-sm font-mono text-gray-300 whitespace-pre-wrap">
                          {String(message.sql)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Results Table - Minimal */}
                  {message.results && !isError && (
                    <div className="mt-3 p-2 rounded bg-gray-800/50 overflow-hidden">
                      <div className="px-3 py-1.5 border-b border-gray-700/30 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            Results ({(message.results as TableResult).rows?.length || 0} rows)
                          </span>
                        </div>
                        {isTableResult(message.results) && message.results.columns.length >= 2 && message.results.rows.length > 1 && (
                          <button
                            onClick={() => handleGenerateChart(message)}
                            disabled={chartLoading[message.id]}
                            className="text-xs bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors ring-1 ring-white/5 disabled:opacity-50 flex-shrink-0"
                          >
                            {chartLoading[message.id] ? 'Generating...' : 'Chart'}
                          </button>
                        )}
                      </div>
                      <div className="max-h-[400px] overflow-auto">
                        <TableView results={message.results} />
                      </div>
                      {/* Chart Display - Minimal */}
                      {charts[message.id] && (
                        <div className="p-4 border-t border-gray-700/30">
                          <ChartRenderer config={charts[message.id]!} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Avatar - Minimal */}
            {isUser && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-gray-300" />
              </div>
            )}
          </div>
        );
      })}

      {/* Loading Indicator - Minimal */}
      {isLoading && (
        <div className="flex gap-3 justify-start">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <Bot className="h-4 w-4 text-gray-300" />
          </div>
          <div className="rounded px-4 py-3 bg-gray-800/50 text-gray-100 max-w-xs">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
              <span className="text-sm text-gray-400">{getLoadingMessage()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State - Mobile Optimized */}
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 flex items-center justify-center mb-4 sm:mb-6 shadow-lg">
            <Database className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">Ready to explore your database</h3>
          <p className="text-gray-400 max-w-md leading-relaxed text-sm sm:text-base mb-4 sm:mb-6">
            Ask me anything about your database. I can help you query tables, analyze data, and generate insights using natural language.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-sm font-medium text-white mb-1">Try asking:</div>
              <div className="text-xs text-gray-400">&ldquo;Show me all customers&rdquo;</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-sm font-medium text-white mb-1">Or explore:</div>
              <div className="text-xs text-gray-400">&ldquo;What tables are available?&rdquo;</div>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
