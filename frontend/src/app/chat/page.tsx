"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import ChatContainer from "@/components/chat/ChatContainer";

export default function ChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, [router, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full flex justify-end p-4">
        <button
          className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700 transition"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
      <ChatContainer />
      <footer className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        AI Conversational DB System © 2025
      </footer>
    </main>
  );
}
