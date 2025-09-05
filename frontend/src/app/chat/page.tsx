"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ChatContainer from "@/components/chat/NewChatContainer";
import { useAuth } from "@/context/AuthContext";
// ...existing code...
import { Database } from "lucide-react";


export default function ChatPage() {
  const router = useRouter();
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login');
    }
  }, [token, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F16] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-600/10 via-violet-600/10 to-purple-600/10 backdrop-blur-xl mb-6 mx-auto ring-1 ring-white/10">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-violet-600/30 to-purple-600/30 rounded-xl animate-pulse"></div>
              <Database className="h-8 w-8 text-indigo-400/90 relative z-10" />
            </div>
          </div>
          <p className="text-gray-400/90 text-sm font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#0A0F16]">
      <div className="h-screen">
        <ChatContainer />
      </div>
    </div>
  );
}