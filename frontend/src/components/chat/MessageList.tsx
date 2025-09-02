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

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const sessionId = useContext(SessionContext);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, chartConfig]);

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

  // Find the most recent assistant table result
  const lastTableMsg = [...messages].reverse().find((m: Message) => m.results && m.type === "assistant");
  // Type guard for TableResult
  const isTableResult = (r: unknown): r is TableResult => {
    return (
      !!r &&
      typeof r === 'object' &&
      Array.isArray((r as TableResult).columns) &&
      Array.isArray((r as TableResult).rows)
    );
  };
  // Show chart button if lastTableMsg exists and has at least 2 columns and more than 1 row
  const showChartButton = lastTableMsg && isTableResult(lastTableMsg.results) && lastTableMsg.results.columns.length >= 2 && lastTableMsg.results.rows.length > 1;

  const handleGenerateChart = async () => {
    if (!lastTableMsg || !isTableResult(lastTableMsg.results)) return;
    setChartLoading(true);
    try {
      // Prepare chart config and data
      const columns = lastTableMsg.results.columns;
      const rows = lastTableMsg.results.rows;
      // Use first two columns for x and y axes
      const x = columns[0];
      const y = columns[1];
      // Data is already in Record<string, unknown>[] format
      // Convert all values to string | number for chart compatibility
      const safeRows: Record<string, string | number>[] = rows.map(row => {
        const safeRow: Record<string, string | number> = {};
        for (const key of Object.keys(row)) {
          const val = row[key];
          safeRow[key] = typeof val === 'number' || typeof val === 'string' ? val : String(val);
        }
        return safeRow;
      });
      const chartConfig = {
        type: "bar",
        x,
        y,
        data: safeRows
      };
      // Call backend /chart route with correct payload
      const res = await fetch("http://localhost:5000/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          table: { columns, rows },
          chart: chartConfig
        })
      });
      const data = await res.json();
      if (data.chart) {
        setChartConfig(data.chart);
      } else {
        setChartConfig(chartConfig);
      }
    } catch (err: any) {
      console.error("Chart generation failed:", err);
    }
    setChartLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {messages.map((message: Message) => {
          const isUser = message.isUser || message.type === "user";
          if (message.chart && typeof message.chart === "object") {
            return (
              <div key={message.id} className="flex justify-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E91E63 0%, #14B8A6 100%)' }}>
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="max-w-[70%] rounded-lg px-4 py-3 shadow-sm rounded-bl-sm" style={{ backgroundColor: '#FEFCF6', border: '1px solid #D3C3B9' }}>
                  <div className="text-xs font-medium mb-1 opacity-70" style={{ color: '#162A2C' }}>AI</div>
                  <ChartRenderer config={message.chart} />
                  <div className="text-xs mt-1 opacity-50" style={{ color: '#162A2C' }}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          }
          // Default message rendering
          return (
            <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E91E63 0%, #14B8A6 100%)' }}>
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              <div className={`max-w-[70%] rounded-lg px-4 py-3 shadow-sm ${isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`} style={{ backgroundColor: isUser ? '#E3F2FD' : '#FEFCF6', border: `1px solid ${isUser ? '#BBDEFB' : '#D3C3B9'}` }}>
                <div className="text-xs font-medium mb-1 opacity-70" style={{ color: '#162A2C' }}>{isUser ? 'You' : 'AI'}</div>
                <div style={{ color: '#162A2C' }}>
                  <MessageBubble {...message} />
                </div>
                {message.results ? (
                  <div className="mt-2">
                    <TableView results={message.results} />
                    {message.sql && (
                      <pre className="mt-3 text-xs bg-[#0F1720] text-[#E6EEF6] p-2 rounded">{String(message.sql)}</pre>
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
                <div className="text-xs mt-1 opacity-50" style={{ color: '#162A2C' }}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              {isUser && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-lg border flex items-center justify-center" style={{ backgroundColor: '#FEFCF6', borderColor: '#D3C3B9' }}>
                    <User className="h-4 w-4" style={{ color: '#162A2C' }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {/* Chart button and renderer for latest table */}
        {showChartButton && lastTableMsg && (
          <div className="flex justify-start gap-3">
            <button
              className="bg-[#14B8A6] text-white px-4 py-2 rounded shadow hover:bg-[#0F1720] transition"
              onClick={handleGenerateChart}
              disabled={chartLoading}
            >
              {chartLoading ? "Generating Chart..." : "Generate Chart"}
            </button>
          </div>
        )}
        {chartConfig && (
          <div className="flex justify-start gap-3">
            <ChartRenderer config={chartConfig} />
          </div>
        )}
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