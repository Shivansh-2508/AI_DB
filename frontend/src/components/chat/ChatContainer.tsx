"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Database, Sparkles } from "lucide-react";
import ChatInput from "./ChatInput";
import MessageList, { Message } from "./MessageList";

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "system",
      text: "Hello! I'm here to help you query and explore your database. What would you like to know?",
      isUser: false,
      isError: false,
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));

  const addMessage = (msg: Omit<Message, "id" | "timestamp">) => {
    setMessages((m) => [
      ...m,
      { id: Date.now().toString(), timestamp: new Date(), ...msg },
    ]);
  };

  const sendToBackend = async (text: string) => {
    addMessage({ text, isUser: true });
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE ?? ""}/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, session_id: sessionId }),
        }
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        addMessage({ text: data.error ?? "Unable to process your request. Please try again.", isError: true });
      } else {
        let reply = "";
        if (data.message) reply += `${data.message}\n`;
        if (data.sql) reply += `\`\`\`sql\n${data.sql}\n\`\`\`\n`;
        if (data.result) reply += `**Result:**\n\`\`\`json\n${JSON.stringify(data.result, null, 2)}\n\`\`\``;
        addMessage({ text: reply.trim() });
      }
    } catch {
      addMessage({ text: "Connection failed. Please check your network and try again.", isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-[85vh] flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
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
                Natural language to SQL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Sparkles className="h-3 w-3" />
            <span>AI Powered</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-slate-50/30 dark:bg-slate-900/30">
        <MessageList messages={messages} isLoading={loading} />
      </div>
      
      <div className="flex-shrink-0">
        <ChatInput onSend={sendToBackend} disabled={loading} />
      </div>
    </div>
  );
}