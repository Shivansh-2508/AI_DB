"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import ChatContainer from "@/components/chat/ChatContainer";
import { useAuth } from "@/context/AuthContext";

export default function ChatPage() {
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();

  useEffect(() => {
    // Only redirect if auth is done loading and there's no token
    if (!authLoading && !token) {
      router.replace('/login');
    }
  }, [token, authLoading, router]);

  // Show loading while auth context is still loading
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-gray-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Show loading if no token (will redirect soon)
  if (!token) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-gray-600 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <ChatContainer />;
}