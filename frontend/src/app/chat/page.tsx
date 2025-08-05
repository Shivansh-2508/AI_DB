"use client";
import React, { useState, useRef, useEffect } from "react";

// Message bubble component
function MessageBubble({ message, isUser, isError }) {
  return (
    <div
      className={`flex w-full mb-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[70%] px-4 py-2 rounded-lg text-sm shadow
          ${isUser ? "bg-blue-600 text-white" : isError ? "bg-red-100 text-red-700" : "bg-gray-100 dark:bg-gray-800 dark:text-gray-100"}`}
      >
        {message}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      text: "Hi! Ask me anything about your database.",
      isUser: false,
      isError: false,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages((msgs) => [...msgs, { text: userMsg, isUser: true }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessages((msgs) => [
          ...msgs,
          {
            text: data.error || "Something went wrong.",
            isUser: false,
            isError: true,
          },
        ]);
      } else {
        let msg = "";
        if (data.message) msg += data.message + "\n";
        if (data.sql) msg += `SQL: ${data.sql}\n`;
        if (data.result) msg += `Result: ${JSON.stringify(data.result)}`;
        setMessages((msgs) => [
          ...msgs,
          { text: msg.trim(), isUser: false, isError: false },
        ]);
      }
    } catch (err) {
      setMessages((msgs) => [
        ...msgs,
        {
          text: "Network error. Please try again.",
          isUser: false,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground px-4">
      <div className="w-full max-w-xl bg-white dark:bg-black rounded-lg shadow-lg p-6 flex flex-col h-[80vh]">
        <div className="flex-1 overflow-y-auto mb-4">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              message={msg.text}
              isUser={msg.isUser}
              isError={msg.isError}
            />
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400 dark:bg-gray-900 dark:text-white"
            placeholder="Type your question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading || !input.trim()}
          >
            {loading ? "..." : "Send"}
          </button>
        </form>
      </div>
      <footer className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        AI Conversational DB System &copy; 2025
      </footer>
    </div>
  );
}
