"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ChatContainer from "@/components/chat/ChatContainer";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const router = useRouter();
  const { token, logout } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    } else {
      setLoading(false);
    }
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white/70 backdrop-blur-sm">
        <h1 className="text-sm font-semibold text-zinc-800">Chat</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            logout();
            router.push('/');
          }}
          className="text-xs"
        >Logout</Button>
      </div>
      <div className="flex-1 min-h-0">
        <ChatContainer />
      </div>
    </div>
  );
}