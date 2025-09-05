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

import { useContext } from "react";
import { SessionContext } from "./ChatContainer";
import { useAuth } from "@/context/AuthContext";

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
    <div className="flex flex-col h-full" style={{ width: '100%' }}>
      <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundColor: '#162A2C', borderRadius: 16, maxWidth: '1100px', margin: '0 auto', minWidth: '700px' }}>
        {messages.map((message: Message) => {
          const isUser = message.isUser || message.type === "user";
          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} w-full`}
              style={{ width: '100%' }}
            >
              {/* AI bubble on left, user bubble on right */}
              {!isUser && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E91E63 0%, #14B8A6 100%)' }}>
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              <div
                className={`rounded-lg px-6 py-4 shadow-sm ${isUser ? 'rounded-br-2xl ml-auto' : 'rounded-bl-2xl mr-auto'}`}
                style={{
                  backgroundColor: isUser ? '#E3F2FD' : '#FEFCF6',
                  border: `1px solid ${isUser ? '#BBDEFB' : '#D3C3B9'}`,
                  maxWidth: '60%',
                  minWidth: '340px',
                  textAlign: isUser ? 'right' : 'left',
                  marginLeft: isUser ? 'auto' : undefined,
                  marginRight: !isUser ? 'auto' : undefined
                }}
              >
                <div className="text-xs font-medium mb-1 opacity-70" style={{ color: '#162A2C', textAlign: isUser ? 'right' : 'left' }}>{isUser ? 'You' : 'AI'}</div>
                <div style={{ color: '#162A2C', textAlign: isUser ? 'right' : 'left' }}>
                  <MessageBubble {...message} />
                </div>
                {message.results ? (
                  <div className="mt-2">
                    <TableView results={message.results} />
                    {message.sql && (
                      <pre className="mt-3 text-xs bg-[#0F1720] text-[#E6EEF6] p-2 rounded">{String(message.sql)}</pre>
                    )}
                    {/* Chart button and chart for this table */}
                    {isTableResult(message.results) && message.results.columns.length >= 2 && message.results.rows.length > 1 && (
                      <div className="mt-3">
                        <button
                          className="bg-[#14B8A6] text-white px-4 py-2 rounded shadow hover:bg-[#0F1720] transition"
                          onClick={() => handleGenerateChart(message)}
                          disabled={chartLoading[message.id]}
                          style={{ float: isUser ? 'right' : 'left' }}
                        >
                          {chartLoading[message.id] ? "Generating Chart..." : "Generate Chart"}
                        </button>
                        {charts[message.id] && (
                          <div className="mt-4">
                            <ChartRenderer config={charts[message.id]!} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (() => {
                  try {
                    const jsonMatch = (message.text || "").match(/```json\n([\s\S]*?)```/i);
                    if (jsonMatch && jsonMatch[1]) {
                      const parsed = JSON.parse(jsonMatch[1]);
                      return (
                        <div className="mt-2">
                          <TableView results={parsed} />
                        </div>
                      );
                    }
                  } catch {
                    // ignore parse errors
                  }
                  return null;
                })()}
                <div className="text-xs mt-1 opacity-50" style={{ color: '#162A2C', textAlign: isUser ? 'right' : 'left' }}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              {isUser && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-lg border flex items-center justify-center" style={{ backgroundColor: '#FEFCF6', borderColor: '#BBDEFB' }}>
                    <User className="h-4 w-4" style={{ color: '#162A2C' }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E91E63 0%, #14B8A6 100%)' }}>
                <Bot className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="max-w-[70%] rounded-lg rounded-bl-sm px-4 py-3 shadow-sm" style={{ backgroundColor: '#FEFCF6', border: '1px solid #D3C3B9' }}>
              <div className="flex items-center gap-2" style={{ color: '#162A2C' }}>
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#14B8A6' }} />
                <span className="text-sm">{getLoadingMessage()}</span>
              </div>
              <div className="flex gap-1 mt-2">
                <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: '#14B8A6' }}></div>
                <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: '#14B8A6', animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: '#14B8A6', animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-lg border flex items-center justify-center mb-4" style={{ backgroundColor: '#FEFCF6', borderColor: '#D3C3B9' }}>
              <Database className="h-8 w-8" style={{ color: '#162A2C' }} />
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: '#FEFCF6' }}>Ready to Query</h3>
            <p className="max-w-md text-sm leading-relaxed opacity-80" style={{ color: '#D3C3B9' }}>
              Ask me anything about your database. I can help you explore tables, run queries, and analyze your data with natural language.
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}