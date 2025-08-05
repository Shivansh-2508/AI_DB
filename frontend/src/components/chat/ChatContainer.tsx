"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Database } from "lucide-react";
import ChatInput from "./ChatInput";
import MessageList, { Message } from "./MessageList";

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "system",
      text: "Hi 👋 Ask me anything about your database.",
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
        addMessage({ text: data.error ?? "Unknown error", isError: true });
      } else {
        let reply = "";
        if (data.message) reply += `${data.message}\n`;
        if (data.sql) reply += `SQL: ${data.sql}\n`;
        if (data.result) reply += `Result: ${JSON.stringify(data.result)}`;
        addMessage({ text: reply.trim() });
      }
    } catch {
      addMessage({ text: "Network error. Please try again.", isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto h-[80vh] flex flex-col bg-zinc-900 border-zinc-800">
      <CardHeader className="bg-gradient-to-r from-indigo-700 to-purple-800 border-b border-zinc-800 text-zinc-100">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Database className="h-5 w-5" />
          Ask Your Database
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col">
        <MessageList messages={messages} isLoading={loading} />
        <ChatInput onSend={sendToBackend} disabled={loading} />
      </CardContent>
    </Card>
  );
}
